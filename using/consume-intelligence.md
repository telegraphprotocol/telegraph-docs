---
description: Pick an intent, read its schema, and make your first paid request to Telegraph.
---

# Start Here

Start here when you want to use Telegraph in an application, an agent or a smart
contract.

1. Open [Browse Intents & Schemas](/intent-schema).
2. Pick an intent that has miners (the explorer shows the count).
3. Read its request params and its result fields.
4. Send a request through the [Engine API](engine-ask.md), or from a smart
   contract with an [on-chain job](erc8183-jobs.md).

## Before you start

Every request is paid, so you need a wallet with test funds on Ethereum Sepolia:

- **Sepolia ETH** for gas, from any public Sepolia faucet.
- **Test USDC.** Anyone can mint it, 10 USDC is plenty:
  ```bash
  cast send 0xcc194e1a843B658526D0D5C431f670028582Ae17 "mint(address,uint256)" $YOUR_ADDRESS 10000000 \
    --rpc-url https://ethereum-sepolia-rpc.publicnode.com --private-key $KEY
  ```

A request costs $0.01 and is paid per call with [x402](x402-inference.md), or
from a balance you deposit once with [escrow](escrow-inference.md). Without a
payment, every request answers `402 Payment Required` with the price; that is
expected. More detail: [Getting test tokens](../protocol/addresses-and-params.md#getting-test-tokens).

## What each intent publishes

The node publishes a schema for every live intent:

| You need | Read this part of the schema |
|---|---|
| The params a request takes | `request.params` |
| The fields a result has | `response.fields` |
| Smart-contract inputs | `onchain.request` |
| Callback values | `onchain.response` |

Build against the intent's own schema, not against one miner's answer, and keep
the schema version you built against.

## Ways to make a request

| You want | Send | Example |
|---|---|---|
| Telegraph to pick the intent and the miner | `query` | `{"query":"Will Lahore get more than 50 mm of rain in the next 24 hours?"}` |
| A typed, predictable result | `intent` + `params` | `{"intent":"FX_NOW_EUR","params":{"currency":"EUR"}}` |
| A typed result, with Telegraph filling the params from your words | `intent` + `query` | `{"intent":"FX_NOW_EUR","query":"How many US dollars is one euro right now?"}` |
| To pass known values next to a question | `query` + `context` | `{"query":"How many US dollars is one euro?","context":{"currency":"EUR"}}` |
| One specific miner, same typed result | `POST /engine/v1/ask/{minerId}` + `intent` + `params` | `POST /engine/v1/ask/31009` with `{"intent":"FX_NOW_EUR","params":{"currency":"EUR"}}` |
| A miner's own API, unchanged | `POST /engine/v1/ask/{minerId}` + `method`, `endpoint`, `payload` | `{"method":"GET","endpoint":"/forecast","payload":{"city":"London"}}` |
| The result in a smart contract | An on-chain job with a callback | [On-Chain Jobs](erc8183-jobs.md) |
| A stream of results as they are produced | The Daemon feed or a WebSocket subscription | [Read the Daemon Feed](daemon-signals.md), [Stream over WebSocket](websocket-signals.md) |

For the full request and response, see [Make a Request](engine-ask.md).

When you name an intent, the node checks your params against its schema before
you pay. It uses `query` and `context` only to fill params you left out, and it
never swaps the intent or the miner you chose.
