---
description: Plain-language meanings of every word used on the bounty pages, from Intent and miner to epoch, truth source and contributor address.
---

# Bounty Glossary

Every word used on the bounty pages, in plain language.

| Word | What it means |
|---|---|
| **Adapter** | Short for evaluator adapter: a small AI model, packed into one `.wasm` file, that scores how good an answer is. |
| **Anjoman** | The website where you add material and publish judges: [anjoman.ai](https://anjoman.ai). Its **Evaluate** page is where bounty work happens. |
| **Bond** | A small amount of MACHINA you lock when you publish a judge. You get it back in full when you remove the judge. |
| **Bot** | The automatic account (`github-actions`) that reads bounty commands, replies and changes labels. |
| **Bounty** | A small, clearly described job for the network, posted as a GitHub Issue. |
| **Claim** | Joining a bounty with `/claim`. Several people can hold claims on one bounty. |
| **Comparator** | The judge for an exact-answer Intent. It compares the number in a miner's answer with the right value. |
| **Contributor address** | The address your material is credited to. It starts with `0x`. See [where to find it](your-first-bounty.md#step-13-submit-your-part). |
| **Done when** | The checklist at the bottom of a bounty. It closes only when every box is ticked. |
| **Eligible** | The status of a row that's in the pool and used by the network. |
| **Epoch** | The network's regular round. New material is added to the pool at the start of each epoch. |
| **Evaluation material** | Examples the network tests answers against: question pairs or truth sources. |
| **Family** | A group of related Intents with a shared first part, for example `LANGUAGE_TRANSLATION`. A judge is published on a family and scores every Intent in it. |
| **GitHub** | The website where the bounty board lives: [github.com/telegraphprotocol/bounties](https://github.com/telegraphprotocol/bounties). |
| **Intent** | One kind of question the network answers, with a fixed name, for example `LANGUAGE_TRANSLATION_GENERAL`. |
| **Issue** | GitHub's word for one item on a board. Each bounty is one Issue. |
| **Judge** | The program that scores miners' answers: an adapter or a comparator. |
| **Label** | A coloured tag on a bounty, such as `status:open` or `priority:p1`. |
| **MACHINA** | The network's token. Evaluator rewards and bonds are in MACHINA. |
| **Maintainer** | A person who runs the bounty board: opens bounties, reviews submissions and closes them. |
| **Miner** | A service that answers questions for an Intent. Better-ranked miners get more questions, and are paid for the ones they answer. |
| **Mission** | One of the 15 Season II app goals, such as agriculture or personal agents. It's built from several Intents. |
| **Pool** | All the evaluation material the network holds for one Intent. |
| **Question pair** | A question with a better answer and a worse answer. |
| **Ranking** | How the network orders miners from best to worst, so each question goes to a good one. |
| **Row** | One piece of material in the pool: one question pair or one truth source. |
| **Season II (H2)** | Telegraph's hackathon, built around 15 missions. Bounties from it carry `source:h2`. |
| **Status** | Where a bounty is: `triage`, `open`, `claimed`, `review`, `blocked` or `done`. |
| **Test network** | The version of the network used today. Its tokens are test tokens. |
| **Truth source** | A free public data service the network asks for the exact right answer, for example an exchange rate. |
| **Unfunded** | No money or tokens are promised for the bounty. |
| **Wallet** | An account for crypto tokens. With an Anjoman email account, one is made for you, and you don't need your own. |
