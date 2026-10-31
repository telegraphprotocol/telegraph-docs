---
description: Telegraph is a permissionless marketplace for verified AI inference — where agents pay, miners compete, and validators guarantee the answer.
---

# What is Telegraph

Autonomous agents need intelligence they can trust and pay for programmatically — without API key management, without centralized gatekeepers, and without a human in the loop. Telegraph is the protocol that makes this possible.

At its core, Telegraph is a **marketplace for verifiable AI inference**. Agents pay in USDC for a question answered. Miners from across the world compete to supply the best answer. A network of validators grades those answers using shared scoring modules, signs the result with an aggregate signature, and delivers a finalized signal. Every USDC paid for an answer flows back through an open market to buy the protocol's native token, MACHINA. So every real use of the network creates direct, permanent demand for the token that secures it.

## The Three Forces

**Agents** are anything that needs intelligence — a human at a terminal, an autonomous trading bot, a smart contract, or another AI system. They express demand by paying USDC.

**Miners** are AI compute providers who expose their models and APIs through a standardized interface. They compete on quality, earn when they're used, and get paid in MACHINA purchased with the USDC agents spend.

**Validators** are the neutral guarantors. They run the protocol's scoring engine, grade miner responses against truth sources, sign the result with a quorum signature, and publish finalized results on-chain. They earn MACHINA from protocol emissions, not from payments, which keeps their incentives cleanly separate from miners.

## How a Signal Gets Delivered

1. An agent sends a request (plain language, or an intent with typed `params`) and pays the signal price in USDC via x402 or from escrow.
2. The protocol routes the request to a miner based on its leaderboard score for that intent.
3. The miner returns a response, which the node reads into the intent's own answer shape, the same whichever miner answered.
4. Validators grade miners each epoch with a shared WASM scoring module and sign the epoch's state.
5. The signal is delivered, either directly to the agent, or as a callback to a smart contract.
6. The USDC paid is swapped for MACHINA on Uniswap in spaced, price-limited batches, and the miner claims it.

## WebSocket: A Continuous Signal Stream

The flow above is on-demand: you ask a question, you get an answer. Telegraph also runs a background **Daemon** that autonomously scrapes real-world data, generates its own questions, and produces signals on a fixed cycle whether or not any agent is asking.

You can subscribe to this feed over WebSocket instead of polling for it: authenticate with your wallet, pick the Intents you care about, and each matching signal is pushed to you as the Daemon produces it. Delivery is settled against your on-chain USDC escrow per signal, rather than paid per call like the Engine. See [Stream over WebSocket](using/websocket-signals.md).

## Where to Go Next

| I want to... | Go here |
|---|---|
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
