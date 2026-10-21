---
description: Train an evaluator adapter for a judgment or hybrid intent, turn it into the one .wasm file you register, and know what the node expects of it.
---

# Train an Evaluator Adapter

A **scoring adapter** is the scoring module for a judgment or hybrid intent: a
small AI model that reads a question and a miner's answer and scores how good
the answer is. This page takes you from example data to the `.wasm` file you
register, in four steps:

| Step | What you do | What you get |
|---|---|---|
| 1. Prepare data | Collect questions, each with a better and a worse answer | `pairs.jsonl` |
| 2. Train | Fine-tune the model on your pairs | an adapter folder |
| 3. Convert | Turn the adapter into the node's fixed-point format | `<INTENT>.imwq` (about 1.2 GB) |
| 4. Package | Wrap the model and the node's interpreter into one file | `<INTENT>.wasm` plus its keccak256 hash |

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
- **Python 3.10+**. `requirements.txt` installs `torch`, `transformers`, `peft`
  and `numpy`. For GPU training, install a CUDA build of `torch` first (see
  [pytorch.org](https://pytorch.org/get-started/locally/)).
- **Go 1.25+**, for the packaging step.
- **A GPU** for training. Training works on a CPU, but it is very slow.
- About **5 GB of free disk** per intent: the converted model and the package
  are about 1.2 GB each.

Run every command from the root of the kit.

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
python -m wide_runtime.train_adapter \
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
| `0` | Passed. The adapter is in `runs/<INTENT>/adapter`, and the next two commands are printed. |
| `1` | The data check or the test failed. The reason is printed. |
| `2` | An error, such as a missing file or the GPU running out of memory. |

Results are also written to `runs/<INTENT>/result.json`.

Passing here doesn't mean your adapter will be accepted. It is a minimum. The
node decides with its own hidden test, and your adapter has to beat the current
one there (see [Step 5](#step-5-register-and-compete)).

### Options you may want

| Option | Default | Notes |
|---|---|---|
| `--val-data`, `--test-data` | none | Your own validation and final-test files, instead of a random 15% |
| `--hf-dataset` | none | Train from a Hugging Face dataset with prompt/chosen/rejected columns instead of `--data` |
| `--epochs` | `3` | Training stops early when it stops improving |
| `--lr` | `0.0001` | Learning rate |
| `--grad-accum` | `16` | Lower it on a small dataset; raise it if you run out of GPU memory |
| `--max-length` | `256` | Tokens per answer. The node only reads the first 256, so going higher trains on text that is never scored |
| `--config` | none | A YAML or JSON file with any of the settings |

Run with `--help` for the full list.

## Step 3: Convert

The node doesn't run normal (floating-point) models. It runs them in **Q32.32
fixed-point**, whole-number arithmetic that gives exactly the same result on
every validator. This step converts your adapter to that format:

```bash
python -m wide_runtime.convert_adapter \
  --base answerdotai/ModernBERT-base \
  --adapter runs/CODE_REVIEW/adapter \
  --out runs/CODE_REVIEW/CODE_REVIEW.imwq
```

It takes a few minutes and writes a file of about 1.2 GB.

## Step 4: Package

This step puts the converted model and the node's interpreter into **one
`.wasm` file**. That file is what you register, and its hash covers both.

```bash
go run ./cmd/adapterbuild --intent CODE_REVIEW \
  --imwq runs/CODE_REVIEW/CODE_REVIEW.imwq --out runs/CODE_REVIEW
```

`adapterbuild`:

- looks up whether the intent is judgment or hybrid, and refuses deterministic
  intents;
- uses the network's fixed interpreter for that class, so the same model always
  gives the same file and the same hash;
- builds the package twice and checks both copies are identical;
- loads the package the way a node would, and fails if the node would reject it.

It writes `runs/CODE_REVIEW/CODE_REVIEW.wasm` and a manifest next to it, and
prints one JSON line:

```json
{"intent":"CODE_REVIEW","class":"judgment","keccak256":"0x…","sha256":"…","bytes":1203456789,"wasm_path":"runs/CODE_REVIEW/CODE_REVIEW.wasm", …}
```

The `keccak256` value is the hash you register.

## Step 5: Register and compete

1. Upload the `.wasm` file somewhere the nodes can download it: an `https://`
   or `ipfs://` URL. Nodes must be able to fetch it within 30 minutes.
2. Register it with `registerWasm(keccak256, url, intent, feeAddress)`. See
   [Registering directly](build-a-scoring-module.md#registering-directly).
3. The node checks the package, then puts it in a **competition** on the
   intent's hidden evaluation pool. It replaces the current adapter only if it
   wins by at least 2 points and scores at least 70%. See
   [Stage 2 for wide adapters](build-a-scoring-module.md#stage-2-for-wide-adapters-competition-on-the-hidden-evaluation-pool).

Check how it is doing with
[Checking your module's status](build-a-scoring-module.md#checking-your-modules-status).

## What the node expects

Use the tools above and all of this is handled for you. If you build your own
tooling, it must match exactly, because every validator must compute the same
score to the last bit.

### The model and its input

| Rule | Value |
|---|---|
| Base model | ModernBERT-base, with a one-number scoring head |
| Tokenizer | ModernBERT's BPE tokenizer: text normalised to NFC, `[CLS]` (id `50281`) and `[SEP]` (id `50282`) added |
| Input length | 256 tokens at most; the closing `[SEP]` is always kept |
| Input text | `### Task:\n` + question + `\n\n### Answer:\n` + answer |
| Arithmetic | Q32.32 fixed point: 64-bit integers with 32 fractional bits, no floating point anywhere |
| Rules | No imports beyond what the interpreter declares, no clock, no randomness, no network, no state kept between calls |
| Memory | 32-bit WebAssembly, so the model and its working memory must fit in 4 GiB |

### The functions the package exports

A judgment package scores an answer with:

```
imwq_score(imw_ptr: i32, imw_len: i32, tok_ptr: i32, n_tokens: i32) -> i64
```

- `imw_ptr`/`imw_len`: where the model is in memory. `imwq_embedded()` returns
  it as `(ptr << 32) | len`.
- `tok_ptr`/`n_tokens`: the token ids, as little-endian `i64` values, written
  by the node through `imwq_alloc` and freed with `imwq_free`.
- Returns the model's raw output as a Q32.32 number (`value = result / 2^32`).
  The value `i64::MIN` means the package refused to score.

A hybrid package also exports:

```
imwq_score_hybrid(imw_ptr, imw_len, tok_ptr, n_tokens,
                  ground_truth_value: i64, miner_value: i64, spec_ptr: i32) -> i64
```

The true value comes before the miner's value, both on the intent's fixed-point
scale. `spec_ptr` points to ten `i64` values describing how the comparison and
the model's judgement are combined. It returns a score from `0` to `10000`, or a
negative number for an error.

The full list of required exports is in
[What the node checks](build-a-scoring-module.md#what-the-node-checks).

### How the output becomes a score

For a judgment package, the node turns the raw output into a score from `0` to
`10000` (100.00%): it applies a sigmoid in fixed point, then scales and clamps
the result. Your model should simply give a higher number to a better answer.
