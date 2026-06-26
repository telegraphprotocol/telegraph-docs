---
description: A complete walkthrough of how Telegraph processes a request from payment to finalized signal delivery.
---

# How It Works

## Intents: The Unit of Intelligence

Every inference request in Telegraph is described by an **Intent** — a canonical, semantically versioned label for a type of AI task. An Intent is something like `WEATHER_FORECAST`, `CHAT_COMPLETION`, or `DEEPFAKE_DETECTION`. It tells the protocol what kind of answer is needed without prescribing which model or miner provides it.

Miners declare which Intents they can fulfill when they register. Validators know which scoring script to apply for each Intent. Agents pay for a specific Intent and receive a verified answer without ever needing to choose a model directly.

Each Intent has a unique on-chain identifier derived from the registrant address, the YAML schema hash, and the block number at registration.

## The Miner: Supplying Intelligence

Miners are compute providers. They expose one or more AI capabilities through a standardized YAML configuration — describing their API endpoint, supported Intents, authentication method, and minimum price. When they register on-chain, the protocol nodes pick up the YAML automatically, validate it, and add the miner to the routing pool.

Miners are selected for requests based on their **leaderboard score** — a reputation built from how well their past responses scored during validation. Higher-scoring miners receive a proportionally larger share of routed traffic.

A newly registered miner enters a **7-day grace period** during which it receives 5% of total routed requests, shared equally with all other grace-period miners. This gives new miners enough traffic to build a track record without requiring a pre-existing reputation.

## The Validation Pipeline

When a miner returns a response, it isn't taken at face value. Validators run a multi-step verification pipeline:

**1. Ground Truth Scraping (via zkTLS)**
The elected Leader Validator scrapes the canonical data source for the Intent from a whitelisted URL. A zkTLS proof is generated, cryptographically attesting that the scraped data came from a real TLS connection to that endpoint — not a fabricated payload. Non-leader Validators verify this proof independently without making any external API calls.

**2. Canonical Script Execution (WASM)**
Every Intent has exactly one Canonical Script — a WASM program that defines how to score a miner response. Each Validator independently executes this script against the ground truth and the miner's response, producing a Local Score between 0 and 1.

Canonical Scripts are not chosen by humans. They evolve autonomously: challenger scripts run alongside the Canonical in a 10% testing cohort. If a challenger script proves it catches quality issues the Canonical misses (a defined Catch-Rate condition), it automatically becomes the new Canonical after a minimum of 3 test epochs. The previous Canonical is demoted but remains available for future testing.

**3. BFT Consensus (Commit-Reveal)**
Validators do not share scores openly — that would allow copying. Instead they use a commit-reveal scheme:
- Each Validator broadcasts a cryptographic commitment (hash of their score + a nonce).
- After 45 seconds (or when enough commits arrive), the reveal phase begins.
- Validators publish their plaintext score + nonce.
- The Leader verifies the revealed scores, computes the **stake-weighted median**, and finalizes the Canonical Score.

Finalization requires 43 of 64 Validators to participate (Byzantine fault tolerance against up to 21 malicious actors). If 3 consecutive rounds fail to reach this threshold, consensus temporarily reduces to a simple majority of 33 to maintain liveness, flagging those receipts as `Reduced_Consensus`.

**4. On-Chain Settlement**
Scoring and consensus happen entirely off-chain. The Block Builder submits a single transaction to the Diamond contract containing:
- An Epoch State Root (Merkle root of all scores, leaderboard updates, and rewards).
- A BLS aggregate signature from all participating Validators.

The contract verifies the BLS signature in one operation and accepts the State Root as truth. This keeps gas costs minimal while preserving cryptographic security.

## Spot Checks: Continuous Mid-Epoch Validation

Validators don't only grade miners at epoch boundaries. Spot checks run continuously throughout the epoch — approximately once every 20 seconds, triggered deterministically by the hash of the latest Base L2 block combined with the Intent ID.

If any miner's spot check score drops more than 20% relative to their last leaderboard score, the protocol issues a **Routing Revocation**: that miner is removed from the routing table immediately and their traffic share redistributed to remaining eligible miners. The revocation is recorded immutably in the epoch block.

## Signal Delivery

Once a request is finalized:
- For **HTTP agents** (x402): the response is returned directly in the HTTP reply to the retry request.
- For **WebSocket subscribers**: the finalized signal is pushed to subscribed clients after BFT finalization. Delivery is logged on-chain per subscriber per signal.
- For **on-chain jobs** (ERC-8183): the Leader executes a callback transaction, calling `subnetMessage()` on the agent's callback contract with the result.

## The Autonomous Engine Loop

The protocol doesn't wait for agents to ask questions. The Daemon runs on a configurable cycle (every 3 hours in production) and proactively:

1. Runs registered **Collectors** — YAML-configured scrapers that pull data from off-chain sources (e.g., weather APIs, clinical trial databases, market feeds).
2. Uses an LLM router to classify collected data into Intents and formulate inference questions.
3. Routes those questions through the miner mesh.
4. Stores finalized results in the database.
5. Publishes results to WebSocket subscribers.

This means the network is continuously producing verified intelligence even without active agent demand — building a track record for miners and validators before organic usage scales.

## Off-Chain Execution, On-Chain Security

The key design insight: expensive computation happens off-chain (scoring, consensus, routing decisions), while the on-chain layer handles only the security guarantees (BLS signature verification, state root acceptance, payment settlement, miner payouts). This keeps the protocol economically viable while maintaining trustless guarantees.

The canonical chain for Telegraph is **Base** — an Ethereum Layer-2 rollup with fast finality and low fees.
