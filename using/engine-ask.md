---
description: Ask the Engine for inference — let it auto-route your query to the best miner, or call a specific miner directly. Pay per call with x402.
---

# Engine Inference

The Engine is Telegraph's inference coordinator. You send it a question; it picks a miner, calls that miner, and returns the answer with routing and cost metadata. You never manage miner endpoints, API keys, or schemas yourself.

There are two ways to ask:

- **Auto-routed** — you describe what you want in plain language and the Engine's LLM router classifies it and selects the best miner for the job.
- **Direct** — you already know which miner you want, so you skip routing and call it by ID.

Both are paid per call via x402. Both run **fresh, on-demand inference** — they are not reads from a cache.

> The Engine is not the Daemon. The Engine answers your questions on demand. The Daemon is a separate background service that generates its own questions on a schedule and stores them for the dashboard — see [Daemon Signal Feed](daemon-signals.md). If you want a live answer to your own question, you want the Engine.

**Engine base URL (testnet):** `https://devnode.telegraphprotocol.com/engine`

> **A note on naming:** the Engine API still uses `subnet` in some paths and field names (`/v1/subnets`, `subnet_id`, `subnet_name`). This is legacy naming from when every provider was a Bittensor subnet. Today any provider integrated via YAML is a **miner** — read `subnet` as "miner" throughout the API.

## Auto-Routed Ask

Send a natural-language query and let the Engine choose the miner:

```
POST /engine/v1/ask
Content-Type: application/json

{
  "query": "What is the current weather in London?"
}
```

| Field | Required | Description |
|---|---|---|
| `query` | Yes | Natural-language question. The LLM router classifies it into an Intent and picks a miner. |
| `context` | No | Object merged into the routed request body — use it to pass structured hints the miner understands. |

The endpoint is gated by x402: your first request returns a `402 Payment Required` challenge. Complete the payment and retry exactly as described in [Paying with x402](x402-inference.md).

**Response (200):**

```json
{
  "miner_id": "18",
  "miner_name": "zeus",
  "endpoint": "/predict",
  "result": { "...miner's raw output..." },
  "cost_usd": 0.01,
  "duration_ms": 412,
  "timestamp": "2026-06-26T19:24:42Z",
  "reasoning": "Weather forecast query — routed to Zeus for meteorological predictions.",
  "intent": "WEATHER_FORECAST",
  "signal_hash": "0x7a44569d..."
}
```

| Field | Meaning |
|---|---|
| `miner_id` / `miner_name` | The miner that served the request (numeric ID and slug). May be the fallback rather than the router's first pick. |
| `endpoint` | The upstream path that was called. |
| `result` | The miner's raw output. Shape varies per miner — always null-check before rendering. |
| `cost_usd` | What the call cost, in USD (a number). |
| `duration_ms` | Execution time in milliseconds. |
| `reasoning` | Why the router chose this miner. Omitted when empty. |
| `intent` | The Intent the router classified your query as. Omitted when empty. |
| `signal_hash` | The hash this result was recorded under. Look it up at `GET /engine/v1/signal/{hash}`. Omitted when the ask failed. |
| `warnings` | Advisory notes, e.g. your body is larger than the miner declared it accepts. The request still ran. Omitted when empty. |

The `reasoning` field is useful for understanding and debugging routing decisions — it tells you, in plain language, why your query landed where it did.

## Direct Ask

When you already know which miner you want, call it by ID and skip routing. You supply the miner's endpoint and payload yourself:

```
POST /engine/v1/ask/{minerId}
Content-Type: application/json

{
  "method": "POST",
  "endpoint": "/chat",
  "payload": {
    "messages": [{ "role": "user", "content": "Explain Bitcoin in one sentence." }]
  }
}
```

| Field | Required | Description |
|---|---|---|
| `method` | Yes | One of `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. Leaving this out returns `400`. |
| `endpoint` | Yes | The upstream path, e.g. `/chat`. Must match what the miner's YAML declares. |
| `payload` | Yes | Sent as the request body, or as query parameters when `method` is `GET`. |

Replace `{minerId}` with a numeric miner ID from the [discovery endpoint](x402-inference.md#step-1-discover-available-miners), and use one of the `endpoints` that miner lists there. Miner IDs are not stable across time — always take them from discovery rather than from an example.

**Response (200):**

```json
{
  "miner_id": "104",
  "miner_name": "litellm",
  "result": { "...miner's raw output..." },
  "cost_usd": 0.01,
  "duration_ms": 650,
  "timestamp": "2026-06-26T19:24:42Z",
  "signal_hash": "0x7a44569d..."
}
```

The direct path performs no routing, so the response has **no** `reasoning` or `intent` field. It is otherwise identical to the auto-routed response.

Rate limits are counted per miner across the whole node — every caller draws on the same allowance — so a `warnings` entry about a rate limit usually means switching to another miner for the same Intent works better than retrying the same one.

### The payment gate runs first

Payment is checked before your request is validated. An unregistered miner ID or a malformed body still comes back as `402`, not `404` or `400` — you only see the real error after the payment clears. You are not charged for it, since payment settles only on success, but you also can't probe an endpoint's shape for free.

So check your miner ID and endpoint against `/api/miners` before you build the request.

## Listing Available Miners

To see what the Engine can route to:

```
GET /engine/v1/subnets
```

Returns the miner catalog as `{ "miners": [...], "count": N }` — each entry has the numeric ID you pass to a direct ask, the slug, name, and capability metadata. The authoritative live list is always the [miner dispatcher discovery endpoint](x402-inference.md#step-1-discover-available-miners), which also gives you each miner's endpoints and schemas.

## Available Intents

When you use auto-routing, the Engine's LLM router classifies your query into
a canonical Intent and picks a miner that supports it.

See [Intents](intents.md) for what the network can do and how each one is
scored, or read the live set straight off the node:

```bash
curl https://devnode.telegraphprotocol.com/engine/v1/intents
```

## Streaming over WebSocket

The same `ask` and `ask_direct` operations are available over the Engine's WebSocket interface, which streams routing progress as events instead of returning a single response. See [WebSocket Signals](websocket-signals.md).

## When to Use What

| Scenario | Use |
|---|---|
| You want the best miner picked automatically | Auto-routed `POST /engine/v1/ask` |
| You know exactly which miner and endpoint you need | Direct `POST /engine/v1/ask/{minerId}` |
| You want to understand the payment flow itself | [Paying with x402](x402-inference.md) |
| You want a live stream of routing events | [WebSocket Signals](websocket-signals.md) |
| Your smart contract needs the result on-chain | [On-Chain Jobs (ERC-8183)](erc8183-jobs.md) |
| You want to browse the Daemon's autonomously generated signals | [Daemon Signal Feed](daemon-signals.md) |
