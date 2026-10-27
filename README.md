# Telegraph Documentation

This is the source repository for [docs.telegraphprotocol.com](https://docs.telegraphprotocol.com) — the user-facing documentation site for the Telegraph protocol. Built with Next.js and powered by GitBook.

## Structure

| Directory | Content |
|---|---|
| `protocol/` | How the protocol works — tokenomics, roles, addresses |
| `using/` | How to use Telegraph — path chooser, x402 inference, engine API, WebSocket signals, ERC-8183 jobs |
| `miners/` | How to become a miner — YAML config, validation API, registration |
| `scoring/` | How to build and register a WASM scoring module, and contribute evaluation data |
| `bounties/` | The public bounty board — how bounties work, kinds of work, Season II, rewards, reporting gaps |

## Contributing

Edit markdown files and open a PR. The site auto-publishes via GitBook sync.

Documentation should be self-contained — engineers and users should be able to understand, build, and troubleshoot without external dependencies.

## Related Repositories

| Repo | Purpose |
|---|---|
| [telegraphprotocol/Telegraph](https://github.com/telegraphprotocol/Telegraph) | Protocol node source code (private — request access) |
| [telegraphprotocol/Telegraph-api-docs](https://github.com/telegraphprotocol/Telegraph-api-docs) | OpenAPI specs + API reference |
| [telegraphprotocol/Telegraph-MCP](https://github.com/telegraphprotocol/Telegraph-MCP) | MCP server for AI agents |
| [telegraphprotocol/bounties](https://github.com/telegraphprotocol/bounties) | Public bounty board, Intent catalogue and mission map |
