---
description: How to write good question pairs and truth sources for a Telegraph bounty, the three ways to add them on Anjoman, what each status means, and how to fix a row that was turned down.
---

# Adding Evaluation Material

Evaluation material is how the network learns what a good answer looks like.
This page shows you how to make good material and add it on Anjoman. No code
is needed. If you've never done it, start with
[Your First Bounty, Step by Step](your-first-bounty.md).

## The two kinds

The bounty's material section tells you which kind it wants.

| Kind | Used for | What you add |
|---|---|---|
| **Question pairs** | Most Intents: anything that needs judgement, such as a translation, a summary or a review | A question, a better answer and a worse answer |
| **Truth sources** | Intents with one exact right answer, such as an exchange rate, a price or a temperature | A free public data service that gives the right answer |

## Question pairs

A question pair has three parts:

- **Prompt**: the question, as a real person would ask it.
- **Better answer**: a correct, helpful answer.
- **Worse answer**: an answer that sounds right but is wrong, or clearly weaker.

The network uses your pairs to test judges: a good judge must score your
better answer above your worse answer. Some of your pairs are also used to
question miners when they're ranked. You don't choose which.

### What makes a good pair

- **A real question.** Read "What it asks" in the bounty's table, and write the
  kind of question that Intent answers. Write it in your own words.
- **A checked better answer.** It must be correct. Check every fact against a
  reliable source.
- **A believable worse answer.** It should look right at first glance: one
  wrong fact, a wrong number, a missed step, the wrong tone. Obviously silly
  answers teach nothing.
- **About the same length.** If the better answer is always the longer one, a
  judge can cheat by picking the longer answer.
- **A different worse answer every time.** Stock replies such as "Looks fine"
  or "I don't know" are thrown out.
- **No near copies.** A question that's almost the same as one already in the
  pool is turned down. Change the situation, not just a word.
- **A source link when you have one.** If your question or your facts come from
  a web page, add its link.
- **Only material you're allowed to share.** No personal data, private
  documents, passwords or secrets.

### A good pair and a weak pair

For `SENTIMENT_ANALYSIS_GENERAL` (what tone a text has):

**Good:**

| Part | Text |
|---|---|
| Prompt | What is the tone of this review? "Arrived two weeks late, but the shoes fit perfectly and the seller apologised." |
| Better answer | Mixed. The buyer is annoyed about the late delivery but happy with the shoes and the seller's apology. |
| Worse answer | Positive. The buyer is happy with the shoes, the delivery and the seller, and has no complaints. |

The worse answer is believable and the same length, but it misses the
complaint about the late delivery.

**Weak:**

| Part | Text | Problem |
|---|---|---|
| Prompt | tone? good | Too short, and not a real question |
| Better answer | Positive. | Fine, but very short |
| Worse answer | I don't know. | A stock reply that teaches nothing |

## Three ways to add material

All three are on the **Contribute evaluation material** card at
[anjoman.ai/dashboard/eval](https://anjoman.ai/dashboard/eval). First choose the
Intent in the **Intent** box, using the exact name from the bounty's table.

### Add a pair (easiest)

One pair at a time. Click **Add a pair**, fill in **Prompt**, **Better answer**,
**Worse answer** and, if you have one, **Source link (optional)**. Then press
**Sign and add this pair**.

### Upload a file (many at once)

Good when you have written many pairs, for example in a spreadsheet. Click
**Upload a file**, then either choose a file or paste the lines into the box.
Press **Sign and upload**.

The file has one pair per line, in this shape:

```json
{"prompt":"What is the tone of this review? \"Arrived two weeks late, but the shoes fit perfectly.\"","chosen":"Mixed: annoyed about the delivery, happy with the shoes.","rejected":"Positive: the buyer is happy with everything about the order."}
{"prompt":"Translate into French: \"Please keep your ticket until the end of the trip.\"","chosen":"Veuillez garder votre billet jusqu'à la fin du trajet.","rejected":"Veuillez jeter votre billet avant la fin du trajet.","provenance":{"source_kind":"web","source_url":"https://example.com/where-this-came-from"}}
```

`chosen` is the better answer and `rejected` is the worse one. `provenance`
holds the source link and is optional. You don't have to type this yourself: an
AI assistant can turn your pairs into this shape. See
[Doing It With an AI Assistant](using-ai.md#turn-my-pairs-into-a-file).

Before you send, Anjoman shows how many lines are ready and which ones it left
out, and why.

### Truth source

For exact-answer Intents only. See [Truth sources](#truth-sources) below.

## Truth sources

Some Intents have one exact right answer, such as the euro exchange rate or the
temperature in a city right now. For these, the network doesn't need question
pairs. It needs **truth sources**: free public data services (APIs) it can ask
for the right answer. It asks a few of them, takes the middle value, and checks
each miner's answer against it.

A truth source must:

- be **free and need no key or password**;
- live on a public `https://` address, not a local or private one;
- answer the Intent's question, for example "the current USD to EUR rate".

You describe it in a short text file in Telegraph's miner YAML format: the
API's address, which page of it to call, and what to send. It must list the
**exact Intent name** you upload it under, for example `FX_NOW_EUR`, in its
`intents`. A complete example is in
[Writing one](../scoring/contribute-evaluation-data.md#writing-one).

To add one:

1. Find a free public API that answers the question. Official sources, such as
   central banks or national weather services, are best.
2. Ask an AI assistant to write the YAML for you from the official example and
   the API's documentation. See [the truth source prompt](using-ai.md#write-a-truth-source).
3. On Anjoman, choose the Intent, click **Truth source**, paste the YAML (or
   choose the file) and press **Sign and upload this source**.

One upload per API: two uploads that call the same thing count once. If one
API serves several Intents, upload it once for each Intent. The full rules are
in [Truth sources](../scoring/contribute-evaluation-data.md#truth-sources-deterministic-intents).

## After you send

Anjoman first shows a short summary, for example
`Sent. 12 stored, 1 already there, 0 refused.`

| Word | Meaning |
|---|---|
| **stored** | Received and kept. Each one is checked next. |
| **already there** | The exact same row was already in the pool. |
| **refused** | Not kept at all, for example a broken line in a file. The reason is shown. |

Then, under **Your submissions for** *the Intent*, each row gets a status:

| Status | What it means | What to do |
|---|---|---|
| **Quarantine** | Being checked, or waiting because of a daily limit | Nothing. It moves on by itself. |
| **Admitted** | Passed the checks | Nothing. It joins the pool at the next epoch. |
| **Eligible** | In the pool and used by the network | Nothing. Your part counts now. |
| **Rejected** | Turned down | See the reason, and fix it below. |
| **Superseded** | This exact question is already in the pool | Write a different question. |
| **Revoked** | Withdrawn from the pool, so it isn't used | Nothing to do. |

The pool is updated once per **epoch**, the network's regular round. A row you
add now is used from the next epoch on.

The network only starts using an Intent's material once enough different people
have added to it. That's why several people can join one bounty, and why your
part matters even if it's small. The exact rule is in
[Contribute Evaluation Data](../scoring/contribute-evaluation-data.md).

## If a row is turned down

The reason appears next to the status, for example `Rejected · Near duplicate`.

| Reason | What it means | How to fix it |
|---|---|---|
| Near duplicate | Your question is too similar to one already in the pool | Write a new question about a different situation |
| Duplicate case | This exact question is already in the pool | Write a different question |
| Identical answers | The better and worse answers are the same | Make the worse answer different |
| Missing field | An answer is empty | Fill in both answers |
| Too short / Too long | The question or an answer is outside the length limits | See [Limits](../scoring/contribute-evaluation-data.md#limits) |
| Rate limited | You sent more than the daily limit | Nothing. It goes in automatically on a later day |
| Schema mismatch | This Intent's answer is a number, but your better answer has none | Put the number in the better answer |
| Invalid utf8 / Control chars | Strange hidden characters, often from copy and paste | Retype the text, or paste it as plain text |
| Source unparseable | The truth source YAML can't be read | Check the YAML against the example, or ask an AI to fix it |
| Source no endpoint | No endpoint in the YAML lists this Intent | Add the Intent name under `intents` |
| Source url rejected | The address isn't a public `https://` address | Use the public `https://` address of the API |
| Source auth unsupported | The API needs a key or password | Choose a free API that needs no key |
| Source too large | The YAML is too big | Keep only the endpoint that answers the question |

## Do and don't

| Do | Don't |
|---|---|
| Use real questions and check every fact | Let an AI make up questions or answers |
| Add the source link when you have one | Add a link the material didn't come from |
| Make every worse answer different and believable | Reuse the same worse answer |
| Add material only under the bounty's exact Intents | Put it under another Intent |
| Share only what you're allowed to share | Paste personal data or private documents |
| Ask on the bounty if you're unsure | Try to see or guess the network's hidden test questions |
