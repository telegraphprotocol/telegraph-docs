---
description: Contract addresses for Telegraph Diamond (Port) contracts on each network.
---

# Telegraph Port Addresses

Below are the **Diamond (Port)** contract addresses used by the Telegraph network. Use these when integrating your dApps or when configuring a node (e.g. in `networks.config.json`).

**Last updated:** 3 March 2026

---

## Testnet (Latest working)

| Chain            | Name            | Chain ID | Diamond (Port) Address |
| ---------------- | --------------- | -------- | ---------------------- |
| Sepolia          | Sepolia-ETH     | 11155111 | `0x95DAB2159770d2877493Bd13A25BBf2701e989fE` |
| Avalanche Fuji   | Avalanche-Fuji  | 43113    | `0xFB06c12A6FB8f057D6cbEA5817A3D2C0649040A2` |

**RPC endpoints (examples):**

* **Sepolia-ETH:**  
  * HTTP: `https://ethereum-sepolia-rpc.publicnode.com`  
  * WebSocket: `wss://ethereum-sepolia-rpc.publicnode.com`
* **Avalanche-Fuji:**  
  * HTTP: `https://avalanche-fuji-c-chain-rpc.publicnode.com`  
  * WebSocket: `wss://avalanche-fuji-c-chain-rpc.publicnode.com`

Use the **exact chain names** (e.g. `"Sepolia-ETH"`, `"Avalanche-Fuji"`) when calling the Diamond for cross-chain routing or in your config.

---

## Mainnet (Depreciated)

| Chain   | Address |
| ------- | ------- |
| ETH     | `0x8d738e14bab94b5542aa646094d96aa5ab5c1979` |
| BSC     | `0x379746e648EE070B699c183807029D30F90968Ce` |
| Polygon | `0xABB75aA467dCB34b8F12D567fB9d79567822f8c2` |
| Avalanche | `0x1de43239114Ba810646fCa10b7E9FbfDcB78e754` |

Mainnet addresses may change with new deployments; confirm with the team or your deployment config before use.

---