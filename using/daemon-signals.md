---
description: The Daemon autonomously generates intelligence signals on a schedule and serves them through a read-only API that powers the Intelligence Terminal dashboard.
---

# Daemon Signal Feed

The Daemon is a background service that produces intelligence on its own — without anyone asking. On a fixed cycle it scrapes real-world data sources, turns what it finds into scored questions, has the Engine answer them, and stores the results. Those stored results are what you see on the [Intelligence Terminal](https://terminal.telegraphprotocol.com/intelligence-terminal), and you can read them directly through the Daemon's HTTP API.

> The Daemon is separate from the Engine. The **Engine** answers *your* questions on demand and charges per call (see [Engine Inference](engine-ask.md)). The **Daemon** generates *its own* questions on a schedule and exposes the results read-only. This page is about reading what the Daemon has already produced — it does not run inference for you.

**Daemon API base URL (testnet):** `http://13.237.89.59:7044/daemon`

## What the Daemon Does

Every cycle (3 hours in production), the Daemon:

1. Runs its **Collectors** — scrapers pointed at sources like Polymarket, GDELT, Reddit, Hacker News, and Open-Meteo.
2. Scores the raw material into **questions**, each with a category and an interest score.
3. Calls the Engine's `POST /v1/ask` to answer each question (tagged as internal traffic, so these calls fund themselves through the node operator — they are not billed to you).
4. Writes the answered, scored results to its database (MongoDB).
5. Serves those results read-only over HTTP, and pushes new ones to [WebSocket subscribers](websocket-signals.md).

The result is a continuously growing feed of verified signals that exists whether or not any agent is actively paying for inference.

## Reading the Feed

All Daemon endpoints are **GET** requests. They require no payment and no authentication — they are read-only views of data the Daemon already generated.

### List signals

```
GET /daemon/api/questions
```

Returns a paginated list of signals. Each item is a stored result:

```json
{
  "results": [
    {
      "id": "67307b94c2a4f7c8e1f10a23",
      "type": "daemon",
      "source": "reddit",
      "status": "success",
      "created_at": "2026-06-26T18:42:11Z",
      "question": {
        "text": "Will Riyadh exceed 40°C in the next 24 hours?",
        "category": "CLIMATE",
        "interest_score": 7.4
      },
      "routing": {
        "subnet_name": "bittensor-sn18-zeus",
        "reasoning": "Weather risk question — routed to Zeus for meteorological forecasting.",
        "intent": "weather_forecast"
      },
      "execution": {
        "result": { "...miner output..." },
        "cost_usd": 0.0021,
        "duration_ms": 890
      }
    }
  ],
  "total": 47,
  "limit": 20,
  "offset": 0
}
```

**Query parameters:**

| Parameter | Notes |
|---|---|
| `category` | One of `POLITICS`, `ECONOMICS`, `GEOPOLITICS`, `TECHNOLOGY`, `CLIMATE`, `HEALTH`, `FINANCE`, `CRYPTO`, `SPORTS`, `SCIENCE`, `SOCIAL`, `OTHER` (case-insensitive). |
| `source` | Collector name (`reddit`, `gdelt`, `polymarket`, `hackernews`, `openmeteo`, …), or `user` for rows persisted from direct Engine traffic. |
| `sort` | `recent` (default), `interest`, `affected`, or `audience`. |
| `order` | `desc` (default) or `asc`. |
| `since` / `until` | RFC3339 timestamps filtering on `created_at`. |
| `since_hours` | Shorthand for "now minus N hours". |
| `min_interest` | 0–10. |
| `limit` | 1–100, default 20. |
| `offset` | ≥ 0, default 0. |

### Top signals by interest

```
GET /daemon/api/questions/top?since_hours=1&limit=10
```

Convenience endpoint that hard-sorts by interest score descending. Supports `category`, `since_hours`, and `limit` (1–50, default 10). This is the right endpoint for an "alerts" or "what's hot" view.

### Categories

```
GET /daemon/api/categories
```

Returns the full list of allowed categories plus per-category statistics from the database.

### Health

```
GET /daemon/health
```

Returns `{"status":"ok","time":"..."}` when the Daemon is running.

## Building on the Feed

- **Browser dashboards:** the Daemon allows GET from any origin (`Access-Control-Allow-Origin: *`), so a frontend can read it directly. This is exactly how the Intelligence Terminal renders its feed.
- **Polling for alerts:** poll `/daemon/api/questions/top?since_hours=1&min_interest=8` on an interval to surface high-interest signals as they appear.
- **Live push instead of polling:** subscribe over WebSocket to receive new signals as the Daemon produces them — see [WebSocket Signals](websocket-signals.md).

## What This Is Not

- It is **not** on-demand inference. You cannot make the Daemon answer a question of yours here — use [Engine Inference](engine-ask.md) for that.
- The signals are **already computed**. You are reading a feed, not triggering work.
- Each row's `execution.cost_usd` reflects what the underlying inference cost the node operator — it is not a charge to you.
