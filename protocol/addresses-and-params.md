---
description: Live contract addresses on Base Sepolia testnet and the full genesis parameter table.
---

# Addresses & Parameters

## Testnet: Base Sepolia (Chain ID 84532)

These are the live contract addresses on Base Sepolia as verified on-chain.

| Contract | Address |
|---|---|
| **Diamond (Port)** | `0x45b0A6e07E2e15D203f3B5285945c549221f5b0a` |
| **MACHINA Token** | `0xbAd88F9F77AdCF455d8a6aC08B2d1bA2b312f3e7` |
| **USDC (for x402 payments)** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| **Treasury** | `0xB82E4DE09f1C43BBD9ca4907c01f1EEd65a521B9` |
| **x402 Payment Receiver** | `0x43Eb1B49a079a4587E0D7e8dA81035dc791c91F8` |

> **Note on USDC:** Two USDC-compatible tokens exist on Base Sepolia. The x402 payment gate uses `0x036CbD5...` (the canonical Base Sepolia bridged USDC). The Diamond's internal escrow references `0xfFC3a7e0...` (a test token). Use `0x036CbD5...` when paying for inference via x402.

### Network Configuration

| Parameter | Value |
|---|---|
| Chain | Base Sepolia |
| Chain ID | 84532 |
| Canonical mainnet | Base (Ethereum L2) |
| RPC (Alchemy) | `https://base-sepolia.g.alchemy.com/v2/<YOUR_KEY>` |
| WSS (Alchemy) | `wss://base-sepolia.g.alchemy.com/v2/<YOUR_KEY>` |

### Node Endpoints (Live Testnet Node)

| Service | URL |
|---|---|
| **Miner Dispatcher** | `http://13.237.89.59:7044/miner-dispatcher/` |
| **Engine** | `http://13.237.89.59:7044/engine/` |
| **Daemon API** | `http://13.237.89.59:7044/daemon/` |
| **WebSocket** | `ws://13.237.89.59:7044/engine/ws` |
| **x402 Facilitator** | `https://facilitator.payai.network` |

---

## Genesis Protocol Parameters

These parameters define the protocol's behaviour at launch. Governance-adjustable parameters can be changed by a 43/64 Validator majority after the active validator set reaches 43.

### Tokenomics

| Parameter | Value |
|---|---|
| Maximum MACHINA supply | 21,000,000 |
| Genesis daily emission | 7,200 MACHINA |
| Halving interval | 4 years (1,461 epochs) |
| Validator emission share | 60% |
| Script Author emission share | 20% |
| Treasury emission share | 20% |
| Protocol fee | 2% (200 basis points) |
| TWAP settlement minimum | 100 USDC |
| TWAP drip size | 0.01 USDC per drip |
| TWAP drip jitter | ±30 seconds |
| Minimum signal floor price | 0.01 USDC (10,000 in 6-decimal) |

### Validator & Consensus

| Parameter | Value |
|---|---|
| Active Validator cap | 64 |
| BFT finalization threshold (τ) | 43 / 64 |
| Reduced consensus threshold (τ_reduced) | 33 / 64 (activates after 3 failed rounds) |
| Minimum Validator stake bond | 100 MACHINA |
| Unbonding period | 21 days |
| Epoch duration | 24 hours |
| Commit phase timeout | 45 seconds |
| Reveal phase timeout | 45 seconds |
| Leader failover timeout | 90 seconds |

### Scoring & Penalties

| Parameter | Value |
|---|---|
| Consensus deviation threshold (δ_c) | 0.15 scoring units |
| Catch-rate promotion threshold (δ_promote) | 0.10 |
| Minimum test epochs for script promotion | 3 epochs |
| Testing Cohort size | 10% of active Validators |
| Internal Audit Fee | 2% of epoch Validator emission pool |
| Spot check frequency | ~every 20 seconds (Base L2 ~2s blocks) |
| Routing revocation trigger | Score drop >20% vs. last leaderboard |
| Category A ejection (continuous offline) | 7 days unbroken |
| Category A ejection (rolling missed) | >50% of rounds in 7 days |
| Category B fraud slash | 20% of stake → Treasury (permanent ban) |
| Category C strike window | 5 strikes in 30 days → ejection |
| Front-running penalty | 7-epoch emission forfeiture + liveness ejection |

### Miner

| Parameter | Value |
|---|---|
| Minimum stake bond | 100 MACHINA per registration |
| Grace period duration | 7 days |
| Grace period routing share | 5% flat (shared among all grace-period miners) |
| Miner routing (genesis) | 70% top / 20% second / 10% third |
| Unbonding on deregistration | 7 days |
| Intent WASM bond | 10,000 MACHINA |

### Demand Multiplier Tiers

| 24h Request Volume | Multiplier |
|---|---|
| 0 – 999 | 1.0× |
| 1,000 – 9,999 | 1.5× |
| 10,000 – 99,999 | 2.5× |
| 100,000 – 999,999 | 5.0× |
| 1,000,000+ | 10.0× |

> Demand tiers are not yet configured on testnet. All requests currently price at 1.0× the miner's floor price.

### Gas & Escrow

| Parameter | Value |
|---|---|
| Gas escrow multiplier (floor) | 2.0× estimated gas |
| Gas escrow multiplier (ceiling) | 5.0× |
| Escrow withdrawal timelock | 4 hours |
| WebSocket minimum escrow | 1.00 USDC |
| Discovery Tier participation minimum | 95% of assigned rounds |

---

## Governance

Governance activates once the active Validator set reaches **43 Validators**.

Proposals require a **43/64 majority** (one vote per Validator regardless of stake size). Most parameters have a **14-day timelock** after passing; structural changes (Validator cap, epoch duration, BFT threshold) have a **30-day timelock**.

**Emergency veto**: 54/64 signatures cancel any proposal immediately. A vetoed proposal cannot be resubmitted for 90 days.

**Permanently immutable (cannot be changed by governance):**
- Maximum supply: 21,000,000 MACHINA
- Halving schedule
- Emission tier percentages (60/20/20)
- Zero pre-mine guarantee
