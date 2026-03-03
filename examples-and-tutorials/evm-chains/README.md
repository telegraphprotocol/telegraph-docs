---
description: >-
  Tutorials on how to interact with the Telegraph network from the Ethereum
  blockchain. Includes Diamond (Port) integration examples.
---

# EVM Chains

These tutorials show how to interact with the Telegraph network from EVM chains. The on-chain Port is implemented as a **Diamond (EIP-2535)**; you use one contract address per chain and call facets for cross-chain messages, subnet inference, and gas deposit.

**Diamond integration (chunk-sized examples):**

* [Gas Deposit](gas-deposit.md) — Deposit and check gas balance on the Diamond for node reimbursement.
* [Cross-Chain Message Example](cross-chain-message-example.md) — Send a message to another chain and receive it in a destination contract (`portMessage`).
* [Subnet Inference Example](subnet-inference-example.md) — Request subnet inference and handle the response in a callback contract (`subnetMessage`).

For the overall interface and connection idea (interfaces, flows, quick reference), see [Dapp Examples — Interface & Implementation Guide](../../dapp-examples/README.md).

**Other tutorials:**

* [Hello World!](hello-world.md) — Basic bridge contract and messaging.
* [ERC20 Transfers](erc20-transfers.md) — Token transfers across chains.
* [Securing Your Smart Contract](securing-your-smart-contract.md) — Security practices.
