---
description: "Minimal example: send a cross-chain message via the Diamond and receive it in a destination contract."
---

# Cross-Chain Message Example

This is a **chunk-sized** example for sending and receiving a cross-chain message through the Telegraph Diamond (Port). For the full interface and flow description, see [Dapp Examples — Interface & Implementation Guide](../../dapp-examples/README.md).

---

## Flow

1. **Origin chain:** Call the Diamond’s `outboundMessage(sender, destination, data, endChain)`. User must have deposited gas on the **destination** chain.
2. Validators relay the message; on the **destination** chain the Diamond calls your contract’s `portMessage(sender, data, startChain)`.

---

## 1. Payload struct (OnChainData)

Messages use a shared struct; each array is max length 5:

```solidity
struct OnChainData {
    address[] addresses;
    uint256[] integers;
    string[]  strings;
    bool[]    bools;
}
```

---

## 2. Sending (origin chain)

Build the payload and call the Diamond. Use the **exact** destination chain name (e.g. `"Avalanche-Fuji"`).

```solidity
// Diamond on origin chain
address diamond = 0x95DAB2159770d2877493Bd13A25BBf2701e989fE; // e.g. Sepolia

address[] memory addrs;
uint256[] memory ints;
string[] memory str;
bool[] memory b;

str = new string[](1);
str[0] = "Hello from Sepolia";

OnChainData memory data = OnChainData({
    addresses: addrs,
    integers: ints,
    strings: str,
    bools: b
});

// destination = your contract on the destination chain
IDiamond(diamond).outboundMessage(
    msg.sender,           // sender
    destinationContract,  // address on destination chain
    data,
    "Avalanche-Fuji"      // endChain — must match config
);
```

Ensure the user has deposited gas on the **destination** chain before calling. No fee on the origin chain in the current design.

---

## 3. Receiving (destination chain)

Your contract on the **destination** chain must implement the destination interface. Restrict so only the Diamond can call it.

```solidity
interface IDestinationContract {
    function portMessage(
        address sender,
        OnChainData memory data,
        string memory _startChain
    ) external;
}

contract MyReceiver is IDestinationContract {
    address public diamond;

    constructor(address _diamond) {
        diamond = _diamond;
    }

    function portMessage(
        address sender,
        OnChainData memory data,
        string memory _startChain
    ) external override {
        require(msg.sender == diamond, "Only Diamond");
        // e.g. use data.strings[0], data.addresses, etc.
        if (data.strings.length > 0) {
            // handle data.strings[0]...
        }
    }
}
```

* `sender` — origin-chain address that sent the message.  
* `data` — same struct you sent.  
* `_startChain` — origin chain name (e.g. `"Sepolia-ETH"`).

---

## Summary

| Side | What to do |
|------|------------|
| Origin | User has gas on **destination**; call `outboundMessage(sender, destination, data, endChain)` on the Diamond. |
| Destination | Deploy a contract that implements `portMessage(sender, data, _startChain)` and restrict to the Diamond. |

For interfaces and repo references, see [Dapp Examples](../../dapp-examples/README.md). For gas deposit, see [Gas Deposit](gas-deposit.md).
