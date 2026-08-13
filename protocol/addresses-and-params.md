---
description: Live contract addresses on Base Sepolia testnet and the full genesis parameter table.
---

# Addresses & Parameters

## Testnet: Base Sepolia (Chain ID 84532)

These are the live contract addresses on Base Sepolia as verified on-chain.

| Contract | Address |
|---|---|
| **Diamond (Port)** | `0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8` |
| **MACHINA Token** | `0x7b9Bd0e5f9a4D0A01db18823De1D8442C84993b7` |
| **USDC (Circle)** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| **Treasury** | `0xffe89e1f0a77C600Ad938b57180E5be3e3119f40` |
| **x402 payment receiver (EVM)** | `0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8` — the Diamond itself |
| **x402 payment receiver (Solana)** | `G53EbeTZSNsAn7bj6iMFUQnq3zpDdEbHhKkPRywo8bix` |

> The Diamond is where x402 payments land. You don't need to hardcode it: every
> `402` response carries the address to pay in `accepts[].payTo`, and that is
> the value your client should use.

Every address above is readable from the Diamond itself, which is the source of truth if this table ever drifts:

```bash
cast call $DIAMOND "usdcToken()(address)"    --rpc-url $RPC   # escrow, jobs and settlement token
cast call $DIAMOND "machinaToken()(address)" --rpc-url $RPC   # what miners are actually paid in
cast call $DIAMOND "getTreasury()(address)"  --rpc-url $RPC
```

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
| **HTTP API** | `https://devnode.telegraphprotocol.com` |
| **WebSocket** | `wss://devnode.telegraphprotocol.com/engine/ws` |
| **x402 Facilitator** | `https://facilitator.payai.network` |

Engine and Daemon are the same node, reached via `/engine` and `/daemon` path prefixes on the HTTP API base above (e.g. `https://devnode.telegraphprotocol.com/engine/v1/ask`) — not separate services.

### Active Miners (Testnet)

The live miner set changes as operators register and deregister on-chain, so there is no useful static list here. Read the current catalogue — with each miner's ID, endpoints, schemas, declared intents and floor price:

```bash
curl https://devnode.telegraphprotocol.com/api/miners
```

A few long-standing ones, as a sample of what the network serves:

| Miner | Intents |
|---|---|
| LiteLLM | CHAT_COMPLETION, LANGUAGE_GENERATION, TASK_COMPLETION, AGENT_TASK, WEB_SEARCH |
| Telegraph Chatbot | CHAT_COMPLETION, LANGUAGE_GENERATION, TASK_COMPLETION, AGENT_TASK, WEB_SEARCH, TELEGRAPH_KNOWLEDGE |
| Zeus (Bittensor SN18) | WEATHER_CHECK, WEATHER_FORECAST, STORM_ALERT |
| BitMind (Bittensor SN34) | DEEPFAKE_DETECTION, IMAGE_VERIFICATION, VIDEO_VERIFICATION, MEDIA_AUTHENTICITY_CHECK |

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
| Registration cost | Gas only — no bond or stake |
| Grace period duration | 7 days |
| Grace period routing share | 5% flat (shared among all grace-period miners) |
| Miner routing (genesis) | 70% top / 20% second / 10% third |
| Deregistration | Immediate — no unbonding period |
| Scoring module registration | Gas only — no bond |

### Demand Multiplier Tiers

| 24h Request Volume | Multiplier |
|---|---|
| 0 – 999 | 1.0× |
| 1,000 – 9,999 | 1.5× |
| 10,000 – 99,999 | 2.5× |
| 100,000 – 999,999 | 5.0× |
| 1,000,000+ | 10.0× |

For **x402 pay-per-call inference**, the charged price is `min_price_usdc × multiplier`, where the multiplier is selected from the rolling 24-hour request volume for that Intent. A miner's effective price rises automatically with demand and returns to the floor when demand subsides.

**ERC-8183 jobs are priced differently.** A job does not use the miner's `min_price_usdc` at all — it uses a single protocol-wide `jobBasePrice`, scaled by the same multiplier table. Read it with `cast call $DIAMOND "getJobBasePrice()(uint256)"`; on testnet it is currently `1000000` (1 USDC per job).

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
