---
description: Connect any MCP-compatible AI agent to Telegraph for decentralized inference with automatic x402 micropayments — no blockchain code required.
---

# Telegraph MCP Server

The Telegraph MCP Server is a local Node.js process that exposes the full Telegraph inference network as [Model Context Protocol](https://modelcontextprotocol.io) tools. Any agent runtime that speaks MCP — Claude Desktop, Cursor, ElizaOS, LangChain, OpenClaw, Goose, VS Code / Continue — gains access to Telegraph's miners, the Daemon signal feed, and on-demand Engine inference without writing a single line of payment or blockchain code.

**x402 payments are handled entirely inside the MCP server process.** The agent calls a tool, the server pays, the agent gets the result.

**Repository:** `https://github.com/telegraphprotocol/Telegraph-MCP`

---

## Architecture

```
Your Agent (Claude / Cursor / ElizaOS / LangChain / etc.)
    │
    │  MCP protocol — JSON-RPC over stdio
    │
┌───▼────────────────────────────────────────────────────┐
│  Telegraph MCP Server  (runs on your machine)           │
│                                                         │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │ Node tools │  │Engine tools│  │  Daemon tools    │  │
│  │ /          │  │ /engine    │  │  /daemon         │  │
│  └────────────┘  └────────────┘  └──────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Dynamic miner tools (auto-discovered, x402)    │   │
│  │  Zeus 18 · ItsAI 32 · BitMind 34 · OpenAI 102  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  x402 payment layer (transparent):                      │
│    request → 402 → sign EIP-3009 → retry → result       │
└─────────────────────────────────────────────────────────┘
    │
    │  HTTP + x402 micropayments
    │
Telegraph Node — one host, path-prefixed (testnet: devnode.telegraphprotocol.com)
```

Node, Engine, and Daemon are not separate services — they're one Telegraph process on one port, reached through different path prefixes (`/`, `/engine`, `/daemon`). The three env vars below exist because the MCP server's own code reads them independently, but on testnet they all point at the same host.

---

## Setup

### 1. Install and build

```bash
git clone https://github.com/telegraphprotocol/Telegraph-MCP
cd Telegraph-MCP
npm install && npm run build
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` — at minimum, set your EVM private key:

```bash
# ── Telegraph Node URLs ─────────────────────────────────
TELEGRAPH_NODE_URL=https://devnode.telegraphprotocol.com
TELEGRAPH_ENGINE_URL=https://devnode.telegraphprotocol.com/engine
TELEGRAPH_DAEMON_URL=https://devnode.telegraphprotocol.com/daemon

# ── Payment Key (Required) ──────────────────────────────
TELEGRAPH_EVM_PRIVATE_KEY=0x_your_private_key_here

# ── Optional: Solana payments ───────────────────────────
# TELEGRAPH_SOLANA_PRIVATE_KEY=your_base58_key
```

**Use a burner wallet funded with only the USDC needed for inference.** Each inference call costs ~$0.01.

### 3. Run

```bash
npm start
# or use the convenience script:
./start-mcp.sh
```

For development with hot reload:

```bash
npm run dev
```

To inspect tools with the MCP Inspector:

```bash
npm run inspect
# or: npx @modelcontextprotocol/inspector dist/index.js
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAPH_NODE_URL` | Yes | `https://devnode.telegraphprotocol.com` | Telegraph node base URL — used bare (e.g. `/status`, `/api/miners`) |
| `TELEGRAPH_ENGINE_URL` | Yes | `https://devnode.telegraphprotocol.com/engine` | Same node, `/engine` prefix — used bare after this (e.g. `/v1/ask`) |
| `TELEGRAPH_DAEMON_URL` | Yes | `https://devnode.telegraphprotocol.com/daemon` | Same node, `/daemon` prefix — used bare after this (e.g. `/health`) |
| `TELEGRAPH_EVM_PRIVATE_KEY` | Yes* | — | EVM private key (`0x`-prefixed hex) |
| `TELEGRAPH_SOLANA_PRIVATE_KEY` | No* | — | Solana private key (base58) |
| `EVM_NETWORK` | No | `eip155:*` | CAIP-2 network for EVM payments |
| `SVM_NETWORK` | No | `solana:*` | CAIP-2 network for SVM payments |
| `REFRESH_INTERVAL_MS` | No | `300000` | Dynamic miner-tool refresh interval. `0` to disable. |

*At least one private key must be set.

---

## Available Tools

### Node Tools — no payment required

| Tool | Endpoint | Description |
|---|---|---|
| `tg_node_status` | `GET /status` | Node identity — returns the node's `publicKey` |
| `tg_node_list_subnets` | `GET /api/miners` | Full miner catalog: IDs, schemas, endpoints, signal mappings, and each miner's `activation_status` |

### Engine Tools

| Tool | Payment | Description |
|---|---|---|
| `tg_engine_list_subnets` | Free | List the miners the Engine can route to |
| `tg_engine_ask` | x402 ~$0.01 | Auto-routed inference — Engine LLM selects the best miner for your query |
| `tg_engine_ask_subnet` | x402 ~$0.01 | Direct inference through a specific miner by ID |

`tg_engine_ask` accepts a single `query` string. The Engine's internal LLM router classifies it and routes to the most appropriate miner automatically.

`tg_engine_ask_subnet` accepts `subnet_id`, `method`, `endpoint`, and `payload` — use `tg_engine_list_subnets` to discover valid miner IDs and endpoint shapes. (The `subnet` in these tool and parameter names is legacy naming for a miner.)

### Daemon Tools — no payment required

| Tool | Description |
|---|---|
| `tg_daemon_health` | Daemon health check — returns status and server time |
| `tg_daemon_categories` | Signal categories with question counts and average interest scores |
| `tg_daemon_questions` | Query the Daemon's stored signal results with filters |

`tg_daemon_questions` supports these optional filters:

| Parameter | Type | Description |
|---|---|---|
| `category` | string | Filter by category (e.g., `CRYPTO`, `PHARMA`, `TECHNOLOGY`) |
| `source` | string | Filter by data source (e.g., `reddit`, `polymarket`, `gdelt`) |
| `sort` | `recent` \| `interest` \| `affected` \| `audience` | Sort order (default: `recent`) |
| `since_hours` | number | Only results from the last N hours |
| `min_interest` | number | Minimum interest score |
| `limit` | number | Max results (default: 10) |
| `offset` | number | Pagination offset |

### Dynamic Miner Tools — auto-discovered, x402 payment

These tools are not hardcoded. On startup and every 5 minutes, the MCP server fetches the live integration registry from the Telegraph node, diffs against registered tools, and adds or removes tools as miners change on-chain. Connected clients receive a `notifications/tools/list_changed` notification automatically.

One tool is generated per miner endpoint, so the live set is far larger than the examples below — every miner in the catalogue with at least one endpoint contributes.

**The naming rule.** A tool name is `tg_<miner>_<endpoint>`, built like this:

1. Take the miner's `slug` and drop a leading `bittensor-sn<number>-` if present — `bittensor-sn18-zeus` becomes `zeus`.
2. Take the endpoint `path` and drop its leading `/`.
3. In both, replace `/` and `-` with `_`, collapse any run of underscores, and lowercase.
4. Join them: `tg_` + miner + `_` + endpoint.

So `coingecko` + `/price` is `tg_coingecko_price`, and `bittensor-sn34-bitmind` + `/detect-image` is `tg_bitmind_detect_image`. Applying the rule to any entry in `GET /api/miners` tells you the tool name before you connect.

| Miner | Auto-generated tools |
|---|---|
| **Zeus (18)** — Weather forecasting | `tg_zeus_predict` |
| **ItsAI (32)** — AI text detection | `tg_itsai_detect` |
| **BitMind (34)** — Deepfake detection | `tg_bitmind_detect_image`, `tg_bitmind_detect_video`, `tg_bitmind_preprocess_video`, `tg_bitmind_get_video_upload_url` |
| **Gemini (109)** — Chat | `tg_gemini_chat` |
| **CoinGecko (207)** — Crypto prices | `tg_coingecko_price` |

Each tool's description carries the miner's name, the HTTP method and path, its signal mapping, and its subnet ID, so you can confirm you have the right one from the tool list itself.

The live set changes on-chain — newly registered miners appear as tools within 5 minutes, with no MCP server restart, and miners that deregister have their tools removed. Which miners exist at any moment comes from the discovery endpoint, not from this page.

---

## How x402 Payments Work

When an agent calls a paid tool:

1. The MCP server sends the request to the Telegraph Engine.
2. The Engine returns HTTP 402 with payment requirements in response headers.
3. `@x402/fetch` intercepts the 402, signs an EIP-3009 `TransferWithAuthorization` using your configured private key, attaches the signature as a `PAYMENT` header, and retries automatically.
4. The Engine verifies payment via the PayAI facilitator and returns the result.

The agent and LLM never see the payment flow, the private key, or any blockchain transaction. From the agent's perspective, the tool call returns a result.

Failed calls are not charged.

---

## Integration Guides

All integrations use the same configuration block — only the file location and format differ per client.

The base config values for testnet:

```
TELEGRAPH_NODE_URL   = https://devnode.telegraphprotocol.com
TELEGRAPH_ENGINE_URL = https://devnode.telegraphprotocol.com/engine
TELEGRAPH_DAEMON_URL = https://devnode.telegraphprotocol.com/daemon
TELEGRAPH_EVM_PRIVATE_KEY = 0xyour_key_here
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "telegraph": {
      "command": "node",
      "args": ["/path/to/Telegraph-MCP/dist/index.js"],
      "env": {
        "TELEGRAPH_NODE_URL": "https://devnode.telegraphprotocol.com",
        "TELEGRAPH_ENGINE_URL": "https://devnode.telegraphprotocol.com/engine",
        "TELEGRAPH_DAEMON_URL": "https://devnode.telegraphprotocol.com/daemon",
        "TELEGRAPH_EVM_PRIVATE_KEY": "0xyour_key_here"
      }
    }
  }
}
```

Restart Claude Desktop. Telegraph tools appear in the tool list. Try: *"What's the weather in Lahore?"*

### Cursor

Settings → MCP → Add new MCP server → paste the same JSON block above.

### ElizaOS

In your character file or MCP plugin config:

```json
{
  "mcp": {
    "telegraph": {
      "command": "node",
      "args": ["/path/to/Telegraph-MCP/dist/index.js"],
      "env": {
        "TELEGRAPH_NODE_URL": "https://devnode.telegraphprotocol.com",
        "TELEGRAPH_ENGINE_URL": "https://devnode.telegraphprotocol.com/engine",
        "TELEGRAPH_DAEMON_URL": "https://devnode.telegraphprotocol.com/daemon",
        "TELEGRAPH_EVM_PRIVATE_KEY": "0xyour_key_here"
      }
    }
  }
}
```

Enable the MCP plugin in your character's plugin list:

```json
{
  "plugins": ["@elizaos/plugin-mcp"]
}
```

ElizaOS v0.25+ supports MCP via `@elizaos/plugin-mcp`. A full working example agent is in [examples/elizaos-telegraph](https://github.com/telegraphprotocol/Telegraph-MCP/tree/main/examples/elizaos-telegraph).

### LangChain / LangGraph (Python)

```bash
pip install langchain-mcp-adapters
```

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "telegraph": {
        "transport": "stdio",
        "command": "node",
        "args": ["/path/to/Telegraph-MCP/dist/index.js"],
        "env": {
            "TELEGRAPH_NODE_URL": "https://devnode.telegraphprotocol.com",
            "TELEGRAPH_ENGINE_URL": "https://devnode.telegraphprotocol.com/engine",
            "TELEGRAPH_DAEMON_URL": "https://devnode.telegraphprotocol.com/daemon",
            "TELEGRAPH_EVM_PRIVATE_KEY": "0xyour_key_here",
        },
    }
})

tools = await client.get_tools()
```

Full Python example in [examples/langchain](https://github.com/telegraphprotocol/Telegraph-MCP/tree/main/examples/langchain).

### LangChain / LangGraph (TypeScript)

```bash
npm install @langchain/mcp-adapters
```

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const client = new MultiServerMCPClient({
  telegraph: {
    command: "node",
    args: ["/path/to/Telegraph-MCP/dist/index.js"],
    env: {
      TELEGRAPH_NODE_URL: "https://devnode.telegraphprotocol.com",
      TELEGRAPH_ENGINE_URL: "https://devnode.telegraphprotocol.com/engine",
      TELEGRAPH_DAEMON_URL: "https://devnode.telegraphprotocol.com/daemon",
      TELEGRAPH_EVM_PRIVATE_KEY: "0xyour_key_here",
    },
    transport: "stdio",
  },
});

const tools = await client.getTools();
```

### OpenClaw

Add to `openclaw.config.json`:

```json
{
  "mcpServers": {
    "telegraph": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/Telegraph-MCP/dist/index.js"],
      "env": {
        "TELEGRAPH_NODE_URL": "https://devnode.telegraphprotocol.com",
        "TELEGRAPH_ENGINE_URL": "https://devnode.telegraphprotocol.com/engine",
        "TELEGRAPH_DAEMON_URL": "https://devnode.telegraphprotocol.com/daemon",
        "TELEGRAPH_EVM_PRIVATE_KEY": "0xyour_key_here"
      }
    }
  }
}
```

### Goose

Add to `~/.config/goose/config.yaml`:

```yaml
extensions:
  telegraph:
    type: mcp
    command: node
    args:
      - /path/to/Telegraph-MCP/dist/index.js
    env:
      TELEGRAPH_NODE_URL: https://devnode.telegraphprotocol.com
      TELEGRAPH_ENGINE_URL: https://devnode.telegraphprotocol.com/engine
      TELEGRAPH_DAEMON_URL: https://devnode.telegraphprotocol.com/daemon
      TELEGRAPH_EVM_PRIVATE_KEY: 0xyour_key_here
```

### VS Code / Continue

In Continue's `config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "node",
          "args": ["/path/to/Telegraph-MCP/dist/index.js"],
          "env": {
            "TELEGRAPH_NODE_URL": "https://devnode.telegraphprotocol.com",
            "TELEGRAPH_ENGINE_URL": "https://devnode.telegraphprotocol.com/engine",
            "TELEGRAPH_DAEMON_URL": "https://devnode.telegraphprotocol.com/daemon",
            "TELEGRAPH_EVM_PRIVATE_KEY": "0xyour_key_here"
          }
        }
      }
    ]
  }
}
```

### Any MCP Client

The server uses **MCP stdio transport** — the standard for local MCP servers. Any client that supports MCP over stdio works:

```json
{
  "mcpServers": {
    "telegraph": {
      "command": "node",
      "args": ["/path/to/Telegraph-MCP/dist/index.js"],
      "env": {
        "TELEGRAPH_NODE_URL": "https://devnode.telegraphprotocol.com",
        "TELEGRAPH_ENGINE_URL": "https://devnode.telegraphprotocol.com/engine",
        "TELEGRAPH_DAEMON_URL": "https://devnode.telegraphprotocol.com/daemon",
        "TELEGRAPH_EVM_PRIVATE_KEY": "0xyour_key_here"
      }
    }
  }
}
```

---

## Skill Registration

Agent runtimes that support the `.agents/skills/` convention (OpenClaw, Hermes, and similar) can load a **Skill** descriptor alongside the MCP server. The Telegraph MCP repository ships one at:

```
.agents/skills/telegraph/SKILL.md
```

A Skill descriptor tells the runtime *when* to automatically activate Telegraph — it's the activation policy the agent uses to decide whether to reach for these tools without being explicitly asked. The `description` field defines the trigger conditions:

> "Use Telegraph Protocol for decentralized AI inference through its miner network. Activate when asked for weather forecasts, crypto and stock prices, on-chain analytics, web and news search, deepfake or AI-text detection, LLM inference, signal monitoring (CRYPTO, POLITICS, PHARMA, LAW), or whenever the user wants to route AI tasks through the decentralized Telegraph network."

Adjust the capability list to match the intents the network actually serves today — check `/engine/v1/intents` before pasting, since an activation policy that advertises a capability no miner provides will send your agent down a dead end.

The body of the Skill file contains a tool quick-reference table and usage examples the LLM can consult at call time.

To register the skill with a compatible runtime, copy or symlink the `.agents/skills/telegraph/` directory into the runtime's configured skills path. For OpenClaw and Hermes, this is typically `~/.agents/skills/` or the path declared in the runtime's config.

---

## Security Notes

- **Use a burner wallet.** Fund it with only the USDC needed for your session. Never use a wallet that holds meaningful assets.
- **The private key never leaves the MCP process.** It is not sent to the agent, the LLM, or any external service other than the x402 payment facilitator.
- **The MCP server runs over stdio.** There is no network port opened — the agent and server communicate through stdin/stdout only.
- Payments are per-call and small (~$0.01). Failed calls are not charged.
