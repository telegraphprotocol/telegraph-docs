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
Every Intent has at most one Canonical Script at a time — a WASM scoring module that defines how to score a miner response. Which kind depends on the Intent's tier (see [Intents](../using/intents.md#how-answers-are-scored)):
- **Deterministic** Intents use a comparator: the value in the miner's answer is compared with the true value from a real source, within the Intent's tolerance.
- **Judgment** Intents use a reward model that judges each answer on its own merits. The question miners are asked comes from the Evaluation Pool (below).
- **Hybrid** Intents combine a comparator score with a model's judgment.

Each Validator independently executes this script on the miner's response, producing a Local Score between 0 and 1.

For judgment and hybrid Intents, one module registered on a family Intent (for example `WEATHER_FORECAST`) also scores its children (`WEATHER_FORECAST_LAHORE`). An Intent that no module serves is not scored that epoch, and its miners keep their previous ranking.

Canonical Scripts are not chosen by humans. Anyone can register a challenger on-chain. A challenger for a judgment or hybrid Intent replaces the Canonical only by beating it in a competition on a hidden sample from the Evaluation Pool: both are scored on the same sample, and the challenger must win by a set margin and clear a minimum win rate. A comparator replaces the Canonical only if it reproduces the reference comparison exactly. The previous Canonical is kept as a fallback. See [Build a Scoring Module](../scoring/build-a-scoring-module.md#what-checks-your-module-must-pass).

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

## The Evaluation Pool

Judgment and hybrid Intents have no single right answer to check against, so the network keeps an **Evaluation Pool** per Intent: questions, each with a better and a worse answer, contributed by anyone who signs an upload. The pool is used two ways:
- A hidden half tests challenger scoring modules against the Canonical. It is never shown to miners or to module authors.
- The other half supplies the question each judgment Intent's miners are asked when they are ranked each epoch. Each use is recorded against the contributor's address.

The pool is frozen once per epoch, at the epoch rollover, and each frozen snapshot is used from the epoch that starts then. Material uploaded during one epoch is used from the next, and every Validator scores an epoch on the same material. A competition sample is drawn with a seed taken from an epoch confirmed after the challengers registered, so no one can predict it. See [Contribute Evaluation Data](../scoring/contribute-evaluation-data.md).

## Spot Checks: Continuous Mid-Epoch Validation

Validators don't only grade miners at epoch boundaries. Spot checks run continuously throughout the epoch — approximately once every 20 seconds, triggered deterministically by the hash of the latest Base L2 block combined with the Intent ID.

Spot checks test liveness, not answer quality: a miner passes by returning a non-empty answer. If a miner fails consecutive spot checks (no response, or an empty answer), the protocol issues a **Routing Revocation**: that miner is removed from the routing table for that Intent and their traffic share redistributed to remaining eligible miners. The revocation is recorded immutably in the epoch block. Answer quality is judged only by the epoch ranking.

## Signal Delivery

Once a request is finalized:
- For **HTTP agents** (x402): the response is returned directly in the HTTP reply to the retry request.
- For **WebSocket subscribers**: the finalized signal is pushed to subscribed clients after BFT finalization. Delivery is logged on-chain per subscriber per signal.
- For **on-chain jobs** (ERC-8183): the Leader executes a callback transaction, calling `subnetMessage()` on the agent's callback contract with the result.

## The Autonomous Daemon Loop

The protocol doesn't wait for agents to ask questions. The **Daemon** — a service separate from the on-demand Engine — runs on a configurable cycle (every 3 hours in production) and proactively:

1. Runs registered **Collectors** — YAML-configured scrapers that pull data from off-chain sources (e.g., weather APIs, market feeds, news and social feeds).
2. Uses an LLM router to classify collected data into Intents and formulate inference questions.
3. Routes those questions through the Engine to the miner mesh.
4. Stores the results in its database.
5. Serves them read-only over HTTP and pushes new ones to WebSocket subscribers.

This means the network is continuously producing verified intelligence even without active agent demand — building a track record for miners and validators before organic usage scales. These autonomously generated signals are what the [Intelligence Terminal](https://alexandria.telegraphprotocol.com/) displays; you can also read them directly via the [Daemon Signal Feed](../using/daemon-signals.md). The Daemon generates its own questions on a schedule; the Engine answers *your* questions on demand — the two are distinct.

## Off-Chain Execution, On-Chain Security

The key design insight: expensive computation happens off-chain (scoring, consensus, routing decisions), while the on-chain layer handles only the security guarantees (BLS signature verification, state root acceptance, payment settlement, miner payouts). This keeps the protocol economically viable while maintaining trustless guarantees.

The canonical chain for Telegraph is **Base** — an Ethereum Layer-2 rollup with fast finality and low fees.
