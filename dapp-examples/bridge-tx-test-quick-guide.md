---
description: "One-page guide to run a Fuji to Sepolia bridge test using BridgeSender, BridgeReceiver, and Telegraph Diamonds."
---

# Bridge TX Test – Quick Guide

One-page guide to run a **Fuji → Sepolia** bridge test using the deployed BridgeSender, BridgeReceiver, and Telegraph Diamonds.

---

## Contract addresses

| Role | Chain | Address |
|------|--------|---------|
| **Diamond (Port)** | Avalanche Fuji | `0xFB06c12A6FB8f057D6cbEA5817A3D2C0649040A2` |
| **Diamond (Port)** | Sepolia | `0x95DAB2159770d2877493Bd13A25BBf2701e989fE` |
| **BridgeSender** | Fuji | [0xcf82c14780A440D39181FF726FcEC02A1cEeFDA2](https://testnet.snowscan.xyz/address/0xcf82c14780A440D39181FF726FcEC02A1cEeFDA2#code) |
| **BridgeReceiver** | Sepolia | `0x168efee2310EA1D83B5B0DfdDedC7dEa1c0D94D3` |

---

## Flow (Fuji → Sepolia)

1. **Deposit gas on Sepolia** (on the BridgeReceiver / Diamond) so the node can deliver the message.
2. **Send from Fuji** via BridgeSender (Fuji Diamond + Receiver address + message + end chain).
3. **Check result on Sepolia** on the BridgeReceiver contract.

---

## Step 1 – Deposit gas on destination (Sepolia)

**Where:** BridgeReceiver on Sepolia  
**Contract:** `0x168efee2310EA1D83B5B0DfdDedC7dEa1c0D94D3`  
**Explorer:** [Sepolia Etherscan](https://sepolia.etherscan.io/address/0x168efee2310EA1D83B5B0DfdDedC7dEa1c0D94D3#writeProxyContract)

1. Open the Receiver on Sepolia in the block explorer (or Remix with "At Address").
2. Go to **Write** / **Contract** tab.
3. Call **`depositGasOnDiamond`**:
   * **diamond (address):** `0x95DAB2159770d2877493Bd13A25BBf2701e989fE` (Sepolia Diamond)
   * **payableAmount:** e.g. `0.01` ether (or 10000000000000000 wei)
4. Send the transaction (wallet must have Sepolia ETH).

**Remix:** Connect to Sepolia → use "At Address" with the Receiver address → call `depositGasOnDiamond(Sepolia Diamond)` and send value (e.g. 0.01 ether).

---

## Step 2 – Send bridge message (Fuji)

**Where:** BridgeSender on Fuji  
**Contract:** `0xcf82c14780A440D39181FF726FcEC02A1cEeFDA2`  
**Explorer:** [Snowscan (Fuji)](https://testnet.snowscan.xyz/address/0xcf82c14780A440D39181FF726FcEC02A1cEeFDA2#code)

1. Open the Sender on Fuji in the block explorer or Remix.
2. Call **`send`** with:
   * **diamond:** `0xFB06c12A6FB8f057D6cbEA5817A3D2C0649040A2` (Fuji Diamond)
   * **destination:** `0x168efee2310EA1D83B5B0DfdDedC7dEa1c0D94D3` (BridgeReceiver on Sepolia)
   * **message:** e.g. `HiFromTelegraph`
   * **endChain:** `Sepolia-ETH` (exact string)
3. No value needed; submit the transaction (wallet needs Fuji AVAX for gas).

**Remix:** Connect to Fuji → "At Address" with Sender address → `send(diamond, destination, message, endChain)`.

| Parameter | Value |
|-----------|--------|
| **diamond** | `0xFB06c12A6FB8f057D6cbEA5817A3D2C0649040A2` |
| **destination** | `0x168efee2310EA1D83B5B0DfdDedC7dEa1c0D94D3` |
| **message** | `HiFromTelegraph` |
| **endChain** | `Sepolia-ETH` |

---

## Step 3 – Check result on Sepolia

After the node relays (usually within ~30–60 seconds):

**Where:** BridgeReceiver on Sepolia: `0x168efee2310EA1D83B5B0DfdDedC7dEa1c0D94D3`

**Read (Explorer "Read" or Remix):**

* **`getLastString0()`** – should return your message (e.g. `HiFromTelegraph`).
* **`lastSender()`** – address that sent (often same as destination in this setup).
* **`lastStartChain()`** – origin chain name (e.g. `Avalanche-Fuji`).
* **`callCount()`** – number of messages received (increments per delivery).

**Remix:** Connect to Sepolia → "At Address" with Receiver → call `getLastString0()`, `lastStartChain()`, `callCount()`.

---

## Summary – functions used

| Contract | Chain | Function | Purpose |
|----------|--------|----------|--------|
| **BridgeReceiver** | Sepolia | `depositGasOnDiamond(diamond)` **payable** | Deposit gas on Sepolia Diamond so the node can execute delivery. |
| **BridgeSender** | Fuji | `send(diamond, destination, message, endChain)` | Send a message to the Receiver on `endChain`. |
| **BridgeReceiver** | Sepolia | `getLastString0()`, `lastSender()`, `lastStartChain()`, `callCount()` | Verify delivered message and metadata. |

**Chains:** End chain name must be exact: **`Sepolia-ETH`** (from Fuji) or **`Avalanche-Fuji`** (from Sepolia).  
**Order:** Do Step 1 (deposit on Sepolia) before Step 2 (send from Fuji) so the Receiver has gas balance when the node delivers.
