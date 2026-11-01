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

The testnet node runs the shared Foundation Model `modernbert-base-lora16-v1`. Full-model adapters registered there earlier no longer serve.

| Who | Must do | By when |
|---|---|---|
| [Adapter authors](#adapter-authors) | Export the delta from your training run, register it again | Now: your old adapter no longer serves |
| [Runnable-URL executor operators](#runnable-url-executor-operators) | Run the Foundation Model with the delta, echo the score identity | Before the new registration |
| [Validators and node operators](#validators-and-node-operators) | Run the shared Foundation Model files | Before scoring adapters |
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

**By when.** Now. Until a delta adapter is Active, the intent is not ranked by a model.
The testnet node already runs the Foundation Model, so a delta registered there is
checked as described below.

**How to check it worked.** `GET /api/wasm/<registrationId>` moves from `pending` to
`active` (`stage: "canonical"`). It takes a while: the node sees your transaction about
10 to 15 minutes after it is mined, the registration then waits for the next confirmed
epoch (1 hour on the testnet), the remote check scores up to 30 texts at your executor
(about 10-15 s each on a laptop CPU), the validator downloads the package and re-scores
the same texts, and then the competition round on the hidden split scores 60 more texts.
On the testnet, plan for one to two hours from your transaction to Active. With no
incumbent, the first adapter that reaches 70% becomes the first canonical one
(`decision: "first_canonical"`).

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
reply. Serve it at a public `https://` URL (validators refuse private and loopback
addresses and do not follow redirects), and give it at least 5 GB of RAM: with the
Foundation Model loaded it uses about 4.2 GB.

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

**What changes.** Every validator loads the shared Foundation Model once and scores every
adapter on it. All validators run **the same files**: an adapter is built for one
foundation hash and is rejected elsewhere (`foundation_mismatch`). A node without the
Foundation Model scores no judgment or hybrid intent and rejects every delta
registration with `no_foundation`.

**The files every validator runs.** All are assets of the
[`modernbert-base-lora16-v1` release](https://github.com/telegraphprotocol/telegraph-foundation/releases/tag/modernbert-base-lora16-v1);
its [README](https://github.com/telegraphprotocol/telegraph-foundation#readme) has the
download and verification commands. Check every file with `sha256sum -c SHA256SUMS`.

| File | sha256 |
|---|---|
| `foundation_lora_fp32.onnx` (about 599 MB) | `0a49b325304bb4cf292e683929689d0457966be264f60bfc94d0072b614bf8e6` |
| `foundation_engine.wasm` (about 2.7 MB) | `77643d6e1176ab8744801cef93ccb844d0136ed32b8daa865d541f37d13292de` |
| `tokenizer.json` (ModernBERT-base) | `67bc76f8b9386efba1a761c1c8e5ad439fd0eaf1c2826e9dd1a205c7af4dc456` |

The version label is `modernbert-base-lora16-v1`. Plan about 1.8 GB of RAM per
foundation worker, plus about three times the package size per adapter loaded (about
20 MB for a 6.8 MB rank-8 delta). The release README lists the node settings.

**A later foundation update.** A different foundation hash, version or tokenizer is a
foundation update. Adapters built for the old hash are marked `superseded` with
`foundation_updated: …` and never score again; adapters built for the new hash go back to
`pending` and must pass the remote check and the gate again. The epoch the change lands
in publishes no model ranking. Every validator must switch together.

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
