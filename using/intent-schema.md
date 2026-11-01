---
description: List the intents on the network and read the request and response schema of any one of them.
---

# Browse Intents & Schemas

Every intent publishes its schema on the public node. Pick an intent below to
see its request params and result fields, then read its schema before you build
against it. The commands further down do the same from a terminal.

<div data-doc-component="intent-explorer"></div>

## List the intents

```bash
export NODE=https://devnode.telegraphprotocol.com

curl -s "$NODE/engine/v1/intents" | jq '.intents[] | {
  intent_name, description, miner_count, canonical
}'
```

Pick a canonical intent with a `miner_count` above zero. Copy its
`intent_name` exactly: names are case-sensitive.

## Read one intent's schema

```bash
export INTENT=FX_NOW_EUR

curl -s "$NODE/engine/v1/intents/$INTENT" | jq '{
  intent_name, class, request, response, onchain, miner_count
}'
```

Where published, the response exposes these schemas:

| You need | Read this part of the schema |
|---|---|
| The params a request takes | `request.params` |
| The fields a result has | `response.fields` |
| Smart-contract inputs | `onchain.request` |
| Callback values | `onchain.response` |

A `{key}` in a description or unit is the intent's question key, the value the
intent is about. For `FX_NOW_EUR` it is `EUR`, and that intent still takes it
as a param: send `{"currency": "EUR"}`.

> [!WARNING]
> This endpoint answers `200` for any name. A misspelled name, or a prefix such
> as `FX_NOW`, comes back with `miner_count: 0` (and often `request: null`), not
> with an error. Take names from the list above, where `canonical` is `true`.

If the intent you need has no published schema, ask the team in
[Discord](https://discord.gg/telegraphprotocol) with its exact name before
building a typed or on-chain integration.

## See who ranks where

```bash
curl -s "$NODE/engine/v1/intents/$INTENT/miners" | jq '.miners[] | {id, slug, name}'
curl -s "$NODE/leaderboard/miners" | jq '.intents.CRYPTO_PRICE_USD[:3]'
```

The first lists every miner that serves the intent; use an `id` with
[`POST /engine/v1/ask/{minerId}`](engine-ask.md#direct-ask). The second is the
leaderboard from the last scored epoch: `rank`, `score` (0 to 1) and `miner_slug`
for each scored intent. Intents that were not scored that epoch are not listed.
The price is `min_price_usdc` in `GET /api/miners`; ignore `cost_per_call` on
the first list.

## Next

- Send a request with [Make a Request](engine-ask.md), or from a smart contract
  with an [on-chain job](erc8183-jobs.md).
- For how intents, prefixes and governance work, see [Intents](intents.md).
