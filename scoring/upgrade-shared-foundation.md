---
description: Migrate retired model formats to MiniCheck lora-v2 and distinguish deployed from optimized foundation identities.
---

# Upgrading to the Shared Foundation Model

The main Beta3 node now runs `minicheck-deberta-v3-large`, a pinned MiniCheck-DeBERTa-v3-Large foundation, with `lora-v2` safetensors deltas. The previous ModernBERT `modernbert-base-lora16-v1` release is historical. Its graph, tokenizer, `lora-v1` packages and executor instructions are incompatible with the current foundation.

See [Current Scoring Models](current-models.md) for verified deployed hashes and the separate optimized Memory64 candidate. The [foundation repository](https://github.com/telegraphprotocol/telegraph-foundation) documents artifact identities and publication status. Do not assume the old release's download URLs contain MiniCheck files.

## Adapter authors

Train a compatible MiniCheck checkpoint with plain attention LoRA and a saved two-class classifier, then export using the exact approved foundation manifest. Follow [Train an Evaluator Adapter](train-a-scoring-adapter.md). A ModernBERT checkpoint cannot be converted by changing its metadata, and full-model WASM cannot replace a saved training checkpoint.

Host immutable safetensors bytes, compute their Ethereum Keccak-256, and register against the correct judgment or hybrid prefix. Passing export checks does not pass the hidden competition. Deterministic intents take no new adapter registration; existing comparators continue under the node's current rules.

## Runnable-URL executor operators

Use the exact foundation manifest, graph, external weights, engine and delta expected by validators. Implement the batch and score-identity contract in [The runnable endpoint](build-a-scoring-module.md#the-runnable-endpoint). Verify your runner supports `lora-v2`; a historical ModernBERT runner is not proof of compatibility.

## Validators and node operators

`FOUNDATION_MODEL_PATH` now points to the `tg-foundation-v3` manifest. `FOUNDATION_MODEL_HASH` is SHA-256 of those manifest bytes; the manifest pins graph, external weights and tokenizer separately. Hash-check all artifacts and preserve matching engine and node versions.

The shared foundation keeps one resident weight set with `FOUNDATION_LANES` scoring lanes. `FOUNDATION_POOL_SIZE` and `FOUNDATION_INTERRUPT` are retired and refuse startup. A Memory64 deployment requires a compatible binary/engine pair, appropriate RAM and migrations; increasing `FOUNDATION_MEMORY_MIB` alone does not convert wasm32.

Changing the foundation identity triggers adapter compatibility revalidation. Packages naming another foundation cannot serve on the new one. Preserve rollback artifacts and verify actual routing and completed model rankings after any future operator-authorized cutover.

This documentation update does not deploy the optimized foundation to Beta3.

## Evaluation-data contributors, miners and API users

The model artifact change does not require you to export a model. Continue using the documented evaluation-data and request APIs. Active registry status alone does not establish coverage or fresh rankings for every intent.
