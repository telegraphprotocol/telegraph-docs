---
description: The six rails Telegraph answers questions over, what each one costs, and how to pick the right one before you write any code.
---

# Choosing an Inference Path

Telegraph answers questions over six different rails. They are not variations on
one API — they differ in who picks the miner, how you pay, whether the answer
comes back in the same call, and what you need to hold before you start. Picking
the wrong one usually isn't discovered until the payment step fails.

Start here, then follow the link for the one you want.

## The short answer

| You are... | Use | Page |
|---|---|---|
| A script or agent that wants an answer now | **HTTP ask** (auto-routed) | [Engine Inference](engine-ask.md) |
| Sure which miner you want | **HTTP ask direct** | [Engine Inference](engine-ask.md#direct-ask) |
| An LLM agent with an MCP client | **MCP server** | [MCP Server](mcp-server.md) |
| Wanting a continuous feed, not one answer | **WebSocket subscribe** | [WebSocket Signals](websocket-signals.md) |
| A smart contract targeting a capability | **ERC-8183 job** | [On-Chain Jobs](erc8183-jobs.md) |
| A smart contract targeting one known miner | **On-chain miner request** | [On-Chain Miner Requests](onchain-miner-requests.md) |
| Just reading what the network already produced | **Daemon feed** (free, no inference) | [Daemon Signal Feed](daemon-signals.md) |

## The comparison

| | HTTP `ask` | HTTP `ask/{id}` | WebSocket `ask` | WebSocket `subscribe` | ERC-8183 job | On-chain miner request |
|---|---|---|---|---|---|---|
| **Who picks the miner** | Engine's LLM router | You | Engine's LLM router | n/a — pushed to you | Protocol, by intent | You |
| **You need** | USDC + x402 client | USDC + x402 client | Wallet + ≥ $1 escrow | Wallet + ≥ $1 escrow | USDC in escrow | Gas only |
| **How you pay** | Per call, x402 | Per call, x402 | $0.01 per call, from escrow | Per delivered signal, from escrow | `jobBasePrice` from escrow | Gas only |
| **Answer arrives** | In the response | In the response | As stream events | Pushed, on the Daemon's cycle | Callback + on-chain state | Callback |
| **Synchronous** | Yes | Yes | Yes | No | No | No |
| **Fresh inference** | Yes | Yes | Yes | Yes (Daemon-generated) | Yes | Yes |
| **Concurrency** | Many in flight | Many in flight | Per connection | One subscription per wallet | Many in flight | One at a time, protocol-wide |

Two things that surprise people:

- **WebSocket `ask` and `ask_direct` are billed, just not via x402.** Each call
  draws a flat $0.01 from your on-chain escrow, settled at the next epoch close
  rather than paid up front. It does not count against a subscription's
  `spend_limit_usdc` — that cap is only for pushed signals. Clearing the $1.00
  connect minimum once does not buy you unlimited calls.
- **The Daemon feed is not inference.** It is a read of answers the network
  already produced on its own schedule. You cannot ask it your own question.

## The minimum that works, per path

Everything below is the shortest complete call for that rail. Each links to the
page with the full contract.

### HTTP ask — auto-routed

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
covered in [Paying with x402](x402-inference.md) — read it before you try,
because a malformed payment comes back as a bare `402`, indistinguishable from
not having paid at all.

→ [Engine Inference](engine-ask.md) · [Paying with x402](x402-inference.md)

### HTTP ask — direct to a miner

You supply the miner ID, the endpoint and the payload. No routing, no
`reasoning` or `intent` in the response.

```bash
# 1. find a miner and a valid endpoint (free)
curl 'https://devnode.telegraphprotocol.com/api/miners?intent=WEATHER_FORECAST'

# 2. call it — same x402 flow as above
POST /engine/v1/ask/18
{ "method": "GET", "endpoint": "/predict", "payload": { "lat": 25.2, "lon": 55.3 } }
```

Miner IDs are not stable over time. Always take them from `/api/miners`, never
from an example.

Unlike the auto-routed path, this one **halts** if the node predicts the call
will fail — a `422` you are not charged for. See
[Pre-request validation](engine-ask.md#pre-request-validation).

→ [Engine Inference](engine-ask.md#direct-ask)

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

→ [MCP Server](mcp-server.md)

### WebSocket

One connection, three uses: on-demand `ask`, a live subscription, or both.
Everything except `ping` and `list_subnets` needs the wallet handshake first.

```
wss://devnode.telegraphprotocol.com/engine/ws?wallet_address=0xYourAddress
→ {"action": "auth_wallet"}
← wallet_challenge
→ {"action": "wallet_verify", "signature": "0x..."}   (personal_sign the message field)
← wallet_verified, then connected

→ {"action": "ask", "query": "..."}                    live inference
→ {"action": "subscribe", "intents": ["WEATHER_FORECAST"], "spend_limit_usdc": 500000}
```

You must have **≥ 1.00 USDC in escrow** before the handshake, or the connection
is closed. Funding it is [three transactions](websocket-signals.md#funding-your-escrow).

→ [WebSocket Signals](websocket-signals.md)

### ERC-8183 job

Your contract escrows USDC, names an intent, and gets the result delivered to a
callback. Priced at `jobBasePrice` (currently 1 USDC), not the miner's floor.

```bash
cast send $DIAMOND \
  "createJob(bytes32,(address[],uint256[],string[],bool[]),address)(uint256)" \
  "$(cast keccak 'STORM_ALERT')" '([],[],["24.75","67.0","2t","",""],[false])' $CALLBACK \
  --rpc-url $RPC --private-key $KEY
```

A job still sitting in `Funded` after a minute or two has **failed**, not
stalled. Recover with `cancelJob`.

→ [On-Chain Jobs (ERC-8183)](erc8183-jobs.md)

### On-chain miner request

The cheap on-chain rail: you name the miner and endpoint, you pay only gas, and
a callback is mandatory. One outstanding request at a time across the whole
protocol.

→ [On-Chain Miner Requests](onchain-miner-requests.md)

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
