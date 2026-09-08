---
description: The capabilities Telegraph recognises. Pick an intent, and the network routes your question to a miner that serves it.
---

# Intents

An **intent** is a capability the protocol recognises — "look up a stock
price", "check the weather", "verify an image". Every miner declares which
intents it can serve, and every question the network answers is classified
into one.

You don't have to pick an intent yourself. When you send a plain-language
question to `POST /engine/v1/ask`, the Engine classifies it for you and picks
a miner. Intents matter when you want to know **what the network can do**,
which miners compete for your traffic, or how your answer will be judged.

The canonical set lives on-chain and the contract is the source of truth. To
read the live list, including intents not listed on this page:

```bash
curl https://devnode.telegraphprotocol.com/engine/v1/intents
```

That returns every canonical intent with a description and how many miners
currently serve it.

There are **108** canonical intents as of 2026-09-08. The tables below group them; the chain is what actually decides.

## How answers are scored

Each intent is scored one of two ways. This affects how a miner wins traffic
for it, and it's worth knowing if you're building either side.

| Tier | How it's judged | What wins |
|---|---|---|
| **Tier A — Deterministic** | WASM exact match | There is one right answer. Miners are graded on getting it exactly right. |
| **Tier B — LLM-Judge** | LLM context + WASM | The answer is open-ended. A language model supplies context and the WASM module scores quality against it. |
| **A/B — Hybrid** | Both | Part of the answer is checkable and part is judgment (a CVE hit is a lookup; its severity in context is not). Scored with a comparator for the mechanical part and an LLM judge for the rest. |

Scoring runs inside a sandboxed WASM module, and anyone can write a better
one — see [Build a Scoring Module](../scoring/build-a-scoring-module.md).

## Financial & On-Chain

### Financial Data

| Intent | Tier | Typical use |
|---|---|---|
| `STOCK_PRICE` | A — Deterministic | Trading bots, portfolio rebalancers |
| `CRYPTO_PRICE` | A — Deterministic | DeFi agents, arbitrage bots |
| `FINANCIAL_DATA` | A — Deterministic | Corporate analysis agents |
| `CURRENCY_EXCHANGE` | A — Deterministic | Cross-border payment bots |

### On-Chain Analytics

| Intent | Tier | Typical use |
|---|---|---|
| `WALLET_BALANCE_CHECK` | A — Deterministic | Whale tracking agents |
| `GAS_PRICE` | A — Deterministic | Transaction optimisation bots |
| `TOKEN_HOLDER_COUNT` | A — Deterministic | Tokenomics analysis agents |
| `TVL_LOOKUP` | A — Deterministic | DeFi risk assessment bots |
| `ONCHAIN_TX_LOOKUP` | A — Deterministic | Smart contract auditing agents |

## Real-Time Web & Research

### Weather & Sports

| Intent | Tier | Typical use |
|---|---|---|
| `WEATHER_CHECK` | A — Deterministic | Travel and logistics agents |
| `STORM_ALERT` | A — Deterministic | Risk management agents |
| `WEATHER_FORECAST` | A — Deterministic | Supply chain forecasting bots |
| `SPORTS_SCORE` | A — Deterministic | Sports prediction agents |
| `GAME_RESULT` | A — Deterministic | Sports prediction agents |

### Utilities & Security

| Intent | Tier | Typical use |
|---|---|---|
| `SSL_VERIFICATION` | A — Deterministic | Automated infrastructure monitoring |
| `CVE_LOOKUP` | A — Deterministic | Security patching agents |
| `IP_GEOLOCATION` | A — Deterministic | Traffic routing agents |
| `URL_SCAN` | A — Deterministic | Safe browsing bots |
| `FRAUD_DETECTION` | A — Deterministic | Payment and identity risk agents |

### Search

| Intent | Tier | Typical use |
|---|---|---|
| `WEB_SEARCH` | B — LLM-Judge | General research agents, scrapers |
| `NEWS_HEADLINES` | B — LLM-Judge | News trading algorithms |
| `NEWS_SEARCH` | B — LLM-Judge | Due diligence agents |
| `RESEARCH_SYNTHESIS` | B — LLM-Judge | Academic and corporate research bots |
| `RESEARCH_QUERY` | B — LLM-Judge | Deep-dive analysis agents |
| `ACADEMIC_SEARCH` | B — LLM-Judge | Literature review bots |
| `FACT_CHECK` | B — LLM-Judge | Misinformation filtering agents |
| `TWITTER_SEARCH` | B — LLM-Judge | Social sentiment tracking agents |

## AI Reasoning & Content

### AI / Chat

| Intent | Tier | Typical use |
|---|---|---|
| `LANGUAGE_GENERATION` | B — LLM-Judge | Creative writing agents |
| `CHAT_COMPLETION` | B — LLM-Judge | Customer support bots |
| `TEXT_GENERATION` | B — LLM-Judge | Automated blogging agents |
| `TASK_COMPLETION` | B — LLM-Judge | Autonomous personal assistants |
| `AGENT_TASK` | B — LLM-Judge | Multi-step autonomous agents |

### Media Authenticity

These four are served by image and video verification miners rather than text
models, so the input you send is a media URL or upload rather than a prompt.

| Intent | Tier | Typical use |
|---|---|---|
| `DEEPFAKE_DETECTION` | A — Deterministic | Trust and safety pipelines |
| `IMAGE_VERIFICATION` | A — Deterministic | Provenance checks on user-submitted images |
| `VIDEO_VERIFICATION` | A — Deterministic | Video authenticity screening |
| `MEDIA_AUTHENTICITY_CHECK` | A — Deterministic | Newsroom and moderation workflows |

### Protocol

| Intent | Tier | Typical use |
|---|---|---|
| `TELEGRAPH_KNOWLEDGE` | B — LLM-Judge | Agents answering questions about Telegraph itself |

### Text Analysis

| Intent | Tier | Typical use |
|---|---|---|
| `SENTIMENT_ANALYSIS` | B — LLM-Judge | Brand monitoring bots |
| `TEXT_CLASSIFICATION` | B — LLM-Judge | Support ticket routing agents |
| `CONTENT_MODERATION` | B — LLM-Judge | Community safety bots |
| `CONTENT_VERIFICATION` | B — LLM-Judge | Plagiarism checking agents |
| `AI_TEXT_DETECTION` | B — LLM-Judge | Academic integrity agents |
| `TEXT_AUTHENTICITY_CHECK` | B — LLM-Judge | SEO quality control bots |
| `CONTENT_EXTRACTION` | B — LLM-Judge | Data ingestion pipelines |
| `LANGUAGE_TRANSLATION` | B — LLM-Judge | Real-time localisation agents |

## Added 2026-09-08

The 63 intents below were added to the canonical set on 2026-09-08, taking it to 108.
**None of them has a live miner yet** — see [A note on coverage](#a-note-on-coverage).
They are listed here because they are routable targets today: the classifier can pick
them, and a miner can register for them right now.

### Verification & Markets

#### Web3 Verification

| Intent | Tier | Typical use |
|---|---|---|
| `EVENT_OUTCOME_RESOLUTION` | A/B — Hybrid | Prediction market and conditional contract settlement |
| `WASH_TRADING_DETECTION` | A/B — Hybrid | Exchange surveillance and token due diligence |
| `ONCHAIN_METRIC_VERIFY` | A — Deterministic | Agents reading contract state at a block height |
| `LIQUIDITY_DEPTH_VERIFY` | A — Deterministic | Slippage-aware trading bots |
| `CROSS_CHAIN_STATE_VERIFY` | A — Deterministic | Bridge and cross-chain message monitors |
| `ASSET_RESERVE_ATTESTATION` | A — Deterministic | Stablecoin and RWA risk agents |
| `VALIDATOR_PERFORMANCE_VERIFY` | A — Deterministic | Staking allocators and delegation bots |

#### Markets, Payments & Risk

| Intent | Tier | Typical use |
|---|---|---|
| `OPTIMAL_EXECUTION_ROUTE` | A/B — Hybrid | Order routers and execution agents |
| `FX_NOW` | A — Deterministic | Treasury and cross-border pricing agents |
| `MACRO_ECONOMIC_INDICATOR` | A — Deterministic | Macro research and rates agents |
| `PAYMENT_METHOD_VERIFY` | A — Deterministic | Checkout and onboarding flows |
| `FRAUD_RISK` | B — LLM-Judge | Signup and account-takeover defence |
| `TRANSACTION_RISK` | B — LLM-Judge | Payment authorisation and chargeback scoring |

### Software & Security

#### Code & Release

| Intent | Tier | Typical use |
|---|---|---|
| `CODE_REVIEW` | B — LLM-Judge | PR review bots |
| `SECURITY_REVIEW` | A/B — Hybrid | Dependency, secret and config scanning in CI |
| `CODE_PATCH_VERIFY` | A — Deterministic | Autonomous bug-fix agents proving a patch builds |
| `REGRESSION_VERIFY` | A — Deterministic | Release gates and pre-merge suites |
| `TASK_EXECUTION_QUALITY` | B — LLM-Judge | Agent benchmarking and grading harnesses |
| `LLM_OUTPUT_EVALUATION` | B — LLM-Judge | Model comparison and hallucination monitoring |

#### Threat & Abuse

| Intent | Tier | Typical use |
|---|---|---|
| `VULNERABILITY_TRIAGE` | A/B — Hybrid | Security backlog prioritisation |
| `URL_SAFE` | A/B — Hybrid | Link scanning against live threat feeds |
| `EMAIL_SECURITY` | A/B — Hybrid | SPF/DKIM/DMARC and phishing checks |
| `MALWARE_DETECTION` | A/B — Hybrid | File and hash screening pipelines |
| `THREAT_INTELLIGENCE` | A/B — Hybrid | SIEM enrichment and IOC lookups |
| `SOCIAL_BOT_DETECTION` | B — LLM-Judge | Platform integrity and campaign analysis |
| `MEDIA_FORENSIC_VERIFY` | B — LLM-Judge | Newsroom and moderation forensics |

### Commerce, Travel & Logistics

#### Commerce & Procurement

| Intent | Tier | Typical use |
|---|---|---|
| `LIVE_SHELF_PRICE` | A — Deterministic | Repricing and comparison agents |
| `SKU_IN_STOCK` | A — Deterministic | Buying agents and restock alerts |
| `COMMERCE_PURCHASE_VERIFY` | A — Deterministic | Order and receipt verification |
| `RETURN_POLICY_VERIFY` | A/B — Hybrid | Post-purchase support agents |
| `PRODUCT_AUTHENTICITY` | A/B — Hybrid | Anti-counterfeit checks on resale listings |
| `PURCHASE_ORDER_VERIFY` | A — Deterministic | Procurement automation |
| `VENDOR_VERIFY` | A/B — Hybrid | Supplier onboarding and payment release |

#### Travel & Mobility

| Intent | Tier | Typical use |
|---|---|---|
| `TRAVEL_DISRUPTION` | A — Deterministic | Rebooking and traveller-notification agents |
| `TRAVEL_TRANSIT_LOCK` | A — Deterministic | Fare-hold and booking-guarantee checks |
| `FLIGHT_AVAILABILITY` | A — Deterministic | Booking agents |
| `HOTEL_AVAILABILITY` | A — Deterministic | Itinerary assembly agents |
| `FARE_RULE_VERIFY` | A/B — Hybrid | Change and cancellation handling |
| `ROUTE_ETA` | A — Deterministic | Dispatch and last-mile planning |

#### Logistics & Maritime

| Intent | Tier | Typical use |
|---|---|---|
| `SHIP_RATE_ETA` | A/B — Hybrid | Checkout shipping quotes |
| `CARRIER_SERVICEABILITY` | A — Deterministic | Lane and hazmat feasibility checks |
| `PACKAGE_STATUS` | A — Deterministic | Order-tracking assistants |
| `DELIVERY_WINDOW_VERIFY` | A — Deterministic | Appointment and dispatch confirmation |
| `WAREHOUSE_INVENTORY` | A — Deterministic | Fulfilment and replenishment agents |
| `LIVE_PORT_CONGESTION` | A/B — Hybrid | Freight planning and ETA adjustment |
| `VESSEL_TELEMETRY_VERIFY` | A — Deterministic | Maritime tracking and demurrage analysis |
| `SHIPMENT_DELAY_RISK` | B — LLM-Judge | Supply chain risk scoring |

### Enterprise, Compliance & Infrastructure

#### Compliance & Records

| Intent | Tier | Typical use |
|---|---|---|
| `SANCTIONS_SCREENING_MATCH` | A/B — Hybrid | KYB/AML onboarding checks |
| `KYC_BIOMETRIC_LIVENESS` | A/B — Hybrid | Identity verification flows |
| `REGULATORY_FILING_MONITOR` | A — Deterministic | Disclosure monitoring and event-driven trading |
| `CORPORATE_REGISTRY_LOOKUP` | A — Deterministic | Counterparty due diligence |

#### Enterprise Operations

| Intent | Tier | Typical use |
|---|---|---|
| `B2B_IDENTITY_ENRICHMENT` | A/B — Hybrid | CRM and lead enrichment agents |
| `CONTRACT_OBLIGATION_AUDIT` | B — LLM-Judge | Contract lifecycle and milestone tracking |
| `DOCUMENT_AUTHENTICITY` | A/B — Hybrid | Signature and notarization verification |
| `INVOICE_LEDGER_RECONCILE` | A/B — Hybrid | Accounts-payable automation |
| `CUSTOMER_TICKET_RESOLUTION` | B — LLM-Judge | Support quality assurance |
| `SLA_COMPLIANCE` | A — Deterministic | Uptime and service-credit reporting |

#### Energy, Sensing & Climate

| Intent | Tier | Typical use |
|---|---|---|
| `GRID_POWER_PRICE` | A — Deterministic | Energy trading and load-shifting agents |
| `MINING_HASHPRICE_VERIFY` | A — Deterministic | Mining profitability agents |
| `DATACENTER_TELEMETRY_VERIFY` | A — Deterministic | Facility monitoring and capacity planning |
| `SENSOR_TELEMETRY_VERIFY` | A — Deterministic | IoT fleet integrity checks |
| `SATELLITE_IMAGERY_ANALYSIS` | B — LLM-Judge | Agriculture, insurance and infrastructure monitoring |
| `WEATHER_FORECAST_VERIFY` | A — Deterministic | Parametric insurance and forecast scoring |

## Using an intent

Most of the time you don't name one — you just ask:

```bash
curl -X POST https://devnode.telegraphprotocol.com/engine/v1/ask \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <base64-payment-payload>" \
  -d '{"query": "What is the current price of Bitcoin?"}'
```

The response tells you which intent it was classified as and which miner
served it:

```json
{
  "miner_id": "207",
  "miner_name": "coingecko",
  "intent": "CRYPTO_PRICE",
  "reasoning": "Query asks for a live cryptocurrency price.",
  "result": { "...": "..." },
  "signal_hash": "0x7a44569d..."
}
```

To see which miners serve a given intent before you spend anything:

```bash
curl https://devnode.telegraphprotocol.com/engine/v1/intents/CRYPTO_PRICE/miners
```

## A note on coverage

An intent being canonical means the protocol recognises it — not that a miner
is serving it today. Some intents on this page have no live miner yet, which
is an opening if you're looking for something to build: register a miner for
one and you have no competition for that traffic.

`/engine/v1/intents` reports a miner count per intent, so check there before
building against one.

See [What Miners Do](../miners/miner-overview.md) to register one.
