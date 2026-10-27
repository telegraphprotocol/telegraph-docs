---
description: What validators do, how they earn, the penalty system, and what it takes to join the active set.
---

# What Validators Do

Validators are the backbone of the Telegraph protocol's trust guarantees. They don't supply intelligence (miners do that). They don't buy intelligence (agents do that). Validators exist to ensure the intelligence delivered is the real answer, not a fabricated one, and that the money for it moves correctly.

Every validator runs the same evaluation pipeline for every active Intent. They sign the resulting state, and that signed state decides which miners get traffic and what everyone is owed. The whole system (routing, earnings, reputation) depends on validators doing this honestly.

## The Validator's Job

For each epoch, a validator node:

1. **Scores miners.** It runs the family's canonical WASM scoring module on each miner's answers: a comparator against the epoch's truth-source reference for a deterministic Intent, a model-based evaluator adapter for a judgment Intent, or both for a hybrid one. See [How answers are scored](../using/intents.md#the-three-kinds). Every validator scores against the same frozen evaluation-pool snapshot.
2. **Builds the epoch block.** The block commits the scores, the leaderboard, every billed delivery and the entitlements owed to miners, validators and evaluators, and it chains the hash of the previous block.
3. **Signs it.** Validators sign the block with a **BLS12-381** key. The signatures aggregate into one, and a quorum of the active set (`floor(2n/3) + 1`) must sign. The signed message commits to the chain, the protocol version, the validator set, the state sequence and the state root, so a signature counts for exactly one state transition.
4. **Submits it on-chain.** The Diamond verifies the aggregate signature in one operation and accepts the state root.
5. **Resolves jobs.** For every on-chain [job](../using/erc8183-jobs.md), the quorum signs either the resolution (binding the exact answer) or a failure (binding the reason). The node builds the message itself and signs only if the chain's own view of the message matches, so it never signs bytes an RPC handed it.
6. **Runs spot checks and the keeper.** Spot checks run on average about once per hour for each Intent, at randomised times. The keeper makes the node's recurring on-chain calls (entitlement roots, x402 credits and similar).

> **What is live today.** The network currently runs a single bootstrap validator, so the quorum is one signature. The on-chain registry, aggregate BLS verification, the frozen active set and the quorum rule are all in the contracts and tested, but a multi-validator round (several validators scoring and signing together) has not been switched on. Statements below about "the active set" describe how the contracts work when it is.

## How Validators Earn

Validators earn **60% of daily MACHINA emissions**, split equally among all active validators in the set. At genesis parameters:

- 7,200 MACHINA/day × 60% = 4,320 MACHINA/day shared among active validators.
- With 64 active validators: ~67.5 MACHINA per validator per day.
- This halves every 4 years alongside total emissions.

Validators also receive a gas reimbursement from the Treasury for each on-chain submission. They never bear the cost of the epoch settlement transaction.

Validators do not share in agent payments (that's for miners). This keeps scoring incentives clean.

## Joining the Active Set

Registration is on-chain, through the `ValidatorRegistryFacet`, and it needs:

1. **Stake.** Enough MACHINA to rank in the top 64.
2. **A BLS12-381 key** with a proof of possession. The repository includes a generator (`go run ./scripts/mainnet/blskey`).
3. **An operator (node) key** that signs your transactions. On mainnet it lives in Clef.

```bash
cast send $DIAMOND "registerValidatorProfile(address,bytes,bytes,uint256)" \
  <operator-key-address> <bls-pubkey> <proof-of-possession> <stake-in-wei> \
  --rpc-url $RPC --private-key <MANAGER_KEY>
```

See [Node Setup](validator-setup.md#step-6-register-as-a-validator).

**Registration is closed by default.** It is owner-only until the owner opens it with `setValidatorRegistrationOpen(true)`. It must stay closed while a single validator runs the network: anyone else added to the active set raises the quorum above what one validator signs alone and would halt settlement. A mainnet node refuses to start while registration is open.

The **active set** is the top 64 validators by stake. It is picked at each accepted epoch and frozen until the next one, so the bits of the `signerBitmap` in a submission always refer to a fixed list. A seat whose validator left reads as empty and no other bit moves. If the registration list fills (256), a new validator whose stake beats the lowest-staked inactive one evicts it, and its stake is refunded.

### Leaving

`initiateUnbond()` starts a 21 day unbonding period (never allowed for the last active validator). `withdraw()` takes the stake once the period has passed, and only after the next accepted epoch has removed you from the frozen set (`still in the active set until the next recompute`). An exiting validator keeps signing until its seat is gone. If the set cannot reach quorum because a validator unbonded and stopped signing, the owner can run `recomputeActiveSet()`; the owner picks no member, because the set follows stake.

### Managing your validator profile

- `setValidatorDescription(...)` sets your public details: moniker, `domain` (your node's public API as `host:port`, which other nodes probe to check you are alive), libp2p address, website, security contact and details. Change it any time with the manager key; the node syncs it from the chain.
- `rotateOperatorKey(newKey)` replaces your hot operator key without unbonding.
- `proposeManager(newKey)` then `acceptManager(oldKey)` hands the manager role to another key in two steps. The profile, stake and seat move with it.

## The Penalty System

Validators are subject to three categories of penalties. These describe the protocol's design; the slashing rules for multi-validator rounds activate with them.

### Category A — Liveness Failure

**Trigger:** More than 7 consecutive days unbroken offline, OR missing more than 50% of assigned rounds in any rolling 7-day window.

**Penalty:** No emissions are earned for missed rounds. The validator begins a 21-day unbonding period and is removed from the active set.

**Stake:** Not slashed. Liveness failures do not burn stake. Only emissions are forfeited.

### Category B — Ground Truth Fabrication

**Trigger:** A validator submits fabricated ground truth or a miner response that fails proof verification.

**Penalty:**
- 20% of the validator's staked MACHINA is permanently slashed to the Protocol Treasury.
- The validator's profile is permanently revoked.
- Both the Manager Key and Operator Key are banned at the protocol level permanently.

### Category C — Consensus Deviation

**Trigger:** A validator's Local Score deviates from the finalized Canonical Score by more than 0.15.

**Penalty:** Forfeiture of that round's emission allocation. One strike is recorded.

**Ejection:** 5 strikes within any rolling 30-day window leads to forced removal from the active set plus a 21-day unbonding. Re-entry is permitted after correcting the issue (usually a misconfigured scoring module).

## Delegated Staking

Validators can attract delegated stake from MACHINA holders who don't run nodes. Delegated stake counts toward the validator's total for ranking purposes. Validators set their commission rate, the share of emissions they keep.

More delegated stake means a higher ranking, staying in the top 64, and continued emissions.

## Next Steps

- **[Key Management](key-management.md)**: the keys a validator holds and how to protect them.
- **[Node Setup](validator-setup.md)**: step-by-step guide to running a Telegraph node.
