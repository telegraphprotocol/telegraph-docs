---
description: Start here. What a Telegraph bounty is, what you can do on one without writing code, what you need, and where to go next.
---

# Bounties in Two Minutes

A **bounty** is a small, clearly described job that makes the Telegraph network
better. Bounties are posted on a public board, and anyone can join one. You
don't need to know how to code to help.

## Why bounties exist

Telegraph is a marketplace for answers. Apps ask questions, and **miners**
(services that answer them) compete to give the best answer. To send each
question to the best miner, the network has to **rank** the miners. To do that
fairly, every kind of question needs two things:

1. **Evaluation material.** Example questions, each with a better answer and a
   worse answer, so the network learns what a good answer looks like. For
   questions with one exact right answer, such as an exchange rate, the material
   is a **truth source**: a free public data service that gives the right
   answer.
2. **A judge.** A small program that scores each answer. For most kinds of
   question it is an **evaluator adapter**. For questions with one exact right
   answer it is a **comparator**.

Many kinds of question don't have these yet. Each bounty asks for them for one
topic.

> [!NOTE]
> Telegraph calls each kind of question an **Intent**, and gives it a fixed name
> such as `LANGUAGE_TRANSLATION_GENERAL`. Every bounty names its Intents exactly.

## What you can do

| You are | You can | Coding? |
|---|---|---|
| Anyone who knows a topic | Write question pairs: a real question, a good answer and a believable wrong answer | None |
| Someone happy to copy and paste, with an AI's help | Add a truth source for an exact-answer topic | A little, an AI can do it with you |
| A developer or machine-learning builder | Build and publish an adapter or a comparator | Yes |

Most people start with question pairs. [Your First Bounty, Step by Step](your-first-bounty.md)
walks you through your first one.

## How it works

```text
1. Find a bounty            on GitHub: github.com/telegraphprotocol/bounties
2. Join it                  comment  /claim
3. Do the work              on Anjoman: anjoman.ai, page "Evaluate"
4. Say you're done          comment  /submit
5. A maintainer checks it   your part is approved, or you're asked to fix something
```

Several people can work on the same bounty at once, and each person's part is
checked on its own. The network only uses a topic's material once enough
different people have added to it, so every person counts.

## What you need

- A web browser.
- An email address.
- A free **GitHub** account, to join a bounty and post updates.
- A free **Anjoman** account, to add your work. You can sign up with just an
  email and a password.

You don't need a crypto wallet, and adding material costs nothing.

## Is it paid?

The bounties themselves are **unfunded** right now: no money is promised for
them. Separately, the network pays its own **evaluator rewards** in MACHINA,
the network's token, to the people whose material it uses and to the adapter
that ranks a topic. Today the network is a test network, so those rewards are
test tokens. See [Rules and Rewards](rules-and-rewards.md).

## Where to go next

| I want to | Read |
|---|---|
| Do my first bounty, one step at a time | [Your First Bounty, Step by Step](your-first-bounty.md) |
| Understand every part of a bounty | [Reading a Bounty](reading-a-bounty.md) |
| Write good material, or add a truth source | [Adding Evaluation Material](evaluation-material.md) |
| Build the judge | [Building an Adapter or Comparator](building-an-adapter.md) |
| Let an AI assistant help me | [Doing It With an AI Assistant](using-ai.md) |
| Know the commands and what the bot does | [How a Bounty Works](how-a-bounty-works.md) |
| Know the rules and what I can earn | [Rules and Rewards](rules-and-rewards.md) |
| Fix a problem | [Questions and Fixes](questions.md) |
| Look up a word | [Bounty Glossary](glossary.md) |
