---
description: Deposit gas on the Diamond (Port) so the node can be reimbursed when relaying messages or submitting subnet responses.
---

# Gas Deposit

Before users send cross-chain messages or subnet requests, they must **deposit gas** on the Telegraph Diamond (Port) on the chain where the node will execute. The node is reimbursed from this per-user balance.

---

## When to deposit

* **Cross-chain:** Deposit on the **destination** chain (the chain where the inbound message will be executed).
* **Subnet:** Deposit on the **same** chain where you call `outboundSubnetMessage` (the node submits the response on that chain).

Use the Diamond address for that chain from [Telegraph Port Addresses](../../contract-documentation/telegraph-port-addresses.md).

---

## 1. Interface (GasFacet on the Diamond)

You call the same Diamond address; the Gas facet handles deposits. Example interface:

```solidity
interface IGasFacet {
    function depositGas(uint256 amount) external payable;
    function userGasBalances(address user) external view returns (uint256);
}
```

* `depositGas(amount)` — User sends a tx with `msg.value == amount`; that amount is added to `userGasBalances[msg.sender]`.
* `userGasBalances(user)` — Read the user’s current balance (e.g. to show in UI or require a minimum before sending).

---

## 2. Deposit (user flow)

User sends native token and calls `depositGas`:

```solidity
// Example: deposit 0.01 ETH for gas reimbursement on this chain
diamond.depositGas{ value: 0.01 ether }(0.01 ether);
```

Recommend at least ~0.01 ETH (or chain equivalent) on the relevant chain before calling `outboundMessage` or `outboundSubnetMessage`.

---

## 3. Check balance (frontend or contract)

Before sending a message, check the user has enough gas balance:

```solidity
uint256 balance = diamond.userGasBalances(msg.sender);
require(balance >= 0.01 ether, "Top up gas on Diamond first");
// then call outboundMessage or outboundSubnetMessage
```

Or in a UI: read `userGasBalances(userAddress)` and prompt the user to deposit if below your threshold.

---

## Summary

| Step | Action |
|------|--------|
| 1 | User calls `depositGas(amount)` on the Diamond with `msg.value == amount` on the chain where the node will execute. |
| 2 | Optionally, read `userGasBalances(user)` to enforce a minimum or show balance in the UI. |

See [Dapp Examples — Interface & Implementation Guide](../../dapp-examples/README.md) for how gas fits into cross-chain and subnet flows.
