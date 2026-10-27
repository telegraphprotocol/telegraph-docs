---
description: What the Telegraph bounty board is, what kinds of gaps it lists, how it relates to Season II, and where protocol state is decided instead.
---

# The Bounty Board

The bounty board is the public work queue for the Telegraph network. It lists
**what the network is missing**: a miner for an intent, an evaluator, evaluation
material, an integration, or a tool. Builders pick a gap, fix it and submit
proof.

It lives in the public GitHub repository
[telegraphprotocol/bounties](https://github.com/telegraphprotocol/bounties).
Each bounty is a GitHub Issue.

```text
Gap found → public Issue → builder claims → builds → submits proof → maintainer verifies → capability gets stronger
```

## What the board is for

The goal is not to open as many Issues as possible. The goal is to reduce the
number of real applications that are still blocked.

Applications create demand. When an application cannot finish its workflow,
something underneath it is missing or too weak. The board turns that into a
small, reusable piece of work with a clear finish line.

| Thinks in | Who |
|---|---|
| **Missions** | Applications and agents |
| **Intents** | Miners and evaluators |
| **Gaps** | The bounty board, which connects the two |

Miners and evaluators work per [intent](../using/intents.md), whatever the
industry. One good miner can unblock several applications at once.

## What the board is not

GitHub coordinates contributions. It does not decide protocol state.

| Decision | Decided by |
|---|---|
| A gap is real, reusable and safe to publish | A maintainer of the bounty repository |
| A submission meets its acceptance criteria | A maintainer, after reproducing it |
| A bounty carries a reward | Telegraph leadership, written on the Issue before anyone claims it |
| A miner or intent is eligible, or a ranking changes | The Telegraph protocol itself |

A bounty marked done means its acceptance criteria passed. It does not mean the
network now serves the capability. The network decides that through its normal
registration, evaluation and ranking.

## Funding at launch

**At launch, every bounty is unfunded.** Each Issue says whether it is funded.
A funded Issue publishes the amount, asset and rules before anyone can claim
it. See [Rewards](rewards.md).

## Where to go next

| I want to… | Read |
|---|---|
| Follow one bounty from start to finish | [Your First Bounty](your-first-bounty.md) |
| Understand the claim and review process | [How a Bounty Works](how-a-bounty-works.md) |
| Know what kinds of work exist | [Kinds of Work](kinds-of-work.md) |
| Build for the Season II hackathon | [Bounties and Season II](season-two.md) |
| Report a gap I found | [Reporting a Gap](reporting-a-gap.md) |
| Know how payment works | [Rewards](rewards.md) |
| Use the board from a terminal or an agent | [Command Line and Agents](command-line.md) |
| Look up a term | [Bounty Glossary](glossary.md) |
