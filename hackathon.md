---
description: One hackathon, three tracks, $5,000 in prizes. We're not looking for the best demo — we're looking for evidence that the quality flywheel works.
---

# Hackathon

**We are not looking for the best demo. We are looking for real evidence that the quality flywheel works.**

## Why this exists

The objective is to prove that Telegraph's intelligence layer and quality flywheel work under real conditions:

- Miners can be properly ranked on real performance.
- Real demand from applications gets routed to better miners through probabilistic routing.
- Ranking and routing together create a self-reinforcing loop where quality compounds over time.
- The result is a competitive, high-quality intelligence layer that gets stronger with usage.

We're testing whether the core mechanism — ranking + probabilistic routing + real economic incentives — produces a stronger intelligence layer for machines.

## How Telegraph works

### What is an intent?

An **intent** is a specific category of intelligence an application can request — AI text detection, weather data, financial signals, logistics information. Each intent has its own independent leaderboard, so you only compete with miners in the same domain.

See [Intents](using/intents.md) for the full list.

### 1. Miners are ranked, not just listed

Anyone can bring a model, API, dataset or specialised system into Telegraph as a miner. Miners are ranked on performance, domain relevance and historical quality. Validators continuously evaluate outputs against ground truth using evaluation scripts. Higher and more consistent performance means a higher rank.

### 2. Probabilistic routing based on intent

When an agent needs intelligence it does **not** pick a miner. It declares its intent — the domain, a minimum confidence threshold, and a deadline. Telegraph routes probabilistically to the top-ranked miners for that intent. Higher-performing miners receive more traffic and more USD per query.

### 3. The quality flywheel

Better miners → more routed demand → more real USD earnings → stronger earnings attract better miners → the network compounds in quality, reliability and coverage.

This is what makes Telegraph different from a simple aggregator.

### 4. Independent leaderboards per intent

Each intent has its own leaderboard. Miners solving different tasks do not affect your ranking or routing share. This keeps competition fair within each domain.

### 5. Why this architecture matters

Simple aggregators lack ranking, verification, probabilistic routing, and the incentive flywheel that turns raw, unverified API output into reliable, monetisable, machine-grade intelligence. Telegraph is designed to get stronger with real usage, not weaker.

## Tracks

One hackathon, three interconnected tracks. Track 3 starts only after Tracks 1 and 2 close. Winners are announced once, after all tracks end.

| Track | What you build | Dates | Length |
|---|---|---|---|
| **1 — Miners** | Building and running high-quality miners | Aug 17 – Aug 31 | 15 days |
| **2 — Script Authors** | Writing and improving evaluation scripts | Aug 17 – Aug 31 | 15 days |
| **3 — Applications** | Real applications and agents using Telegraph | Aug 31 – Sep 7 | 7 days |
| Winner selection | — | Sep 8 – Sep 18 | 10 days |
| Announcement & prizes | — | Sep 19 – Sep 25 | 7 days |

**Where to start for each track:**

- **Track 1** — [What Miners Do](miners/miner-overview.md), then [YAML Configuration](miners/yaml-config.md) and [Registering as a Miner](miners/miner-registration.md). Registration costs gas and nothing else; there is no bond or stake.
- **Track 2** — [Build a Scoring Module](scoring/build-a-scoring-module.md), then the [Scoring Reference](scoring/scoring-reference.md). Registering a module is also free beyond gas.
- **Track 3** — [Engine Inference](using/engine-ask.md) and [Paying with x402](using/x402-inference.md). For live feeds, see [WebSocket Signal Subscriptions](using/websocket-signals.md).

## High-value areas to explore

Surface-level integrations will not stand out. The strongest submissions come from teams that leverage Telegraph as an intelligence layer, not just an API.

- **On-chain and blockchain intelligence pipelines** — agents that consume verified intelligence and directly trigger on-chain actions: trading, liquidations, arbitrage, compliance checks, treasury management. One of the highest-value use cases.
- **Autonomous agents and workflows** — agents that subscribe to real-time signals and act without human intervention.
- **Multi-intent and cross-domain intelligence** — combining signals from several intents into stronger decisions.
- **Confidence thresholds and routing behaviour** — experiment with confidence levels and see how routing changes.
- **Signal quality and verification** — understand how validators score outputs and what that means for downstream reliability.
- **Real-time streaming and persistent intelligence** — go beyond one-off queries to systems that continuously consume and act on live feeds.

## Judging — Track 1: Miners

| Weight | Criterion |
|---|---|
| **75%** | **Normalised performance within your intent.** Your average Canonical Score divided by the highest average score inside your specific intent. The best miner in every intent automatically gets full points, which keeps intents of different difficulty comparable. |
| **25%** | **Engagement and updates on X.** Quality, consistency, reach and meaningful engagement of your update posts. Tag **@Telegraphprotoc** in every update. |

Every miner is scored out of 100. Winners are determined using intradomain normalisation so that intents of different difficulty and volume compete fairly.

**Guardrail:** an intent must have at least **3 active miners** and receive at least **100 real requests** from Track 3 applications to be eligible for global cash prizes.

The top 3 miners by total normalised score across all intents win. This gives the best miner in every intent a fair chance regardless of how strict their intent's canonical script is.

## Prizes

All prizes paid in USD after final results are announced.

| Track | Pool | 1st | 2nd | 3rd |
|---|---|---|---|---|
| Miner | $2,000 | $1,000 | $600 | $400 |
| Script Author | $1,000 | $500 | $300 | $200 |
| Application | $2,000 | $1,000 | $600 | $400 |
| **Total** | **$5,000** | | | |

## Rules

These are non-negotiable.

1. Track 3 applications must use **real** Telegraph miners. Simulated or mocked data is not allowed.
2. Miners and script authors must stay live and operational throughout Track 3.
3. All updates used for judging must be publicly posted on X and properly tagged.
4. Artificial inflation of metrics, or gaming the system, results in disqualification.
5. Each intent has its own independent leaderboard. You compete only with miners in your domain. Cash prizes go to the top 3 miners by overall normalised score across all intents.
6. All participants must join the official Hackathon Discord. Announcements, discussion and support happen there, and staying active is expected.

---

This hackathon exists to test and prove Telegraph's core proposition: a ranked, verified, economically incentivised intelligence layer that gets stronger with real usage.

If you'd rather build a competitive intelligence layer for machines than another aggregator, we'd like you to take part.

Good luck.
