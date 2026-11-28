---
description: Train and export a MiniCheck LoRA delta for the pinned shared scoring foundation.
---

# Train an Evaluator Adapter

A judgment or hybrid evaluator is a **safetensors LoRA delta package** for the shared MiniCheck-DeBERTa-v3-Large foundation. Submit the trained attention deltas and two-class head. The node supplies the immutable base weights and WASM engine; you do not bake them into your artifact.

See [Current Scoring Models](current-models.md) for the verified deployment and pinned hashes. Beta3 currently accepts inputs up to **512 tokens**. The old ModernBERT training, ONNX merge and `adapterbuild` full-model WASM recipe does not produce a compatible artifact.

## 1. Prepare preference pairs

Collect the task, a better answer and a worse answer for the target intent. Keep evaluation data separate from training data. For a family, include representative children and report held-out results for each child. Use the node's judgment rendering (`### Task:\n{prompt}\n\n### Answer:\n{answer}`) and its pinned MiniCheck tokenizer, including special tokens and truncation behavior. Keep the closing separator when truncating.

Do not invent training metrics or infer hidden qualification material. A successful export is a packaging check, not evidence that an adapter improves ranking.

## 2. Train a compatible checkpoint

Use `lytang/MiniCheck-DeBERTa-v3-Large` at revision `2f2d01a54fa022a7ffadb76260e1ea8bc88c82bb`. Train plain PEFT LoRA with rank **1–16**, one rank and alpha, on a non-empty subset of:

| PEFT target | Package target |
|---|---|
| `query_proj` | `attn.query` |
| `key_proj` | `attn.key` |
| `value_proj` | `attn.value` |
| `attention.output.dense` | `attn.out` |

Save the fully trained two-class `classifier` using `modules_to_save=["classifier"]`. The foundation has 24 layers and hidden size 1024. DoRA, rsLoRA, rank/alpha patterns and other fully trained modules cannot be represented by this exporter and are refused. Do not relabel a ModernBERT checkpoint.

Validate that better answers receive higher `logit[1] - logit[0]` scores on held-out pairs. Record the exact base revision, data versions, training parameters, tokenizer hash and context length. This page does not prescribe an unverified trainer command or promise that the previous public kit has migrated to MiniCheck.

## 3. Export the delta

The node source contains the current exporter at `tools/minicheck/export_adapter.py`. Run it in an environment with PEFT checkpoint files, NumPy, safetensors, and the exact approved `foundation.json`:

```bash
python tools/minicheck/export_adapter.py \
  --peft runs/CODE_REVIEW/adapter \
  --manifest artifacts/foundation.json \
  --class judgment \
  --intent CODE_REVIEW \
  --version minicheck-deberta-v3-large \
  --max-tokens 512 \
  --out artifacts/CODE_REVIEW.safetensors
```

Use `--class hybrid` only for a hybrid intent. The manifest must match the validator's approved foundation byte for byte. The command writes the LoRA matrices, scoring head and compatibility metadata into one safetensors file. It does not merge the delta into the base model, produce executable WASM, or register the artifact.

The exporter is in the node repository. Contributors without access need a maintainer-provided compatible exporter, manifest and runner before this workflow is reproducible; do not fall back to the retired full-model kit instructions.

## 4. Inspect and test the package

The safetensors `__metadata__` string map contains `format_version="2"`, `abi="lora-v2"`, `class`, `intent`, `foundation_hash`, `foundation_version`, `tokenizer_hash`, `rank`, `alpha`, `target_modules`, and `max_tokens`. Optional `training` carries a self-reported training record.

All tensors are F32. For each trained target and layer, A is `[in,rank]` and B is `[rank,out]`; `head.weight` is `[1024,2]` and `head.bias` is `[2]`. The exporter transposes PEFT tensors into this layout. The default package download limit is 64 MiB. The deployed rank-8 query/value GENERIC package is about 3.16 MB; size depends on rank and trained targets.

Test the actual exported delta on the exact pinned engine, foundation and tokenizer. Compare its pair ordering and score bits with your training implementation, and benchmark the complete runnable validation batch. Raising `max_tokens` alone does not qualify an adapter or foundation for a longer context.

## 5. Host, register and qualify

Host the immutable `.safetensors` bytes and a compatible batch runnable endpoint. Compute Ethereum **Keccak-256** of the artifact, then use the existing `registerWasm` flow described in [Build an Evaluator Adapter](build-a-scoring-module.md). The URL and hash refer to the safetensors artifact; historical API field names still say WASM.

The runnable endpoint must use the same foundation, engine, tokenizer and delta, preserve the batch score-bit contract and echo the requested score identity. A legacy `ADAPTER_WASM` runner cannot establish compatibility. Do not register until the runner supports `lora-v2` and has passed a real batch smoke check.

The node validates the artifact and compares it with the incumbent on hidden evaluation pairs. Passing local training checks, building a file, or registering on-chain does not make it canonical. See [competition on the hidden evaluation pool](build-a-scoring-module.md#stage-2-for-model-adapters-competition-on-the-hidden-evaluation-pool).
