---
description: Choose a live intelligence capability, read its schema, and consume it through Telegraph.
---

# Consume Intelligence

Start here when you want to use Telegraph in an application, agent, or smart
contract.

1. Open [Browse Intents & Schemas](/intent-schema).
2. Choose a live intent with miners.
3. Read its request and processed-response schema.
4. Send a typed request through the [Engine API](engine-ask.md), or use an
   [on-chain job](erc8183-jobs.md).

## The integration contract

Every live intent publishes a node-generated contract containing:

| You need | Read this schema |
|---|---|
| Valid API inputs | `request.params` |
| Stable processed API result | `response.fields` |
| Smart-contract inputs | `onchain.request` |
| Callback values | `onchain.response` |

Do not infer fields from a miner response or copy another intent's layout. Read
the selected intent's live schema before integrating, and retain the schema
version you built against.

## Choose the right path

- **API or agent:** [Engine Inference](engine-ask.md)
- **A smart contract needs the answer:** [On-Chain Jobs](erc8183-jobs.md)
- **You need recurring updates:** [Daemon Signal Feed](daemon-signals.md) or
  [WebSocket Signals](websocket-signals.md)

The intent catalog itself is protocol reference material. Intent governance and
proposal mechanics are intentionally separate from consuming live intelligence.
