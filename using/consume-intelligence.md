---
description: Choose a live intelligence capability, read its schema, and consume it through Telegraph.
---

# Start Using Intelligence

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

## Ways to request intelligence

| You need | Send | Example |
|---|---|---|
| Let Telegraph choose the capability and Miner | `query` | `{"query":"Will Lahore receive over 50 mm of rain in 24 hours?"}` |
| A typed, predictable result | `intent` + `params` | `{"intent":"WEATHER_CHECK","params":{"location":"Lahore"}}` |
| Help complete an Intent request from natural language | `intent` + partial `params` + `query` | `{"intent":"WEATHER_CHECK","params":{"location":"Lahore"},"query":"Forecast for the next 24 hours"}` |
| Supply structured facts with the request | `query` or `intent` + `context` | `{"query":"...","context":{"location":"Lahore"}}` |
| Use one Miner while retaining the Intent contract | `/engine/v1/ask/{miner}` + `intent` + `params` or `query` | `POST /engine/v1/ask/weather-miner` |
| Call a Miner’s native API unchanged | `/engine/v1/ask/{miner}` + `method`, `endpoint`, `payload` | `{"method":"GET","endpoint":"/forecast","payload":{...}}` |
| A smart contract needs the result | On-chain job and callback | [On-Chain Jobs](erc8183-jobs.md) |
| Receive intelligence as it is produced | Daemon feed or WebSocket subscription | [Read Published Intelligence](daemon-signals.md), [Stream Intelligence](websocket-signals.md) |

For HTTP requests, see [Request Intelligence](engine-ask.md). Pay per request with
[x402](x402-inference.md), or fund once and use [escrow](escrow-inference.md).

When you request a canonical Intent, the node validates supplied parameters,
uses the query or context only to complete missing values, and never silently
replaces an explicit Intent or explicitly selected Miner.

The intent catalog itself is protocol reference material. Intent governance and
proposal mechanics are intentionally separate from consuming live intelligence.
