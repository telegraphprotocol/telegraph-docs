---
description: What's in a message?
---

# Message Data

Bridged messages have an expected structure that is enforced by each port contract. A message contains key pieces of information that help nodes and developers determine a transaction's initiator, its destination chain, and what contract the message should be sent to. Additional data can also be passed within each message to enable endless functionality within the receiving contract. It is the responsibility of the contract's developer to properly validate and route the data contained within the message.

Although the additional data within each message is optional, its where the primary productive value of Telegraph is shown. Each message can contain a dynamic number of integers, strings, bools, and addresses--all easily accessible by the receiving contract. Additional information on what is contained with a message can be found [here](https://telegraph-2.gitbook.io/telegraph/node-overview/transactions).

Giving developers the ability to relay these types of data allows them to create full cross-chain smart contract APIs, opening their contracts to a new range of possibilities.

[<br>](https://telegraph-1.gitbook.io/what-is-telegraph/getting-started/core-concepts)
