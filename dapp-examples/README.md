---
description: >-
  Interface and implementation guide for integrating with Telegraph’s Diamond
  (Port): cross-chain and subnet flows, interfaces, and where to find code.
---

# Dapp Examples — Interface & Implementation Guide

This section explains **how to connect your dApp or smart contracts** to Telegraph’s Diamond (Port): the interfaces you implement, the flows (cross-chain vs subnet), and where the **literal code examples** live.

**Quick guides (deployed testnet contracts):**

* [Bridge TX Test – Quick Guide](dapp-examples/bridge-tx-test-quick-guide.md) — Run a Fuji → Sepolia bridge test using BridgeSender, BridgeReceiver, and the Telegraph Diamonds.
* [Subnet Inference Test – Quick Guide](dapp-examples/subnet-inference-test-quick-guide.md) — Run Bitmind and Zeus subnet tests using SubnetSender, SubnetCallback, and the Diamond on Fuji.

**For chunk-sized, copy-paste examples** (gas deposit, sending/receiving cross-chain, subnet request/callback), see **Examples & Tutorials → EVM Chains**: [Gas Deposit](../examples-and-tutorials/evm-chains/gas-deposit.md), [Cross-Chain Message Example](../examples-and-tutorials/evm-chains/cross-chain-message-example.md), [Subnet Inference Example](../examples-and-tutorials/evm-chains/subnet-inference-example.md).

---

## Architecture in one sentence

You talk to **one Diamond (Port) address per chain**. Cross-chain: call `outboundMessage` on the origin chain; the network relays; on the destination chain the Diamond calls your contract’s `portMessage`. Subnet: call `outboundSubnetMessage` on one chain; the network calls the subnet API and then calls your contract’s `subnetMessage` with the result. Gas for the node is paid from user balances via `depositGas` on the Diamond.

---

## Interfaces you implement

### 1. Destination contract (cross-chain receive)

On the **destination** chain, your contract must implement the destination interface so the Diamond can deliver incoming cross-chain messages:

```solidity
interface IDestinationContract {
    function portMessage(
        address sender,
        OnChainData memory data,
        string memory _startChain
    ) external;
}
```

* `sender` — origin-chain address that sent the message.  
* `data` — payload (addresses, integers, strings, bools; each array max length 5).  
* `_startChain` — origin chain name (e.g. `"Sepolia-ETH"`).

Restrict this so only the Diamond can call it (e.g. `msg.sender == diamondAddress`).

### 2. Subnet callback contract (subnet response)

On the **same** chain as the request, your contract must implement the subnet callback so the Diamond can deliver the subnet result:

```solidity
interface ISubnetReceiverContract {
    function subnetMessage(
        uint256 id,
        bool success,
        OnChainData calldata response,
        string calldata errorMessage
    ) external;
}
```

* `id` — request id from `outboundSubnetMessage`.  
* `success` — whether the subnet call succeeded.  
* `response` — subnet response as OnChainData.  
* `errorMessage` — error string if `success == false`.

Restrict so only the Diamond can call it.

### 3. Payload struct (shared)

Both flows use the same payload shape (e.g. in `OnChainData.sol`):

* `address[] addresses` (max 5)  
* `uint256[] integers` (max 5)  
* `string[] strings` (max 5)  
* `bool[] bools` (max 5)

Encode your message in these arrays when calling the Diamond; decode them in `portMessage` or `subnetMessage`.

---

## Connection idea: cross-chain

1. **Origin chain:** User has gas deposited on the **destination** chain. Your contract (or frontend) calls the Diamond:  
   `outboundMessage(sender, destination, data, endChain)`  
   Use the exact chain name for `endChain` (e.g. `"Avalanche-Fuji"`).

2. **Off-chain:** Validators see the event (e.g. `BridgeSwapOutData`), collect signatures, submit a tx on the destination chain.

3. **Destination chain:** Diamond calls `destination.portMessage(sender, data, startChain)`. Your logic runs there (update state, emit events, etc.).

---

## Connection idea: subnet inference

1. **Same chain:** User has gas deposited on that chain. Your contract (or frontend) calls the Diamond:  
   `outboundSubnetMessage(subnetId, endpoint, parameters, callbackContract)`  
   Optional: send ETH in the same tx to credit more gas.

2. **Off-chain:** Node calls the subnet API (e.g. Bitmind), gets a response.

3. **Same chain:** Node submits the response; Diamond calls `callbackContract.subnetMessage(id, success, response, errorMessage)`. Your logic runs there.

---

## Gas deposit (required for both)

The node spends gas on-chain; it is reimbursed from a **per-user balance** on the Diamond. Users must call `depositGas(amount)` with `msg.value == amount` on the **chain where the node will execute** (destination for cross-chain, same chain for subnet). Recommend at least ~0.01 ETH equivalent; your app can check the user’s balance on the Diamond and prompt a top-up.

---

## Quick reference

| Goal | Where | Action |
|------|--------|--------|
| Send cross-chain | Origin chain | User has gas on **destination**; call `outboundMessage(sender, destination, data, endChain)`. |
| Receive cross-chain | Destination chain | Implement `IDestinationContract.portMessage(sender, data, _startChain)`. Deploy on destination; restrict to Diamond. |
| Request subnet | One chain | User has gas on same chain; call `outboundSubnetMessage(subnetId, endpoint, parameters, callbackContract)`. |
| Handle subnet result | Same chain | Implement `ISubnetReceiverContract.subnetMessage(id, success, response, errorMessage)`. Restrict to Diamond. |
| Pay for node gas | Per chain | User calls `depositGas(amount)` with `msg.value == amount` on the chain where the node executes. |

---

## Where to find things

* **Diamond (Port) addresses:** [Telegraph Port Addresses](../contract-documentation/telegraph-port-addresses.md).  
* **Contract architecture (facets, events):** [Port Contract](../contract-documentation/port-contract.md).  
* **Literal examples (chunk-sized):** [EVM Chains](../examples-and-tutorials/evm-chains/README.md) — Gas Deposit, Cross-Chain Message Example, Subnet Inference Example.  
* **Repo:** Interfaces in `contracts/evm/interfaces/` (e.g. `IDestinationContract.sol`, `ISubnetReceiverContract.sol`, `OnChainData.sol`); example apps in test contracts (e.g. `BridgeReceiverTestApp`, `SubnetTestApp`). Test scripts: `bridge-test.sh`, `subnet-inference-test.sh`.
