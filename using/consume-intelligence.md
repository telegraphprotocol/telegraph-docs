---
description: Pick an intent, read its schema, and make your first paid request to Telegraph.
---

# Start Here

Start here when you want to use Telegraph in an application, an agent or a smart
contract.

1. Open [Browse Intents & Schemas](intent-schema.md).
2. Pick an intent that has miners (the list shows the count).
3. Read its request params and its result fields.
4. Send a request through the [Engine API](engine-ask.md), or from a smart
   contract with an [on-chain job](erc8183-jobs.md).

## Before you start

Every request is paid, so you need a wallet with test funds on Ethereum Sepolia:

- **A throwaway wallet** and [`cast`](https://getfoundry.sh) (Foundry). Never use a
  key that holds real funds. The commands on these pages read two variables:
  ```bash
  export KEY=0xYOUR_TESTNET_PRIVATE_KEY
  export YOUR_ADDRESS=$(cast wallet address --private-key $KEY)
  ```
- **Sepolia ETH** for gas, from a public Sepolia faucet. Most faucets ask you to
  sign in, solve a captcha or hold a little mainnet ETH. A transaction here costs
  well under 0.001 ETH, so 0.01 ETH lasts a long time.
- **Test USDC.** Anyone can mint it, 10 USDC is plenty:
  ```bash
  cast send 0xcc194e1a843B658526D0D5C431f670028582Ae17 "mint(address,uint256)" $YOUR_ADDRESS 10000000 \
    --rpc-url https://ethereum-sepolia-rpc.publicnode.com --private-key $KEY
  ```
  You should see `status 1 (success)`. Check it with
  `cast call 0xcc194e1a843B658526D0D5C431f670028582Ae17 "balanceOf(address)(uint256)" $YOUR_ADDRESS --rpc-url https://ethereum-sepolia-rpc.publicnode.com`
  (`10000000` is 10 USDC). The public RPC can show the old balance for a few
  seconds after a transaction; wait and read it again.

A request costs $0.01 and is paid per call with [x402](x402-inference.md), or
from a balance you deposit once with [escrow](escrow-inference.md). Without a
payment, every request answers `402 Payment Required` with the price; that is
expected. More detail: [Getting test tokens](../protocol/addresses-and-params.md#getting-test-tokens).

> [!NOTE]
> Requests are public. The question you ask appears in the public
> [Daemon feed](daemon-signals.md) as a row with `source: user`, and
> `GET /engine/v1/signal/{hash}` shows the wallet that paid for it. Do not put
> private data in a question.

## What an intent can publish

Where published, the node exposes these schemas:

| You need | Read this part of the schema |
|---|---|
| The params a request takes | `request.params` |
| The fields a result has | `response.fields` |
| Smart-contract inputs | `onchain.request` |
| Callback values | `onchain.response` |

The node response shows which schemas are available for an intent. If the intent you
need has no published schema, ask the team in [Discord](https://discord.gg/telegraphprotocol) with its exact name
before building a typed or on-chain integration.

Build against the selected intent's live schema, not against one miner's raw
response or another intent's layout.

## Ways to make a request

| You want | Send | Example |
|---|---|---|
| Telegraph to pick the intent and the miner | `query` | `{"query":"Will Lahore get more than 50 mm of rain in the next 24 hours?"}` |
| A typed, predictable result | `intent` + `params` | `{"intent":"CRYPTO_PRICE_USD","params":{"symbol":"BTC"}}` |
| A typed result, with Telegraph completing omitted parameters | `intent` + partial `params` + `query` | `{"intent":"CRYPTO_PRICE_USD","params":{"symbol":"BTC"},"query":"What is BTC worth in US dollars?"}` |
| To pass known values next to a question | `query` + `context` | `{"query":"What is BTC worth in US dollars?","context":{"symbol":"BTC"}}` |
| One specific miner, same typed result | `POST /engine/v1/ask/{minerId}` + `intent` + `params` | Discover the current miner ID first, then send `{"intent":"CRYPTO_PRICE_USD","params":{"symbol":"BTC"}}`. |
| A miner's own API, unchanged | `POST /engine/v1/ask/{minerId}` + `method`, `endpoint`, `payload` | `{"method":"GET","endpoint":"/forecast","payload":{"city":"London"}}` |
| The result in a smart contract | An on-chain job with a callback | [On-Chain Jobs](erc8183-jobs.md) |
| A stream of results as they are produced | The Daemon feed or a WebSocket subscription | [Read the Daemon Feed](daemon-signals.md), [Stream over WebSocket](websocket-signals.md) |

## Copy-paste request

This request matches the live schema for `CRYPTO_PRICE_USD`. Run it unchanged
to receive the current payment challenge; then follow the payment instructions
and retry the same request.

```bash
curl -X POST https://devnode.telegraphprotocol.com/engine/v1/ask \
  -H "Content-Type: application/json" \
  -d '{"intent":"CRYPTO_PRICE_USD","params":{"symbol":"BTC"}}'
```

The no-payment response is expected to be `402 Payment Required`, not a failed
request. Its body starts with `{"error": "payment required", "accepts": [...]}`
and lists the two ways to pay: `exact` (x402) and `escrow`. The live schema for
this intent requires one `symbol` string and returns `price_usd`. Once paid, the
same request returns the answer in the intent's shape, for example:

```json
{
  "miner_id": "190069",
  "result": { "price_usd": 77648.845 },
  "result_shape": "intent",
  "field_status": { "price_usd": "ok" },
  "intent": "CRYPTO_PRICE_USD",
  "cost_usd": 0.01
}
```

The full reply has more fields. Always re-read the selected intent's schema
before using a typed request in an application.

For the full request and response, see [Make a Request](engine-ask.md).

When you name an intent, the node checks your params against its schema before
you pay. It uses `query` and `context` only to fill params you left out, and it
never swaps the intent or the miner you chose.
