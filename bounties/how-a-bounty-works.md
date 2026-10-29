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
3. **Claim** it by commenting `/claim`. Several people can claim the same Issue and work on it at once.
4. **Build** the smallest thing that meets the acceptance criteria. Post `/progress <update>` at least every 72 hours.
5. **Submit** proof with `/submit <links and evidence>`.
6. A **maintainer reproduces** your result, then approves it or asks for changes.

A bounty is complete when its acceptance criteria are reproducibly met.

## Statuses

| Label | Meaning |
|---|---|
| `status:triage` | A proposal. A maintainer is checking it is real, reusable and verifiable. It cannot be claimed yet. |
| `status:open` | Ready to claim. |
| `status:claimed` | One or more people are working on it. |
| `status:review` | Proof submitted; a maintainer is checking it. Others can still join and keep working. |
| `status:blocked` | Paused by a maintainer, for example while waiting on another change. |
| `status:done` | Approved. |

## Commands for contributors

| Command | What it does |
|---|---|
| `/claim` | Adds your claim. The bot records you, lists who else is working on it, and moves it to `status:claimed`. |
| `/progress <update>` | Keeps your claim alive and resets the 72-hour timer. |
| `/submit <links and proof>` | Moves the Issue to `status:review`. |
| `/release` | Gives up your own claim. Other people keep theirs. |

```text
/claim
/progress Provider endpoint is live; integrating the reference fixtures now.
/submit https://github.com/alice/weather-miner — live endpoint + three Telegraph request IDs + reference-test output in README
```

## The 72-hour rule

Each person's claim stays active only while that person is working.

- After **48 hours** without your `/progress`, the bot warns you.
- After **72 hours** without your `/progress`, your claim is released. Other people's claims stay. A submission waiting for review keeps you in.

Post a real update each time. It only has to say what changed.

## Commands for maintainers

| Command | What it does |
|---|---|
| `/open` | Moves a triage Issue to `status:open`, so it can be claimed. |
| `/block`, `/unblock` | Pauses and resumes an Issue. |
| `/changes @user <reason>` | Returns that person's submission. They are back to `status:claimed` with a fresh 72-hour window. |
| `/approve @user` | Accepts that person's part. If nobody else is still working, the Issue is done. |
| `/done` | Closes the Issue as complete once at least one part is approved. |
| `/release @user` | Releases that person's claim. |

With only one submission waiting, `/approve` and `/changes <reason>` can leave the name out.

Maintainer commands are checked against the person's real permission on the
repository. Commenting `/approve` without that permission does nothing.

## How a submission is verified

The approving maintainer must be someone other than every claimant and
submitter on the Issue. They reproduce the acceptance criteria directly, using screenshots
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

## Several people, one Issue

Several people can claim one Issue. Each claim, submission and approval is
recorded per person, so one person's delay never blocks another. This suits
work that needs many hands, such as evaluation material: an intent's material is
only used once at least 5 different people have contributed. A funded Issue
states how many parts it can pay (`max_awards`).

## Which intents

Season II bounties use the bounty board's **mandatory intents** only. Nobody
proposes or adds a new intent through a bounty; work only on the intents an
Issue names. The work for them happens in
[Anjoman](https://anjoman.ai/dashboard/eval).
