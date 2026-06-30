---
description: Pay per call for AI inference using the x402 HTTP payment standard — no API key, no account, just USDC.
---

# Direct x402 Inference

x402 is an HTTP-native payment protocol: your client makes a request, receives a payment challenge if it hasn't paid, completes the payment, and retries. The server verifies the payment proof before forwarding to the miner. The entire exchange happens within a normal HTTP request cycle — no separate payment flow, no account, no API key.

## What You Need

- A USDC balance on **Base Sepolia** (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`) or **Solana Devnet**.
- An x402-compatible client (the [PayAI SDK](https://github.com/pay-ai/) handles signing automatically, or you can construct the payment manually).
- The URL of a Telegraph miner dispatcher node.

**Live testnet node:** `http://13.237.89.59:7044/miner-dispatcher`

## Step 1: Discover Available Miners

Before sending a request, check which miners are active and what their schemas look like:

```
GET /miner-dispatcher/integrations
```

This returns a JSON array of all registered miners with their endpoints, input/output schemas, supported Intents, and minimum prices. This endpoint is the authoritative source of truth — the set of live miners changes as operators register and deregister on-chain. At the time of writing the live testnet miners are:

| ID | Slug | Capability | Min Price |
|---|---|---|---|
| 18 | bittensor-sn18-zeus | Weather forecasting | $0.01 |
| 32 | itsai-text-detector | AI text detection | $0.01 |
| 33 | sapling-ai-detector | AI content detection | — |
| 34 | bittensor-sn34-bitmind | Deepfake / media authenticity | $0.02 |
| 102 | openai | LLM, images, embeddings | $0.05 |

You can also browse the live miner set and their output on the [Intelligence Terminal](https://terminal.telegraphprotocol.com/intelligence-terminal).

> The numeric `id` is the value you put in request paths (`/miner-dispatcher/v1/{id}/...`). The `bittensor-` prefix on some slugs is historical — every provider is a **miner**, whether it's a Bittensor subnet, a hosted model, or a private API.

## Step 2: Make a Request — Receive the 402

Pick a miner and make a request to its path. Without a payment header, you'll receive an HTTP 402:

```
GET /miner-dispatcher/v1/18/predict?lat=25.2&lon=55.3&variable=hourly
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
    "url": "http://13.237.89.59:7044/miner-dispatcher/v1/18/predict",
    "description": "Payment required for all subnet APIs.",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:84532",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "amount": "10000",
      "payTo": "0x43Eb1B49a079a4587E0D7e8dA81035dc791c91F8",
      "maxTimeoutSeconds": 60
    },
    {
      "scheme": "exact",
      "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      "amount": "10000",
      "payTo": "8mVxpTSb8F3SGmiJUc8tkpiL6DxCTtNR6eTCQQ9FxwfW",
      "maxTimeoutSeconds": 60
    }
  ]
}
```

The `amount` field is in 6-decimal USDC units — `10000` = $0.01. Different miners may require different amounts (e.g., OpenAI charges `50000` = $0.05).

## Step 3: Complete the Payment

Using the PayAI x402 SDK, provide the decoded challenge and your wallet. The SDK handles constructing and signing the USDC transfer on the selected network.

```go
// Using the x402 Go client
payment, err := x402client.Pay(challenge, wallet)
// payment is a base64-encoded PaymentPayload containing the signed tx proof
```

Or construct it manually: sign an ERC-20 transfer of the required `amount` of the `asset` token to the `payTo` address, encode the proof as base64 JSON per the x402 spec.

## Step 4: Retry with Payment Header

Retry the exact same request with the `PAYMENT-SIGNATURE` header containing the base64-encoded payment proof:

```
GET /miner-dispatcher/v1/18/predict?lat=25.2&lon=55.3&variable=hourly
PAYMENT-SIGNATURE: <base64-encoded-payment-payload>
```

The server forwards the payment proof to the PayAI facilitator (`https://facilitator.payai.network`) for verification. On success, the request is forwarded to the chosen miner.

## Step 5: Receive the Response

If the payment verifies correctly, you receive the miner's response directly:

```json
{
  "hourly": {
    "time": ["2026-06-26T00:00", "2026-06-26T01:00", ...],
    "temperature_2m": [38.2, 37.9, 37.5, ...],
    "wind_speed_10m": [12.1, 11.8, ...]
  },
  "latitude": 25.2,
  "longitude": 55.3
}
```

The response also includes a settlement header:
```
x-payment-settle-response: <settlement-proof>
```

Keep this header if you need to audit or dispute the payment later.

## Payment Networks

| Network | CAIP-2 Identifier | USDC Contract |
|---|---|---|
| Base Sepolia (testnet) | `eip155:84532` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |

Choose the network based on where you hold USDC. The payment amount is the same regardless of network.

## Dynamic Pricing

The price you pay per request is not fixed — it's the miner's declared floor price multiplied by a demand multiplier based on 24-hour request volume for that Intent. A miner with a $0.01 floor that sees 2,000 requests per day charges $0.015 at the 1.5× tier. See the full [demand multiplier tiers](../protocol/addresses-and-params.md#demand-multiplier-tiers).

You can always see a miner's floor price in the `/miner-dispatcher/integrations` response under `on_chain.min_price_usdc`. The actual charged amount — floor × current multiplier — is shown in the `amount` field of the 402 challenge.

## Endpoints That Don't Require Payment (Discovery)

The payment gate applies to inference paths — `/miner-dispatcher/v1/{id}/*` — whenever a receiving address is configured on the node. Discovery and health endpoints are always open, with no payment:

| Endpoint | Purpose |
|---|---|
| `GET /miner-dispatcher/integrations` | The live miner catalog with schemas and prices. |
| `GET /miner-dispatcher/healthz` | Dispatcher health check. |
| `GET /miner-dispatcher/openapi.json` | Machine-readable OpenAPI spec of all miner endpoints. |
| `GET /miner-dispatcher/openapi.yaml` | The same spec in YAML. |

Use these to explore the network and build your request before paying for a single call.
