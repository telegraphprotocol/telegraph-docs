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

**Engine base URL (testnet):** `http://13.237.89.59:7044/engine`

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

The endpoint is gated by x402: your first request returns a `402 Payment Required` challenge. Complete the payment and retry exactly as described in [Direct x402 Inference](x402-inference.md).

**Response (200):**

```json
{
  "subnet_used": "18",
  "subnet_name": "zeus",
  "result": { "...miner's raw output..." },
  "cost_usd": 0.0021,
  "duration_ms": 412,
  "timestamp": "2026-06-26T19:24:42Z",
  "reasoning": "Weather forecast query — routed to Zeus for meteorological predictions.",
  "intent": "weather_forecast"
}
```

| Field | Meaning |
|---|---|
| `subnet_used` / `subnet_name` | The miner the Engine selected (numeric ID and slug). |
| `result` | The miner's raw output. Shape varies per miner — always null-check before rendering. |
| `cost_usd` | What the call cost, in USD (a number). |
| `duration_ms` | Execution time in milliseconds. |
| `reasoning` | Why the router chose this miner. Omitted when empty. |
| `intent` | The Intent the router classified your query as. Omitted when empty. |

The `reasoning` field is useful for understanding and debugging routing decisions — it tells you, in plain language, why your query landed where it did.

## Direct Ask

When you already know which miner you want, call it by ID and skip routing. You supply the miner's endpoint and payload yourself:

```
POST /engine/v1/ask/{minerId}
Content-Type: application/json

{
  "endpoint": "/chat",
  "payload": {
    "model": "gpt-4o-mini",
    "messages": [{ "role": "user", "content": "Explain Bitcoin in one sentence." }]
  }
}
```

Replace `{minerId}` with a numeric miner ID from the [discovery endpoint](x402-inference.md#step-1-discover-available-miners) (for example, `102` for OpenAI). The `endpoint` and `payload` must match what that miner's YAML declares.

**Response (200):**

```json
{
  "subnet_id": "102",
  "subnet_name": "openai",
  "result": { "...miner's raw output..." },
  "cost_usd": 0.0012,
  "duration_ms": 650,
  "timestamp": "2026-06-26T19:24:42Z"
}
```

The direct path performs no routing, so the response has **no** `reasoning` or `intent` field. It is otherwise identical to the auto-routed response.

## Listing Available Miners

To see what the Engine can route to:

```
GET /engine/v1/subnets
```

Returns the miner catalog (`subnets`, `count`) — each entry has the numeric ID you pass to a direct ask, the slug, name, and capability metadata. The authoritative live list is always the [miner dispatcher discovery endpoint](x402-inference.md#step-1-discover-available-miners).

## Available Intents

When you use auto-routing, the Engine's LLM router maps your query to one of these canonical Intents and selects a miner that supports it:

| Category | Intents |
|---|---|
| Language | `LANGUAGE_GENERATION`, `CHAT_COMPLETION`, `TEXT_GENERATION`, `HIGH_PERFORMANCE_INFERENCE`, `EMBEDDINGS`, `CONTENT_MODERATION` |
| Weather | `WEATHER_CHECK`, `STORM_ALERT`, `WEATHER_FORECAST`, `WEATHER_RISK_ASSESSMENT` |
| Vision | `MULTIMODAL_INFERENCE`, `IMAGE_GENERATION`, `TEXT_TO_IMAGE` |
| Tasks | `TASK_COMPLETION`, `AGENT_TASK` |
| Search | `WEB_SEARCH`, `TWITTER_SEARCH`, `NEWS_SEARCH`, `RESEARCH_SYNTHESIS`, `FACT_CHECK` |
| Authenticity | `TEXT_AUTHENTICITY_CHECK`, `AI_TEXT_DETECTION`, `CONTENT_VERIFICATION`, `DEEPFAKE_DETECTION`, `MEDIA_AUTHENTICITY_CHECK`, `IMAGE_VERIFICATION`, `VIDEO_VERIFICATION` |

## Streaming over WebSocket

The same `ask` and `ask_direct` operations are available over the Engine's WebSocket interface, which streams routing progress as events instead of returning a single response. See [WebSocket Signals](websocket-signals.md).

## When to Use What

| Scenario | Use |
|---|---|
| You want the best miner picked automatically | Auto-routed `POST /v1/ask` |
| You know exactly which miner and endpoint you need | Direct `POST /v1/ask/{minerId}` |
| You want to manage payment and call a miner endpoint yourself | [Direct x402 Inference](x402-inference.md) |
| You want a live stream of routing events | [WebSocket Signals](websocket-signals.md) |
| Your smart contract needs the result on-chain | [On-Chain Jobs (ERC-8183)](erc8183-jobs.md) |
| You want to browse the Daemon's autonomously generated signals | [Daemon Signal Feed](daemon-signals.md) |
