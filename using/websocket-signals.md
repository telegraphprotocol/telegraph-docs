---
description: Subscribe to the Daemon's real-time signal feed over WebSocket — receive autonomously generated, verified intelligence as it's produced.
---

# WebSocket Signal Subscriptions

The Telegraph Daemon runs on a 3-hour cycle, generating inference tasks from registered collectors, routing them through the miner mesh, and storing the results. The Engine's WebSocket interface lets you subscribe to receive these signals in real time as the Daemon produces them.

This is the right interface for:
- Autonomous agents that want a continuous feed of verified intelligence without polling.
- Systems that react to specific categories of signals (e.g., only climate data, only medical research summaries).
- Any workflow where signals should arrive as events rather than being fetched on demand.

**WebSocket URL (testnet):** `ws://13.237.89.59:7044/engine/ws`

## Step 1: Connect and Authenticate

**Anonymous connections** (no wallet) can connect and use `ask`, `ask_direct`, and `list_subnets` without any authentication:

```
ws://13.237.89.59:7044/engine/ws
```

**Wallet-authenticated connections** unlock subscriptions and escrow-based signal delivery. Connect with your EVM address as a query parameter:

```
ws://13.237.89.59:7044/engine/ws?wallet_address=0xYourAddress
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

Subscription requires wallet authentication (Step 1). Once verified, send a subscribe message specifying which Intents you want to receive signals for:

```json
{
  "action": "subscribe",
  "intents": ["WEATHER_FORECAST", "CLIMATE"]
}
```

Available actions on the WebSocket connection:

| Action | Requires wallet auth? | Purpose |
|---|---|---|
| `subscribe` | Yes | Start receiving Daemon signals for specified intents |
| `unsubscribe` | Yes | Stop receiving signals for a subscription |
| `list_subscriptions` | Yes | See your current active subscriptions |
| `list_subnets` | No | See the loaded miner catalog |
| `ask` | No | Request live on-demand inference (routed automatically) |
| `ask_direct` | No | Route directly to a specific miner by ID |
| `ping` | No | Keep the connection alive |

The `ask` and `ask_direct` actions route inference through the Engine directly — no x402 payment is charged at the WebSocket layer. These are live calls, not reads from the cached history.

## Step 3: Receive Signals

When the Daemon produces a result matching your subscribed Intents, it is pushed to your connection:

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

## Understanding the Daemon Cycle

Signals don't arrive continuously — they arrive in batches when the Daemon completes a cycle. The production cycle interval is **3 hours**. During each cycle:

1. Registered Collectors run and scrape their data sources (weather APIs, clinical trial databases, news feeds, etc.).
2. The Daemon's LLM router classifies the collected data into Intents and formulates inference questions.
3. Questions are routed to the appropriate miners via the miner dispatcher.
4. Miner responses are received, stored, and published to WebSocket subscribers.

If you connect and nothing arrives within minutes, that's expected — the next Daemon cycle will deliver signals when it runs. To read what the Daemon has already produced (instead of waiting for the next push), use the [Daemon Signal Feed](daemon-signals.md) API.

## How Delivery is Settled

**Subscriptions are not free.** When the Daemon pushes a signal to your subscription, the delivery is recorded and settled against your on-chain USDC escrow. Each delivered signal costs the signal price for its Intent (miner floor price × demand multiplier).

Before connecting with wallet auth, you must have at least **1.00 USDC** deposited in the escrow contract. The KnockGate checks this balance at connection time — if it's insufficient, the connection is immediately rejected with an error.

- Deposit USDC to your escrow via `EscrowFacet.depositUSDC()` on the Diamond contract before connecting.
- Each pushed signal is logged with your wallet address, intent ID, receipt hash, and a node signature.
- At each epoch boundary, the Validator batch-settles all logged deliveries, deducting USDC from your escrow.
- If your escrow runs dry mid-epoch, WebSocket delivery is suspended until you replenish it.

**`ask` and `ask_direct` actions do not deduct from your escrow.** Only subscription-pushed signals are settled.

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
