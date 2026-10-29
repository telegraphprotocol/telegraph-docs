---
description: Answers to common questions about Telegraph bounties, and fixes for the problems people hit on GitHub and on Anjoman.
---

# Questions and Fixes

## Getting started

**Do I need to know how to code?**
No. Writing question pairs needs no code at all. Truth sources need a little
copying and pasting, and an AI assistant can do it with you. Only building a
judge needs real programming.

**Does it cost anything?**
Adding material is free, and with an email account you don't need a crypto
wallet. Publishing a judge posts a small bond in MACHINA, which you get back
when you remove it.

**Which bounty should I pick?**
One that's `status:open`, about a topic you know. If you're not sure, start
with one marked `priority:p1`.

**How many pairs should I write?**
There's no minimum for you. Start with a few careful pairs, check that they
come out **Eligible**, then add more. Each good pair helps.

**Can I work on several bounties?**
Yes. Claim each one, and post a `/progress` on each at least every 72 hours.
Only claim what you can keep up with.

**Can I use an AI?**
Yes, to understand, check and format. Not to make up questions or answers. See
[Doing It With an AI Assistant](using-ai.md).

## On GitHub

**I commented `/claim` and nothing happened.**
Wait a few minutes and refresh the page. Check that the command is the very
first word of your comment, spelled exactly, with the slash. Then check the
status label: you can only join a bounty that's open, claimed or in review.

**The bot says the bounty is "not currently open for claiming".**
It's still `status:triage`. Press **Subscribe** on the bounty page to get an
email when it opens.

**I edited my command comment, and the bot ignored it.**
The bot only reads a command as it was first posted. Post a new comment
instead of editing the old one.

**My claim was released.**
You went 72 hours without a `/progress`. Comment `/claim` to join again, and
post updates more often. Your material on Anjoman isn't affected.

**I want to stop working on a bounty.**
Comment `/release`. Other people keep their places.

**Someone else is already working on it.**
That's fine. Several people can work on one bounty, and the network needs
material from several people anyway.

**I added more material after my part was approved.**
Comment `/claim` again, then `/submit` the new part when it's eligible.

## On Anjoman

**I can't find the Intent in the list.**
Copy the exact name from the bounty's table, for example
`LANGUAGE_TRANSLATION_GENERAL`, and paste it into the **Intent** box. If it
still doesn't appear, say so in a comment on the bounty.

**It says "Your account wallet is still being set up."**
Your new account is still being prepared. Wait a minute and reload the page.

**It says "Connect the wallet you signed in with to contribute."**
You signed in with a wallet. Connect that same wallet in your browser.

**It says "Signing was cancelled in your wallet."**
Press the button again, and approve the signature request in your wallet.
Signing is free.

**My rows stay in Quarantine.**
They're checked again every epoch. If the reason says **Rate limited**, you sent
more than the daily limit, and the rest go in on a later day by themselves.

**My rows are Admitted but not Eligible.**
They join the pool at the next epoch. Wait, then check again.

**A row was rejected.**
The reason is next to it. Look it up in
[If a row is turned down](evaluation-material.md#if-a-row-is-turned-down).

**I made a mistake in a pair I already sent.**
You can't edit or delete it from the page. The first copy of a question keeps
its place, and a corrected copy with the same question is marked
**Superseded**. Write a new question instead, and check each pair before you
send it.

**Where's my contributor address?**
See [Step 13 of your first bounty](your-first-bounty.md#step-13-submit-your-part).
With an email account it's the **Privy Wallet** address in Anjoman's wallet
panel, not the "Account wallet".

**Can other people see my material?**
Your rows aren't published, and Anjoman doesn't show them back to anyone. But
some questions are sent to miners when they're ranked, so never put anything
private in them.

## Rewards and rules

**Will I be paid for a bounty?**
Bounties are unfunded right now. The network's evaluator rewards are separate.
See [Rules and Rewards](rules-and-rewards.md#rewards).

**Can I propose a new Intent?**
Not through a bounty. Bounties use only
[Intents that already exist](rules-and-rewards.md#only-intents-that-already-exist).

**Someone asked me for my private key, recovery phrase or money.**
It's a scam. Nobody from Telegraph will ever ask. Don't reply, and report it to
**info@telegraphprotocol.com**.

## Spotted a problem?

- **A mistake in a bounty:** say so in a comment on that bounty.
- **A mistake in these docs:** use the feedback link at the bottom of the page.
- **A security problem:** email **info@telegraphprotocol.com** with the subject
  `[SECURITY] Telegraph vulnerability report`. Never post it publicly.
