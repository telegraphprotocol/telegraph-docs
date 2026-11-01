---
description: What miners are, how they earn, how routing works, and what the leaderboard means for income.
---

# What Miners Do

Miners are the supply side of the Telegraph protocol. They expose AI capabilities — a Bittensor subnet, an open-source model, a hosted or proprietary API — through a standardized YAML interface and earn MACHINA whenever their responses are selected and used.

Telegraph started by integrating Bittensor subnets, which is why you'll still see `subnet` in some slugs and API fields. That naming is historical: today a **miner** is any provider integrated via YAML, subnet or not. Becoming one doesn't require permission, a whitelist, or a relationship with the Telegraph team. The only stake is a small bond in MACHINA ($1 for the first intent), returned when you deregister. Anyone with an AI API can register.

## How Miners Earn

Miners earn exclusively from demand — not from protocol emissions.

When an agent pays to use a miner's capability:
1. The agent pays the signal price in USDC.
2. 2% goes to the Protocol Treasury.
3. The remaining 98% is queued for you.
4. At the end of each epoch, the settler swaps the queue into MACHINA on the MACHINA/USDC Uniswap V3 pool in batches. Each batch is a share of what is queued, batches are spaced out in time, and no batch may push the price more than a set limit past the pool's recent average price. Small amounts wait for a minimum batch size, but never longer than a maximum wait. The live settings are on the diamond: `twapSettlerConfig()`.
5. The MACHINA bought is credited to you. You claim it (below); it is paid to your payout address.

Spacing the swaps out and limiting how far each one may move the price protects your pay from short price spikes.

### Getting paid

Your MACHINA is not pushed to you: you claim it. Read what you are owed by your
registration ID, then claim it. Anyone may send the claim; the MACHINA always goes
to your payout address.

```bash
curl https://devnode.telegraphprotocol.com/v1/entitlements/miner/$REGISTRATION_ID
# returns lifetime, proof and claim_function

cast send $DIAMOND "claimMinerEntitlement(uint256,uint256,bytes32[])" \
  $REGISTRATION_ID $LIFETIME "[$PROOF_1,$PROOF_2,...]" --rpc-url $RPC --private-key $KEY
```

`lifetime` is everything you have earned so far; the claim pays the part you have
not claimed yet. Claim as often as you like.

**Your earnings per request:**
`Earnings = min_price_usdc × demand_multiplier × 0.98 → MACHINA at market price`

## Signal Pricing

When you register as a miner, you declare a floor price (`min_price_usdc`). This is the minimum you'll receive per request — agents can't pay less. To change it later, call `updateMiner` with the new price — see [Updating Your Miner](miner-registration.md#updating-your-miner). That deregisters the old entry and registers the new one atomically, so you get a new `registrationId` and a new `intentId`.

The actual price an agent pays may be higher based on how much demand exists for your Intent in the last 24 hours:

| 24h Request Volume | Multiplier |
|---|---|
| 0 – 999 | 1.0× |
| 1,000 – 9,999 | 1.5× |
| 10,000 – 99,999 | 2.5× |
| 100,000 – 999,999 | 5.0× |
| 1,000,000+ | 10.0× |

A miner charging $0.01 floor handling an Intent with 5,000 daily requests earns $0.015 per call. At 500 requests per day attributable to that miner, daily earnings would be ~$7.50 worth of MACHINA.

## How Routing Works

Not all miners receive equal traffic. Routing is probabilistic and weighted by leaderboard score:

- **Top-ranked miner** receives 70% of routed requests.
- **Second-ranked** receives 20%.
- **Third-ranked** receives 10%.

(These weights are governance-adjustable. At genesis they are 70/20/10.)

A miner's leaderboard position is determined by their Canonical Score — the stake-weighted median of all Validator Local Scores from the most recent epoch tournament and ongoing spot checks.

**To earn more, perform better.** There is no cap on the number of miners per Intent. The market determines which ones succeed.

## The Grace Period

For the first 7 days after registration, a miner is in the **grace period**. During this time:
- The miner doesn't appear on the leaderboard (no score yet).
- All grace-period miners collectively share 5% of routed requests, distributed equally.
- This gives every new miner a baseline of traffic to build a track record.

After 7 days, the miner's score from the grace period is used to rank them on the leaderboard, and they begin competing for the weighted 70/20/10 distribution.

## Spot Checks and Revocation

Validators run spot checks continuously throughout each epoch, on average about once per hour for each Intent (the node default), at randomised times. A spot check tests liveness, not answer quality: any non-empty answer passes. If a miner fails consecutive spot checks for an Intent (no response, or an empty answer):

- A **Routing Revocation** is issued immediately.
- The miner is removed from the routing table for that Intent.
- Their traffic share is redistributed to remaining eligible miners.
- The revocation is recorded immutably in the epoch block.

A revoked miner cannot receive new traffic until the next epoch tournament re-scores them. Maintaining consistent response quality is critical to income stability.

## What You Need to Become a Miner

| Requirement | Detail |
|---|---|
| **A small refundable bond** | $1 in MACHINA for the first intent ($0.10 each after, $0.07 past 9), returned when you deregister. Gas is the only other cost |
| **YAML configuration** | A YAML file describing your API, Intents, endpoint mapping, and pricing |
| **Hosted YAML** | Your YAML must be accessible at a public URL (IPFS recommended) |
| **Fee address** | An EVM wallet address to receive MACHINA payouts |
| **Operational API** | Your endpoint must be live and responding when the protocol routes requests |

## Current Active Miners (Testnet)

The live miner set changes as operators register and deregister on-chain, so there is no useful fixed list to publish here.

**See the live set two ways:**
- **Interface:** [Anjoman](https://anjoman.ai/) shows active miners and the signals they produce.
- **API:** `GET https://devnode.telegraphprotocol.com/api/miners` returns the current catalog with schemas and prices.

## Next Steps

- **[YAML Configuration](yaml-config.md)** — how to write your miner's configuration file.
- **[Registering as a Miner](miner-registration.md)** — how to register on-chain and go live.
