---
description: What validators do, how they earn, the penalty system, and what it takes to join the active set.
---

# What Validators Do

Validators are the backbone of the Telegraph protocol's trust guarantees. They don't supply intelligence — miners do that. They don't buy intelligence — agents do that. Validators exist to ensure the intelligence delivered is the real answer, not a fabricated one.

Every validator runs the same evaluation pipeline against every miner response for every active Intent. They reach consensus on a final score. That score determines which miners get traffic. The whole system — routing, earnings, reputation — depends on validators doing this honestly.

## The Validator's Job

For each active Intent in each epoch, validators:

1. **Verify ground truth** — receive the Leader's zkTLS-proven scrape of the canonical data source and independently confirm the proof is valid.
2. **Execute the Canonical Script** — run the WASM evaluation program against the ground truth and the miner's response to produce a Local Score (0 to 1).
3. **Commit** — broadcast a cryptographic commitment (hash of score + nonce) to prevent copying.
4. **Reveal** — after the commit phase closes, reveal the plaintext score and nonce.
5. **Reach consensus** — the stake-weighted median of all revealed scores becomes the Canonical Score.

This repeats continuously throughout each epoch. Spot checks run approximately every 20 seconds (triggered deterministically by Base L2 block hashes), meaning validators are active around the clock, not just at epoch boundaries.

## How Validators Earn

Validators earn **60% of daily MACHINA emissions**, split equally among all active validators in the set. At genesis parameters:

- 7,200 MACHINA/day × 60% = 4,320 MACHINA/day shared among active validators.
- With 64 active validators: ~67.5 MACHINA per validator per day.
- This halves every 4 years alongside total emissions.

Validators also receive a gas reimbursement from the Treasury for each on-chain submission — they never bear the cost of the epoch settlement transaction.

Validators do not share in agent payments (that's for miners). This separation keeps scoring incentives clean.

## Joining the Active Set

The active validator set is the top-64 validators by total staked MACHINA. To join:

1. Stake enough MACHINA to rank in the top-64.
2. Register your validator node using `SignerFacet.addSigner()`.
3. Run the Telegraph node binary continuously.

There is currently **one validator (the genesis node)** on testnet. BFT consensus (which requires 43/64 validators) is not operational on testnet — it will activate as more validators join on mainnet. The current testnet deployment is a single-signer genesis setup used for testing all other protocol mechanics.

Validators who fall out of the top-64 ranking (due to others staking more) are removed from the active set and begin a 21-day unbonding period.

## The Penalty System

Validators are subject to three categories of penalties:

### Category A — Liveness Failure

**Trigger:** More than 7 consecutive days unbroken offline, OR missing more than 50% of assigned rounds in any rolling 7-day window.

**Penalty:** No emissions are earned for missed rounds — they are redistributed to participating validators. The validator begins a 21-day unbonding period and is removed from the active set.

**Stake:** Not slashed. Liveness failures do not burn stake — only emissions are forfeited.

### Category B — Ground Truth Fabrication

**Trigger:** The Leader submits a payload with fabricated Ground Truth or a Miner Response that fails zkTLS proof verification.

**Penalty:**
- 20% of the validator's staked MACHINA is permanently slashed to the Protocol Treasury.
- The validator's profile is permanently revoked.
- Both the Manager Key and Operator Key are banned at the protocol level permanently.

This is the most severe penalty. zkTLS ensures fabrication is provably detectable.

### Category C — Consensus Deviation

**Trigger:** A validator's Local Score deviates from the finalized Canonical Score by more than 0.15 (the δ_c threshold).

**Penalty:** Forfeiture of that round's emission allocation (redistributed to within-consensus validators). One strike is recorded.

**Ejection:** 5 strikes within any rolling 30-day window → forced removal from the active set + 21-day unbonding. Re-entry is permitted after correcting the issue (usually a misconfigured Canonical Script).

## The Testing Cohort

10% of the active validator set is deterministically selected each epoch to run as a Testing Cohort. Cohort members must execute a challenger WASM script alongside the Canonical Script. This is mandatory — refusing is treated as a missed round.

Cohort members earn a small bonus: 2% of the epoch's validator emission pool is split equally among them as an Internal Audit Fee, compensating for the additional work.

## Delegated Staking

Validators can attract delegated stake from MACHINA holders who don't run nodes. Delegated stake counts toward the validator's total for ranking purposes. Validators set their commission rate — the share of emissions they keep — and delegators claim their proportional share by pulling from the Port Contract.

More delegated stake = higher ranking = staying in the top-64 = continued emissions. Running a reputable, high-uptime validator naturally attracts delegation.

## Next Steps

- **[Key Management](key-management.md)** — how to set up your Manager and Operator keys correctly.
- **[Node Setup](validator-setup.md)** — step-by-step guide to running a Telegraph node.
