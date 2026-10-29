---
description: How to read scope, proof, state, and reward terms on a Telegraph bounty.
---

# Reading a Bounty

Read an Issue as a contract for a specific public contribution, not as a general product request.

## The parts that matter

| Part | What to check |
|---|---|
| Title and description | The concrete gap and the intended outcome. |
| Acceptance criteria | What a maintainer must be able to reproduce before approval. |
| `Done when` | The remaining verified deliverables for the Issue to close. |
| `## Reward` | Whether payment is actually committed and, if funded, the precise terms. |
| Labels | State, priority, work type, and source of the work. |

## Labels

`status:open` means the Issue can be claimed. `status:claimed` and `status:review` can still have more than one contributor. `status:triage` is not ready for claims. `status:done` is a board record that the public criteria were completed; it is not a production readiness signal.

`work:*` describes the kind of contribution. `source:*` describes where the need came from. `opportunity:provider` identifies an established-service recruitment process, not a normal claimable development bounty.

## Before you claim

Confirm that you can provide the exact proof requested. Do not infer private requirements, rankings, customer demand, or protocol state from the Issue. If the scope is unclear, ask a question in the Issue before claiming it.
