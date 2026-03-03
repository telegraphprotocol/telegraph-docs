---
description: >-
  Telegraph is a permissionless messaging protocol that commoditizes AI
  inference and delivers intelligent signals to global markets on-chain.
---

# What is Telegraph

It acts as the interoperability layer that connects Bittensor Subnets (the computation) to EVM Blockchains (the economy) by wrapping raw intelligence into verifiable, tradeable on-chain assets.

Telegraph does not just move data, it turns the raw compute power of the Bittensor subnets into a standardized, tradeable Inference Credit. This allows AI Agents & smart contracts on chains like Ethereum, Arbitrum, and Binance to request specific intelligence – a prediction, a classification, or a score–and receive it with a cryptographic receipt, enabling them to execute real-time decisions based on verified real-world data.

#### The 4 Core Pillars of Telegraph

Telegraph is a unified system composed of the Rail, the Signal, the Commodity, and the Interface.

**1. The Rail: Universal Message Transport**

Telegraph is the decentralized infrastructure that powers both Cross-Chain Messaging and Subnet Inference.

* The Function: It operates as a unified transport layer.
  * Chain-to-Chain: It acts as a secure message bridge, allowing smart contracts on one chain to trigger execution on another (e.g., Ethereum $$\leftrightarrow$$ Arbitrum).
  * Chain-to-Subnet: It extends this bridge to off-chain compute, connecting EVM "Ports" directly to Bittensor Subnets for AI inference.
* The Mechanic: The Rail executes a 4-step loop for every signal:
  1. Request: A user or a market contract calls a Telegraph Port with a payload (e.g., "Send Token" OR "Get Deepfake Score").
  2. Route: Telegraph Nodes listen for the event, validate the payload, and route it to the correct destination (Target Chain or Bittensor Subnet).
  3. Publish: Once computed, Nodes write the result on-chain with a cryptographic proof (Signature).
  4. Callback: The Node triggers a Callback function in the destination contract to auto-execute the logic (e.g., "Unlock Funds" or "Settle Market").

**2. The Signal: Actionable On-Chain Intelligence**

Telegraph transforms passive data into active decisions.

* The Function: It delivers Intelligent Signals – verified data points derived from specific parameters (e.g., a Deepfake Probability Score for a specific video hash, or a Flood Risk % for a specific geolocation).
* The Utility: Because these signals are delivered as standardized, cryptographic receipts, smart contracts can ingest them directly without human interpretation. This enables "Actionable Inference" – where a DeFi protocol can automatically adjust collateral, or an insurance contract can pay out claims, based entirely on the received data.

**3. The Commodity: Tradeable Tokenized Inference**

Telegraph solves the "Ephemeral AI" problem by turning access to compute into an asset.

* The Function: It creates Tradeable Inference Credits. These are essentially wrapped versions of the Subnet’s native value (e.g., dTAO / Alpha Tokens) on EVM chains.
* The Asset: Instead of just being a "voucher" for data, these credits are liquid commodities that fluctuate in value. If a specific Subnet (like BitMind) becomes more valuable, the Inference Credit that grants access to it also increases in value. This allows markets to price, hedge, and trade the _capacity_ of the network, creating a true liquid market for AI intelligence.

**4. The Interface: The Launch Terminal**

Telegraph makes decentralized intelligence accessible to humans and AI Agents, not just smart contracts.

* The Function: The Launch Terminal is a natural language interface (similar to ChatGPT or Perplexity) that allows any human or automated agent to query connected Subnets directly as a plug-and-play tool.
* The Utility: A user can ask, 'Did Haaland score in the last match?' or 'Is this video a deepfake?'. The Terminal routes the query through the Telegraph protocol to the specific Subnet, verifies the response, and delivers the answer instantly. This turns complex blockchain inference into a simple, search-like product that anyone can use on-demand.

#### Contract architecture

The on-chain “Port” that powers the Rail is implemented using the **Diamond Standard (EIP-2535)**. A single Diamond proxy address exposes all behaviour; logic is split across **facets** (e.g. CrossChain, Subnet, Gas, Signer, Reward, Fee) that share one storage layout. This keeps the system upgradeable and within contract size limits while you interact with one contract address per chain. For integration details and code examples, see **Dapp Examples** and **Examples & Tutorials → EVM Chains**.
