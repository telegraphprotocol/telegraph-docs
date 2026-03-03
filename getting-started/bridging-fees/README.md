# Bridging Fees

A central tenet in Telegraph's mission is to make the process of bridging extremely affordable for any developer and their community. As a result, the cost of sending transactions between chains will always be priced with current network transaction volume in mind. All fees must be paid in the native coin of the chain where the message initiated. The fee is sent alongside the request to the chain's local port contract. As a general goal, Telegraph strives to make cross-chain as affordable as possible and will seek to keep transaction fees as competitive as possible with low cost to the end user top of mind.

#### **How are gas fees determine** <a href="#how-are-gas-fees-determined" id="how-are-gas-fees-determined"></a>

Gas is determined and set within the port contracts on a chain-by-chain basis by an offchain messaging protocol managed by the Telegraph core team. This gas fee will be in **wTAO.** This will ensure that fees on any particular chain is set appropriately to prevent transaction over/under-spending. A voting based system contained within each Telegraph node may be introduced in the future, deprecating the use of the initial messaging protocol.

When initiating a transaction, the sender is responsible for covering the Starting Chain Gas fee, a charge determined by the originating blockchain network's conditions. In addition to this, a Telegraph Fee and an Ending Chain Gas Fee are applied. These two fees and the native coin to submit the transaction the form total transaction cost, which includes the Starting Chain Gas, Telegraph Fee, and Ending Chain Gas Fee. All two fees ( Starting Chain and Ending Chain will be in the form of wTAO)

Regarding fee distribution, the Telegraph Corporation receives 50% of the sum of the Telegraph and Ending Chain Gas Fees. The network nodes, critical in the transaction's confirmation and validation, share the remaining 50%. The confirming node, which plays a pivotal role in the transaction's processing, is allocated 42% of this amount. The other nodes, which assist but do not confirm the transaction, collectively receive the final 8%.

It is essential to understand that mainnet transactions and testnet transactions are segregated; transactions initiated on mainnet chains cannot interact with testnets. This segregation ensures the integrity and security of the mainnet by preventing any potential disruptions from less stable test environments.

Please be aware that while the distribution percentages are typically set, the Telegraph Corporation reserves the right to adjust these ratios in response to incoming data to preserve the fairness and stability of the ecosystem. This flexibility ensures that the fee structure remains responsive to the evolving dynamics of network conditions and gas prices. Consequently, while the distribution framework is designed to be consistent, the actual fees applied to each transaction may vary to reflect the current state of the network.

In the event that a transaction cannot be confirmed within a predetermined time frame, or if the final transaction fails to complete, it is important for users to understand that there are **no refunds for incurred fees**. This policy is in place because the network and nodes have already expended resources to attempt the transaction. As such, the fees compensate for the computational work performed, regardless of the transaction's outcome. Users are encouraged to ensure the accuracy and viability of their transactions before submission to avoid such scenarios.

