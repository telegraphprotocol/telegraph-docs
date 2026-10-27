---
description: The kinds of gaps on the bounty board, the labels that mark work type, gap, priority, source and reward, and which Issue form to use for each.
---

# Kinds of Work

Every bounty describes one gap: something the network needs that is missing or
too weak. The gap decides who can solve it.

## Work types

| Work | What it means | Label |
|---|---|---|
| **Miner / Provider** | Missing, weak or unreliable supply for an intent | `work:miner` |
| **Evaluator: adapter** | Missing or weak scoring logic, shared across an intent Category | `work:evaluator` |
| **Evaluator: material** | Missing or stale test material and independently supported references | `work:evaluator` |
| **App / Agent / integration** | An application that cannot finish its workflow because something is missing | `work:app` |
| **Tooling / protocol** | SDKs, examples, docs, observability, reliability | `work:tooling`, `work:protocol` |
| **Security hardening** | Public, non-sensitive hardening of the bounty repository's own tooling | `work:security` |
| **Release coverage** | A major AI release the network cannot yet measure fairly | `source:release` |

To build a miner, start with [What Miners Do](../miners/miner-overview.md). For
evaluator work, see [Build an Evaluator Adapter](../scoring/build-a-scoring-module.md)
and [Contribute Evaluation Data](../scoring/contribute-evaluation-data.md).

## Labels

Labels let you filter the board.

| Group | Labels | Meaning |
|---|---|---|
| Gap | `gap:supply`, `gap:evaluation`, `gap:integration`, `gap:quality`, `gap:latency`, `gap:coverage`, `gap:reliability`, `gap:tooling`, `gap:security` | What exactly is missing |
| Priority | `priority:p0`, `priority:p1`, `priority:p2` | How urgent it is (below) |
| Source | `source:h2`, `source:customer`, `source:mainnet`, `source:release`, `source:roadmap`, `source:protocol`, `source:security` | Where the need came from |
| Mission | `mission:<id>`, for example `mission:exchange` | The Season II mission it serves |
| Reward | `reward:unfunded`, `reward:funded`, `reward:paid` | Payment status (see [Rewards](rewards.md)) |
| Helpers | `good first bounty`, `help wanted` | Easier entry points |

### Priority

| Priority | When |
|---|---|
| **P0** | Blocks material demand, several applications, critical reliability or security, or an important time-sensitive market outcome. |
| **P1** | Materially improves quality, coverage, evaluation, integration or developer speed. |
| **P2** | Useful, but not currently blocking important demand. |

## Provider opportunities are not bounties

An Issue labelled `opportunity:provider` invites an already-operating service
(an established API, model or data provider) to discuss joining the network.
It is **not claimable**. It follows a commercial onboarding process instead of
`/claim` and `/submit`, and the `reward:unfunded` label means it carries no
bounty payment.

## Issue forms

New Issues start from a form, and every form starts in `status:triage`.

| Form | Title starts with | Use it for |
|---|---|---|
| Miner / intelligence-supply gap | `[Miner]` | An intent with missing or weak supply |
| Evaluator development opportunity | `[Evaluator]` | Scoring logic that is missing or weak |
| Evaluation contribution opportunity | `[Evaluation]` | Missing test material, described at Category level |
| App / Agent integration gap | `[App]` | An application blocked by something missing |
| Protocol / tooling gap | `[Protocol/Tooling]` | SDKs, docs, reliability, observability |
| AI release / market coverage gap | `[Release]` | A new release the network cannot measure yet |
| Public-safe missing capability | `[Capability]` | A reusable need where the right intent is not yet clear |
| Independent Provider recruitment | `[Provider opportunity]` | Recruiting an established service |

How to fill one in well: [Reporting a Gap](reporting-a-gap.md).
