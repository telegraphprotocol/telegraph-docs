---
description: The life of a bounty, every comment command and what the bot replies, the 72-hour rule, how several people share one bounty, and how maintainers review and close it.
---

# How a Bounty Works

Every bounty is a GitHub Issue on
[telegraphprotocol/bounties](https://github.com/telegraphprotocol/bounties/issues).
You move it along by posting short commands as comments. A bot reads each
command, replies, and changes the bounty's status label.

## The life of a bounty

```text
status:triage    not open yet; a maintainer is checking it
      ↓  a maintainer opens it
status:open      anyone can join
      ↓  someone comments /claim
status:claimed   people are working on it; others can still join
      ↓  someone comments /submit
status:review    a maintainer is checking a submitted part; others keep working
      ↓  every box under "Done when" is ticked
status:done      finished
```

A maintainer can also pause a bounty (`status:blocked`) and resume it later.

## Commands for everyone

Type the command as the first word of a new comment, then press **Comment**.

| Command | What it does | When it works |
|---|---|---|
| `/claim` | Adds you to the people working on it | When it's open, claimed or in review |
| `/progress <what you did>` | Keeps your place, and tells others where you are | After you've claimed. At least 15 characters. |
| `/submit <what you did>` | Hands in your part for review | After you've claimed. At least 15 characters. |
| `/release` | Gives up your place. Others keep theirs. | When you hold a claim |

What to write after `/submit`:

- **Material:** your contributor address and a line on what you added. See
  [Step 13 of your first bounty](your-first-bounty.md#step-13-submit-your-part).
- **A judge:** your module's registration ID and a line on what you built.

Examples:

```text
/claim
/progress Added 15 pairs for SENTIMENT_ANALYSIS_GENERAL. Writing harder worse answers next.
/submit Contributor address 0x... Added 30 pairs for SENTIMENT_ANALYSIS_GENERAL, 27 eligible.
/release
```

## What the bot replies

| You see | It means |
|---|---|
| `Claimed by @you.` | You're in. It also copies the Reward section as a record of the terms when you joined. |
| `This Issue is not currently open for claiming.` | It's still `status:triage`. Wait until it's open. |
| `you have already claimed this bounty` | You're already in. Post `/progress` instead. |
| `Please include a meaningful progress update` | Your update was too short. Write a full sentence. |
| `Only someone who has claimed this bounty can submit.` | Comment `/claim` first. |
| `Submission from @you moved to review.` | Your part is waiting for a maintainer. |
| `this claim has had no /progress update for 48 hours` | A reminder. Post `/progress` soon. |
| `claim was automatically released after 72 hours` | Your place lapsed. Comment `/claim` to join again. |

If nothing appears after a few minutes, check that the command is the very first
word of the comment, spelled exactly, with the slash.

## The 72-hour rule

Your place stays only while you're working on it.

- After **48 hours** without a `/progress` from you, the bot reminds you.
- After **72 hours** without one, your place is released. Other people keep
  theirs.
- While your submission is waiting for review, your place is kept.

Each update only has to say what changed since the last one.

## Several people, one bounty

Many people can work on one bounty at the same time. Each person's claim,
timer, submission and review are tracked separately, so one person's delay
never blocks anyone else. This matters for material: the network only uses a
topic's material once enough different people have added to it.

You can also split the work: some people add material while a builder makes the
judge.

## How it's reviewed

A maintainer checks each submission on its own. They must be someone who hasn't
claimed or submitted on that bounty.

- **Material:** they check that your rows are in the pool and **Eligible** under
  your contributor address.
- **A judge:** they check that your module passed the network's checks.

Then they reply with one of:

| Reply | Meaning |
|---|---|
| `/approve @you` | Your part is accepted. |
| `/changes @you <reason>` | Something needs fixing. You're back to working on it, with a fresh 72 hours. Fix it and `/submit` again. |

After your part is accepted, your claim on that bounty is complete. To add more
later, comment `/claim` again.

## When a bounty closes

Each box under **Done when** is one part of the job, for example the material
and the judge. A maintainer ticks a box once that part is checked on the
network. The bounty closes only when every box is ticked: either when the last
part is approved, or when a maintainer closes it with `/done`. While any box is
still empty, an approved part never closes it.

## Commands for maintainers

These only work for people with maintainer rights on the board. Anyone else who
types them is ignored.

| Command | What it does |
|---|---|
| `/open` | Opens a `status:triage` bounty so people can join. |
| `/approve @user` | Accepts that person's part. |
| `/changes @user <reason>` | Returns that person's part with a reason. |
| `/release @user` | Releases that person's claim. |
| `/block`, `/unblock` | Pauses and resumes the bounty. |
| `/done` | Closes the bounty once at least one part is approved and every box under "Done when" is ticked. |

With only one submission waiting, `/approve` and `/changes <reason>` can leave
the name out.
