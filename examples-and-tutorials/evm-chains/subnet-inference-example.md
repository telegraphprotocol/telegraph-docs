---
description: "Minimal example: send a subnet request via the Diamond and handle the response in a callback contract."
---

# Subnet Inference Example

This is a **chunk-sized** example for requesting subnet inference through the Telegraph Diamond (Port) and handling the result in your callback contract. For the full interface and flow, see [Dapp Examples — Interface & Implementation Guide](../../dapp-examples/README.md).

---

## Flow

1. **Same chain:** User has gas deposited on that chain. Call the Diamond’s `outboundSubnetMessage(subnetId, endpoint, parameters, callbackContract)`.
2. The node calls the subnet API off-chain and submits the result on the same chain.
3. The Diamond calls your **callback contract**’s `subnetMessage(id, success, response, errorMessage)`.

---

## 1. Payload struct (OnChainData)

Request parameters and response both use the shared struct (each array max length 5):

```solidity
struct OnChainData {
    address[] addresses;
    uint256[] integers;
    string[]  strings;
    bool[]    bools;
}
```

---

## 2. Sending a subnet request

Build the request parameters and call the Diamond. Use the correct `subnetId` and `endpoint` for the subnet (e.g. Bitmind image detection).

```solidity
// Diamond on this chain
address diamond = 0x45b0A6e07E2e15D203f3B5285945c549221f5b0a;

uint256 subnetId = 34;  // e.g. Bitmind
string memory endpoint = "/v1/bitmind/detect-image";  // 1–64 bytes

// Build parameters for the subnet (format depends on subnet API)
string[] memory str = new string[](1);
str[0] = "https://example.com/image.png";  // or base64, etc.

OnChainData memory params = OnChainData({
    addresses: new address[](0),
    integers: new uint256[](0),
    strings: str,
    bools: new bool[](0)
});

uint256 id = IDiamond(diamond).outboundSubnetMessage(
    subnetId,
    endpoint,
    params,
    callbackContract   // your contract that implements subnetMessage
);
// id — use to correlate with the callback
```

If the user sends ETH in the same tx, it is credited to their gas balance (capped). Otherwise they must have called `depositGas` earlier on this chain.

---

## 3. Receiving the response (callback contract)

Your contract on the **same** chain must implement the subnet callback. Restrict so only the Diamond can call it.

```solidity
interface ISubnetReceiverContract {
    function subnetMessage(
        uint256 id,
        bool success,
        OnChainData calldata response,
        string calldata errorMessage
    ) external;
}

contract MySubnetCallback is ISubnetReceiverContract {
    address public diamond;

    constructor(address _diamond) {
        diamond = _diamond;
    }

    function subnetMessage(
        uint256 id,
        bool success,
        OnChainData calldata response,
        string calldata errorMessage
    ) external override {
        require(msg.sender == diamond, "Only Diamond");
        if (success && response.strings.length > 0) {
            // e.g. confidence score in response.strings[0]
        } else {
            // handle errorMessage
        }
    }
}
```

* `id` — request id returned from `outboundSubnetMessage`.  
* `success` — whether the subnet call succeeded.  
* `response` — subnet result as OnChainData.  
* `errorMessage` — set when `success == false`.

---

## Summary

| Step | What to do |
|------|------------|
| 1 | User has gas on this chain (see [Gas Deposit](gas-deposit.md)). |
| 2 | Call `outboundSubnetMessage(subnetId, endpoint, parameters, callbackContract)` on the Diamond; save returned `id` if needed. |
| 3 | Deploy a contract that implements `subnetMessage(id, success, response, errorMessage)` and restrict to the Diamond. |

For a simpler flow that doesn't require a callback contract, see the [ERC-8183 Job Example](erc8183-job-example.md) — create a job, let the node auto-resolve it, and retrieve results from any Telegraph node.

For interfaces and repo references, see [Dapp Examples](../../dapp-examples/README.md).
