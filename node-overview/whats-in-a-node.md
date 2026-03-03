# What's in a node

Telegraph nodes are initially written in Golang, with a main port contract deployed on ETH. All nodes use the main port contract to determine which public addresses are currently allowed to sign and approve bridge transactions. This makes the main port contract a central piece of the network's security, hence the choice to deploy it on ETH(currently the safest smart chain). However, port contracts will exist on a variety of chains, each storing the full list of all current validators. Each of these smart contracts will use onchain methods to recover the underlying public key of each signer.

In order to ensure that the number of network validators does not increase exponentially, the bridge will implement a one-time dynamic increasing fee for each new validator, paid in the ERC-20 version of the **$USDC**. **This is a non-refundable payment that locks the tokens indefinitely**, and sets a mapping within the main port contract to true. When validator-to-validator communications occur, incoming messages will have to be accompanied with a valid signature from an address that has paid its validator fee.

Each validator stores its own local DB of transactions, validators and blockchain networks.

[<br>](https://telegraph-1.gitbook.io/what-is-telegraph/getting-started/bridging-fees/fee-table-by-chain/heco)
