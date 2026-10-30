---
description: Choose a live intelligence capability, read its published schema, and consume it through Telegraph.
---

# Start Using Intelligence

Start here when you want to use Telegraph in an application, an agent or a smart
contract.

1. Open [Browse Intents & Schemas](/intent-schema).
2. Pick an intent that has miners (the explorer shows the count).
3. Read its request params and its result fields.
4. Send a request through the [Engine API](engine-ask.md), or from a smart
   contract with an [on-chain job](erc8183-jobs.md).

## The integration contract

Where an intent publishes them, the node exposes its request and response schemas:

| You need | Read this part of the schema |
|---|---|
| Valid typed inputs | `request.params` |
| Stable result fields | `response.fields` |
| Smart-contract inputs | `onchain.request` |
| Callback values | `onchain.response` |

The explorer shows which schemas are available for a particular intent. If the
intent you need has no published consumption schema, ask the team in Discord
with its exact name before building a typed or on-chain integration.

Build against the selected intent's live schema, not against one miner's raw
response or another intent's layout.

## Ways to request intelligence

| You want | Send | Example |
|---|---|
| Telegraph to pick the intent and the miner | `query` | `{"query":"Will Lahore get more than 50 mm of rain in the next 24 hours?"}` |
| A typed, predictable result | `intent` + `params` | Take the field names and values from that intent's live request schema. |
| A typed result, with Telegraph completing omitted parameters | `intent` + partial `params` + `query` | Provide the intent and known values; state the remaining values in the query. |
| To pass known values next to a question | `query` or `intent` + `context` | Supply structured context alongside the question. |
| One specific miner, same typed result | `POST /engine/v1/ask/{minerId}` + `intent` + `params` | Discover the current miner ID first; do not copy one from documentation. |
| A miner's own API, unchanged | `POST /engine/v1/ask/{minerId}` + `method`, `endpoint`, `payload` | `{"method":"GET","endpoint":"/forecast","payload":{"city":"London"}}` |
| The result in a smart contract | An on-chain job with a callback | [On-Chain Jobs](erc8183-jobs.md) |
| A stream of results as they are produced | The Daemon feed or a WebSocket subscription | [Read the Daemon Feed](daemon-signals.md), [Stream over WebSocket](websocket-signals.md) |

For HTTP request formats, payments and response handling, see [Request Intelligence](engine-ask.md).

When you name an intent, the node checks your params against its schema before
you pay. It uses `query` and `context` only to fill params you left out, and it
never swaps the intent or the miner you chose.
