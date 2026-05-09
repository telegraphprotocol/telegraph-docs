# x402 Payment Protocol — Technical Documentation

## Overview

Telegraph uses the **x402 protocol** to gate subnet API calls behind per-request micropayments. When x402 is enabled, every request to `/v1/:subnet/*` requires payment — unauthorized requests receive HTTP 402 with payment instructions, and authorized requests are proxied to the upstream subnet API.

The pricing is **per-subnet and dynamic**: each integration YAML can declare `on_chain.min_price_usdc`, which the x402 middleware reads at request time. Integrations without a price default to `$0.01`.

---

## Architecture

```
Client                                    Telegraph Node
  │                                            │
  │  GET /v1/18/predict                       │
  │  (no PAYMENT-SIGNATURE header)            │
  │───────────────────────────────────────────▶│
  │                                            │
  │  HTTP 402                                  │
  │  PAYMENT-REQUIRED: base64(JSON)           │
  │  Body: {accepts: [{scheme, price,          │
  │           network, payTo}]}                 │
  │◀───────────────────────────────────────────│
  │                                            │
  │  Client pays via PayAI/x402 client         │
  │  Receives PAYMENT-SIGNATURE (base64 JSON)  │
  │                                            │
  │  GET /v1/18/predict                        │
  │  PAYMENT-SIGNATURE: base64(JSON)           │
  │───────────────────────────────────────────▶│
  │                                            │
  │                        ┌──────────────┐     │
  │                        │ Facilitator  │     │
  │                        │ (PayAI)      │     │
  │                        │ /verify      │     │
  │                        └──────┬───────┘     │
  │                               │              │
  │                        Payment verified      │
  │                               │              │
  │                        ┌──────▼───────┐     │
  │                        │ HandleFetch  │     │
  │                        │ → upstream   │     │
  │                        └──────┬───────┘     │
  │                               │              │
  │  HTTP 200                                   │
  │  PAYMENT-RESPONSE: base64(JSON)             │
  │  + upstream response body                   │
  │◀───────────────────────────────────────────│
```

### Key Properties

1. **Server never verifies on-chain.** Payment verification is delegated to the facilitator (PayAI). The server sends the `PAYMENT-SIGNATURE` to the facilitator's `/verify` endpoint and trusts the response.

2. **No replay store needed.** The facilitator handles replay protection and double-spend detection. The server does not maintain a separate replay cache.

3. **Dynamic per-subnet pricing.** The `dynamicPriceFunc` reads live integration configs at request time, so newly registered integrations get correct pricing immediately.

4. **Discovery routes are not gated.** `/healthz`, `/integrations`, and `/openapi.*` are outside the x402 group and always accessible without payment.

---

## For Developers

### Request Flow Detail

#### Step 1: Unauthorized Request

```bash
curl -v http://localhost:7044/subnet-dispatcher/v1/18/predict?lat=40.7&lon=-74.0

# Response:
< HTTP/1.1 402 Payment Required
< PAYMENT-REQUIRED: eyJhY2NlcHRzIjpbXX0...  (base64-encoded JSON)
< Content-Type: application/json
<
< {"error":"payment required","accepts":[{"scheme":"exact","price":"$0.01","network":"eip155:84532","payTo":"0xC0A3FB6d3F1f4B54617d29ffbdA4663Af5F96e2e"}]}
```

#### Step 2: Payment

The client uses an x402 v2–capable payment client (e.g., PayAI SDK) to:

1. Parse the `PAYMENT-REQUIRED` header
2. Select a payment option (network + amount)
3. Execute the on-chain USDC transfer
4. Receive a signed `PAYMENT-SIGNATURE` payload

#### Step 3: Paid Request

```bash
curl http://localhost:7044/subnet-dispatcher/v1/18/predict?lat=40.7&lon=-74.0 \
  -H "PAYMENT-SIGNATURE: eyJ0eF9oYXNoIjoi..."

# Response: 200 OK with upstream response body
# PAYMENT-RESPONSE header set by x402 middleware
```

### HTTP Headers

| Header | Direction | Description |
|---|---|---|
| `PAYMENT-REQUIRED` | Server → Client (402) | Base64-encoded JSON with `accepts[]` array |
| `PAYMENT-SIGNATURE` | Client → Server | Base64-encoded JSON payload from x402 v2 client |
| `PAYMENT-RESPONSE` | Server → Client (200) | Set by x402 Gin middleware after successful verification |
| `Access-Control-Expose-Headers` | Server → Client | Includes `PAYMENT-RESPONSE`, `PAYMENT-REQUIRED` for CORS |

### 402 Response Body Shape

```json
{
  "error": "payment required",
  "accepts": [
    {
      "scheme": "exact",
      "price": "$0.01",
      "network": "eip155:84532",
      "payTo": "0xC0A3FB6d3F1f4B54617d29ffbdA4663Af5F96e2e"
    },
    {
      "scheme": "exact",
      "price": "$0.01",
      "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      "payTo": "7BUgACDYC5wenaSp6K97mmd2nEkZufoaYR9HrZzYqsb"
    }
  ]
}
```

### Dynamic Pricing

Pricing is determined per-request by `dynamicPriceFunc` in `subnet-dispatcher.go`:

```go
func (d *Dispatcher) dynamicPriceFunc(defaultPrice string) x402http.DynamicPriceFunc {
    return func(_ context.Context, reqCtx x402http.HTTPRequestContext) (x402.Price, error) {
        trimmed := strings.TrimPrefix(reqCtx.Path, "/v1/")
        subnetID := strings.SplitN(trimmed, "/", 2)[0]
        d.cfgMu.RLock()
        defer d.cfgMu.RUnlock()
        for _, cfg := range d.integrationCfgs {
            if cfg.Name == subnetID && cfg.OnChain != nil && cfg.OnChain.MinPriceUSDC > 0 {
                return fmt.Sprintf("$%g", cfg.OnChain.MinPriceUSDC), nil
            }
        }
        return defaultPrice, nil
    }
}
```

The lookup happens at request time under a read lock, so newly hot-registered integrations are priced correctly without restart.

**Pricing chain:**
```
Integration YAML → on_chain.min_price_usdc (e.g., 0.01)
  → config.OnChain.MinPriceUSDC (float64)
  → dynamicPriceFunc extracts subnetID from URL path
  → returns "$0.01" or "$0.05" etc.
  → buildX402Accepts() creates PaymentOption with this price
  → x402 middleware returns 402 with PAYMENT-REQUIRED header
```

Integrations without `on_chain.min_price_usdc` (or with it set to 0) fall back to the default price of `$0.01`.

### Supported Payment Networks

| Network | CAIP-2 ID | Chain | USDC Contract | Notes |
|---|---|---|---|---|
| Base Sepolia | `eip155:84532` | EVM testnet | Built-in x402 library | Default EVM scheme |
| Polygon | `eip155:137` | EVM mainnet | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | Custom MoneyParser (6-decimal USDC) |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | SVM | Built-in SPL | Default SVM scheme |

Polygon requires a custom `RegisterMoneyParser` because `eip155:137` is not in the x402-go library's built-in `NetworkConfigs`. The custom parser formats amounts as `amount * 1e6` (6-decimal USDC).

### x402 Test Endpoint

When x402 is enabled, a test endpoint is available:

```bash
curl http://localhost:7044/subnet-dispatcher/v1/x402-test
# Returns: {"status":"ok","message":"Payment verified","x402_test":true,"endpoint":"/v1/x402-test"}
```

This endpoint is behind the x402 middleware, so it requires a valid `PAYMENT-SIGNATURE` to access. It's useful for verifying end-to-end payment flows.

### Implementation Details

**x402 middleware setup** (`subnet-dispatcher.go` lines 177-234):

x402 is enabled when `FACILITATOR_URL` is non-empty AND at least one receiving address (`BASE_RECEIVING_ADDRESS`, `POLYGON_RECEIVING_ADDRESS`, or `SOLANA_RECEIVING_ADDRESS`) is set. When both conditions are met:

1. `x402gin.X402Payment()` middleware is applied to the `/v1` Gin RouterGroup
2. `dynamicPriceFunc` is configured for per-subnet pricing
3. `buildX402Accepts()` creates payment options for each configured network
4. Discovery routes (`/healthz`, `/integrations`, `/openapi.*`) remain ungated

The middleware intercepts every request to a `/v1` route. If no `PAYMENT-SIGNATURE` header is present, it immediately returns 402 with payment options. If a signature is present, it forwards to the facilitator for verification.

**Facilitator interaction:**

The server never directly handles on-chain verification. When a `PAYMENT-SIGNATURE` is received:

1. The x402 Gin middleware forwards the signature to `FACILITATOR_URL/verify`
2. The facilitator checks on-chain that the USDC transfer happened
3. On success, the middleware calls `next(c)` to pass through to `HandleFetch`
4. On failure, it returns 402 with an error

**Discarded REQUEST body handling:** For GET requests (common for subnet APIs like Zeus), the x402 middleware does not buffer the body. For POST requests, the body is forwarded intact to the upstream after payment verification.

---

## For Node Operators

### Configuration

Add to your `.env`:

```bash
FACILITATOR_URL=https://facilitator.payai.network
BASE_RECEIVING_ADDRESS=0xC0A3FB6d3F1f4B54617d29ffbdA4663Af5F96e2e
SOLANA_RECEIVING_ADDRESS=7BUgACDYC5wenaSp6K97mmd2nEkZufoaYR9HrZPzYqsb
POLYGON_RECEIVING_ADDRESS=0x...   # Optional
```

x402 is **enabled by default** when `FACILITATOR_URL` and at least one receiving address are set. There is no `X402_ENABLED` flag.

If `FACILITATOR_URL` is empty or no receiving addresses are configured, the node logs a warning and serves all subnet requests without payment gating.

**Warning:** Never put private keys in `.env` or configuration files. Sender private keys (`PRIVATE_KEY`, `SOLANA_PRIVATE_KEY`) should only be set in the terminal environment when running payment test scripts.

### Local Testing

For local Anvil testing, x402 is typically disabled since the facilitator won't proxy to local testnets. The subnet dispatcher works normally without x402 — all requests are served directly.

To test x402 end-to-end locally:

1. Run `local-telegraph.sh` (writes x402 defaults to `~/.env`)
2. Set sender private keys in your terminal:
   ```bash
   export PRIVATE_KEY=0x...          # Base Sepolia sender
   export SOLANA_PRIVATE_KEY=...     # Solana Devnet sender
   ```
3. Run test scripts:
   ```bash
   ./scripts/x402-run-all-tests.sh http://localhost:7044
   ```

### Monitoring

Watch for these log messages:
- `x402 request` — incoming request with `payment_sent` indicating if a signature was present
- `x402 result` — outcome with status code and error details (if any)
- `auth env var is unset` — an integration's API key env var is not configured (upstream call will fail)

### Testnet Configuration (Hardcoded)

| Item | Solana Devnet | Base Sepolia |
|---|---|---|
| **Receiver** | `7BUgACDYC5wenaSp6K97mmd2nEkZufoaYR9HrZPzYqsb` | `0xC0A3FB6d3F1f4B54617d29ffbdA4663Af5F96e2e` |
| **USDC (official)** | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| **Price per call** | 0.01 USDC | 0.01 USDC |

**Sender wallets (for test scripts only):**
- Solana Devnet: `G53EbeTZSNsAn7bj6iMFUQnq3zpDdEbHhKkPRywo8bix`
- Base Sepolia: `0xB82E4DE09f1C43BBD9ca4907c01f1EEd65a521B9`

---

## For Executives

### What x402 Enables

x402 makes every subnet API call a paid transaction. This creates a direct revenue link between inference providers and consumers:

1. **Miners set their own price** via `min_price_usdc` in the on-chain integration registry
2. **Consumers pay per call** — no subscriptions, no API keys to manage
3. **Facilitator handles settlement** — the node operator never handles private keys or on-chain transactions
4. **Multi-chain support** — payments accepted on Base, Polygon, and Solana

### Pricing Model

Each integration declares a floor price in USDC. The x402 middleware dynamically selects this price at request time:

```
Integration YAML:     on_chain.min_price_usdc: 0.05
                         ↓
Node x402 middleware: "$0.05" per request for this subnet
                         ↓
Facilitator verifies: 0.05 USDC transferred to receiving address
                         ↓
Upstream proxied:     Payment verified → request forwarded
```

The minimum price is 0.01 USDC (10,000 in 6-decimal representation on-chain). This prevents spam while keeping micropayments viable.

### Design Decisions

1. **Facilitator model, not self-verification:** The node operator does not need to run verification infrastructure or manage replay protection. PayAI handles all of this.

2. **Dynamic pricing:** Prices are not hardcoded in the middleware. They come from the live integration config, so newly registered integrations get correct pricing immediately without restart.

3. **Discovery routes are free:** Health checks, integration listings, and OpenAPI specs are ungated. Only actual subnet API calls (under `/v1/`) require payment.

4. **Default price fallback:** If an integration doesn't declare `min_price_usdc` or sets it to 0, the default `$0.01` applies. This ensures every call is paid even if the integration author didn't set a price.

5. **Three network support:** Base Sepolia (EVM testnet), Polygon (EVM mainnet), and Solana Devnet (SVM) are configured simultaneously. The client chooses which network to pay on based on the `accepts` array in the 402 response.

### Error Responses

| Condition | HTTP Status | Body |
|---|---|---|
| No `PAYMENT-SIGNATURE` | 402 | Payment requirements JSON with `accepts[]` |
| Invalid signature (decode/parse) | 400 or 402 | `{"error":"Invalid PAYMENT-SIGNATURE","detail":"..."}` |
| Facilitator rejects | 402 or 500 | `{"error":"Payment verification failed","detail":"..."}` |
| Subnet not found (after payment) | 404 | `{"error":"subnet not found"}` |
| Upstream error (after payment) | 502 | `{"error":"subnet upstream error","detail":"..."}` |
| Success | 200 | Upstream response body + `PAYMENT-RESPONSE` header |

### Known Limitations

1. **No on-chain settlement yet:** The facilitator verifies payments but doesn't settle them on-chain. A future update will add async `/settle` calls after successful 200 responses.

2. **Config is hardcoded:** Network IDs, contract addresses, and default prices are hardcoded in `subnet-dispatcher.go`. These should be moved to env vars or config for mainnet.

3. **No payment splitting:** The full payment goes to a single receiving address. Revenue splitting between node operator and miner is not yet implemented.

4. **GET requests only for some subnets:** Some x402 clients may not handle body in GET requests correctly. The test endpoint and most subnet APIs work with GET, but POST-based subnets require careful client implementation.

---

## Related Documentation

- [Integration Registry](miner-registry.md) — On-chain pricing via `min_price_usdc`
- [YAML Miner Standard](yaml-standard.md) — How to declare `on_chain.min_price_usdc` in miner YAMLs
- [Subnet Dispatcher Overview](../documentation/SUBNET_DISPATCHER_OVERVIEW.md) — Dispatcher architecture and request flow