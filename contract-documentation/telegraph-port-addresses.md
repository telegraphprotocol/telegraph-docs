---
description: Contract addresses for Telegraph Diamond (Port) contracts on each network.
---

# Telegraph Port Addresses

Below are the **Diamond (Port)** contract addresses used by the Telegraph network. Use these when integrating your dApps or when configuring a node (e.g. in `networks.config.json`).

**Last updated:** 21 June 2026

---

## Testnet (Latest working)

| Chain            | Name            | Chain ID | Diamond (Port) Address |
| ---------------- | --------------- | -------- | ---------------------- |
| Base Sepolia     | Base-Sepolia    | 84532    | `0x45b0A6e07E2e15D203f3B5285945c549221f5b0a` |
| Avalanche Fuji   | Avalanche-Fuji  | 43113    | `0xB966DC4C3f3Def1256fbaB76C132cab7723dfdC6` |

The Base Sepolia Diamond is a full redeployment with 18 facets including the new JobFacet (ERC-8183 job creation and auto-resolution), SettlementFacet (epoch-based miner payouts), and PricingFacet (demand-tier dynamic pricing).

**RPC endpoints (examples):**

* **Base Sepolia:**
  * HTTP: `https://base-sepolia.g.alchemy.com/v2/aKrIQPvnY5pM8AkdVNDM7`
  * WebSocket: `wss://base-sepolia.g.alchemy.com/v2/aKrIQPvnY5pM8AkdVNDM7`
* **Avalanche Fuji:**
  * HTTP: `https://avax-fuji.g.alchemy.com/v2/aKrIQPvnY5pM8AkdVNDM7`
  * WebSocket: `wss://avax-fuji.g.alchemy.com/v2/aKrIQPvnY5pM8AkdVNDM7`

### Token Addresses (Base Sepolia)

| Token | Address |
|-------|---------|
| **MACHINA** (miner payout) | `0xbAd88F9F77AdCF455d8a6aC08B2d1bA2b312f3e7` |
| **USDC** (agent payment) | `0xfFC3a7e0F71E9b48D8DBa86dc7d7B44aB24edD18` |
| **Uniswap V3 Router** | `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4` |

Use the **exact chain names** (e.g. `"Base-Sepolia"`, `"Avalanche-Fuji"`) when calling the Diamond for cross-chain routing or in your config.

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