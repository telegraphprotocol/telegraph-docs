# Bridging Fees

Cross-chain messages on Telegraph require gas fees for validator nodes that submit transactions on the destination chain. Users deposit gas (in the chain's native token) via `depositGas` on the Diamond before sending cross-chain messages. The node is reimbursed from this per-user gas balance when executing the delivery transaction.

> **Note:** The fee model described below predates the current protocol. Cross-chain gas fees are now paid in the destination chain's native token (ETH, AVAX, etc.), not wTAO. See [Gas Deposit](../../examples-and-tutorials/evm-chains/gas-deposit.md) for the current gas deposit flow.

For intelligence/inference requests, the protocol applies a flat **2% fee (200 bps)** on USDC payments, deducted before the MACHINA swap. See [x402 Payment & Dynamic Pricing](../../miner-registry/x402-payment.md) for details.

Regarding fee distribution, the Telegraph Corporation receives 50% of the sum of the Telegraph and Ending Chain Gas Fees. The network nodes, critical in the transaction's confirmation and validation, share the remaining 50%. The confirming node, which plays a pivotal role in the transaction's processing, is allocated 42% of this amount. The other nodes, which assist but do not confirm the transaction, collectively receive the final 8%.

It is essential to understand that mainnet transactions and testnet transactions are segregated; transactions initiated on mainnet chains cannot interact with testnets. This segregation ensures the integrity and security of the mainnet by preventing any potential disruptions from less stable test environments.

Please be aware that while the distribution percentages are typically set, the Telegraph Corporation reserves the right to adjust these ratios in response to incoming data to preserve the fairness and stability of the ecosystem. This flexibility ensures that the fee structure remains responsive to the evolving dynamics of network conditions and gas prices. Consequently, while the distribution framework is designed to be consistent, the actual fees applied to each transaction may vary to reflect the current state of the network.

In the event that a transaction cannot be confirmed within a predetermined time frame, or if the final transaction fails to complete, it is important for users to understand that there are **no refunds for incurred fees**. This policy is in place because the network and nodes have already expended resources to attempt the transaction. As such, the fees compensate for the computational work performed, regardless of the transaction's outcome. Users are encouraged to ensure the accuracy and viability of their transactions before submission to avoid such scenarios.

