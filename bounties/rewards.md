---
description: How bounty rewards work — funded versus unfunded Issues, the fields a funded reward must state, the claim-time reward record, cross-asset payouts and what a reward does not change.
---

# Rewards

Every bounty states whether it is funded. **At launch, every bounty is
unfunded.**

| Label | Meaning |
|---|---|
| `reward:unfunded` | No payment commitment. |
| `reward:funded` | A reward is committed, with full terms in the Issue. |
| `reward:paid` | The reward has been paid. |

An unfunded bounty is still real work with clear acceptance criteria. It
carries no promise of payment.

## What a funded bounty must state

The terms are written in the Issue's `## Reward` section **before** anyone can
claim it.

| Field | Meaning |
|---|---|
| `amount` | The number. |
| `denomination` | The unit the value is stated in, for example `USD`. |
| `payout_asset` | The asset actually paid, for example `USDC` or `MACHINA`. |
| `conversion_rule` | Required when the denomination and payout asset differ. Says exactly how the paid amount is calculated. |
| `max_awards` | Always `1` per Issue. |
| `eligibility` | Who can take part. |
| `verification_condition` | What must be reproduced before payment. |
| `payout_window` | When payment is expected after approval. |
| `payout_proof` | Added after payment, where appropriate. |

The bounty repository's checks reject a funded bounty that is missing a
conversion rule.

## Your terms are recorded when you claim

When `/claim` succeeds, the bot posts a receipt containing a visible copy and a
SHA-256 hash of the Issue's `## Reward` section. That records the terms you
accepted, even if the Issue is edited later.

If reward terms need to change, the maintainer releases the claim and updates
the Issue, and you decide whether to claim again under the new terms.

The receipt is an audit record, not proof of funding. Payment also needs a
separate funding approval, and the person approving the work must be someone
other than the claimant and submitter.

## Paying in a different asset

When the stated value and the paid asset differ, the Issue must say how to
convert:

- `500 USD` paid in `USDC`: the exact USD/USDC convention used at payout.
- `500 USD` paid in `MACHINA`: the price source, the observation time or window, the rounding rule and any fallback.

A bounty that says "$500" promises a MACHINA amount only if it names MACHINA as
the payout asset and gives the conversion rule.

## What a reward does not change

- Bounty rewards are separate from the protocol's economics. Agents still pay
  for intelligence in USDC, and miners still earn from demand (see
  [What Miners Do](../miners/miner-overview.md)).
- GitHub activity never creates protocol emissions. Evaluator emissions are a
  separate protocol mechanism tied to evaluator eligibility and real paid demand.
- Provider opportunities (`opportunity:provider`) carry no bounty payment.
  Commercial terms are handled outside GitHub.
- The bounty repository's security policy is a disclosure policy, not a standing
  bug bounty. A security report earns a reward only when Telegraph gives
  explicit terms for it.
