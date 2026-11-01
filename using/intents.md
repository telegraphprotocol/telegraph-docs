---
description: Advanced protocol reference for intent families, scoring, and governance.
---

# Intents

> **Looking to consume intelligence?** Start with [Start Here](consume-intelligence.md)
> and [Browse Intents & Schemas](intent-schema.md). This page covers the advanced
> protocol catalog and governance mechanics.

An **intent** is a capability the protocol recognises: "get the EUR/USD rate",
"review this code", "check a URL". Every miner declares which intents it serves,
and every question the network answers is matched to one.

You do not have to pick an intent yourself. A plain-language question sent to
`POST /engine/v1/ask` is classified for you. You choose an intent when you want
a predictable answer shape, a validated request, or an on-chain job.

## Prefixes and intents

The catalog has two kinds of entry. This is the most important thing to know
before you register a miner or propose an intent.

| | Prefix | Intent (sub-intent) |
|---|---|---|
| Example | `FX_NOW` | `FX_NOW_EUR` |
| What it is | A **family**. It names a group of related intents and fixes how they are scored. | A **specific question** inside a family. |
| Do miners serve it? | **No.** A miner cannot register for a prefix. | **Yes.** Miners register for intents. |
| Is it ranked? | No. | Yes. Each intent has its own miners and its own ranking. |
| Who adds it? | The admin only. | Anyone can propose one. The admin approves it. |
| Scored by | The module registered on the prefix (an evaluator adapter or a comparator). | The module of its family. |

The rule is simple: **an intent is a registered prefix, then `_`, then a suffix**.
`FX_NOW_EUR` is valid because `FX_NOW` is a prefix. `FXNOW_EUR` is not, because
`FXNOW` is not a prefix (the `_` is part of the rule). The intent takes the
**kind** of its longest matching prefix.

If you list a prefix where an intent is expected (for example `FX_NOW` in a miner
YAML), registration is refused with `a prefix is not an intent`.

### Reading the catalog

```bash
export DIAMOND=0x3624EB012B5E998BB57B6bE6C9Cfc9c4bc5eb99b
export RPC=https://ethereum-sepolia-rpc.publicnode.com

# Every prefix and its kind (1 deterministic, 2 hybrid, 3 judgment)
cast call $DIAMOND "getPrefixes()(string[],uint8[])" --rpc-url $RPC

# Is this name an intent? What kind is it? What is its spec?
cast call $DIAMOND "isCanonicalIntent(string)(bool)" "FX_NOW_EUR" --rpc-url $RPC
cast call $DIAMOND "intentKind(string)(uint8)" "FX_NOW_EUR" --rpc-url $RPC
```

`intentKind` answers `0` for a name that is not an intent, such as a prefix.

Or over HTTP, with miner counts and each intent's request and answer schema:

```bash
curl https://devnode.telegraphprotocol.com/engine/v1/intents
curl https://devnode.telegraphprotocol.com/engine/v1/intents/FX_NOW_EUR
```

The chain is the source of truth. This page explains the model; it does not try
to list every intent, because the set changes as intents are approved.

## Read an intent's consumption contract

Before building an API client, an agent workflow, a miner integration, or a
smart-contract job, read the exact intent from a node. Do not copy field names,
array positions, units, or limits from another intent or a miner's YAML.

```bash
export NODE=https://devnode.telegraphprotocol.com
export INTENT=FX_NOW_EUR

# Discover canonical intent names and whether any miner currently serves them.
curl -s "$NODE/engine/v1/intents" | jq '.intents[] | {
  intent_name, description, miner_count, canonical
}'

# Read the complete contract for the chosen canonical intent.
curl -s "$NODE/engine/v1/intents/$INTENT" | jq '{
  intent_name, class, request, response, onchain, miner_count
}'
```

The same commands are on [Browse Intents & Schemas](intent-schema.md).

The second response is the public, node-generated contract for consumption. It
contains four related definitions:

| Definition | Where it appears | What it controls |
|---|---|---|
| Canonical request schema | `request` | The named `params` accepted by the API and used to build a miner request. |
| Response schema | `response` | The stable fields the node returns to an API consumer after it reads the miner answer. |
| On-chain request layout | `onchain.request` | The position, array, type, scale, and limit of each job input in `OnChainData`. |
| On-chain response layout | `onchain.response` | The position, array, type, scale, and limit of each callback value in `OnChainData`. |

`request.schema_version` and `response.format_version` identify the definitions
the node loaded. `served_by` tells you when the definition is inherited from a
family. Store the complete response you used alongside your integration so you
can review a schema change before changing application code.

The shape is intentionally descriptive rather than tied to one intent:

```json
{
  "intent_name": "FX_NOW_EUR",
  "class": "deterministic",
  "request": {
    "schema_version": 1,
    "served_by": "FX_NOW_EUR",
    "params": [
      {"name": "...", "type": "string|number|integer|bool|enum|date|datetime"}
    ]
  },
  "response": {
    "format_version": 1,
    "served_by": "FX_NOW_EUR",
    "fields": [
      {"name": "...", "type": "...", "unit": "..."}
    ]
  },
  "onchain": {
    "ready": true,
    "request": [{"name": "...", "slot": "integers|strings|bools", "index": 0}],
    "response": [{"name": "...", "slot": "integers|strings|bools", "index": 0}]
  }
}
```

The exact fields carry the rules for that intent: `optional`, `default`,
`pattern`, `examples`, `range`, `allowed`, `unit`, `decimals`, `processed`, and
`off_chain` appear only where relevant. Treat the returned JSON as data, not a
free-form prompt: validate a request from `request.params`, and decode a result
from `response.fields` or the corresponding on-chain layout.

### Off-chain API consumption

An API call sends canonical inputs by name:

```json
{
  "intent": "FX_NOW_EUR",
  "params": {
    "currency": "EUR"
  }
}
```

The node validates those values against `request.params` before selecting a
miner or taking payment. It builds the chosen miner's native request from the
same canonical inputs, then reads the miner response into `response.fields`.
The returned result uses the intent's response shape rather than the provider's
arbitrary raw JSON when the node can read the answer into that shape. Fields
marked `off_chain` remain in the API response but are not callback data for a
contract. A shaped response is not, by itself, independent verification that a
provider's claim is true.

Do not assume every intent has a schema. `request` or `response` can be `null`;
in that case the typed canonical route or shaped result is unavailable for that
intent. Read the endpoint again rather than guessing a fallback shape.

### On-chain consumption

An on-chain job uses the same logical intent inputs and the same processed
answer, but it cannot send JSON. It uses the contract's `OnChainData` struct:

```solidity
struct OnChainData {
    address[] addresses;
    uint256[] integers;
    string[] strings;
    bool[] bools;
}
```

`onchain.request` and `onchain.response` are the codec for that struct. Each
entry gives a field's `slot` and zero-based `index`; fill or read that exact
location, never the order in which fields happen to appear in a JSON object.

| Schema type | Slot | Encoding rule |
|---|---|---|
| `number` | `integers` | Signed fixed-point integer: the logical value × `10^decimals`. |
| `integer` | `integers` | Signed integer value. |
| `bool` | `bools` | Boolean value. |
| `string`, `enum`, `date`, `datetime` | `strings` | UTF-8 text, bounded by the returned `max_bytes`. |

For a job, provide every `onchain.request` slot in the stated position. API-only
optional/default rules do not remove a job slot. The node decodes those slots,
validates their range and allowed values, builds the miner request, reads the
response into the declared fields, and encodes only `onchain.response` into the
callback.

Check `onchain.ready` before sending a transaction. If it is `false`, read
`onchain.reason`; that intent cannot currently produce a bounded callback
answer. A list or object, a number without a decimal scale, or a response with
only `off_chain` fields cannot be used as a successful on-chain answer.

The callback contains only the fixed `OnChainData` layout. Detailed provider
records, raw miner JSON, and fields listed in `onchain.off_chain` stay off
chain. A field the node could not read is a failed job response, never an
invented zero, empty string, or false value.

This gives contracts a fixed decoding contract while allowing miners to use
different providers internally:

```text
canonical API params / OnChainData request
    → miner-specific request
    → raw provider answer
    → intent-defined processing
    → processed API result
    → fixed OnChainData callback layout
```

For the transaction and callback interface, see [On-Chain Jobs](erc8183-jobs.md).

## The three kinds

Each prefix has a kind. It decides how answers to every intent in the family are
judged, and therefore how a miner wins traffic.

| Kind | Code | How it is judged | What wins |
|---|---|---|---|
| **Deterministic** | 1 | A **comparator** module. There is one right answer. The value in each miner's answer is compared with a reference value within the intent's tolerance. The reference is the median of up to 3 public APIs (**truth sources**) uploaded to the [evaluation pool](../scoring/contribute-evaluation-data.md#truth-sources-deterministic-intents). | Being close to the reference. |
| **Hybrid** | 2 | Both. A comparator scores the checkable part against truth sources, a model judges the rest, and the two are combined with the intent's `fusion` rule. | The combined score. |
| **Judgment** | 3 | A model-based **evaluator adapter**. The answer is open-ended and has no reference. Miners are ranked on questions from the [evaluation pool](../scoring/contribute-evaluation-data.md). | Winning against other miners on the pool's questions. |

A deterministic or hybrid intent carries an **on-chain spec** (below). A judgment
intent has none.

An intent with no scoring module for its kind is not scored, and its miners keep
their previous ranking. The same is true of a deterministic or hybrid intent with
no truth source in the evaluation pool.

To see which module scores an intent right now:

```bash
curl "https://devnode.telegraphprotocol.com/api/wasm?resolve=FX_NOW_EUR"
```

The reply names the family that scores it (`served_by`), whether it is inherited
(`inherited`), which scorer holds it (`judgment`, `hybrid` or `comparator`) and
whether the epoch scorer will actually route it (`routed`). See
[Families](../scoring/build-a-scoring-module.md#families-one-module-for-many-intents).

### Prefixes seeded at genesis

A fresh deployment seeds these as **prefixes**, with no intents. Intents are then
proposed and approved, or added by the admin from a catalog file.

| Kind | Prefixes |
|---|---|
| Deterministic (1) | `WEATHER_CHECK`, `STOCK_PRICE`, `CRYPTO_PRICE`, `CURRENCY_EXCHANGE`, `SSL_VERIFICATION`, `FX_NOW` |
| Hybrid (2) | `URL_SCAN`, `CVE_LOOKUP`, `MALWARE_DETECTION`, `THREAT_INTELLIGENCE` |
| Judgment (3) | `CHAT_COMPLETION`, `WEB_SEARCH`, `CODE_REVIEW`, `SECURITY_REVIEW`, `FACT_CHECK`, `FRAUD_DETECTION`, `FRAUD_RISK`, `NEWS_HEADLINES`, `NEWS_SEARCH`, `RESEARCH_QUERY`, `RESEARCH_SYNTHESIS`, `ACADEMIC_SEARCH`, `SENTIMENT_ANALYSIS`, `TEXT_CLASSIFICATION`, `CONTENT_EXTRACTION`, `CONTENT_MODERATION`, `LANGUAGE_TRANSLATION`, `TASK_COMPLETION`, `AGENT_TASK`, and about 80 more |

Read the full list with `getPrefixes()`. Kinds can differ from what an older
version of this page said, because the contract is authoritative.

### `_GENERAL` intents

So that a miner without a checkable core has something to serve, judgment
prefixes ship with a `<PREFIX>_GENERAL` child, for example
`CHAT_COMPLETION_GENERAL`, `WEATHER_FORECAST_GENERAL` and
`FACT_CHECK_GENERAL`. OCR and speech-to-text miners serve
`CONTENT_EXTRACTION_GENERAL`, and breach checks use `FRAUD_DETECTION_GENERAL`.
List the live ones:

```bash
curl -s https://devnode.telegraphprotocol.com/engine/v1/intents \
  | jq -r '.intents[].intent_name | select(endswith("_GENERAL"))'
```

A deterministic or hybrid prefix has no `_GENERAL` child, because every intent
under it needs a spec. A prefix with no intent has no miner until someone
proposes an intent under it.

## The spec of an intent

A deterministic or hybrid intent carries a **spec** on chain. Every node copies
it into its own tables, so every validator scores the intent the same way.

| Field | Meaning |
|---|---|
| `comparatorCode` | How two answers are compared: `0` exact, `1` absolute difference, `2` relative difference, `3` pass or fail |
| `toleranceBps` | How close counts as a match, in basis points. Must be above 0 for codes 1 and 2 |
| `scale` | Fixed-point scale of the compared value. Must be above 0 |
| `questionKeys` | The values the intent is asked about, for example `["EUR"]`. At least one, none empty |
| `questionTemplate` | The question put to miners, with `{key}` filled from a key, for example `What is the current USD/{key} mid-market exchange rate?` |
| `label` | A short name for the intent |
| `fusion` | Hybrid only: JSON describing how the checkable part and the judged part combine. Required for hybrid, refused for deterministic |
| `responseFormat` | JSON describing the answer's fields (see [the answer's shape](engine-ask.md#the-answers-shape)) |
| `truthParams` | JSON passed to the truth sources |

A spec JSON the node cannot use is skipped and logged, and the intent is then not
scored. Check a node's log after a new intent is approved.

## Asking with an intent

### Plain language (the Engine picks the intent)

```bash
curl -X POST https://devnode.telegraphprotocol.com/engine/v1/ask \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <base64-payment-payload>" \
  -d '{"query": "What is the current EUR/USD rate?"}'
```

### Canonical (you name the intent and send typed params)

Every intent has one **request schema**. Read it, then send matching `params`:

```bash
curl https://devnode.telegraphprotocol.com/engine/v1/intents/FX_NOW_EUR
```

The `request.params` list says what each param is called, its type, whether it is
required, and its limits. Then:

```bash
curl -X POST https://devnode.telegraphprotocol.com/engine/v1/ask \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <base64-payment-payload>" \
  -d '{"intent": "FX_NOW_EUR", "params": {"currency": "EUR"}}'
```

The node checks `params` against the schema **before any miner is chosen or any
payment is taken**. A bad request returns `400 invalid_params` and costs nothing.
The full set of errors is in [Make a Request](engine-ask.md#canonical-ask-intent-params).
You get the answer in the intent's shape, the same keys whichever miner answers.

To see who serves an intent before you spend anything:

```bash
curl https://devnode.telegraphprotocol.com/engine/v1/intents/FX_NOW_EUR/miners
```

## Proposing a new intent

> **Not part of a bounty.** Bounties use only [Intents that already exist](../bounties/rules-and-rewards.md#only-intents-that-already-exist). Nobody proposes a new intent to complete a bounty.

Anyone can propose an intent under an existing prefix. The admin approves it
(possibly after editing the description or spec) or rejects it. Only an approved intent becomes canonical and reaches nodes.

### Before you propose

1. **Pick the prefix.** Run `getPrefixes()` and choose the family your intent
   belongs to. Your name must be `<PREFIX>_<SUFFIX>`. If no prefix fits, a new
   prefix needs the admin, so ask in the community channel first.
2. **Know the kind.** Your intent takes its prefix's kind. A judgment intent takes
   no spec. A deterministic or hybrid one needs the full spec above.
3. **Write a good description.** It is required (an empty one reverts), and it is
   what the intent classifier uses to decide whether a user's question belongs to
   your intent. Say what the question asks, give an example mapped to the intent,
   and say what it is **not**. For example, `FX_NOW_EUR` says: "Not: a pair
   without both USD and EUR. Not: 'How much is 100 USD in EUR?' (a conversion of
   a stated amount)". An intent with a vague description is canonical but
   effectively unroutable.

### Propose

A proposal posts a **$1 bond in MACHINA** (at the pool price; read it with
`intentProposalParams()`). It is released when the proposal is approved,
rejected or withdrawn; withdraw it to your wallet 2 days later with
`withdrawMinerBond()`. Need MACHINA? See
[Getting MACHINA](../protocol/addresses-and-params.md#getting-test-tokens). Approve the Diamond for it first:

```bash
MACHINA=0xd68305cA83C7AF42A4F720144E7416fB53F8AaF4
cast send $MACHINA "approve(address,uint256)" $DIAMOND 5000000000000000000 \
  --rpc-url $RPC --private-key $KEY

cast send $DIAMOND \
  "proposeIntent(string,string,(uint8,uint32,uint64,string[],string,string,string,string,string))" \
  "FX_NOW_JPY" "Query asks for the live mid-market rate between USD and the Japanese yen ..." \
  '(2,50,10000,["JPY"],"What is the current USD/{key} mid-market exchange rate?","FX_NOW_JPY mid-market rate","","<responseFormat JSON>","{}")' \
  --rpc-url $RPC --private-key $KEY
```

A judgment intent passes an empty spec (`(0,0,0,[],"","","","","")`). Proposing the
same intent again while it is pending **edits** it (only the proposer).

### Follow the proposal

```bash
cast call $DIAMOND "getIntentProposal(string)" "FX_NOW_JPY" --rpc-url $RPC
```

| Outcome | What happens |
|---|---|
| Approved | The admin calls `approveIntent` with the description and spec it accepts. The intent is added and emits `IntentAdded`. |
| Rejected | The admin calls `rejectIntent`. |
| Withdrawn | You call `withdrawProposal(intent)`. |

Nodes pick up an approved intent from the chain's events and
apply it from the **next epoch**. A node reads the chain at Sepolia's `safe`
block, so it sees the approval about 10 to 15 minutes after the transaction.

### What can go wrong

| Revert | Cause |
|---|---|
| `IntentCatalog: no registered prefix` | The name does not extend a registered prefix with `_` |
| `IntentCatalog: name is a prefix` | The name is itself a prefix |
| `IntentCatalog: intent exists` | The intent is already canonical |
| `IntentCatalog: a judgment intent takes no spec` | You sent keys, a template, fusion or scale for a judgment intent |
| `IntentCatalog: bad comparator` / `zero tolerance` / `zero scale` | The spec fails basic checks |
| `IntentCatalog: no question keys` / `empty question key` / `empty question template` | The spec is missing its question |
| `IntentCatalog: a hybrid intent needs fusion` / `fusion is for hybrid intents` | `fusion` missing for hybrid, or given for deterministic |
| `IntentCatalog: proposed by someone else` | You tried to edit another address's proposal |
| `MinerRegistryFacet: empty description` | The description is empty |
| `ERC20InsufficientAllowance` / `ERC20InsufficientBalance` | The Diamond could not take the $1 MACHINA bond. Hold enough MACHINA and `approve` the Diamond first |

## After your intent is approved

1. **Miners can register for it.** See [Registering as a Miner](../miners/miner-registration.md).
2. **It needs scoring material.** A deterministic or hybrid intent needs a truth
   source in the evaluation pool or it is not ranked. A judgment intent needs
   questions in the pool. See [Contribute Evaluation Data](../scoring/contribute-evaluation-data.md).
3. **It needs a request and answer format.** The node reads each intent's input
   schema and answer fields from a response format. Without one, the intent has no
   typed `params`, answers come back raw, and an on-chain job for it fails.

## A note on coverage

An intent being canonical means the protocol recognises it, not that a miner
serves it today. `/engine/v1/intents` reports a miner count per intent. An intent
with no miner is an opening: register a miner for it and you have no competition.
