---
description: What changed in the V2 release and what you need to change, by role. Start here if you built against the earlier version.
---

# What Changed in V2

This page lists what changed between the earlier release and V2, grouped by who you are. Each row says what it was, what it is now, and where to read the details.

## If you call the API

| Before | Now | Details |
|---|---|---|
| `result` was the miner's raw JSON. A separate `parsed` object held extracted fields. | `result` is read into the **Intent's own shape**: the same keys, in the same order, whichever miner answered. `parsed` is gone. New fields: `result_shape`, `field_status`, `format_version`, `shape_error`. | [Engine Inference](using/engine-ask.md#the-answers-shape) |
| Only a `query` on `/ask`. Native `method`/`endpoint`/`payload` on `/ask/{id}`. | You can also send **`intent` + `params`** on both, validated against the Intent's request schema **before any payment**. A bad request returns `400 invalid_params` and costs nothing. | [Canonical ask](using/engine-ask.md#canonical-ask-intent--params) |
| No way to see what an Intent expects or returns. | `GET /engine/v1/intents/{intent}` returns the request schema, the response format and the exact on-chain layout. | [Intents](using/intents.md#asking-with-an-intent) |
| Escrow withdrawals unlocked after 4 hours. | They unlock after **two more blocks settle** (blocks are 24 hours) or **7 days**, whichever comes first. | [Withdrawing](using/escrow-inference.md#withdrawing) |
| The escrow payment message had no chain in it. | It includes `Network: eip155:<chainId>`. Sign the template exactly as given. | [Escrow](using/escrow-inference.md#step-2-read-the-challenge) |
| New errors: none. | `429` when a client asks too many new questions a minute. `503 extraction_unavailable` and `503 no_compatible_miner`. | — |

## If you build a smart contract

| Before | Now | Details |
|---|---|---|
| `outboundSubnetMessage` sent a request to one miner (gas only). | **Removed**, with `SubnetFacet`. Use a **job**. | [Moving over](using/onchain-miner-requests.md) |
| `createJob` only, paid from escrow. | Also `createJobCapped` (price limit), `createJobAndPay` (pay from your own USDC in the same call) and `createJobForMiner` (prefer one miner). | [On-Chain Jobs](using/erc8183-jobs.md#step-3-create-the-job) |
| A job's params and answer followed whichever miner served it (its YAML `on_chain` block). | Both are **fixed per Intent**, the same for every miner. Read the layout from `GET /engine/v1/intents/{intent}` (`onchain`). | [Step 2](using/erc8183-jobs.md#step-2-find-the-intent-id-and-its-layout) |
| `intentId` could be a miner's registration id. | `intentId` must be `keccak256` of a canonical **Intent** name. Use `createJobForMiner` to prefer a miner. | [Step 2](using/erc8183-jobs.md#step-2-find-the-intent-id-and-its-layout) |
| A failed miner call left the job `Funded` until you cancelled. The callback never fired. | The validator quorum **fails** the job: refund at once, `JobFailed` event, and your callback gets `success = false` with the reason. | [When a job fails](using/erc8183-jobs.md#when-a-job-fails) |
| `JobCreated` had four fields. | `JobCreated` carries the request (`miner` and `params`). | [Step 3](using/erc8183-jobs.md#step-3-create-the-job) |
| The callback got a small gas budget by accident. | A defined stipend (`jobCallbackGas`, genesis 300,000). | [Step 4](using/erc8183-jobs.md#step-4-implement-the-callback) |

## If you run a miner

| Before | Now | Details |
|---|---|---|
| You listed canonical intents such as `WEATHER_FORECAST`. | You list **intents**, never family prefixes. `WEATHER_FORECAST` is a prefix. List `WEATHER_FORECAST_LAHORE`, or a `_GENERAL` intent. | [Intents](using/intents.md#prefixes-and-intents) |
| To change anything you deregistered and registered again. | `updateMiner` (and the relayed `updateMinerFor`) changes your YAML, price, address or intents in one transaction. | [Updating your miner](miners/miner-registration.md#updating-your-miner) |
| The node's model read your whole answer. | You may declare an **`intent_mapping`**: paths and formulas that read each field exactly. | [Intent mapping](miners/yaml-config.md#intent-mapping-optional) |
| Jobs used your `on_chain.request` and `on_chain.fields` blocks. | Jobs no longer read them. The node builds your request from the Intent's inputs and reads your answer into the Intent's processed answer. | [YAML](miners/yaml-config.md#on-chain-jobs-and-the-on_chain-block) |

## If you want a new Intent

| Before | Now | Details |
|---|---|---|
| A flat list of 108 intents set at genesis, changed by the admin. | **Prefixes** (families) and **intents** under them. Anyone can **propose** an intent; the admin approves it. A deterministic or hybrid intent carries an on-chain spec. | [Proposing a new intent](using/intents.md#proposing-a-new-intent). Not part of Season II bounties, which use only [intents that already exist](bounties/season-two.md). |

## If you write scoring adapters or contribute data

| Before | Now | Details |
|---|---|---|
| MiniLM `rank_answer` modules, then Q32.32 packages. | **Float model adapters** in WASM. The older formats are refused. | [Build an Evaluator Adapter](scoring/build-a-scoring-module.md) |
| `registerWasm(hash, url, intent, feeAddress)`, gas only. | `registerWasm(hash, url, prefix, feeAddress, runnableUrl)`. You register on a **prefix** (a family), supply a **runnable endpoint** the node checks first. | [Registering directly](scoring/build-a-scoring-module.md#registering-directly) |

## If you deploy the contracts

| Before | Now | Details |
|---|---|---|
| `FullDeploy` and `ConfigureDiamond`. | `DeployProd`, then `UpgradeToFlywheel`, then register the validator, then add intents with `RegisterIntentCatalog`. | — |
| Genesis seeded 108 intents. | Genesis seeds **prefixes** only. Miners cannot register until intents exist. | [Intents](using/intents.md#prefixes-seeded-at-genesis) |
| Moving chains meant everyone re-registered. | An admin **imports** every active miner (same owner and id), then closes the migration. | — |
