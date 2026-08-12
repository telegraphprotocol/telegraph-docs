---
description: Pay per call for AI inference using the x402 HTTP payment standard — no API key, no account, just USDC.
---

# Paying with x402

x402 is an HTTP-native payment protocol. Your client makes a request, gets a payment challenge back if it hasn't paid, completes the payment, and retries. The node verifies the payment before calling the miner. The whole exchange happens inside a normal HTTP request cycle — no separate checkout, no account, no API key.

This page covers the payment mechanics. For what to actually send and get back, see [Engine Inference](engine-ask.md).

## What You Need

- A USDC balance on **Base Sepolia** (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`) or **Solana Devnet**.
- An x402-compatible client (the [PayAI SDK](https://github.com/pay-ai/) handles signing automatically, or you can construct the payment manually).
- The URL of a Telegraph node.

**Live testnet node:** `https://devnode.telegraphprotocol.com`

## Step 1: Discover Available Miners

Before sending a request, check which miners are live and what their schemas look like:

```
GET /api/miners
```

This returns a JSON array of every registered miner with its endpoints, input/output schemas, supported Intents, and minimum prices. The set of live miners changes as operators register and deregister on-chain, so treat this endpoint as the source of truth rather than any list written down elsewhere.

Filter server-side instead of fetching the whole catalog: `GET /api/miners?intent=WEATHER_FORECAST` returns only miners that support that Intent. `status` and `limit` are also supported query params.

You can also browse the live miner set and their output on the [Intelligence Terminal](https://terminal.telegraphprotocol.com/intelligence-terminal).

> Each miner has a numeric `id` — that's the value you put in the request path. The `bittensor-` prefix on some slugs is historical — every provider is a **miner**, whether it's a Bittensor subnet, a hosted model, or a private API.

## Step 2: Make a Request — Receive the 402

Call a miner through the Engine. Without a payment header you get an HTTP 402 back:

```
POST /engine/v1/ask/18
Content-Type: application/json

{
  "method": "GET",
  "endpoint": "/predict",
  "payload": { "lat": 25.2, "lon": 55.3, "variable": "hourly" }
}
```

**Response (402 Payment Required):**
```
HTTP/1.1 402 Payment Required
Payment-Required: eyJ4NDAyVmVyc2lvbiI6Mi...  ← base64-encoded challenge
Content-Type: application/json
```

Decode the `Payment-Required` header (base64 → JSON) to see the payment options:

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "http://devnode.telegraphprotocol.com/v1/ask/18",
    "description": "Payment required for direct subnet inference.",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:84532",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "amount": "10000",
      "payTo": "0x...",
      "maxTimeoutSeconds": 60
    },
    {
      "scheme": "exact",
      "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      "amount": "10000",
      "payTo": "...",
      "maxTimeoutSeconds": 60
    }
  ]
}
```

The `amount` field is in 6-decimal USDC units — `10000` = $0.01. Different miners charge different amounts.

Always read `payTo` from the challenge you received. Never hardcode a receiving address — it is set per node and changes.

> Note that `resource.url` reports the path *inside* the engine (`/v1/ask/18`), without the `/engine` prefix you called. Keep using the URL you requested; don't rebuild it from this field.

## Step 3: Complete the Payment

Using the PayAI x402 SDK, provide the decoded challenge and your wallet. The SDK constructs and signs the USDC transfer on the network you pick.

```go
// Using the x402 Go client
payment, err := x402client.Pay(challenge, wallet)
// payment is a base64-encoded PaymentPayload containing the signed tx proof
```

Or construct it manually: sign an ERC-20 transfer of the required `amount` of the `asset` token to the `payTo` address, then encode the proof as base64 JSON per the x402 spec.

## Step 4: Retry with Payment Header

Retry the exact same request with the `PAYMENT-SIGNATURE` header containing the base64-encoded payment proof:

```
POST /engine/v1/ask/18
Content-Type: application/json
PAYMENT-SIGNATURE: <base64-encoded-payment-payload>

{
  "method": "GET",
  "endpoint": "/predict",
  "payload": { "lat": 25.2, "lon": 55.3, "variable": "hourly" }
}
```

The node forwards the payment proof to the PayAI facilitator (`https://facilitator.payai.network`) for verification. On success, the miner is called.

## Step 5: Receive the Response

The miner's output comes back inside `result`, alongside the routing and cost metadata:

```json
{
  "miner_id": "18",
  "miner_name": "zeus",
  "result": {
    "hourly": {
      "time": ["2026-06-26T00:00", "2026-06-26T01:00"],
      "temperature_2m": [38.2, 37.9],
      "wind_speed_10m": [12.1, 11.8]
    },
    "latitude": 25.2,
    "longitude": 55.3
  },
  "cost_usd": 0.01,
  "duration_ms": 412,
  "signal_hash": "0x7a44569d..."
}
```

Keep the `signal_hash`. It's how you look the call up afterwards — see [Verifying a call](#verifying-a-call).

The response also carries a settlement header:
```
PAYMENT-RESPONSE: <settlement-proof>
```

Keep this if you need to audit or dispute the payment later.

## You Only Pay for Answers

Payment settles only when the miner actually answers. If the request fails — a bad payload, an unregistered miner, an upstream error — the node returns an error status and **no payment is taken**. You are never charged for a failed call.

## Verifying a call

Every paid call is recorded as a **signal** — a hash committing to the request and the response together. Look one up by its hash:

```
GET /engine/v1/signal/{signal_hash}
```

The response includes the signal, the result behind it, and the payload the hash was computed over, so you can re-derive the hash yourself rather than taking the node's word for it.

## Payment Networks

| Network | CAIP-2 Identifier | USDC Contract |
|---|---|---|
| Base Sepolia (testnet) | `eip155:84532` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |

Choose based on where you hold USDC. The amount is the same either way. The `accepts[]` array in the challenge is authoritative — a node may offer more or fewer networks than this table.

## Dynamic Pricing

The price per request isn't fixed. It's the miner's declared floor price multiplied by a demand multiplier based on 24-hour request volume for that Intent. A miner with a $0.01 floor seeing 2,000 requests per day charges $0.015 at the 1.5× tier. See the full [demand multiplier tiers](../protocol/addresses-and-params.md#demand-multiplier-tiers).

A miner's floor price is the `min_price_usdc` field of its `/api/miners` entry, in the same 6-decimal units as the challenge — `10000` means $0.01. The amount actually charged — floor × current multiplier — is the `amount` field of the 402 challenge.

## Endpoints That Don't Require Payment (Discovery)

Inference is paid. Discovery and health endpoints are always open:

| Endpoint | Purpose |
|---|---|
| `GET /api/miners` | The live miner catalog with schemas and prices. Supports `?intent=`, `?status=`, `&limit=` filters. |
| `GET /miner-dispatcher/openapi.json` | Machine-readable OpenAPI spec of all miner endpoints. |
| `GET /miner-dispatcher/openapi.yaml` | The same spec in YAML. |

Use these to explore the network and build your request before paying for a single call.
