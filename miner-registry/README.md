# Miner Registry

The Miner Registry is Telegraph's on-chain registration system that binds
off-chain YAML configurations to on-chain miner identities. Miners declare
the intents they serve, their payout address, and floor price via
an on-chain transaction. Telegraph nodes listen for these registrations,
validate the YAML, and hot-load miners into the dispatcher at each epoch
boundary — no restarts needed.

## What it does

Miners register on-chain with a YAML file hosted on IPFS or HTTPS, permissionlessly. Nodes
discover them automatically — no code changes, no PRs, no redeploys.
IPFS is recommended for permanent, censorship-resistant YAML hosting.
The full YAML schema handles routing, authentication, signal types,
and on-chain data transformation declaratively.

## Validation API (pre-registration)

Before registering on-chain, miners can test their YAML and API key
using the Validation endpoint. This sandbox-tests every declared endpoint
against the upstream API with the provided key — verifying connectivity,
authentication, and response validity before any on-chain commitment.

The validation endpoint is internal to node operators (requires `X-Internal-Secret`
header). If all endpoints pass, the API key is stored in the database for
use at dispatch time. If any endpoint fails, the miner gets a detailed
error report showing exactly which calls failed and why.

## Architecture

```
Miner writes YAML → tests via Validation API
                              ↓
                    All endpoints pass?
                              ↓
                    Miner publishes YAML to IPFS
                              ↓
                    Miner registers on-chain (URL + hash)
                              ↓
                    Node detects registration event
                              ↓
                    Fetches YAML from IPFS/HTTPS URL
                              ↓
                    Validates hash and schema
                              ↓
                    Resolves API key (DB first, env fallback)
                              ↓
                    Staged as pending
                              ↓
                    At next epoch boundary → activates
                              ↓
                    Live in routing engine (no restart)
```

## On-chain contract

`MinerRegistryFacet` is deployed as a Diamond facet on Base Sepolia. It supports:

- **Register** — Submit a new miner with YAML URL, hash, fee address, floor price, and supported intents
- **Deregister** — Deactivate a miner by registration ID (only the original registrant)
- **Query** — Look up registration details, total count, and canonical intent IDs

See the [Miner Registry Contract](miner-registry-facet.md) for full details.

## YAML standard

Every miner publishes a YAML file at an off-chain URL (IPFS or HTTPS). The YAML defines
endpoints, authentication, on-chain data layout, and supported intents.

See the [YAML Standard](yaml-standard.md) for the full schema specification.

## Dynamic pricing

Miners set a floor price (`minPriceUsdc`) at registration. On top of this,
the protocol applies demand-tier multipliers based on 24-hour request volume
per intent — busier intents cost more per call. Operators configure the tier
thresholds on-chain via the PricingFacet. The minimum floor price is
$0.01 USDC, with a 2% protocol fee applied to every transaction.

See [x402 Payment](x402-payment.md) for the full pricing and payment flow.

## x402 payment

All miner API calls are gated behind x402 HTTP 402 Payment Required
semantics. The price per call is determined by the miner's on-chain committed
`minPriceUsdc`, enforced at registration time with a protocol minimum of 0.01 USDC.
Payments are accepted on Base, Polygon, and Solana simultaneously.

See [x402 Payment](x402-payment.md) for the payment flow and configuration.
