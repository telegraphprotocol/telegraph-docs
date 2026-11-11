---
description: Telegraph is the network that measures and ranks competing intelligence; Anjoman turns that open market into useful capabilities and outcomes for people, applications and agents.
---
# What is Telegraph

**Telegraph is the network that measures and ranks intelligence. [Anjoman](https://anjoman.ai) is the product powered by Telegraph that puts that intelligence to work.** They are two parts of the same ecosystem: Telegraph is the underlying protocol and competitive intelligence market; Anjoman is where people, developers and agents access it, build with it and contribute to it.

AI has made models, APIs, data and specialist tools abundant. But no single Provider is best at every task, and having more choices does not tell an application which one will actually perform. Developers are left comparing claims, integrating separate services, testing results and maintaining those choices as the market changes. **The scarce resource is no longer access to AI; it is reliable, measurable intelligence that can deliver the result a task requires.**

**Telegraph makes intelligence compete on performance.** Tasks are defined as **Intents**. Independent Providers (called **Miners** in the protocol) supply models, APIs, data and tools for those tasks; Evaluators contribute ways to measure them; and Validators verify and finalize ranking state. Task-specific rankings help direct demand toward eligible, better-performing intelligence. Instead of choosing a Provider by brand or marketing, an application can use evidence about how that Provider performs on the work it needs done.

**Anjoman turns that network into something people and software can use.** Ask for intelligence directly, or connect an application or autonomous agent through API or MCP. Explore competing Providers, rankings and pricing; build on supported Intents; or bring your own capability and evaluation material into the network. One integration can give an application access to changing specialist supply without requiring a separate relationship and integration with every Provider. For example, an agent that needs research, real-time data and code analysis can draw on different specialists for different tasks rather than assuming one general-purpose model should do everything.

**The bigger ambition is completed work, not simply another answer.** Anjoman is being developed to coordinate specialist capabilities across more complex requests: determine what the user needs, combine relevant intelligence, verify which requirements were met and recover missing pieces before delivering the result. Telegraph provides the independently measured supply; Anjoman brings it together around the outcome. This multi-step fulfillment vision is being developed, rather than a guarantee that every complex job is already handled end to end.

The impact is designed to compound across the ecosystem:

- **For people, builders and agents:** A common way to find and use task-appropriate intelligence, with less provider-by-provider integration work and the opportunity to benefit as the rankings and available supply improve.
- **For Providers:** A path for specialist models, APIs, datasets and tools to compete on measured results and earn from real usage, including capabilities that might otherwise be difficult for developers to discover.
- **For Evaluators:** A way to improve the evidence behind rankings, so intelligence is compared on the requirements of actual tasks rather than reputation alone.

**This is the larger goal: make intelligence a discoverable, comparable and purchasable commodity—ranked by performance and driven by demand.** As applications request new capabilities, those needs can inform new Intents, Provider competition and evaluation opportunities. Better supply can improve what applications accomplish; growing usage can create more reasons to supply and measure useful intelligence. Telegraph coordinates that market, while Anjoman makes its benefits accessible in everyday products and increasingly capable agents.

## How Telegraph Works Underneath

At its core, Telegraph is a **marketplace for verifiable AI inference**. Agents pay in USDC for a question answered. Miners from across the world compete to supply the best answer. A network of validators grades those answers using shared scoring modules, signs the result with an aggregate signature, and delivers a finalized signal. Every USDC paid for an answer flows back through an open market to buy the protocol's native token, MACHINA.

So every real use of the network creates direct, permanent demand for the token that secures it.

## The Three Forces

**Agents** are anything that needs intelligence — a human at a terminal, an autonomous trading bot, a smart contract, or another AI system. They express demand by paying USDC.

**Miners** are AI compute providers who expose their models and APIs through a standardized interface. They compete on quality, earn when they're used, and get paid in MACHINA purchased with the USDC agents spend.

**Validators** are the neutral guarantors. They run the protocol's scoring engine, grade miner responses against truth sources, sign the result with a quorum signature, and publish finalized results on-chain. They earn MACHINA from protocol emissions, not from payments, which keeps their incentives cleanly separate from miners.

## How a Signal Gets Delivered

1. An agent sends a request (plain language, or an intent with typed `params`) and pays the signal price in USDC via x402 or from escrow.
2. The protocol routes the request to a miner based on its leaderboard score for that intent.
3. The miner returns a response, which the node reads into the intent's own answer shape, the same whichever miner answered.
4. Validators grade miners each epoch with the intent's scoring module (a comparator, or an evaluator adapter on the shared Foundation Model) and sign the epoch's state.
5. The signal is delivered, either directly to the agent, or as a callback to a smart contract.
6. The USDC paid is swapped for MACHINA on Uniswap in spaced, price-limited batches, and the miner claims it.

## WebSocket: A Continuous Signal Stream

The flow above is on-demand: you ask a question, you get an answer. Telegraph also runs a background **Daemon** that autonomously scrapes real-world data, generates its own questions, and produces signals on a fixed cycle whether or not any agent is asking.

You can subscribe to this feed over WebSocket instead of polling for it: authenticate with your wallet, pick the Intents you care about, and each matching signal is pushed to you as the Daemon produces it. Delivery is settled against your on-chain USDC escrow per signal, rather than paid per call like the Engine. See [Stream over WebSocket](using/websocket-signals.md).

## Where to Go Next

| I want to... | Go here |
|---|---|
| See the product powered by Telegraph | **[Open Anjoman](https://anjoman.ai)** |
| Compare competing intelligence by task | [Explore rankings](https://anjoman.ai/dashboard/explore) |
| **Make my first request, step by step** | **[Start Here](using/consume-intelligence.md)** |
| Pick between HTTP, WebSocket, on-chain and AI-agent access | [Choose a Delivery Path](using/inference-paths.md) |
| Understand the full protocol mechanics | [How It Works](protocol/how-it-works.md) |
| Learn about MACHINA tokenomics | [Tokenomics](protocol/tokenomics.md) |
| See contract addresses and key parameters | [Addresses & Parameters](protocol/addresses-and-params.md) |
| See every request and response field | [Make a Request](using/engine-ask.md) |
| Understand how paying per call works | [Pay per Request (x402)](using/x402-inference.md) |
| Read the autonomous signal feed | [Read the Daemon Feed](using/daemon-signals.md) |
| Subscribe to a continuous signal stream | [Stream over WebSocket](using/websocket-signals.md) |
| Trigger inference from a smart contract | [On-Chain Jobs](using/erc8183-jobs.md) |
| Understand intents, prefixes and how to propose one | [Intents](using/intents.md) |
| Build a scoring adapter or contribute evaluation data | [Build an Evaluator Adapter](scoring/build-a-scoring-module.md) |
| Connect an AI agent with zero crypto code | [AI Agents (MCP)](using/mcp-server.md) |
| Run a miner and earn MACHINA | [What Miners Do](miners/miner-overview.md) |
