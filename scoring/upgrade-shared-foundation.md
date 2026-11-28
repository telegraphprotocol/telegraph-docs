---
description: Move existing adapter work to the supported 512-token MiniCheck foundation.
---

# Upgrading to the Shared Foundation Model

The supported participant workflow uses **MiniCheck-DeBERTa-v3-Large**, **512 tokens**, and `lora-v2` safetensors deltas. Download the [MiniCheck 512 release](https://github.com/telegraphprotocol/telegraph-foundation/releases/tag/minicheck-deberta-v3-large-512-v1) and follow [Train an Evaluator Adapter](train-a-scoring-adapter.md).

## Adapter authors

Train a compatible MiniCheck checkpoint with attention LoRA and a saved two-class classifier. Export it against the released `foundation.json`, then validate and smoke-score the actual file with the kit. Older ModernBERT checkpoints and `lora-v1` packages are incompatible; changing metadata cannot convert them.

## Runnable executor operators

Build the current kit's `cmd/adapterexec`. Run your exported delta with the exact released manifest, model files and engine. Follow the training guide's environment block and batch endpoint instructions. Verify the complete batch on your deployment hardware before registering.

## Node operators

`FOUNDATION_MODEL_PATH` points to `foundation.json`; `FOUNDATION_MODEL_HASH` is SHA-256 of those manifest bytes. Keep the manifest, graph, external weights and tokenizer together. Verify the release's `SHA256SUMS` and use the compatible engine. The runtime holds one shared weight set; `FOUNDATION_LANES` controls scoring lanes. The retired `FOUNDATION_POOL_SIZE` and `FOUNDATION_INTERRUPT` settings must be removed.

A foundation change requires matching adapters and compatibility revalidation. Preserve rollback artifacts and verify actual completed model rankings after an operator-authorized upgrade. This documentation update does not itself change the running node.

## Miners and evaluation-data contributors

You do not need to build an evaluator to contribute miner answers or evaluation data. Continue using the documented request and evaluation-data APIs.
