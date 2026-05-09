# Miner Registry — Technical Documentation

## Overview

The Miner Registry is Telegraph's on-chain system for permissionless miner integration. Any miner can register their YAML configuration on-chain; every Telegraph node automatically discovers, validates, and activates it without restarts.

The system has three layers:

1. **On-chain registry** — Solidity contract stores registration metadata and emits events
2. **Off-chain listener** — Go service that catches events, fetches YAMLs, validates schemas, and persists to Cassandra
3. **Hot-reload dispatcher** — Loads validated YAMLs into the live routing engine at epoch boundaries

---

## Architecture

```
Miner                           Smart Contract               Telegraph Node
  │                                 │                            │
  │  registerMiner(           │                            │
  │    yamlUrl, yamlHash,           │                            │
        │                            │
  │    minPriceUsdc,                │                            │
  │    supportedIntents)           │                            │
  │────────────────────────────────▶│                            │
  │                                 │  MinerRegistered     │
  │                                 │  event emitted             │
  │                                 │───────────────────────────▶│
  │                                 │                            │ Live path:
  │                                 │                            │  Fetch YAML from URL
  │                                 │                            │  Verify sha256 == yamlHash
  │                                 │                            │  Validate against v2 schema
  │                                 │                            │  Upsert DB as "pending"
  │                                 │                            │
  │                                 │    At epoch boundary ──▶  │ Epoch catch-up path:
  │                                 │                            │  Call minerCount() on-chain
  │                                 │                            │  Call getDeregisteredIdCount()
  │                                 │                            │  Process delta: new IDs & deregistrations
  │                                 │                            │  activatePending() → "active"
  │                                 │                            │
  │  deregisterMiner(id)     │                            │
  │────────────────────────────────▶│  MinerDeregistered   │
  │                                 │───────────────────────────▶│
  │                                 │                            │ Live path: immediate HotUnregister
  │                                 │                            │ Epoch path: catch missed deregistrations
```

---

## For Developers

### Key Design Decisions

1. **Epoch-based activation (not immediate):** New integrations are stored as "pending" and promoted to "active" only at an epoch boundary. This ensures all nodes converge on the same block.

2. **Dual-index catch-up (O(delta)):** The contract maintains `minerCount()` and `deregisteredIds[]`. At each epoch boundary, nodes compare their local sync state (`max_registration_id`, `deregistered_count`) against on-chain values and process only the delta. No event replay needed.

3. **Block-height epochs, not wall-clock:** The epoch interval is `EPOCH_BLOCK_INTERVAL` blocks (default 300 on mainnet, 5 for local Anvil testing). A `SubscribeNewHead` subscription detects epoch boundaries even when `anvil_mine N` delivers only the final header.

4. **Startup rehydration:** On connect/reconnect, `hydrateDispatcher()` loads all "active" integrations from Cassandra into the in-memory dispatcher. No data is lost on restart.

5. **Rejected YAMLs are stored, not dropped:** If YAML fetch, hash verification, or schema validation fails, the record is stored as "rejected". The miner must deregister and re-register with a new ID to replace it.

6. **No updateMiner function:** Miners deregister the old miner and register a new one. The contract is monotonic — `registrationId` only increments, and deregistered IDs are appended to an immutable array.

7. **Same slug allowed across registrations:** Multiple registrations can share the same slug (e.g., after deregister + re-register). The dispatcher's `HotRegister` replaces by slug — the latest active record wins. Past registrations with the same slug remain in the DB as "deregistered" or "rejected" for audit.

### Smart Contract (`MinerRegistryFacet.sol`)

**Storage:**
```solidity
struct MinerRecord {
    address   miner;
    string    yamlUrl;           // Off-chain URL (ipfs:// or https://)
    bytes32   yamlHash;          // sha256 of raw YAML bytes

    bool      active;
    bytes32   intentId;          // H(msg.sender || yamlHash || block.number)
    address   feeAddress;        // Miner's Machina payout address
    uint256   minPriceUsdc;      // Floor price in 6-decimal USDC (min 0.01 = 10000)
    string[]  supportedIntents;  // Declared Intent IDs
}

uint256 minerCounter;                        // Monotonic counter = max ID
mapping(uint256 => MinerRecord) minerRecords;
uint256[] deregisteredIds;                          // Append-only deregistration index
```

**Functions:**

| Function | Purpose |
|---|---|
| `registerMiner(yamlUrl, yamlHash, feeAddress, minPriceUsdc, supportedIntents)` | Register a new YAML integration. Returns `registrationId`. |
| `deregisterMiner(registrationId)` | Deactivate and push to `deregisteredIds`. Only original miner. |
| `getMiner(registrationId)` | Returns all fields. Used by epoch catch-up. |
| `minerCount()` | Total registrations ever (including deregistered). |
| `getDeregisteredIdCount()` | Length of `deregisteredIds` array. |
| `getDeregisteredIdAtIndex(index)` | Access `deregisteredIds[index]`. |
| `getCanonicalIntents()` | Returns the 27 genesis intent strings (pure view). |

**Validation:**
- `yamlUrl` must be non-empty
- `yamlHash` must be non-zero
- `feeAddress` must be non-zero
- `minPriceUsdc` must be >= 10,000 (0.01 USDC in 6 decimals)
- `supportedIntents` must be non-empty

### Off-Chain Processing (`pkg/listener/listener.integration.go`)

**Live event path:**
1. `MinerRegistered` event → `minerRegisteredEvent()` → contract call `getMiner(id)` → `processMinerRecord()`
2. `MinerDeregistered` event → `integrationDeregisteredEvent()` → immediate `MarkDeregistered` in DB + `HotUnregister` from dispatcher

**Epoch catch-up path (`epochCatchUp`):**
1. Compare `minerCount()` vs local `max_registration_id` — fetch new registrations by calling `getMiner(id)` for each new ID
2. Compare `getDeregisteredIdCount()` vs local `deregistered_count` — process new deregistrations via `getDeregisteredIdAtIndex(i)`
3. Call `activatePending()` — promote "pending" → "active" via `HotRegister`
4. Persist sync state to `miner_meta` table

**Process flow for a new registration:**
```
MinerRegistered event
  → getMiner(id) via ethclient
  → fetchYAML(yamlUrl) with 30s timeout, 512KB limit
  → verify sha256 == yamlHash
  → extractSlug() from YAML content
  → schema validation via LoadBytes()
  → Upsert to Cassandra as "pending" or "rejected"
  → (at next epoch boundary) activatePending() → HotRegister()
```

**Hash verification:** The node computes `sha256(rawYAML)` and compares it against the on-chain `yamlHash`. If they don't match, the record is stored as "rejected".

**Schema validation:** Uses the same JSON Schema validation as the file-based loader (`integration.v2.schema.json`). Invalid YAMLs are stored as "rejected" with the validation errors logged.

**URI resolution:** `ipfs://` URIs are resolved through an IPFS gateway (default: `https://ipfs.io/ipfs`), configurable via `IPFS_GATEWAY_URL`.

### Hot-Reload Flow

When an integration is activated at an epoch boundary:
```
activatePending()
  → FindByStatus("pending") from Cassandra
  → For each pending record:
      → HotRegister(rawYAML) on the dispatcher
      → LoadBytes() validates against v2 schema
      → generic.New(cfg) creates a new Adapter
      → reg.Upsert(adapter) replaces any existing adapter with same slug
      → MarkActive(integrationID) in Cassandra
```

If `HotRegister` fails (schema validation error), the record stays "pending" and will be retried at the next epoch. If the YAML is structurally invalid (can't parse at all), it stays "rejected" permanently.

### Cassandra Schema

```sql
-- Miner records (migration 003 + 004)
CREATE TABLE telegraph.miner_registry (
    integration_id    bigint PRIMARY KEY,
    subnet_id          int,
    miner_address      text,
    yaml_url           text,
    yaml_hash          text,
    yaml_raw           text,
    slug               text,
    activation_status  text,          -- "pending" | "active" | "deregistered" | "rejected"
    intent_id          text,
    fee_address        text,
    min_price_usdc     bigint,
    supported_intents  text,          -- JSON-encoded string array
    registered_at      timestamp,
    updated_at         timestamp
);

-- Epoch sync state (migration 004)
CREATE TABLE telegraph.miner_meta (
    key       text PRIMARY KEY,
    int_value bigint
);
-- Keys: "max_registration_id", "deregistered_count"
```

### Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `EPOCH_BLOCK_INTERVAL` | 300 | Number of blocks between epoch-boundary checks. Set to 5 for local Anvil testing. |
| `IPFS_GATEWAY_URL` | `https://ipfs.io/ipfs` | Gateway for resolving `ipfs://` URIs. |

---

## For Node Operators

### Configuration

Add to your `.env`:
```
EPOCH_BLOCK_INTERVAL=300
```

For local Anvil testing, set `EPOCH_BLOCK_INTERVAL=5` for faster epochs.

### Monitoring

Watch for these log messages:
- `hydrateDispatcher: loaded N active integrations from cache` — startup rehydration
- `Epoch tracker initialised at block N` — node connected and tracking epochs
- `Epoch boundary crossed at block N` — epoch boundary detected
- `epochCatchUp: done count=X deregCount=Y` — successful epoch sync
- `epochCatchUp: skipping, previous run still in progress` — concurrent epoch prevented
- `processMinerRecord: fetch failed` / `hash mismatch` / `schema validation failed` — YAML failures (stored as "rejected")
- `activatePending: activated slug=X` — integration promoted to active
- `hot-registered integration slug=X` — dispatcher hot-reload successful

### Database Health

```sql
-- Count integrations by status
SELECT activation_status, COUNT(*) FROM telegraph.miner_registry ALLOW FILTERING GROUP BY activation_status;

-- Check epoch sync state
SELECT * FROM telegraph.miner_meta;

-- Find rejected integrations (need miner re-registration)
SELECT integration_id, slug, miner_address FROM telegraph.miner_registry WHERE activation_status = 'rejected' ALLOW FILTERING;

-- Find active integrations
SELECT integration_id, slug, yaml_url FROM telegraph.miner_registry WHERE activation_status = 'active' ALLOW FILTERING;
```

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Miners stuck at "pending" | No epoch boundary crossed | Mine blocks to next epoch (`EPOCH_BLOCK_INTERVAL` blocks) |
| `getDeregisteredIdAtIndex failed: abi pack` | Old binary without `*big.Int` fix | Rebuild and redeploy the telegraph binary |
| `schema validation failed registrationId=N errors=[]` | Invalid YAML syntax (can't parse) | Check the `yaml_url` content; miner must deregister and re-register |
| `schema validation failed registrationId=N errors=[(root): base_url is required]` | Valid YAML but missing required fields | Miner must fix the YAML and re-register |
| Multiple active records for same slug | Expected behavior — latest wins | `HotRegister` replaces by slug; old records stay as audit trail |
| `hash mismatch` | YAML content changed after registration | Miner must re-register with the correct hash |

---

## For Miners

### Registering a Miner

```bash
# 1. Compute sha256 of your YAML
YAML_HASH="0x$(sha256sum my-integration.yaml | awk '{print $1}')"

# 2. Host the YAML (e.g., IPFS, S3, or any HTTPS URL)
YAML_URL="https://my-bucket.s3.amazonaws.com/my-integration.yaml"
# Or: YAML_URL="ipfs://Qm..."

# 3. Call registerMiner on the Diamond contract
cast send \
  --rpc-url "$RPC_URL" \
  --private-key "$MINER_KEY" \
  "$DIAMOND_ADDR" \
  "registerMiner(string,bytes32,uint256,address,uint256,string[])" \
  "$YAML_URL" "$YAML_HASH" 18 \
  "$FEE_ADDRESS" 10000 \
  "[\"chat_completion\",\"web_search\"]"
```

**Parameters:**
- `yamlUrl`: HTTPS or IPFS URL where the YAML is hosted
- `yamlHash`: sha256 of the raw YAML bytes (prefix with `0x`)

- `feeAddress`: EVM address where payouts are sent (must be non-zero)
- `minPriceUsdc`: Floor price in 6-decimal USDC. Minimum is 10000 (= $0.01). Immutable per registration — deregister + re-register to change.
- `supportedIntents`: Array of canonical intent strings (at least one)

### Canonical Intents

These 27 intents are hardcoded on-chain via `getCanonicalIntents()`:

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

Declaring intents not in this list logs a warning. The integration still loads, but the autonomous engine won't route unknown intents.

### Updating a Miner

There is no `updateMiner` function. To change your YAML, fee address, or floor price:

1. Call `deregisterMiner(oldId)` — your old miner becomes inactive
2. Update your YAML file on the hosting URL
3. Call `registerMiner(newYamlUrl, newYamlHash, ...)` — creates a new ID

### Deregistering

```bash
cast send \
  --rpc-url "$RPC_URL" \
  --private-key "$MINER_KEY" \
  "$DIAMOND_ADDR" \
  "deregisterMiner(uint256)" \
  "$INTEGRATION_ID"
```

Only the original registering address can deregister. Deregistration is immediate on live nodes (HotUnregister) and caught at the next epoch boundary for nodes that were offline.

---

## For Executives

### What Was Built

The Miner Registry is the on-chain component of Telegraph's open integration standard. It allows any Miner to permissionlessly register their YAML configuration on the Base L2 blockchain, and every Telegraph node automatically discovers, validates, and activates the integration without restarts.

### Whitepaper Alignment

| Whitepaper Section | Requirement | Implementation |
|---|---|---|
| §4.1 Supported Intents | Array in registration | `supportedIntents` parameter on-chain |
| §4.1 Fee Address | Miner payout address | `feeAddress` parameter on-chain |
| §4.1 min_price_usdc | Floor price | `minPriceUsdc` parameter (min 0.01 USDC) |
| §4.1 YAML Schema Hash + URL | Off-chain YAML reference | `yamlHash` + `yamlUrl` (per CTO directive, uses `yamlUrl` not `yamlUri`) |
| §4.1 Intent_ID | H(Registrant \|\| YAML_Hash \|\| Block_Number) | Computed as `intentId` on-chain |
| §4.1 Permissionless registration | Any address can register | No whitelisting |
| §4.1 Floor price immutable | Cannot change after registration | Must deregister + re-register |
| §9.2 Canonical Intents | 27 genesis intents | `getCanonicalIntents()` pure view |

### What Was Deferred

| Feature | Reason |
|---|---|
| Miner bond (100 Machina deposit) | Requires token contract integration; not yet in the Port Contract |
| On-chain writable Intent registry | Hardcoded genesis list; governance (§10) will make it writable |
| Peer-node YAML fallback | Needs new HTTP endpoint; low priority before mainnet |
| On-chain callback for hash verification |

### How It Works at Scale

- **O(delta) epoch catch-up:** Only new IDs and deregistrations since the last sync are processed, not O(N) total records
- **Concurrent-safe:** `epochCatchUp` uses `TryLock` — if a previous run is still in progress, the epoch is skipped
- **Rejected YAMLs are stored, not dropped:** Failed fetches or schema mismatches are stored as "rejected" — the node doesn't lose track
- **Fresh nodes catch up from scratch:** `GetMeta` returns 0 for missing keys, so `epochCatchUp` processes all on-chain records from ID 1 on first run
- **Slug-based dedup in dispatcher:** `HotRegister` replaces by slug — the latest active registration wins. Old records stay in DB for audit.

### Known Limitations

1. **Deregistered integration served between live-event and next epoch:** If a node is offline when `MinerDeregistered` fires, it keeps serving the old miner until the next epoch boundary. The miner bond (when implemented) is the economic deterrent.

2. **Rejected YAMLs are never retried:** If a YAML fetch or schema validation fails, the record sits as "rejected" indefinitely. The miner must deregister and re-register with a new ID.

3. **URL going offline after caching:** Once cached in Cassandra, the node serves from local DB. A fresh node that has never seen the registration will fail to fetch and store as "rejected".

4. **`intentId` not in event emissions:** Nodes query `intentId` via `getMiner()` during epoch catch-up. When the full Port Contract uses `intentId` for payment routing, we'll add it to the `MinerRegistered` event (breaking change, scheduled for Port Contract phase).

---

## Related Documentation

- [YAML Miner Standard](yaml-standard.md) — Full reference for writing miner YAML files
- [x402 Payment Protocol](x402-payment.md) — How per-request payments work
- [Miner Registry Discussion](../documentation/integration-registry-discussion.md) — Original team discussion and decisions