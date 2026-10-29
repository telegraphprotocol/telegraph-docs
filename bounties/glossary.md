---
description: Short definitions of the terms used on the bounty board — intent, mission, gap, bounty, triage, claim, provider opportunity, evaluator, release coverage and more.
---

# Bounty Glossary

The terms used across the bounty pages. Where these and the protocol differ,
the protocol wins.

| Term | Meaning |
|---|---|
| **Intent** | A reusable intelligence task with its own market, such as `WEATHER_FORECAST_VERIFY`. Miners and evaluators compete per intent. See [Intents](../using/intents.md). |
| **Category** | A group of related intents, such as Climate & Weather. Evaluation logic can be shared across a category. |
| **Mission** | One of the 15 Season II application goals. A mission combines several intents. It is application logic, not a new intent. See [Bounties and Season II](season-two.md). |
| **Season II / H2** | The hackathon built around the 15 missions. Issues from it carry `source:h2`. |
| **Miner / Provider** | A service that supplies intelligence for an intent. The label is `work:miner`; Issue text may say Provider. |
| **Evaluator** | A party that measures how good miners' answers are, so miners can be ranked. |
| **Adapter** | Scoring logic packaged as WASM that compatible intents can share. |
| **Evaluation material** | Test questions and independently supported reference answers. Hidden material stays secret. |
| **App / Agent** | A product or automated workflow that uses intents. Apps create demand and expose gaps. |
| **Gap** | Something the network needs that is missing or too weak: supply, evaluation, integration, tooling or release coverage. |
| **Bounty** | A claimable Issue (`status:open`) with clear acceptance criteria. It may or may not carry a reward. |
| **Acceptance criteria** | The checklist that defines done. A maintainer reproduces every item before approving. |
| **Triage** | The first state of every report (`status:triage`). A maintainer checks it is real, reusable, not a duplicate, safe to publish and verifiable. |
| **Claim** | Your recorded right to work an Issue, taken with `/claim`. Several people can hold claims on one Issue. Yours is released after 72 hours without `/progress`. |
| **Provider opportunity** | `opportunity:provider`. A commercial listing inviting an established service to join. Not claimable, never a bounty. |
| **Release coverage** | Work that lets a newly released model, API or tool be measured fairly in an existing market. Success is fair measurement, not a particular rank. |
| **Funded / unfunded** | Whether a bounty carries a committed reward. Every bounty is unfunded at launch. See [Rewards](rewards.md). |
| **Reward record** | The copy and hash of the Issue's reward terms that the bot posts when you claim. |
| **MACHINA** | The protocol's token. It can be a bounty payout asset only if the Issue names it and gives the conversion rule. |
