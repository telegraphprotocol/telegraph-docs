---
description: Live contract addresses on the Ethereum Sepolia testnet and the full protocol parameter table.
---

# Addresses & Parameters

## Testnet: Ethereum Sepolia (Chain ID 11155111)

These are the live contract addresses on Ethereum Sepolia as verified on-chain.

| Contract | Address |
|---|---|
| **Diamond (Port)** | `0x3624EB012B5E998BB57B6bE6C9Cfc9c4bc5eb99b` |
| **MACHINA Token** | `0xd68305cA83C7AF42A4F720144E7416fB53F8AaF4` |
| **USDC (test token)** | `0xcc194e1a843B658526D0D5C431f670028582Ae17` — anyone can mint it: `mint(address to, uint256 amount)` |
| **MACHINA/USDC pool** | `0x3AF68f69b9c9Cb36bAc5dac6a9e2899eeB03B0f7` — prices every MACHINA bond |
| **EmissionMinter** | `0x2bDfC23A1dBF414AcE9df5B7d17eA360A288e5D2` |
| **Treasury** | `0xC0A3FB6d3F1f4B54617d29ffbdA4663Af5F96e2e` |
| **x402 payment receiver (EVM)** | `0x3624EB012B5E998BB57B6bE6C9Cfc9c4bc5eb99b` — the Diamond itself |

> **Every call goes to the Diamond.** Escrow, jobs, miner and adapter registration, intents and rewards are all functions on the one Diamond address above. If a call reverts with an unknown selector, you are pointing at an old address.

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
| Chain | Ethereum Sepolia |
| Chain ID | 11155111 |
| Canonical mainnet | Ethereum |
| RPC (public, no key) | `https://ethereum-sepolia-rpc.publicnode.com` |
| RPC (Alchemy) | `https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>` |
| WSS (Alchemy) | `wss://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>` |

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

Each entry lists the intents the miner serves (for example `WEATHER_CHECK_TEMPERATURE`, `FX_NOW_EUR`, `CODE_REVIEW_GENERAL`). To see which miners serve one intent, and how they rank:

```bash
curl https://devnode.telegraphprotocol.com/engine/v1/intents/FX_NOW_EUR/miners
curl https://devnode.telegraphprotocol.com/leaderboard/miners
```

---

## Genesis Protocol Parameters

These parameters define the protocol's behaviour at launch. Governance-adjustable parameters can be changed by a 43/64 Validator majority after the active validator set reaches 43.

### Tokenomics

| Parameter | Value |
|---|---|
| Maximum MACHINA supply | 21,000,000 |
| Genesis daily emission | 7,200 MACHINA |
| Halving interval | 4 years (1,461 days) |
| Validator emission share | 25% |
| Evaluator emission share | 50% (of each intent's share: 30% to its adapter, 70% to its evaluation material) |
| Treasury emission share | 25% |
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
| Minimum Validator stake | Set in USD, paid in MACHINA at the pool price (`protocolParams()`) |
| Unbonding period | 21 days |
| Epoch duration | 24 hours on mainnet; 5 minutes on the testnet |
| Commit phase timeout | 45 seconds |
| Reveal phase timeout | 45 seconds |
| Leader failover timeout | 90 seconds |

### Scoring & Penalties

| Parameter | Value |
|---|---|
| Consensus deviation threshold (δ_c) | 0.15 scoring units |
| Scoring module replacement margin | Challenger's win rate ≥ Canonical's + 2 points, on the same hidden sample |
| Scoring module minimum win rate | 70% overall; 60% on each family child with ≥ 10 scored pairs |
| Minimum scored pairs per competition | 10 |
| Competition sample size | 30 hidden pairs per round |
| Evaluation Pool minimum contributors | 5 per Intent |
| Testing Cohort size | 10% of active Validators |
| Internal Audit Fee | 2% of epoch Validator emission pool |
| Spot check frequency | About once per Intent per hour on average (node default; a node operator can change it with `SPOT_CHECK_INTERVAL_SECONDS`) |
| Routing revocation trigger | Consecutive failed spot checks (no response or an empty answer) |
| Category A ejection (continuous offline) | 7 days unbroken |
| Category A ejection (rolling missed) | >50% of rounds in 7 days |
| Category B fraud slash | 20% of stake → Treasury (permanent ban) |
| Category C strike window | 5 strikes in 30 days → ejection |
| Front-running penalty | 7-epoch emission forfeiture + liveness ejection |

### Miner

| Parameter | Value |
|---|---|
| Registration bond | $1 for the first intent, $0.10 for each further intent up to 9, then $0.07 each — paid in MACHINA at the pool price (`minerBondParams()`) |
| Grace period duration | 7 days |
| Grace period routing share | 5% flat (shared among all grace-period miners) |
| Miner routing (genesis) | 70% top / 20% second / 10% third |
| Deregistration | Immediate; the bond is released and can be withdrawn after 2 days (`withdrawMinerBond()`) |
| Evaluator adapter registration bond | $5 in MACHINA at the pool price (`entityBonds()`); returned in full on deregistration, never slashed |
| Intent proposal bond | $1 in MACHINA (`intentProposalParams()`); returned when the proposal is approved or rejected |

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

### Jobs

| Parameter | Value |
|---|---|
| Job base price | 1 USDC (`getJobBasePrice()`), times the demand multiplier |
| Protocol fee | 2% of the job price |
| Callback gas | 1,000,000 gas for your callback contract |
| Cancel | After 1 hour, if no answer arrived (`cancelJob`); the price minus the fee is refunded |

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
- Zero pre-mine guarantee
