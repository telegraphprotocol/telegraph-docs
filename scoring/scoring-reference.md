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
computes a single composite quality score in `[0, 1]`, where `0` means "not
an answer at all" and `1` means "as good as the ground truth".

How that score is arrived at is entirely up to the module. The default one
blends semantic similarity against both the question and the ground truth
with a lexical overlap measure, but your module owes nothing to that design
— it just has to return a number in `[0, 1]` and clear the validation gates
in §5.

The formula lives entirely inside the WASM module — the node never
reimplements it, it only calls into it. That is what makes the scoring
replaceable: change the module and you change how answers are judged.

The node loads and drives modules with [wazero](https://wazero.io), a pure-Go
WASM runtime. Each module runs sandboxed with only linear memory and the
exported functions below; it cannot make network calls or touch the
filesystem.

## 2. How ranking works end to end

1. Every epoch, the node loads the active miners for each intent, fetches
   that intent's ground truth, and asks every miner the question
   concurrently.
2. Each `(question, ground_truth, miner_answer)` triple is scored by calling
   the WASM module's `rank_answer`. Several module instances run in a pool so
   concurrent scoring doesn't serialise on one instance. `rank_answer` is the
   only scoring export the live path calls.
3. Results are sorted best to worst into a per-intent leaderboard.
4. The request router reads the top N from that leaderboard to pick which
   miner serves a live `/engine/v1/ask` request.
5. **Scoring is per-intent, not global.** Each intent can have its own
   promoted module; an intent with no promoted module falls back to the
   default one.

## 3. How to register your own scoring module

Registration is **on-chain and permissionless** — not a config file, not an
admin API, and no approval from anyone.

**There is no bond and no fee.** Registering costs you nothing beyond gas.
An earlier design pulled a 10,000 MACHINA anti-spam bond; it was removed
because it had no release path, so every bond posted would have been locked
permanently. Any doc, article or contract constant suggesting otherwise is
out of date.

1. **Write the module** so it exports the required functions (§4) and
   compiles to a freestanding `wasm32-unknown-unknown` binary. Any toolchain
   producing the same export surface plus linear memory works — Rust is the
   easiest, but nothing requires it.
2. **Host the compiled `.wasm` file** somewhere fetchable by URL (IPFS, S3,
   any host the node can reach) and compute its `keccak256` hash. This must
   be Ethereum's Keccak-256, which differs from the standardised NIST
   SHA3-256 despite the similar name — a SHA3 hash will fail verification.
   Most Ethereum libraries expose it directly (`ethers.keccak256`,
   `web3.utils.keccak256`, go-ethereum's `crypto.Keccak256`). Hash the file
   bytes, not a hex string of them.
3. **Call `registerWasm(wasmHash, wasmUrl, whitelistedUrls)`** on the
   protocol's `IntentRegistryFacet`. This mints a fresh `intentId` for you
   and emits an `IntentRegistered` event.
4. From here it's automatic. The node picks up the event, fetches your
   binary, verifies the hash, and runs it through a two-stage gate (§5)
   before it can serve live traffic.
5. **Deregistering**: call `deregisterEntity(registrationId, ENTITY_WASM_AUTHOR)`
   — only the original registrant can do this for their own record.

There is currently no way to attach your module to an *existing* intent —
`registerWasm` always mints a brand-new `intentId` tied to your submission.

## 4. The required interface

Defined by what the node looks up when it loads your module. The module must export **linear memory** plus three
required functions:

| Export | Signature | Purpose |
|---|---|---|
| `alloc` | `(size: i32) -> i32` | Host asks the module for scratch space; returns a pointer. |
| `dealloc` | `(ptr: i32, size: i32)` | Host releases scratch space it previously got from `alloc`. |
| `rank_answer` | `(q_ptr, q_len, gt_ptr, gt_len, ma_ptr, ma_len: i32) -> f32` | Composite score in `[0, 1]`. The only scoring export the live path, Stage 1 validation and Stage 2 evaluation actually call. |

`alloc`/`dealloc` aren't scoring logic — they're the memory handshake every
export needs, since a WASM function signature can only carry numbers, not
strings. The host writes each input string into memory your module handed
back from `alloc`, then calls the scoring function with a pointer/length
pair.

Everything else is **optional**. The node checks for each independently and
degrades gracefully if it's absent — a missing optional export never fails
module load, so you can ignore this table entirely on a first module.

| Export | Signature | What it's for |
|---|---|---|
| `breakdown_answer` | `(q_ptr, q_len, gt_ptr, gt_len, ma_ptr, ma_len: i32) -> i32` | Returns a pointer to 5 consecutive `f32`s: `[relevance, correctness, lexical, length_quality, composite]`. Used only for debug introspection, never by the validation gates. Safe to omit. |
| `rank_answer_cached` | `(qVecPtr, gtVecPtr: i32, gt_ptr, gt_len, ma_ptr, ma_len: i32) -> f32` | Same as `rank_answer` but reuses precomputed 384-dim embeddings for the question and ground truth instead of re-embedding them. A speed optimisation for Stage 2 replay only; if absent, Stage 2 calls `rank_answer` per row. No effect on whether you pass. |
| `embed` | `(ptr, len: i32) -> i32` | Returns a pointer to a 384-dim `f32` vector. Needed together with `rank_answer_cached` — the two are checked independently, so implement both or neither. |

**Calling convention**: all strings cross the boundary as `(ptr: i32, len: i32)`
pairs into the module's own linear memory — the host calls your `alloc(size)`
first, writes the UTF-8 bytes at the returned pointer, then calls the scoring
function with that pointer/length. You own memory layout entirely; the host
never assumes anything about it beyond what `alloc`/`dealloc` give back.
`float32` returns use WASM's native `f32` result type (not encoded through
memory), except `breakdown_answer`, which returns a buffer *pointer* the host
reads 5 floats from directly via `ReadFloat32Le`.

**Limits enforced by the host**, not something your
module needs to check itself: individual text inputs capped at 128 KiB
(`MaxTextBytes`), vector inputs capped at 16,384 elements (`MaxVecDim`).
Returned scores are clamped to `[0, 1]` and NaN/Inf collapse to `0` before
your module's output is trusted.

## 5. Validation gates a candidate must clear

A registered module never goes live immediately — it passes through two
gates before it can serve real ranking traffic for its intent.

### Stage 1 — structural validation (immediate, per-registration)

Runs the moment the registration event is seen.
Any failure is a hard reject:

1. The module loads and exports `rank_answer`, `alloc` and `dealloc`.
2. `rank_answer(q, gt, "")` — a genuinely empty answer — returns **exactly**
   `0`.
3. `rank_answer(q, gt, "   ")` — whitespace-only — also returns exactly `0`.
4. Self-match beats an unrelated cross-match:
   `rank_answer(q, gt, gt) > rank_answer(q, gt, unrelated_text)`.
5. No panic or trap on adversarial input — a very large repeated-text string
   and a Unicode string (emoji, accents, CJK) must both return without error.

These are the requirements you can check yourself before registering; the
test harness in [Build a Scoring Module](build-a-scoring-module.md) covers
every one of them.

### Stage 2 — comparison against the incumbent (before promotion)

Only candidates that pass Stage 1 reach this stage. The node replays a batch
of recent real `(question, ground_truth, answer)` records through your module
and compares its behaviour against the module currently serving that intent.

Broadly, a candidate has to show that it discriminates — that it spreads
scores rather than returning something near-constant, that it recognises a
correct answer as correct, that it prefers a close paraphrase over an
off-topic answer, and that it doesn't rank miners in a way that contradicts
the incumbent without cause.

**The exact checks and thresholds are deliberately not published.** A scoring
module that is tuned to clear a published bar is not the same thing as a
scoring module that ranks well, and the historical records used in the replay
are publicly readable. Build a module that genuinely judges answer quality
and it will pass; build one that targets a number and you are optimising
against a moving, unpublished target.

Passing promotes the candidate to **Active** for its intent, demoting the
previous Active module to **Superseded**. One generation of rollback history
is kept — if the new module is later deregistered, the node falls back to the
superseded one before falling all the way back to the default. Failing marks
the candidate **Rejected** and records the reason. Nothing happens on-chain
either way: there is no slashing and nothing to lose beyond the gas you spent
registering.

## 6. Minimal example module

A real, working minimal module already exists in this repo as the Stage-1
test double.
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
size; build with:

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
