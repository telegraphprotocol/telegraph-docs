---
description: Safe, useful ways to use an AI assistant while working on a public Telegraph bounty.
---

# Working With an AI Assistant

An AI assistant can help you understand an Issue, plan a reproducible implementation, format a submission, or explain an error. It cannot supply the evidence, make a private decision, or replace independent verification.

## Give it the real scope

Paste the visible Issue body and the relevant public documentation. Ask the assistant to identify the acceptance criteria, required evidence, and open questions. Treat it as a drafting aid: verify technical claims against the code, docs, and Issue before acting on them.

## Keep these out of the chat

- private keys, passwords, recovery phrases, or credentials;
- customer prompts, documents, budgets, or identifying data;
- hidden evaluation inputs or answers;
- private node diagnostics, ranking data, or security weaknesses.

## A useful prompt

```text
Read this Telegraph bounty and the public build guide. List the acceptance criteria,
the evidence a maintainer must reproduce, and any missing information that I should ask
about in the Issue. Do not invent requirements or claim the work is complete.

<paste the visible Issue and public guide here>
```

Before submitting, make sure the proof is real, reproducible, and matches the Issue—not merely plausible-looking output from an AI.
