---
description: Use the Engine to ask inference questions with automatic routing — the Engine selects the best miner for your intent.
---

# Direct Ask from Engine

The Engine is Telegraph's inference coordinator. Instead of choosing a subnet manually (as in x402 direct calls), you describe what you want — an Intent — and the Engine routes to the best available miner for that task automatically.

The Engine also exposes the Daemon's signal history: a database of results the Daemon already generated through its 3-hour collector cycle. Reading this history is free — the Daemon funds its own inference internally, and the results are cached in the node's database for anyone to read.

**Engine base URL (testnet):** `http://13.237.89.59:7044/engine`

## Two Ways to Get Results

### Option A: The Daemon Questions API (Free Read, Cached Results)

The Daemon continuously runs collectors, generates inference questions, routes them to miners, and stores the results in its database. Reading those stored results requires no payment or auth. The Daemon calls the Engine internally to generate these results — the node operator's miner API costs fund the underlying inference. You're reading an already-computed cache, not triggering fresh inference on demand.

```
GET /daemon/api/questions
```

Returns an array of recent daemon-generated results. Each entry includes:

```json
{
  "id": "9ba8569b-60bb-4df2-bced-186b8ce07fb4",
  "type": "daemon",
  "source": "collector-openmeteo-weather:extreme_heat",
  "status": "success",
  "question": {
    "text": "Will Riyadh experience temperatures above 40°C?",
    "category": "CLIMATE",
    "interest_score": 6
  },
  "routing": {
    "subnet_name": "bittensor-sn18-zeus",
    "reasoning": "Routed to SN18 Zeus for weather forecasting",
    "intent": "WEATHER_FORECAST"
  },
  "execution": {
    "result": { ... },
    "cost_usd": 0.01,
    "duration_ms": 1088
  }
}
```

Additional Daemon endpoints:
- `GET /daemon/api/categories` — list categories of questions in the database.
- `GET /daemon/health` — check if the Daemon is running (`{"status":"ok"}`).

The testnet database currently holds **107 results** across categories including PHARMA, TECHNOLOGY, CLIMATE, HEALTH, and ECONOMICS.

### Option B: Direct Inference via /engine/v1/ask (Requires x402 Payment)

For fresh, on-demand inference with automatic routing, use the `/ask` endpoint:

```
POST /engine/v1/ask
Content-Type: application/json

{
  "query": "7-day weather forecast for Dubai"
}
```

The `query` field is a natural language question. The Engine's LLM router classifies it, selects the best miner, and returns the result with routing metadata. This endpoint is gated by x402 — you will receive a 402 challenge first. Follow the same payment flow as [Direct x402 Inference](x402-inference.md) to complete payment and retry.

**To route directly to a specific subnet by ID:**

```
POST /engine/v1/ask/18
Content-Type: application/json

{
  "query": "7-day forecast for Dubai"
}
```

Replace `18` with any active subnet ID from the integrations list.

## Available Intents

Intents are the canonical labels for task types. When using `/engine/v1/ask`, the Engine's LLM router classifies your request and selects the appropriate miner automatically. The currently supported canonical Intents are:

| Category | Intents |
|---|---|
| Language | `LANGUAGE_GENERATION`, `CHAT_COMPLETION`, `TEXT_GENERATION`, `HIGH_PERFORMANCE_INFERENCE`, `EMBEDDINGS`, `CONTENT_MODERATION` |
| Weather | `WEATHER_CHECK`, `STORM_ALERT`, `WEATHER_FORECAST`, `WEATHER_RISK_ASSESSMENT` |
| Vision | `MULTIMODAL_INFERENCE`, `IMAGE_GENERATION`, `TEXT_TO_IMAGE` |
| Tasks | `TASK_COMPLETION`, `AGENT_TASK` |
| Search | `WEB_SEARCH`, `TWITTER_SEARCH`, `NEWS_SEARCH`, `RESEARCH_SYNTHESIS`, `FACT_CHECK` |
| Authenticity | `TEXT_AUTHENTICITY_CHECK`, `AI_TEXT_DETECTION`, `CONTENT_VERIFICATION`, `DEEPFAKE_DETECTION`, `MEDIA_AUTHENTICITY_CHECK`, `IMAGE_VERIFICATION`, `VIDEO_VERIFICATION` |

## Response Structure

A successful Engine response includes the miner's output plus routing and execution metadata:

```json
{
  "execution": {
    "result": { ... },
    "cost_usd": 0.01,
    "duration_ms": 1088
  },
  "routing": {
    "subnet_id": "18",
    "subnet_name": "bittensor-sn18-zeus",
    "reasoning": "Routed to SN18 Zeus for weather forecasting",
    "intent": "WEATHER_FORECAST"
  }
}
```

The `routing.reasoning` field shows why the Engine selected that particular subnet — useful for understanding routing decisions and debugging unexpected choices.

## When to Use the Engine vs. Direct x402

| Scenario | Recommended approach |
|---|---|
| You know exactly which subnet you need | [Direct x402](x402-inference.md) — less overhead |
| You want the best miner for a task type selected automatically | Engine `/ask` |
| You want to browse already-computed historical signal results | Daemon `/api/questions` (free read) |
| Your dApp needs on-chain delivery and a callback | [ERC-8183 Jobs](erc8183-jobs.md) |
| You want a continuous real-time feed | [WebSocket Signals](websocket-signals.md) |
