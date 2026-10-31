---
description: The shared Foundation Model replaces full-model float adapters. What each participant must do, by when, how to check it worked, and what you see if you don't.
---

# Upgrading to the Shared Foundation Model

Evaluator adapters for judgment and hybrid intents used to be one large `.wasm` file
(about 600 MB) with the whole model baked in. From this release, every validator runs
**one shared Foundation Model** (ModernBERT-base, loaded once), and an Evaluator adapter
is a **safetensors delta package**: a few MB of LoRA deltas and a reward head that the
validator applies to the Foundation Model at score time.

**Full-model float `.wasm` adapters are no longer accepted.** A new registration of one
is rejected with `legacy_full_model`, and an adapter already Active in that format stops
serving as soon as a validator starts the new release. There is no conversion: the
adapter has to be exported again as a delta and registered again.

Deploy date: **&lt;DEPLOY DATE&gt;** (to be announced).

| Who | Must do | By when |
|---|---|---|
| [Adapter authors](#adapter-authors) | Export the delta from your training run, register it again | At deploy: your old adapter stops serving then |
| [Runnable-URL executor operators](#runnable-url-executor-operators) | Run the Foundation Model with the delta, echo the score identity | Before the new registration |
| [Validators and node operators](#validators-and-node-operators) | Install the foundation files, set the environment, apply migrations, size RAM | Before starting the new binary |
| [Evaluation-data contributors](#evaluation-data-contributors) | Nothing | — |
| [Miners](#miners) | Nothing (ranking of model intents pauses until a new adapter is Active) | — |
| [App and API users](#app-and-api-users) | Nothing | — |

## Adapter authors

**What changes.** Your adapter is now the LoRA delta and reward head only, in a
safetensors file, built for the Foundation Model's hash and the pinned tokenizer. When a
validator upgrades, an Active full-model adapter is marked `superseded` and never restored
(its intent publishes no model ranking until a delta adapter passes the gate). A full-model
`.wasm` registered after the upgrade is rejected with:

```
structural validation failed: legacy_full_model: full-model float adapters are no longer accepted; repackage the adapter as a safetensors delta for the shared Foundation Model and re-register it
```

**What to do.**

1. **Find your training run.** You need the PEFT LoRA checkpoint your adapter was trained
   from (the `adapter/` folder `train_adapter` wrote; the reward head is read from it, or
   from `reward_head.pt` next to it). No retraining is needed. If you no longer have it,
   [retrain](train-a-scoring-adapter.md#step-2-train): a full-model `.wasm` cannot be
   converted back into a delta.
2. **Export the delta** with the adapter kit:

   ```bash
   python -m float_runtime.export_adapter --run runs/CODE_REVIEW --intent CODE_REVIEW \
     --class judgment --foundation foundation/foundation.json
   ```

   Pass `--max-tokens` if you trained shorter than 512 tokens. `foundation.json` names the
   Foundation Model validators run; download it from the [`modernbert-base-lora16-v1` release](https://github.com/telegraphprotocol/telegraph-foundation/releases/tag/modernbert-base-lora16-v1).
3. **Check it** the way a node will, and get the hash to register:

   ```bash
   go run ./cmd/adapterbuild lora --intent CODE_REVIEW \
     --package runs/CODE_REVIEW/CODE_REVIEW.safetensors --foundation foundation/foundation.json
   ```

4. **Host the `.safetensors` file** unchanged at an `https://` or `ipfs://` URL, and
   update your [runnable-URL executor](#runnable-url-executor-operators) to serve the new
   package.
5. **Register again** with `registerWasm(keccak256, url, prefix, feeAddress,
   runnableUrl)`: a new hash, the same intent prefix as before, and a new adapter bond
   ($5 in MACHINA). The old registration keeps its bond until you deregister it
   (`deregisterEntity(registrationId, 2)`), which releases it in full.

**By when.** As close to the deploy as you can. Until a delta adapter is Active, the
intent is not ranked. Registering before validators run the new release gets the
registration rejected by an old node, so register at or after the deploy.

**How to check it worked.** `GET /api/wasm/<registrationId>` moves from `pending` to
`active` (`stage: "canonical"`). Expect minutes, not seconds: the registration first
waits for the next confirmed epoch, then the remote check scores up to 30 texts at your
executor (about 10-15 s each on a laptop CPU), the validator downloads the package and
re-scores the same texts, and then the competition round on the hidden split scores 60
more texts. A local end-to-end run took about 21 minutes from registration to Active, on
top of the epoch wait. With no incumbent, the first adapter that reaches 70% becomes the
first canonical one (`decision: "first_canonical"`).

**What you see if you don't.** Your old registration reads `superseded`; the intent has no
canonical adapter and is not ranked. See
[Rejection reasons for Evaluator adapters](build-a-scoring-module.md#rejection-reasons-for-evaluator-adapters)
for every rejection and its fix.

## Runnable-URL executor operators

Every adapter registration needs a `wasmRunnableUrl`, and the node calls it before it
downloads the package.

**What changes.** The executor must run **the Foundation Model with your delta**, not a
full-model `.wasm`. Each batch request now carries the score identity, and the reply must
echo it:

```json
{"batch": [{"tokens": [50281, 4118, 17526, 27, 187, 18658, 436, 13814, 1818, 50282]}],
 "foundation_hash": "<sha256 of the validator's foundation graph>",
 "adapter_hash": "<the registered keccak256, lowercase hex, no 0x>",
 "tokenizer_hash": "<sha256 of the validator's tokenizer.json>",
 "input_root": "<sha256 binding the batch's token inputs>"}
```

```json
{"results": [{"score": 3204838382}],
 "foundation_hash": "<the foundation you scored with>",
 "adapter_hash": "<the keccak256 of the package you scored with>",
 "tokenizer_hash": "<that package's tokenizer hash>"}
```

**What to do.** Run the same Foundation Model file, the same engine module and your
registered package, and answer each item with the f32 bits of the score. Echo what you
actually ran, not what you were sent. The full contract is in
[The runnable endpoint](build-a-scoring-module.md#the-runnable-endpoint). A reference
executor that does this with the node's own runtime is the adapter kit's
[`cmd/adapterexec`](https://github.com/telegraphprotocol/telegraph-wasm-baseline/tree/main/cmd/adapterexec). The examples repository's
[`evaluator-adapter`](https://github.com/telegraphprotocol/telegraph-examples/tree/master/evaluator-adapter)
folder has a script that sends your endpoint the request a validator sends and checks the
reply.

**By when.** Before you register the new package: the check runs as soon as the next
epoch is confirmed.

**How to check it worked.** The registration passes the remote check: its
`rejection_reason` stays empty and the node downloads the package.

**What you see if you don't.**

| `rejection_reason` contains | Cause |
|---|---|
| `identity echo mismatch` | The executor echoed a different `foundation_hash`, `adapter_hash`, `tokenizer_hash` or `input_root`: it is not running the registered package on the validators' foundation. Rejected at once. |
| `its runnable URL did not echo the score identity` | No echo at all. Rejected after the download. |
| `remote score mismatch` | The validator re-scored the same text and got different bits: the executor ran something else (another engine, another runtime, another file). |
| `did not accept the batch request` | A `4xx`, or a `200` without `results`. |
| `gave up after 3 failed evaluation attempts: remote executor unreachable` | Unreachable, too slow (30 minutes for the whole check) or `408`/`429`/`5xx` three times. |

## Validators and node operators

**What changes.** The node loads the Foundation Model once at startup and scores every
adapter on it. A node without it scores no judgment or hybrid intent and rejects every
delta registration with `no_foundation`. All validators must run **the same foundation
hash**: an adapter is built for one hash and is rejected elsewhere
(`foundation_mismatch`).

**What to do, before starting the new binary.**

1. **Apply migrations `0029_foundation_models` and `0030_score_input_identity`.** The new
   binary reads their tables and columns; without them it cannot record the foundation and
   publishes no model ranking. Both are idempotent.
2. **Install the foundation files**: the ONNX graph (`foundation_lora_fp32.onnx`, about
   599 MB), the engine module (`foundation_engine.wasm`, about 2.6 MB), and ModernBERT-base's
   `tokenizer.json`. All three, with `foundation.json` and `SHA256SUMS`, are assets of the
   [`modernbert-base-lora16-v1` release](https://github.com/telegraphprotocol/telegraph-foundation/releases/tag/modernbert-base-lora16-v1); its
   [README](https://github.com/telegraphprotocol/telegraph-foundation#readme) has the
   download and verification commands. Check every file with `sha256sum -c SHA256SUMS`
   before you start the node. The hashes every validator must run:
   `FOUNDATION_MODEL_HASH=0a49b325304bb4cf292e683929689d0457966be264f60bfc94d0072b614bf8e6`,
   `FOUNDATION_ENGINE_WASM_HASH=77643d6e1176ab8744801cef93ccb844d0136ed32b8daa865d541f37d13292de`,
   `FOUNDATION_MODEL_VERSION=modernbert-base-lora16-v1`.
3. **Set the environment:**

   | Variable | Default | Meaning |
   |---|---|---|
   | `FOUNDATION_MODEL_PATH` | unset: no foundation | The ONNX graph. Needs `TOKENIZER_JSON`. |
   | `FOUNDATION_MODEL_HASH` | required with the path | sha256 of the graph. A mismatch refuses to start. |
   | `FOUNDATION_MODEL_VERSION` | `""` | A label, e.g. `modernbert-base-lora16-v1`. A change counts as a foundation update. |
   | `FOUNDATION_ENGINE_WASM_PATH` | required with the path | The engine module. |
   | `FOUNDATION_ENGINE_WASM_HASH` | required with the engine | sha256 of the engine. A mismatch refuses to start. |
   | `FOUNDATION_POOL_SIZE` | `clamp(min(cpus/4, (memory - 2 GiB) / 2 GiB), 1, 8)`; `1` when memory cannot be read | Workers, each a full copy of the foundation. 1 to 8. |
   | `FOUNDATION_INTERRUPT` | `watchdog` | How the score deadline is enforced (`loop` is about 4x slower; same bits). |
   | `FOUNDATION_DELTA_CACHE_MAX` | `16` | Adapters one worker keeps loaded. |
   | `FOUNDATION_DELTA_CACHE_BYTES` | `536870912` (512 MiB) | The same bound in bytes. |
   | `TOKENIZER_JSON` | `<HYBRID_WASM_DIR or JUDGMENT_WASM_DIR>/tokenizer.json` | Pinned by sha256 (`67bc76f8…dc456`). |
   | `ADAPTER_LORA_MAX_BYTES` | `67108864` (64 MiB; hard limit 1 GiB) | Largest delta package a registration may download. |
   | `ADAPTER_RAM_BUDGET_BYTES` | half of the machine's memory; `4GiB` when it cannot be read | RAM for adapters: the foundation counts once, each delta about 3x its package. |
   | `ADAPTER_SCORE_TIMEOUT` | `5m` | Longest one score may take. |
   | `WASM_REMOTE_EVAL_BUDGET` | `30m` | Time for an adapter's remote check. Keep it the same on every validator. |

4. **Size the RAM.** About **1.8 GB per foundation worker**, plus about three times the
   package per adapter loaded (about 20 MB for a 6.8 MB rank-8 delta). RAM grows with
   `FOUNDATION_POOL_SIZE`, not with the number of adapters. On a laptop CPU one 512-token
   score takes 13-14 s with one worker.

**How to check it worked.** At startup the log shows

```
Foundation Model loaded once for the process; every Evaluator adapter and every model score runs on it
```

with `foundation_hash`, `version`, `engine_hash`, `tokenizer_hash`, `instances`,
`r_max=16` and `layers=22`, followed by `hydrateWasms: Foundation Model recorded (first run
with one); it takes effect at the next epoch rollover`. The new foundation scores from the
first epoch rollover after the start. Compare `foundation_hash` with the other validators.

**What you see if you don't.**

- No foundation configured: `no Foundation Model configured (FOUNDATION_MODEL_PATH unset):
  no Evaluator adapter can score and no model ranking is published; delta-package
  registrations are rejected at Stage 1 (no_foundation)`. Adapters already Active are not
  restored on that node.
- A wrong hash, or a path without its hash: the node refuses to start (`Foundation Model
  refused to load`, `foundation file hash mismatch`, or `Foundation Model configuration is
  incomplete`).
- Migrations missing: `could not record the active Foundation Model (foundation_models)`,
  and no model ranking.
- Legacy adapters on the first start: `hydrateWasms: legacy full-model float adapters are
  no longer served; repackage them as safetensors deltas and re-register`. Expected: those
  intents are unranked until their authors register deltas.

**A later foundation update.** Restarting with a different `FOUNDATION_MODEL_HASH`,
`FOUNDATION_MODEL_VERSION` or tokenizer is a foundation update. Adapters built for the old
hash are marked `superseded` with `foundation_updated: …` and never score again; adapters
built for the new hash go back to `pending` and must pass the remote check and the gate
again. The epoch the change lands in publishes no model ranking. Every validator must
switch together.

## Evaluation-data contributors

**No change.** Preference pairs, truth sources, signed uploads and snapshots work as before,
and the competition still uses the hidden half of the pool. Your material scores the new
adapters the same way it scored the old ones. See
[Contribute Evaluation Data](contribute-evaluation-data.md).

## Miners

**No change** to registration, YAML or how you answer. One thing to know: **a judgment or
hybrid intent is not ranked while it has no Active delta adapter.** At the upgrade, intents
whose adapter was a full-model `.wasm` lose it, and they stay unranked (your previous
ranking is kept) until an adapter author registers a delta and it passes the gate.
Deterministic intents, scored by comparator modules, are not affected.

## App and API users

**No change** to asking, paying, jobs or subscriptions. The scoring-module reads
(`/api/wasm`, `/engine/validator/v1/wasm/…`) gain fields: a registration's evaluation
details carry the score identity (`foundation_hash`, `engine_hash`, `tokenizer_hash`,
`input_root`), and a `superseded` registration taken out of service by a foundation update
has `rejection_reason: "foundation_updated: …"`.
