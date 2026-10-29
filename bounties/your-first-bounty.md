---
description: A step-by-step guide to your first bounty for someone who has never written code. Make two free accounts, join a bounty, add question pairs on Anjoman, check them, and submit.
---

# Your First Bounty, Step by Step

This guide is for someone who has never written code. You'll do the part that
anyone can do: write **question pairs** for one topic. Follow the steps in
order. Each one tells you exactly what to click and what to type.

The example uses the real bounty **LANGUAGE_TRANSLATION: evaluation material
and an evaluator adapter**. The question pairs in it are made up for this guide.

> [!TIP]
> Stuck at any step? Copy the step, paste it into an AI chat assistant such as
> ChatGPT, Claude or Gemini, and ask it to explain. Ready-made prompts are in
> [Doing It With an AI Assistant](using-ai.md).

## Before you start

You need a web browser and an email address. That's all. Nothing here costs
money.

## Step 1: Make a free GitHub account

Bounties live on GitHub, a website where projects share their work. You'll use
it to join a bounty and post short updates.

1. Go to [github.com/signup](https://github.com/signup).
2. Enter your email, a password and a username, then follow the screens.

Your username is how maintainers will know you, for example `@maria-k`.

## Step 2: Find a bounty

1. Open the [bounty board](https://github.com/telegraphprotocol/bounties/issues).
   Each row is one bounty. GitHub calls them **Issues**.
2. Pick a topic you know. The title tells you the topic and what it needs, for
   example `LANGUAGE_TRANSLATION: evaluation material and an evaluator adapter`.
3. Look at its coloured labels:
   - `status:open` means you can join now.
   - `status:triage` means it isn't open yet. Press **Subscribe** on the right
     of the bounty page, and GitHub will email you when someone comments on it,
     including when it opens.

Only bounties that are `status:open` (or already being worked on) can be
joined. To see just those, use
[this filter](https://github.com/telegraphprotocol/bounties/issues?q=is%3Aissue%20is%3Aopen%20label%3Astatus%3Aopen).

## Step 3: Read the bounty

Open it and read it top to bottom. Pay attention to three parts:

| Part | What to look for |
|---|---|
| **The Intents** | A table with the exact names you'll work on, such as `LANGUAGE_TRANSLATION_GENERAL`, and what each one asks. |
| **Part 1: Evaluation material** | What to add. "Anyone can help" means no code is needed. |
| **Who needs it** | The kind of apps that will ask these questions. Your questions should sound like theirs. |

Every part of a bounty is explained in [Reading a Bounty](reading-a-bounty.md).

## Step 4: Join the bounty

1. Scroll to the bottom of the bounty page. You'll see a box for a comment.
2. Type exactly this:

   ```text
   /claim
   ```

3. Press the green **Comment** button.

Within a minute or two a bot (`github-actions`) replies under your comment.
It says something like:

```text
Claimed by @maria-k. Post a meaningful /progress ... update within 72 hours
or your claim will be released automatically.
```

It also copies the bounty's Reward section, as a record of the terms when you
joined. Other people may already be working on it. That's fine: several people
can work on one bounty.

> [!NOTE]
> If the bot says "This Issue is not currently open for claiming", the bounty
> is still `status:triage`. Wait until it's `status:open`, then try again.

## Step 5: Make a free Anjoman account

Anjoman is where you actually add your work.

1. Go to [anjoman.ai](https://anjoman.ai) and press **Log in**.
2. Choose **Create an account** and sign up with your email and a password.

If you already use a crypto wallet you can choose **Connect a wallet**
instead. Either way works. With an email account, Anjoman creates a wallet for
you in the background, and signs your uploads for you.

## Step 6: Open the Evaluate page

Go to [anjoman.ai/dashboard/eval](https://anjoman.ai/dashboard/eval). You'll
see two cards. The first one is for builders who publish a judge program. Use
the second one, **Contribute evaluation material**.

## Step 7: Choose the Intent

1. In the **Intent** box, type the exact name from the bounty's table, for
   example `LANGUAGE_TRANSLATION_GENERAL`. Copying it from the bounty is the
   safest way.
2. Click the name when it appears in the list.

You add material for one Intent at a time. To switch, press **Change intent**.

## Step 8: Write your first pair

Click the **Add a pair** tab and fill in the boxes:

| Box | What to write | Example |
|---|---|---|
| **Prompt** | A question, written the way a real person would ask it | Translate into Spanish: "The pharmacy closes at 6 pm on Saturdays." |
| **Better answer** | A correct, helpful answer | La farmacia cierra a las 6 de la tarde los sábados. |
| **Worse answer** | An answer that sounds right but is wrong | La farmacia abre a las 6 de la tarde los sábados. |
| **Source link (optional)** | The web page your question or facts came from, if any | (empty here: you wrote this sentence yourself) |

Why this worse answer is a good one: it looks correct and is the same length,
but it says *opens* (abre) instead of *closes* (cierra). A good judge has to
notice that. An obviously silly worse answer, like "I don't know", teaches
nothing.

> [!IMPORTANT]
> Write real questions and check every fact in your better answer. Don't let an
> AI make up your material. More rules for good pairs are in
> [Adding Evaluation Material](evaluation-material.md#what-makes-a-good-pair).

## Step 9: Send it

Press **Sign and add this pair**.

- With an email account, that's all. Anjoman signs it for you.
- With a wallet, your wallet asks you to sign a message. Signing is free and
  sends no money.

You'll see a message like `Sent. 1 stored, 0 already there, 0 refused.`

## Step 10: Add more pairs

Repeat step 8 with new questions. Make each one different: different
sentences, different kinds of mistakes in the worse answers. A few careful
pairs are worth more than many rushed ones.

If you have many pairs, you can send them all at once as a file with the
**Upload a file** tab. See
[Adding Evaluation Material](evaluation-material.md#three-ways-to-add-material).

## Step 11: Check your pairs

Below the form, under **Your submissions for** *your Intent*, each pair shows a
status:

| Status | What it means |
|---|---|
| **Quarantine** | Just arrived. It's being checked. |
| **Admitted** | It passed the checks. |
| **Eligible** | It's in. The network uses it from its next round (an **epoch**). |
| **Rejected** | It was turned down. The reason is shown next to it. |

If a pair was rejected, look up the reason in
[If a row is turned down](evaluation-material.md#if-a-row-is-turned-down).

## Step 12: Post an update on the bounty

Go back to the bounty on GitHub and comment what you did, starting with
`/progress`:

```text
/progress Added 10 English to Spanish pairs for LANGUAGE_TRANSLATION_GENERAL. 8 are admitted so far.
```

Post an update at least every **72 hours** while you're working on it, or your
place is released. The bot reminds you after 48 hours. The update must be at
least 15 characters long.

## Step 13: Submit your part

When your pairs show **Eligible**, tell the bounty you're done. You need your
**contributor address**, the address your material is credited to. It starts
with `0x`.

- **Email account:** on Anjoman, press the wallet button at the top of the
  page (it shows your balance). In the panel that opens, find **Privy Wallet**
  and press the copy icon next to its **Address**. Use this one, not the
  "Account wallet" shown on the Evaluate page.
- **Wallet account:** it's the address of the wallet you signed in with.

Then comment on the bounty:

```text
/submit Contributor address 0x... (paste yours). Added 25 English to Spanish pairs for LANGUAGE_TRANSLATION_GENERAL. 22 are eligible.
```

The bounty moves to `status:review`.

## Step 14: Wait for the review

A maintainer checks your part, then replies:

- `/approve @you`: your part is accepted. Well done.
- `/changes @you` with a reason: something needs fixing. Fix it, then
  `/submit` again. Your 72 hours start again.

The bounty itself stays open until every box under **Done when** is ticked.
A maintainer ticks each box once that part is checked, so other people may
still be adding material or building the judge after your part is accepted.

## That's it

You've helped the network learn what a good answer looks like. Next:

- Add material for another Intent: [Adding Evaluation Material](evaluation-material.md).
- Learn every command: [How a Bounty Works](how-a-bounty-works.md).
- Something went wrong: [Questions and Fixes](questions.md).
