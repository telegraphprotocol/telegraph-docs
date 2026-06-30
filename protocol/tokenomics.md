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
| Halving interval | Every 4 years (every 1,461 epochs) |
| Pre-mine | None |
| Team/VC allocation | None |
| Current circulating supply | ~11.6M MACHINA (as of testnet) |

The emission schedule: `E(t) = 7,200 × 2^(−⌊t/1461⌋)` where `t` is the epoch number. Emissions halve every four years until the maximum supply is reached.

## Where Emissions Go

Daily MACHINA emissions are split three ways:

| Recipient | Share | Who |
|---|---|---|
| Validators | 60% | Active validators, equal share per validator per epoch |
| Script Authors | 20% | WASM script authors, proportional to how often their script is used as the Canonical |
| Protocol Treasury | 20% | On-chain treasury |

**Miners receive zero MACHINA from emissions.** This is intentional. Emissions reward the verification infrastructure (validators) and the quality measurement layer (script authors). Miner compensation comes entirely from agent demand — keeping miner incentives honest and tied to actual usefulness.

## How Miners Earn: USDC → MACHINA via TWAP

When an agent pays for a signal, the USDC flows through a settlement pipeline before reaching the miner:

1. Agent pays the signal price in USDC.
2. The protocol deducts a **2% fee** (200 basis points) to the Treasury.
3. The remaining **98%** enters a TWAP Settler escrow.
4. Over 24 hours, this USDC is dripped into a Uniswap V3 liquidity pool in small increments (0.01 USDC each, with ±30-second jitter), purchasing MACHINA at the prevailing market price.
5. The MACHINA purchased is delivered to the miner's registered fee address.

This TWAP mechanism serves two purposes. For miners: it smooths out price volatility. For the protocol: every USDC spent on inference creates persistent buy pressure on MACHINA, directly linking token value to network utility.

A minimum threshold of **100 USDC** must accumulate before a settlement cycle executes. Below this threshold, USDC rolls over to the next epoch.

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

**Treasury address (testnet):** `0xB82E4DE09f1C43BBD9ca4907c01f1EEd65a521B9`

## Value Linkage

The flywheel: more agents using the protocol → more USDC flowing into Uniswap to buy MACHINA → higher MACHINA price → stronger incentive for validators to stake more → stronger security → more agent confidence → more usage. Unlike token models where value is extracted, MACHINA accumulates value proportional to cumulative protocol usage.

## Delegated Staking

Any MACHINA holder can delegate their stake to an active Validator to help that Validator stay in the top-64 active set. Validators set a commission percentage — the share of their emission earnings they keep. Delegators claim their proportional share of the remaining emissions by pulling from the Port Contract at any time.

Delegated stake counts toward the Validator's total for leaderboard ranking and BFT participation weight.
