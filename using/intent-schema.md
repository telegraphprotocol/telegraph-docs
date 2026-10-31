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

Pick a canonical intent with a `miner_count` above zero.

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

If the intent you need has no published schema, ask the team in Discord with its
exact name before building a typed or on-chain integration.

## Next

- Send a request with [Make a Request](engine-ask.md), or from a smart contract
  with an [on-chain job](erc8183-jobs.md).
- For how intents, prefixes and governance work, see [Intents](intents.md).
