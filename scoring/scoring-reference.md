---
description: The scoring formula, the required WASM export interface, on-chain registration, and the two validation gates a module must clear before it goes live.
---

# Scoring Reference

This is the reference for the WASM module that scores and ranks miner answers
per intent — what it computes, how the ranking pipeline uses it, how to
register your own on-chain, and the exact function contract a module must
implement. It does **not** cover miner code execution: miners are plain HTTP
services (see the [YAML Configuration](../miners/yaml-config.md) guide); WASM
here only judges their answers.

New to this? Start with [Build a Scoring Module](build-a-scoring-module.md),
which walks through a working example first.

## Contents

1. [What the WASM module does](#1-what-the-wasm-module-does)
2. [How ranking works end to end](#2-how-ranking-works-end-to-end)
3. [How to register your own scoring module](#3-how-to-register-your-own-scoring-module)
4. [The required interface](#4-the-required-interface)
5. [Validation gates a candidate must clear](#5-validation-gates-a-candidate-must-clear)
6. [Minimal example module](#6-minimal-example-module)

---

## 1. What the WASM module does

For a given `(question, ground_truth, miner_answer)` triple, the module
computes a single composite quality score in `[0, 1]`. The live/default
module (`pkg/scoring/scoring.wasm`, compiled from Rust sources under
`pkg/wasm/code/`) combines four signals:

| Signal | Weight | Meaning |
|---|---|---|
| Relevance | 0.25 | cosine similarity(question, miner_answer) |
| Correctness | 0.50 | cosine similarity(ground_truth, miner_answer) |
| Lexical | 0.15 | BM25(ground_truth, miner_answer) |
| Length quality | 0.10 | `sigmoid((byte_length - 50) / 20)` — rewards answers past ~50 bytes, no penalty for being long. Monotonically increasing, not a "too short/too long" curve: a giant wall of text scores near-max on this signal same as a well-sized one. |

This formula lives entirely inside the WASM module — `pkg/scoring` and
`pkg/wasm/runtime` never reimplement it in Go, they only call into it.

The runtime that loads and drives a module is
[`pkg/wasm/runtime`](https://github.com/telegraphprotocol/Telegraph/blob/develop/pkg/wasm/runtime/runtime.go), built on
[wazero](https://wazero.io) (a pure-Go WASM runtime — no cgo, no native
sandboxing dependency). Each module runs sandboxed with only linear memory
and the exported functions below; it cannot make network calls or touch the
filesystem.

## 2. How ranking works end to end

1. Every epoch, `pkg/scoring/epoch_scorer.go`'s `EpochScorer.RunEpoch` loads
   active miners per intent, fetches each intent's ground truth
   (`GroundTruthClient`), and fans out concurrent calls to ask each miner the
   question.
2. Each `(question, ground_truth, miner_answer)` triple is scored by calling
   the WASM module's `rank_answer` via a pooled runtime
   (`pkg/wasm/runtime.Pool` — several module instances so concurrent scoring
   calls don't serialize on one WASM instance). `rank_answer` is the only
   scoring export the live path actually calls.
3. Results are sorted best→worst and pushed into
   [`pkg/scoring/ranker.go`](https://github.com/telegraphprotocol/Telegraph/blob/develop/pkg/scoring/ranker.go)'s `Ranker.Update`
   — an in-memory, per-intent leaderboard (`IntentRanking`).
4. The engine's request router (`pkg/engine/router`) reads
   `ranker.TopN(intentID, n)` to pick which miner(s) to call for a live
   `/engine/v1/ask` request.
5. **Scoring is per-intent, not global.** Each `intentID` can have its own
   promoted WASM module (`Scorer.currentPool(intentID)`); an intent with no
   promoted module falls back to the default/genesis module.

## 3. How to register your own scoring module

Registration is **on-chain and permissionless**, not a config file or admin
API. `pkg/register` (despite the name) is unrelated — that package bootstraps
validator/signer identity, not WASM scorers.

1. **Write the module** so it exports the required functions (§4) and
   compiles to a freestanding `wasm32-unknown-unknown` binary (or any
   toolchain that produces the same export surface + linear memory — Rust is
   what the repo uses, nothing wazero-specific requires it).
2. **Host the compiled `.wasm` file** somewhere fetchable by URL (IPFS/S3 —
   whatever the node's outbound fetcher can reach) and compute its
   `keccak256` hash — this has to match `crypto.Keccak256` from
   go-ethereum exactly (the same call `processWasmRecord` in
   `pkg/listener/listener.wasm.go` uses to verify it), since Ethereum's
   Keccak-256 differs from the standardized NIST SHA3-256 despite the
   similar name. `scripts/haider_scripts/keccak_file/keccak_file.go` is a
   small standalone helper that does exactly this (`go run keccak_file.go
   <path>`) — safer than reaching for `cast keccak` directly, since that
   command has no file-read mode and blows past shell `ARG_MAX` on anything
   but small files once you hex-encode it.
3. **Approve the bond**: `approve(diamondAddress, 10_000e18)` on the MACHINA
   token. Registration pulls a fixed 10,000 MACHINA anti-spam bond from you
   (`WASM_BOND` in
   [`contracts/evm/facets/IntentRegistryFacet.sol`](https://github.com/telegraphprotocol/Telegraph/blob/develop/contracts/evm/facets/IntentRegistryFacet.sol)).
   There is no slashing today, but the bond is not automatically refunded if
   your module is rejected — it stays locked.
4. **Call `registerWasm(wasmHash, wasmUrl, whitelistedUrls)`** on
   `IntentRegistryFacet`. This mints a fresh `intentId` for you
   (`keccak256(sender, wasmHash, block.number)`) and emits
   `IntentRegistered(registrationId, sender, ENTITY_WASM_AUTHOR, intentId, wasmUrl, wasmHash)`.
5. From here it's automatic. The node's listener
   ([`pkg/listener/listener.wasm.go`](https://github.com/telegraphprotocol/Telegraph/blob/develop/pkg/listener/listener.wasm.go))
   picks up the event, fetches your binary, verifies the hash, and runs it
   through a two-stage gate (§5) before it's allowed to serve live traffic.
6. **Deregistering**: call `deregisterEntity(registrationId, ENTITY_WASM_AUTHOR)`
   — only the original registrant can do this for their own WASM record.

There is currently no way to attach your module to an *existing* intent —
`registerWasm` always mints a brand-new `intentId` tied to your submission.

## 4. The required interface

Defined by what [`wasm/runtime.New`](https://github.com/telegraphprotocol/Telegraph/blob/develop/pkg/wasm/runtime/runtime.go)
looks up on load. The module must export **linear memory** plus three
required functions:

| Export | Signature | Purpose |
|---|---|---|
| `alloc` | `(size: i32) -> i32` | Host asks the module for scratch space; returns a pointer. |
| `dealloc` | `(ptr: i32, size: i32)` | Host releases scratch space it previously got from `alloc`. |
| `rank_answer` | `(q_ptr, q_len, gt_ptr, gt_len, ma_ptr, ma_len: i32) -> f32` | Composite score in `[0, 1]`. The only scoring export the live path (`pkg/scoring/scorer.go`'s `ScoreOne`), Stage 1 validation, and Stage 2 evaluation actually call. |

`alloc`/`dealloc` aren't scoring logic — they're the memory handshake every
export needs, since a WASM function signature can only carry numbers, not
strings. The host writes each input string into memory your module handed
back from `alloc`, then calls the scoring function with a pointer/length
pair.

Everything else the runtime looks for is **optional** — `wasmrt.New` sets
these independently if present, and each has a graceful nil-check in its Go
wrapper method rather than failing module load:

| Export | Signature | What actually uses it |
|---|---|---|
| `breakdown_answer` | `(q_ptr, q_len, gt_ptr, gt_len, ma_ptr, ma_len: i32) -> i32` | Returns a pointer to 5 consecutive `f32`s: `[relevance, correctness, lexical, length_quality, composite]`. Called only by `Scorer.BreakdownOne`, an admin/debug introspection path — not currently wired to any HTTP handler, and never called by Stage 1 or Stage 2. Safe to omit; a module without it just can't serve that debug call. |
| `rank_answer_cached` | `(qVecPtr, gtVecPtr: i32, gt_ptr, gt_len, ma_ptr, ma_len: i32) -> f32` | Same as `rank_answer` but reuses precomputed 384-dim embeddings for `question`/`ground_truth` instead of re-embedding them. Used only inside Stage 2's replay batch (`candidate_eval.go`'s `scoreRows`) as a speed optimization — if absent, Stage 2 just calls `rank_answer` per row instead (`scoreRowsFlat`). No effect on pass/fail. |
| `embed` | `(ptr, len: i32) -> i32` | Returns a pointer to a 384-dim `f32` vector (MiniLM-L6-v2 sized). Needed together with `rank_answer_cached` for the cached path — the two are checked independently via `SupportsCachedRanking()`, so implement both or neither. |
| `cosine_sim` | `(aPtr, bPtr, dim: i32) -> f32` | Exposed on `Pool` but **not currently called anywhere in this codebase** — dead code path today, reserved for future use. |
| `bm25_score` | `(q_ptr, q_len, d_ptr, d_len: i32) -> f32` | Same as `cosine_sim` — exposed, not currently called anywhere. |

**Calling convention**: all strings cross the boundary as `(ptr: i32, len: i32)`
pairs into the module's own linear memory — the host calls your `alloc(size)`
first, writes the UTF-8 bytes at the returned pointer, then calls the scoring
function with that pointer/length. You own memory layout entirely; the host
never assumes anything about it beyond what `alloc`/`dealloc` give back.
`float32` returns use WASM's native `f32` result type (not encoded through
memory), except `breakdown_answer`, which returns a buffer *pointer* the host
reads 5 floats from directly via `ReadFloat32Le`.

**Limits enforced by the host** (`pkg/wasm/runtime`), not something your
module needs to check itself: individual text inputs capped at 128 KiB
(`MaxTextBytes`), vector inputs capped at 16,384 elements (`MaxVecDim`).
Returned scores are clamped to `[0, 1]` and NaN/Inf collapse to `0` before
your module's output is trusted.

## 5. Validation gates a candidate must clear

A registered module never goes live immediately — it passes through two
gates before it can serve real ranking traffic for its intent.

### Stage 1 — structural validation (immediate, per-registration)

Runs the moment the registration event is seen
([`pkg/listener/listener.wasm.validate.go`](https://github.com/telegraphprotocol/Telegraph/blob/develop/pkg/listener/listener.wasm.validate.go)).
Any failure is a hard reject:

1. Module loads in wazero and exports `rank_answer`, `alloc`, `dealloc`
   (enforced by `wasm/runtime.New` itself).
2. `rank_answer(q, gt, "")` — a genuinely empty answer — returns **exactly**
   `0`.
3. `rank_answer(q, gt, "   ")` — whitespace-only — also returns exactly `0`.
4. Self-match beats an unrelated cross-match:
   `rank_answer(q, gt, gt) > rank_answer(q, gt, unrelated_text)`.
5. No panic/trap on adversarial input — a ~54 KB repeated-text string and a
   Unicode string (emoji, accents, CJK) must both return without error.

### Stage 2 — historical replay comparison (before promotion)

Only candidates that passed Stage 1 reach this
([`pkg/scoring/candidate_eval.go`](https://github.com/telegraphprotocol/Telegraph/blob/develop/pkg/scoring/candidate_eval.go)). It
replays up to 1,000 recent real `(question, ground_truth, answer)` rows
through the candidate and checks, against the current default thresholds:

| Check | Bar |
|---|---|
| A — not degenerate | Score stdev across replayed rows > `0.05` |
| B — recognizes exact matches | Verbatim-correct answers score ≥ 75th percentile of the candidate's own distribution |
| C — sane relative ranking | Per-intent Spearman correlation vs. the incumbent's historical scores ≥ `0.6` (skipped for intents with <2 distinct miners) |
| D — self-match floor | `rank_answer(q, gt, gt)` ≥ `max(0.75, incumbent's own self-match score)` — a ratchet, never regresses |
| E — near-miss discrimination | Paraphrase-of-truth answer must outscore an off-topic answer by ≥ `max(0.15, incumbent's own margin)` per curated test case |

Passing all checks promotes the candidate to **Active** for its intent,
demoting whatever was previously Active for that same intent to
**Superseded** (one generation of rollback history is retained — if the new
champion is later deregistered, the node falls back to the superseded one
before falling all the way back to the default module). Failing marks the
candidate **Rejected**, with the failing reason persisted for that
registration; nothing happens on-chain (no slashing), and the bond stays
locked.

## 6. Minimal example module

A real, working minimal module already exists in this repo as the Stage-1
test double: [`pkg/wasm/test_wasm/src/lib.rs`](https://github.com/telegraphprotocol/Telegraph/blob/develop/pkg/wasm/test_wasm/src/lib.rs).
It implements the 3 required exports plus `breakdown_answer` (optional, but
implemented here for parity with the real module), using word-overlap
between the answer and ground truth as a crude-but-real correctness signal
(chosen specifically so it clears Stage 2 Check C's rank-correlation bar —
a pure hash/random score would fail that check even though it passes Stage
1).

Trimmed to the essentials — the same shape any new module needs:

```rust
#![no_std]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// ── alloc/dealloc: a bump allocator is enough — no real modules need to
// free anything mid-call, so `dealloc` can be a no-op. ────────────────────
const HEAP_SIZE: usize = 8 * 1024 * 1024;
static mut HEAP: [u8; HEAP_SIZE] = [0u8; HEAP_SIZE];
static mut HEAP_OFFSET: usize = 0;

#[no_mangle]
pub unsafe extern "C" fn alloc(size: i32) -> i32 {
    let size = size.max(0) as usize;
    let aligned = (HEAP_OFFSET + 3) & !3;
    if aligned + size > HEAP_SIZE {
        HEAP_OFFSET = 0; // wrap — fine for short-lived per-call strings
    } else {
        HEAP_OFFSET = aligned;
    }
    let ptr = HEAP.as_mut_ptr().add(HEAP_OFFSET);
    HEAP_OFFSET += size;
    ptr as i32
}

#[no_mangle]
pub unsafe extern "C" fn dealloc(_ptr: i32, _size: i32) {}

unsafe fn read_str<'a>(ptr: i32, len: i32) -> &'a str {
    let slice = core::slice::from_raw_parts(ptr as *const u8, len.max(0) as usize);
    core::str::from_utf8_unchecked(slice)
}

/// Fraction of `answer`'s words that also appear in `ground_truth`.
fn word_overlap(answer: &str, ground_truth: &str) -> f32 {
    let mut total = 0u32;
    let mut matched = 0u32;
    for word in answer.split_whitespace() {
        total += 1;
        if ground_truth.split_whitespace().any(|w| w.eq_ignore_ascii_case(word)) {
            matched += 1;
        }
    }
    if total == 0 { 0.0 } else { matched as f32 / total as f32 }
}

fn score(_question: &str, ground_truth: &str, miner_answer: &str) -> f32 {
    if miner_answer == ground_truth {
        return 0.999; // exact match always wins
    }
    0.35 + word_overlap(miner_answer, ground_truth) * 0.60 // [0.35, 0.95)
}

#[no_mangle]
pub unsafe extern "C" fn rank_answer(
    q_ptr: i32, q_len: i32, gt_ptr: i32, gt_len: i32, ma_ptr: i32, ma_len: i32,
) -> f32 {
    let question = read_str(q_ptr, q_len);
    let ground_truth = read_str(gt_ptr, gt_len);
    let miner_answer = read_str(ma_ptr, ma_len);
    if miner_answer.trim().is_empty() {
        return 0.0; // Stage 1 checks 2 & 3 require this
    }
    score(question, ground_truth, miner_answer)
}
```

`Cargo.toml` needs `crate-type = ["cdylib"]` and a release profile tuned for
size (see `pkg/wasm/test_wasm/Cargo.toml`); build with:

```bash
cargo build --release --target wasm32-unknown-unknown
```

This example clears **Stage 1** (empty/whitespace → 0, self-match beats
cross-match, no panics on adversarial input) but is deliberately too crude to
reliably clear every **Stage 2** check on real traffic — it has no real
semantic understanding, no `embed`/`cosine_sim`, and no length-quality
signal. Treat it as a template for the export surface and memory-passing
convention, not a scorer to register in production.

## Related docs

- [Build a Scoring Module](build-a-scoring-module.md) — the step-by-step
  version of this page, with a working example you can compile.
- [YAML Configuration](../miners/yaml-config.md) — how miners (not scorers)
  register and describe their API.
- [Registering as a Miner](../miners/miner-registration.md) — the miner
  registration flow this parallels; both go through the same facets and the
  same listener hot-load pattern.
- [Engine Inference](../using/engine-ask.md) — where ranked miners actually
  get used at request time.
