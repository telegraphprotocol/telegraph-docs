---
description: Train an evaluator adapter for a judgment or hybrid intent, bake it into the one .wasm file you register, and know what the node expects of it.
---

# Train an Evaluator Adapter

A **scoring adapter** is the scoring module for a judgment or hybrid intent: a
small AI model that reads a question and a miner's answer and scores how good
the answer is. You register it as **one `.wasm` file** that contains both the
model and the engine that runs it. This page takes you from example data to
that file:

| Step | What you do | What you get |
|---|---|---|
| 1. Prepare data | Collect questions, each with a better and a worse answer | `pairs.jsonl` |
| 2. Train | Fine-tune the model on your pairs | an adapter folder |
| 3. Export | Turn the trained adapter into one standard model file | `model_fp32.onnx` (about 600 MB) |
| 4. Bake | Build the model and its engine into one WebAssembly file | `baked.wasm` (about 574 MB) |
| 5. Package | Add the version label, check it the way a node will, get its hash | `<INTENT>.wasm` plus its keccak256 hash |

Then you host the `.wasm` and register it, as described in
[Build an Evaluator Adapter](build-a-scoring-module.md#how-to-submit-register-your-module).

If your intent is deterministic (a price, a rate, a yes/no fact), you don't need
any of this: deterministic intents use a comparator module instead. See
[Comparator modules](build-a-scoring-module.md#comparator-modules-deterministic-intents).

## What you need

- The **adapter kit**,
  [telegraph-wasm-baseline](https://github.com/telegraphprotocol/telegraph-wasm-baseline).
  Every tool used below is in it.

  ```bash
  git clone https://github.com/telegraphprotocol/telegraph-wasm-baseline.git
  cd telegraph-wasm-baseline
  pip install -r requirements.txt
  ```
- **Python 3.10+**, for training and export. `requirements.txt` installs
  `torch`, `transformers`, `peft`, `onnx` and the rest. For GPU training,
  install a CUDA build of `torch` first (see
  [pytorch.org](https://pytorch.org/get-started/locally/)).
- **Docker**, for the bake. If you can't use Docker, the bake also runs with
  Rust installed through [rustup](https://rustup.rs) (`--local`); see
  [Step 4](#step-4-bake).
- **Go 1.25+**, for the packaging step.
- **A GPU** for training. Training works on a CPU, but it is very slow. Export,
  bake and packaging run fine on a CPU.
- About **3 GB of free disk** per intent, and several GB of RAM for the bake.

Run every command from the root of the kit. On Windows, run the `bash` step from
Git Bash.

## Step 1: Prepare your data

The adapter learns from **preference pairs**: a question, a better answer and a
worse answer. Put one pair per line in a JSONL file:

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

This is the same row format the [evaluation pool](contribute-evaluation-data.md)
accepts, so the same file can be used for both.

**For a hybrid intent,** `prompt` is the question the miner was asked, and
`chosen` and `rejected` are whole miner responses, because that is what the node
gives the adapter to score.

**For an intent family** (one adapter serving `WEATHER_FORECAST`,
`WEATHER_FORECAST_LAHORE` and so on), train on pairs from the children too. The
competition tests the adapter on every child's material. See
[Families](build-a-scoring-module.md#families-one-module-for-many-intents).

### What makes good data

The training script refuses data that a shortcut can solve, because a model
trained on it passes its own test and then scores real answers at random. Your
data must pass these checks:

| Check | Limit | What it catches |
|---|---|---|
| Unique worse answers | At least 80% of `rejected` answers are different | Reusing a few stock bad answers ("Looks good to me."), which the model just memorises |
| Most-repeated worse answer | No single `rejected` answer in more than 2% of pairs | The same thing, for one answer |
| Same answer twice | No more than 1% of pairs where `chosen` equals `rejected` | Pairs that teach nothing |
| Length | "Pick the longer answer" (or the shorter one) is right at most 65% of the time | A model that learns "longer is better" |
| Leakage | At most 10% of held-out worse answers also appear in training | A test that measures memory instead of judgement |
| Surface style | A simple word-count model, **without seeing the question**, tells better from worse at most 65% of the time | Bad answers that all share a style (short, vague, templated) the model can spot without understanding the task |

In practice: write worse answers that are **plausible but wrong**, different
from each other, and about as long as the better answers.

## Step 2: Train

```bash
python -m float_runtime.train_adapter \
  --intent CODE_REVIEW --data pairs.jsonl --out runs/CODE_REVIEW
```

To check your data without training (fast, no GPU needed), add `--check-data`.

The script:

1. checks your data against the table above and stops if it fails;
2. holds out 15% of the pairs for testing (or uses `--val-data` if you give one);
3. fine-tunes [ModernBERT-base](https://huggingface.co/answerdotai/ModernBERT-base)
   with a LoRA adapter, keeping the best epoch;
4. tests the result on the held-out pairs.

The test passes when the model prefers the better answer in at least **65%** of
held-out pairs **and** beats "pick the longer answer" by at least **10 points**.

| Exit code | Meaning |
|---|---|
| `0` | Passed. The adapter is in `runs/<INTENT>/adapter`, and the next commands are printed. |
| `1` | The data check or the test failed. The reason is printed. |
| `2` | An error, such as a missing file or the GPU running out of memory. |

Results are also written to `runs/<INTENT>/result.json`.

Passing here doesn't mean your adapter will be accepted. It is a minimum. The
node decides with its own hidden test, and your adapter has to beat the current
one there (see [Step 6](#step-6-register-and-compete)).

### Options you may want

| Option | Default | Notes |
|---|---|---|
| `--val-data`, `--test-data` | none | Your own validation and final-test files, instead of a random 15% |
| `--hf-dataset` | none | Train from a Hugging Face dataset with prompt/chosen/rejected columns instead of `--data` |
| `--epochs` | `3` | Training stops early when it stops improving |
| `--lr` | `0.0001` | Learning rate |
| `--grad-accum` | `16` | Lower it on a small dataset; raise it if you run out of GPU memory |
| `--max-length` | `512` | Tokens per question and answer. The node scores up to 512, so train at 512. If you train shorter, pass the same number to the export and packaging steps as `--max-tokens` (the commands the script prints already do) |
| `--config` | none | A YAML or JSON file with any of the settings |

Run with `--help` for the full list.

## Step 3: Export

This step merges your adapter into the base model and saves it as one standard
**ONNX** model file, in normal 32-bit floating point:

```bash
python -m float_runtime.export_onnx --run runs/CODE_REVIEW
```

It writes `runs/CODE_REVIEW/model_fp32.onnx` (about 600 MB) and a
`sample_input.json` for the packaging step. Before finishing, it checks that the
exported file gives the same scores as the trained model at every input length
the node can send. A CPU is fine for this step.

## Step 4: Bake

This step builds the model **and** the engine that runs it into one
WebAssembly file. The engine is [oxionnx](https://crates.io/crates/oxionnx), an
ONNX engine written in Rust, and the model's weights are built into the file,
so the file needs nothing else to run.

```bash
bash float_runtime/bake_wasm.sh runs/CODE_REVIEW/model_fp32.onnx runs/CODE_REVIEW/baked.wasm
```

It writes `baked.wasm` (about 574 MB). It takes a few minutes and several GB of
RAM.

By default the bake runs in Docker with a pinned compiler, so **the same ONNX
file always gives the same `.wasm`, byte for byte, on any machine**. That lets
anyone rebuild your adapter from your ONNX file and check its hash. Without
Docker, add `--local` to bake with Rust installed through rustup. A local bake
is repeatable on the same operating system, but its bytes differ from a Docker
bake.

## Step 5: Package

This step turns the baked file into the `.wasm` you register:

```bash
go run ./cmd/adapterbuild --intent CODE_REVIEW --wasm runs/CODE_REVIEW/baked.wasm \
  --out runs/CODE_REVIEW --input runs/CODE_REVIEW/sample_input.json
```

`adapterbuild`:

- looks up whether the intent is judgment or hybrid, and refuses deterministic
  intents;
- adds the version label the node requires (the `telegraph.adapter` section,
  described below);
- builds the package twice and checks both copies are identical;
- runs the node's own registration checks on it, then loads it with the node's
  own runtime and scores the sample input twice, requiring the exact same
  result both times. It fails if a node would reject the package.

It writes `runs/CODE_REVIEW/CODE_REVIEW.wasm` and a manifest next to it, and
prints one JSON line:

```json
{"intent":"CODE_REVIEW","class":"judgment","keccak256":"0x…","sha256":"…","bytes":601882624,"wasm_path":"runs/CODE_REVIEW/CODE_REVIEW.wasm","score_hex":"0x…", …}
```

The `keccak256` value is the hash you register.

## Step 6: Register and compete

1. Upload the `.wasm` file somewhere the nodes can download it: an `https://`
   or `ipfs://` URL. Nodes must be able to fetch it within 30 minutes.
2. Register it with `registerWasm(keccak256, url, prefix, feeAddress, runnableUrl)`:
   the prefix is the family it scores, and the runnable URL is a hosted endpoint
   serving the same module that the node checks before it downloads your file.
   See
   [Registering directly](build-a-scoring-module.md#registering-directly).
3. The node checks the package, then puts it in a **competition** on the
   intent's hidden evaluation pool. It replaces the current adapter only if it
   wins by at least 2 points and scores at least 70%. See
   [Stage 2 for model adapters](build-a-scoring-module.md#stage-2-for-model-adapters-competition-on-the-hidden-evaluation-pool).

Check how it is doing with
[Checking your module's status](build-a-scoring-module.md#checking-your-modules-status).

## What the node expects

Use the tools above and all of this is handled for you. If you build your own
tooling, it must match exactly, because every validator must get the same score
to the last bit.

### The model and its input

| Rule | Value |
|---|---|
| Base model | ModernBERT-base, with a one-number scoring head, as a float32 ONNX graph |
| Tokenizer | ModernBERT's tokenizer: `[CLS]` (id `50281`) and `[SEP]` (id `50282`) added |
| Input text | `### Task:\n` + question + `\n\n### Answer:\n` + answer. For a hybrid intent the question is the request sent to the miner and the answer is the miner's whole response |
| Input length | Up to 512 tokens, or the adapter's `max_tokens` if lower; the closing `[SEP]` is always kept. Every text is sent at its own length, with no padding |

### The file

| Rule | Value |
|---|---|
| Kind | A WASI **command**: exports `_start` and one memory. A module exporting `_initialize` (a reactor) is refused |
| Imports | Only functions from `wasi_snapshot_preview1` on the node's allow-list (arguments, environment, clocks, random, file reads and writes, `path_open`, `proc_exit` and a few more). No sockets, no other import modules |
| Memory | One memory, at most 3 GiB |
| Size | At most 1 GiB by default (a node setting, hard maximum 2 GiB) |
| Version label | A `telegraph.adapter` custom section: `{"abi_version":2,"runtime":"onnx_f32","class":"judgment"}` (or `"hybrid"`, matching the intent), plus optional `max_tokens` (1–512) and `training`. Without it the file is refused. `abi_version` 1 is the retired Q32.32 format and is refused too |

### One score

For each score the node starts the file fresh (nothing carries over from one
score to the next) and runs it with:

- the arguments `baked /in/input.json 1`;
- one read-only folder, `/in`, holding `input.json`:

  ```json
  {"input_ids":[50281,4118,17526,27,187,18658,436,13814,1818,50282],"attention_mask":[1,1,1,1,1,1,1,1,1,1]}
  ```

- an empty environment, a frozen clock, a fixed random stream and no network.

The file must print **exactly one** line on standard output of the form

```
HEX         : 0x<8 hex digits>
```

holding the 32 bits of the model's output value (the reward logit). Anything
else on the line is ignored. A score fails, and never becomes a number, if the
file exits with an error, prints no HEX line or more than one, prints more than
16 KB, or the value is not a finite number.

### Why the result is the same on every validator

WebAssembly defines float arithmetic exactly, with no chip-specific shortcuts,
and the node fixes everything else the file could see (files, environment,
clock, randomness). So the same file and the same text give the same 32 bits on
every validator. This has been measured across repeated runs and across
different x86 machines; a check on ARM machines is still open.

### How the output becomes a score

The node never does arithmetic on the float itself. It keeps the 32 bits and:

- **ranks** answers by comparing them in exact numeric order;
- turns them into a **score from `0` to `10000`** (100.00%) with a sigmoid
  computed in whole-number arithmetic, for display and for the hybrid
  combination.

For a hybrid intent, the node combines that score with the comparator's score
itself; the adapter only judges the answer. Your model should simply give a
higher number to a better answer.
