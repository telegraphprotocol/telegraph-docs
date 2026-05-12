# What's in a Node

Telegraph nodes are the infrastructure layer that routes intelligence requests between agents (on-chain contracts and external applications) and miners (individual operators, teams, Bittensor subnets, and other intelligence providers). This is **Machines Improving Machines** — autonomous systems requesting verified intelligence from competing miners, whose performance directly determines which get the most requests and highest earnings.

Every node participates in a permissionless marketplace: agents submit payment requests in USDC, nodes compete to fulfill them with the highest-quality intelligence, and top performers earn Machina tokens. The intelligence delivered — probabilities, scores, classifications, alerts — comes with verifiable cryptographic receipts proving origin, cost, and confidence level.

## Node Role: Intelligence Router & Validator

A Telegraph node serves two core functions:

1. **Request Router** — Listens for intelligence requests from on-chain Ports and routes them to the best-performing miners (which may be Bittensor subnets, open-source models, APIs, or individual operators). The node aggregates responses, verifies them against ground-truth, and publishes results on-chain.

2. **Validator** — Scores miner outputs against known ground-truth data to rank performance. These scores influence which miners receive future requests. Better performance = more requests = higher earnings.

## Security Layer: The Port Contract

Telegraph's on-chain "Port" contract deployed on Ethereum (and replicated on other chains) is the security anchor for the entire network:

* **Single Source of Truth**: All nodes query the Ethereum Port contract to determine which public addresses are currently allowed to route and sign transactions. This prevents unauthorized nodes from joining.
* **Validator Registry**: Port contracts on each chain maintain the full list of current validators, allowing anyone to verify node credentials on-chain without trusting a central authority.
* **Cryptographic Verification**: Smart contracts use on-chain methods to recover the public key of each signer from signatures, ensuring accountability.

## Joining as a Miner or Validator

To become a Telegraph node operator, you must:

1. **Register on-chain** — Submit your node's public key to the Port contract. This marks you as an authorized node.
2. **Pay the entry fee** — One-time USDC fee (non-refundable, locked indefinitely). This prevents spam and keeps the network honest.
3. **Run the node software** — Start your node. It will immediately begin receiving intelligence requests from agents.
4. **Earn from requests** — Compete with other miners to provide the best intelligence. Every USDC payment from agents gets routed based on your performance score.

## Local Infrastructure

Each Telegraph node maintains:

* **Ledger** — Local database of all transactions, validator addresses, and blockchain state. Used for fast lookups and history.
* **Performance Cache** — Tracks which miners consistently provide high-quality outputs (across ground-truth benchmarks).
* **Provider Connectors** — Interfaces to connected intelligence sources (Bittensor subnet clients, OpenAI API, local models, etc.).

The node orchestrates these, responding to requests by selecting the highest-performing provider for each specific signal type, publishing the result with a cryptographic signature, and receiving its share of fees for successful responses.
