# Transactions

Stored transactions are used to keep track of messages that the validator may have to sign and broadcast. These transaction documents are generated either through the detection of an event on a port contract, or receiving an unknown signed transaction from another validator. Each transaction contains information required for validators to properly route the message to its final destination. Developers can pass multiple types of data(int, string, bool, byte) arrays to their end destination.

Below are the fields that make up a transaction:

<details>

<summary>Transaction Data</summary>

* ID
* DetectionTime
* Hash
* EndHash
* BlockNumber
* LogIndex
* Event
* Sender
* Addresses
* Uint256
* String
* Bool
* FeeAmount
* StartChain
* Destination
* EndChain
* SignedCount
* Submitter
* Signers
* R
* S
* V
* H
* SignerTime
* Confirmed

</details>
