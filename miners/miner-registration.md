---
description: Step-by-step guide to registering your miner on-chain and going live on the Telegraph network.
---

# Registering as a Miner

Registration is permissionless — anyone can register a miner. Once registered, Telegraph nodes automatically detect your YAML, validate it, and add you to the routing pool within the next epoch boundary. No approval needed, no contact with the team required.

## Prerequisites

Before registering, make sure you have:

1. **A completed YAML file** — see [YAML Configuration](yaml-config.md) for the full reference.
2. **A hosted YAML** — the file must be publicly accessible at a stable URL. IPFS is strongly recommended for censorship resistance and permanent hosting. HTTPS is also acceptable.
3. **100 MACHINA for the bond** — locked per registration, returned after the 7-day unbonding period on deregistration.
4. **A small amount of ETH on Base Sepolia** — for gas on the registration transaction.
5. **A fee address** — the EVM wallet where your MACHINA payouts will be sent. Can be the same as your registering wallet or a separate cold address.
6. **`cast` (Foundry)** — the CLI tool used to send the registration transaction. Install at [getfoundry.sh](https://getfoundry.sh).

## Step 1: Compute the YAML Hash

The on-chain registry requires a SHA-256 hash of your raw YAML file bytes. This hash is what nodes use to verify the YAML you host matches what you committed to on-chain.

```bash
sha256sum my-miner.yaml | awk '{print "0x"$1}'
```

Save this hash — you'll need it in the registration transaction. If you change the YAML file after computing the hash, you must recompute it.

> **Important:** Use SHA-256, not keccak256. The node verifies using SHA-256.

## Step 2: Upload Your YAML

Upload the YAML to IPFS or a stable HTTPS URL. The URL must remain accessible as long as your miner is registered — nodes fetch it at registration time and again whenever they rehydrate from on-chain state.

For IPFS, you'll get a URL like: `ipfs://bafkreig5nxc...`

For HTTPS: `https://your-host.com/miner.yaml`

## Step 3: Register On-Chain

Call `registerMiner` on the Diamond contract. Set your environment variables first:

```bash
export DIAMOND="0x45b0A6e07E2e15D203f3B5285945c549221f5b0a"
export RPC="https://base-sepolia.g.alchemy.com/v2/<YOUR_ALCHEMY_KEY>"
export YAML_URL="ipfs://bafkreig5nxc..."
export YAML_HASH="0x$(sha256sum my-miner.yaml | awk '{print $1}')"
export FEE_ADDRESS="0xYourFeeAddress"
export MIN_PRICE=10000          # 0.01 USDC in 6-decimal units (minimum allowed)
export MINER_PRIVATE_KEY="0x..."
```

Then send the transaction:

```bash
cast send "$DIAMOND" \
  "registerMiner(string,bytes32,address,uint256,string[])" \
  "$YAML_URL" \
  "$YAML_HASH" \
  "$FEE_ADDRESS" \
  "$MIN_PRICE" \
  '["WEATHER_FORECAST","WEATHER_CHECK"]' \
  --rpc-url "$RPC" \
  --private-key "$MINER_PRIVATE_KEY"
```

### Parameter Reference

| Parameter | Description |
|---|---|
| `yamlUrl` | IPFS or HTTPS URL where your YAML is hosted |
| `yamlHash` | SHA-256 of raw YAML bytes, prefixed with `0x` |
| `feeAddress` | EVM address for MACHINA payouts (must be non-zero) |
| `minPriceUsdc` | Floor price in 6-decimal USDC (minimum: `10000` = $0.01). **Immutable after registration.** |
| `supportedIntents` | JSON array of at least one canonical Intent string |

The intent strings in the `supportedIntents` array must match the canonical list (e.g., `"WEATHER_FORECAST"` not `"weather_forecast"`). Declaring Intents outside the canonical list is accepted but won't receive autonomous routing.

## Step 4: Confirm the Registration

The transaction emits a `MinerRegistered` event with:

| Field | Description |
|---|---|
| `registrationId` | Unique sequential ID for this registration |
| `miner` | Your registering address |
| `intentId` | Derived: `keccak256(miner || yamlHash || blockNumber)` |
| `yamlUrl` | The URL you provided |
| `yamlHash` | The hash you committed |
| `feeAddress` | Your payout address |
| `minPriceUsdc` | Your declared floor price |

You can query the registration by its ID to confirm it was recorded:

```bash
cast call "$DIAMOND" \
  "getMiner(uint256)" <registrationId> \
  --rpc-url "$RPC"
```

## Step 5: Wait for Nodes to Activate You

Within the next epoch boundary (up to ~60 seconds in dev mode, 24h in production), every Telegraph node that detects the `MinerRegistered` event will:
1. Fetch your YAML from the declared URL.
2. Verify the SHA-256 hash matches the on-chain commitment.
3. Validate the YAML against the schema.
4. Activate you in their routing engine.

You can verify you're live by checking the integrations endpoint on any running node:

```bash
curl http://13.237.89.59:7044/miner-dispatcher/integrations
```

Your miner's slug should appear in the response JSON.

If your YAML fails validation (hash mismatch, missing required fields, invalid schema), the node stores your registration as rejected. You must deregister and re-register with a corrected YAML.

## Step 6: The Grace Period

For your first 7 days after activation, you're in the grace period:
- You receive a flat share of 5% of all routed traffic for your declared Intents, shared equally with other grace-period miners.
- This gives you enough requests to build a quality track record before competing on the leaderboard.

After 7 days, your score from the grace period determines your starting leaderboard position.

## Updating Your Miner

There is no update function. To change your YAML, floor price, fee address, or Intents:

1. Call `deregisterMiner(registrationId)` — this deactivates your current entry.
2. Update your YAML at the hosting URL (or use a new URL).
3. Call `registerMiner(...)` with the new URL, new hash, and any new parameters — you receive a new `registrationId`.

The 7-day unbonding period applies to deregistration. Your bond is returned after unbonding completes.

```bash
cast send "$DIAMOND" \
  "deregisterMiner(uint256)" \
  <registrationId> \
  --rpc-url "$RPC" \
  --private-key "$MINER_PRIVATE_KEY"
```

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Miner stuck in pending state | No epoch boundary has passed yet | Wait for the next epoch |
| "Hash mismatch" in node logs | YAML content changed after computing the hash | Deregister, recompute hash, re-register |
| "Schema validation failed" | Missing required fields in YAML | Check against [YAML Configuration](yaml-config.md) field reference |
| Not appearing in `/integrations` | Node hasn't processed the epoch boundary yet | Wait one epoch, check node logs |
| Getting zero traffic after grace period | Low leaderboard score | Improve response quality and consistency |
