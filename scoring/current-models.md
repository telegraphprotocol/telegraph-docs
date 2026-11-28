---
description: The deployed scoring foundation, tokenizer and adapter format, verified against Beta3 on 28 November 2026.
---

# Current Scoring Models

Verified against the main Beta3 node on **28 November 2026**.

| Item | Current deployment |
|---|---|
| Scoring foundation | `lytang/MiniCheck-DeBERTa-v3-Large` |
| Revision | `2f2d01a54fa022a7ffadb76260e1ea8bc88c82bb` |
| Foundation version | `minicheck-deberta-v3-large` |
| Manifest / layout | `tg-foundation-v3` / `lora-v2/deberta-v2` |
| Precision | F32 |
| Maximum input | **512 tokens** |
| Adapter | Safetensors LoRA delta, `format_version="2"`, `abi="lora-v2"` |
| Scoring head | Two classes; score is `logit[1] - logit[0]` |
| Runtime | Shared WASM foundation, one resident weight set with scoring lanes |

## Pinned identities

| Identity | SHA-256 |
|---|---|
| Foundation manifest | `675c4647469e021e184631ad5bf2b68ca518fcdc192100eee439a420a757300c` |
| Engine WASM | `7927d9c857e575ac21b3f2a7b6d5b2fa0d1af8f2c8dd68ef75078ff56ef9a5e8` |
| Tokenizer | `8bfb874b90f3b3ea9481289bf351eef77462f0935f526ea107f53789708cc5d4` |

The foundation identity hashes the manifest, which pins the separate ONNX graph, external weights and tokenizer. An adapter must name the exact foundation and tokenizer identities. Its registered `wasm_hash` is the **Keccak-256 of the safetensors file**, despite the historical field name.

## Active adapters

Beta3's registry has one Active model adapter: `GENERIC`, registration `900112`, class `judgment`, rank 8, alpha 16, targets `attn.query` and `attn.value`, 512 tokens, 3,162,920 bytes. Its Keccak-256 is `2d70a84881dd80bc1346969c7b3b96c0c21d450e47828ef71de281f9728cb8c8`.

Six existing comparator registrations remain Active: `SSL_VERIFICATION`, `CRYPTO_PRICE`, `CURRENCY_EXCHANGE`, `FX_NOW`, `STOCK_PRICE`, and `WEATHER_CHECK`. New comparator registrations are not accepted. Active registry status is not proof that every intent is routed or that every epoch has completed scoring.

A newer optimized candidate foundation has manifest SHA-256 `17d1308a452dc5108cf51ac03f8c07c02edb5e1794269bf82c71b0547d77c1c5` at 512 tokens, with sixteen matching adapters. Its Memory64 engine SHA-256 is `f88b3998ef606e7370dd1106e7a0b3e6a4798f4a43621cab311c551efa137969`. Remote inspection confirmed these identities. They differ from the deployed Beta3 identities above and must not be mixed.

The supplied handoff reports completed 512- and 2048-token benchmark runs and a 5120-token retry. Earlier wasm32 2k memory failures are historical. The 5120 driver showed startup and readiness at inspection; completion was not established. None of this changes Beta3's observed 512-token deployment.

## Other model roles

Beta3 configures `nuextract3` for response extraction and `gemini-router` for routing, request building and its OpenAI-compatible client. These are service aliases; their upstream model revisions were not established by this inspection. They are separate from the pinned MiniCheck evaluator.

For authoring, see [Train an Evaluator Adapter](train-a-scoring-adapter.md). ModernBERT `lora-v1` and embedded full-model WASM instructions are retired; editing their metadata cannot make them MiniCheck adapters.
