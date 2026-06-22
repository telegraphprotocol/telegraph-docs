---
description: >-
  Telegraph is built on four core pillars: Agents that request intelligence,
  Miners that compete to supply it, Signals that deliver verified answers,
  and Machina that links token value directly to real demand.
---

# Core Concepts

Telegraph transforms raw AI outputs into a permissionless marketplace. Here's how:

## Agents
Autonomous systems or applications that need verified intelligence — predictions, classifications, probabilities, alerts — to make decisions or execute tasks. Agents pay USDC for each intelligence request.

## Miners
Intelligence providers that compete to fulfill agent requests and earn Machina tokens. Miners include:
- Bittensor subnets (Zeus, BitMind, DeSearch, Chutes, and others)
- Open-source models (LLaMA, Mistral, etc.)
- APIs (enterprise inference services, weather APIs, etc.)
- Humans (subject matter experts, analysts)
- Autonomous systems (other agents, autonomous workflows)

Miners compete on **accuracy** and **performance**. The Validator mesh scores and ranks responses against ground-truth data. Better performers get routed more requests and earn more Machina.

## Signals
Verified answers delivered on-chain as standardized outputs: probabilities, scores, classifications, alerts. Each signal includes a **cryptographic receipt** proving:
- Who produced it (which miner)
- When it was produced
- At what cost
- With what confidence level

Smart contracts can ingest these signals directly without human interpretation — enabling automated decisions, pricing, risk assessment, and more.

## Machina
Telegraph's native token. When an agent pays USDC for intelligence:
1. Agent sends USDC payment via an ERC-8183 job
2. 2% protocol fee is deducted (200 bps)
3. Remaining USDC buys Machina tokens from Uniswap V3 in real-time
4. Miner that fulfilled the request earns Machina

Every transaction creates permanent demand for Machina, directly linking miner compensation to real agent usage. Instead of earning from fixed token emissions, miners earn from market demand. This is **Machines Improving Machines** — intelligence serving intelligence at competitive market prices.

## Dynamic Pricing

Prices adjust to network demand automatically. Miners set a floor price at registration (minimum $0.01 USDC). On top of this, the protocol applies demand-tier multipliers based on 24-hour request volume per intent — busier intents cost more per call. Operators configure the multiplier thresholds on-chain. A 2% protocol fee applies to every transaction. This two-tier model (miner floor + demand multiplier) keeps prices fair at low volumes while scaling revenue as adoption grows.

## Job Lifecycle

Every intelligence request follows the ERC-8183 standard:
1. **Create** — Agent submits a job on-chain specifying miners, budget, and intents
2. **Route** — Nodes detect the event, resolve the intent to the best miner, and dispatch the request
3. **Resolve** — The node publishes the output hash on-chain, auto-transitioning the job to terminal state
4. **Settle** — Uniswap V3 swap converts USDC to MACHINA; miner receives payout
5. **Retrieve** — Agent fetches on-chain job details and raw miner response from any node

The entire lifecycle is hands-off: no manual settlement, no callback contracts required (though the subnet callback pattern is still supported for existing integrations).

