# Miner Registry

## Overview

The Miner Registry is Telegraph's on-chain system for permissionless miner registration. Any miner can register their YAML configuration on-chain; every Telegraph node automatically discovers, validates, and activates it — no restarts required.

The system has three layers:

1. **On-chain registry** — Smart contract stores registration metadata and emits events when miners register or deregister.
2. **Off-chain discovery** — Nodes listen for registration events, fetch and validate YAML files from the declared URL, and stage them for activation.
3. **Live routing** — Validated miners are loaded into the node's routing engine at epoch boundaries without requiring a restart.

---

## How Registration Works

When a miner registers on-chain:

1. The miner's YAML URL, its SHA-256 hash, supported intents, fee address, and floor price are stored on-chain and a unique `registrationId` is issued.
2. Telegraph nodes detect the registration event and fetch the YAML from the declared URL.
3. The node verifies that the fetched YAML's SHA-256 hash matches the on-chain commitment.
4. If valid, the YAML is staged as pending and activated at the next epoch boundary.
5. Once active, the miner is live in the node's routing engine with no restart needed.

Deregistered miners are removed from routing immediately on live nodes, and caught up at the next epoch boundary for nodes that were offline.

---

## On-Chain Contract

`MinerRegistryFacet` is deployed as a facet on the Telegraph Diamond contract (Base). It provides:

- **Register** — Submit a new miner entry with YAML URL, hash, fee address, floor price, and supported intents. Returns a unique `registrationId`.
- **Deregister** — Deactivate a miner by `registrationId`. Only the original registering address can deregister.
- **Query** — Look up registration details by ID, get the total registration count, or retrieve the list of canonical intent IDs supported by the protocol.

---

## For Miners

### Registering

To register a miner on-chain, call `registerMiner` on the Diamond contract with:

| Parameter | Description |
|---|---|
| `yamlUrl` | HTTPS or IPFS URL where your YAML is hosted (e.g. `https://...` or `ipfs://...`) |
| `yamlHash` | SHA-256 of the raw YAML bytes, prefixed with `0x` |
| `feeAddress` | EVM address where payouts are sent (must be non-zero) |
| `minPriceUsdc` | Floor price per call in 6-decimal USDC. Minimum is 10,000 (= $0.01). Immutable per registration. |
| `supportedIntents` | Array of at least one canonical intent string |

### Updating a Miner

There is no update function. To change your YAML, fee address, or floor price:

1. Call `deregisterMiner(registrationId)` to deactivate the current entry
2. Update your YAML file at the hosting URL (or use a new URL)
3. Call `registerMiner(...)` with the new YAML URL and hash — a new `registrationId` is issued

### Canonical Intents

Declare at least one intent from the canonical list. Intents outside this list are accepted but will not be routed by the autonomous engine.

| Intent | Intent | Intent |
|---|---|---|
| `language_generation` | `weather_check` | `multimodal_inference` |
| `chat_completion` | `storm_alert` | `image_generation` |
| `text_generation` | `weather_forecast` | `text_to_image` |
| `high_performance_inference` | `weather_risk_assessment` | `task_completion` |
| `embeddings` | | `agent_task` |
| `content_moderation` | | `web_search` |
| | | `twitter_search` |
| | | `news_search` |
| | | `research_synthesis` |
| | | `fact_check` |
| | | `text_authenticity_check` |
| | | `ai_text_detection` |
| | | `content_verification` |
| | | `deepfake_detection` |
| | | `media_authenticity_check` |
| | | `image_verification` |
| | | `video_verification` |

---

## For Node Operators

### Configuration

Add to your `.env`:

```
EPOCH_BLOCK_INTERVAL=300
```

For local testing with Anvil, set `EPOCH_BLOCK_INTERVAL=5` for faster epoch cycles.

| Variable | Default | Purpose |
|---|---|---|
| `EPOCH_BLOCK_INTERVAL` | 300 | Blocks between epoch-boundary checks |
| `IPFS_GATEWAY_URL` | `https://ipfs.io/ipfs` | Gateway for resolving `ipfs://` YAML URIs |

### What to Expect

At startup, the node loads all previously activated miners from its local database. At each epoch boundary, it checks for new registrations and deregistrations on-chain since the last sync and processes only the delta — no full history replay.

If a miner's YAML fails to fetch, fails hash verification, or fails schema validation, it is stored as rejected. The miner must deregister and re-register with a corrected YAML to retry.

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Miner stuck in pending | No epoch boundary has crossed yet | Wait for the next epoch, or lower `EPOCH_BLOCK_INTERVAL` for local testing |
| YAML validation failed | Missing required fields or invalid format | Check the hosted YAML against the [YAML Standard](yaml-standard.md); miner must deregister and re-register |
| Hash mismatch | YAML content changed after registration | The node compares the fetched YAML against the on-chain hash; miner must re-register with the correct hash |

---

## What the Miner Registry Enables

The Miner Registry is the on-chain component of Telegraph's open miner standard. Any miner can permissionlessly register their YAML configuration on Base, and every Telegraph node automatically discovers, validates, and activates it — no whitelisting, no approval required.

**Key properties:**

- **Permissionless** — Any address can register. No whitelisting or approval process.
- **Self-healing** — Nodes that were offline catch up automatically at the next epoch boundary without replaying full history.
- **Immutable floor price** — `min_price_usdc` is committed at registration and cannot be changed without re-registering, preventing bait-and-switch pricing.
- **Rejected entries are tracked** — Failed registrations are stored as rejected rather than silently dropped, preserving an audit trail.

---

## Related Documentation

- [YAML Standard](yaml-standard.md) — Full reference for writing miner YAML files
- [x402 Payment Protocol](x402-payment.md) — How per-request payments work
