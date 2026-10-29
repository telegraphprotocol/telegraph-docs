---
description: The builder's part of a bounty in plain steps. What an evaluator adapter and a comparator module are, what you need, how to publish one on Anjoman, and what happens after.
---

# Building an Adapter or Comparator

This is the builder's part of a bounty: the **judge** that scores miners'
answers. You don't need it to help with material. It's real technical work. If
you've never built software, an AI assistant can still coach you through it
one command at a time (see
[the adapter coach prompt](using-ai.md#coach-me-through-building-an-adapter)).

## Which judge does the bounty need?

| The bounty asks for | Used for | What it is |
|---|---|---|
| **An evaluator adapter** | Intents that need judgement, such as translation or code review | A small AI model, packed into one `.wasm` file, that reads a question and an answer and scores the answer |
| **A comparator module** | Intents with one exact right answer, such as a price | A small program, also one `.wasm` file, that compares the number in a miner's answer with the right value. No AI model inside. |

You publish it on the **family** named in the bounty's title, for example
`LANGUAGE_TRANSLATION`. It then scores every Intent in that family.

## What you need

For an **evaluator adapter**:

- A computer with a graphics card (GPU) for training. Training works without
  one, but very slowly.
- Free software: Python, Rust and Go, plus the public adapter kit. The guide
  lists the exact versions.
- About 3 GB of free disk space per Intent.
- Question pairs to train on. Use pairs you wrote or are allowed to use. The
  same format works for training and for the bounty's material.

For a **comparator module**: a way to build a small `.wasm` file, for example
with Rust. No model and no GPU.

For both:

- An **Anjoman** account to publish it.
- A public link where your `.wasm` file can be downloaded, and a **runnable
  endpoint**: a small web service that runs the same module. The network tests
  your module there first. The adapter kit includes a ready-made one to start
  from.
- A little **MACHINA** for the bond (below).

## The path, step by step

1. **Read the bounty.** Note the family name and which judge it asks for.
2. **Build it.**
   - Adapter: follow [Train an Evaluator Adapter](../scoring/train-a-scoring-adapter.md),
     which goes from your pairs to one `.wasm` file in five steps (prepare,
     train, export, bake, package).
   - Comparator: follow [Comparator modules](../scoring/build-a-scoring-module.md#comparator-modules-deterministic-intents).
3. **Host it.** Put the `.wasm` file somewhere it can be downloaded from a
   public `https://` or `ipfs://` link, and run your runnable endpoint. See
   [The runnable endpoint](../scoring/build-a-scoring-module.md#the-runnable-endpoint).
4. **Publish it on Anjoman.** Open [anjoman.ai/dashboard/eval](https://anjoman.ai/dashboard/eval)
   and use the first card:
   1. **Link & hash the binary**: paste your file's link into **Hosted file
      link** and press **Verify & hash**.
   2. **Structural checks**: Anjoman checks the file can be fetched and isn't
      too big.
   3. **Publish for evaluation**: choose the **Family** from the bounty, enter
      a **Fee address** (where your earnings go) and your **Runnable endpoint
      URL**, then press **Publish for evaluation**.
5. **Keep the registration ID.** Anjoman shows **Scoring module submitted**
   with a **Registration ID**. **View my registrations** shows its status
   later.
6. **Tell the bounty.** Comment `/submit` with the registration ID and a line
   on what you built:

   ```text
   /submit Registration ID 1234. Evaluator adapter for LANGUAGE_TRANSLATION, trained on 3,000 pairs in 12 languages.
   ```

## The bond

Publishing posts a small **bond** in MACHINA, the network's token. You get it
back in full when you remove your module. The form shows how much MACHINA your
account holds. With an email account the network fee (gas) is paid for you.
To get test MACHINA, see [Getting test tokens](../protocol/addresses-and-params.md#getting-test-tokens).

## What happens after you publish

- The network tests your module on the family's **hidden** test material. It
  can only be judged once that material is in, which is what Part 1 of the
  bounty collects.
- It goes live only if it passes the network's checks. If the family already
  has a judge, yours must beat it.
- Your part of the bounty counts once your module passes. A maintainer then
  ticks its box under **Done when**.

How the tests work, and how to read your module's status:
[What checks your module must pass](../scoring/build-a-scoring-module.md#what-checks-your-module-must-pass)
and [Checking your module's status](../scoring/build-a-scoring-module.md#checking-your-modules-status).

## Rules for builders

- Build only from the public kit, the public base model and data you're allowed
  to use.
- Don't try to get the network's hidden test material or the current judge's
  files. You don't need them, and they're kept out of the public build on
  purpose.
- The same file can't be registered twice. Change and rebuild it before you try
  again.

Something not working? Ask on the bounty, or see [Questions and Fixes](questions.md).
