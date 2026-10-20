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

Every intent has a **class**, and the class decides which kind of module scores
it (see [How answers are scored](../using/intents.md#how-answers-are-scored)):

| Intent class | Module you register | What it does |
|---|---|---|
| Deterministic | **Comparator module** | Compares the value read from a miner's answer with the epoch's reference value (the median of up to 3 truth sources from the [evaluation pool](contribute-evaluation-data.md#truth-sources-deterministic-intents)), using the intent's comparison rule and tolerance. |
| Judgment | **Wide adapter package** | A reward model judges each answer on its own merits. No reference answer is needed. |
| Hybrid | **Wide adapter package**, hybrid build | A comparator score for the checkable part, combined with the model's judgment of the rest. |

Each intent has one live module at a time, its **canonical** module. A judgment
or hybrid intent with no module of its own can use its family's (see
[Families](#families-one-module-for-many-intents)). An intent that nothing
serves is not scored, and its miners keep their previous ranking.

> **`rank_answer` modules are retired.** Earlier versions of this guide
> described a module exporting `rank_answer`, `alloc` and `dealloc` that
> compared a miner's answer with a reference answer. The node no longer runs
> that kind of module. A new registration of one is rejected straight away with
> `MiniLM rank_answer scoring modules are retired and are no longer accepted: …`.
> Build one of the two kinds below instead.

## What environment does it run in?

Your module runs inside a lightweight WASM sandbox built into the node
itself, not a separate VM or Docker container, just an in-process sandbox.
That means:

- **No network access.** Your code can't make HTTP calls, open sockets, or
  reach the internet.
- **No filesystem access.** No reading/writing files, no environment
  variables.
- **No state you can rely on.** The node may reuse one loaded copy of your
  module for many calls, or load a fresh copy for each batch. The same input
  must always give the same output.
- It only gets the inputs it's given and must work with those alone.

This is by design: it keeps scoring fast, deterministic, and safe to run
untrusted, third-party code.

## Comparator modules (deterministic intents)

A deterministic intent has one right answer: a price, a count, a yes or no. Each
epoch the node builds a reference value from the intent's truth sources in the
evaluation pool (public APIs that contributors upload, see
[Truth sources](contribute-evaluation-data.md#truth-sources-deterministic-intents)),
reads the value out of each miner's answer, and asks the comparator module how
close they are. Your module only sees the two numbers; it never calls anything.

A comparator has no model, so there is no "better" comparator to build. What
the node checks is that yours computes the network's **reference rule**
exactly (see [Stage 2 for comparator modules](#stage-2-for-comparator-modules-correctness)).

### What it must export

| Export | Signature | What it's for |
|---|---|---|
| `imw_score_deterministic` | `(truth: i64, miner: i64, spec_ptr: i32) -> i64` | Scores one miner value against the true value. |
| `imw_alloc` | `(size: i32) -> i32` | Gives the node memory inside your module to write the comparison spec into. |
| `imw_free` | `(ptr: i32, size: i32)` | Lets the node tell your module it can reuse that memory. |

How a call works:

- **`truth` comes first, then `miner`.** Both are integers on the same
  fixed-point scale; the node scales them before calling you. The order is easy
  to get backwards, and the gate will catch it.
- **`spec_ptr`** points to 16 bytes the node wrote into memory from your
  `imw_alloc`: two little-endian `i64` values, the comparison code and then the
  tolerance.
- **Return** a score in basis points, from `0` to `10000` (`10000` is a perfect
  match). A negative return means your module refuses the input; the node treats
  it as an error, not as a score. Anything above `10000` is also an error.
- The node never passes a `truth` of `0`.

### The reference rule

| Code | Name | Score |
|---|---|---|
| `0` | Exact | `10000` if `miner == truth`, else `0`. Tolerance is ignored. |
| `1` | AbsTol | The error is `|miner − truth|`. |
| `2` | RelTol | The error is `|miner − truth| × 10000 / max(|truth|, 1)`, in basis points, truncated toward zero. |
| `3` | PassFail | Same as Exact. |

For AbsTol and RelTol the score falls linearly with the error: `10000` at an
error of `0`, then `10000 × (2 × tolerance − error) / (2 × tolerance)` (integer
division), down to `0` once the error reaches `2 × tolerance`. A tolerance of
`0` or less means only an exact match scores.

Details that matter:

- The code is read as a 32-bit integer, and an unknown code is treated as Exact.
- Multiplications saturate rather than wrap.
- Compute the RelTol product in 128 bits. With values at wei scale (`1e18`),
  `difference × 10000` overflows 64 bits.

### Size and build

Your compiled `.wasm` file must be **32 MB or smaller**; a comparator is
usually tens of KB. Anything that compiles to a standalone WASM binary works.
Rust is the easiest (`#![no_std]`, `crate-type = ["cdylib"]`), and C/C++,
TinyGo and AssemblyScript also work.

**Build for `wasm32-unknown-unknown`, not WASI.** The module runs with no
operating-system imports, so a `wasm32-wasip1` build (which imports functions
like `fd_write` or `proc_exit`) fails to load at registration. Check the build
has no imports before you register:

```bash
wasm-tools print target/wasm32-unknown-unknown/release/<your_module>.wasm | grep -c '(import'
# 0
```

If you have several targets installed, make sure you upload the file from
`target/wasm32-unknown-unknown/release/`, not the similarly named file under
`target/wasm32-wasip1/release/`.

### Testing it before you register

Before you register, run your module against the reference rule above on
inputs like these:

- every code, at several tolerances, including `0`;
- truths from `1` up to `1e18`, and negative values;
- miner values at an exact match, one unit off, at the half-score point, at the
  edge of the `2 × tolerance` window, and past it, on both sides of the truth.

Every result must match the rule within ±10 basis points, and a second run must
give exactly the same results.

## Wide adapter packages (judgment and hybrid intents)

A wide adapter is a reward model that runs in the node's fixed-point (Q32.32)
interpreter. It judges a miner's answer to a question and returns a score; a
better answer should get a higher score. You register it as **one
self-contained `.wasm` file** that carries both the interpreter and the model,
so the hash you register covers both.

Answers reach your model as tokens from the network's pinned ModernBERT
tokenizer, so build the model for that vocabulary.

The tools to train one and package it into that file are in the adapter kit,
[telegraph-wasm-baseline](https://github.com/telegraphprotocol/telegraph-wasm-baseline).
[Train a Scoring Adapter](train-a-scoring-adapter.md) walks through them step by
step, and lists the exact input format, arithmetic and export signatures the
node expects. This section lists what the node checks when a package arrives.

### What the node checks

| Requirement | Detail |
|---|---|
| Exports | `imwq_embedded`, `imwq_embed_desc_addr`, `imwq_score`, `imwq_debug_counts`, `imwq_alloc` and `imwq_free`. A hybrid package also exports `imwq_score_hybrid`. A package must **not** export `imw_score_deterministic`. |
| Class | Read from the exports: with `imwq_score_hybrid` it is a hybrid package, without it a judgment package. It must match the class of the intent you register for, or it is rejected. |
| Memory | One memory, with an initial size of at most 65,536 pages (4 GiB). |
| Embedded model | The last data segment holds the model image (it starts with the bytes `IMWQ`) and fits inside the initial memory. |
| Size | Just under 4 GB at most, and the node must be able to download it within 30 minutes (node defaults). A typical package is about 1.2 GB. |

The node recognises a wide package from its export section, which it reads from
the first MiB of the download. A file it doesn't recognise as wide is held to
the 32 MB limit instead.

When the package reaches [Stage 2](#stage-2-for-wide-adapters-competition-on-the-hidden-evaluation-pool),
the node loads it, checks that the embedded model matches the checksum the
package carries for it, and checks the model parses.

### The `telegraph.adapter` section

A package (or a comparator module) can carry a WASM custom section named
`telegraph.adapter`, holding JSON that says which scoring version it was built
for. It is inside the module, so the registered hash covers it.

```json
{
  "abi_version": 1,
  "class": "judgment",
  "tool": "my-builder 0.3",
  "training": {
    "family": "CODE_REVIEW",
    "children": [
      { "intent": "CODE_REVIEW", "pairs": 4000, "accuracy": 0.81, "spearman": 0.62, "held_out": false },
      { "intent": "CODE_REVIEW_PYTHON", "pairs": 1200, "accuracy": 0.77, "spearman": 0.55, "held_out": true }
    ]
  }
}
```

| Field | Required | Meaning |
|---|---|---|
| `abi_version` | Yes, when the section is present | The scoring version the module was built for. The node runs version `1`; any other value is rejected. |
| `class` | No | `judgment`, `hybrid` or `comparator`. If set, it must agree with what the exports say. |
| `tool` | No | The builder that wrote the section. Informational. |
| `training` | No | A self-reported record of what the adapter was trained on. |

`training` fields: `family` (required), `children` (at least one), and
optionally `trainer`, `backbone` and `backbone_version`. Each child has
`intent`, `pairs`, `accuracy`, `spearman`, `held_out` and an optional
`dataset_version`.

The node checks the training record's shape only: `family` is set, `children` is
not empty, every child is the family itself or a `_`-child of it, no child is
listed twice, `pairs` is not negative, `accuracy` is between 0 and 1, and
`spearman` is between −1 and 1. It never uses the numbers to decide anything;
the hidden evaluation is the real test.

A module without the section is accepted. A section that is present but wrong is
rejected with `adapter metadata: …` (or `adapter metadata: training record: …`).

## Families: one module for many intents

Some intents are very specific, like `WEATHER_FORECAST_LAHORE` and
`WEATHER_FORECAST_TOKYO`, so that miners answer exactly the same question. For
judgment and hybrid intents, one module registered on a **family** intent
serves every **child** whose name extends it with `_`.

- **Longest prefix wins.** `WEATHER_FORECAST_LAHORE` uses the module on
  `WEATHER_FORECAST` before the one on `WEATHER`. A child with its own live
  module uses its own.
- **The `_` is part of the rule.** `WEATHERX` is not a child of `WEATHER`.
- **Same class only.** A judgment family never serves a hybrid child, or the
  other way round.
- **Deterministic intents have no families.** A comparator serves exactly the
  intent it is registered for.
- **Only the module is shared.** Each child keeps its own miners, ranking and
  evaluation data.

**Register on the family, not on a child.** A registration on a child is
rejected when a family above it already has a live module of the same class:

```
served by family WEATHER_FORECAST: register the adapter on WEATHER_FORECAST, not on its child WEATHER_FORECAST_LAHORE
```

The check runs at registration and again just before the child's evaluation,
so a child registered while the family's module was still pending is rejected
once the family's module goes live.

A family module is tested across its children: the hidden sample is split
between them, and on top of the usual rules it must reach a **60%** win rate on
every child with at least 10 scored pairs. A rejection names the child that
failed.

To see which module scores an intent right now:

```bash
curl -s "https://devnode.telegraphprotocol.com/api/wasm?resolve=WEATHER_FORECAST_LAHORE"
```

```json
{
  "count": 3,
  "intents": { "...": "the usual listing" },
  "resolve": {
    "intent": "WEATHER_FORECAST_LAHORE",
    "class": "judgment",
    "served_by": "WEATHER_FORECAST",
    "inherited": true,
    "scorer": "judgment",
    "routed": true
  }
}
```

`served_by` is the intent whose module scores it (`null` if nothing does), and
`inherited` is `true` when that is a family rather than the intent itself.
`routed: false` means the name resolves to a family module but the intent is not
set up on the node to be scored by it. If `served_by` names a family, register
your improved module on that family.

## What checks your module must pass

Registering on-chain is only the first step. Before your module is allowed to
score real traffic, the node runs it through automatic checks. If it fails, it's
rejected and won't serve traffic (the rejection reason is recorded, so you can
see exactly what went wrong). There are two stages, and you have to clear both.

### Stage 1: structural checks

Run as soon as the node has downloaded your file.

1. **It is a kind the node accepts.** A wide package, or a comparator module
   registered for a deterministic intent. Anything else is rejected with the
   retirement message above.
2. **It passes the checks for its kind.** For a wide package, the table in
   [What the node checks](#what-the-node-checks); reasons start with
   `wide package: …`. A comparator module must load, with its three exports.
3. **Its `telegraph.adapter` section, if any, is valid.**
4. **It is not a child registration under a live family** (judgment and hybrid
   intents only).

Running out of time is not a rejection. A check that times out, or a download or
evaluation that fails with an error, is retried; after 3 failed attempts the
registration is rejected with `gave up after 3 failed evaluation attempts: …`.
A hash mismatch is rejected immediately.

### Stage 2 for comparator modules: correctness

The node runs your module on about 1,260 test cases: the intent's own
comparison code and tolerance, plus all four codes at several tolerances, over
truths from `1` to wei scale (`1e18`) and negative values, with miner values on
both sides of the truth.

- On **every** case your score must be within **±10 basis points** (0.1% of a
  full score) of the reference rule.
- A second identical run must return **exactly** the same results.
- The module must finish within the evaluation time limit.

Any miss rejects the module, and the reason names the first case it got wrong.
A module that passes becomes the intent's comparator, replacing the previous
one.

### Stage 2 for wide adapters: competition on the hidden evaluation pool

A new wide adapter replaces the current one **only by beating it**. Passing a
threshold is not enough.

The test material is the intent's [evaluation pool](contribute-evaluation-data.md):
questions, each with a better and a worse answer, contributed by the public. The
half of the pool used here is hidden from everyone outside the validators. An
adapter **wins** a pair when it scores the better answer strictly above the
worse one. Its **win rate** is wins divided by scored pairs.

**One round, one sample.** Every pending candidate for the intent and the
current module are scored on exactly the same sample (200 pairs by default). The
sample is picked with a seed taken from an epoch that is confirmed after the
last candidate in the round registered, so nobody can know it when they
register. The current module's score on a sample is computed once and reused.

**The rules:**

| Situation | What it takes to win |
|---|---|
| The intent has a current module | The best candidate must reach the current module's win rate **plus 2 points**, **and** at least **70%** overall, **and** (for a family) at least **60%** on each child with 10 or more scored pairs. If the best candidate fails, the next best is tried. If none qualifies, the current module stays. |
| The intent has no module yet | The best candidate that reaches 70% (and the per-child floor) becomes the first canonical module. |
| Every round | At least 10 pairs must be scored, or the round waits for more material. |
| Ties | Higher win rate first, then more scored pairs, then the lower registration ID. |

These are protocol parameters: every validator uses the same values, so they all
reach the same decision.

**Outcomes.** The winner becomes the intent's module and the previous one is
marked `superseded`. Every other candidate in the round is `rejected`, with a
reason naming both win rates and the margin, or the floor it missed. A package
that fails to load or errors while scoring is `rejected` too.

**Waiting for material.** If there is nothing fair to compete on yet, nothing is
promoted or rejected. The candidates stay `pending`, nothing is charged against
their attempts, and there is no time limit. This happens when:

- the intent has no frozen evaluation-pool snapshot for the round yet;
- fewer than 5 different contributors have material in it;
- the sample has fewer than 10 usable pairs;
- no epoch has been confirmed since the last registration in the round; or
- the node does not classify the intent as judgment or hybrid.

Waiting candidates are tried again when new material is frozen, and after every
epoch rollover. Evaluation-pool material is frozen once per epoch, so a module
registered for an intent with little material can wait for a while. You can
help by [contributing data](contribute-evaluation-data.md).

#### The numbers on your registration

Whether your module is promoted or rejected, the node records a **score** and a
**breakdown** on your registration, and the rejection reason spells out which
bar you missed.

For a **wide adapter**, the score is its win rate on the round's sample. The
breakdown fields:

| Field | What it means |
|---|---|
| `decision` | `won` (beat the current module), `first_canonical` (there was no current module), `lost`, `invalid` (failed to load or errored while scoring), or `awaiting_material` (still pending). |
| `reason` | The decision in words. For `lost` it names both rates and the margin, or the floor or child that failed. |
| `candidate_win_rate` / `candidate_pairs` | Your win rate and how many pairs it was measured on. |
| `candidate_child_win_rates` / `candidate_child_pairs` | The same per child, for a family. |
| `incumbent_registration_id` / `incumbent_win_rate` / `incumbent_pairs` | The current module and its result on the same sample. |
| `replacement_margin` / `min_win_rate` / `child_min_win_rate` | The rules applied: `0.02`, `0.7` and `0.6`. |
| `rank` / `round_candidates` | Your place in the round and how many candidates it had. |
| `corpus_version` / `sample_root` | Which snapshot and which sample the round used. Two results with the same `sample_root` were measured on the same pairs. |
| `seed` | The inputs the round's sample was drawn with, recorded so the round can be checked afterwards. |

For example, a challenger that reaches `0.765` against a current module at
`0.75` on the same 200 pairs **loses**: it is better, but not by the 2-point
margin.

For a **comparator module**, the score is the fraction of test cases within the
margin (`1.0` when promoted). The breakdown has `gate: "comparator"`, `cases`,
`mismatches`, `margin_bps` (`10`), `max_deviation_bps`, `deterministic`, the
intent's own `intent_spec`, and up to five `first_mismatches`, each with the
expected (`want`) and returned (`got`) score.

## How to submit / register your module

You register a module on-chain, either through the Telegraph platform or by
calling the contract yourself.

### The easy way

Build your `.wasm`, host it somewhere it can be downloaded from a public URL
(IPFS or any file host), then submit it at
[integrate.telegraphprotocol.com](https://integrate.telegraphprotocol.com/).
The platform hashes the file and sends the transaction for you.

### Registering directly

If you're wiring this into your own app, registration is a single call on the
Diamond:

```solidity
registerWasm(bytes32 wasmHash, string wasmUrl, string intent, address feeAddress)
```

- **`wasmHash`** — the `keccak256` hash of the exact bytes you host. The node
  re-downloads your file and re-hashes it; if the two don't match, the
  registration is rejected. So hash the same bytes you upload — if your host
  re-encodes the file after upload, that breaks the match.
- **`wasmUrl`** — a public `https://` or `ipfs://` URL the node can fetch,
  within the size limit for your module's kind.
- **`intent`** — the one canonical intent your module scores for (for example
  `CODE_REVIEW`). It has to be one of the network's canonical intents, or
  the call reverts with `unsupported intent`. You can read the current list from
  the chain with `getCanonicalIntents`. For a judgment or hybrid intent, register
  on the family if one serves it (see
  [Families](#families-one-module-for-many-intents)).
- **`feeAddress`** — your MACHINA payout address. Must be non-zero, or the call
  reverts with `zero fee address`. This is the same field miners and collectors
  have always had. It is deliberately a separate argument rather than being
  taken from the sending wallet: the key you register with is a hot key, and the
  address your earnings go to should not have to be.

> **Scoring modules hash with `keccak256`. Miner YAMLs hash with `SHA-256`.**
> The two registration flows deliberately differ here, and using the wrong one
> is a rejected registration you paid gas for. For a `.wasm` it is
> `cast keccak`, never `sha256sum`.

The whole call from the command line:

```bash
export DIAMOND=0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8
export RPC=https://base-sepolia.g.alchemy.com/v2/<YOUR_KEY>
export WASM_URL="ipfs://bafkrei..."

# keccak256 of the file's raw bytes. The 0x prefix is required — it is what
# tells cast to hex-decode rather than hash the hex text itself, and without it
# you get a wrong hash with no error.
export WASM_HASH=$(cast keccak "0x$(xxd -p -c 0 my_module.wasm)")

# Where your MACHINA earnings are paid. Can be a cold wallet -- it never has to
# sign or hold gas.
export WASM_FEE_ADDRESS=0xYourPayoutAddress

cast send "$DIAMOND" \
  "registerWasm(bytes32,string,string,address)(uint256)" \
  "$WASM_HASH" "$WASM_URL" "CODE_REVIEW" "$WASM_FEE_ADDRESS" \
  --rpc-url "$RPC" --private-key "$AUTHOR_PRIVATE_KEY"
```

The `xxd` one-liner suits a comparator module. A wide package (about 1.2 GB) is
far too large to pass as a shell argument; hash it with a tool that reads the
file directly and computes Ethereum's Keccak-256 (not NIST SHA3-256, which gives
a different result).

Hash the bytes you are actually going to serve, not a local copy you might edit
afterwards. The safest order is: upload, then `curl` it back down and hash
*that*.

Registering costs only gas: there's no bond and no fee. The Diamond's address is
on the [Addresses & Parameters](../protocol/addresses-and-params.md) page.

### Registering without holding gas

`registerWasm` makes the registration belong to whichever wallet sent the
transaction, so that wallet needs ETH. `registerWasmFor` separates the two: you
sign a message, and **anyone** can submit it and pay the gas for you.

```solidity
registerWasmFor(
  address author,        // you -- ends up owning the registration
  bytes32 wasmHash,
  string  wasmUrl,
  string  intent,
  address feeAddress,
  uint256 deadline,      // unix seconds; the signature is dead after this
  bytes   signature      // EIP-712, signed by `author`
)
```

Your signature covers every argument, so whoever relays it cannot change your
binary, your URL, your intent or your payout address. They can only decide
whether to submit at all.

This is a signature rather than a plain `author` argument on purpose.
Registration is permissionless and first-come-first-served, so if the contract
simply believed an address argument, anyone could register junk under your
address and have it served as yours.

**Signing it (viem):**

```ts
const nonce = await publicClient.readContract({
  address: DIAMOND, abi: intentRegistryAbi,
  functionName: 'metaTxNonce', args: [author],
});
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

const signature = await walletClient.signTypedData({
  account: author,
  domain: {
    name: 'Telegraph',
    version: '1',
    chainId: 84532,
    verifyingContract: DIAMOND,   // the DIAMOND, not a facet address
  },
  types: {
    RegisterWasm: [
      { name: 'author',     type: 'address' },
      { name: 'wasmHash',   type: 'bytes32' },
      { name: 'wasmUrl',    type: 'string'  },
      { name: 'intent',     type: 'string'  },
      { name: 'feeAddress', type: 'address' },
      { name: 'nonce',      type: 'uint256' },
      { name: 'deadline',   type: 'uint256' },
    ],
  },
  primaryType: 'RegisterWasm',
  message: { author, wasmHash, wasmUrl, intent, feeAddress, nonce, deadline },
});
```

Read `metaTxNonce(author)` immediately before signing and include it in the
message. It only advances on a signature that was **accepted**, so a relay that
reverts does not invalidate a signature you already prepared.

`deregisterEntityFor(author, registrationId, 2, deadline, signature)` is the
matching relayed deregistration (`2` is the WASM author entity type). Ownership
is still enforced — the signature proves who is asking, and the record must
actually be yours.

If a relayed call keeps failing with `LibMetaTx: bad signature`, the usual cause
is `verifyingContract` being set to a facet address instead of the Diamond.

**This is optional.** `registerWasm` works exactly as before.

### Getting your registrationId

The call returns a **`registrationId`** — keep it. It's how you check the
module's status and how you deregister it later. A `cast send` doesn't hand you
a return value, so read it back one of two ways.

From the transaction's `WasmRegistered` event, where it is the first indexed
topic:

```solidity
event WasmRegistered(
    uint256 indexed registrationId,
    address indexed author,
    bytes32 indexed intentId,
    string  intent,
    bytes32 wasmHash,
    string  wasmUrl,
    address feeAddress
);
```

Or — simpler, and it works even if you lost the receipt — ask a node for
everything your address has ever registered:

```bash
curl -s https://devnode.telegraphprotocol.com/engine/validator/v1/addresses/<yourAddress>/wasm
```

```json
{
  "address": "0xffe8...",
  "count": 1,
  "wasm": [
    { "RegistrationID": 5, "IntentID": "CODE_REVIEW", "ActivationStatus": "pending", "...": "..." }
  ]
}
```

### You can't register the same binary twice

While a module is registered and active, registering the **same binary again
from the same address** is refused with `duplicate wasm hash`. The check is on
*(your address + the binary)*, which means:

- You can't accidentally register your own module twice.
- A *different* author can still register the same public binary.
- Once you **deregister** a module you can register that same binary again — see
  [Putting the same module back](#putting-the-same-module-back).

To put up a genuinely improved module, just register it under its own
(different) hash; it competes for the intent on its merits (see
[What checks your module must pass](#what-checks-your-module-must-pass)).

### After you register

Your module doesn't go live instantly. It moves through a handful of states:

| Status | Meaning |
|---|---|
| `pending` | Registered, being fetched and evaluated, or waiting for evaluation material. |
| `active` | Won (or passed, for a comparator) and is the live module for its intent. |
| `rejected` | Failed a check or lost its competition round; the reason is recorded. |
| `superseded` | Was active, then a better module took over the intent. |
| `deregistered` | Taken down by its author (see the next section). |

`GET /api/wasm` adds a `stage` field that splits these into the module
lifecycle:

| `stage` | When |
|---|---|
| `registered_eligible` | `pending`: passed the registration checks, waiting for its evaluation. |
| `awaiting_compatible_material` | `pending`: the intent has no usable evaluation material yet (`decision: "awaiting_material"`). |
| `canonical` | `active`: the module scoring the intent. |
| `replaced` | `superseded`: a competition winner took over. |
| `rejected` | `rejected`. |
| `deactivated` | `deregistered`. |

A comparator module is usually decided within minutes. A wide package takes
longer: the download alone can take up to 30 minutes, its round waits for an
epoch to be confirmed after it registered, and it can wait for evaluation
material with no time limit. A rejection is final — which is why it's worth
testing first: every re-registration is another transaction.

### Checking your module's status

Poll any node by your `registrationId`:

```bash
curl -s https://devnode.telegraphprotocol.com/engine/validator/v1/wasm/12
```

```json
{
  "wasm": {
    "RegistrationID": 12,
    "AuthorAddress": "0xffe89e1f0a77c600ad938b57180e5be3e3119f40",
    "WasmURL": "ipfs://bafybei...",
    "WasmHash": "34220f7244084b2542c34b114189963db5924812e170e54997f9241c9b6807ac",
    "ActivationStatus": "rejected",
    "IntentID": "CODE_REVIEW",
    "RejectionReason": "lost the competition for CODE_REVIEW: win rate 76.50% did not beat the incumbent (registration 5) at 75.00% by the replacement margin 2.00 points on the same 200-pair sample",
    "EvalScore": 0.765,
    "EvalDetails": "{\"decision\":\"lost\",\"candidate_win_rate\":0.765,\"candidate_pairs\":200,...}",
    "EvalErrorCount": 0,
    "RegisteredAt": "2026-10-14T17:28:47Z",
    "UpdatedAt": "2026-10-14T18:02:11Z"
  }
}
```

| Field | What to do with it |
|---|---|
| `ActivationStatus` | The state from the table above. This is what you poll for. |
| `RejectionReason` | Exactly which bar you missed, in the evaluator's own words. `null` unless rejected. |
| `EvalScore` | Your win rate (wide adapter) or the fraction of cases within the margin (comparator). `null` on a module that never got as far as Stage 2. |
| `EvalDetails` | The full [breakdown](#the-numbers-on-your-registration) as a JSON string. On a waiting module it carries `decision: "awaiting_material"` and the reason. |
| `EvalErrorCount` | How many times evaluation failed with an *error* rather than a verdict (fetch failed, evaluator errored). Retried until it hits 3, then rejected with `gave up after N failed evaluation attempts`. Waiting for material is not an error and is not counted. |

Lookups, depending on what you have:

| Endpoint | Use it when |
|---|---|
| `GET /engine/validator/v1/wasm/{registrationId}` | You have the ID and want one module's status. |
| `GET /engine/validator/v1/addresses/{yourAddress}/wasm` | You lost the ID, or want everything you have ever registered. |
| `GET /engine/v1/intents/{INTENT}/wasm` | You want every module registered for an intent — including whichever one is currently `active`. |
| `GET /api/wasm?intent={INTENT}` | The same per-intent list with snake_case keys, the `stage` field and `eval` as a parsed object. `GET /api/wasm/{registrationId}` is the single-record view. |

All are free, unauthenticated `GET`s.

`400` means a non-numeric or out-of-range id · `404` no registration with that
id · `503` the node has no WASM store configured.

### Knowing what you're up against

Before you build, look at who currently holds the intent you're targeting:

```bash
curl -s https://devnode.telegraphprotocol.com/engine/v1/intents/CODE_REVIEW/wasm
```

```json
{
  "count": 5,
  "intent_id": "CODE_REVIEW",
  "wasm": [
    { "RegistrationID": 5, "ActivationStatus": "active", "EvalScore": 0.75, "...": "..." }
  ]
}
```

The entry with `ActivationStatus: "active"` is the current module. For a wide
adapter, its `EvalScore` is the win rate from the round it won. That is a guide,
not your target: your round uses a new sample, and the current module is scored
again on that same sample. You need its win rate there plus 2 points.

For a judgment or hybrid intent, also check `GET /api/wasm?resolve=<INTENT>`: if
a family module serves the intent, that is the module you are up against, and
the family is where you register.

**An intent with no live module isn't scored.** For a judgment or hybrid intent
with no module (its own or a family's), your module only has to reach the 70%
floor to become the first canonical module.

The `rejected` entries are worth reading too. Their `RejectionReason` strings are
a free list of the ways modules have already failed on that intent.

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

If the registering address holds no gas, sign instead and let anyone relay it:

```solidity
deregisterEntityFor(author, registrationId, 2, deadline, signature)
```

Same rule applies — the signature proves who is asking, and the module must
actually be yours. See
[Registering without holding gas](#registering-without-holding-gas) for how to
produce the signature.

The Diamond's address is on the
[Addresses & Parameters](../protocol/addresses-and-params.md) page, and can
always be read straight from the chain.

### What actually happens when you deregister

Once the network sees the deregistration:

- **Your module is marked `deregistered`.** That's a final state — a
  deregistered module won't start scoring again on its own. (You can register
  it again from scratch, though — see below.)
- **If your module was the live module for its intent,** the network puts back
  the module yours had replaced, if it still has it (it keeps one previous
  module per intent). If there is none, a judgment or hybrid intent falls back to
  its family's module if one serves it, and otherwise isn't scored until a new
  module wins; its miners keep their last ranking in the meantime.
- **If your module wasn't the live one** (it was still pending, was rejected, or
  had already been replaced), deregistering it just marks it inactive. Nothing
  that's live changes.

### Replacing a module

You usually **don't** need to deregister to upgrade. Just register the new
module. A wide adapter takes over only if it wins its competition round against
the current module (see
[Stage 2 for wide adapters](#stage-2-for-wide-adapters-competition-on-the-hidden-evaluation-pool));
a comparator module takes over once it passes the correctness gate.
Deregistering the old one afterwards is optional tidy-up, not a required step.

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

- **Comparator modules:** reproduce the reference rule exactly, including the
  awkward parts — truth first, saturating multiplication, 128-bit RelTol, unknown
  codes treated as Exact. Test at the window edges and at wei scale.
- **Wide adapters:** the test is ordering. On every pair your model should score
  the better answer above the worse one. A model that gives everything the same
  score wins nothing.
- **Families:** a family module has to hold up on each child, not just on
  average. Train and check it on every child you expect it to serve.
- **Margins:** a small improvement isn't enough to replace a current module. Aim
  to clear it by more than 2 points on material you haven't trained on.

Good luck!
