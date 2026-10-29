---
description: "Choose how your application receives Telegraph intelligence: on demand, streamed, published, or on-chain."
---

# Choose a Delivery Path

Telegraph delivers intelligence in several ways. They differ in who picks the
Miner, how you pay, when the result arrives, and whether you need to retain
state. Start with the outcome you need, then use the matching path.

Start here, then follow the link for the one you want.

## The short answer

| You are... | Use | Page |
|---|---|---|
| A script or agent that wants an answer now | **HTTP request** (auto-routed) | [Request Intelligence](engine-ask.md) |
| Calling often enough that per-request settlement hurts | **Escrow** on the same HTTP endpoints | [Use Escrow](escrow-inference.md) |
| Sure which miner you want | **Direct HTTP request** | [Request Intelligence](engine-ask.md#direct-ask) |
| An LLM agent with an MCP client | **MCP server** | [Use Intelligence from AI Agents](mcp-server.md) |
| Wanting a continuous feed, not one answer | **WebSocket subscribe** | [WebSocket Signals](websocket-signals.md) |
| A smart contract targeting a capability | **ERC-8183 job** | [On-Chain Jobs](erc8183-jobs.md) |
| A smart contract that prefers one known miner | **ERC-8183 job** with `createJobForMiner` | [On-Chain Jobs](erc8183-jobs.md) |
| Just reading what the network already produced | **Published intelligence feed** | [Read Published Intelligence](daemon-signals.md) |

## The comparison

| | HTTP `ask` | HTTP `ask/{id}` | WebSocket `ask` | WebSocket `subscribe` | ERC-8183 job |
|---|---|---|---|---|---|
| **Who picks the miner** | Engine's LLM router | You | Engine's LLM router | n/a, pushed to you | Protocol, by intent (or you, with `createJobForMiner`) |
| **You need** | USDC + x402 client, *or* funded escrow | USDC + x402 client, *or* funded escrow | Wallet + ≥ $1 escrow | Wallet + ≥ $1 escrow | USDC in escrow, or approve the Diamond and `createJobAndPay` |
| **How you pay** | Per call, x402, or from [escrow](escrow-inference.md) | Per call, x402, or from [escrow](escrow-inference.md) | $0.01 per call, from escrow | Per delivered signal, from escrow | `jobBasePrice` from escrow |
| **Answer arrives** | In the response, in the Intent's shape | In the response (raw, or shaped for the canonical form) | As stream events | Pushed, on the Daemon's cycle | Callback + on-chain state |
| **Synchronous** | Yes | Yes | Yes | No | No |
| **Fresh result** | Yes | Yes | Yes | Yes (Daemon-generated) | Yes |
| **Concurrency** | Many in flight | Many in flight | Per connection | One subscription per wallet | Many in flight |

Two things that surprise people:

- **WebSocket `ask` and `ask_direct` are billed, just not via x402.** Each call
  draws a flat $0.01 from your on-chain escrow, settled at the next epoch close
  rather than paid up front. It does not count against a subscription's
  `spend_limit_usdc` — that cap is only for pushed signals. Clearing the $1.00
  connect minimum once does not buy you unlimited calls.
- **The Daemon feed is published intelligence.** It is a read of results the
  network produced on its own schedule. You cannot ask it your own question.

## The minimum that works, per path

Everything below is the shortest complete call for that rail. Each links to the
page with the full contract.

### HTTP request — auto-routed

The default. You describe what you want; the Engine classifies it and picks a
miner.

```js
import { wrapFetchWithPayment } from "@x402/fetch";
import { createSigner } from "@x402/evm";

const fetchWithPayment = wrapFetchWithPayment(fetch, createSigner(process.env.EVM_PRIVATE_KEY));

const res = await fetchWithPayment("https://devnode.telegraphprotocol.com/engine/v1/ask", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "What is the current price of Bitcoin?" }),
});
```

The library handles the `402` challenge, signs, and retries. Doing it by hand is
covered in [Pay for Intelligence](x402-inference.md) — read it before you try,
because a malformed payment comes back as a bare `402`, indistinguishable from
not having paid at all.

→ [Request Intelligence](engine-ask.md) · [Pay for Intelligence](x402-inference.md)

### Direct HTTP request

You supply the miner ID, the endpoint and the payload. No routing, no
`reasoning` or `intent` in the response.

```bash
# 1. find a miner and a valid endpoint (free)
curl 'https://devnode.telegraphprotocol.com/api/miners?intent=WEATHER_CHECK_TEMPERATURE'

# 2. call it — same x402 flow as above
POST /engine/v1/ask/18
{ "method": "GET", "endpoint": "/predict", "payload": { "lat": 25.2, "lon": 55.3 } }
```

Miner IDs are not stable over time. Always take them from `/api/miners`, never
from an example.

Unlike the auto-routed path, this one **halts** if the node predicts the call
will fail — a `422` you are not charged for. See
[Pre-request validation](engine-ask.md#pre-request-validation).

→ [Request Intelligence](engine-ask.md#direct-ask)

### MCP server

The zero-crypto-code path. A local Node process holds the key, pays, and exposes
every miner as a tool to your agent runtime.

```json
{
  "mcpServers": {
    "telegraph": {
      "command": "node",
      "args": ["/path/to/Telegraph-MCP/dist/index.js"],
      "env": {
        "TELEGRAPH_NODE_URL": "https://devnode.telegraphprotocol.com",
        "TELEGRAPH_ENGINE_URL": "https://devnode.telegraphprotocol.com/engine",
        "TELEGRAPH_DAEMON_URL": "https://devnode.telegraphprotocol.com/daemon",
        "TELEGRAPH_EVM_PRIVATE_KEY": "0xyour_burner_key"
      }
    }
  }
}
```

Node.js 20+ is required — on Node 18 every paid call fails with
`Crypto API not available`.

→ [Use Intelligence from AI Agents](mcp-server.md)

### WebSocket

One connection, three uses: on-demand `ask`, a live subscription, or both.
Everything except `ping` and `list_subnets` needs the wallet handshake first.

```
wss://devnode.telegraphprotocol.com/engine/ws?wallet_address=0xYourAddress
→ {"action": "auth_wallet"}
← wallet_challenge
→ {"action": "wallet_verify", "signature": "0x..."}   (personal_sign the message field)
← wallet_verified, then connected

→ {"action": "ask", "query": "..."}                    live intelligence request
→ {"action": "subscribe", "intents": ["WEATHER_CHECK_TEMPERATURE"], "spend_limit_usdc": 500000}
```

You must have **≥ 1.00 USDC in escrow** before the handshake, or the connection
is closed. Funding it is [three transactions](websocket-signals.md#funding-your-escrow).

→ [WebSocket Signals](websocket-signals.md)

### ERC-8183 job

Your contract pays (from escrow, or in the same call with `createJobAndPay`),
names an intent and typed params, and gets the intent's fixed, processed answer
delivered to a callback. Priced at `jobBasePrice`, not the miner's floor.

```bash
cast send $DIAMOND \
  "createJobCapped(bytes32,(address[],uint256[],string[],bool[]),address,uint256)(uint256)" \
  "$(cast keccak 'WEATHER_FORECAST_LAHORE')" '([],[24],["Lahore"],[])' $CALLBACK 2000000 \
  --rpc-url $RPC --private-key $KEY
```

Read the intent's on-chain layout from `GET /engine/v1/intents/{intent}`
(`onchain`) first. The intent in the command above is a placeholder. If no miner can answer, the validator quorum fails the job,
you are refunded, and your callback gets `success = false`.

→ [Use Intelligence On-Chain](erc8183-jobs.md)

### On-chain miner request (removed)

The old gas-only rail (`outboundSubnetMessage`) was removed with `SubnetFacet`.
Use a job. To prefer one miner, use `createJobForMiner`.

→ [On-Chain Miner Requests](onchain-miner-requests.md) (how to move over)

## Before any of them: discovery is free

None of these endpoints cost anything, and every path is easier if you call them
first:

| Endpoint | What it tells you |
|---|---|
| `GET /api/miners` | Every registered miner — id, slug, endpoints, schemas, intents, floor price. Filter with `?intent=`, `?status=`, `&limit=`. |
| `GET /api/miners/{registrationId}` | One registration, including `rejected` ones the catalogue omits. |
| `GET /engine/v1/intents` | The canonical intent set, each with a description and a live miner count. |
| `GET /engine/v1/intents/{intent}/miners` | Who competes for an intent, before you spend anything. |
| `GET /miner-dispatcher/openapi.json` | Machine-readable OpenAPI spec of every miner endpoint. |
| `GET /engine/v1/signal/{hash}` | Look up any past call by the `signal_hash` it returned. |

An intent being canonical does not mean anyone serves it. Check `miner_count`
on `/engine/v1/intents` before building against one.

## Verifying afterwards

Every paid call returns a `signal_hash`. It commits to the request and the
response together, and you can re-derive it yourself:

```bash
curl https://devnode.telegraphprotocol.com/engine/v1/signal/0x7a44569d...
```

The response carries the signal, the result behind it, and the payload the hash
was computed over. Keep the hash — it is the only handle you have on a call
after the fact.
