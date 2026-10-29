---
description: How to use an AI chat assistant such as ChatGPT, Claude or Gemini to understand a bounty, check your question pairs, format a file, write a truth source or build an adapter, with prompts you can copy.
---

# Doing It With an AI Assistant

You don't need to know how to code to do a bounty. An AI chat assistant, such
as ChatGPT, Claude or Gemini, can explain a bounty in simple words, check your
work, and do the formatting for you. You stay in charge: you choose the
questions, you check the facts, and you press the buttons.

## Three rules first

> [!WARNING]
> **Never paste a password, private key or recovery phrase** into an AI chat,
> a GitHub comment or anywhere else. Nobody from Telegraph will ever ask for
> them.

1. **The AI helps. It doesn't write your material.** Questions and answers
   should come from real needs and real sources. An AI can make things up that
   sound right, and made-up material weakens the network.
2. **Check what it tells you.** Compare facts with the source. If the AI and
   the docs disagree, the docs win.
3. **Keep private things out.** Don't paste personal data or private documents
   into the chat.

## Give the AI the right page

The AI gives much better answers when it can read the real instructions.

- **A docs page:** press **Copy page** at the top of any page in these docs
  (on docs.telegraphprotocol.com the button says **Copy for LLM**), then paste
  it into the chat.
- **A bounty:** open it on GitHub, select all its text from the title down to
  "How to join", copy it, and paste it into the chat.

Then copy one of the prompts below, fill in the parts in `<angle brackets>`,
and send it.

## Explain this bounty to me

```text
I want to help with a Telegraph bounty, and I have never written code.
Below is the bounty. In simple words, tell me:
1. what its Intents are about, with an everyday example of a question each one answers;
2. which part I can do without code;
3. what I should do, one step at a time.
Use only what the bounty says. If something isn't clear from it, tell me to ask on the bounty.

<paste the whole bounty here>
```

## Help me find real questions

```text
I'm collecting real questions for the Telegraph Intent <INTENT NAME>.
This is what it answers: <paste "What it asks" from the bounty's table>.
These apps need it: <paste the lines under "Who needs it">.
Suggest kinds of real situations where people would ask this, and public places
where I can check the facts, such as official websites or public reports.
Don't write the questions or the answers for me.
```

## Check my pair

```text
Check this evaluation pair for the Telegraph Intent <INTENT NAME>.
The rules:
- the question is one a real person would ask this Intent;
- the better answer is correct and helpful;
- the worse answer sounds believable but is wrong or clearly weaker;
- both answers are about the same length;
- the worse answer is not a stock reply like "Looks fine" or "I don't know".
Tell me which rule it breaks, if any, and why.
Don't change my facts. If you think a fact is wrong, say so and I'll check it.

Question: <your question>
Better answer: <your better answer>
Worse answer: <your worse answer>
Source link: <the link, or "none">
```

## Turn my pairs into a file

Use this when you have many pairs and want to send them with **Upload a file**
on Anjoman.

```text
Turn the pairs below into JSON Lines for Telegraph: one line per pair, exactly in this shape:
{"prompt":"...","chosen":"...","rejected":"...","provenance":{"source_kind":"web","source_url":"..."}}
"chosen" is the better answer and "rejected" is the worse one.
Leave out "provenance" for a pair that has no source link.
Keep my wording exactly. Don't add, drop, merge or change any pair.
Reply with only the lines, nothing else.

<paste your pairs here, for example as a table with: question, better answer, worse answer, source link>
```

Paste the lines it gives you into the **Upload a file** box on Anjoman.
Anjoman shows how many lines are ready, and points out any line that's broken.

## Write a truth source

Use this for an exact-answer Intent, such as an exchange rate or a temperature.
First press **Copy page** on [Contribute Evaluation Data](../scoring/contribute-evaluation-data.md),
because the AI needs its example.

```text
Help me write a Telegraph truth source for the Intent <EXACT INTENT NAME>, which answers:
<paste "What it asks" from the bounty's table>.
A truth source describes one free public API that needs no key and uses https.
It is written in Telegraph's miner YAML format, and its "intents" must list <EXACT INTENT NAME>.
The official instructions and example are below, followed by the API's documentation.
If anything you need isn't in them, ask me instead of guessing.
When you're done, give me only the YAML.

Telegraph instructions:
<paste the Contribute Evaluation Data page>

The API's documentation:
<paste the link or the text of the API's documentation>
```

## Why was my row turned down?

```text
I added evaluation material on Anjoman for the Telegraph Intent <INTENT NAME>.
A row says: <paste the status and reason exactly, for example "Rejected · Near duplicate">.
Here is the row: <paste it>.
Here are the official reasons and fixes:
<paste the "If a row is turned down" table from Adding Evaluation Material>
Explain in simple words what went wrong and how I fix it.
```

## Write my update or submit comment

```text
Help me write a short GitHub comment for a Telegraph bounty.
It must start with <"/progress" or "/submit"> and be one or two plain sentences.
What I did: <for example, "added 20 English to Spanish pairs for LANGUAGE_TRANSLATION_GENERAL, 17 are eligible">.
<For /submit only:> My contributor address is <0x...>.
```

## Coach me through building an adapter

For builders. First press **Copy page** on
[Train an Evaluator Adapter](../scoring/train-a-scoring-adapter.md).

```text
Be my step-by-step coach for training a Telegraph evaluator adapter for the family <FAMILY NAME>.
I'm a beginner. My computer: <Windows, Mac or Linux>. Graphics card: <which one, or "none">.
The official guide is below. Follow it exactly.
Go one step at a time: give me one command, explain what it does in one sentence,
and wait for me to paste the result before the next step.
If a command fails, help me fix it before moving on.
Use only the public adapter kit, the public base model and my own pairs.
Don't try to get the network's hidden test material or the current evaluator's files.

<paste the Train an Evaluator Adapter page>
```

## When the AI is wrong or stuck

- Paste the exact error or message back into the chat, and ask what it means.
- Give it the right docs page again with **Copy page**. AIs often guess when
  they don't have the page.
- Still stuck? Ask on the bounty itself, in a normal comment. Say what you
  tried and what happened. Maintainers and other contributors read it.

More answers are in [Questions and Fixes](questions.md).
