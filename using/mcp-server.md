---
description: Connect an MCP-compatible AI agent to Telegraph, paid automatically from your escrow.
---

# AI Agents (MCP)

The Telegraph MCP server runs on your own computer and gives your agent Telegraph as [Model Context Protocol](https://modelcontextprotocol.io) tools. Claude Desktop, Cursor, Claude Code, Continue, Goose, OpenClaw, LangChain, ElizaOS and any other MCP client that can start a local server can use it.

Your agent asks a question, the best-ranked miner answers, and the server pays from your Telegraph escrow. The agent never handles a key or a payment.

**Repository:** `https://github.com/telegraphprotocol/telegraph-mcp`

---

## Architecture

```
Your agent (Claude / Cursor / LangChain / etc.)
    │
    │  MCP over stdio, on your computer
    │
┌───▼────────────────────────────────────────────┐
│  Telegraph MCP server  (runs on your computer) │
│  Wallet: ~/.telegraph/wallet.json              │
│  Signs each escrow payment itself              │
└───┬────────────────────────────────────────────┘
    │
    │  HTTPS
    │
Telegraph node (devnode.telegraphprotocol.com)
```

There's nothing to host and no port to open. Your agent starts the server when it needs it.

---

## Setup

You do this once. It takes about ten minutes, most of it waiting for test funds.

**What you need**

- A terminal. On a Mac that's the Terminal app; on Windows, PowerShell.
- Node.js 20 or later. Check with `node -v`. If the command isn't found or the number is lower, install the LTS version from [nodejs.org](https://nodejs.org).

### 1. Make your Telegraph wallet

```bash
npx -y @telegraphprotocol/telegraph-protocol-mcp setup
```

Press Enter to create a new wallet, then Enter again to save it. Setup prints the wallet's **address** (it starts with `0x`). Copy it: you need it in the next step.

The wallet is saved to `~/.telegraph/wallet.json`, readable only by you. Back that file up: it's the only copy of the key, and the escrow balance goes with it.

A new wallet is empty, so setup stops here and tells you to add funds. That's expected. Press Enter at any other question.

### 2. Get test funds

The testnet runs on Ethereum Sepolia, so there's no real money. The wallet needs two things:

1. **Test USDC**, which pays for your questions. Sign in at [anjoman.ai/dashboard/faucet](https://anjoman.ai/dashboard/faucet) and send it to the address from step 1. One claim per account every 24 hours.
2. **A little Sepolia ETH**, which pays the network fee for the deposit. Any public Sepolia faucet works, for example [Google's](https://cloud.google.com/application/web3/faucet/ethereum/sepolia). Paste the same address.

Check that both arrived:

```bash
npx -y @telegraphprotocol/telegraph-protocol-mcp status
```

`wallet_usdc` and `wallet_eth` should both be above zero.

### 3. Move the USDC into escrow

```bash
npx -y @telegraphprotocol/telegraph-protocol-mcp fund 1
```

It shows the balances and asks before it sends anything. Type `y`. An ask costs about $0.01, so 1 USDC covers about 100 of them.

### 4. Add Telegraph to your agent

Follow your agent's guide [below](#integration-guides).

### 5. Ask something

In your agent, type: "What is the BTC price? Use Telegraph." You should get a price and the name of the miner that answered.

To confirm it was paid, run `status` again: `spent_today_usd` goes up by the cost of the ask.

### Commands

Run these in a terminal, each after `npx -y @telegraphprotocol/telegraph-protocol-mcp`:

| Command | What it does |
|---|---|
| `setup` | Make a wallet, and fund it and add Telegraph to your agent if the wallet already has funds |
| `fund [usd]` | Move USDC into escrow, after you confirm |
| `withdraw [usd]` | Request USDC back out of escrow. Run it again to collect once the network has settled it |
| `status` | Balances, limits and what today's asks have cost |
| `install [app]` | Add Telegraph to `claude-desktop` or `cursor`, or print the command for `claude-code` |

---

## Tools

| Tool | Cost | What it does |
|---|---|---|
| `telegraph_ask` | ~$0.01 | Ask a question, optionally with an exact intent and params. The node routes it to the top live miner |
| `telegraph_ask_miner` | The miner's price | Ask one miner you choose, or call one of its endpoints directly |
| `telegraph_find_intents` | Free | Search the intents (kinds of question) |
| `telegraph_intent` | Free | One intent's kind, params, answer fields and top miners |
| `telegraph_find_miners` | Free | An intent's miners with rank, score, price and endpoints, or a word search over all miners |
| `telegraph_ranking` | Free | The latest epoch's ranking, per intent |
| `telegraph_account` | Free | Address, network, wallet and escrow balances, limits, spending today and how to top up |
| `telegraph_docs` | Free | Built-in guides, also served as MCP resources (`telegraph://docs/...`) |

The free tools work with no wallet. Agents only get a tool that moves funds, `telegraph_deposit`, if you set `TELEGRAPH_ALLOW_AGENT_DEPOSIT`.

---

## How payments work

- **Escrow, by default.** You deposit USDC once. The server signs an escrow authorization for each ask, which proves you asked but can't move funds. Asks are deducted when the epoch closes, and a failed ask is never billed.
- **When escrow runs low,** the ask is refused with a message saying how much is left and how to top up. Nothing is charged, and your wallet is never paid from silently.
- **No double charges.** Repeating the same ask within a minute, or while it's still running, returns that answer without a second charge.
- **Limits.** The server won't pay more than $0.50 for one ask or $5 in a UTC day. Change them with the settings below.
- **x402** pays each ask straight from the wallet's USDC instead. It's off unless you set `TELEGRAPH_PAYMENT`.

---

## Settings

All optional. Set them as environment variables for the server, in your agent's config.

| Variable | Default | What it is |
|---|---|---|
| `TELEGRAPH_PAYMENT` | `escrow` | `escrow`, `auto` (escrow, then x402) or `x402` |
| `TELEGRAPH_MAX_ASK_USD` | `0.5` | The most one ask may cost. `0` means no limit |
| `TELEGRAPH_DAILY_LIMIT_USD` | `5` | The most all asks may cost in a UTC day. `0` means no limit |
| `TELEGRAPH_HOME` | `~/.telegraph` | Where the wallet and the day's spending are kept |
| `TELEGRAPH_PRIVATE_KEY` | None | Use this key instead of the wallet file. For CI, not for agent configs |
| `TELEGRAPH_ALLOW_AGENT_DEPOSIT` | Off | Also give the agent a `telegraph_deposit` tool |
| `TELEGRAPH_URL` | `https://devnode.telegraphprotocol.com` | The node |
| `TELEGRAPH_RPC_URL`, `TELEGRAPH_DIAMOND`, `TELEGRAPH_CHAIN_ID` | The testnet's | The chain and the contract that holds escrow |

---

## Integration guides

Every guide assumes you've run `setup`. No key goes in any of these configs: the server uses the wallet `setup` saved. Ready-made files are in the repository's [examples](https://github.com/telegraphprotocol/telegraph-mcp/tree/main/examples) folder.

### Claude Desktop

**Quit Claude Desktop first** (Cmd+Q on a Mac, not just closing the window). The app can write its old settings back when it closes and undo your change. Then choose `claude-desktop` when `setup` offers to add Telegraph, or run `install claude-desktop`. To do it by hand, edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "telegraph": {
      "command": "npx",
      "args": ["-y", "@telegraphprotocol/telegraph-protocol-mcp"]
    }
  }
}
```

Open Claude Desktop and start a new chat. If Telegraph isn't there, open the config file again and check that the `telegraph` entry above is still in it.

### Cursor

Choose `cursor` when `setup` offers to add Telegraph, or run `install cursor`. To do it by hand, add the same `mcpServers` block as Claude Desktop to `~/.cursor/mcp.json`. Cursor picks it up in a few seconds, with no restart. Check that `telegraph` is listed in Cursor's MCP settings, then ask in Agent mode.

### Claude Code

```bash
claude mcp add --scope user telegraph -- npx -y @telegraphprotocol/telegraph-protocol-mcp
```

Check it with `claude mcp list`.

### VS Code / Continue

Install the Continue extension in VS Code. Then, in the top folder of the project you have open, create the folder `.continue/mcpServers/` and save this in it as `telegraph.yaml`:

```yaml
name: Telegraph
version: 0.0.1
schema: v1
mcpServers:
  - name: telegraph
    type: stdio
    command: npx
    args:
      - "-y"
      - "@telegraphprotocol/telegraph-protocol-mcp"
```

Continue only uses MCP tools in **Agent** mode.

### Goose

If you've never used Goose, run `goose configure` once to choose your AI model. Then add this under `extensions:` in `~/.config/goose/config.yaml`, keeping what's already there:

```yaml
extensions:
  telegraph:
    name: telegraph
    type: stdio
    enabled: true
    cmd: npx
    args:
      - -y
      - "@telegraphprotocol/telegraph-protocol-mcp"
    timeout: 300
```

Start a new Goose session. `goose info` shows where your config file is.

### OpenClaw

```bash
openclaw mcp add telegraph --command npx --arg=-y --arg @telegraphprotocol/telegraph-protocol-mcp
openclaw mcp doctor telegraph --probe
```

The second command should print `telegraph: ok`. The entry is saved under `mcp.servers` in `~/.openclaw/openclaw.json`.

### LangChain / LangGraph (Python)

```bash
pip install langchain-mcp-adapters
```

Save this as `agent.py` and run `python agent.py`:

```python
import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient

async def main():
    client = MultiServerMCPClient({
        "telegraph": {
            "transport": "stdio",
            "command": "npx",
            "args": ["-y", "@telegraphprotocol/telegraph-protocol-mcp"],
        }
    })
    tools = await client.get_tools()

    # Pass `tools` to your agent, or call one directly:
    ask = next(t for t in tools if t.name == "telegraph_ask")
    print(await ask.ainvoke({"question": "What is the BTC price in USD?"}))

asyncio.run(main())
```

Full Python example in [examples/langchain](https://github.com/telegraphprotocol/telegraph-mcp/tree/main/examples/langchain).

### LangChain / LangGraph (TypeScript)

```bash
npm install @langchain/mcp-adapters @langchain/core
```

Save this as `agent.mjs` and run `node agent.mjs`:

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const client = new MultiServerMCPClient({
  telegraph: {
    transport: "stdio",
    command: "npx",
    args: ["-y", "@telegraphprotocol/telegraph-protocol-mcp"],
  },
});

const tools = await client.getTools();

// Pass `tools` to your agent, or call one directly.
// This adapter puts the server name in front: telegraph_telegraph_ask.
const ask = tools.find((t) => t.name.endsWith("telegraph_ask"));
console.log(await ask.invoke({ question: "What is the BTC price in USD?" }));

await client.close();
```

### ElizaOS

In your ElizaOS project, add the MCP plugin. Use the version that matches your ElizaOS: on ElizaOS 1.7 that's 1.7.1, and the newest plugin doesn't load there.

```bash
bun add @elizaos/plugin-mcp@1.7.1
```

Add the plugin and the server to your character (`src/character.ts` in a new project, or your character JSON file):

```json
{
  "plugins": ["@elizaos/plugin-mcp"],
  "settings": {
    "mcp": {
      "servers": {
        "telegraph": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@telegraphprotocol/telegraph-protocol-mcp"]
        }
      }
    }
  }
}
```

Start the agent with `elizaos start`. Its log shows a line starting `[MCP] Connected 1/1` when Telegraph is loaded. A working example is in [examples/elizaos-telegraph](https://github.com/telegraphprotocol/telegraph-mcp/tree/main/examples/elizaos-telegraph).

### Any MCP client

Any client that can start a local stdio MCP server works. Most take this block:

```json
{
  "mcpServers": {
    "telegraph": {
      "command": "npx",
      "args": ["-y", "@telegraphprotocol/telegraph-protocol-mcp"]
    }
  }
}
```

---

## Problems

| What you see | What to do |
|---|---|
| "No wallet yet" | Run `setup` first |
| "The wallet needs a little ETH" | Send Sepolia ETH to your wallet address ([step 2](#2-get-test-funds)), then run `fund` |
| "The wallet holds 0 USDC" | Claim test USDC from the faucet to your wallet address, then run `fund` |
| The agent says escrow is too low | Run `fund` again. Nothing was charged |
| `npx` or `node` isn't found by your agent | Install Node.js 20 or later, then restart the agent |
| The agent writes out a tool call as text and no answer comes back | The AI model is too small to use tools reliably. Pick a larger one in your agent |
| The agent doesn't use Telegraph | Say "Use Telegraph" in your question, and check the server is listed in the agent's MCP or tools settings |

---

## Skill registration

Agent runtimes that support the `.agents/skills/` convention can load a Skill descriptor alongside the MCP server. It tells the runtime when to reach for Telegraph without being asked. The repository ships one at:

```
.agents/skills/telegraph/SKILL.md
```

Copy or symlink the `.agents/skills/telegraph/` directory into your runtime's skills path. For OpenClaw that's `~/.openclaw/skills/`, and the skill stays dormant until `mcp.servers.telegraph` is configured.

---

## Security notes

- **Use a wallet made for this,** holding only what you plan to spend. The limits cap what the agent can spend.
- **The key stays in `~/.telegraph/wallet.json`** (mode 0600). It's never in an agent's config, a tool result or a log, so the agent and its model never see it through MCP.
- **An agent that can run shell commands** (Claude Code, Cursor, Goose) can read that file or run `fund` itself. The real protection there is the dedicated wallet and the limits.
- **By default the agent has no tool that moves funds.** Deposits and withdrawals happen in your terminal, after you confirm.
- **No network port is opened.** The agent and the server talk over stdin and stdout only.
