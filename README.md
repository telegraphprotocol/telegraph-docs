---
description: >-
  Telegraph is a permissionless messaging protocol that commoditizes AI
  inference and delivers intelligent signals to global markets on-chain.
---

# What is Telegraph

Telegraph is a machine intelligence protocol — a permissionless marketplace where autonomous agents buy verified intelligence and miners compete to supply it. Telegraph transforms raw AI outputs from any source (Bittensor subnets, open-source models, APIs, humans, or autonomous systems) into standardized, tradeable on-chain signals you can trust.

When an agent needs intelligence — a prediction, a classification, a probability score, an alert — it pays in USDC. Telegraph routes the request to the most capable miner. The miner fulfills it. The protocol uses that USDC to buy Machina tokens from the open market and sends them to the miner. Every transaction creates demand for Machina, directly linking miner compensation to real agent usage. This is **Machines Improving Machines** — intelligence serving intelligence, at competitive market prices.

#### The 4 Core Pillars of Telegraph

Telegraph is a unified system composed of the Rail, the Signal, the Commodity, and the Interface.

**1. The Rail: Universal Message Transport**

Telegraph is the decentralized infrastructure that powers both Cross-Chain Messaging and Intelligence Requests.

* The Function: It operates as a unified transport layer.
  * Chain-to-Chain: It acts as a secure message bridge, allowing smart contracts on one chain to trigger execution on another (e.g., Ethereum $$\leftrightarrow$$ Arbitrum).
  * Chain-to-Intelligence: It extends this bridge to off-chain intelligence providers – connecting EVM "Ports" to Bittensor subnets, open-source models, APIs, and other verified inference sources.
* The Mechanic: The Rail executes a 4-step loop for every signal:
  1. Request: A user or a market contract calls a Telegraph Port with a payload (e.g., "Send Token" OR "Get Deepfake Score").
  2. Route: Telegraph Nodes listen for the event, validate the payload, and route it to the correct destination (Target Chain or Intelligence Provider).
  3. Publish: Once computed, Nodes write the result on-chain with a cryptographic proof (Signature).
  4. Callback: The Node triggers a Callback function in the destination contract to auto-execute the logic (e.g., "Unlock Funds" or "Settle Market").

**2. The Signal: Actionable On-Chain Intelligence**

Telegraph transforms passive data into active decisions.

* The Function: It delivers Intelligent Signals – verified data points derived from specific parameters (e.g., a Deepfake Probability Score for a specific video hash, or a Flood Risk % for a specific geolocation).
* The Utility: Because these signals are delivered as standardized, cryptographic receipts, smart contracts can ingest them directly without human interpretation. This enables "Actionable Inference" – where a DeFi protocol can automatically adjust collateral, or an insurance contract can pay out claims, based entirely on the received data.

**3. The Commodity: Tradeable Tokenized Intelligence**

Telegraph solves the "Ephemeral AI" problem by turning intelligence into a liquid market asset.

* The Function: It creates Tradeable Intelligence Credits – standardized tokens representing verified answers from any intelligence provider. Every request creates a permanent buy signal for Machina (the protocol's native token), directly linking supply-side value to demand.
* The Asset: Instead of just being a "voucher" for data, these credits are liquid commodities that fluctuate in value based on the performance and reputation of their underlying providers. If a specific mining team, subnet, or model becomes more valuable and trusted, certificates pointing to their intelligence increase in value. This allows markets to price, hedge, and trade the _capacity_ and _quality_ of intelligence itself.

**4. The Interface: The Launch Terminal**

Telegraph makes decentralized intelligence accessible to humans and autonomous agents, not just smart contracts.

* The Function: The Launch Terminal is a natural language interface (similar to ChatGPT or Perplexity) that allows any human or automated agent to request intelligence from the Telegraph network as a plug-and-play tool.
* The Utility: A user can ask, 'Did Haaland score in the last match?' or 'Is this video a deepfake?'. The Terminal routes the query through the Telegraph protocol to the most capable intelligence providers, verifies the response across the validator mesh, and delivers a verified answer instantly. This turns complex intelligence access into a simple, search-like experience that anyone can use on-demand.

#### Contract architecture

The on-chain “Port” that powers the Rail is implemented using the **Diamond Standard (EIP-2535)**. A single Diamond proxy address exposes all behaviour; logic is split across **facets** (e.g. CrossChain, Subnet, Gas, Signer, Reward, Fee) that share one storage layout. This keeps the system upgradeable and within contract size limits while you interact with one contract address per chain. For integration details and code examples, see **[Dapp Examples](dapp-examples/README.md)** (quick guides and interface reference) and **[Examples & Tutorials → EVM Chains](examples-and-tutorials/evm-chains/README.md)** (gas deposit, cross-chain, subnet inference, and more).
