---
description: Telegraph is a permissionless marketplace for verified AI inference — where agents pay, miners compete, and validators guarantee the answer.
---

# What is Telegraph

Autonomous agents need intelligence they can trust and pay for programmatically — without API key management, without centralized gatekeepers, and without a human in the loop. Telegraph is the protocol that makes this possible.

At its core, Telegraph is a **marketplace for verifiable AI inference**. Agents pay in USDC for a question answered. Miners from across the world compete to supply the best answer. A decentralized network of validators grades those answers using a shared scoring script, reaches consensus, and delivers a finalized signal. Every USDC paid to get that answer flows back through an open market to buy the protocol's native token, MACHINA — meaning every real use of the network creates direct, permanent demand for the token that secures it.

## The Three Forces

**Agents** are anything that needs intelligence — a human at a terminal, an autonomous trading bot, a smart contract, or another AI system. They express demand by paying USDC.

**Miners** are AI compute providers who expose their models and APIs through a standardized interface. They compete on quality, earn when they're used, and get paid in MACHINA purchased with the USDC agents spend.

**Validators** are the neutral guarantors. They run the protocol's scoring engine, grade miner responses against ground truth, reach Byzantine fault-tolerant consensus, and publish finalized results on-chain. They earn MACHINA from protocol emissions — not from payments — which keeps their incentives cleanly separate from miners.

## How a Signal Gets Delivered

1. An agent sends a request and pays the signal price in USDC via x402 (an HTTP-native payment standard).
2. The protocol routes the request to a miner based on its leaderboard score for that intent.
3. The miner returns a response.
4. Validators independently grade the response using a shared WASM script and reach consensus via commit-reveal BFT.
5. The finalized signal is delivered — either directly to the agent, or as a callback to a smart contract.
6. The USDC paid gets dripped into Uniswap to purchase MACHINA, which is sent to the miner.

## Where to Go Next

| I want to... | Go here |
|---|---|
| Understand the full protocol mechanics | [How It Works](protocol/how-it-works.md) |
| Learn about MACHINA tokenomics | [Tokenomics](protocol/tokenomics.md) |
| See contract addresses and key parameters | [Addresses & Parameters](protocol/addresses-and-params.md) |
| Get inference via HTTP (pay per call) | [Direct x402 Inference](using/x402-inference.md) |
| Get inference via the Engine | [Engine Inference](using/engine-ask.md) |
| Read the autonomous signal feed | [Daemon Signal Feed](using/daemon-signals.md) |
| Subscribe to a continuous signal stream | [WebSocket Signals](using/websocket-signals.md) |
| Trigger inference from a smart contract | [On-Chain Jobs (ERC-8183)](using/erc8183-jobs.md) |
| Connect an AI agent with zero crypto code | [MCP Server](using/mcp-server.md) |
| Run a miner and earn MACHINA | [What Miners Do](miners/miner-overview.md) |
| Run a validator node | [What Validators Do](validators/validator-overview.md) |
