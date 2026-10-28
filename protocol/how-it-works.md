---
description: A complete walkthrough of how Telegraph processes a request from payment to finalized signal delivery.
---

# How It Works

## Intents: The Unit of Intelligence

Every inference request in Telegraph is described by an **Intent**: a canonical label for a type of AI task, such as `FX_NOW_EUR`, `CODE_REVIEW_GENERAL` or `WEATHER_CHECK_TEMPERATURE`. It tells the protocol what kind of answer is needed without prescribing which model or miner provides it.

Intents are organised into **families**. A family is named by a **prefix** (`FX_NOW`) that fixes how the whole family is scored: deterministic (one right answer), hybrid (part checkable, part judged) or judgment (open-ended). A prefix is not itself an intent. The intents under it extend it with `_` (`FX_NOW_EUR`, `FX_NOW_CAD`), and each one carries its own question, tolerance and answer format on-chain. Miners register for intents, each intent has its own miners and its own ranking, and anyone can propose a new intent under an existing prefix. See [Intents](../using/intents.md).

Each Intent also has one **request schema** (what a caller sends) and one **response format** (what comes back), the same whichever miner serves it. That is what lets a caller send typed `params` and get the same keys back from any miner.

Miners declare which Intents they can fulfill when they register. Validators know which scoring module to apply for each family. Agents pay for a specific Intent and receive an answer in a predictable shape without ever needing to choose a model directly.

## The Miner: Supplying Intelligence

Miners are compute providers. They expose one or more AI capabilities through a standardized YAML configuration, describing their API endpoints, supported Intents, authentication method and minimum price. When they register on-chain, the protocol nodes pick up the YAML automatically, validate it, and add the miner to the routing pool.

A miner may also declare an `intent_mapping`, which tells the node exactly how to build its request for each intent and where each field of the intent's answer sits in its response. Numbers are then computed in code rather than guessed by a model.

Miners are selected for requests based on their **leaderboard score**, a reputation built from how well their past responses scored during validation. Higher-scoring miners receive a proportionally larger share of routed traffic.

A newly registered miner enters a **7-day grace period** during which it receives 5% of total routed requests, shared equally with all other grace-period miners.

## From a Request to an Answer

1. **Match.** A plain-language question is classified into an Intent. A canonical request already names its Intent and carries typed `params`.
2. **Validate.** For an Intent with a request schema, the `params` are checked in code **before any miner is chosen or any payment is taken**. A bad request returns `400 invalid_params` and costs nothing.
3. **Quote.** The `402` quotes the price.
4. **Pay.** x402 or escrow. The payment is verified; nothing is settled yet.
5. **Call.** The node turns the request into the miner's own API call (with the request builder, or the miner's `intent_mapping`) and calls it, with a fallback miner lined up.
6. **Shape.** The response parser reads the miner's answer into the Intent's response format. `result` has the same keys whichever miner answered. The raw answer is what is stored, hashed and signed.
7. **Bill.** The delivery is recorded and charged at the epoch.

## The Validation Pipeline

When a miner returns a response, it isn't taken at face value. Validators run a multi-step verification pipeline:

**1. Reference Values from Truth Sources**
Deterministic Intents (and the checkable part of hybrid Intents) are checked against a reference value. There is no built-in data source per Intent. Instead, contributors upload **truth sources** to the Evaluation Pool (below): descriptions of public, key-less APIs that answer the Intent's question, in the same format as a miner YAML. Each epoch, for each question, the node picks up to 3 of them, calls each one, reads the value out of each answer, and takes the median. That median is fixed once for the epoch, so every miner is scored against the same value. An Intent with no usable truth source is not ranked that epoch, and its miners keep their previous ranking.

**2. Canonical Scoring Module (WASM)**
Every family has at most one canonical scoring module at a time, a WASM module that defines how to score a miner response. Which kind depends on the family's kind (see [Intents](../using/intents.md#the-three-kinds)):
- **Deterministic** families use a comparator: the value in the miner's answer is compared with the epoch's reference value from truth sources (step 1), within the Intent's tolerance.
- **Judgment** families use a model-based **evaluator adapter** that judges each answer on its own merits. The question miners are asked comes from the Evaluation Pool (below).
- **Hybrid** families combine a comparator score with a model's judgment, using the Intent's fusion rule.

Each Validator independently executes the module on the miner's response, producing a Local Score between 0 and 1.

One module registered on a family prefix (for example `WEATHER_FORECAST`) also scores every Intent under it (`WEATHER_FORECAST_LAHORE`). An Intent that no module serves is not scored that epoch, and its miners keep their previous ranking.

Canonical modules are not chosen by humans. Anyone can register a challenger on-chain. A challenger for a judgment or hybrid family replaces the canonical module only by beating it in a competition on a hidden sample from the Evaluation Pool: both are scored on the same sample, and the challenger must win by a set margin and clear a minimum win rate. A comparator replaces the canonical one only if it reproduces the reference comparison exactly. The previous canonical module is kept as a fallback. See [Build an Evaluator Adapter](../scoring/build-a-scoring-module.md#what-checks-your-module-must-pass).

**3. Quorum Signature (BLS)**
Validators independently compute the epoch's state and sign it. The signatures are **BLS12-381** signatures that aggregate into one. They sign a Consensus_Message that commits to the chain, the protocol version, the validator set, the state sequence and the state root being created, so a signature counts for exactly one state transition.

Finalization requires a **quorum** of the active set: `floor(2n/3) + 1` validators (one validator alone at one validator, 43 of 64 at a full set). The active set is the top 64 validators by stake, picked at each accepted epoch and frozen until the next one.

**4. On-Chain Settlement**
Scoring and signing happen off-chain. The node submits a single transaction to the Diamond contract containing:
- An Epoch State Root (committing the scores, leaderboard updates, entitlements and the epoch's deliveries).
- A BLS aggregate signature and a bitmap of which validators signed.

The contract verifies the aggregate signature in one operation and accepts the State Root as truth. Each accepted epoch also commits a **block hash that chains the previous block**, so history cannot be rewritten. A block too large for one transaction is settled in chunks. This keeps gas costs minimal while preserving cryptographic security.

A paying caller can prove their call was billed: the node serves the epoch block and a Merkle proof from the call's receipt to the block's delivery root, which ties to the on-chain state root.

## The Evaluation Pool

The network keeps an **Evaluation Pool** per Intent, contributed by anyone who signs an upload. For judgment and hybrid Intents, which have no single right answer to check against, it holds questions, each with a better and a worse answer. For deterministic and hybrid Intents, it also holds truth sources (step 1). The pool is used two ways:
- A hidden half tests challenger scoring modules against the canonical one. It is never shown to miners or to module authors.
- The other half supplies the question each judgment Intent's miners are asked when they are ranked each epoch, and the truth sources that reference values are built from. Each use is recorded against the contributor's address.

The pool is frozen once per epoch, at the epoch rollover, and each frozen snapshot is used from the epoch that starts then. Material uploaded during one epoch is used from the next, and every Validator scores an epoch on the same material. A competition sample is drawn with a seed taken from an epoch confirmed after the challengers registered, so no one can predict it. See [Contribute Evaluation Data](../scoring/contribute-evaluation-data.md).

## Spot Checks: Continuous Mid-Epoch Validation

Validators don't only grade miners at epoch boundaries. Spot checks run continuously throughout the epoch, on average about once per hour for each Intent (the node default), at randomised times so a miner cannot predict them.

Spot checks test liveness, not answer quality: a miner passes by returning a non-empty answer. If a miner fails consecutive spot checks (no response, or an empty answer), the protocol issues a **Routing Revocation**: that miner is removed from the routing table for that Intent and their traffic share redistributed to remaining eligible miners. The revocation is recorded immutably in the epoch block. Answer quality is judged only by the epoch ranking.

## Signal Delivery

Once a request is answered:
- For **HTTP agents** (x402 or escrow): the response is returned directly in the HTTP reply.
- For **WebSocket subscribers**: the signal is pushed to subscribed clients. Delivery is logged per subscriber per signal.
- For **on-chain jobs** (ERC-8183): the validator quorum signs the job's resolution, which binds the exact answer, and the node calls `transitionToTerminal`. The agent's callback receives `subnetMessage(jobId, true, response, "")`, where `response` is the Intent's fixed, processed answer. If no miner can answer, the quorum signs a failure instead, the agent is refunded, and the callback receives `success = false` with the reason. See [On-Chain Jobs](../using/erc8183-jobs.md).

## The Autonomous Daemon Loop

The protocol doesn't wait for agents to ask questions. The **Daemon**, a service separate from the on-demand Engine, runs on a configurable cycle (every 3 hours in production) and proactively:

1. Runs registered **Collectors**: YAML-configured scrapers that pull data from off-chain sources (for example weather APIs, market feeds, news and social feeds).
2. Uses an LLM router to classify collected data into Intents and formulate inference questions.
3. Routes those questions through the Engine to the miner mesh.
4. Stores the results in its database.
5. Serves them read-only over HTTP and pushes new ones to WebSocket subscribers.

This means the network is continuously producing verified intelligence even without active agent demand, building a track record for miners and validators before organic usage scales. These autonomously generated signals are what the [Intelligence Terminal](https://alexandria.telegraphprotocol.com/) displays; you can also read them directly via the [Daemon Signal Feed](../using/daemon-signals.md). The Daemon generates its own questions on a schedule; the Engine answers *your* questions on demand. The two are distinct. The Daemon's own asks are served on a payment-free internal path and are not billed or counted as consumer demand.

## Off-Chain Execution, On-Chain Security

The key design insight: expensive computation happens off-chain (scoring, routing decisions, answer shaping), while the on-chain layer handles only the security guarantees (BLS signature verification, state root acceptance, payment settlement, miner entitlements, job resolution). This keeps the protocol economically viable while maintaining trustless guarantees.

The canonical chain for Telegraph mainnet is **Ethereum**. The testnet runs on Ethereum Sepolia (chain ID 11155111).
