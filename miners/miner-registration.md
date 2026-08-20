---
description: Step-by-step guide to registering your miner on-chain and going live on the Telegraph network.
---

# Registering as a Miner

Registration is permissionless — anyone can register a miner. Once registered, Telegraph nodes automatically detect your YAML, validate it, and add you to the routing pool. No approval needed, no contact with the team required.

## The easy way: the registration interface

**[integrate.telegraphprotocol.com](https://integrate.telegraphprotocol.com)** does the whole flow for you. Connect your wallet, paste your YAML, and it will:

- validate the YAML and sandbox-test your endpoints against your real API,
- pin the YAML to IPFS,
- send the `registerMiner` transaction from your wallet,
- store your **API key** against your slug, so an authenticated miner works without you sending the key to anyone.

Note the order: the key is stored **after** registration, because it is bound to the wallet that holds the slug. Sandbox-testing a key before you are registered still works and still reports pass/fail per endpoint — it just reports `api_key_stored: false`, and you install the key once you are live.

This is the recommended path, and the only one that lets you supply an API key yourself.

The rest of this page covers doing the same thing by hand with `cast` — useful if you want to script it or understand what the interface is doing on your behalf.

## Prerequisites

Before registering, make sure you have:

1. **A completed YAML file** — see [YAML Configuration](yaml-config.md) for the full reference, or copy [`example-miner.yaml`](https://github.com/telegraphprotocol/telegraph-examples/blob/master/frontend/yaml/example-miner.yaml) and edit it.
2. **A hosted YAML** — the file must be publicly accessible at a stable URL. IPFS is strongly recommended for censorship resistance and permanent hosting. HTTPS is also acceptable.
3. **A small amount of ETH on Base Sepolia** — for gas on the registration transaction. There is no bond, stake or fee; gas is the only cost.
4. **A fee address** — the EVM wallet where your MACHINA payouts will be sent. Can be the same as your registering wallet or a separate cold address.
5. **`cast` (Foundry)** — the CLI tool used to send the registration transaction. Install at [getfoundry.sh](https://getfoundry.sh).

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
export DIAMOND="0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8"
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
| `minPriceUsdc` | Floor price in 6-decimal USDC (minimum: `10000` = $0.01). Changeable later via `updateMiner`. |
| `supportedIntents` | JSON array of at least one canonical Intent string |

**Every intent you declare must be canonical, or the transaction reverts.** The contract checks each string against the on-chain canonical set and fails the whole registration with `MinerRegistryFacet: unsupported intent` if any one of them isn't recognised. Matching is exact and case-sensitive — `"WEATHER_FORECAST"`, not `"weather_forecast"`.

Check before you send:

```bash
cast call "$DIAMOND" "isCanonicalIntent(string)(bool)" "WEATHER_FORECAST" --rpc-url "$RPC"
cast call "$DIAMOND" "getCanonicalIntents()(string[])" --rpc-url "$RPC"   # the full live set
```

The canonical set changes over time — intents get added and removed. Read the live list rather than copying one out of a document.

## Step 4: Confirm the Registration

The transaction emits a `MinerRegistered` event with seven fields:

| Field | Description |
|---|---|
| `registrationId` | Unique sequential ID for this registration (indexed) |
| `miner` | Your registering address (indexed) |
| `yamlUrl` | The URL you provided |
| `yamlHash` | The hash you committed |
| `feeAddress` | Your payout address |
| `minPriceUsdc` | Your declared floor price |
| `supportedIntents` | The intents you declared |

Your registration also gets an `intentId`, derived as `keccak256(miner ‖ yamlHash ‖ registrationBlock)`. It is **not** in the event — read it back from `getMiner`, where it is the fifth return value:

```bash
cast call "$DIAMOND" \
  "getMiner(uint256)(address,string,bytes32,bool,bytes32,address,uint256,string[])" \
  <registrationId> --rpc-url "$RPC"

# → field 4 (bool)    active
# → field 5 (bytes32) intentId  — agents pass this to createJob to target you specifically
```

## Step 5: Wait for Nodes to Activate You

Activation is driven by your registration event, not by any schedule — each node activates you as it processes that event, usually within a minute. There is no epoch boundary to wait for. Every Telegraph node that detects the `MinerRegistered` event will:
1. Fetch your YAML from the declared URL.
2. Verify the SHA-256 hash matches the on-chain commitment.
3. Validate the YAML against the schema.
4. Activate you in their routing engine.

You can verify you're live by checking the integrations endpoint on any running node:

```bash
curl https://devnode.telegraphprotocol.com/api/miners
```

Your miner's slug should appear in the response JSON.

If your API needs a key, install it now — the key is bound to the wallet holding the slug, so it cannot be installed before this point. See [API keys](yaml-config.md#api-keys).

### If it isn't there

`/api/miners` lists the miners a node has successfully **loaded**, so a registration whose YAML was rejected is absent from it by design. Absence is not evidence the node missed your event — check the registration itself, by the `registrationId` from your `registerMiner` receipt:

```bash
curl -s https://devnode.telegraphprotocol.com/api/miners/84 | jq '.miner | {activation_status, rejection_reason, retrying}'
```

```json
{
  "activation_status": "rejected",
  "rejection_reason": "YAML schema validation failed: [endpoints.0: Additional property input_schema is not allowed]. This will NOT be retried: fix the YAML and re-submit the registration with updateMiner().",
  "retrying": false
}
```

`activation_status` tells you whether to wait or to act:

| Status | What it means | What to do |
|---|---|---|
| `active` | Live and routable | Nothing |
| `pending` | YAML validated, activating shortly | Wait a few seconds |
| `unreachable` | The YAML URL didn't answer. `retrying: true` means the node is still trying — every ~5 min, up to 5 attempts | Nothing, unless it later becomes `rejected` |
| `rejected` | Terminal. `rejection_reason` says exactly why | Fix the cause, then `updateMiner` |
| `superseded` | A newer registration took your slug | Use the newer `registrationId` |
| `deregistered` | Withdrawn on-chain | Re-register if this wasn't intentional |

A rejection is **not** something you re-register from scratch — call `updateMiner` with the corrected URL and hash, see [Updating Your Miner](#updating-your-miner). Validate the fix at [integrate.telegraphprotocol.com](https://integrate.telegraphprotocol.com) before spending gas.

Always look your registration up **by `registrationId`**, not by slug. The by-slug lookup returns whoever is currently serving that slug — which, if you were rejected for a slug clash, is someone else.

### Identity rejections

Two terminal rejections concern identity rather than schema. Neither is retried, and both need a YAML change:

| `rejection_reason` says | Meaning | Fix |
|---|---|---|
| slug `"x"` is already served by an active registration owned by a different wallet | A slug is a miner's identity; only its owner may register it | Pick a different slug, or have the current owner `deregisterMiner` first |
| YAML id `"N"` is already in use by active miner `"y"` | `id` is the key requests are routed on — two miners sharing one would serve each other's traffic | Pick an unused id, re-pin, `updateMiner` |

Re-registering your *own* slug is never a clash: `updateMiner`, a plain re-register, and taking a slug whose previous holder deregistered all work without operator involvement.

**A rejected registration stops holding its slug**, so the name is claimable again immediately. If you were rejected, fix and re-submit promptly rather than leaving it.

## Step 6: The Grace Period

For your first 7 days after activation, you're in the grace period:
- You receive a flat share of 5% of all routed traffic for your declared Intents, shared equally with other grace-period miners.
- This gives you enough requests to build a quality track record before competing on the leaderboard.

After 7 days, your score from the grace period determines your starting leaderboard position.

## Updating Your Miner

Use `updateMiner` to change your YAML, floor price, fee address, or Intents in a single transaction. Update the hosted YAML first, then:

```bash
cast send "$DIAMOND" \
  "updateMiner(uint256,string,bytes32,address,uint256,string[])" \
  <oldRegistrationId> \
  "$YAML_URL" \
  "$YAML_HASH" \
  "$FEE_ADDRESS" \
  "$MIN_PRICE" \
  '["WEATHER_FORECAST","WEATHER_CHECK"]' \
  --rpc-url "$RPC" \
  --private-key "$MINER_PRIVATE_KEY"
```

`updateMiner` deregisters the old entry and registers the new one atomically. Two consequences worth knowing:

- **You get a new `registrationId` and a new `intentId`.** Anything holding your old intentId — an agent targeting you with `createJob`, for instance — will need the new one.
- **The same canonical-intent rule applies.** If any intent in the new list isn't canonical, the whole update reverts and your original registration is left untouched.

Only the address that registered a miner can update or deregister it; there is no admin override.

### Rotating your API key

Your API key is **not** part of your YAML and does not need an on-chain update.
You can replace the key a node holds for you by proving ownership with the same
wallet that registered the miner — no operator involvement, and the key never
goes to a human.

**1. Request a challenge**, naming the key you intend to install by its
keccak256 fingerprint. Send the fingerprint, never the key:

```bash
NODE=https://your-node.example
SLUG=your-miner-slug
KEY_HASH=$(cast keccak "your-new-api-key")   # or ethers.keccak256(toUtf8Bytes(key))

curl -X POST "$NODE/miner-dispatcher/miners/$SLUG/api-key/challenge" \
  -H "Content-Type: application/json" \
  -d "{\"key_hash\":\"$KEY_HASH\"}"
```

It is a `POST` because it writes a challenge, and `key_hash` goes in the body
rather than a query string so it stays out of the node's access logs. A missing
or malformed `key_hash` is a `400`; an unregistered slug is a `404`.

You get back a `nonce` and the exact `message` to sign:

```
Telegraph Protocol

Authorise an API key update.

Miner: your-miner-slug
Wallet: 0xabc...
Key: 0x5f8d...
Nonce: 9f86d0...
Issued: 2026-08-17T10:00:00Z
```

**2. Sign that message** with `personal_sign` (EIP-191) using your registered
wallet, and submit it with the key itself:

```bash
curl -X POST "$NODE/miner-dispatcher/miners/$SLUG/api-key" \
  -H "Content-Type: application/json" \
  -d '{"nonce":"9f86d0...","signature":"0x...","api_key":"your-new-api-key"}'
```

The node sandbox-tests the new key against your **registered** YAML before
storing it. If it fails, nothing is written and your existing key keeps serving
traffic — a typo cannot take you offline.

Things worth knowing:

- **Sign the exact `message` string the node returned.** Do not rebuild it.
- **The signature is bound to one key.** It commits to `key_hash`, so the same
  signature cannot be used to install a different key. Changing your mind means
  a new challenge.
- **Challenges are single-use and expire after 5 minutes.** Any retry — after a
  rejected key, or a `429` — needs a fresh one.
- **A stored key overrides the operator's `env_var`** for your miner, and takes
  effect on the next call with no restart. Miners with no stored key keep using
  the environment variable.
- **Every write is audited.** The node keeps an append-only trail of who changed
  your key and when, recording a keccak256 of it — never the key itself.

| Status | Meaning |
|---|---|
| `200` | Key validated and stored |
| `401` | Signature invalid or from the wrong wallet; challenge used, expired, or issued for another miner; or `api_key` does not match the `key_hash` you requested the challenge for |
| `422` | Your own endpoints rejected the key. `results` names which; nothing was stored |
| `429` | This miner's key was updated in the last 30s. Retry with a fresh challenge |

### Deregistering

To leave the network entirely:

```bash
cast send "$DIAMOND" \
  "deregisterMiner(uint256)" \
  <registrationId> \
  --rpc-url "$RPC" \
  --private-key "$MINER_PRIVATE_KEY"
```

Deregistering costs nothing beyond gas — there is no bond to release and no unbonding period to wait out.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `MinerRegistryFacet: unsupported intent` | One of your `supportedIntents` isn't canonical | Check each with `isCanonicalIntent(string)` and re-send |
| Miner stuck in pending state | YAML unreachable, or hash/schema check failed — activation is not epoch-gated | `curl -s <node>/api/miners/<registrationId>` — `activation_status` and `rejection_reason` name the cause directly |
| "Hash mismatch" in node logs | The bytes served differ from what you hashed (often a trailing newline) | Recompute from `curl -s <url>`, then `updateMiner` |
| "Schema validation failed" | Missing required fields in YAML | Check against [YAML Configuration](yaml-config.md) field reference |
| Not appearing in `/api/miners` | Registration rejected, or the node hasn't seen the event | `curl -s <node>/api/miners/<registrationId>` — a `rejected` status with a `rejection_reason` means the YAML failed, not that the node missed you. Fix it, then `updateMiner` |
| Getting zero traffic after grace period | Low leaderboard score | Improve response quality and consistency |
| Upstream returns 401, or requests fail naming a credential | No API key installed for the slug | Install it — see [API keys](yaml-config.md#api-keys). Register first; the endpoint 404s with no live registration |
| Registration rejected over slug or `id` | Another wallet holds that identity | See [Identity rejections](#identity-rejections) |
