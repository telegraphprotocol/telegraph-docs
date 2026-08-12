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

## A simple starting example (Rust)

The full, buildable project below lives in
[telegraph-examples/wasm-scoring-module](https://github.com/telegraphprotocol/telegraph-examples/tree/main/wasm-scoring-module) —
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
[telegraph-examples/wasm-scoring-module/go-tester](https://github.com/telegraphprotocol/telegraph-examples/tree/main/wasm-scoring-module/go-tester).
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

## How to submit / register your module

1. Build your `.wasm` file and put it somewhere it can be downloaded from a
   URL (e.g. IPFS or any file host).
2. You can submit your `.wasm` file via `https://integrate.telegraphprotocol.com/`

Registering costs nothing but gas — there is no bond or fee. Still worth
testing carefully first (see the section above): a module that fails the
validation gates doesn't serve traffic, and every re-registration is another
transaction.

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
