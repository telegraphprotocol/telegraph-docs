---
description: "Start here: what Telegraph bounties are, what they ask for, and how to contribute."
---

# Telegraph Bounties

The [Telegraph bounty board](https://github.com/telegraphprotocol/bounties/issues) is the public list of work that would strengthen the network: a missing provider, evaluator, application, integration, evaluation need, or tooling improvement.

A bounty is a GitHub Issue with an acceptance checklist. It is not a promise that a capability is already live, and closing an Issue does not itself change routing, rankings, payments, or protocol eligibility.

## Start with an open Issue

Choose an Issue labelled `status:open`, read its acceptance criteria and `## Reward` section, then comment:

```text
/claim
```

Several contributors can claim the same Issue. Keep an active claim with a meaningful `/progress` update at least once every 72 hours. When the work is ready, submit links and evidence with `/submit`.

```text
/submit https://github.com/you/project — live endpoint, test output, and reproduction steps
```

A maintainer independently verifies the stated acceptance criteria before approving a contribution.

## What appears on the board

| Need | Typical label |
|---|---|
| A provider or miner | `work:miner` |
| An evaluator, adapter, comparator, or evaluation material | `work:evaluator` |
| An app, agent, or integration | `work:app` |
| Tooling or protocol work | `work:tooling`, `work:protocol` |
| Public security hardening | `work:security` |
| Coverage for an important release | `source:release` |

Use the Issue itself as the source of truth for scope, evidence, and any reward. The board may also list commercial provider opportunities; those use the contact path named in the Issue rather than the claim workflow.

## Rewards

An Issue labelled `reward:unfunded` makes no payment commitment. A funded Issue must state its amount, asset, eligibility, verification condition, and payout window before it is claimed. The reward terms on the Issue—not this page—govern that contribution.

## Next

- [Your first bounty](your-first-bounty.md)
- [How the board works](how-a-bounty-works.md)
- [Reading an Issue](reading-a-bounty.md)
- [Evaluation work](evaluation-material.md)
- [Building an evaluator](building-an-adapter.md)
- [Rules and rewards](rules-and-rewards.md)
