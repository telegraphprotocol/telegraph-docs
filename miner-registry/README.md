# Miner Registry

The Miner Registry is Telegraph's on-chain registration system that binds
off-chain YAML configurations to on-chain miner identities. Miners declare
the intents they serve, their payout address, and minimum signal price via
an on-chain transaction. Telegraph nodes listen for these registrations,
validate the YAML, and hot-load miners into the dispatcher at each epoch
boundary — no restarts needed.

## What it does

Miners register permissionlessly on-chain with a YAML file. Nodes
discover them automatically — no code changes, no PRs, no redeploys.
The full YAML schema handles routing, authentication, signal types,
and on-chain data transformation declaratively.

## Architecture

```
Miner publishes YAML → on-chain registerMiner() tx
                              ↓
                    Node listens for MinerRegistered event
                              ↓
                    Fetches YAML from off-chain URL
                              ↓
                    Validates YAML hash + schema
                              ↓
                    Stores as 'pending' in Cassandra
                              ↓
                    At next epoch boundary → activates
                              ↓
                    Hot-loads into dispatcher (no restart)
```

## On-chain contract

`MinerRegistryFacet` (deployed as a Diamond facet on Base) provides:

- `registerMiner(yamlUrl, yamlHash, feeAddress, minPriceUsdc, supportedIntents)` — registers with a monotonic `registrationId`
- `deregisterMiner(registrationId)` — only callable by the original registrant
- `getMiner(registrationId)` — returns all stored fields
- `minerCount()` — total registrations (including deregistered)
- `getDeregisteredIdCount()` / `getDeregisteredIdAtIndex()` — epoch catch-up indexes
- `getCanonicalIntents()` — returns the 26 canonical intent IDs (uppercase, genesis-hardcoded)

See the [Miner Registry Contract](miner-registry-facet.md) for full details.

## YAML standard

Every miner publishes a YAML file at an off-chain URL. The YAML defines
endpoints, authentication, on-chain data layout, and supported intents.

See the [YAML Standard](yaml-standard.md) for the full schema specification.

## x402 payment

All miner API calls are gated behind x402 HTTP 402 Payment Required
semantics. The price per call is determined by the miner's on-chain committed
`minPriceUsdc`, enforced at registration time with a protocol minimum of 0.01 USDC.

See [x402 Payment](x402-payment.md) for the payment flow and configuration.
