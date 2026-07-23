# Telegraph Documentation

This is the source repository for [docs.telegraphprotocol.com](https://docs.telegraphprotocol.com) — the user-facing documentation site for the Telegraph protocol. Built with Next.js and powered by GitBook.

## Structure

| Directory | Content |
|---|---|
| `protocol/` | How the protocol works — tokenomics, roles, addresses |
| `using/` | How to use Telegraph — x402 inference, engine API, WebSocket signals, ERC-8183 jobs |
| `miners/` | How to become a miner — YAML config, registration |
| `validators/` | How to run a validator — key management, node setup |
| `_archive/` | Legacy documentation (historical reference) |
| `troubleshooting.md` | Common issues and solutions |
| `deployment.md` | Step-by-step node deployment |

## Contributing

Edit markdown files and open a PR. The site auto-publishes via GitBook sync.

Documentation should be self-contained — engineers and users should be able to understand, build, and troubleshoot without external dependencies.

## Related Repositories

| Repo | Purpose |
|---|---|
| [telegraphprotocol/Telegraph](https://github.com/telegraphprotocol/Telegraph) | Protocol node source code |
| [telegraphprotocol/Telegraph-api-docs](https://github.com/telegraphprotocol/Telegraph-api-docs) | OpenAPI specs + API reference |
| [telegraphprotocol/Telegraph-MCP](https://github.com/telegraphprotocol/Telegraph-MCP) | MCP server for AI agents |
| [telegraphprotocol/telegraph-chatbot](https://github.com/telegraphprotocol/telegraph-chatbot) | Knowledge assistant miner |
