---
description: MACHINA supply, halving schedule, emission distribution, miner earnings via USDC TWAP, and protocol fees.
---

# Tokenomics

## MACHINA: The Protocol Token

MACHINA is the native token of the Telegraph protocol. Its design deliberately mirrors Bitcoin in the most important properties: fixed maximum supply, a halving schedule, and zero pre-mine. There is no team allocation, no investor reserve, and no early-access advantage.

| Property | Value |
|---|---|
| Maximum supply | 21,000,000 MACHINA |
| Genesis daily emission | 7,200 MACHINA |
| Halving interval | Every 4 years (every 1,461 days) |
| Pre-mine | None |
| Team/VC allocation | None |

The emission schedule: `E(t) = 7,200 × 2^(−⌊t/1461⌋)` where `t` is the day number since genesis. Emissions halve every four years until the maximum supply is reached.

## Where Emissions Go

Daily MACHINA emissions are split three ways:

| Recipient | Share | Who |
|---|---|---|
| Validators | 25% | Active validators |
| Evaluators | 50% | Split per intent: 30% to the evaluator adapter that ranks it, 70% to the people whose evaluation material it used |
| Protocol Treasury | 25% | On-chain treasury |

**Miners receive zero MACHINA from emissions.** This is intentional. Emissions reward the verification infrastructure (validators) and the quality measurement layer (evaluator adapters and evaluation material). Miner compensation comes entirely from agent demand — keeping miner incentives honest and tied to actual usefulness.

## How Miners Earn: USDC → MACHINA via TWAP

When an agent pays for a signal, the USDC flows through a settlement pipeline before reaching the miner:

1. Agent pays the signal price in USDC.
2. The protocol deducts a **2% fee** (200 basis points) to the Treasury.
3. The remaining **98%** is queued for the miner.
4. At the end of each epoch, the settler swaps the queue into MACHINA on the MACHINA/USDC Uniswap V3 pool in batches. Each batch is a share of what is queued, batches are spaced out in time, and no batch may push the price more than a set limit past the pool's recent average price. Small amounts wait for a minimum batch size, but never longer than a maximum wait. The live settings are on the diamond: `twapSettlerConfig()`.
5. The MACHINA bought is credited to the miner, who claims it to their payout address (see [Getting paid](../miners/miner-overview.md#getting-paid)).

Swapping in spaced, price-limited batches serves two purposes. For miners: it smooths out price volatility. For the protocol: every USDC spent on inference creates persistent buy pressure on MACHINA, directly linking token value to network utility.

Below the minimum batch size, miner pay waits and is swapped together with later epochs' pay, up to the maximum wait.

## Signal Pricing: Floor + Demand Multiplier

Every miner sets a minimum signal price (`min_price_usdc`) when they register — the lowest amount an agent can pay per request. This floor is immutable after registration.

The actual price an agent pays can be higher, depending on demand for that Intent:

| 24-hour request volume | Multiplier |
|---|---|
| 0 – 999 requests | 1.0× |
| 1,000 – 9,999 | 1.5× |
| 10,000 – 99,999 | 2.5× |
| 100,000 – 999,999 | 5.0× |
| 1,000,000+ | 10.0× |

**Signal price = min_price_usdc × demand_multiplier**

A miner with a $0.01 floor that handles a popular Intent generating 5,000 requests per day charges $0.015 per call at the 1.5× tier. This aligns miner earnings with the market value of their service. The multipliers are driven by a rolling 24-hour volume count per Intent.

## Protocol Fee

The protocol takes **2% (200 basis points)** of every payment — whether through x402 direct inference, Engine calls, or ERC-8183 jobs. This goes to the Treasury address.

**Treasury address (testnet):** `0xC0A3FB6d3F1f4B54617d29ffbdA4663Af5F96e2e` — read it live with `cast call $DIAMOND "getTreasury()(address)"`.

## Value Linkage

The flywheel: more agents using the protocol → more USDC flowing into Uniswap to buy MACHINA → higher MACHINA price → stronger incentive for validators to stake more → stronger security → more agent confidence → more usage. Unlike token models where value is extracted, MACHINA accumulates value proportional to cumulative protocol usage.

## Delegated Staking

Any MACHINA holder can delegate their stake to an active Validator to help that Validator stay in the top-64 active set. Validators set a commission percentage — the share of their emission earnings they keep. Delegators claim their proportional share of the remaining emissions by pulling from the Port Contract at any time.

Delegated stake counts toward the Validator's total for leaderboard ranking and BFT participation weight.
