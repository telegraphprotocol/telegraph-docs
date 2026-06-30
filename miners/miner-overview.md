---
description: What miners are, how they earn, how routing works, and what the leaderboard means for income.
---

# What Miners Do

Miners are the supply side of the Telegraph protocol. They expose AI capabilities — a Bittensor subnet, an open-source model, a hosted or proprietary API — through a standardized YAML interface and earn MACHINA whenever their responses are selected and used.

Telegraph started by integrating Bittensor subnets, which is why you'll still see `subnet` in some slugs and API fields. That naming is historical: today a **miner** is any provider integrated via YAML, subnet or not. Becoming one doesn't require permission, a whitelist, or a relationship with the Telegraph team — any operator with an AI API and 100 MACHINA to bond can register.

## How Miners Earn

Miners earn exclusively from demand — not from protocol emissions.

When an agent pays to use a miner's capability:
1. The agent pays the signal price in USDC.
2. 2% goes to the Protocol Treasury.
3. The remaining 98% enters a TWAP Settler escrow.
4. Over the next 24 hours, that USDC is dripped into Uniswap V3 to purchase MACHINA at market price.
5. The purchased MACHINA is sent to the miner's registered fee address.

The rate of dripping (0.01 USDC at a time, ±30 seconds jitter) prevents flash price manipulation. A minimum of 100 USDC must accumulate before a settlement cycle executes — earnings below this threshold roll over to the next epoch.

**Your earnings per request:**
`Earnings = min_price_usdc × demand_multiplier × 0.98 → MACHINA at market price`

## Signal Pricing

When you register as a miner, you declare a floor price (`min_price_usdc`). This is the minimum you'll receive per request — agents can't pay less. The floor is immutable after registration; to change it you must deregister and re-register.

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

Validators run spot checks continuously throughout each epoch — approximately every 20 seconds, triggered deterministically by the latest Base L2 block hash. If a miner's spot check score drops more than 20% relative to their leaderboard score:

- A **Routing Revocation** is issued immediately.
- The miner is removed from the routing table.
- Their traffic share is redistributed to remaining eligible miners.
- The revocation is recorded immutably in the epoch block.

A revoked miner cannot receive new traffic until the next epoch tournament re-scores them. Maintaining consistent response quality is critical to income stability.

## What You Need to Become a Miner

| Requirement | Detail |
|---|---|
| **100 MACHINA bond** | Locked per registration, returned after the 7-day unbonding on deregistration |
| **YAML configuration** | A YAML file describing your API, Intents, endpoint mapping, and pricing |
| **Hosted YAML** | Your YAML must be accessible at a public URL (IPFS recommended) |
| **Fee address** | An EVM wallet address to receive MACHINA payouts |
| **Operational API** | Your endpoint must be live and responding when the protocol routes requests |

## Current Active Miners (Testnet)

The live miner set changes as operators register and deregister on-chain, so the authoritative list is always the discovery endpoint and the interface — not this page. At the time of writing, the active testnet miners are:

| ID | Miner | Capability | Floor Price |
|---|---|---|---|
| 18 | Zeus (SN18) | Weather forecasting | $0.01 |
| 32 | ItsAI (SN32) | AI text detection | $0.01 |
| 33 | Sapling | AI content detection | — |
| 34 | BitMind (SN34) | Deepfake / media authenticity | $0.02 |
| 102 | OpenAI | LLM, images, embeddings | $0.05 |

**See the live set two ways:**
- **Interface:** the [Intelligence Terminal](https://terminal.telegraphprotocol.com/intelligence-terminal) shows active miners and the signals they produce.
- **API:** `GET http://13.237.89.59:7044/miner-dispatcher/integrations` returns the current catalog with schemas and prices.

## Next Steps

- **[YAML Configuration](yaml-config.md)** — how to write your miner's configuration file.
- **[Registering as a Miner](miner-registration.md)** — how to register on-chain and go live.
