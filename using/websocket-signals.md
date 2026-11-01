---
description: Stream published intelligence or request it live over WebSocket.
---

# Stream over WebSocket

The Telegraph Daemon runs on a fixed cycle (every hour on the testnet node), generating intelligence tasks from registered collectors, routing them through the Miner mesh, and storing the results. The Engine's WebSocket interface lets you subscribe to receive these signals in real time as the Daemon produces them.

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

Every other action, including `ask` and `ask_direct`, requires a verified wallet (see the actions table in Step 2). `ask`/`ask_direct` are billed against your escrow per call — see [How `ask` and `ask_direct` are billed](#how-ask-and-askdirect-are-billed).

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

Then the `connected` confirmation arrives. If escrow is insufficient, you still get `wallet_verified`, then an `error` message and the connection closes:

```json
{"type": "error", "data": {"message": "insufficient escrow balance: have 0 μUSDC, need 1000000 μUSDC ($1) — call depositUSDC() first"}}
```

Fund it as in [Funding your escrow](#funding-your-escrow) and connect again.

### A minimal client

This Node.js client does the whole handshake and subscribes. In a new folder run
`npm init -y && npm install ws viem`, save this as `ws.mjs`, and run it with
`EVM_PRIVATE_KEY=0x... node ws.mjs`. It needs Node.js 20 or newer and at least
$1.00 in escrow.

```js
import WebSocket from "ws";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY);
const ws = new WebSocket(
  `wss://devnode.telegraphprotocol.com/engine/ws?wallet_address=${account.address}`);
const send = (msg) => ws.send(JSON.stringify(msg));

ws.on("open", () => send({ action: "auth_wallet" }));
ws.on("message", async (buf) => {
  const msg = JSON.parse(buf.toString());
  console.log(msg.type, JSON.stringify(msg.data ?? {}).slice(0, 300));
  if (msg.type === "wallet_challenge") {
    const signature = await account.signMessage({ message: msg.data.message });
    send({ action: "wallet_verify", signature });
  } else if (msg.type === "connected") {
    send({ action: "subscribe", intents: ["NEWS_HEADLINES_GENERAL"], spend_limit_usdc: 50000 });
    setInterval(() => send({ action: "ping" }), 240000);
  }
});
ws.on("close", (code, reason) => { console.log("closed", code, reason.toString()); process.exit(0); });
```

You should see `wallet_challenge`, `wallet_verified`, `connected` and
`subscribed`, then nothing until the Daemon's next cycle pushes a `result` (see
[Understanding the Daemon Cycle](#understanding-the-daemon-cycle)). With `cast`
instead of viem, `cast wallet sign --private-key $KEY "$MESSAGE"` makes the same
signature.

## Step 2: Subscribe to Intents

Subscription requires wallet authentication (Step 1). Once verified, send a subscribe message specifying which Intents you want to receive signals for, along with a required per-session USDC spend cap:

```json
{
  "action": "subscribe",
  "intents": ["WEATHER_CHECK_TEMPERATURE", "FX_NOW_EUR"],
  "spend_limit_usdc": 500000
}
```

The server immediately confirms with a `subscribed` message:

```json
{
  "type": "subscribed",
  "data": {
    "subscription_id": "6ee741a1-5c5b-4c82-a29f-956d9e529fd9",
    "wallet_address": "0x...",
    "intents": ["WEATHER_CHECK_TEMPERATURE", "FX_NOW_EUR"],
    "category": "",
    "min_interest": 0,
    "max_per_hour": 60,
    "spend_limit_usdc": 500000,
    "message": "subscribed — matching daemon results will be pushed as they arrive"
  }
}
```

- **`spend_limit_usdc` is required and must be greater than 0.** It's a per-session USDC budget in raw μUSDC (6 decimals — `500000` = $0.50) capping how much this connection can spend on pushed signals. It resets to zero spent every time you subscribe (including resubscribing) or reconnect; it is not carried over between sessions. See "How Delivery is Settled" below for what happens when you hit it.
- **Optional filters:** `category` (restrict to one signal category), `min_interest` (only receive signals at or above this interest score), `max_per_hour` (rate cap on how often you're pushed to; defaults to 60 if omitted).

**A wallet has at most one subscription.** Sending `subscribe` again replaces your existing intents, filters, and spend limit — it does not create a second, parallel subscription.

**Subscribe to intents the Daemon actually produces.** A subscription only pushes
the Daemon's own results, and the Daemon picks its intents from what its
collectors find. An intent it rarely produces, such as `WEATHER_CHECK_TEMPERATURE`,
may push nothing for hours. See which intents it produced recently:

```bash
curl -s "https://devnode.telegraphprotocol.com/daemon/api/questions?since_hours=12&limit=100" \
  | jq -r '[.results[] | select(.source != "user" and .status == "success") | .routing.intent]
           | group_by(.) | map({n: length, intent: .[0]}) | sort_by(-.n) | .[] | "\(.n) \(.intent)"'
```

You can list many intents in one `subscribe`, up to every name in
`GET /engine/v1/intents`.

**To stop**, send the `subscription_id` from `subscribed`. A subscription stays
listed after your connection drops, so unsubscribe when you are done:

```json
{"action": "unsubscribe", "subscription_id": "6ee741a1-5c5b-4c82-a29f-956d9e529fd9"}
```

The reply is `{"type": "unsubscribed", "data": {"message": "unsubscribed", "subscription_id": "…"}}`. Without the id you get `{"type": "error", "data": {"message": "subscription_id is required"}}`. `list_subscriptions` answers `{"type": "result", "data": {"count": 1, "subscriptions": [{"id": "…", "intents": […], "active": true, …}]}}`, so you can read the id from there too.

Available actions on the WebSocket connection:

| Action | Requires wallet auth? | Purpose |
|---|---|---|
| `subscribe` | Yes | Start receiving Daemon signals for the given intents (replaces any existing subscription) |
| `unsubscribe` | Yes | Stop receiving signals. Requires `subscription_id` |
| `list_subscriptions` | Yes | See your current subscription, if any |
| `list_subnets` | No | See the loaded miner catalog |
| `ask` | Yes | Request live intelligence (routed automatically), from a `query` or from `intent` + `params`. Billed $0.01 to escrow per call |
| `ask_direct` | Yes | Route directly to a specific miner by ID, with a native `method`/`endpoint`/`payload` or with `intent` + `params`. Billed $0.01 to escrow per call |
| `ping` | No | Keep the connection alive. The reply is `{"type": "pong"}` |

`list_subnets` responds with the catalog under a `subnets` key:

```json
{"type": "result", "data": {"count": 1880, "subnets": [{"id": "203", "name": "VirusTotal Threat Intelligence", "slug": "virustotal", "description": "...", "base_url": "...", "capabilities": ["URL_SCAN"], "cost_per_call": "0.00", "protocol": "generic"}]}}
```

For the full schema, endpoints, prices, `activation_status`, use `GET /api/miners` instead — see [Discover Available Miners](x402-inference.md#step-1-discover-available-miners).

The `ask` and `ask_direct` actions request intelligence through the Engine directly. These are live calls, not reads from the cached history.

For an Intent with an [input schema](engine-ask.md#canonical-ask-intent-params) you can send canonical params instead of (or with) the query, and `ask_direct` accepts the same form next to the native one:

```json
{ "action": "ask", "intent": "FX_NOW_EUR", "params": { "currency": "EUR" } }
{ "action": "ask_direct", "subnet_id": "31009", "intent": "FX_NOW_EUR", "params": { "currency": "EUR" } }
```

A request refused for its input gets an `error` message carrying the HTTP body (`invalid_params`, `no_input_schema`, `intent_required`, `no_compatible_miner`, ...) plus a `message`, before any routing and before the escrow check. Nothing is charged. Mixing native and canonical fields in one `ask_direct` is refused.

The final `result` message of an `ask` is shaped like `POST /engine/v1/ask`: `result` is read into the Intent's response format when the node can, and the message carries `result_shape` and, as they apply, `shape_error`, `format_version` and `field_status`, with the same fields and rules. See [The answer's shape](engine-ask.md#the-answers-shape). A native `ask_direct` result is the miner's raw output and carries `result_shape: "raw"`; a canonical `ask_direct` result is shaped like `ask`'s. Subscription pushes are raw and carry no `result_shape`.

An `ask` streams these messages, in this order: `received`, `routing`, `routed`
(the chosen miner as `subnet_id`, its `fallback_miner` and `reasoning`),
`executing`, `result`, then `receipt`. Routing can take 10 seconds or more. The
`result` message has no `signal_hash`; keep the `receipt_hash` from the
`receipt` instead.

**They are not free.** No x402 payment is charged at the WebSocket layer — instead each call is billed against your on-chain escrow. See [How `ask` and `ask_direct` are billed](#how-ask-and-askdirect-are-billed).

### Pre-request validation on `ask` and `ask_direct`

Both actions run the same [pre-request validation](engine-ask.md#pre-request-validation)
as their HTTP equivalents, and they behave the same way as those:

- **`ask_direct` halts.** You named the miner and no fallback will be tried, so a
  request the node predicts will fail comes back as an `error` message rather
  than being sent upstream. Resend with `"acknowledge_warnings": true` to run it
  regardless:

  ```json
  { "action": "ask_direct", "subnet_id": "18", "method": "POST",
    "endpoint": "/chat", "payload": { "...": "..." },
    "acknowledge_warnings": true }
  ```

- **`ask` warns and continues.** It did not choose the miner and a fallback is
  lined up behind it. Warnings arrive on the `executing` message, for both the
  primary and the fallback attempt:

  ```json
  { "type": "executing", "data": {
      "status": "calling primary miner zeus [llm]…",
      "warnings": ["miner \"zeus\" has reached its rate limit — try another miner for this intent, or try again later"]
  } }
  ```

  The `warnings` array is absent or empty when there is nothing to report, so
  treat it as optional.

## Step 3: Receive Signals

When the Daemon produces a result matching your subscribed Intents, it's pushed to your connection wrapped in the standard message envelope:

```json
{
  "type": "result",
  "data": {
    "subscription_id": "8f2c1a4e-3b6d-4a1f-9c7e-2d5b8a9f0e1c",
    "intent": "WEATHER_FORECAST_GENERAL",
    "category": "CLIMATE",
    "question": "Will Riyadh experience temperatures above 40°C?",
    "routing": {
      "subnet_id": "18",
      "subnet_name": "bittensor-sn18-zeus",
      "miner_slug": "zeus",
      "reasoning": "Routed to SN18 Zeus for weather forecasting",
      "intent": "WEATHER_FORECAST_GENERAL"
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

`execution.result` is the miner's raw answer, so its shape depends on the miner;
it can be large. `category` can be empty. The `receipt` for the delivery
follows right after (see the `receipt` message below).
Pushes arrive in a burst once per Daemon cycle, so expect long quiet gaps.

## Understanding the Daemon Cycle

Signals don't arrive continuously — they arrive in batches when the Daemon completes a cycle. The node operator sets the cycle; on the testnet node it runs **every hour**. During each cycle:

1. Registered Collectors run and scrape their data sources (weather APIs, clinical trial databases, news feeds, etc.).
2. The Daemon's LLM router classifies the collected data into Intents and formulates intelligence requests.
3. Questions are routed to the appropriate miners via the miner dispatcher.
4. Miner responses are received, stored, and published to WebSocket subscribers.

If you connect and nothing arrives within minutes, that's expected — the next Daemon cycle will deliver signals when it runs. To read what the Daemon has already produced (instead of waiting for the next push), use the [Read the Daemon Feed](daemon-signals.md) API.

## How Delivery is Settled

**Subscriptions are not free**, and two independent limits gate each pushed signal.

**1. On-chain escrow.** When the Daemon pushes a signal to your subscription, the delivery is recorded and settled against your on-chain USDC escrow. Each delivered signal costs the signal price for its Intent (miner floor price × demand multiplier).

Before connecting with wallet auth, you must have at least **1.00 USDC** deposited in the escrow contract. The KnockGate checks this balance at connection time — if it's insufficient, the connection is immediately rejected with an error.

- Fund your escrow **before** connecting — see [Funding your escrow](#funding-your-escrow) below.
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

### `receipt` — what you were charged

Every billed delivery is followed by a `receipt` message. It arrives **after** the `result` it pays for, never instead of it:

```json
{
  "type": "receipt",
  "data": {
    "receipt_hash": "0xa8f605342196a831aa12a43656dfa672b120deb56f2f1dd745dbb5610cb9be89",
    "rail": "ws",
    "payer": "0xyourwallet…",
    "miner": "377",
    "intent": "WEATHER_CHECK_TEMPERATURE",
    "amount_uusdc": "10000",
    "epoch_id": 314,
    "settlement": "epoch",
    "chain": "telegraph",
    "timestamp": 1789466181
  }
}
```

`receipt_hash` identifies that one consumption permanently — it is the key of the delivery's ledger row and the `Finalised_Receipt_Hash` in the signed Delivery Log Entry submitted with the epoch. There is no `tx_hash`, because WebSocket deliveries settle at the epoch boundary rather than per signal; `chain: "telegraph"` says so, and `epoch_id` names the transaction your charge will ride.

This is the same receipt object the [x402](x402-inference.md) and [escrow](escrow-inference.md) HTTP rails return, so you can handle all three identically.

If you don't care about receipts, ignore the message — nothing about `result` changed.

### How `ask` and `ask_direct` are billed

`ask` and `ask_direct` are billed against your escrow, but on a different meter
from subscriptions:

- **Each call costs a flat $0.01** — the protocol's minimum price per signal,
  which is also the `cost_usd` reported back to you. The demand multiplier that
  moves the x402 price does not apply here.
- **Escrow is checked before the miner is called**, and the charge is recorded
  only **after** a result is actually delivered to you. A call that fails to
  route or execute is never billed.
- **The charge is queued, not deducted immediately.** It settles at the next
  epoch close, the same mechanism subscription deliveries use.
- **It does not touch your subscription's `spend_limit_usdc`.** That cap applies
  only to pushed signals.

The connect-time balance gate runs once; this check runs on every call. So a
wallet that got in on the $1.00 minimum can still be refused mid-session:

```json
{"type": "error", "data": {"message": "insufficient escrow for delivery: committed=10000 μUSDC + price=10000 μUSDC > available=15000 μUSDC"}}
```

`committed` is what this epoch has already charged you but not yet settled.
Deposit more — see [Funding your escrow](#funding-your-escrow) — and retry; you
do not need to reconnect.

### Funding your escrow

Escrow lives on the Diamond, in the token the Diamond is configured to use — on
the testnet that is a test USDC anyone can mint (step 0 below). Three transactions, in this order.
Skipping the approval fails with `ERC20: insufficient allowance`:

```bash
export DIAMOND=0x3624EB012B5E998BB57B6bE6C9Cfc9c4bc5eb99b
export USDC=0xcc194e1a843B658526D0D5C431f670028582Ae17
export RPC=https://ethereum-sepolia-rpc.publicnode.com

# 0 — testnet only: mint yourself 10 test USDC
cast send $USDC "mint(address,uint256)" $YOUR_ADDRESS 10000000 \
  --rpc-url $RPC --private-key $KEY

# 1 — let the Diamond move your USDC (2000000 = 2.00 USDC, 6 decimals)
cast send $USDC "approve(address,uint256)" $DIAMOND 2000000 \
  --rpc-url $RPC --private-key $KEY

# 2 — deposit into escrow
cast send $DIAMOND "depositUSDC(uint256)" 2000000 \
  --rpc-url $RPC --private-key $KEY

# 3 — confirm it landed, before you open the socket
cast call $DIAMOND "escrowBalance(address)(uint256)" $YOUR_ADDRESS --rpc-url $RPC
# 2000000
```

`escrowBalance(address)` is your raw deposit. `effectiveBalance(address)` is what
you can spend, and `agentDebt(address)` shows any unpaid deliveries. Other names
such as `getEscrowBalance()` and `available()` do not exist on the Diamond.

Deposit more than the $1.00 minimum. That figure is only the gate to *connect* —
both meters then draw against the same balance: every pushed subscription signal
and every `ask`/`ask_direct` call. An escrow that runs dry mid-epoch silently
stops subscription delivery rather than queueing, and starts refusing asks.
A withdrawal unlocks once two more blocks settle (1 hour each on the testnet, 24 hours on mainnet) or after 7 days, whichever comes first, so deposit what you will actually use. See [Withdrawing](escrow-inference.md#withdrawing).

The same escrow funds [ERC-8183 jobs](erc8183-jobs.md) — one balance, both rails.

## Keeping the Connection Alive

For long-running subscribers, send a periodic `ping` message to prevent the connection from timing out:

```json
{"action": "ping"}
```

## What Collectors Produce

The signals you receive over WebSocket come from the Daemon's registered Collectors. Each Collector is a YAML-configured scraper pointed at a real-world data source. Collectors on the testnet node include:

- **collector-clinicaltrials** — clinical trial status and research summaries.
- **collector-hackernews** — popular technology stories.
- **collector-openfda-approvals** and **collector-openfda-adverse-events** — drug approvals and serious adverse events.
- **collector-polymarket** — high-volume prediction markets.

The `source` field of each row in the [Daemon feed](daemon-signals.md) names the collector that produced it.

Collectors are registered on-chain via `IntentRegistryFacet` — node operators and third parties can register new collectors to expand what the Daemon monitors.
