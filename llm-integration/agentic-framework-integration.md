# Telegraph — Agentic Framework Integration Guide

This document explains how AI agents and agentic frameworks connect to Telegraph to request verified intelligence from multiple sources (Bittensor subnets, open-source models, APIs, and more). It covers the integration architecture, the discovery endpoints, the x402 payment flow, and step-by-step setup for LangChain, ElizaOS, and any OpenAPI-compatible framework.

---

## What Telegraph Exposes to Agents

Every Telegraph node exposes two layers:

### 1. Discovery Layer (free, no payment)

These endpoints require no authentication and no payment. Agents call them at startup (or any time) to discover what intelligence sources are available and how to request them. Re-fetching picks up newly added sources automatically.

| Endpoint | Format | Purpose |
|----------|--------|---------|
| `GET /subnet-dispatcher/integrations` | JSON | List of all registered intelligence sources with metadata, endpoints, and capabilities |
| `GET /subnet-dispatcher/openapi.yaml` | YAML | Full OpenAPI 3.0.3 spec — all sources as paths in one file |
| `GET /subnet-dispatcher/openapi.json` | JSON | Same spec in JSON format |

The OpenAPI spec is generated live from the node's loaded intelligence sources. When a new provider integration is added to the node and it restarts, the spec updates automatically. Agents that re-fetch the spec gain access to new intelligence sources with no code changes.

### 2. Intelligence Layer (x402 payment required)

All intelligence requests are at:

```
/subnet-dispatcher/v1/{subnet_id}/{endpoint_path}
```

Examples:
```
POST /subnet-dispatcher/v1/34/detect-image     ← BitMind deepfake detection
POST /subnet-dispatcher/v1/22/search           ← DeSearch web + Twitter search
GET  /subnet-dispatcher/v1/18/predict          ← Zeus weather forecast
POST /subnet-dispatcher/v1/64/chat/completions ← Chutes LLM
POST /subnet-dispatcher/v1/32/detect           ← ItsAI text authenticity
POST /subnet-dispatcher/v1/1/chat              ← Apex language model
```

Every inference request requires an x402 micropayment (a small USDC amount on Base or Solana, configured by the node operator). There are no API keys. **The payment is the authentication.**

---

## The x402 Payment Flow

x402 is an open standard for HTTP micropayments (HTTP 402 Payment Required). The flow is:

```
Agent                          Telegraph Node                    Blockchain
  |                                  |                               |
  |-- POST /v1/34/detect-image ----> |                               |
  |                                  |                               |
  |<-- 402 Payment Required ---------|                               |
  |    {                             |                               |
  |      "amount": "0.01",           |                               |
  |      "token": "USDC",            |                               |
  |      "network": "base-sepolia",  |                               |
  |      "address": "0x..."          |                               |
  |    }                             |                               |
  |                                  |                               |
  |-- submit USDC tx --------------> |                     (on-chain)|
  |                                  |                               |
  |-- POST /v1/34/detect-image ----> |                               |
  |   X-Payment: <proof-header>      |                               |
  |                                  |-- verify payment -----------> |
  |                                  |<-- confirmed ----------------|
  |<-- 200 { inference result } -----|                               |
```

The x402 client library handles the entire 402 → pay → retry cycle transparently. The agent writes normal HTTP calls; the library intercepts 402 responses, submits the on-chain USDC payment, and retries the original request with the payment proof header — all without any extra code in the agent.

---

## How Your USDC Gets to Miners

Here's what happens with your payment after it hits the Telegraph network:

1. **Your USDC payment arrives** — The on-chain Port contract receives it
2. **Protocol buys Machina** — Telegraph uses the USDC to purchase Machina tokens from the open market in real-time
3. **Miner earns Machina** — The purchased Machina is sent directly to whichever miner (individual, subnet, or API) provided the intelligence response
4. **Machina value grows** — Every request creates permanent demand for Machina, strengthening the token's value

**Why?** This ensures miners earn directly from real agent demand, not from token emissions. If agents need better intelligence, they pay more USDC, which buys more Machina for miners who provide it. It's a direct supply-demand relationship.

Bittensor subnets running as Telegraph miners earn this way too — they get Machina from your USDC payments while keeping their Bittensor block rewards. Complementary incentives for the same intelligence providers.

---

## Available Intelligence Sources

| Source ID | Slug | Capability | Signal type | Key endpoint |
|-----------|------|-----------|-------------|-------------|
| SN1 | `bittensor-sn1-apex` | Language model (Corcel) | `language_response` | `POST /v1/1/chat` |
| SN18 | `bittensor-sn18-zeus` | Weather forecasting | `weather_risk` | `GET /v1/18/predict` |
| SN19 | `bittensor-sn19-nineteen` | Multimodal inference | `multimodal_response` | `POST /v1/19/chat/completions` |
| SN20 | `bittensor-sn20-bounty` | Task completion | `task_completion` | `POST /v1/20/chat` |
| SN22 | `bittensor-sn22-desearch` | Web + Twitter search | `search_relevance` | `POST /v1/22/search` |
| SN32 | `bittensor-sn32-itsai` | AI text detection | `text_authenticity` | `POST /v1/32/detect` |
| SN34 | `bittensor-sn34-bitmind` | Deepfake detection | `media_authenticity` | `POST /v1/34/detect-image` |
| SN64 | `bittensor-sn64-chutes` | High-performance LLM | `language_response` | `POST /v1/64/chat/completions` |

New intelligence sources are added by registering a configuration on-chain — no code changes needed anywhere.

---

## The `x-telegraph` OpenAPI Extension

Every path in the OpenAPI spec carries an `x-telegraph` extension block. This is how agents know what a subnet returns and how to interpret it:

```yaml
x-telegraph:
  subnet_id: "34"
  slug: bittensor-sn34-bitmind
  payment: x402
  signal_mapping:
    type: media_authenticity        # canonical signal type
    confidence_field: confidence    # key in response holding 0-1 confidence score
    label_field: isAI               # key holding the primary decision
```

**The raw response is always returned untouched.** Zeus returns a full weather forecast array. BitMind returns a full detection object. Chutes returns the full LLM completion. Nothing is stripped or replaced.

`signal_mapping` is optional extraction metadata — it tells you *which fields* in the raw response carry the most decision-relevant values. Two consumers use it differently:

**The Telegraph Autonomous Engine** uses it to extract a minimal canonical signal for on-chain writing. A full weather forecast cannot be stored in a contract, so the engine extracts just the key fields:

```
Raw Zeus response:
{
  "forecast": [{ "time": "...", "variable": "temperature", "value": 22.4 }, ...],
  "risk_level": "moderate",
  "storm_probability": 0.73,
  "latitude": 51.5
}

signal_mapping: confidence_field="storm_probability", label_field="risk_level"

→ On-chain: { type: "weather_risk", confidence: 0.73, label: "moderate" }
→ Full response: stored locally for replay and audit
```

**External agents (LangChain, ElizaOS)** receive the full raw response and can optionally use `signal_mapping` as a shortcut to extract the most important fields:

```python
sm = x_telegraph.get("signal_mapping", {})
signal = {"type": sm.get("type")}

# Only extract fields that exist — not all subnets have confidence scores
if sm.get("confidence_field"):
    signal["confidence"] = response.get(sm["confidence_field"])
if sm.get("label_field"):
    signal["label"] = response.get(sm["label_field"])
if sm.get("reason_field"):
    signal["reason"] = response.get(sm["reason_field"])
```

For LLM subnets (Apex, Chutes), `confidence_field` is empty — these subnets don't produce numeric confidence scores. The signal is just `{ type: "language_response", label: <choices array> }`. The agent works with the full response as normal.

---

## Integration: LangChain (Python)

LangChain's `OpenAPIToolkit` loads a spec and auto-generates callable tools for every path. No custom code needed for Telegraph specifically.

### Install

```bash
pip install langchain-community langchain-core langchain-openai requests pyyaml
```

### Load Telegraph as a toolkit

```python
import requests
import yaml
from langchain_community.agent_toolkits.openapi.spec import reduce_openapi_spec
from langchain_community.agent_toolkits.openapi import create_openapi_agent
from langchain_community.utilities.requests import RequestsWrapper
from langchain_openai import ChatOpenAI

TELEGRAPH_NODE = "http://your-node:7044"

# Fetch live spec from running node — re-fetch any time to pick up new subnets
raw_spec = yaml.safe_load(
    requests.get(f"{TELEGRAPH_NODE}/subnet-dispatcher/openapi.yaml").text
)
spec = reduce_openapi_spec(raw_spec)

llm = ChatOpenAI(model="gpt-4o")
agent = create_openapi_agent(
    llm=llm,
    spec=spec,
    requests_wrapper=RequestsWrapper(),
    verbose=True,
)

# Agent can now call any Telegraph subnet by describing the task in natural language
agent.run("Check if this image is AI-generated: https://example.com/photo.jpg")
agent.run("Search for latest news about Bittensor using DeSearch")
agent.run("Get weather risk for coordinates 51.5, -0.1")
```

### x402 payment setup

x402 for Python is not yet in an official release from Coinbase (x402 support is currently Go and JavaScript/TypeScript). Two options:

**Option A — handle 402 manually** (works today):
```python
import requests

def call_telegraph(node_url, path, method="POST", **kwargs):
    """Make a Telegraph inference call, handling x402 manually."""
    resp = requests.request(method, f"{node_url}/subnet-dispatcher{path}", **kwargs)
    if resp.status_code == 402:
        payment_info = resp.json()
        # Submit USDC payment on-chain using web3.py, then retry with proof header
        # payment_info contains: { "network", "token", "amount", "payTo" }
        raise NotImplementedError("Submit on-chain payment, then retry with X-Payment header")
    return resp.json()
```

**Option B — use the JavaScript/TypeScript agent** with LangChain.js, where x402-fetch is fully supported (see ElizaOS section below).

Set `TELEGRAPH_WALLET_KEY` to an EVM private key that holds Base Sepolia USDC (testnet) or Base USDC (mainnet).

### What the agent can do

Once loaded, the LangChain agent has tools for all 19 endpoints across 8 subnets. It selects the right subnet based on the task description and calls it automatically. The `x-telegraph.signal_mapping` fields in the spec guide the agent on how to interpret each response.

---

## Integration: ElizaOS

ElizaOS can load external APIs from OpenAPI specs. Check the ElizaOS plugin registry for `@elizaos/plugin-openapi` or equivalent — the integration point is the Telegraph OpenAPI spec URL.

### Install

```bash
npm install x402-fetch
# Check ElizaOS docs for the current OpenAPI plugin package name
```

### Character configuration

Add Telegraph to your ElizaOS character JSON. The key setting is the OpenAPI spec URL — ElizaOS's OpenAPI plugin reads it and exposes all Telegraph endpoints as callable actions:

```json
{
  "name": "YourAgent",
  "modelProvider": "anthropic",
  "plugins": ["@elizaos/plugin-openapi"],
  "settings": {
    "openapi": {
      "specs": [
        {
          "url": "http://your-node:7044/subnet-dispatcher/openapi.yaml",
          "name": "telegraph",
          "description": "Telegraph intelligence APIs — deepfake detection, weather, search, language models, and more"
        }
      ]
    },
    "secrets": {
      "TELEGRAPH_WALLET_KEY": ""
    }
  },
  "bio": [
    "I can verify media authenticity using Bittensor's BitMind subnet",
    "I can search the web and Twitter using DeSearch",
    "I can generate weather risk forecasts using Zeus"
  ],
  "topics": ["AI inference", "deepfake detection", "weather forecasting", "decentralized AI"]
}
```

### x402 payment setup for ElizaOS

The `x402-fetch` npm package wraps the global `fetch` so any request that returns 402 is automatically paid and retried. ElizaOS uses `fetch` internally, so this intercepts all Telegraph calls transparently:

```typescript
// In your ElizaOS agent bootstrap (before starting the agent):
import { wrapFetchWithX402 } from "x402-fetch";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains"; // or `base` for mainnet

const account = privateKeyToAccount(process.env.TELEGRAPH_WALLET_KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

// All subsequent fetch() calls now handle 402 automatically
global.fetch = wrapFetchWithX402(fetch, walletClient);
```

### What the agent can do

The ElizaOS agent gains all Telegraph subnet endpoints as callable actions. When a user asks the agent to detect deepfakes, search the web, or forecast weather, it routes to the appropriate Telegraph endpoint, pays via x402, and returns the full raw response. The `x-telegraph.signal_mapping` fields in the spec help the agent identify the most relevant fields in each response.

---

## Integration: Any OpenAPI-Compatible Framework

If your framework supports OpenAPI (GPT function calling, AutoGPT, CrewAI, LlamaIndex, Semantic Kernel, Haystack), the integration is:

1. **Point at the spec URL:**
   ```
   http://your-node:7044/subnet-dispatcher/openapi.yaml
   ```
   or the JSON version:
   ```
   http://your-node:7044/subnet-dispatcher/openapi.json
   ```

2. **Configure x402 payment** at the HTTP client layer (your framework's HTTP client or a middleware). Any call returning 402 needs to submit USDC on-chain and retry with the proof header. Use `x402-fetch` (JS/TS) or implement the 402 → pay → retry cycle manually.

3. **Read `x-telegraph.signal_mapping`** from the spec if you want to know which fields in the raw response carry the most important values (confidence score, label, reasoning). The full raw response is always returned — `signal_mapping` is optional metadata, not a transformation.

That is the complete integration. No API keys. No SDKs. No registration.

---

## Discovery Flow (for custom integrations)

If your framework does not support OpenAPI natively, use the integrations JSON endpoint directly:

```bash
curl http://your-node:7044/subnet-dispatcher/integrations
```

Response:
```json
[
  {
    "id": "34",
    "slug": "bittensor-sn34-bitmind",
    "kind": "subnet",
    "protocol": "bittensor",
    "name": "BitMind Deepfake Detector (Bittensor SN34)",
    "description": "...",
    "endpoints": [
      { "path": "/detect-image", "method": "POST", "description": "..." },
      { "path": "/detect-video", "method": "POST", "description": "..." }
    ],
    "signal_mapping": {
      "type": "media_authenticity",
      "confidence_field": "confidence",
      "label_field": "isAI"
    },
    "input_schema": { ... },
    "output_schema": { ... }
  },
  ...
]
```

Build your provider registry from this response. The full call path for any endpoint is:

```
{node_url}/subnet-dispatcher/v1/{id}{endpoint.path}
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `TELEGRAPH_WALLET_KEY` | EVM private key for x402 payments (Base / Base Sepolia) |
| `TELEGRAPH_NODE_URL` | Base URL of the Telegraph node |

---

## Adding New Subnets

New subnets appear in the OpenAPI spec automatically once registered. No framework code changes needed. The integration process:

1. Write a YAML file following the [YAML Standard](../miner-registry/yaml-standard.md)
2. Register it on-chain via the [Miner Registry](../miner-registry/miner-registry-facet.md)
3. The node activates the new subnet at the next epoch boundary
4. The new subnet's paths appear in `/subnet-dispatcher/openapi.yaml` immediately after activation
5. Agents that re-fetch the spec gain access to the new subnet with no code changes

---

## Quick Reference

```bash
# Fetch the live spec from a running node
curl http://your-node:7044/subnet-dispatcher/openapi.yaml
curl http://your-node:7044/subnet-dispatcher/openapi.json

# List all registered subnets
curl http://your-node:7044/subnet-dispatcher/integrations

# Test inference (returns 402 — configure a wallet for actual inference)
curl -X POST http://your-node:7044/subnet-dispatcher/v1/32/detect \
  -H "Content-Type: application/json" \
  -d '{"text": "Is this text AI-generated?"}'
```
