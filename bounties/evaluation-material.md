---
description: How evaluation-material work is scoped safely on the public bounty board.
---

# Evaluation Material

Evaluation work improves how Telegraph measures answers. It may involve independently supported reference material, coverage evidence, an evaluator adapter, or an evaluation process—not a public dump of hidden test cases.

## Start with the Issue

Use an open `work:evaluator` Issue or report an evidenced gap through the board’s issue forms. The Issue defines the public category, the permitted scope, the acceptance evidence, and the authorized submission channel.

Do not publish exact hidden qualification prompts, expected answers, evaluation distributions, private node diagnostics, customer inputs, or source credentials in a public Issue, comment, or pull request.

## Useful contribution evidence

Depending on the Issue, useful evidence can include:

- independent public sources and their provenance;
- a reproducible process for collecting or verifying reference material;
- documented coverage of the requested category;
- an evaluator implementation and its public test evidence; or
- a working integration that the maintainer can reproduce.

Synthetic examples and passing local checks alone do not establish semantic correctness. Follow the Issue’s stated acceptance criteria and use the private reviewer path when the work includes sensitive material.

## What happens next

GitHub records the public contribution and its review. The protocol separately decides whether material is admitted, whether an evaluator is canonical, and whether a provider is eligible for ranking. A bounty approval is not a shortcut around those controls.

For the public workflow, see [How a Bounty Works](how-a-bounty-works.md). For evaluator artifacts, see [Build an Evaluator Adapter](../scoring/build-a-scoring-module.md).
