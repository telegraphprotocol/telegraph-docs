---
description: The life of a bounty from triage to approval, the comment commands that drive it, the 72-hour progress rule, and how maintainers verify a submission.
---

# How a Bounty Works

Every bounty is a GitHub Issue in
[telegraphprotocol/bounties](https://github.com/telegraphprotocol/bounties).
You move it forward by posting short commands as comments. A bot reads them,
records each change and updates the Issue's labels.

## The steps

1. **Pick** an Issue labelled `status:open`.
2. **Read** the acceptance criteria and the `## Reward` section before writing any code.
3. **Claim** it by commenting `/claim`. One person holds an Issue at a time.
4. **Build** the smallest thing that meets the acceptance criteria. Post `/progress <update>` at least every 72 hours.
5. **Submit** proof with `/submit <links and evidence>`.
6. A **maintainer reproduces** your result, then approves it or asks for changes.

A bounty is complete when its acceptance criteria are reproducibly met.

## Statuses

| Label | Meaning |
|---|---|
| `status:triage` | A proposal. A maintainer is checking it is real, reusable and verifiable. It cannot be claimed yet. |
| `status:open` | Ready to claim. |
| `status:claimed` | Someone is working on it. |
| `status:review` | Proof submitted; a maintainer is checking it. |
| `status:blocked` | Paused by a maintainer, for example while waiting on another change. |
| `status:done` | Approved. |

## Commands for contributors

| Command | What it does |
|---|---|
| `/claim` | Takes the Issue. The bot records you as the claimant and moves it to `status:claimed`. |
| `/progress <update>` | Keeps your claim alive and resets the 72-hour timer. |
| `/submit <links and proof>` | Moves the Issue to `status:review`. |
| `/release` | Gives the Issue back so someone else can take it. |

```text
/claim
/progress Provider endpoint is live; integrating the reference fixtures now.
/submit https://github.com/alice/weather-miner — live endpoint + three Telegraph request IDs + reference-test output in README
```

## The 72-hour rule

A claim reserves the Issue only while work is active.

- After **48 hours** without `/progress`, the bot posts a warning.
- After **72 hours** without `/progress`, the claim is released and the Issue is open again.

Post a real update each time. It only has to say what changed.

## Commands for maintainers

| Command | What it does |
|---|---|
| `/open` | Moves a triage Issue to `status:open`, so it can be claimed. |
| `/block`, `/unblock` | Pauses and resumes an Issue. |
| `/changes <reason>` | Returns a submission to the claimant. The Issue goes back to `status:claimed` with the same claimant and a fresh 72-hour window. |
| `/approve` | Accepts a submission and marks the Issue done. |
| `/release` | Releases any claim. |

Maintainer commands are checked against the person's real permission on the
repository. Commenting `/approve` without that permission does nothing.

## How a submission is verified

The approving maintainer must be someone other than the claimant and the
submitter. They reproduce the acceptance criteria directly, using screenshots
only as supporting evidence. Depending on the bounty, they check that:

- the endpoint responds;
- the intent registration is correct;
- the evaluator runs;
- ranking behaviour changes as expected;
- tests pass;
- a request, receipt or settlement exists where the Issue requires one;
- the application consumes the result;
- the stated latency or quality bar is met;
- a reported vulnerability no longer reproduces.

## What to submit

Most deliverables, such as a miner, an evaluator or an app, live in **your own
repository**. Link to it in `/submit`.

Good proof is something a maintainer can repeat:

- a link to the code and a live endpoint;
- Telegraph request IDs, transaction hashes or receipts where the Issue asks for paid or end-to-end evidence;
- test output against the reference cases named in the Issue.

Only open a pull request on the bounty repository itself when the Issue asks
for a change there, and reference it with `Closes #123`.

## One claim, one award

Each Issue has exactly one claimant and at most one award. When the network
needs several independent implementations, for example three separate miners
for one intent, maintainers open separate **slot Issues** (`1/3`, `2/3`, `3/3`),
each with its own claim and reward.
