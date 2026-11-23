---
description: Create an Anjoman account, deposit, make an API key, and call Telegraph from a script, a server or an AI agent without managing a wallet.
---

# Use an API Key

An API key lets a script, a server or an AI agent use Telegraph through your Anjoman account. You sign up, deposit once from the website, create a key, and send requests with it. There is no wallet to manage and no signing on your side: Anjoman pays for each call from your account, from its escrow balance by default, or with x402 from its Solana address if you ask (see [Choose how a call is paid](#choose-how-a-call-is-paid)).

This page takes you from nothing to a working call. If you would rather pay from your own wallet, use [Pay from Escrow](escrow-inference.md) or [Pay per Request (x402)](x402-inference.md) instead.

**API address:** `https://backend.telegraphprotocol.com`

---

## What a key is

- A key stands in for you on a short list of endpoints: asking questions (through Anjoman's agent, or straight to the network as an auto-routed ask or a miner call), reading the result, and reading your balance and spend. [What a key can call](#what-a-key-can-call) lists them all.
- Every call made with a key is paid from your account: its escrow balance unless the call asks for x402, then its Solana address (or, for a wallet-connected account, its EVM address). The key itself holds no money.
- A key cannot deposit, withdraw, change your account or create other keys. Those need you to be signed in on the website.
- You can have up to 10 active keys. Make one for each thing that uses it, so you can revoke one without stopping the others.

---

## Step 1: Create an account

Go to [anjoman.ai](https://anjoman.ai) and sign in with email, Google or a wallet.

## Step 2: Deposit

Calls are paid from your balance, so it needs funds before the first one.

1. Open the wallet menu at the top of the page and choose **Deposit**. Follow the steps for your account type.
2. On the testnet the money is a test token, so there is nothing real to lose. If you need some, claim it at [anjoman.ai/dashboard/faucet](https://anjoman.ai/dashboard/faucet).
3. Check the balance on [Account & Billing](https://anjoman.ai/dashboard/account) or on the API keys page. It must show some **Available** balance before a paid call can succeed.

To pay on Solana instead, fund the Solana address in the wallet menu; see [Choose how a call is paid](#choose-how-a-call-is-paid).

A request costs the price of the miner calls it makes, usually about $0.01 each. A question may use more than one miner call, and the reply says what it cost.

## Step 3: Create a key

1. Open [anjoman.ai/dashboard/api-keys](https://anjoman.ai/dashboard/api-keys).
2. Give the key a **name** so you can tell it from your others, for example `pricing script`.
3. Optionally pick an **expiry date**. The key stops working at the end of that day. Leave it empty for a key that works until you revoke it.
4. Choose **Create key**, then **copy it right away**. It starts with `anjoman_` and is shown once. (Keys created before this change start with `tgk_` and keep working.) Anjoman keeps only a fingerprint of it, so a lost key cannot be recovered: revoke it and create another.

Treat the key like a password. See [Keep a key safe](#keep-a-key-safe).

## Step 4: Make your first call

Send your key in the `Authorization` header and your question as `message`. This asks for the answer as one JSON body:

```bash
curl https://backend.telegraphprotocol.com/agent/chat \
  -H "Authorization: Bearer $TELEGRAPH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the current price of Bitcoin in USD?", "stream": false}'
```

**JavaScript**

```javascript
const res = await fetch("https://backend.telegraphprotocol.com/agent/chat", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.TELEGRAPH_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: "What is the current price of Bitcoin in USD?", stream: false }),
});
const reply = await res.json();
console.log(reply.answer);
```

**Python**

```python
import os, requests

res = requests.post(
    "https://backend.telegraphprotocol.com/agent/chat",
    headers={"Authorization": f"Bearer {os.environ['TELEGRAPH_API_KEY']}"},
    json={"message": "What is the current price of Bitcoin in USD?", "stream": False},
    timeout=120,
)
print(res.json()["answer"])
```

The reply:

```json
{
  "conversationId": "7c1e…",
  "jobId": "2f9a…",
  "messageId": "b04d…",
  "answer": "Bitcoin is trading at about $…",
  "status": "complete",
  "sources": [ … ],
  "files": [],
  "costUsd": 0.01
}
```

| Field | What it is |
|---|---|
| `answer` | The written answer. |
| `status` | `complete` when everything asked for was answered. `partial`, `failed` or `unsupported` when it was not; the `answer` then says what was missing and why. |
| `sources` | What the answer was built from. Anything in the answer that is not in a source is the model's own wording. |
| `costUsd` | What the question cost, or `null` when no price was reported. |
| `conversationId` | Pass it back to ask a follow-up in the same conversation. |
| `jobId` | The request's id, for [reading or cancelling it](#other-endpoints). |
| `files` | Files the agent wrote for the answer. Download one with `GET /agent/files/{id}` using a signed-in session. |

---

## Choose a reply mode

### One JSON reply (`"stream": false`)

The call waits and returns the whole answer. A question can take a minute or more, so allow a long timeout. If it is still running after about 80 seconds, the reply is `202` with the job's id instead, and the question keeps running on the server:

```json
{ "status": "running", "jobId": "2f9a…", "conversationId": "7c1e…" }
```

Read it with `GET /agent/jobs/{jobId}` every few seconds until `status` is no longer `running`. The finished job carries the `answer` and `costUsd`:

```bash
curl https://backend.telegraphprotocol.com/agent/jobs/$JOB_ID \
  -H "Authorization: Bearer $TELEGRAPH_API_KEY"
```

### A stream of events (leave `stream` out)

The call returns `text/event-stream` and sends the answer as it is written. Each event is a line `event: <name>` and a line `data: <json>`:

| Event | Data |
|---|---|
| `conversation` | `{ conversationId }`, first. |
| `job` | `{ jobId }`. |
| `status` | What it is doing now, for example asking a miner. |
| `token` | `{ text }`: the next piece of the answer. Join them in order. |
| `trace` | Which miners were asked for each part, and what each answered. |
| `done` | `{ messageId, answer, status, files, sources, timings }`: the finished answer. |
| `error` | `{ message }`: why it could not be answered. |

Lines that start with `:` are keep-alive comments. Ignore them.

Closing the connection does not stop a request: it runs to its end on the server. To stop one, [cancel it](#other-endpoints).

---

## Request options

`POST /agent/chat` takes a JSON body:

| Field | Type | What it does |
|---|---|---|
| `message` | string, 1–2000 characters | **Required.** What you want, in plain words. |
| `stream` | boolean | `false` for one JSON reply. Omit for a stream. |
| `conversationId` | UUID | Continue an earlier conversation, so the question can refer to what was said before. Omit to start a new one. Only one message at a time can run in a conversation: a second one is refused with `409` until the first finishes. |
| `intent` and `params` | string and object | Ask one [intent](intents.md) directly, with the params its [schema](intent-schema.md) asks for. `message` is then the line shown for it. |
| `maxSpendUsd` | number, up to 100 | The most this message may spend. A call that would go over is not made. |
| `fileIds` | array of UUIDs | Documents to read with the message. Uploading needs a signed-in session, not a key. |

---

## Other endpoints

Everything below is called with the same header, `Authorization: Bearer <key>`, at `https://backend.telegraphprotocol.com`.

### What a key can call

| Endpoint | What it does |
|---|---|
| `POST /agent/chat` | Ask a question as a multi-miner call. See above. |
| `POST /engine/ask` | Auto-routed ask: the node picks the miner. See [Ask the network directly](#ask-the-network-directly). |
| `POST /engine/ask/{minerId}` | Miner call: one miner you name. See [Ask the network directly](#ask-the-network-directly). |
| `GET /agent/jobs/{id}` | A request's state: `status`, `outcome`, `costUsd`, `startedAt`, `finishedAt`, and the `answer` once it has one. |
| `POST /agent/jobs/{id}/cancel` | Stop a request that is still running. A request that has already ended is returned as it is. |
| `GET /engine/escrow/balance` | The balance your calls are paid from. |
| `GET /agent/spend` | Your jobs with what each cost, and totals. Optional `from` and `to` (ISO dates) and `limit`. |
| `GET /agent/conversations` | Your conversations. |
| `GET /agent/conversations/{id}` | One conversation with its messages. |
| `GET /agent/payment-methods` | How your account can pay: escrow, and x402 with the networks it can use (`solana` for every account, `evm` too for a wallet-connected one). |

The balance reply:

```json
{ "effectiveBalance": "1.5", "escrowBalance": "2", "agentDebt": "0", "unbilled": "0.2", "withdrawal": { "status": "waiting_root", "amount": "0.3", "requestedAt": 1795427000, "fallbackAt": 1796031800 } }
```

All amounts are USDC. They come from the node's [escrow ledger](escrow-inference.md#step-1-fund-your-escrow):

| Field | Meaning |
|---|---|
| `effectiveBalance` | What calls can spend now. It is `escrowBalance` less `unbilled` and any requested withdrawal, and it is the number checked before a paid call. |
| `escrowBalance` | Your balance as of the last ledger root: deposited and credited, less what was charged and withdrawn. |
| `unbilled` | Usage since the last ledger root. The next root charges it. |
| `withdrawal` | A withdrawal you asked for and have not received yet, or `null`. `status` is `waiting_root`, `waiting_activation`, `ready` or `fallback_open` (see [Withdrawing](escrow-inference.md#withdrawing)). |
| `agentDebt` | Always `0`: the ledger keeps no debt. Kept for older clients. |

Only calls paid from escrow show here. A call paid with x402 on Solana is paid from your account's Solana address instead.

Any other endpoint answers `403` with `This endpoint cannot be called with an API key. Sign in to use it.`

### Ask the network directly

`/agent/chat` is a multi-miner call: Anjoman's agent splits your request across intents and miners and combines their answers into one. Two endpoints skip the agent and send one request to the Telegraph node, paid the same way (see [Choose how a call is paid](#choose-how-a-call-is-paid)). Both answer in one JSON reply: `result` is the node's reply (described in [Make a Request](engine-ask.md)) and `receipt` is the payment's.

**Auto-routed ask.** The node picks the best-ranked live miner for the question, and asks the next ranked ones for any field the first answer missed. Anjoman sends it with a budget of $0.26 (`max_budget_usdc` 260000, the most the node takes): it is held while the ask runs, and only the miners whose answers are used are billed, about $0.01 each.

```bash
curl https://backend.telegraphprotocol.com/engine/ask \
  -H "Authorization: Bearer $TELEGRAPH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the current price of Bitcoin in USD?"}'
```

Send `query`, or an exact `intent` with its `params` (see [Intents](intents.md)), or both.

**Miner call.** One miner you name, by its id from [the miner list](engine-ask.md#listing-available-miners), with no routing and no fallback, at that miner's price. No budget is sent.

```bash
curl https://backend.telegraphprotocol.com/engine/ask/32003 \
  -H "Authorization: Bearer $TELEGRAPH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"intent": "CRYPTO_PRICE_USD", "params": {"symbol": "BTC"}}'
```

Send `query`, `intent` with `params`, or both; or the miner's own request as `method`, `endpoint` and `payload`. Mixing the two forms is refused with `400`.

On either endpoint a key cannot use the free trial: `paymentMethod: "free"` is refused with `400`. An empty balance is refused with `400` and the balance it found, and nothing is charged.

### Choose how a call is paid

All three asks (`/agent/chat`, `/engine/ask` and `/engine/ask/{minerId}`) take the same two optional fields in the body:

| You send | Paid from |
|---|---|
| Nothing (or `"paymentMethod": "escrow"`) | Your escrow balance on Ethereum Sepolia. The default. |
| `"paymentMethod": "x402", "network": "solana"` | Your account's Solana address, in USDC on Solana Devnet. Every account has one: it is in the Wallet menu on [anjoman.ai](https://anjoman.ai). |
| `"paymentMethod": "x402", "network": "evm"` | Your account's EVM x402 address. Wallet-connected accounts only; an email or Google account gets `403`. |

For an email or Google account, `"paymentMethod": "x402"` with no `network` pays on Solana.

```bash
curl https://backend.telegraphprotocol.com/engine/ask/32003 \
  -H "Authorization: Bearer $TELEGRAPH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"intent": "CRYPTO_PRICE_USD", "params": {"symbol": "BTC"}, "paymentMethod": "x402", "network": "solana"}'
```

To fund your Solana address, send it USDC on Solana Devnet, or get free test USDC from [Circle's faucet](https://faucet.circle.com/) (pick Solana Devnet and paste the address). It needs no SOL: the network fee is paid for you.

> [!NOTE]
> On Solana an auto-routed ask is sent without a budget, so it is answered by one miner and does not fill in missing fields from the next ranked ones. Solana payments go to a Telegraph wallet rather than the escrow contract, so the unused part of a budget could not be returned. A multi-miner call still asks several miners, one per part of your request. Escrow keeps the budget and the fill-in.

---

## Use it from an AI agent

The [Telegraph MCP server](mcp-server.md) accepts an API key in place of a wallet. Set `TELEGRAPH_API_KEY` in your agent's settings and it asks through your account, with no `setup` and no wallet:

```json
{
  "mcpServers": {
    "telegraph": {
      "command": "npx",
      "args": ["-y", "@telegraphprotocol/telegraph-protocol-mcp"],
      "env": { "TELEGRAPH_API_KEY": "anjoman_your_key_here" }
    }
  }
}
```

This needs version 2.1.0 or later of the server; the auto-routed ask (`telegraph_ask_auto`) and the miner call (`telegraph_ask_miner`) need 2.2.0. See [API key mode](mcp-server.md#api-key-mode) for what changes.

---

## Limits

| Limit | Value |
|---|---|
| Requests per key | 30 a minute. Past that, calls are refused with `429` until the minute is over. |
| Active keys per account | 10. |
| Requests running at once | A few per account. A new question while you are at the limit is refused with `429` and says how many are running. |
| Key lifetime | Until you revoke it, or its expiry date if you set one. |
| `message` | 1 to 2000 characters. |

---

## Errors

Every error is JSON with a `message` that says what went wrong.

| Status | Message (shortened) | What to do |
|---|---|---|
| `401` | This API key is not recognised. | Check the key was copied in full, with no spaces. |
| `401` | This API key has been revoked. | Create a new key. A revoked key cannot be restored. |
| `401` | This API key expired on … | Create a new key. |
| `403` | This endpoint cannot be called with an API key. | Use one of the [endpoints above](#what-a-key-can-call), or sign in on the website. |
| `403` | Your account has been suspended… | Contact support. Repeated requests for prohibited content suspend an account. |
| `403` | A message saying the request asks for prohibited content. | Rephrase it. Such requests are refused and recorded. |
| `400` | API keys pay from your account: escrow … or x402 … The free trial is not available with a key. | Remove `paymentMethod`, or set it to `escrow` or `x402`. |
| `400` | Insufficient USDC balance: wallet has … | Fund the address the call pays from (escrow, or your Solana address). Nothing was charged. |
| `403` | Email accounts pay with escrow, or with x402 on Solana … | Use `"network": "solana"`, or escrow. |
| `400` | A list of fields that are wrong. | Fix the body: `message` is required and at most 2000 characters. |
| `404` | Job not found. | The id is wrong, or the job is not your account's. |
| `409` | Your previous message in this conversation is still being answered. | Wait for it to finish, or start a new conversation. |
| `429` | This API key is limited to 30 requests a minute. | Wait for the minute to pass. |
| `429` | You already have … jobs running. | Wait for one to finish, or cancel one. |

An empty balance is not an HTTP error. The question is accepted, no miner is paid, and the reply says why in its `answer` with a `status` of `failed`. Deposit, then ask again.

---

## Keep a key safe

- **A key can spend your balance.** Anyone who has it can ask questions on your account until you revoke it.
- **Keep it on a server, or in an agent's settings.** Never put it in a web page, a mobile app, a public repository or a screenshot. Read it from an environment variable.
- **To rotate a key,** create a new one, switch your software to it, then revoke the old one on the [API keys page](https://anjoman.ai/dashboard/api-keys).
- **If a key leaks, revoke it at once.** It stops working immediately. A request already running when you revoke it keeps running to its end; stop one first with `POST /agent/jobs/{id}/cancel`, or from the Jobs page on the website.
- **Use an expiry date** for keys you only need for a while.

> [!NOTE]
> Requests to the network are public. A question can appear in the public [Daemon feed](daemon-signals.md), with the wallet that paid for it. Do not put private data in a question.

---

## Questions

**Does a key work for every kind of account?** A key works for any account. Calls are paid from the escrow balance shown on your [Account & Billing](https://anjoman.ai/dashboard/account) page, or from your Solana address when a call asks for x402 on Solana.

**Can a key deposit or withdraw money?** No. Deposits and withdrawals need you signed in on the website.

**Can I see what a key spent?** `GET /agent/spend` lists each job and its cost for the whole account, and the same list is on Account & Billing. Jobs are not split by key.

**Can I limit what one key can spend?** Not per key. Use `maxSpendUsd` on a request to cap a single message, keep the balance low, and revoke a key you no longer trust.

**Is there a free trial for keys?** No. Keys always pay from your balance.

**What happens when I revoke a key?** It stops working at once for every new request. Nothing else about your account changes.
