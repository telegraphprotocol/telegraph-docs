---
description: Write, test and register your own Evaluator adapter (a safetensors delta on the shared Foundation Model) that scores a judgment or hybrid intent. Comparator modules are no longer accepted. Start here — no prior Telegraph knowledge needed.
---

# Build an Evaluator Adapter

This guide is for anyone who wants to build their own **scoring module** for
Telegraph — the piece of code that judges how good a miner's answer is and
decides its ranking. If you're building a *miner* (something that answers
questions), see the [YAML Configuration](../miners/yaml-config.md) guide
instead: this page is about the judge, not the contestant.

## What is an evaluator adapter?

When someone asks the network a question, several miners may answer it. The
network needs a way to decide which answer was best. For a judgment or hybrid
intent, that job is done by an **Evaluator adapter**: a model delta (a LoRA
package) that the node applies to its shared Foundation Model. Your code never
runs on the node, so nobody has to trust it.

Every intent has a **class**, and the class decides how it is scored (see
[How answers are scored](../using/intents.md#the-three-kinds)):

| Intent class | How it is scored | What you build |
|---|---|---|
| Deterministic | By the node's **built-in checker**. It compares the value read from a miner's answer with the epoch's reference value (the median of up to 3 truth sources from the [evaluation pool](contribute-evaluation-data.md#truth-sources-deterministic-intents)), using the intent's comparison rule and tolerance. | **Nothing.** A deterministic intent takes no adapter and no module. |
| Judgment | An **Evaluator adapter** (a safetensors delta on the shared Foundation Model). A reward model judges each answer on its own merits. No reference answer is needed. | An Evaluator adapter. |
| Hybrid | An **Evaluator adapter**, hybrid class, plus the node's built-in checker. The checker scores the checkable part, the adapter judges the rest, and the node combines the two. | An Evaluator adapter, hybrid class. |

Each intent has one live adapter at a time, its **canonical** adapter. A judgment
or hybrid intent with no adapter of its own can use its family's (see
[Families](#families-one-module-for-many-intents)). An intent that nothing
serves is not scored, and its miners keep their previous ranking.

> [!IMPORTANT]
> **Comparator modules are no longer accepted.** The node refuses every new
> comparator module (a `.wasm` that exports `imw_score_deterministic`, also called a
> deterministic checker), for every kind of intent. The reason it gives:
>
> `Comparator modules are no longer accepted. Deterministic intents are scored by the node's built-in checker and take no adapter. Build an Evaluator adapter (a LoRA package) for a judgment or hybrid intent family; check GET /engine/v1/intents/<intent> for its class.`
>
> Do not build one. Check the class first:
>
> ```bash
> curl -s https://devnode.telegraphprotocol.com/engine/v1/intents/GAS_PRICE | jq .class
> ```
>
> Build an adapter only if the class is `judgment` or `hybrid`. Every intent has
> the same class as its parent family, so the class this call shows is the class
> your adapter is tested by. Register the adapter on the **parent family** (the
> prefix), for example `GAS_PRICE`, not `GAS_PRICE_GENERAL`.

> **`rank_answer` modules are retired.** Earlier versions of this guide
> described a module exporting `rank_answer`, `alloc` and `dealloc` that
> compared a miner's answer with a reference answer. The node no longer runs
> that kind of module. A new registration of one is rejected straight away with
> `MiniLM rank_answer scoring modules are retired and are no longer accepted: …`.
> Build an Evaluator adapter instead.

## What environment does it run in?

An Evaluator adapter brings no code at all. Its deltas are fed to the node's own
Foundation Model engine, which runs in a lightweight WASM sandbox built into the
node, not in a separate VM or Docker container. That means:

- **No network access.** No HTTP calls, no sockets, no internet.
- **No filesystem access.** No reading or writing files, no environment
  variables.
- **No state you can rely on.** The node may reuse one loaded copy of your
  adapter for many calls, or load a fresh copy for each batch. The same input
  must always give the same output.
- It only gets the inputs it's given and must work with those alone.

This is by design: it keeps scoring fast, deterministic, and safe to run
untrusted, third-party adapters.

## Deterministic intents take no adapter

A deterministic intent has one right answer: a price, a count, a yes or no. Each
epoch the node builds a reference value from the intent's truth sources in the
evaluation pool (public APIs that contributors upload, see
[Truth sources](contribute-evaluation-data.md#truth-sources-deterministic-intents)),
reads the value out of each miner's answer, and scores how close they are with
its own built-in checker. There is nothing for you to build or register, and the
node refuses every new comparator module (see the box above).

What helps these intents is
[evaluation material](contribute-evaluation-data.md): truth sources and test
cases.

## Evaluator adapters (judgment and hybrid intents)

An Evaluator adapter is a reward model: it reads a question and a miner's answer and
returns a score, and a better answer should get a higher score. Every validator runs **one
shared Foundation Model** (ModernBERT-base with a reward head, loaded once per validator),
and your adapter is only what you trained on top of it: a **safetensors delta package**
holding the LoRA deltas and the reward head, a few MB (6.8 MB at rank 8, 13.5 MB at rank 16). The validator
applies it to the Foundation Model at score time; the base weights never travel with your
adapter. The hash you register is the package's keccak256.

Answers reach your model as tokens from the network's pinned ModernBERT tokenizer, so
train on that vocabulary.

The tools to train, export and check one are in the adapter kit,
[telegraph-wasm-baseline](https://github.com/telegraphprotocol/telegraph-wasm-baseline).
[Train an Evaluator Adapter](train-a-scoring-adapter.md) walks through them step by step
and lists the exact package format. Nothing is baked into a `.wasm` any more.

> **Earlier formats are rejected.** A full-model float `.wasm` (the model baked into a
> WASI command, about 600 MB) is rejected with `legacy_full_model: full-model float
> adapters are no longer accepted; …`, and an adapter already Active in that format stops
> serving when validators upgrade: export it again as a delta and register it again (see
> [Upgrading to the Shared Foundation Model](upgrade-shared-foundation.md)). Q32.32
> packages (`imwq_*` exports, `.imwq` files) are rejected with `Q32.32 wide adapters are
> retired; package the adapter as a safetensors delta for the shared Foundation Model`.

### What the node checks

| Requirement | Detail |
|---|---|
| Format | A safetensors file whose `__metadata__` declares `abi` `lora-v1` and `format_version` `1`. |
| Foundation and tokenizer | `foundation_hash` is the sha256 of the validator's Foundation Model, and `tokenizer_hash` the pinned ModernBERT tokenizer. A validator that runs no Foundation Model rejects every package (`no_foundation`). |
| Class | `class` is `judgment` or `hybrid`, the class of the intent you register for. A package registered for a deterministic intent is refused. |
| LoRA | `rank` 1 to 16, `target_modules` among `Wqkv`, `Wo`, `Wi`, a positive `alpha`. |
| Tensors | Exactly the LoRA A/B tensors of every layer and the reward head, `F32`, each the exact shape for the Foundation Model, tiling the data with nothing left over, every value finite. |
| Tokens | `max_tokens` 1 to 512. |
| Size | At most 64 MiB by default (a node setting), downloaded within 120 seconds. |

The node recognises a package by parsing its header, from the first MiB of the download; a
full-model `.wasm` is recognised there too and its download stops at once. Check failures
start with `lora adapter: <reason>: …`; the reasons and their fixes are in
[Rejection reasons for Evaluator adapters](#rejection-reasons-for-evaluator-adapters).
The engine checks the package again when it loads it.

When the adapter reaches
[Stage 2](#stage-2-for-model-adapters-competition-on-the-hidden-evaluation-pool), every
validator scores it on the same Foundation Model and engine, in a fixed sandbox (no files,
an empty environment, a frozen clock, a fixed random stream, no network). A score is
identified by the foundation hash, your package's hash, the tokenizer hash and the input.

### The training record

A package may carry a self-reported training record in its `training` metadata key (a JSON
string). The kit's `export_adapter --training-record` writes it.

```json
{
  "family": "CODE_REVIEW",
  "children": [
    { "intent": "CODE_REVIEW", "pairs": 4000, "accuracy": 0.81, "spearman": 0.62, "held_out": false },
    { "intent": "CODE_REVIEW_PYTHON", "pairs": 1200, "accuracy": 0.77, "spearman": 0.55, "held_out": true }
  ]
}
```

Fields: `family` (required), `children` (at least one), and optionally `trainer`,
`backbone` and `backbone_version`. Each child has `intent`, `pairs`, `accuracy`,
`spearman`, `held_out` and an optional `dataset_version`.

The node checks the record's shape only: `family` is set, `children` is not empty, every
child is the family itself or a `_`-child of it, no child is listed twice, `pairs` is not
negative, `accuracy` is between 0 and 1, and `spearman` is between −1 and 1. It never uses
the numbers to decide anything; the hidden evaluation is the real test. A malformed record
is rejected with `lora adapter: training_record: …`.

## Families: one module for many intents

Some intents are very specific, like `WEATHER_FORECAST_LAHORE` and
`WEATHER_FORECAST_TOKYO`, so that miners answer exactly the same question. An
adapter is registered on a **prefix** (the family name, for example
`WEATHER_FORECAST` or `CODE_REVIEW`), and it serves every **child** intent whose name
extends that prefix with `_`. Always register on the parent family: `GAS_PRICE`,
not `GAS_PRICE_GENERAL`. The prefix must be a **registered prefix** in the
catalog: `registerWasm` reverts with `not a registered prefix` otherwise. See
[Intents](../using/intents.md#prefixes-and-intents) for how prefixes work.

- **Longest prefix wins.** `WEATHER_FORECAST_LAHORE` uses the module on
  `WEATHER_FORECAST` before the one on `WEATHER`. A child with its own live
  module uses its own.
- **The `_` is part of the rule.** `WEATHERX` is not a child of `WEATHER`.
- **Same class only.** A judgment family never serves a hybrid child, or the
  other way round. Every intent has the same class as its parent family, so the
  `class` shown by `GET /engine/v1/intents/<intent>` is the class your adapter
  is tested by.
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
Before either, the node checks your module at its
[runnable endpoint](#the-runnable-endpoint), so a module that would fail costs a
few HTTP requests instead of a download.

### Stage 1: structural checks

Run as soon as the node has downloaded your file.

1. **It is a kind the node accepts.** An Evaluator adapter (a safetensors delta
   package) registered for a judgment or hybrid intent. A comparator module
   (`imw_score_deterministic`), a full-model float `.wasm`
   (`legacy_full_model`), a MiniLM `rank_answer` module or a Q32.32 package is
   rejected with its own message.
2. **It passes the checks for an Evaluator adapter.** The table in
   [What the node checks](#what-the-node-checks), against the validator's own
   Foundation Model and tokenizer; reasons start with `lora adapter: …`.
3. **It is not a child registration under a live family** (judgment and hybrid
   intents only).

Running out of time is not a rejection. A check that times out, or a download or
evaluation that fails with an error, is retried; after 3 failed attempts the
registration is rejected with `gave up after 3 failed evaluation attempts: …`.
A hash mismatch is rejected immediately.

### Stage 2 for model adapters: competition on the hidden evaluation pool

A new Evaluator adapter replaces the current one **only by beating it**. Passing a
threshold is not enough.

The test material is the intent's [evaluation pool](contribute-evaluation-data.md):
questions, each with a better and a worse answer, contributed by the public. The
half of the pool used here is hidden from everyone outside the validators. An
adapter **wins** a pair when it scores the better answer strictly above the
worse one. Its **win rate** is wins divided by scored pairs.

**One round, one sample.** Every pending candidate for the intent and the
current module are scored on exactly the same sample (30 pairs per round). The
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

For an **Evaluator adapter**, the score is its win rate on the round's sample. The
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

## How to submit / register your module

You register a module on-chain, either through the Telegraph platform or by
calling the contract yourself.

### The easy way

Build your Evaluator adapter (a `.safetensors` package), host it somewhere it can be downloaded from a public URL
(IPFS or any file host), then submit it at
[anjoman.ai/dashboard/eval](https://anjoman.ai/dashboard/eval).
The platform hashes the file and sends the transaction for you.

> [!WARNING]
> The platform's form asks for the file link, the intent and the payout address,
> but not for a runnable URL. Every registration needs a real
> [runnable endpoint](#the-runnable-endpoint) that the node checks before anything
> else, so register an Evaluator adapter directly, as below.

### Registering directly

If you're wiring this into your own app, registration is a single call on the
Diamond:

```solidity
registerWasm(bytes32 wasmHash, string wasmUrl, string intent, address feeAddress, string wasmRunnableUrl)
```

- **`wasmHash`** — the `keccak256` hash of the exact bytes you host. The node
  re-downloads your file and re-hashes it; if the two don't match, the
  registration is rejected. So hash the same bytes you upload — if your host
  re-encodes the file after upload, that breaks the match.
- **`wasmUrl`** — a public `https://` or `ipfs://` URL the node can fetch,
  within the size limit for your module's kind.
- **`intent`**: the **prefix** (family) your module scores, for example
  `CODE_REVIEW` or `FX_NOW`. It must be a registered prefix or the call reverts
  with `not a registered prefix`. Read the prefixes from the chain with
  `getPrefixes()`. Your module then scores every intent under that prefix (see
  [Families](#families-one-module-for-many-intents)). An Evaluator adapter's
  class must match the prefix's kind.
- **`wasmRunnableUrl`**: a **hosted, runnable endpoint** that runs the same
  module as `wasmUrl` (for an Evaluator adapter: your package on the Foundation
  Model). It must be non-empty or the call reverts with
  `IntentRegistryFacet: empty runnable URL`. The node scores a candidate at this
  endpoint *before* it downloads the file, so a module that would fail costs one
  or two batch requests instead of a download, a Stage 1 pass and a competition
  round. See [The runnable endpoint](#the-runnable-endpoint).
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
export DIAMOND=0x72a70e949362670Bf8bceAd24eFC5b8f950aa08b
export RPC=https://ethereum-sepolia-rpc.publicnode.com
export USDC=0xcc194e1a843B658526D0D5C431f670028582Ae17
export AUTHOR_PRIVATE_KEY=0x...   # the wallet that will own the registration
export WASM_URL="ipfs://bafkrei..."

# keccak256 of the file's raw bytes. The 0x prefix is required — it is what
# tells cast to hex-decode rather than hash the hex text itself, and without it
# you get a wrong hash with no error.
export WASM_HASH=$(cast keccak "0x$(xxd -p -c 0 my_module.wasm)")

# Where your MACHINA earnings are paid. Can be a cold wallet -- it never has to
# sign or hold gas.
export WASM_FEE_ADDRESS=0xYourPayoutAddress

# Your hosted, runnable endpoint (see "The runnable endpoint" below).
export WASM_RUNNABLE_URL="https://your-host.example/runnable"

# Let the Diamond take the $5 bond in test USDC (6 decimals: 5000000 = 5 USDC).
cast send "$USDC" "approve(address,uint256)" "$DIAMOND" 5000000 \
  --rpc-url "$RPC" --private-key "$AUTHOR_PRIVATE_KEY"

# Dry run (free): returns the registrationId you would get, or the revert reason.
cast call "$DIAMOND" \
  "registerWasm(bytes32,string,string,address,string)(uint256)" \
  "$WASM_HASH" "$WASM_URL" "CODE_REVIEW" "$WASM_FEE_ADDRESS" "$WASM_RUNNABLE_URL" \
  --from "$(cast wallet address --private-key "$AUTHOR_PRIVATE_KEY")" --rpc-url "$RPC"

cast send "$DIAMOND" \
  "registerWasm(bytes32,string,string,address,string)(uint256)" \
  "$WASM_HASH" "$WASM_URL" "CODE_REVIEW" "$WASM_FEE_ADDRESS" "$WASM_RUNNABLE_URL" \
  --rpc-url "$RPC" --private-key "$AUTHOR_PRIVATE_KEY"
```

Approve before the dry run. Without the allowance it stops at the bond, as a
bare `execution reverted` whose data starts `0xfb8f41b2`
(`ERC20InsufficientAllowance`; `cast decode-error <data>` names it), and it
hides any other mistake, such as a name that is not a prefix.

An Evaluator adapter (6.8 MB at rank 8) is too large to pass as a shell
argument, so the `xxd` one-liner above does not work for it. Take the `keccak256`
that the kit's `adapterbuild lora` prints, or let `cast` read the file from
standard input, which hashes its raw bytes:

```bash
export WASM_HASH=$(cast keccak < runs/CODE_REVIEW/CODE_REVIEW.safetensors)
```

Do not use a NIST SHA3-256 tool (for example Python's `hashlib.sha3_256`): it
gives a different result than Ethereum's Keccak-256.

Hash the bytes you are actually going to serve, not a local copy you might edit
afterwards. The safest order is: upload, then `curl` it back down and hash
*that*.

Registering posts a **$5 bond in test USDC** (at face value; read it with
`entityBonds()`), plus gas. To get test USDC, see
[Getting test tokens](../protocol/addresses-and-params.md#getting-test-tokens). The bond is returned in full when you deregister and
is never slashed. Approve the Diamond for it first, as above, or the call reverts
with `ERC20: insufficient allowance` (or `ERC20: transfer amount exceeds balance` if the wallet holds less than 5 USDC). The Diamond's address is on the
[Addresses & Parameters](../protocol/addresses-and-params.md) page.

### The runnable endpoint

`wasmRunnableUrl` must be a real endpoint that runs **the module you registered**. A
placeholder passes the on-chain check, but the node then fails to reach it and rejects
the registration after three attempts. For an Evaluator adapter that means your package
running on the **same Foundation Model file and engine module the validators run**: the
node later re-scores the same texts itself and rejects any score that differs by a single
bit, so a different runtime (for example native ONNX Runtime, or a full-model `.wasm`)
does not pass. The adapter kit's [`cmd/adapterexec`](https://github.com/telegraphprotocol/telegraph-wasm-baseline/tree/main/cmd/adapterexec) is the reference
executor: it runs the Foundation Model and your package with the node's own runtime. The
examples repository's
[`evaluator-adapter`](https://github.com/telegraphprotocol/telegraph-examples/tree/master/evaluator-adapter)
folder has a script that sends your endpoint the request a validator sends and checks the
reply.

Run it behind your own public HTTPS reverse proxy: the node does not follow redirects, and
it refuses loopback, private and link-local addresses (`refusing to connect to blocked
address`). Give the executor at least 5 GB of RAM: with the Foundation Model loaded it uses
about 4.2 GB, and it is killed while loading under a 4 GB limit. Keep the endpoint up until
your registration leaves `pending`.

The endpoint must implement the **batch request**:

- **Request.** One `POST` whose JSON body is `{"batch": [<question>, ...]}`, never one
  question per request. A question is `{"tokens": [<int64>, ...]}`: the node renders and tokenises the text itself with the
  pinned vocabulary, so your endpoint needs no tokenizer; score each list as given
  (truncated to the package's `max_tokens`). A batch holds at most 100 questions, and the
  body is at most a few hundred KB, so accept bodies of at least 1 MiB.
- **Score identity (Evaluator adapters).** Next to `batch` the request carries
  `foundation_hash` (the sha256 of the validator's Foundation Model), `adapter_hash` (the
  registered keccak256, lowercase hex, no `0x`), `tokenizer_hash` (the sha256 of the
  validator's `tokenizer.json`) and `input_root` (a sha256 binding the batch's token
  inputs). Your reply must echo the first three at its top level, next to `results`, with
  the values **you actually scored with**:

  ```json
  {"results": [{"score": 3204838382}],
   "foundation_hash": "<sha256 of your foundation file>",
   "adapter_hash": "<keccak256 of the package you loaded>",
   "tokenizer_hash": "<that package's tokenizer_hash>"}
  ```

  A different echo rejects the registration at once (`identity echo mismatch`); a missing
  echo rejects it after the download (`its runnable URL did not echo the score
  identity`). Echoing `input_root` is optional, but an echo that differs is the same
  mismatch.
- **Reply.** `200` with `{"results": [<result>, ...]}`, exactly one result per question,
  **in the same order**. A result is `{"score": <integer>}` or `{"error": "..."}` when your
  module rejects that input. The score is the **f32 bit pattern** of the reward logit as an
  unsigned 32-bit integer (for example `3204838382` for `0xbf05f3ee`), never a decimal,
  which would be rounded. NaN and infinity bit patterns are refused. A reply over 64 KiB, a
  different number of results than questions, or an out-of-range score counts as a failed
  attempt.
- **When it is called.** Not straight away. The cases are picked by a seed from the first
  epoch that settles after your registration, so nobody can know them when registering.
  Until then the registration stays `pending`, your endpoint is not called, your file is
  not downloaded and no attempt is used. The node asks up to 30
  questions (15 public pairs, two texts each) in one batch, and at least 70% of the pairs
  must come out in the right order. The hidden competition split is never sent to your
  endpoint.
- **Time limit.** The whole check must finish within 30 minutes. On a laptop CPU one 512-token text takes about 13-14
  seconds on the Foundation Model, so 30 texts take about 7 minutes.
- **Failures.** A `4xx`, or a `200` with no `results` array (for example the old single
  `{"score": N}` form), means the endpoint does not implement the batch request: the
  registration is rejected at once with `its runnable URL did not accept the batch
  request`. `408`, `429` and `5xx` are retried at the next epoch rollover or within the hour
  (not at once, so a briefly busy endpoint can recover); after 3 failed attempts the
  registration is rejected with `remote executor unreachable`. For an Evaluator adapter,
  after the file downloads the node re-scores the same public pairs and rejects a candidate
  whose package does not reproduce your endpoint's answers bit for bit (`remote score
  mismatch`).

If the intent has no public evaluation material yet, there is nothing to check your
endpoint against: the registration stays `pending` (`awaiting_compatible_material`) and is
re-evaluated when a snapshot is published.

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
  string  wasmRunnableUrl,
  uint256 deadline,      // unix seconds; the signature is dead after this
  bytes   signature      // EIP-712, signed by `author`
)
```

Your signature covers every argument, so whoever relays it cannot change your
binary, your URLs, your intent or your payout address. They can only decide
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
    chainId: 11155111,
    verifyingContract: DIAMOND,   // the DIAMOND, not a facet address
  },
  types: {
    RegisterWasm: [
      { name: 'author',     type: 'address' },
      { name: 'wasmHash',   type: 'bytes32' },
      { name: 'wasmUrl',    type: 'string'  },
      { name: 'intent',     type: 'string'  },
      { name: 'feeAddress', type: 'address' },
      { name: 'wasmRunnableUrl', type: 'string' },
      { name: 'nonce',      type: 'uint256' },
      { name: 'deadline',   type: 'uint256' },
    ],
  },
  primaryType: 'RegisterWasm',
  message: { author, wasmHash, wasmUrl, intent, feeAddress, wasmRunnableUrl, nonce, deadline },
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
    address feeAddress,
    string  wasmRunnableUrl
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
| `active` | Won its competition round and is the live module for its intent. |
| `rejected` | Failed a check or lost its competition round; the reason is recorded. |
| `superseded` | Was active, then a better module took over the intent, or a validator upgrade took it out of service (a full-model `.wasm`, or a foundation update: `foundation_updated: …`). |
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

First, the node has to see your transaction. It reads the chain at Sepolia's
`safe` block, so your registration appears about 10 to 15 minutes after the
transaction.

An Evaluator adapter is not decided at once. It waits for an epoch to be confirmed after it
registered (epochs are 3 hours on the testnet), then every check scores real texts
on the Foundation Model (up to 30 at your endpoint, the same 30 again on the
validator, then 60 in the competition round), and it can wait for evaluation
material with no time limit. On the testnet, the checks after that epoch usually
take about 5 to 15 minutes, so **plan for up to about three and a half hours from your
transaction to `active`**, most of it the wait for the epoch. A rejection is final — which is why it's worth testing first: every
re-registration is another transaction.

### Checking your module's status

Poll any node by your `registrationId`:

```bash
curl -s https://devnode.telegraphprotocol.com/engine/validator/v1/wasm/12
```

```json
{
  "wasm": {
    "RegistrationID": 12,
    "AuthorAddress": "0xc0a3fb6d3f1f4b54617d29ffbda4663af5f96e2e",
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
| `EvalScore` | Your win rate. `null` on a module that never got as far as Stage 2. |
| `EvalDetails` | The full [breakdown](#the-numbers-on-your-registration) as a JSON string. On a waiting module it carries `decision: "awaiting_material"` and the reason. |
| `EvalErrorCount` | How many times evaluation failed with an *error* rather than a verdict (fetch failed, evaluator errored). Retried until it hits 3, then rejected with `gave up after N failed evaluation attempts`. Waiting for material is not an error and is not counted. |

Lookups, depending on what you have:

| Endpoint | Use it when |
|---|---|
| `GET /engine/validator/v1/wasm/{registrationId}` | You have the ID and want one module's status. |
| `GET /engine/validator/v1/addresses/{yourAddress}/wasm` | You lost the ID, or want everything you have ever registered. |
| `GET /api/wasm?intent={PREFIX}` | You want every module registered for a prefix, including the current one (`champion`), with snake_case keys, the `stage` field and `eval` as a parsed object. `GET /api/wasm/{registrationId}` is the single-record view. |

All are free, unauthenticated `GET`s.

`400` means a non-numeric or out-of-range id · `404` no registration with that
id · `503` the node has no WASM store configured.

### Rejection reasons for Evaluator adapters

An Evaluator adapter's `rejection_reason` names the rule it broke. Stage 1 reasons read
`structural validation failed: lora adapter: <reason>: …` (or `… failed on re-fetch: …`);
remote-check reasons start with `remote executor check failed before download: …`.

| Reason | What it means | Fix |
|---|---|---|
| `Comparator modules are no longer accepted. …` | The file is a comparator module (it exports `imw_score_deterministic`). The node refuses these for every intent kind. | Do not register a comparator. A deterministic intent takes no adapter. For a judgment or hybrid family, build an Evaluator adapter. |
| `legacy_full_model` | The file is a full-model float `.wasm` (the model baked into a WASI command), the format before the shared Foundation Model. Its download is stopped at the first MiB. | Export the delta from the adapter's training run with the kit's `export_adapter.py` and register the `.safetensors`. See [Upgrading](upgrade-shared-foundation.md). |
| `foundation_mismatch` | The package's `foundation_hash` is not the validator's Foundation Model. | Export again with the current `foundation.json`. A package built for another foundation is never served on this one. |
| `tokenizer_mismatch` | `tokenizer_hash` is not the pinned ModernBERT tokenizer. | Train and export with ModernBERT-base's `tokenizer.json`. |
| `no_foundation` | The validator runs no Foundation Model, so it scores no Evaluator adapter. | Nothing on your side: that validator must be configured. All validators of the network run one. |
| `class_mismatch` | `class` is not the intent's (a judgment package for a hybrid intent, or the reverse). | `export_adapter --class` with the intent's class. |
| `rank_too_large` | `rank` is above 16. | Train with `--lora-rank` 16 or less. |
| `bad_target_module` | A `target_modules` entry other than `Wqkv`, `Wo`, `Wi`, or one listed twice. | Train plain PEFT LoRA on those modules. |
| `bad_shape` | A tensor is missing, repeated, unexpected or the wrong shape for the Foundation Model. | The package was built for another base model, or edited by hand. Export again with the kit. |
| `bad_dtype` | A tensor is not `F32`. | Export again with the kit. |
| `bad_offsets`, `trailing_bytes`, `truncated` | The tensors do not tile the data exactly (an overlap, a gap, bytes after the last tensor, or a short file). | Upload the file again unchanged, or export again. |
| `non_finite` | A NaN or infinite value. | Retrain or export again. |
| `too_large`, or `gave up after 3 failed evaluation attempts: binary fetch failed` | Above the validator's size cap (64 MiB by default). A download over the cap counts as a failed fetch (the node logs `exceeds the N-byte lora-adapter limit`) and is rejected after 3 attempts. | A rank-8 package is 6.8 MB; check you uploaded the delta, not another file. |
| `bad_max_tokens` | `max_tokens` outside 1 to 512. | `export_adapter --max-tokens`. |
| `training_record` | The optional training record is malformed. | Fix or drop `--training-record`. |
| `bad_header`, `bad_abi`, `bad_version`, `bad_container`, `missing_metadata` | Not a safetensors file, no `__metadata__`, a missing or malformed field, or an unknown metadata key (extension keys start with `x-`). | Export again with the current kit. |
| `identity echo mismatch` | Your runnable URL echoed a different `foundation_hash`, `adapter_hash`, `tokenizer_hash` or `input_root` than the node sent. Rejected before the download. | Run the registered package on the validators' Foundation Model and echo what you actually ran. |
| `its runnable URL did not echo the score identity` | Your runnable URL returned scores without the identity echo. Rejected after the download. | Add the three fields to the reply (see [The runnable endpoint](#the-runnable-endpoint)). |
| `remote score mismatch` | The node re-scored a public pair and got different bits than your runnable URL. | Serve the same foundation, engine and package the validators run. |
| `wasm hash mismatch` | The downloaded file's keccak256 is not the registered hash. Rejected on the first attempt. | Register the keccak256 of the exact bytes you host. |
| `Q32.32 wide adapters are retired; …` / `MiniLM rank_answer scoring modules are retired …` | A retired module format. | Build a delta package. |

A `superseded` adapter whose `rejection_reason` starts with `foundation_updated` was taken
out of service by a Foundation Model update: it was built for the previous foundation, or
failed Stage 1 under the new one. It is never rolled back to; export a delta for the
current foundation and register it.

### Knowing what you're up against

Before you build, look at who currently holds the intent you're targeting:

```bash
curl -s "https://devnode.telegraphprotocol.com/api/wasm?intent=CUSTOMER_TICKET_RESOLUTION" \
  | jq '.intents[] | {champion: .champion | {registration_id, eval_score}, entries: [.entries[] | {registration_id, activation_status, stage}]}'
```

```json
{
  "champion": { "registration_id": 25, "eval_score": 0.89285713 },
  "entries": [
    { "registration_id": 25, "activation_status": "active", "stage": "canonical" },
    { "registration_id": 24, "activation_status": "superseded", "stage": "replaced" },
    { "registration_id": 20, "activation_status": "rejected", "stage": "rejected" }
  ]
}
```

`champion` is the current module (`null` when there is none). For a model
adapter, its `eval_score` is the win rate from the round it won. That is a guide,
not your target: your round uses a new sample, and the current module is scored
again on that same sample. You need its win rate there plus 2 points.

For a judgment or hybrid intent, also check `GET /api/wasm?resolve=<INTENT>`: if
a family module serves the intent, that is the module you are up against, and
the family is where you register.

**An intent with no live module isn't scored.** For a judgment or hybrid intent
with no module (its own or a family's), your module only has to reach the 70%
floor to become the first canonical module.

The `rejected` entries are worth reading too. Their `rejection_reason` strings are
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
module down. The module stops serving as soon as the node sees the transaction (about
10 to 15 minutes, as above); you don't need to wait for an epoch to roll over.

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
module. An Evaluator adapter takes over only if it wins its competition round against
the current module (see
[Stage 2 for model adapters](#stage-2-for-model-adapters-competition-on-the-hidden-evaluation-pool)).
Deregistering the old one afterwards is optional tidy-up, not a required step.

### Putting the same module back

Deregistering is not a one-way door. After you deregister a module, you can
register the **exact same binary** again later — the slot it used is freed up
when you deregister. Every registration, whether it's a brand-new module or one
you're bringing back, gets its own fresh registration ID.

### What it costs

A $5 bond in test USDC plus gas to register; gas to deregister. Deregistering
releases the bond in full; withdraw it after 2 days with `withdrawMinerBond()`.
Nothing is ever slashed.

## Tips for building a good evaluator adapter

- **Check the class first:** `GET /engine/v1/intents/<intent>`. A `deterministic`
  intent takes no adapter. Register on the parent family, not on a child.
- **Ordering:** the test is ordering. On every pair your model should score
  the better answer above the worse one. A model that gives everything the same
  score wins nothing.
- **Families:** a family module has to hold up on each child, not just on
  average. Train and check it on every child you expect it to serve.
- **Margins:** a small improvement isn't enough to replace a current module. Aim
  to clear it by more than 2 points on material you haven't trained on.

Good luck!
