---
description: Subscribe to the Daemon's real-time signal feed over WebSocket — receive autonomously generated, verified intelligence as it's produced.
---

# WebSocket Signal Subscriptions

The Telegraph Daemon runs on a 3-hour cycle, generating inference tasks from registered collectors, routing them through the miner mesh, and storing the results. The Engine's WebSocket interface lets you subscribe to receive these signals in real time as the Daemon produces them.

This is the right interface for:
- Autonomous agents that want a continuous feed of verified intelligence without polling.
- Systems that react to specific categories of signals (e.g., only climate data, only medical research summaries).
- Any workflow where signals should arrive as events rather than being fetched on demand.

**WebSocket URL (testnet):** `wss://devnode.telegraphprotocol.com/engine/ws`

## Step 1: Connect and Authenticate

**Anonymous connections** (no wallet) can only use `list_subnets` and `ping` — no authentication needed for either:

```
wss://devnode.telegraphprotocol.com/engine/ws
```

On an anonymous connection the server greets you as soon as the socket opens, before you have sent anything:

```json
{"type": "connected", "data": {"message": "connected to telegraph engine"}, "timestamp": "..."}
```

Read and discard it. If your client pairs each reply with the last message it sent, this greeting shifts every response by one — your `ping` appears to return the miner catalogue. Match on the `type` field instead of on arrival order.

Every other action, including `ask` and `ask_direct`, requires a verified wallet (see the actions table in Step 2). `ask`/`ask_direct` don't charge your escrow, but the connection they run on still has to be wallet-authenticated.

**Wallet-authenticated connections** unlock `ask`, `ask_direct`, subscriptions, and escrow-based signal delivery. Connect with your EVM address as a query parameter:

```
wss://devnode.telegraphprotocol.com/engine/ws?wallet_address=0xYourAddress
```

After upgrading, the server does NOT immediately send a `connected` message. Instead, it waits for you to complete the wallet challenge-response handshake within 15 seconds:

**1. Initiate auth:**
```json
{"action": "auth_wallet"}
```

**2. Server responds with a challenge:**
```json
{
  "type": "wallet_challenge",
  "data": {
    "nonce": "a3f8...",
    "message": "Telegraph Protocol\n\nSign to verify wallet ownership.\n\nWallet: 0x...\nNonce: a3f8...\nIssued: 2026-06-26T...",
    "wallet_address": "0x...",
    "instruction": "sign the \"message\" field with personal_sign and send {\"action\":\"wallet_verify\",\"signature\":\"0x...\"}"
  }
}
```

**3. Sign the `message` field with `personal_sign` and return the signature:**
```json
{"action": "wallet_verify", "signature": "0x..."}
```

**4. Server verifies ownership and checks your on-chain USDC escrow balance (≥ $1.00 required). On success:**
```json
{
  "type": "wallet_verified",
  "data": {"wallet_address": "0x...", "message": "wallet ownership verified — connection authenticated"}
}
```

Then the `connected` confirmation arrives. If escrow is insufficient, the connection is closed with an error message listing what to deposit.

## Step 2: Subscribe to Intents

Subscription requires wallet authentication (Step 1). Once verified, send a subscribe message specifying which Intents you want to receive signals for, along with a required per-session USDC spend cap:

```json
{
  "action": "subscribe",
  "intents": ["WEATHER_FORECAST", "CLIMATE"],
  "spend_limit_usdc": 500000
}
```

- **`spend_limit_usdc` is required and must be greater than 0.** It's a per-session USDC budget in raw μUSDC (6 decimals — `500000` = $0.50) capping how much this connection can spend on pushed signals. It resets to zero spent every time you subscribe (including resubscribing) or reconnect; it is not carried over between sessions. See "How Delivery is Settled" below for what happens when you hit it.
- **Optional filters:** `category` (restrict to one signal category), `min_interest` (only receive signals at or above this interest score), `max_per_hour` (rate cap on how often you're pushed to; defaults to 60 if omitted).

**A wallet has at most one subscription.** Sending `subscribe` again replaces your existing intents, filters, and spend limit — it does not create a second, parallel subscription.

Available actions on the WebSocket connection:

| Action | Requires wallet auth? | Purpose |
|---|---|---|
| `subscribe` | Yes | Start receiving Daemon signals for the given intents (replaces any existing subscription) |
| `unsubscribe` | Yes | Stop receiving signals for a subscription |
| `list_subscriptions` | Yes | See your current subscription, if any |
| `list_subnets` | No | See the loaded miner catalog |
| `ask` | Yes | Request live on-demand inference (routed automatically) |
| `ask_direct` | Yes | Route directly to a specific miner by ID |
| `ping` | No | Keep the connection alive |

The `ask` and `ask_direct` actions route inference through the Engine directly — no x402 payment is charged at the WebSocket layer, and neither counts against your subscription's spend limit. These are live calls, not reads from the cached history.

## Step 3: Receive Signals

When the Daemon produces a result matching your subscribed Intents, it's pushed to your connection wrapped in the standard message envelope:

```json
{
  "type": "result",
  "data": {
    "subscription_id": "8f2c1a4e-3b6d-4a1f-9c7e-2d5b8a9f0e1c",
    "intent": "WEATHER_FORECAST",
    "category": "CLIMATE",
    "question": "Will Riyadh experience temperatures above 40°C?",
    "routing": {
      "subnet_id": "18",
      "subnet_name": "bittensor-sn18-zeus",
      "miner_slug": "zeus",
      "reasoning": "Routed to SN18 Zeus for weather forecasting",
      "intent": "WEATHER_FORECAST"
    },
    "execution": {
      "result": {
        "hourly": {
          "time": ["2026-06-26T00:00", "2026-06-26T01:00"],
          "temperature_2m": [38.2, 37.9],
          "wind_speed_10m": [12.1, 11.8]
        },
        "latitude": 24.7,
        "longitude": 46.7
      },
      "cost_usd": 0.01,
      "duration_ms": 1088,
      "timestamp": "2026-06-26T19:24:42Z"
    },
    "fired_at": "2026-06-26T19:24:42Z"
  },
  "timestamp": "2026-06-26T19:24:42Z"
}
```

## Understanding the Daemon Cycle

Signals don't arrive continuously — they arrive in batches when the Daemon completes a cycle. The production cycle interval is **3 hours**. During each cycle:

1. Registered Collectors run and scrape their data sources (weather APIs, clinical trial databases, news feeds, etc.).
2. The Daemon's LLM router classifies the collected data into Intents and formulates inference questions.
3. Questions are routed to the appropriate miners via the miner dispatcher.
4. Miner responses are received, stored, and published to WebSocket subscribers.

If you connect and nothing arrives within minutes, that's expected — the next Daemon cycle will deliver signals when it runs. To read what the Daemon has already produced (instead of waiting for the next push), use the [Daemon Signal Feed](daemon-signals.md) API.

## How Delivery is Settled

**Subscriptions are not free**, and two independent limits gate each pushed signal.

**1. On-chain escrow.** When the Daemon pushes a signal to your subscription, the delivery is recorded and settled against your on-chain USDC escrow. Each delivered signal costs the signal price for its Intent (miner floor price × demand multiplier).

Before connecting with wallet auth, you must have at least **1.00 USDC** deposited in the escrow contract. The KnockGate checks this balance at connection time — if it's insufficient, the connection is immediately rejected with an error.

- Deposit USDC to your escrow via `EscrowFacet.depositUSDC()` on the Diamond contract before connecting.
- Each pushed signal is logged with your wallet address, intent ID, receipt hash, and a node signature.
- At each epoch boundary, the Validator batch-settles all logged deliveries, deducting USDC from your escrow.
- If your escrow runs dry mid-epoch, WebSocket delivery is suspended — each matching signal is silently skipped rather than queued — until you replenish it.

**2. Session spend limit (`spend_limit_usdc`).** Independent of escrow, your subscription's spend limit (set in Step 2) is charged for each pushed signal. Unlike escrow depletion, hitting this limit is terminal for the session: the signal that would cross it is **not delivered**, your subscription is **cancelled**, and the server sends a `limit_reached` message and **closes the connection**:

```json
{
  "type": "limit_reached",
  "data": {"message": "spend limit reached: charged 480000 of 500000 μUSDC this session — subscription cancelled, reconnect and resubscribe with a new spend_limit_usdc to continue"}
}
```

To keep receiving signals after this, reconnect and send `subscribe` again with a new `spend_limit_usdc`.

**`ask` and `ask_direct` actions do not deduct from your escrow or your session spend limit.** Only subscription-pushed signals are settled.

## Keeping the Connection Alive

For long-running subscribers, send a periodic `ping` message to prevent the connection from timing out:

```json
{"action": "ping"}
```

## What Collectors Produce

The signals you receive over WebSocket come from the Daemon's registered Collectors. Each Collector is a YAML-configured scraper pointed at a real-world data source. Current active collectors on testnet include:

- **collector-openmeteo-weather** — extreme heat and weather condition monitoring across cities.
- **clinicaltrials** — clinical trial status and research summaries.

Collectors are registered on-chain via `IntentRegistryFacet` — node operators and third parties can register new collectors to expand what the Daemon monitors.
