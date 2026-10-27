---
description: A worked example of one bounty from start to finish — reading the Issue, claiming it, posting progress, submitting proof and getting it approved — with the exact comments to post at each step.
---

# Your First Bounty

This page follows one bounty from start to finish. The Issue below is a
**made-up example**: the format is real, the bounty and the people are not.
For the rules behind each step, see [How a Bounty Works](how-a-bounty-works.md).

## 1. Find an Issue

Open the [bounty board](https://github.com/telegraphprotocol/bounties/issues)
and filter for `status:open`. If you are new, add the `good first bounty` label
too.

Each bounty has the same sections. Our example:

> **[H2][Miner] Add competitive supply for SATELLITE_IMAGERY_ANALYSIS**
>
> Labels: `work:miner` `gap:supply` `priority:p0` `source:h2` `mission:resources-agriculture` `status:open` `reward:unfunded`
>
> **Intent** — `SATELLITE_IMAGERY_ANALYSIS`
>
> **Why this matters** — Several Season II applications need machine-readable satellite analysis, and current supply is not enough.
>
> **Demand / mission impact** — `conflict-intelligence`, `resources-agriculture`, `autonomous-systems`
>
> **Current state** — Too few independent live miners serve this intent.
>
> **Acceptance criteria**
> - [ ] Target number of independent live miners serve the intent
> - [ ] Each qualifying miner succeeds on the approved reference request set
> - [ ] Paid Telegraph requests complete end-to-end
> - [ ] Latency and any required app-facing normalisation are usable by the affected apps
>
> **Reward** — **Unfunded.** This Issue carries no monetary or token reward.
>
> **Claim / submit** — Comment `/claim` to coordinate work. Post `/progress ...` at least every 72 hours. When complete, comment `/submit ...` with repository, demo or evidence links.

## 2. Read it before you claim

Answer three questions first:

| Question | In the example |
|---|---|
| What do I have to build? | A miner that serves `SATELLITE_IMAGERY_ANALYSIS` |
| How will it be checked? | The four acceptance criteria, each one reproduced by a maintainer |
| Is it paid? | No. The Reward section says unfunded |

If you can't meet every acceptance criterion, don't claim it. Ask a question in
the Issue comments instead.

## 3. Claim it

Post this comment:

```text
/claim
```

The bot records you as the claimant and changes the label to `status:claimed`.
Nobody else can claim it while you hold it.

## 4. Build, and post progress

Build the smallest thing that meets the acceptance criteria. For a miner, that
means writing its YAML and registering it; see
[What Miners Do](../miners/miner-overview.md),
[YAML Configuration](../miners/yaml-config.md) and
[Registering as a Miner](../miners/miner-registration.md).

Post an update at least every 72 hours:

```text
/progress Miner YAML written and validated; registering on testnet today.
```

If you go 48 hours without an update, the bot warns you. At 72 hours your claim
is released and someone else can take the Issue.

If you can't finish, give it back:

```text
/release
```

## 5. Submit proof

When every criterion is met, submit links a maintainer can check:

```text
/submit https://github.com/you/satellite-miner — registered miner, three Telegraph request IDs and reference-test output in the README
```

The label changes to `status:review`.

## 6. Review

A maintainer who is not you reproduces each acceptance criterion:

- **Approved:** they post `/approve` and the Issue becomes `status:done`.
- **Needs changes:** they post `/changes <reason>`. The Issue goes back to
  `status:claimed`, it is still yours, and you get a fresh 72-hour window. Fix the
  issue, then `/submit` again.

`status:done` means the acceptance criteria passed. Whether the network ranks
your miner is decided separately by the protocol.

## The same steps from a terminal

With the [GitHub CLI](https://cli.github.com/) signed in, the `tb` tool posts the
same comments (see [Command Line and Agents](command-line.md)):

```bash
./tb next
./tb claim 42
./tb progress 42 "Miner YAML written and validated; registering on testnet today."
./tb submit 42 "https://github.com/you/satellite-miner — request IDs in README"
```
