---
description: Train an Evaluator adapter for a judgment or hybrid intent, export it as a safetensors delta for the shared Foundation Model, check it, host it, register it, and know what the node checks.
---

# Train an Evaluator Adapter

An **Evaluator adapter** is the scoring module for a judgment or hybrid intent: a small
AI model that reads a question and a miner's answer and scores how good the answer is.

Every validator runs **one shared Foundation Model** (ModernBERT-base with a reward head,
loaded once). Your adapter is only what you trained on top of it: the **LoRA deltas and
the reward head, in a safetensors file of a few MB**. The validator applies them to the
Foundation Model at score time. This page takes you from example data to a registered
adapter:

| Step | What you do | What you get |
|---|---|---|
| 1. Prepare data | Collect questions, each with a better and a worse answer | `pairs.jsonl` |
| 2. Train | Fine-tune a LoRA on your pairs | a PEFT adapter folder and `reward_head.pt` |
| 3. Export the delta | Write the LoRA deltas and reward head for the Foundation Model, never merged | `<INTENT>.safetensors` |
| 4. Check and package | Check it the way a node will and get its hash | the keccak256 to register |
| 5. Host and run the executor | Upload the file; serve it at your runnable URL | `wasmUrl`, `wasmRunnableUrl` |
| 6. Register and compete | Call `registerWasm`, then the node checks and competes it | Active, or a rejection reason |

> **Full-model `.wasm` adapters are no longer accepted.** The earlier format, one ~600 MB
> `.wasm` with the model and its engine baked in, is rejected with `legacy_full_model`.
> If you have one, export the delta from its training run (step 3) and register again; see
> [Upgrading to the Shared Foundation Model](upgrade-shared-foundation.md).

If your intent is deterministic (a price, a rate, a yes/no fact), you don't need any of
this: deterministic intents use a comparator module instead. See
[Comparator modules](build-a-scoring-module.md#comparator-modules-deterministic-intents).

## What you need

- The **adapter kit**,
  [telegraph-wasm-baseline](https://github.com/telegraphprotocol/telegraph-wasm-baseline).
  Every tool used below is in it.

  ```bash
  git clone https://github.com/telegraphprotocol/telegraph-wasm-baseline.git
  cd telegraph-wasm-baseline
  python -m pip install -r requirements.txt
  ```
- **Python 3.10+**, for training and export. `requirements.txt` installs `torch`,
  `transformers`, `peft` and the rest. For GPU training, install a CUDA build of `torch`
  first (see [pytorch.org](https://pytorch.org/get-started/locally/)).
- **Go 1.25+**, for the check.
- **A GPU** for training. Training works on a CPU, but it is very slow. Export and the
  check run in seconds on a CPU.
- **`foundation.json`** for the Foundation Model validators run: a small file with its
  hash, version, tokenizer hash and LoRA layout. The Foundation Model file itself
  (`foundation_lora_fp32.onnx`, ~599 MB) is only needed to score your package locally and
  to run your executor. Download both, with the engine, the pinned `tokenizer.json` and
  `SHA256SUMS`, from the [`modernbert-base-lora16-v1` release](https://github.com/telegraphprotocol/telegraph-foundation/releases/tag/modernbert-base-lora16-v1) of
  [telegraph-foundation](https://github.com/telegraphprotocol/telegraph-foundation), and
  check the hashes:

  ```bash
  mkdir -p foundation && cd foundation
  curl -fLO https://github.com/telegraphprotocol/telegraph-foundation/releases/download/modernbert-base-lora16-v1/foundation.json
  curl -fLO https://github.com/telegraphprotocol/telegraph-foundation/releases/download/modernbert-base-lora16-v1/SHA256SUMS
  sha256sum -c --ignore-missing SHA256SUMS
  ```

  Use the released files, not a foundation you export yourself with `export_foundation.py`:
  a local export is not guaranteed to have the same hash, and a package built against a
  different hash is rejected (`foundation_mismatch`).

Run every command from the root of the kit.

## Public build inputs

The public inputs to this workflow are the adapter kit, the public
`answerdotai/ModernBERT-base` base model and its tokenizer, the published Foundation
Model, and training data you are entitled to use. The node supplies canonical tokens when
it scores the finished adapter; it accepts up to 512 tokens.

You do not need the current canonical evaluator's fine-tuned checkpoint or unpublished
evaluation cases. They are intentionally outside the public build interface and are not
needed to build, submit or compete with an adapter.

If an AI assistant helps with this workflow, keep it within that boundary: it should use
the public kit and public base model, then train on your data. It should not request,
infer, scrape or rely on unpublished evaluator weights or evaluation material. The node
performs the competition after submission.

## Step 1: Prepare your data

The adapter learns from **preference pairs**: a question, a better answer and a worse
answer. Put one pair per line in a JSONL file:

```json
{"prompt": "Review this function: def add(a, b): return a - b", "chosen": "Bug: the function subtracts instead of adding. It should return a + b.", "rejected": "Looks good to me."}
```

| Field | Required | Meaning |
|---|---|---|
| `prompt` | Yes | The question or task, as a user would ask it |
| `chosen` | Yes | The better answer |
| `rejected` | Yes | The worse answer to the same question |
| `margin` | No | How much better `chosen` is, as a number (default `0`) |
| `label_kind` | No | If present, it must be `preference_pair`; other rows are skipped |

This is the same row format the [evaluation pool](contribute-evaluation-data.md) accepts,
so the same file can be used for both.

**For a hybrid intent,** `prompt` is the question the miner was asked, and `chosen` and
`rejected` are whole miner responses, because that is what the node gives the adapter to
score.

**For an intent family** (one adapter serving `WEATHER_FORECAST`,
`WEATHER_FORECAST_LAHORE` and so on), train on pairs from the children too. The
competition tests the adapter on every child's material. See
[Families](build-a-scoring-module.md#families-one-module-for-many-intents).

### What makes good data

The training script refuses data that a shortcut can solve, because a model trained on it
passes its own test and then scores real answers at random. Your data must pass these
checks:

| Check | Limit | What it catches |
|---|---|---|
| Unique worse answers | At least 80% of `rejected` answers are different | Reusing a few stock bad answers ("Looks good to me."), which the model just memorises |
| Most-repeated worse answer | No single `rejected` answer in more than 2% of pairs | The same thing, for one answer |
| Same answer twice | No more than 1% of pairs where `chosen` equals `rejected` | Pairs that teach nothing |
| Length | "Pick the longer answer" (or the shorter one) is right at most 65% of the time | A model that learns "longer is better" |
| Leakage | At most 10% of held-out worse answers also appear in training | A test that measures memory instead of judgement |
| Surface style | A simple word-count model, **without seeing the question**, tells better from worse at most 65% of the time | Bad answers that all share a style (short, vague, templated) the model can spot without understanding the task |

In practice: write worse answers that are **plausible but wrong**, different from each
other, and about as long as the better answers.

## Step 2: Train

```bash
python -m float_runtime.train_adapter \
  --intent CODE_REVIEW --data pairs.jsonl --out runs/CODE_REVIEW
```

To check your data without training (fast, no GPU needed), add `--check-data`.

The script:

1. checks your data against the table above and stops if it fails;
2. holds out 15% of the pairs for testing (or uses `--val-data` if you give one);
3. fine-tunes [ModernBERT-base](https://huggingface.co/answerdotai/ModernBERT-base) with a
   LoRA adapter and a one-number reward head, keeping the best epoch;
4. tests the result on the held-out pairs.

The test passes when the model prefers the better answer in at least **65%** of held-out
pairs **and** beats "pick the longer answer" by at least **10 points**.

| Exit code | Meaning |
|---|---|
| `0` | Passed. The adapter is in `runs/<INTENT>/adapter` with `reward_head.pt`, and the next commands are printed. |
| `1` | The data check or the test failed. The reason is printed. |
| `2` | An error, such as a missing file or the GPU running out of memory. |

Results are also written to `runs/<INTENT>/result.json`, with the base model's and the
tokenizer's sha256.

Passing here doesn't mean your adapter will be accepted. It is a minimum. The node decides
with its own hidden test, and your adapter has to beat the current one there (see
[Step 6](#step-6-register-and-compete)).

### Options you may want

| Option | Default | Notes |
|---|---|---|
| `--val-data`, `--test-data` | none | Your own validation and final-test files, instead of a random 15% |
| `--hf-dataset` | none | Train from a Hugging Face dataset with prompt/chosen/rejected columns instead of `--data` |
| `--epochs` | `3` | Training stops early when it stops improving |
| `--lr` | `0.0001` | Learning rate |
| `--grad-accum` | `16` | Lower it on a small dataset; raise it if you run out of GPU memory |
| `--lora-rank`, `--lora-alpha` | `8`, `32` | The rank must be at most **16** |
| `--max-length` | `512` | Tokens per question and answer. The node scores up to 512. If you train shorter, export with the same number as `--max-tokens`. |
| `--config` | none | A YAML or JSON file with any of the settings |

Run with `--help` for the full list. If you train with your own code instead, the LoRA must
be plain PEFT LoRA on ModernBERT-base: rank at most 16, `target_modules` among `Wqkv`,
`Wo` and `Wi`, one `lora_alpha` (no `rank_pattern`, `alpha_pattern`, rsLoRA or DoRA).

## Step 3: Export the delta

This step writes your LoRA deltas and reward head as one **safetensors** file for the
Foundation Model. It never merges them into the base weights:

```bash
python -m float_runtime.export_adapter \
  --run runs/CODE_REVIEW --intent CODE_REVIEW --class judgment \
  --foundation foundation/foundation.json
```

- `--intent` is the **prefix** (family) the adapter serves, the same one you will
  register on.
- `--class` is the intent's class: `judgment` or `hybrid`.
- `--max-tokens N` if you trained shorter than 512 tokens.
- `--adapter <dir>` instead of `--run`, for a PEFT adapter trained elsewhere.

It writes `runs/CODE_REVIEW/CODE_REVIEW.safetensors` (6.8 MB at rank 8, 13.5 MB at rank
16) in seconds on a CPU. It refuses a run trained on another base model or tokenizer.

## Step 4: Check and package

```bash
go run ./cmd/adapterbuild lora \
  --intent CODE_REVIEW \
  --package runs/CODE_REVIEW/CODE_REVIEW.safetensors \
  --foundation foundation/foundation.json
```

`adapterbuild lora`:

- looks up whether the intent is judgment or hybrid, and refuses deterministic intents;
- runs the node's own Stage 1 parser on the package against `foundation.json`: the
  foundation and tokenizer hashes, the class, the rank, the target modules, every tensor's
  shape, the offsets, the size and that every value is finite;
- with `--foundation-onnx foundation_lora_fp32.onnx --engine foundation_engine.wasm`,
  loads the package on the Foundation Model through the node's runtime and scores an input
  twice, requiring the same bits both times;
- writes a manifest next to the package and prints one JSON line:

```json
{"intent":"CODE_REVIEW","class":"judgment","keccak256":"0x…","sha256":"…","bytes":6776908,"package_path":"runs/CODE_REVIEW/CODE_REVIEW.safetensors","manifest_path":"runs/CODE_REVIEW/CODE_REVIEW.safetensors.manifest.json",…}
```

The `keccak256` value is the hash you register. Nothing is rewritten: it is the hash of the
file `export_adapter` wrote. A local pass is not acceptance: the node's checks and the
competition still decide.

## Step 5: Host the file and run the executor

1. Upload the `.safetensors` file unchanged to an `https://` or `ipfs://` URL. Nodes
   download it within 120 seconds and check its keccak256; a host that re-encodes the file
   breaks the match.
2. Run your **runnable-URL executor**: an endpoint that runs your package on the same
   Foundation Model and engine the validators run, and answers the node's batch request,
   echoing the score identity. The contract is in
   [The runnable endpoint](build-a-scoring-module.md#the-runnable-endpoint). Its scores must
   be the exact bits the validators compute, so run the same foundation, engine and package.
   The kit's [`cmd/adapterexec`](https://github.com/telegraphprotocol/telegraph-wasm-baseline/tree/main/cmd/adapterexec) is the reference executor.
   Serve it at a public `https://` URL and give it at least 5 GB of RAM.

## Step 6: Register and compete

1. Register with `registerWasm(keccak256, url, prefix, feeAddress, runnableUrl)` and the
   $5 adapter bond in MACHINA. See
   [Registering directly](build-a-scoring-module.md#registering-directly).
2. The node checks it, in this order:
   1. **Remote check.** After the next confirmed epoch, and once the intent has public
      evaluation material, the node sends your runnable URL 15 public pairs (up to 30
      texts) in one request. Your executor must echo the identity and order at least 70% of
      the pairs correctly.
   2. **Download and Stage 1.** The node downloads the package, checks its hash and runs the
      rules in [What the node checks](#what-the-node-checks).
   3. **Confirmation.** It scores the same 30 texts itself; every score must equal your
      executor's, bit for bit.
   4. **Competition** on the intent's hidden evaluation pool. Your adapter replaces the
      current one only if it wins by at least 2 points and scores at least 70%. See
      [Stage 2 for model adapters](build-a-scoring-module.md#stage-2-for-model-adapters-competition-on-the-hidden-evaluation-pool).
3. **Expect one to two hours on the testnet.** The node sees your transaction about 10 to
   15 minutes after it is mined, then waits for the next confirmed epoch (1 hour on the
   testnet). On a laptop CPU one 512-token text takes about 13-14 seconds on the
   Foundation Model: the remote check is several minutes on your executor, the
   confirmation the same again on the validator, and the hidden round (60 texts) about
   twice as long. On the testnet the checks after the epoch take about 30 to 60 minutes.

Follow it with
[Checking your module's status](build-a-scoring-module.md#checking-your-modules-status);
every rejection and its fix is in
[Rejection reasons for Evaluator adapters](build-a-scoring-module.md#rejection-reasons-for-evaluator-adapters).

## What the node expects

Use the tools above to produce the package. If you build your own tooling, it must match
the contract below exactly.

### The model and its input

| Rule | Value |
|---|---|
| Foundation Model | ModernBERT-base (22 layers, hidden size 768) as one ONNX graph whose LoRA branches and reward head are graph inputs, identified by its sha256 |
| Tokenizer | ModernBERT's `tokenizer.json`, sha256 `67bc76f8b9386efba1a761c1c8e5ad439fd0eaf1c2826e9dd1a205c7af4dc456`: `[CLS]` (id `50281`) and `[SEP]` (id `50282`) added |
| Input text | `### Task:\n` + question + `\n\n### Answer:\n` + answer. For a hybrid intent the question is the request sent to the miner and the answer is the miner's whole response |
| Input length | Up to 512 tokens, or the adapter's `max_tokens` if lower; the closing `[SEP]` is always kept. Every text is scored at its own length, with no padding |
| Output | One number, the reward logit. A better answer should get a higher number |

### The package

A standard safetensors file (`u64` little-endian header length, a JSON header, the raw
tensor bytes). The header's `__metadata__` map holds the package fields, every value a
string:

| Key | Rule |
|---|---|
| `format_version` | `"1"` |
| `abi` | `"lora-v1"` |
| `class` | `"judgment"` or `"hybrid"`, the class of the intent you register for |
| `intent` | the prefix the adapter serves |
| `foundation_hash`, `foundation_version` | the Foundation Model validators run |
| `tokenizer_hash` | the tokenizer above |
| `rank` | 1 to 16 (`R_MAX`) |
| `alpha` | a positive number; the LoRA scale is `alpha / rank` |
| `target_modules` | a JSON array of `Wqkv`, `Wo` and `Wi`, each at most once |
| `max_tokens` | 1 to 512 |
| `training` | optional: a self-reported training record as a JSON string; shape-checked, never used for a decision |
| `x-*` | optional extension keys, ignored. Any other key is refused |

The tensors, all `F32`, tiling the data exactly in order with nothing left over (178 for
ModernBERT-base):

| Tensor | Shape |
|---|---|
| `lora.<l>.attn.Wqkv.A`, `.B` | `[768, r]`, `[r, 2304]` |
| `lora.<l>.attn.Wo.A`, `.B` | `[768, r]`, `[r, 768]` |
| `lora.<l>.mlp.Wi.A`, `.B` | `[768, r]`, `[r, 2304]` |
| `lora.<l>.mlp.Wo.A`, `.B` | `[1152, r]`, `[r, 768]` |
| `head.weight` | `[768, 1]` |
| `head.bias` | `[1]` |

`l` is the layer, 0 to 21, and `r` the rank. `B` is stored pre-transposed. Every value must
be a finite number. A package may be at most **64 MiB** (a node setting); a rank-8 package
is 6.8 MB.

### What the node checks

At Stage 1 and again when it loads the package, with no fallback, the node checks every
rule above against **its own** Foundation Model and tokenizer. Each failure is a rejection
with a reason name: `foundation_mismatch`, `tokenizer_mismatch`, `class_mismatch`,
`rank_too_large`, `bad_target_module`, `bad_shape`, `bad_dtype`, `bad_offsets`,
`trailing_bytes`, `truncated`, `non_finite`, `too_large`, `bad_max_tokens`,
`training_record`, `bad_header`, `bad_abi`, `bad_version`, `bad_container`,
`missing_metadata`, and `no_foundation` on a validator that runs no Foundation Model. Each
one and its fix is in
[Rejection reasons for Evaluator adapters](build-a-scoring-module.md#rejection-reasons-for-evaluator-adapters).

### Determinism

Every validator runs the same Foundation Model file, the same engine module (WebAssembly,
32-bit floats, no fused multiply-add, the graph's own operation order, one thread) and the
same package, in a fixed sandbox: no files, an empty environment, a frozen clock, a fixed
random stream and no network. A score is identified by the foundation hash, your package's
keccak256, the tokenizer hash and the input. The same package and tokens give the same bits
on repeat and next to other adapters; bit identity across different CPUs is not claimed
here.

### How the output becomes a score

The node never does arithmetic on the float itself. It keeps the 32 bits and:

- **ranks** answers by comparing them in exact numeric order;
- turns them into a **score from `0` to `10000`** (100.00%) with a sigmoid computed in
  whole-number arithmetic, for display and for the hybrid combination.

For a hybrid intent, the node combines that score with the comparator's score itself; the
adapter only judges the answer. Your model should simply give a higher number to a better
answer.
