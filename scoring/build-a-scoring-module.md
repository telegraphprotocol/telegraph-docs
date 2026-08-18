---
description: Write, test and register your own WASM module that scores how good a miner's answer is. Start here — no prior Telegraph knowledge needed.
---

# Build a Scoring Module

This guide is for anyone who wants to build their own **scoring module** for
Telegraph — the piece of code that judges how good a miner's answer is and
decides its ranking. If you're building a *miner* (something that answers
questions), see the [YAML Configuration](../miners/yaml-config.md) guide
instead: this page is about the judge, not the contestant.

## What is a scoring module?

When someone asks the network a question, several miners may answer it. The
network needs a way to decide which answer was best. That job is done by a
small program compiled to **WebAssembly (WASM)**, a compact, sandboxed
binary format that runs safely inside the node without needing to trust your
code.

Your module gets three pieces of text (the question, the correct/expected
answer, and a miner's answer) and returns a score. Higher score means a
better answer.

- **`question`** — the question we're trying to solve.
- **`ground_truth`** — the correct answer to that question.
- **`miner_answer`** — what this particular miner responded.

If `miner_answer` matches `ground_truth`, your module should score it high.
If it doesn't, score it low.

## What environment does it run in?

Your module runs inside a lightweight WASM sandbox built into the node
itself, not a separate VM or Docker container, just an in-process sandbox.
That means:

- **No network access.** Your code can't make HTTP calls, open sockets, or
  reach the internet.
- **No filesystem access.** No reading/writing files, no environment
  variables.
- **No shared state.** Every call gets fresh memory, so you can't cache
  things across requests or communicate with other running modules.
- It only gets the plain text you're given (question, correct answer, miner's
  answer) and must work with that alone.

This is by design: it keeps scoring fast, deterministic, and safe to run
untrusted, third-party code.

## What language can I write it in?

Anything that compiles to a standalone WASM binary works. In practice, the
easiest options are:

- **Rust** (recommended: what the reference examples use, small output size, good WASM tooling)
- **C / C++** (via Clang's WASM target)
- **TinyGo** (regular Go's WASM output tends to be large, TinyGo is a better fit here)
- **AssemblyScript** (TypeScript-like syntax, compiles straight to WASM)

Whatever you use, the compiled output must be a single `.wasm` file that
doesn't depend on anything outside itself (no dynamic imports of OS
functions, no threads).

## Size limit

Your compiled `.wasm` file must be **32 MB or smaller**. In practice a good
scoring module should be nowhere near that.

## What your module must contain

Your module needs to expose ("export") three functions so the node knows
how to call it:

| Function | What it's for |
|---|---|
| `alloc` | Gives the node a chunk of memory inside your module to write text into. |
| `dealloc` | Lets the node tell your module "you can reuse that memory now." |
| `rank_answer` | The scoring function: takes the question, correct answer, and miner's answer, and returns a single score. |

That's the whole interface. `alloc`/`dealloc` aren't scoring logic, they're
just how text gets handed into your module (a WASM function can only pass
numbers, not strings, so the node needs your module's help placing the text
in memory first). `rank_answer` is the only function that actually decides
your module's behavior.

**How data gets passed in:** text is passed as raw bytes into memory your
module allocated (via your own `alloc`), along with a pointer and a length.
Your `rank_answer` function reads that memory and returns a floating-point
number between `0` and `1`, where `0` means "not a match at all" and `1`
means "perfect answer." An empty or blank miner answer should always score
`0`.

### Understanding `rank_answer`'s parameters

`rank_answer` receives **six numbers**, not three strings, because WASM can
only pass numbers across the boundary. Each of the three text inputs arrives
as a **pointer + length** pair: the pointer says *where* in your module's
memory the text starts, and the length says *how many bytes* it is. They
always come in this exact order:

| Parameters | What it is |
|---|---|
| `q_ptr`, `q_len` | The **question** — where it starts, how many bytes long. |
| `gt_ptr`, `gt_len` | The **ground truth** (the correct answer). |
| `ma_ptr`, `ma_len` | The **miner's answer** — the text you're actually scoring. |

To use one, read `len` bytes of memory starting at `ptr` and interpret them
as UTF-8 (see `read_str` in the example below), which turns the raw
`(ptr, len)` pair back into a normal string you can work with.

Two things to keep in mind:

- **The order never changes.** Read them as `question`, then `ground_truth`,
  then `miner_answer`. Reading them in the wrong order (or with the wrong
  length) is the single most common bug: if your `miner_answer` comes out
  empty because of it, your scorer returns `0` for everything and fails
  registration.
- **You don't have to use all three.** Scoring quality mostly comes from
  comparing `miner_answer` against `ground_truth`; the `question` is there if
  you want it (the simple example below ignores it). Whatever you compute, you
  return a single `f32` between `0` and `1`.

## A simple starting example (Rust)

The full, buildable project below lives in
[telegraph-examples/wasm-scoring-module](https://github.com/telegraphprotocol/telegraph-examples/tree/master/wasm-scoring-module) —
clone it, `cd wasm-scoring-module/rust-module`, and run
`cargo build --release --target wasm32-unknown-unknown` to get a working
`.wasm` immediately. It scores based on how many words a miner's answer
shares with the correct answer: simple, but a legitimate starting point you
can build on. Here's what each piece does.

**No standard library.** The module can't link against Rust's standard
library, there's no OS underneath it to provide one, so it opts out with
`#![no_std]`. That means panics have no default handler either: one has to
be supplied explicitly, and since there's nowhere to unwind to, it just
traps.

```rust
#![no_std]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}
```

**Memory: a bump allocator.** WASM functions can only pass numbers, not
strings, so the node needs somewhere in your module's own memory to write
the question/answer text before calling you. `alloc` hands out slices of a
fixed 1 MB static buffer by just moving an offset forward; `dealloc` is a
no-op because nothing here needs to free anything mid-call, every call gets
fresh memory anyway.

```rust
const HEAP_SIZE: usize = 1 * 1024 * 1024;
static mut HEAP: [u8; HEAP_SIZE] = [0u8; HEAP_SIZE];
static mut HEAP_OFFSET: usize = 0;

#[unsafe(no_mangle)]
pub unsafe extern "C" fn alloc(size: i32) -> i32 {
    let size = size.max(0) as usize;
    unsafe {
        let aligned = (HEAP_OFFSET + 3) & !3;
        if aligned + size > HEAP_SIZE {
            HEAP_OFFSET = 0;
        } else {
            HEAP_OFFSET = aligned;
        }
        let ptr = core::ptr::addr_of_mut!(HEAP).cast::<u8>().add(HEAP_OFFSET);
        HEAP_OFFSET += size;
        ptr as i32
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn dealloc(_ptr: i32, _size: i32) {}
```

**Reading the input back out.** The host writes UTF-8 bytes at the pointer
your `alloc` returned; this turns a raw `(ptr, len)` pair back into a Rust
`&str` so the rest of the module can work with normal string operations.

```rust
unsafe fn read_str<'a>(ptr: i32, len: i32) -> &'a str {
    unsafe {
        let slice = core::slice::from_raw_parts(ptr as *const u8, len.max(0) as usize);
        core::str::from_utf8_unchecked(slice)
    }
}
```

**The actual scoring logic.** `word_overlap` counts what fraction of the
miner's answer's words also appear in the ground truth, case-insensitively.
`score` short-circuits to a perfect `1.0` for a verbatim match, otherwise
falls back to that overlap fraction.

```rust
fn word_overlap(answer: &str, ground_truth: &str) -> f32 {
    let mut total = 0u32;
    let mut matched = 0u32;
    for word in answer.split_whitespace() {
        total += 1;
        if ground_truth
            .split_whitespace()
            .any(|w| w.eq_ignore_ascii_case(word))
        {
            matched += 1;
        }
    }
    if total == 0 {
        0.0
    } else {
        matched as f32 / total as f32
    }
}

fn score(ground_truth: &str, miner_answer: &str) -> f32 {
    if miner_answer == ground_truth {
        return 1.0;
    }
    word_overlap(miner_answer, ground_truth)
}
```

**The required export.** This is the only function the node actually calls.
It reads the ground truth and miner answer out of memory, rejects a blank
answer outright (per the required interface above), and otherwise defers to
`score`. Note the question (`_q_ptr`/`_q_len`) is received but unused here,
this simple example doesn't need it, but the node always passes it.

```rust
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rank_answer(
    _q_ptr: i32,
    _q_len: i32,
    gt_ptr: i32,
    gt_len: i32,
    ma_ptr: i32,
    ma_len: i32,
) -> f32 {
    unsafe {
        let ground_truth = read_str(gt_ptr, gt_len);
        let miner_answer = read_str(ma_ptr, ma_len);
        if miner_answer.trim().is_empty() {
            return 0.0;
        }
        score(ground_truth, miner_answer)
    }
}
```

Add this in cargo.toml
```
[lib]
crate-type = ["cdylib"]
```

Build it with:

```bash
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
```

**Make sure you upload the `wasm32-unknown-unknown` build.**

If you have multiple WASM targets installed, Cargo can produce files with the same
filename for different targets. Telegraph scoring modules must use the
**`wasm32-unknown-unknown`** target.

Do **not** upload a `wasm32-wasip1` build. WASI builds contain imports for
operating-system functionality such as `fd_write`, `environ_get`,
`environ_sizes_get`, and `proc_exit`. Telegraph scoring modules run without WASI
or OS access, so a WASI module will fail to instantiate during registration.

Build the module with:

```bash
cargo build --release --target wasm32-unknown-unknown
```

The resulting file will be at:

```text
target/wasm32-unknown-unknown/release/<your_module>.wasm
```

Before registering, verify that the file has **no imports**:

```bash
wasm-tools print target/wasm32-unknown-unknown/release/<your_module>.wasm | grep -c '(import'
```

This should print:

```text
0
```

If it prints a value greater than `0`, inspect the module before registering it.
In particular, make sure you did not accidentally upload the similarly named file
from:

```text
target/wasm32-wasip1/release/
```

A WASM module with WASI imports is not a valid Telegraph scoring module and may
result in an instantiation error such as `module[env] not instantiated`.

That gives you a working `.wasm` file you can test (see the section below)
and then register. From there, the best way to do well is to make the
scoring logic smarter: real semantic understanding will always beat simple
word-matching.

## Testing your module before you register

Don't wait until you've registered on-chain to find out if your module
works. You don't need any of Telegraph's own code for this, just
[wazero](https://wazero.io), the same open-source WASM runtime library the
node itself uses under the hood, which anyone can pull in independently.

A ready-to-run CLI that does exactly this — loads your `.wasm` file the same
way the node does (writing your question/ground-truth/answer strings into
its memory via `alloc`, then calling `rank_answer`) and prints back the
score — lives alongside the example module at
[telegraph-examples/wasm-scoring-module/go-tester](https://github.com/telegraphprotocol/telegraph-examples/tree/master/wasm-scoring-module/go-tester).
Clone the repo, then:

```bash
cd wasm-scoring-module/go-tester
go run . my_module.wasm \
  "What is the capital of France?" \
  "Paris is the capital of France." \
  "The capital of France is Paris."
```

It prints the score your module gave that answer. Try it with a few kinds of
input before you register anything on-chain:

- The exact correct answer (should score very high, close to `1`).
- A clearly wrong or unrelated answer (should score low, close to `0`).
- An empty string as the answer (must score exactly `0`).
- A reworded version of the correct answer that says the same thing
  differently (a good scorer should still recognize this as correct).
- A couple of answers of different quality for the same question, to check
  that better answers actually score higher than worse ones.

If your module loads without errors and behaves sensibly across cases like
these, you're in good shape to register it.

## What checks your module must pass

Registering on-chain is only the first step. Before your module is allowed to
score real traffic, the node runs it through a set of automatic checks. If it
fails any of them, it's rejected and won't serve traffic (the rejection reason
is recorded, so you can see exactly what went wrong). There are two stages,
and you have to clear both.

### Stage 1: structural checks

These make sure your module is well-formed and behaves sanely. Each is a
requirement your module has to meet, how you meet it is up to you:

1. **It loads and exports the required functions.** Your `.wasm` must expose
   `rank_answer` (with the six parameters described
   [above](#understanding-rank_answers-parameters)), `alloc`, and `dealloc`,
   and load in the sandbox.
2. **An empty or blank answer scores exactly `0`.** Whether the miner's answer
   is empty or only whitespace, `rank_answer` has to return `0`.
3. **A correct answer scores higher than an unrelated one.** For the same
   question, a known-correct answer must score strictly above a known-unrelated
   answer. The rejection `self-match (0.0000) did not beat unrelated
   cross-match (0.0000)` means your module failed this one, it returned the
   same score for both.
4. **Awkward input doesn't crash it.** Your module will be given very long
   answers (tens of KB) and text full of emoji and non-English characters, and
   it has to handle both without crashing or trapping.

### Stage 2: it has to beat the current champion

Passing Stage 1 only proves your module isn't *broken*, not that it's *good*.
Each intent has exactly one active "champion" scoring module at a time, and to
go live your module has to be at least as good as that champion at telling good
answers from bad ones.

To decide, the node uses a built-in **benchmark set**: a fixed set of
questions, each with a known-**good** answer and a known-**bad** answer. It
scores both your module and the current champion on that same benchmark and
compares them head to head.

Your module is promoted only if it clears all of these:

1. **It recognizes a perfect answer.** For every benchmark question, scoring the
   correct answer against itself (`rank_answer(question, ground_truth,
   ground_truth)`) must be at least **0.75**. A good scorer rates a perfect
   answer near `1.0`.
2. **Its scores actually vary.** Across the benchmark your scores must have real
   spread. A module that returns the same number for everything can't tell
   answers apart, and is rejected.
3. **It separates good from bad at least as well as the champion.** On the
   benchmark questions both modules were scored on, your module must order the
   good answer above the bad one on **at least as many questions** as the
   champion, separate good from bad by **at least as large an average margin** as
   the champion, and clear an absolute margin floor. You don't have to be perfect
   on every question, but you can't lose to the champion on either count.

If the intent has enough real traffic (several miners with scoring history), the
node also checks that your module's ranking of those real answers broadly agrees
with the champion's.

#### The numbers you'll see

Whether your module is promoted or rejected, the node records a **score** and a
**breakdown** on your registration (queryable via the API), and the rejection
reason spells out exactly which bar you missed. The breakdown fields:

| Field | What it means |
|---|---|
| `candidate_margin` | Your module's average "good-answer score minus bad-answer score" across the benchmark. This is your headline **score**: how clearly you separate good from bad. Higher is better. |
| `champion_margin` | The same number for the current champion. You must match or beat it. |
| `candidate_wins` | How many benchmark questions your module scored the good answer above the bad one. |
| `champion_wins` | The same, for the champion. You must win on at least as many. |
| `comparable_cases` | How many benchmark questions both modules were scored on (the denominator for the wins and margins above). |
| `worst_self_match` | The lowest score your module gave a perfect answer anywhere in the benchmark. Must be at least `0.75`. |
| `score_stddev` | How much your scores varied across the benchmark. Must be above a small floor (the "your scores actually vary" check). |
| `historical_rows_evaluated` | How many real past answers the extra traffic check looked at (`0` when there wasn't enough traffic to run it). |

For example, a promoted module might record a `candidate_margin` of `0.37`
against a `champion_margin` of `0.05`, winning `32/32` benchmark questions to the
champion's `19/32`: it separates good answers from bad ones far more sharply
than the champion it replaced.

So there are two bars: pass the structural checks (Stage 1), then match or beat
the incumbent on the benchmark (Stage 2). A module can be perfectly valid and
still not go live, simply because a better one already holds that intent.

## How to submit / register your module

1. Build your `.wasm` file and put it somewhere it can be downloaded from a
   URL (e.g. IPFS or any file host).
2. You can submit your `.wasm` file via `https://integrate.telegraphprotocol.com/`

Registering costs nothing but gas — there is no bond or fee. Still worth
testing carefully first (see the section above): a module that fails the
validation gates doesn't serve traffic, and every re-registration is another
transaction.

## Removing or replacing your module

Registering isn't permanent. You can take a module down, swap in a better one,
or put an old one back — this section covers all three.

### Taking a module down

To deregister a module, the address that registered it calls one function on
the Diamond:

```solidity
deregisterEntity(registrationId, 2)
```

- **`registrationId`** — the ID you got when you registered that module.
- **`2`** — tells the contract this is a scoring module (as opposed to a miner
  or a collector).

Only the original registering address can do this, so no one else can take your
module down. The change is picked up **immediately** — there's no bond, no fee,
and nothing to wait for (you don't need to wait for an epoch to roll over).

The Diamond's address is on the
[Addresses & Parameters](../protocol/addresses-and-params.md) page, and can
always be read straight from the chain.

### What actually happens when you deregister

Once the network sees the deregistration:

- **Your module is marked `deregistered`.** That's a final state — a
  deregistered module won't start scoring again on its own. (You can register
  it again from scratch, though — see below.)
- **If your module was the live champion for its intent, scoring doesn't stop.**
  The network automatically falls back to the *previous* champion for that
  intent — the module yours had replaced — and if there isn't one, to
  Telegraph's built-in default scorer. That intent keeps getting scored either
  way; there's never a gap.
- **If your module wasn't the current champion** (it was still pending, was
  rejected, or had already been beaten by a newer one), deregistering it just
  marks it inactive. Nothing that's live changes.

So deregistering is safe: the worst case for the network is that an intent
quietly reverts to whatever was scoring it before you.

### Replacing a module

You usually **don't** need to deregister to upgrade. Just register the new
module — if it beats the current champion (see
[What checks your module must pass](#what-checks-your-module-must-pass)), it
takes over the intent automatically. Deregistering the old one afterwards is
optional tidy-up, not a required step.

### Putting the same module back

Deregistering is not a one-way door. After you deregister a module, you can
register the **exact same binary** again later — the slot it used is freed up
when you deregister. Every registration, whether it's a brand-new module or one
you're bringing back, gets its own fresh registration ID.

### What it costs

Nothing but gas, in every direction. There's no bond and no fee to register or
to deregister, so there's also nothing to refund — taking a module down simply
removes it from service.

## Tips for building a good scorer

- Reward answers that are actually **semantically correct**, not just ones
  that repeat words from the question.
- An answer that exactly matches the correct answer should score very high.
- A completely empty or nonsense answer should score at, or very near, zero.
- Your scores should behave *consistently*: similar quality answers should
  get similar scores, and better answers should reliably score higher than
  worse ones. Wildly inconsistent or random scoring is easy to spot and
  won't hold up well.

Good luck!
