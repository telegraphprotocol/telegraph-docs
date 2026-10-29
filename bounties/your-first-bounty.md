---
description: A practical first pass through the public Telegraph bounty board.
---

# Your First Bounty

## 1. Choose an open Issue

Open the [bounty board](https://github.com/telegraphprotocol/bounties/issues) and choose an Issue labelled `status:open`. `priority:p0`, `priority:p1`, `help wanted`, and `good first bounty` are useful filters.

Read the full Issue before claiming it. In particular, understand the requested outcome, the evidence the maintainer must reproduce, the `Done when` checklist, and the `## Reward` section.

## 2. Claim only work you can deliver

Comment:

```text
/claim
```

The board records your claim. More than one contributor may work on an Issue, so do not assume a claim gives you exclusive ownership.

## 3. Build against the acceptance criteria

The Issue’s acceptance criteria matter more than its title. Keep private inputs, credentials, hidden evaluation cases, customer data, and exploit details out of public comments and pull requests.

For a provider or evaluator, give reproducible evidence that it serves or evaluates the requested Intent. For an app or integration, demonstrate the requested end-to-end behavior.

## 4. Keep the claim active

Post a meaningful update at least every 72 hours:

```text
/progress The endpoint is live; I am adding the requested reference checks and reproduction steps.
```

The board warns about inactive claims and eventually releases only that contributor’s claim. It does not affect other contributors.

## 5. Submit evidence

When the work is ready, comment:

```text
/submit https://github.com/you/project — concise evidence and steps to reproduce
```

The Issue moves to review. A maintainer who neither claimed nor submitted the work verifies it. They either approve it or request specific changes.

## 6. Know what approval means

Approval means the submitted work met that Issue’s public acceptance criteria. It does not, by itself, make an Intent routable, a provider eligible, an evaluator canonical, or a payment due. Those are decided by the relevant production and protocol systems.

If you are unsure what evidence an Issue needs, ask in that Issue before building.
