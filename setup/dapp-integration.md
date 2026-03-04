---
description: >-
  Integrate dApps and smart contracts with Telegraph's Diamond (Port) for
  cross-chain messaging and subnet inference.
---

# Dapp Integration

This guide is for **dApp and smart contract developers** who want to integrate with Telegraph’s Diamond (Port) contracts for **cross-chain messaging** and **subnet inference**.

## Overview

Telegraph runs validator nodes that listen to Diamond contracts on multiple chains. Your contracts interact with the **Diamond (Port)** on each chain:

- **Cross-chain:** Call `outboundMessage` on the origin chain; the node relays the payload; on the destination chain the Diamond calls your **destination contract**’s `portMessage`.
- **Subnet inference:** Call `outboundSubnetMessage` on one chain; the node calls the subnet API and submits the result on-chain; your **callback contract**’s `subnetMessage` is invoked with the response.

In both flows, **gas for the node’s execution** is paid from a balance you deposit on the Diamond via `depositGas`. No TAO or other tokens are required in the current release.

---

## 1. Get Diamond addresses and chain names

- **Diamond (Port) address** per chain: from your deployment or from the team’s `networks.config.json` (e.g. testnet: Sepolia, Fuji).
- **Chain names** must match the config (e.g. `"Sepolia-ETH"`, `"Avalanche-Fuji"`). Use these exact strings when calling the Diamond (e.g. for `outboundMessage(..., endChain)` or when the node routes by name).

---

## 2. Gas deposit (required for both flows)

The node executes transactions on-chain (inbound message or subnet response). Gas is reimbursed from a **per-user balance** on the Diamond. Users must deposit native token (ETH/AVAX etc.) before sending messages.

### depositGas(amount)

- **Contract:** Diamond (Port) on the **destination** chain (for cross-chain) or the **same** chain (for subnet).
- **User:** Sends a transaction with `msg.value == amount` and calls `depositGas(amount)`.
- **Effect:** `userGasBalances[msg.sender] += amount`. The node later gets reimbursed from this balance when it submits the inbound tx or subnet response.

```solidity
// Example: user deposits 0.01 ETH for gas reimbursement on this chain
diamond.depositGas{ value: 0.01 ether }(0.01 ether);
```

- **Recommendation:** Ensure the user has at least ~0.01 ETH (or equivalent) deposited on the relevant chain before calling `outboundMessage` or `outboundSubnetMessage`. Your frontend or contract can check `userGasBalances(user)` and prompt the user to top up if needed.

---

## 3. Cross-chain messaging

### Flow

1. **Origin chain:** User (or your contract) calls the Diamond’s `outboundMessage(sender, destination, data, endChain)`.
2. **Off-chain:** Telegraph validators see the event, collect signatures, and submit a transaction on the **destination** chain.
3. **Destination chain:** Diamond calls `destination.portMessage(sender, data, startChain)`.

The **sender** is the origin-chain address that sent the message; **destination** is the contract on the destination chain that will receive it; **data** is a struct; **endChain** is the destination chain name (e.g. `"Avalanche-Fuji"`).

### Outbound: outboundMessage

```solidity
function outboundMessage(
    address sender,
    address destination,
    OnChainData calldata data,
    string calldata endChain
) external;
```

- **sender** – Address that is the logical sender (e.g. `msg.sender` or your app’s wallet). Used for gas balance on destination and passed to `portMessage`.
- **destination** – Contract on the **destination** chain that implements `IDestinationContract` (see below).
- **data** – Payload (see OnChainData).
- **endChain** – Exact destination chain name from config (e.g. `"Avalanche-Fuji"`).

No fee or deposit on the origin chain in the current release. User must have deposited gas on the **destination** chain so the node can be reimbursed when it executes the inbound message there.

### Destination contract: portMessage

Your contract on the **destination** chain must implement:

```solidity
interface IDestinationContract {
    function portMessage(
        address sender,
        OnChainData memory data,
        string memory _startChain
    ) external;
}
```

- **sender** – The origin-chain sender address from `outboundMessage`.
- **data** – The payload you sent.
- **_startChain** – Origin chain name (e.g. `"Sepolia-ETH"`).

Implement this interface and do whatever your dApp needs (update state, emit events, etc.). Only the Diamond should call it; in production you may add access control (e.g. only the Diamond).

### OnChainData

Payload is passed as a struct:

```solidity
struct OnChainData {
    address[] addresses;  // max length 5
    uint256[] integers;   // max length 5
    string[]  strings;    // max length 5
    bool[]    bools;      // max length 5
}
```

All arrays are limited to length 5 in the Diamond. Encode your message in these arrays (e.g. use `strings[0]` for a main message and verify it in your tests).

---

## 4. Subnet inference (same-chain)

### Flow

1. **User** deposits gas on the Diamond (same chain).
2. **User** calls `outboundSubnetMessage(subnetId, endpoint, parameters, callbackContract)` (optionally sending ETH in the same tx to credit gas).
3. **Off-chain:** Node calls the subnet API (e.g. Bitmind) and gets a response.
4. **Same chain:** Node submits the response; Diamond calls `callbackContract.subnetMessage(id, success, response, errorMessage)`.

### Outbound: outboundSubnetMessage

```solidity
function outboundSubnetMessage(
    uint256 subnetId,
    string calldata endpoint,
    OnChainData calldata parameters,
    address callbackContract
) external payable returns (uint256 id);
```

- **subnetId** – Subnet identifier (e.g. 34 for Bitmind).
- **endpoint** – API path (e.g. `"/v1/bitmind/detect-image"`). Must be 1–64 bytes.
- **parameters** – Input payload for the subnet (OnChainData).
- **callbackContract** – Your contract that implements `ISubnetReceiverContract` (see below). It will be called with the request id and the response.

If `msg.value > 0`, that amount is credited to `userGasBalances[msg.sender]` (capped) so the user can fund gas in the same tx. Otherwise they must have called `depositGas` earlier.

Returns the request **id** (for correlation with the callback).

### Callback contract: subnetMessage

Your contract on the **same** chain must implement:

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

- **id** – Request id from `outboundSubnetMessage`.
- **success** – Whether the subnet call succeeded.
- **response** – Subnet response as OnChainData (e.g. confidence score in `response.strings[0]` for Bitmind).
- **errorMessage** – Error string if `success == false`.

Only the Diamond should call this; add access control if needed.

---

## 5. Summary for your contracts

| Goal              | Where         | Action |
|-------------------|---------------|--------|
| Cross-chain send  | Origin chain  | User has gas on **destination**; call `outboundMessage(sender, destination, data, endChain)`. |
| Cross-chain receive | Dest chain | Implement `IDestinationContract.portMessage(sender, data, _startChain)`. Deploy this contract on the destination chain. |
| Subnet request    | One chain     | User has gas on same chain; call `outboundSubnetMessage(subnetId, endpoint, parameters, callbackContract)`. |
| Subnet response  | Same chain    | Implement `ISubnetReceiverContract.subnetMessage(id, success, response, errorMessage)`. Deploy this contract on the same chain. |
| Gas for node     | Per chain     | User calls `depositGas(amount)` with `msg.value == amount` on the chain where the node will execute (destination for bridge, same chain for subnet). |

---

## 6. Reference: interfaces and struct

- **OnChainData:** `address[] addresses`, `uint256[] integers`, `string[] strings`, `bool[] bools` (max 5 each).
- **IDestinationContract:** `portMessage(address sender, OnChainData data, string _startChain)`.
- **ISubnetReceiverContract:** `subnetMessage(uint256 id, bool success, OnChainData response, string errorMessage)`.

Contract sources in this repo: `contracts/evm/interfaces/IDestinationContract.sol`, `contracts/evm/interfaces/ISubnetReceiverContract.sol`, `contracts/evm/interfaces/OnChainData.sol`. Example implementations: `contracts/evm/test/BridgeReceiverTestApp.sol` (cross-chain), `contracts/evm/test/SubnetTestApp.sol` (subnet).

---

## 7. Testnets and test scripts

- Deploy Diamonds to testnets with `./deploy-testnet.sh` (or use addresses from the team).
- Use `./tests/bridge-test.sh` and `./tests/subnet-inference-test.sh` to see end-to-end flows (choose Testnet and the correct networks). They use the same Diamond APIs and callback interfaces described above.
