---
description: The verified GitHub workflow for Telegraph bounty contributions.
---

# How a Bounty Works

Every bounty is a GitHub Issue. GitHub coordinates the contribution; it does not control live network state.

```text
status:triage → status:open → claimed work → review → done
```

An Issue can also be `status:blocked` while a maintainer resolves a dependency.

## Contributor commands

| Command | Use |
|---|---|
| `/claim` | Start work on an open Issue. |
| `/progress <update>` | Keep your claim active. Use it at least every 72 hours. |
| `/submit <links and evidence>` | Request review of your completed work. |
| `/release` | Give up your own claim. |

Several contributors can claim one Issue. Each claim has its own progress timer and submission record.

## Review

A maintainer independently reproduces the Issue’s acceptance criteria. They can approve the work or return it with a clear reason for changes. An Issue is complete only when its required `Done when` items have been verified.

The accepted public record is the visible Issue body, its acceptance criteria, and its reward section. If a comment, generated marker, or derived view disagrees with the visible Issue, use the visible Issue and ask a maintainer to correct the discrepancy.

## Limits of the board

The board does not automatically register a provider, promote an evaluator, alter rankings, settle payment, or reveal private Anjoman/customer work. Those actions stay in their authorized production systems.
