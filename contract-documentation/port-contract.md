# Port Contract

The `PortContract` is an advanced smart contract governing the intercommunication between any Telegraph-compatible blockchains. Let's examine its functions in greater detail:

`constructor()`: As the initial set-up function, it is only executed once upon contract creation.&#x20;

`proxyConstructor()`: This method handles initial setup of the `PortContract`. As parameters, it requires information about the starting chain and Chain ID, address and fee of entry gateway, and more. It ensures that the contract is only initialized once.

`updateCode()`: This method is a unique feature of Proxiable contracts that allows the logic code of contract to be updated, even after deployment, without losing the state of the contract. It can only be invoked by the contract's owner and if the contract is initialized, by delegating the task to the `updateCodeAddress()` method from the `Proxiable` contract.

`receive()`: It's a special function in solidity that handles incoming transactions that do not match any other function. Essentially, it's a fallback that gets called when no other function matches. Here, it is left empty to safely accept Ether transactions.

Various `setX()`: Setters (like `setEntryFees()`, `setChainId()`, `setDistributionContract()`, `setPriceMapping()`) are provided for administrative tasks, and can only be called by the owner contract. These methods customize transaction costs, identify the blockchain, appoint a distribution contract, and set the price mapping for transactions between various chains.

`addSigner()`: This function accepts a new signer and their details, if it meets the requirements. Then, the function adds these details to a mapping and updates the list of signers in the contract's state. If it is the first signer, it also sets the nodeStart time (capture timestamp as node start time).

`outboundMessage()`: This function facilitates outbound transactions (arbitrary data exiting the contract towards external chains) and accepts parameters including sender, recipient, some metadata and the target chain. It emits a `BridgeSwapOut` event detailing the relevant information about the outbound transaction including the sender, destination, start and end chain, fee amount, start contract, and other data.

`updateRewardsPerShare()`: This function recalculates the amount of rewards each share gets. It is done by dividing the transaction reward by the total number of signers.

`claimReward()`: This function allows a signer to claim their reward. It calculates unclaimed rewards by calling the `getUnclaimedRewards` function and transfers those rewards to the signer. It then updates the `lastRewardsPerShare` mapping to mark that the reward for that share is claimed.

`getUnclaimedRewards()`: This function calculates the new reward amount per share available for the signer to claim. It does this by subtracting the last rewards that the signer received from the current reward per share.

`reward()`: This internal function manages rewards for signers. It calls `updateTokenReward()` to adjust reward values over time, updates `rewardsPerShare`.

`updateTokenReward()`: In order to decrease inflation over time, this function halves the `transactionReward` every year. It's tracked by comparing `block.timestamp` with `lastHalvingTime`. If it detects over a year has passed, it shrinks the `transactionReward` value and adjusts `lastHalvingTime` to the current timestamp.

`determineFeeInCoin()`: This function returns the fee required for a transaction for a specific endChain according to the `priceMapping`.

`inboundMessage()`: Contrasting with `outboundMessage()`, this function executes whenever tokens are received, accepting a variety of parameters including sender and destination addresses. It calls the `portMessage` method through the `DestinationContract` interface to conform the incoming tokens.

`executeInboundMessage()`: This function is called to verify and execute a bridged message from another chain. It first verifies the number and authenticity of signatures calling `signatureCheck()`. If it passes, an `inboundMessage()` is then called to process the message. A reward is minted for the signer at last.

`signatureCheck()`: This function is critical in ensuring the integrity of cross-chain messages. It uses ecrecover to validate each signer’s signature and ensures that only recognized signers can sign messages, and that each message hash is never used again in subsequent transactions.

Overall, the `PortContract` allows the creation of a complex yet secure relay network between Ethereum-compatible blockchains, governing transactions while performing a series of checks and guards. It also incorporates an incentive mechanism for signers to ensure the contract's appropriate operation.
