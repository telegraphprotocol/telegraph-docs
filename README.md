# Telegraph Documentation

This is the source repository for [docs.telegraphprotocol.com](https://docs.telegraphprotocol.com) — the user-facing documentation for the Telegraph protocol. This repo holds only the content; it is published at `/docs` on the Anjoman site.

## Structure

| Directory | Content |
|---|---|
| `protocol/` | How the protocol works — tokenomics, roles, addresses |
| `using/` | How to discover, request, pay for, and receive Telegraph intelligence |
| `miners/` | How to become a miner — YAML config, validation API, registration |
| `scoring/` | How to build and register a WASM scoring module, and contribute evaluation data |
| `bounties/` | Bounties, for everyone: a step-by-step first bounty, adding evaluation material, building a judge, using an AI assistant, commands, rules and rewards |

## Contributing

Edit markdown files and open a PR. Merging to `main` publishes the change to the Anjoman site automatically.

A page is published only if it is listed in `SUMMARY.md`. Link between pages with relative `.md` links, for example `[x](../using/intents.md)`.

Documentation should be self-contained — engineers and users should be able to understand, build, and troubleshoot without external dependencies.

## Related Repositories

| Repo | Purpose |
|---|---|
| [telegraphprotocol/Telegraph](https://github.com/telegraphprotocol/Telegraph) | Protocol node source code (private — request access) |
| [telegraphprotocol/Telegraph-api-docs](https://github.com/telegraphprotocol/Telegraph-api-docs) | OpenAPI specs + API reference |
| [telegraphprotocol/Telegraph-MCP](https://github.com/telegraphprotocol/Telegraph-MCP) | MCP server for AI agents |
| [telegraphprotocol/bounties](https://github.com/telegraphprotocol/bounties) | Public bounty board, Intent catalogue and mission map |
