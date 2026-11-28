---
description: Train, export, validate and serve a 512-token MiniCheck evaluator adapter.
---

# Train an Evaluator Adapter

Build one `lora-v2` safetensors delta for the shared MiniCheck foundation. [Supported Scoring Model](current-models.md) lists the released artifacts and compatibility requirements. Use the [participant kit](https://github.com/telegraphprotocol/telegraph-wasm-baseline) for every step below.

## Prerequisites

Use Linux x86_64 with Python 3.10+, Go 1.25.7+, a C compiler and Git. GPU training is recommended; export and WASM scoring can run on CPU. Allow sufficient RAM for the 435M-parameter foundation, runtime and training state; benchmark your executor before registration. The shared runtime uses CGO and pinned Wasmtime v51, linked by its Go module; a separately installed Wasmtime CLI is not required.

```bash
git clone https://github.com/telegraphprotocol/telegraph-wasm-baseline.git
cd telegraph-wasm-baseline
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
go build -o adapterbuild ./cmd/adapterbuild
go build -o adapterexec ./cmd/adapterexec
bash scripts/download-foundation.sh
```

For GPU training, install the appropriate CUDA-enabled PyTorch build for your system. The download script fetches and checks the released manifest, graph, external weights, engine and tokenizer into `foundation/`. Keep those files together.

## 1. Prepare preference pairs

Write `pairs.jsonl`, one object per line:

```json
{"prompt":"Review this function for correctness: ...", "chosen":"A precise review identifying the actual defect ...", "rejected":"An incorrect or incomplete review ..."}
```

Use representative examples for the target intent or family and separate held-out data. The trainer checks dataset quality, then checks held-out ordering accuracy. Use enough examples to pass those checks; the line above illustrates the format only.

## 2. Train

```bash
python -m float_runtime.train_adapter \
  --intent CODE_REVIEW --data pairs.jsonl --out runs/CODE_REVIEW
```

The base is pinned to `lytang/MiniCheck-DeBERTa-v3-Large` revision `2f2d01a54fa022a7ffadb76260e1ea8bc88c82bb`. Defaults train query/value LoRA at rank 8, alpha 16, and save the two-class `classifier`. Pairwise reward is `logit[1] - logit[0]`. The pinned tokenizer and judgment template match the node. Input length must be 1–512; rank must be 1–16. `--help` lists optimization and data options.

Training saves the PEFT checkpoint under `runs/CODE_REVIEW/adapter/` and a result record. A local training PASS does not qualify the adapter for network use.

## 3. Export

```bash
python tools/minicheck/export_adapter.py \
  --peft runs/CODE_REVIEW/adapter \
  --manifest foundation/foundation.json \
  --class judgment --intent CODE_REVIEW --max-tokens 512 \
  --out runs/CODE_REVIEW/CODE_REVIEW.safetensors
```

Use the intent's actual class (`judgment` or `hybrid`) and registered family prefix. The exporter accepts plain LoRA attention targets and a saved classifier; unsupported trained weights, DoRA, rsLoRA and rank/alpha patterns are refused. It never merges or includes the base weights.

## 4. Validate and smoke-score the actual package

```bash
./adapterbuild lora \
  --intent CODE_REVIEW \
  --package runs/CODE_REVIEW/CODE_REVIEW.safetensors \
  --foundation foundation/foundation.json \
  --score \
  --engine foundation/foundation_engine.wasm \
  --engine-hash 7927d9c857e575ac21b3f2a7b6d5b2fa0d1af8f2c8dd68ef75078ff56ef9a5e8
```

Without `--score`, the tool checks structure only. With `--score` and the released engine, the tool loads the real released model and scores twice, requiring identical bits. It prints one JSON object containing the artifact's Ethereum **Keccak-256**, SHA-256 and validation manifest. Register the Keccak-256 of the final safetensors bytes; NIST SHA3-256 is different.

## 5. Serve the runnable endpoint

```bash
export FOUNDATION_MODEL_PATH="$PWD/foundation/foundation.json"
export FOUNDATION_MODEL_HASH=675c4647469e021e184631ad5bf2b68ca518fcdc192100eee439a420a757300c
export FOUNDATION_MODEL_VERSION=minicheck-deberta-v3-large
export FOUNDATION_ENGINE_WASM_PATH="$PWD/foundation/foundation_engine.wasm"
export FOUNDATION_ENGINE_WASM_HASH=7927d9c857e575ac21b3f2a7b6d5b2fa0d1af8f2c8dd68ef75078ff56ef9a5e8
./adapterexec --package runs/CODE_REVIEW/CODE_REVIEW.safetensors --listen 127.0.0.1:8080
```

The service accepts `POST /runnable` with `{"batch":[{"tokens":[1,100,200,2]}]}` and returns one `score` per item as raw F32 bits. It also reports the actual foundation, adapter and tokenizer identity when requested, and computes the batch input root. Validators supply token IDs; the executor must score those IDs exactly.

Put it behind a public HTTPS reverse proxy and keep it available throughout validation. Test a complete batch on your real hardware. Validators compare its results with their own execution of the downloaded artifact.

## 6. Host and register

Host the immutable `.safetensors` file at an HTTPS or IPFS URL. Use its Keccak-256, the intent's registered prefix, your fee address and runnable URL in `registerWasm`. Follow the current [registration guide](https://docs.telegraphprotocol.com/docs/scoring/build-a-scoring-module#registering-directly) for network addresses, bond and transaction examples. Deterministic intents take no new model adapter.

Registration is followed by compatibility checks and hidden competition against the incumbent. A successful local build or an on-chain registration does not make an adapter Active.
