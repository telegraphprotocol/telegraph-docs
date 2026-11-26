---
description: How the USDC agents pay is split, how miners are paid, signal pricing, fees, and the MACHINA token design.
---

# Tokenomics

## MACHINA: The Protocol Token

> **MACHINA on this Diamond.** The testnet Diamond has no MACHINA token set (`machinaToken()` returns the zero address). All pay and all bonds are in USDC.

MACHINA is the native token of the Telegraph protocol. Its design deliberately mirrors Bitcoin in the most important properties: fixed maximum supply, a halving schedule, and zero pre-mine. There is no team allocation, no investor reserve, and no early-access advantage.

| Property | Value |
|---|---|
| Maximum supply | 21,000,000 MACHINA |
| Genesis daily emission | 7,200 MACHINA |
| Halving interval | Every 4 years (every 1,461 days) |
| Pre-mine | None |
| Team/VC allocation | None |

The emission schedule: `E(t) = 7,200 × 2^(−⌊t/1461⌋)` where `t` is the day number since genesis. Emissions halve every four years until the maximum supply is reached.

## Where the USDC Goes

What agents are charged (x402, escrow charges and completed on-chain jobs) is split on chain when the epoch's ledger root activates:

| Recipient | Share | Who |
|---|---|---|
| Miners | 40% | The miners that served the requests, by what each served |
| Evaluators | 40% | Per intent, by its paid demand: 15% of the total to the evaluator adapter that ranks it, 25% to the people whose evaluation material it used |
| Validator | 20% | Owed to the Treasury (`protocolFeesOwed()`) |

The owner sets the split; read it with `protocolParams()`. A share with no owner, such as an intent with no adapter, goes to the Treasury.

## How Miners Earn: USDC Entitlements

1. An agent pays the signal price in USDC.
2. When the epoch's ledger root activates, 40% of what was collected goes to miners, split by what each miner served.
3. A later epoch commits each miner's lifetime USDC on chain.
4. The miner claims it with `claimMinerEntitlement`. It is paid in USDC to the miner's payout address (see [Getting paid](../miners/miner-overview.md#getting-paid)). There is no swap.

## Signal Pricing: Floor + Demand Multiplier

Every miner sets a minimum signal price (`min_price_usdc`) when they register — the lowest amount an agent can pay per request. A miner changes it with `updateMiner` (see [Updating your miner](../miners/miner-registration.md#updating-your-miner)).

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

There is no separate fee on a paid request: the whole payment is split as above, and the validator's 20% is owed to the Treasury. A fee of 2% of one call is kept only when an on-chain job fails as an invalid request (see [On-Chain Jobs](../using/erc8183-jobs.md#when-a-job-fails)).

**Treasury address (testnet):** `0xC0A3FB6d3F1f4B54617d29ffbdA4663Af5F96e2e` — read it live with `cast call $DIAMOND "getTreasury()(address)"`.

## Delegated Staking

Any MACHINA holder can delegate their stake to an active Validator to help that Validator stay in the top-64 active set. Validators set a commission percentage — the share of their emission earnings they keep. Delegators claim their proportional share of the remaining emissions by pulling from the Port Contract at any time.

Delegated stake counts toward the Validator's total for leaderboard ranking and BFT participation weight.
