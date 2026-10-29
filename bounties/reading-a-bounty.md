---
description: What each part of a Telegraph bounty means, from the title to "How to join", and what every label on it tells you.
---

# Reading a Bounty

Every bounty has the same parts in the same order. This page explains each one
and what to do with it.

## The title

The title is the topic, then what it asks for:

| Title ends with | It asks for |
|---|---|
| `: evaluation material and an evaluator adapter` | Both. You can do just one part. Most people do the material. |
| `: evaluation material and a comparator module` | Both, for an exact-answer topic such as a price. |
| `: evaluation material` | Only material. The judge for this topic is already in place. |
| `: an evaluator adapter` | Only the judge. The material is already in. |
| `: a comparator module` | Only the judge, for an exact-answer topic. |

The first word, for example `LANGUAGE_TRANSLATION`, is the **family**: a group
of related Intents. The exact Intents you work on are in the table below it.

## What this is

A short explanation of the topic and of what the network needs before it can
rank its miners. It ends with "This Issue asks for…", which says which parts
this bounty wants.

"What the catalogue says it is for" quotes the topic's official description.

## The Intents

A table of the exact Intents to work on:

| Column | Meaning |
|---|---|
| **Intent** | The exact name, for example `LANGUAGE_TRANSLATION_GENERAL`. Use it character for character when you pick an Intent on Anjoman. |
| **What it asks** | The kind of question this Intent answers. Your questions must be of this kind. |

> [!IMPORTANT]
> Work only on the Intents in this table. Don't add material under a different
> Intent, and don't invent a new one.

## Who needs it

Which apps will ask these questions. Most come from the app ideas in the
Season II brief, and the bounty lists what those apps need from the Intent.
Write your questions the way those apps would ask them. That way, ranking
rewards the miners that serve real apps well.

## Part 1: Evaluation material

What to add, how, and what makes it good. "Anyone can help" means no code is
needed. It's one of two kinds:

- **Question pairs**: a question, a better answer and a worse answer. Most
  bounties ask for these.
- **Truth sources**: a free public data service that gives the exact right
  answer, for topics such as exchange rates or temperatures.

Both are explained in [Adding Evaluation Material](evaluation-material.md).

## Part 2: The judge

For builders. It says which judge this family needs, an **evaluator adapter**
or a **comparator module**, and links to the build guides. See
[Building an Adapter or Comparator](building-an-adapter.md). If the bounty asks
for only one part, it has no "Part 1" and "Part 2", only that part.

## Rules

The rules that apply to every bounty. In short: work only on the Intents in
the table, find network details in the docs, and never give anyone your
private key or money. All the rules are in [Rules and Rewards](rules-and-rewards.md).

## Done when

A checklist. Each box is one part of the job, for example:

```text
- [ ] Evaluation material: the network has accepted material for every Intent in the table and uses it for ranking.
- [ ] Evaluator adapter: one is live on LANGUAGE_TRANSLATION and scores its Intents.
```

A maintainer ticks each box once that part is checked. The bounty closes only
when every box is ticked, so one part alone never closes it.

Under the boxes it says when **your own** part counts: once your rows are
**Eligible** on Anjoman, or once your judge passes the network's checks.

## Reward

Whether the bounty is paid. Right now every bounty says **Unfunded**: no money
or tokens are promised for it. The network's own evaluator rewards are separate.
See [Rules and Rewards](rules-and-rewards.md#rewards).

## How to join

The comments that move a bounty along: `/claim` to join, `/progress` to post an
update, `/submit` when your part is done. All of them, and what the bot replies,
are in [How a Bounty Works](how-a-bounty-works.md).

## The labels

The coloured labels at the top help you filter the board.

| Label | Meaning |
|---|---|
| `status:triage` | Not open yet. You can read it, but you can't join. |
| `status:open` | Open. Anyone can join. |
| `status:claimed` | Someone is working on it. You can still join. |
| `status:review` | Someone submitted their part and it's being checked. You can still join. |
| `status:blocked` | Paused by a maintainer. |
| `status:done` | Finished. |
| `priority:p1`, `priority:p2` | How much it's needed. P1 first. |
| `mission:...` | The Season II mission whose apps need it, for example `mission:personal-agent`. |
| `work:evaluator` | The work is evaluation: material or a judge. |
| `gap:evaluation` | What's missing is evaluation. |
| `source:h2` | It comes from Season II (H2). |
| `reward:unfunded` | No money is promised for it. |

The bottom of each bounty also holds a few hidden lines that tools read. You
won't see them on the page, and you can ignore them.
