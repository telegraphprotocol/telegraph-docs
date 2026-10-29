---
description: How the bounty board serves the Season II (H2) hackathon — the 15 missions, how missions map to reusable intents, when an intent counts as ready, and what working means for an application.
---

# Bounties and Season II

Season II (H2) starts from the **end state**: real applications must work.

Dates, tracks, prizes and eligibility are set by the official rules at
[hackathon.telegraphprotocol.com/rules](https://hackathon.telegraphprotocol.com/rules).
This page covers only how the bounty board supports the hackathon.

The 15 commercial missions define the demand side. Applications and agents pick
a mission and combine the reusable [intents](../using/intents.md) they need.
Miners and evaluators stay intent-based and industry-agnostic. The bounty board
connects the two by exposing what blocks them.

## Missions and intents

A mission is an application goal, such as an exchange's listing checks or an
agriculture operator's planning. It is application logic, not a new intent.

For example, an agriculture app may compute a "destocking clock" from weather,
satellite, sensor and logistics answers. The destocking clock is the app's own
logic. The reusable pieces underneath it, such as `WEATHER_FORECAST_VERIFY` and
`SATELLITE_IMAGERY_ANALYSIS`, are intents.

Season II bounties use only intents that already exist: every intent in the
bounty board's catalogue, mandatory ones first. Nobody proposes or adds a new
intent through a bounty, and a mission-specific output is never a new intent.
Each bounty starts from the apps in the Season II brief and asks for what an
intent needs before its miners can be ranked: evaluation material and an
evaluator adapter, done in [Anjoman](https://anjoman.ai/dashboard/eval).

The bounty repository publishes the starting map:

| File | Contents |
|---|---|
| [`catalog/missions.json`](https://github.com/telegraphprotocol/bounties/blob/main/catalog/missions.json) | The 15 missions and their core starting intents |
| [`catalog/intents.json`](https://github.com/telegraphprotocol/bounties/blob/main/catalog/intents.json) | The 103-intent catalogue |
| [`docs/MISSIONS.md`](https://github.com/telegraphprotocol/bounties/blob/main/docs/MISSIONS.md) | The mission → intent map, readable |
| [`docs/NETWORK_MAP.md`](https://github.com/telegraphprotocol/bounties/blob/main/docs/NETWORK_MAP.md) | Which intents appear in the most missions |

The map is a starting point, not a whitelist. Applications may use any relevant
intent. How often an intent appears across missions shows reuse, not proven
demand.

## How gaps turn into work

```text
App declares or discovers the intents it needs
        ↓
Live use exposes weak supply, evaluation or integration
        ↓
The gap becomes a bounty
        ↓
Miners, evaluators and contributors fix it
        ↓
The app retests
        ↓
The mission reaches a working state
```

H2 Issues carry the `source:h2` label and, where relevant, a `mission:*` label.
Customer, mainnet and release work continues in the same queue. A still-valid,
reusable gap does not close just because the hackathon ends.

## When an intent is ready

An intent is not ready because a repository exists. Depending on the
application, readiness can include:

- live, independent miner supply;
- usable evaluation;
- ranking available;
- paid Telegraph requests succeeding;
- compatible output where the consuming app needs a common shape;
- latency and reliability within the app's tolerance;
- the app integration working end-to-end;
- reference fixtures and smoke tests passing.

Telegraph does not force one response schema on every miner. Apps or adapters
can normalise outputs when a workflow needs a common shape.

Each bounty states its own exact closing criteria.

## What working means

For H2 application work, the application is the proof, not a slide:

```text
machine requests intelligence → Telegraph routes to ranked supply → the paid request and receipt are visible → the machine uses the result → the workflow continues
```

Bounties exist to remove whatever stops that flow.
