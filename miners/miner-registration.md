---
description: Step-by-step guide to registering your miner on-chain and going live on the Telegraph network.
---

# Registering as a Miner

Registration is permissionless: anyone can register a miner. Once registered, Telegraph nodes automatically detect your YAML, validate it, and add you to the routing pool. No approval needed, no contact with the team required.

## The easy way: the registration interface

**[integrate.telegraphprotocol.com](https://integrate.telegraphprotocol.com)** does the whole flow for you. Connect your wallet, paste your YAML, and it will:

- validate the YAML and sandbox-test your endpoints against your real API,
- pin the YAML to IPFS,
- send the `registerMiner` transaction from your wallet,
- store your **API key** against your slug, so an authenticated miner works without you sending the key to anyone.

Note the order: the key is stored **after** registration, because it is bound to the wallet that holds the slug. Sandbox-testing a key before you are registered still works and still reports pass or fail per endpoint. It just reports `api_key_stored: false`, and you install the key once you are live.

This is the recommended path, and the only one that lets you supply an API key yourself.

**Scripting it, or driving it from an agent?** The validation half of that interface is a plain HTTP API you can call directly, with the same checks and the same error strings, and no browser or wallet:

```
POST https://integrate.telegraphprotocol.com/api/validate
{"yaml": "<raw YAML text>", "api_key": "...", "miner_address": "0xYourWallet"}
```

See [Validation API](validation-api.md) for the full contract. Run it until it comes back clean, then send the registration transaction below yourself.

The rest of this page covers doing the same thing by hand with `cast`.

## Prerequisites

1. **A completed YAML file.** See [YAML Configuration](yaml-config.md), or copy [`example-miner.yaml`](https://github.com/telegraphprotocol/telegraph-examples/blob/master/frontend/yaml/example-miner.yaml) and edit it.
2. **The intents you will serve.** These must be canonical **intents** such as `FX_NOW_EUR`, never prefixes such as `FX_NOW`. See [Pick your intents](#step-1-pick-your-intents).
3. **A hosted YAML.** Publicly reachable at a stable URL. IPFS is strongly recommended; HTTPS is also acceptable.
4. **A small amount of ETH on Base Sepolia**, for gas on the registration transaction. There is no bond, stake or fee; gas is the only cost.
5. **A fee address.** The EVM wallet where your MACHINA payouts go. It can be the registering wallet or a separate cold address.
6. **`cast` (Foundry).** Install at [getfoundry.sh](https://getfoundry.sh).

## Step 1: Pick your intents

Your `supportedIntents` must each be a **canonical intent**. Two mistakes revert the whole registration:

| Revert | Cause |
|---|---|
| `MinerRegistryFacet: unsupported intent` | The name is not a canonical intent (a typo, wrong case, or one that was never approved) |
| `MinerRegistryFacet: a prefix is not an intent` | You listed a family name such as `FX_NOW`. List the intent, for example `FX_NOW_EUR` |
| `duplicate intent` | You listed the same intent twice. Each counts once |
| `supportedIntents` empty | Declare at least one |

Matching is exact and case-sensitive. Check before you send:

```bash
cast call "$DIAMOND" "isCanonicalIntent(string)(bool)" "FX_NOW_EUR" --rpc-url "$RPC"
cast call "$DIAMOND" "getCanonicalIntents()(string[])" --rpc-url "$RPC"   # the live set
cast call "$DIAMOND" "getPrefixes()(string[],uint8[])" --rpc-url "$RPC"   # families and their kinds
```

If your service does not fit any listed intent, you have two options:
- **Serve a `_GENERAL` intent.** 21 judgment families ship with one, for example `CONTENT_EXTRACTION_GENERAL` for OCR and speech-to-text miners, or `FRAUD_DETECTION_GENERAL` for breach checks. The list is in [Intents](../using/intents.md#_general-intents).
- **Propose a new intent** under the right prefix. See [Proposing a new intent](../using/intents.md#proposing-a-new-intent).

Every intent you list also needs to appear in your YAML. See [YAML Configuration](yaml-config.md#intents-must-be-intents-not-prefixes).

## Step 2: Compute the YAML hash

The registry requires a SHA-256 hash of your raw YAML bytes. Nodes use it to verify that the YAML you host is the YAML you committed to on-chain.

```bash
sha256sum my-miner.yaml | awk '{print "0x"$1}'
```

If you change the YAML after computing the hash, recompute it.

> **Use SHA-256, not keccak256.** The node verifies with SHA-256.

## Step 3: Upload your YAML

Upload to IPFS or a stable HTTPS URL. It must stay reachable as long as you are registered, because nodes fetch it at registration time and again whenever they rebuild from on-chain state.

IPFS: `ipfs://bafkreig5nxc...`  HTTPS: `https://your-host.com/miner.yaml`

## Step 4: Register on-chain

```bash
export DIAMOND="0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8"
export RPC="https://base-sepolia.g.alchemy.com/v2/<YOUR_ALCHEMY_KEY>"
export YAML_URL="ipfs://bafkreig5nxc..."
export YAML_HASH="0x$(sha256sum my-miner.yaml | awk '{print $1}')"
export FEE_ADDRESS="0xYourFeeAddress"
export MIN_PRICE=10000          # 0.01 USDC in 6-decimal units (minimum allowed)
export MINER_PRIVATE_KEY="0x..."

cast send "$DIAMOND" \
  "registerMiner(string,bytes32,address,uint256,string[])" \
  "$YAML_URL" "$YAML_HASH" "$FEE_ADDRESS" "$MIN_PRICE" \
  '["FX_NOW_EUR","FX_NOW_CAD"]' \
  --rpc-url "$RPC" --private-key "$MINER_PRIVATE_KEY"
```

The addresses above are the Base Sepolia deployment. The current testnet addresses are always in [Addresses & Parameters](../protocol/addresses-and-params.md).

| Parameter | Description |
|---|---|
| `yamlUrl` | IPFS or HTTPS URL where your YAML is hosted |
| `yamlHash` | SHA-256 of the raw YAML bytes, prefixed with `0x` |
| `feeAddress` | EVM address for MACHINA payouts (must be non-zero) |
| `minPriceUsdc` | Floor price in 6-decimal USDC (minimum: `10000` = $0.01). Changeable later via `updateMiner`. |
| `supportedIntents` | JSON array of at least one canonical **intent** |

### When registration opens

On a network that was just moved to a new chain, the admin first **imports** the existing miners, and registration opens when that import is closed (`registration opens when the migration closes`). If you see that revert, the network is not open for new registrations yet. Existing miners were copied for you, with the same id and owner. You do not have to register again.

### Registering from a wallet that holds no gas

`registerMiner` binds the registration to the wallet that sends it. To keep your identity on a cold wallet, sign offline and have anyone relay it:

```
registerMinerFor(
  address miner,              // you: ends up owning the registration
  string  yamlUrl,
  bytes32 yamlHash,
  address feeAddress,
  uint256 minPriceUsdc,
  string[] supportedIntents,
  uint256 deadline,           // unix seconds; the signature dies after this
  bytes   signature           // EIP-712, signed by `miner`
)
```

The signature covers every field, so the relayer cannot change your YAML, payout address, price floor or intent list. It can only choose whether to submit. The relayer pays only gas.

Read the nonce you must sign over with `metaTxNonce(yourAddress)`. The EIP-712 domain is `name: "Telegraph"`, `version: "1"`, your chain id, and `verifyingContract:` the **Diamond address**, not a facet. `deregisterMinerFor` and `updateMinerFor` are the relayed versions of those calls.

## Step 5: Confirm the registration

The transaction emits `MinerRegistered`:

| Field | Description |
|---|---|
| `registrationId` | Unique sequential ID for this registration (indexed) |
| `miner` | Your registering address (indexed) |
| `yamlUrl` | The URL you provided |
| `yamlHash` | The hash you committed |
| `feeAddress` | Your payout address |
| `minPriceUsdc` | Your declared floor price |
| `supportedIntents` | The intents you declared |

Read the record back with `getMiner(registrationId)`.

> **Jobs no longer target your registration id.** An on-chain job names an *intent*, and the protocol picks the best ranked miner for it. A contract can ask for you first with `createJobForMiner(intentId, yourRegistrationId, ...)`, which falls back to the ranked miners if you are down. See [On-Chain Jobs](../using/erc8183-jobs.md).

## Step 6: Wait for nodes to activate you

Activation follows your registration event, not any schedule. Each node activates you as it processes the event, usually within a minute. Each node will:
1. Fetch your YAML from the declared URL.
2. Verify the SHA-256 hash matches the on-chain commitment.
3. Validate the YAML against the schema, including your `intent_mapping` if you declared one.
4. Activate you in its routing engine.

Verify you are live:

```bash
curl https://devnode.telegraphprotocol.com/api/miners
```

Your slug should appear. If your API needs a key, install it now, because the key is bound to the wallet holding the slug. See [API keys](#installing-or-rotating-your-api-key).

### If it isn't there

`/api/miners` lists miners a node has successfully **loaded**, so a rejected registration is absent by design. Absence is not evidence the node missed your event. Look up the registration itself, by the `registrationId` from your receipt:

```bash
curl -s https://devnode.telegraphprotocol.com/api/miners/84 | jq '.miner | {activation_status, rejection_reason, retrying}'
```

To see everything one wallet has ever registered:

```bash
curl -s https://devnode.telegraphprotocol.com/miner-dispatcher/miners/address/<yourAddress>/yamls \
  | jq '{count, yamls: [.yamls[] | {registration_id, slug, activation_status}]}'
```

This lists every registration, including superseded and deregistered ones. Each `updateMiner` leaves the old entry behind, so sort by `registration_id` and take the highest, or filter on `activation_status`.

```json
{
  "activation_status": "rejected",
  "rejection_reason": "YAML schema validation failed: [endpoints.0: Additional property input_schema is not allowed]. This will NOT be retried: fix the YAML and re-submit the registration with updateMiner().",
  "retrying": false
}
```

| Status | What it means | What to do |
|---|---|---|
| `active` | Live and routable | Nothing |
| `pending` | YAML validated, activating shortly | Wait a few seconds |
| `unreachable` | The YAML URL didn't answer. `retrying: true` means the node is still trying, every ~5 min up to 5 attempts | Nothing, unless it later becomes `rejected` |
| `rejected` | Terminal. `rejection_reason` says exactly why | Fix the cause, then `updateMiner` |
| `superseded` | A newer registration took your slug | Use the newer `registrationId` |
| `deregistered` | Withdrawn on-chain | Re-register if this wasn't intentional |

A rejection is **not** something you re-register from scratch. Call `updateMiner` with the corrected URL and hash, see [Updating your miner](#updating-your-miner). Validate the fix at [integrate.telegraphprotocol.com](https://integrate.telegraphprotocol.com) before spending gas.

Always look your registration up **by `registrationId`**, not by slug. The by-slug lookup returns whoever currently serves that slug, which, if you were rejected for a slug clash, is someone else.

### Request-contract rejections

A YAML can satisfy the JSON schema and still be refused, because passing the schema does not prove the node can work out **how to call you**. These are terminal and need a YAML change:

| `rejection_reason` contains | Meaning | Fix |
|---|---|---|
| `no endpoint declares any intents` | No endpoint carries an `intents:` list, so no intent can select one | Add `intents:` to the endpoint(s) serving your `supported_intents` |
| `endpoint X has no description` | An endpoint doesn't say what it does. The request builder uses the description to decide how to call it | Add `description:` to that endpoint |
| `semantics.supported_intents is empty` | The miner declares nothing it can serve | Add at least one canonical intent |
| `endpoint X declares intent Y not listed in semantics.supported_intents` | An endpoint claims an intent the miner never declared | Add it to `supported_intents`, or drop it from the endpoint |
| `intent_mapping invalid registrationId=N errors=[...]` | Your `intent_mapping` has an error, for example a `formula` that reads no value from the miner's answer | Fix the mapping. See [Intent mapping](yaml-config.md#intent-mapping-optional) |

Full guidance: [YAML Configuration](yaml-config.md#why-description-intents-and-params-decide-whether-you-get-traffic).

Two things **warn** rather than reject, and both are worth acting on:

- **An endpoint with no `params`.** Legal, but without `params` the node has to guess your field names, which is the most common reason a registered, active miner fails the calls it is sent.
- **A single endpoint with no `intents`**, when another endpoint has them. That is how you declare a utility endpoint (a health check, an upload-URL helper) that is deliberately not intent-routed.

> **If you registered before these checks existed, nothing happens to you.** They apply when a YAML is registered or re-submitted. You first meet them on your next `updateMiner`. If a re-submission is refused, your **existing registration keeps serving and keeps your slug**.

### Identity rejections

Two terminal rejections concern identity rather than schema:

| `rejection_reason` says | Meaning | Fix |
|---|---|---|
| slug `"x"` is already served by an active registration owned by a different wallet | A slug is a miner's identity; only its owner may register it | Pick a different slug, or have the current owner `deregisterMiner` first |
| YAML id `"N"` is already in use by active miner `"y"` | `id` is the key requests are routed on. Two miners sharing one would serve each other's traffic | Pick an unused id, re-pin, `updateMiner` |

Re-registering your own slug is never a clash. A rejected registration stops holding its slug, so fix and re-submit promptly.

## Step 7: The grace period

For your first 7 days after activation you are in the grace period:
- You receive a flat share of 5% of all routed traffic for your declared intents, shared equally with other grace-period miners.
- This builds a quality track record before you compete on the leaderboard.

After 7 days, your grace-period score sets your starting leaderboard position.

## Updating your miner

Use `updateMiner` to change your YAML, floor price, fee address or intents in **one transaction**. Update the hosted YAML first, then:

```bash
cast send "$DIAMOND" \
  "updateMiner(uint256,string,bytes32,address,uint256,string[])" \
  <oldRegistrationId> "$YAML_URL" "$YAML_HASH" "$FEE_ADDRESS" "$MIN_PRICE" \
  '["FX_NOW_EUR","FX_NOW_CAD","FX_NOW_SEK"]' \
  --rpc-url "$RPC" --private-key "$MINER_PRIVATE_KEY"
```

`updateMinerFor(miner, oldRegistrationId, ..., deadline, signature)` is the relayed twin, signed by `miner`, so a relayer can send it and pay the gas.

What happens:
- The old registration ends and a new one is created, so you get a **new `registrationId`**.
- The same intent rule applies. If any intent in the new list is not canonical, or is a prefix, the whole update reverts and your original registration is untouched.
- Only the address that registered a miner can update or deregister it. There is no admin override.

### Installing or rotating your API key

Your API key is **not** part of your YAML and needs no on-chain update. You replace the key a node holds for you by proving ownership with the wallet that registered the miner. No operator is involved and the key never goes to a human.

**1. Request a challenge**, naming the key you will install by its keccak256 fingerprint. Send the fingerprint, never the key:

```bash
NODE=https://your-node.example
SLUG=your-miner-slug
KEY_HASH=$(cast keccak "your-new-api-key")

curl -X POST "$NODE/miner-dispatcher/miners/$SLUG/api-key/challenge" \
  -H "Content-Type: application/json" \
  -d "{\"key_hash\":\"$KEY_HASH\"}"
```

It is a `POST` because it writes a challenge, and `key_hash` goes in the body to stay out of access logs. A missing or malformed `key_hash` is a `400`; an unregistered slug is a `404`.

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

**2. Sign that message** with `personal_sign` (EIP-191) using your registered wallet, and submit it with the key:

```bash
curl -X POST "$NODE/miner-dispatcher/miners/$SLUG/api-key" \
  -H "Content-Type: application/json" \
  -d '{"nonce":"9f86d0...","signature":"0x...","api_key":"your-new-api-key"}'
```

The node sandbox-tests the new key against your **registered** YAML before storing it. If it fails, nothing is written and your existing key keeps serving.

- **Sign the exact `message` string returned.** Do not rebuild it.
- **The signature is bound to one key** (it commits to `key_hash`). Changing your mind means a new challenge.
- **Challenges are single-use and expire after 5 minutes.**
- **The stored key is the only source.** It takes effect on the next call, with no restart. Nothing falls back to the environment.
- **The key is bound to your wallet, not the slug.** It is released only while that wallet still holds the slug.
- **Every write is audited** with a keccak256 of the key, never the key.

| Status | Meaning |
|---|---|
| `200` | Key validated and stored |
| `401` | Signature invalid or from the wrong wallet; challenge used, expired, or for another miner; or `api_key` does not match the `key_hash` |
| `422` | Your own endpoints rejected the key. `results` names which. Nothing was stored |
| `429` | This miner's key was updated in the last 30 s. Retry with a fresh challenge |

### Deregistering

```bash
cast send "$DIAMOND" "deregisterMiner(uint256)" <registrationId> \
  --rpc-url "$RPC" --private-key "$MINER_PRIVATE_KEY"
```

Deregistering costs nothing beyond gas: there is no bond to release and no unbonding period to wait out.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `MinerRegistryFacet: unsupported intent` | One of your intents isn't canonical | Check each with `isCanonicalIntent(string)` |
| `MinerRegistryFacet: a prefix is not an intent` | You listed a family such as `FX_NOW` | List the intent, for example `FX_NOW_EUR` |
| `registration opens when the migration closes` | The network is mid-migration | Existing miners were imported. New registrations open when the admin closes the migration |
| Miner stuck in pending | YAML unreachable, or hash or schema check failed. Activation is not epoch-gated | `curl -s <node>/api/miners/<registrationId>` names the cause |
| "Hash mismatch" in node logs | The bytes served differ from what you hashed (often a trailing newline) | Recompute from `curl -s <url>`, then `updateMiner` |
| "Schema validation failed" | Missing required fields in YAML | Check against [YAML Configuration](yaml-config.md) |
| Not in `/api/miners` | Registration rejected, or the node hasn't seen the event | `curl -s <node>/api/miners/<registrationId>`. A `rejected` status means the YAML failed |
| Getting zero traffic after grace period | Low leaderboard score | Improve response quality and consistency |
| Upstream returns 401, or requests fail naming a credential | No API key installed for the slug | See [API keys](#installing-or-rotating-your-api-key). Register first |
| Registration rejected over slug or `id` | Another wallet holds that identity | See [Identity rejections](#identity-rejections) |
