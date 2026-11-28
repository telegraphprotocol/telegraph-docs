---
description: The supported 512-token MiniCheck foundation and the artifacts needed to build compatible evaluator adapters.
---

# Supported Scoring Model

The supported evaluator foundation is **MiniCheck-DeBERTa-v3-Large**, with a **512-token maximum**. Adapter authors, validators and runnable executors must use the same released artifacts.

[Download the MiniCheck 512 release](https://github.com/telegraphprotocol/telegraph-foundation/releases/tag/minicheck-deberta-v3-large-512-v1). [Build an adapter with the participant kit](https://github.com/telegraphprotocol/telegraph-wasm-baseline).

## Files you need

| File | Purpose |
|---|---|
| `foundation.json` | Manifest binding the exact model graph, external weights, tokenizer and input limit |
| `foundation.onnx` | Frozen model graph with LoRA/head inputs |
| `foundation.onnx.data` | External model weights; keep next to the graph |
| `foundation_engine.wasm` | Compatible shared WASM scoring engine |
| `tokenizer.json` | Pinned MiniCheck tokenizer |
| `SHA256SUMS` | Integrity checks for the files above |
| `THIRD_PARTY_NOTICES.md` | Model attribution and licensing references |

The kit's `scripts/download-foundation.sh` downloads and verifies these files. Do not re-export the base model: a re-export changes its identity and may produce incompatible scores.

## Compatibility

| Item | Required value |
|---|---|
| Base model | `lytang/MiniCheck-DeBERTa-v3-Large` |
| Base revision | `2f2d01a54fa022a7ffadb76260e1ea8bc88c82bb` |
| Foundation version | `minicheck-deberta-v3-large` |
| Input maximum | **512 tokens** |
| Adapter format | safetensors, `format_version="2"`, `abi="lora-v2"` |
| LoRA | Plain attention LoRA, rank 1–16 |
| Scoring head | Two classes; reward is `logit[1] - logit[0]` |

The foundation identity is SHA-256 of `foundation.json`: `675c4647469e021e184631ad5bf2b68ca518fcdc192100eee439a420a757300c`.

The engine SHA-256 is `7927d9c857e575ac21b3f2a7b6d5b2fa0d1af8f2c8dd68ef75078ff56ef9a5e8`. The tokenizer SHA-256 is `8bfb874b90f3b3ea9481289bf351eef77462f0935f526ea107f53789708cc5d4`.

These hashes establish compatibility, not model quality. Registration uses Ethereum **Keccak-256 of your final adapter file**, which the kit prints. Passing local checks does not replace the network's hidden qualification and competition.
