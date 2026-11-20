---
description: Install the Anjoman skill so your AI agent uses Anjoman whenever a task needs outside intelligence. One command, one API key, no MCP server and no wallet.
---

# Anjoman Skill for AI Agents

The Anjoman skill makes Anjoman your agent's default for outside intelligence. You install it once and add an API key. After that, whenever a task needs live data, research or a specialist check, your agent sends the request to Anjoman on its own, even if you never mention Anjoman or Telegraph, and brings the answer back into your normal session.

Anjoman does the work: it plans the request, picks ranked specialist miners from the Telegraph network (one or several, in parallel or in order), checks what is missing, retries what failed and writes one combined answer. The skill does not rebuild any of that. It carries your request to Anjoman and reports what came back.

---

## What you get

- **One entry point for everything.** You do not decide whether a task needs one miner, several, or a whole workflow. Anjoman decides.
- **Follow-ups that keep their context.** Your agent continues the same conversation, so "and in euros?" works.
- **A spending limit that you control.** There is none unless you set one, and your account balance is the only limit. [Spending](#spending) shows how to set one.
- **Progress while it works**, so a request that takes a minute does not look stuck.
- **The full picture of each answer:** the status, the cost, which specialist answered each step, the payment receipts and the sources.
- **Honest failures.** A partial answer, a request stopped by the spending limit and a rejected key are each reported as what they are.
- **Nothing to configure.** No MCP server, no wallet and no extra dependencies. It needs Node.js 18 or later.

It does not take over your agent. It is for requests that need information or analysis from outside your project and conversation: live prices and market data, weather, news, web or academic research, security or compliance checks, wallet or contract risk, fact checks, and research that needs several sources. Editing code and files, running tests and anything your project already answers stay with your agent's own tools.

---

## Step 1: Get an API key

1. Sign in at [anjoman.ai](https://anjoman.ai) and make sure the account has a balance. See [Use an API Key](api-keys.md) for deposits.
2. Create a key on the [API keys page](https://anjoman.ai/dashboard/api-keys), or open the skill section on the [Integrations page](https://anjoman.ai/dashboard/integrations), which makes a key for you and shows the commands below with it filled in.

The key starts with `anjoman_`. Treat it like a password: it can spend your balance.

## Step 2: Install the skill

In a terminal:

```bash
npx skills add telegraphprotocol/telegraph-mcp --skill anjoman
```

It asks which agents to add the skill to and puts it where each one looks for skills. Add `-g` to install it for all your projects instead of the current one.

You can also copy the [`skills/anjoman`](https://github.com/telegraphprotocol/telegraph-mcp/tree/main/skills/anjoman) folder into your agent's skills folder by hand.

## Step 3: Add your key

There are two ways. Pick one.

### Option A: save it once with `login` (recommended)

`login` stores the key in a private file, `~/.anjoman/key`, readable only by you. Every project and every agent on the machine then finds it, so you do it once.

Run it **in a normal terminal, not inside your agent**, so the key never goes into a chat. It asks for the key and does not show it as you type.

**macOS and Linux:**

```bash
node ~/.claude/skills/anjoman/scripts/anjoman.mjs login
```

**Windows**, in PowerShell:

```powershell
node "$HOME\.claude\skills\anjoman\scripts\anjoman.mjs" login
```

The path depends on where the skill was installed:

- **For one project:** the skill is in `.claude/skills/anjoman/` inside that project.
- **For all your projects** (installed with `-g`): it is in `~/.claude/skills/anjoman/`.
- **Other agents** use their own skills folder, such as `.agents/skills/anjoman/`.

Not sure where it went? Run `npx skills list` (add `-g` for the global ones) to see the installed skills.

### Option B: an environment variable

Set it, then restart your agent so it sees it.

**macOS and Linux**, in `~/.zshrc` or `~/.bashrc`:

```bash
export ANJOMAN_API_KEY=anjoman_your_key
```

**Windows**, in PowerShell:

```powershell
setx ANJOMAN_API_KEY "anjoman_your_key"
```

If both are set, the environment variable is used.

### Check that it worked

From the skill's folder, run:

```bash
node scripts/anjoman.mjs balance
```

It shows your account balance, your spending limit and your recent spend. If it says `No Anjoman API key`, the key is not being found: check the steps above, and restart your agent after setting a variable.

Never paste the key into a chat with your agent, and never put it in a file inside a project.

## Step 4: Ask something

Ask your agent as you normally would, without mentioning Anjoman:

> What is Bitcoin trading at, what is the weather in Karachi, and what is the euro worth in US dollars?

The agent recognises that this needs outside data, runs the skill, and answers from what Anjoman returns.

---

## How it works

The skill is a folder with two parts:

- `SKILL.md` tells the agent when to use it and how to read the result. Agents decide whether to load a skill from its description, which is why it works without being named.
- `scripts/anjoman.mjs` is one file with no dependencies. It sends your request to Anjoman's `/agent/chat` with your key, follows the progress, and prints the answer followed by a report.

The agent runs it like this:

```bash
node scripts/anjoman.mjs ask "What is Bitcoin trading at right now?"
```

Progress lines go to the error output while it works, so the answer stays clean. A request takes from a few seconds to a few minutes.

### The report

Every answer ends with a short report:

```
The current price of Bitcoin is 63,753.70 USD, according to Kraken Spot Price.

— Anjoman —
Status: complete
Cost: $0.01
Conversation: f97fb7f5-…  (pass --conversation f97fb7f5-… to continue it)
Job: 4d2d227b-…
Steps:
  1. CRYPTO_PRICE_USD → Kraken Spot Price: answered · 13.2s
Receipts:
  CRYPTO_PRICE_USD: 0xca1802bb…
Sources:
  CRYPTO_PRICE_USD — Kraken Spot Price [receipt 0xca1802bb…]
```

| Line | What it is |
|---|---|
| **Status** | `complete`, `PARTIAL` (only some of the request was answered), `FAILED`, `UNSUPPORTED` (the network has nothing for this) or `STOPPED` (the spending limit was reached). |
| **Cost** | What the request cost. |
| **Conversation** | The id that continues this conversation. |
| **Steps** | What each specialist did: its intent, who answered, how long it took, and anything missing or any reason it failed. |
| **Receipts** | The payment receipt for each answering step. |
| **Sources** | What the answer was built from. |

A partial answer is never passed off as complete. If a step is missing, the agent says which one.

### Follow-ups

When you continue a topic, the agent passes the conversation id from the last report:

```bash
node scripts/anjoman.mjs ask "and what is that in euros?" --conversation f97fb7f5-…
```

Anjoman keeps the context, so the question can be short. A new topic starts a new conversation.

### Ask the network directly

`ask` is a multi-miner call: Anjoman's agent splits the request across intents and miners and combines their answers into one. Two more commands skip the agent and go straight to the Telegraph node, paid from the same account:

| Command | What it is | Cost |
|---|---|---|
| `auto` | **Auto-routed ask** (`POST /engine/ask`): the node picks the best-ranked live miner for the question, and asks the next ones for fields it missed | A budget of $0.26 is held while it runs; only the miners whose answers are used are billed, about $0.01 each |
| `miner` | **Miner call** (`POST /engine/ask/{minerId}`): one miner you name, by id or slug, with no routing and no fallback | That miner's price |

```bash
node scripts/anjoman.mjs auto "What is Bitcoin trading at?"
node scripts/anjoman.mjs auto --intent CRYPTO_PRICE_USD --params '{"symbol":"BTC"}'
node scripts/anjoman.mjs miner crypto-kraken "BTC price"
node scripts/anjoman.mjs miner 377 --endpoint /price --method GET --payload '{"symbol":"BTC"}'
```

The reply is the answer's fields, then **Status**, **Intent**, **Miner**, **Cost** and **Receipt**. `--json` prints it as one object. These need version 0.2.0 or later of the skill.

---

## Spending

The limit is yours to set, and it lives on your account. By default there is **no limit**, and your account balance is the only limit. Most requests cost a few cents.

To set one, sign in to [anjoman.ai](https://anjoman.ai), open the chat and use the **spend limit** button beside the message box. Enter the most one message may spend. It is saved on your account, and Anjoman applies it to **every request from your account**: the chat, your API keys, and agents using the skill. A request cannot go above it, whatever the agent sends, and a key cannot change it. Only you can, from a signed-in session. Remove it from the same button.

An agent or a single session can set a lower ceiling than yours, but never a higher one:

```bash
export ANJOMAN_MAX_SPEND_USD=1
node scripts/anjoman.mjs ask "…" --max-spend 0.5
```

A limit is a ceiling, not the price. While a specialist is working, Anjoman holds back up to about $0.26 for it and gives back what the call did not cost. A request that asks several specialists at once needs room for all of them, so pick a limit well above what you expect to spend. A limit under about $0.30 per specialist stops steps early even when the real cost would be cents.

When a request reaches your limit, it stops and the agent asks you before going on. To raise it, use the spend limit button in Anjoman. The agent never sets, raises or removes a limit by itself.

To see your balance, your limit and recent spend:

```bash
node scripts/anjoman.mjs balance
```

The skill cannot deposit or withdraw. Add funds in Anjoman, from the wallet menu.

---

## Long requests

A request that outlasts the connection keeps running on Anjoman's side. The skill follows it by its job id until it ends. You can read or stop one yourself:

```bash
node scripts/anjoman.mjs job <jobId> --wait
node scripts/anjoman.mjs cancel <jobId>
```

---

## Make Anjoman the default

Agents decide whether to use a skill from its description, and some agents are stricter about it than others. To make it more certain, add a short rule to your agent's own instructions (`CLAUDE.md`, `AGENTS.md` or a Cursor rule). Print it with:

```bash
node scripts/anjoman.mjs rule
```

Or copy it from the skill section on the [Integrations page](https://anjoman.ai/dashboard/integrations). The rule is wrapped in `<!-- anjoman:start -->` and `<!-- anjoman:end -->` markers so you can find and remove it later. The skill never edits your instruction files.

---

## Where it works

The skill uses the open Agent Skills format: a folder with a `SKILL.md`. It needs an agent that reads skills and can run a command, plus Node.js 18 or later and internet access.

- **Claude Code** is tested. With the skill installed, a plain question about live prices started it without the agent being told to, and an unrelated coding task left it alone.
- **Other agents that read skills** (Cursor, Codex and others) should work with the same folder, but are not yet tested. Where an agent does not start the skill on its own, add the rule above.
- **Chat apps that cannot run commands**, such as Claude Desktop's chat, cannot run the skill. Use the [Telegraph MCP server](mcp-server.md) there.

---

## Skill or MCP server

| | Anjoman skill | Telegraph MCP server |
|---|---|---|
| Best for | Letting your agent use Anjoman for ordinary requests, plus auto-routed asks and miner calls | Direct access to specific miners, intents and rankings |
| Setup | One install and one API key | An MCP server configured in each app |
| Planning and multi-miner requests | Yes, done by Anjoman | Only in API-key mode, and without follow-ups |
| Follow-ups, your spending limit, receipts | Yes | No |

They can be installed together. The skill is for everyday requests, and the MCP server is for when you want to choose a miner yourself.

---

## Errors

| You see | What it means | What to do |
|---|---|---|
| `No Anjoman API key` | No key is set. | Do [Step 3](#step-3-add-your-key). |
| `401` and "key was rejected" | The key is wrong, expired or revoked. | Check it or create a new one on the [API keys page](https://anjoman.ai/dashboard/api-keys). |
| `402` or a balance message | The account cannot pay. | Add funds in Anjoman. |
| `429` | A key makes up to 30 requests a minute. | Wait a minute and try again. |
| Status `PARTIAL` | Only some of the request was answered. | Read the Steps for what is missing and ask again for that part. |
| Status `STOPPED` | The request reached your spending limit. | Say whether to go on, and raise the limit with the spend limit button in Anjoman. |
| "ended the request without an answer" | The request failed before it produced one. Nothing is charged. | Try again. |

---

## Keep a key safe

- Keep the key in an environment variable or in `~/.anjoman/key`, never in a project file or a public repository.
- Make a separate key for the skill, so you can revoke it without stopping anything else.
- Revoke a key on the [API keys page](https://anjoman.ai/dashboard/api-keys) if it may have been seen. It stops working at once.
- The skill never prints the key. A skill runs with your agent's permissions, so install only skills you trust.

---

## Questions

**Does my agent need to know about Telegraph?** No. The skill's description tells it when to use Anjoman.

**Where do I see what a request cost?** In the report, on the API keys page and on [Account & Billing](https://anjoman.ai/dashboard/account).

**Can I limit what it spends?** Yes. See [Spending](#spending).

**Where is the code?** In the [telegraph-mcp repository](https://github.com/telegraphprotocol/telegraph-mcp/tree/main/skills/anjoman).
