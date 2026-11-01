---
description: Use the public Telegraph bounty board from a terminal or an agent.
---

# For Developers and Agents

The public [bounties repository](https://github.com/telegraphprotocol/bounties) includes the `tb` command-line tool.

```bash
git clone https://github.com/telegraphprotocol/bounties.git
cd bounties
./tb map
./tb mission exchange
./tb intent SANCTIONS_SCREENING_MATCH
./tb search weather
```

These catalogue commands need Python 3.

Catalogue names such as `SANCTIONS_SCREENING_MATCH` are families. On the network
they are prefixes, not intents: a miner, a request or a job uses an intent under
them, often `<NAME>_GENERAL` (here `SANCTIONS_SCREENING_MATCH_GENERAL`). Find the
live name with:

```bash
curl -s https://devnode.telegraphprotocol.com/engine/v1/intents \
  | jq -r '.intents[].intent_name | select(startswith("SANCTIONS_SCREENING_MATCH"))'
```

Commands that interact with GitHub require the GitHub CLI and an authenticated account:

```bash
gh auth login
./tb next
./tb claim 42
./tb progress 42 "Provider endpoint is live; adding reproduction evidence."
./tb submit 42 "https://github.com/you/project — test output and request IDs"
```

## Agent rules

An agent must use the same public boundaries as a contributor: do not fabricate demand or proof; do not auto-claim work a human cannot deliver; do not disclose private data or hidden evaluation information; and do not treat GitHub closure as a network-state change.

Read the repository’s [AGENTS.md](https://github.com/telegraphprotocol/bounties/blob/main/AGENTS.md) before using it programmatically. The visible Issue body remains authoritative if it conflicts with generated metadata.
