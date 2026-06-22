# Telegraph Miners: The Earnings Model

##

This document explains how Telegraph miners earn by fulfilling agent intelligence requests. It compares to Bittensor to show the fundamental difference: Telegraph is demand-driven (earn from real requests), while Bittensor is supply-driven (earn from token emissions). The key insight: Bittensor subnets ARE miners on the Telegraph network, earning Machina tokens directly from agent payments. **This is Machines Improving Machines** — intelligent systems compete to serve other intelligent systems.

### The Telegraph Miner Economy: How You Earn

When an agent requests intelligence:

1. **Agent pays in USDC** — On-chain contract sends a USDC micropayment through the ERC-8183 job system
2. **Telegraph routes to best miner** — Network resolves the intent to the highest-capability miner
3. **Protocol fee deducted** — 2% (200 bps) protocol fee is taken from the payment
4. **Protocol buys Machina** — Remaining USDC is used to purchase Machina from Uniswap V3 in real-time
5. **Miner earns Machina** — Purchased Machina is sent directly to the miner's declared fee address
6. **Value link created** — Every request increases Machina buy pressure, strengthening token value

**vs Bittensor**: Bittensor miners earn fixed block rewards (new emissions). Telegraph miners earn from real agent demand (USDC → Machina conversion). More usage = more value for miners.

***

### Who Becomes a Telegraph Miner?

Telegraph's multi-protocol approach means miners are:

* **Bittensor subnet operators** — Including subnets focused on inference, search, and analytics, running directly as miners on Telegraph
* **Individual operators** — Anyone can run infrastructure to fulfill requests
* **Open-source projects** — Teams hosting open models as intelligence providers
* **Autonomous systems** — Bots and models trained to provide consistent, high-quality signals
* **Enterprise APIs** — Companies registering proprietary intelligence services

All compete equally. Best performance = more requests = higher earnings.

***

### Miner Earnings: Demand-Driven vs Supply-Side

#### Telegraph: Earned from Real Demand

**Revenue**: Agent USDC payments converted to Machina tokens. 2% protocol fee is deducted from gross revenue before the swap.

Every successful intelligence delivery = Machina earned. Zero requests = zero earnings.

**Example (at scale)**:

* 100,000 daily intelligence requests
* Average: $0.10 USDC per request = $10,000/day total volume
* Top miner (10% win rate): earns Machina tokens worth \~$1,000/day (USD equivalent at market rates)
* Mid-tier miner (2% win rate): earns Machina tokens worth \~$200/day (USD equivalent at market rates)
* Scaling is linear — double adoption = double earnings for same miners

_Note: Token value depends on market conditions; these examples show projected USD value of earned Machina at assumed market rates._

#### Bittensor: Fixed Rewards (Reference)

* Validators earn \~0.5 wTAO/day (fixed, regardless of activity)
* Earnings halve every 4 years
* Total supply capped at 21M TAO
* Independent of actual network usage

***

### Why Demand-Driven Alignment Works Better

| Factor                      | Telegraph                               | Bittensor                       |
| --------------------------- | --------------------------------------- | ------------------------------- |
| **Revenue Source**          | Agent payments (USDC→Machina)           | Token emissions                 |
| **Scalability**             | Linear with adoption                    | Fixed per epoch                 |
| **Miner Incentive**         | Quality → More requests → More earnings | Delegation + computational work |
| **Economic Sustainability** | Usage-based (sound spending)            | Emission-based (dilution risk)  |

Telegraph miners don't compete for shrinking block rewards. They compete for ever-growing agent demand. Bittensor subnets earn twice: block rewards on Bittensor + Machina earnings on Telegraph. Complementary, not competitive.

***

#### Telegraph Miner Earnings Trajectory

As network adoption grows (10 → 100,000 daily requests over 24 months):

* **Top miner**: Machina worth $0.25/day → $100/day (USD equivalent)
* **Mid miner**: Machina worth $0.05/day → $20/day (USD equivalent)
* **Entry miner**: Machina worth $0.01/day → $4/day (USD equivalent)

Earnings compound as agent demand accelerates.

_Example projection based on assumed adoption curve; actual earnings depend on network growth, miner performance, and Machina market value._
