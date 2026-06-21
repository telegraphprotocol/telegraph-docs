# x402 Payment Protocol

## Overview

Telegraph uses the **x402 protocol** to gate subnet API calls behind per-request micropayments. When x402 is enabled, every request to a subnet endpoint requires payment — unauthorized requests receive HTTP 402 with payment instructions, and authorized requests are forwarded to the subnet.

Pricing is **per-subnet and dynamic**: each miner sets a floor price at registration time via `min_price_usdc`. Subnets without a declared price default to $0.01 per call.

---

## Payment Flow

x402 follows a standard request-pay-retry cycle:

1. **Unauthorized request** — The client calls a subnet endpoint without a payment proof. The node returns HTTP 402 with a JSON body listing accepted payment options (network, token, amount, destination address).
2. **Payment** — The client uses an x402-compatible payment client to submit a USDC micropayment on-chain. The payment client produces a signed payment proof.
3. **Paid request** — The client retries the original request with the payment proof in the `PAYMENT-SIGNATURE` header. The node forwards the proof to the payment facilitator (PayAI) for verification.
4. **Response** — On successful verification, the node proxies the request to the upstream subnet and returns the result.

Payment verification is handled by the facilitator — the node never manages on-chain state or replay protection directly.

---

## HTTP Headers

| Header | Direction | Description |
|---|---|---|
| `PAYMENT-REQUIRED` | Server → Client (402) | Base64-encoded JSON listing accepted payment options |
| `PAYMENT-SIGNATURE` | Client → Server | Signed payment proof from the x402 client |
| `PAYMENT-RESPONSE` | Server → Client (200) | Confirms payment was accepted |

### 402 Response Body

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
      "payTo": "7BUgACDYC5wenaSp6K97mmd2nEkZufoaYR9HrZPzYqsb"
    }
  ]
}
```

The client selects a payment option and submits USDC on the chosen network.

---

## Dynamic Pricing

Telegraph uses a two-tier pricing model:

1. **Floor price** — Each miner sets `minPriceUsdc` at registration time. This is the minimum per-call cost and is committed on-chain (immutable without re-registration). The minimum floor price is $0.01 USDC (10,000 in 6-decimal format).

2. **Demand-tier multipliers** — The protocol applies automatic price multipliers based on 24-hour request volume per intent. Operators configure threshold tiers on-chain via the PricingFacet. For example:
   - 0–99 requests/24h → 1.0x (base price)
   - 100–499 requests/24h → 1.5x
   - 500–999 requests/24h → 2.0x
   - 1000+ requests/24h → 4.0x

A 24-hour rolling volume tracker counts requests per intent and pushes counts on-chain hourly. The node reads the miner's on-chain committed price and the current demand multiplier at request time — the YAML's `on_chain.min_price_usdc` field is informational; the on-chain committed value is the source of truth.

A 2% protocol fee (200 basis points) is applied to every transaction. The remaining USDC is swapped for MACHINA tokens via Uniswap V3 and sent to the miner.

---

## Supported Networks

| Network | Type | Notes |
|---|---|---|
| Base Sepolia | EVM testnet | Default testnet network |
| Polygon | EVM mainnet | USDC (6-decimal) |
| Solana Devnet | SVM | Default Solana network |

The client receives the full list of accepted networks in the 402 response and chooses which one to pay on.

---

## Discovery Routes (No Payment Required)

The following endpoints are always accessible without payment:

- `GET /subnet-dispatcher/healthz`
- `GET /subnet-dispatcher/integrations`
- `GET /subnet-dispatcher/openapi.yaml`
- `GET /subnet-dispatcher/openapi.json`

Only subnet inference calls (under `/v1/`) require payment.

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

x402 activates when `FACILITATOR_URL` and at least one receiving address are configured. If either is missing, the node serves all subnet requests without payment gating and logs a warning at startup.

**Never put private keys in `.env` or configuration files.** Only your public receiving wallet address goes here.

### Testnet Defaults

| Network | Receiver | USDC Contract | Base Price |
|---|---|---|---|
| Base Sepolia | `0x43Eb1B49a079a4587E0D7e8dA81035dc791c91F8` | `0xfFC3a7e0F71E9b48D8DBa86dc7d7B44aB24edD18` | 0.01 USDC |
| Solana Devnet | `8mVxpTSb8F3SGmiJUc8tkpiL6DxCTtNR6eTCQQ9FxwfW` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | 0.01 USDC |

---

## For Miners

Set your per-call floor price at registration via `min_price_usdc`. This value is committed on-chain at registration time and is immutable — to change your price, deregister and re-register with a new entry.

See [YAML Standard](yaml-standard.md) for how to declare `on_chain.min_price_usdc` in your miner YAML.

---

## What x402 Enables

x402 makes every subnet API call a paid transaction — no subscriptions, no API keys to manage. Miners set their own price. Consumers pay per call. The payment facilitator handles verification; node operators never manage private keys or on-chain transactions directly.

**Multi-chain support:** Payments are accepted on Base, Polygon, and Solana simultaneously. The client chooses which network to pay on based on the options returned in the 402 response.

### Error Responses

| Condition | HTTP Status | Meaning |
|---|---|---|
| No payment proof | 402 | Returns payment requirements |
| Invalid proof | 400 or 402 | Proof could not be parsed |
| Facilitator rejects | 402 or 500 | Payment not verified |
| Subnet not found (after payment) | 404 | No registered subnet at that ID |
| Upstream error (after payment) | 502 | Subnet returned an error |
| Success | 200 | Inference result returned |

---

## Related Documentation

- [Miner Registry](miner-registry-facet.md) — On-chain pricing via `min_price_usdc`
- [YAML Standard](yaml-standard.md) — How to declare `on_chain.min_price_usdc` in miner YAMLs
