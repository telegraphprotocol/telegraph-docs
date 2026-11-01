---
description: What changed in the V2 release and what you need to change, by role. Start here if you built against the earlier version.
---

# What Changed in V2

This page lists what changed between the earlier release and V2, grouped by who you are. Each row says what it was, what it is now, and where to read the details.

## Everyone

| Before | Now | Details |
|---|---|---|
| Base Sepolia (chain ID 84532). | **Ethereum Sepolia** (chain ID `11155111`), with new contract addresses. Every call still goes to one Diamond. | [Addresses & Parameters](protocol/addresses-and-params.md) |
| Circle USDC on Base Sepolia; USDC on Solana Devnet. | A **test USDC on Ethereum Sepolia** that anyone can mint with `mint(address,uint256)`. Payments are EVM only. | [Addresses & Parameters](protocol/addresses-and-params.md) |
| Emissions: 60% Validators, 20% script authors, 20% Treasury. | **25% Validators, 50% Evaluators, 25% Treasury.** Each intent's Evaluator share goes 30% to its adapter and 70% to the evaluation material it used. | [Tokenomics](protocol/tokenomics.md) |

## If you call the API

| Before | Now | Details |
|---|---|---|
| `result` was the miner's raw JSON. A separate `parsed` object held extracted fields. | `result` is read into the **Intent's own shape**: the same keys, in the same order, whichever miner answered. `parsed` is gone. New fields: `result_shape`, `field_status`, `format_version`, `shape_error`. | [Make a Request](using/engine-ask.md#the-answers-shape) |
| Only a `query` on `/ask`. Native `method`/`endpoint`/`payload` on `/ask/{id}`. | You can also send **`intent` + `params`** on both, validated against the Intent's request schema **before any payment**. A bad request returns `400 invalid_params` and costs nothing. | [Canonical ask](using/engine-ask.md#canonical-ask-intent-params) |
| No way to see what an Intent expects or returns. | `GET /engine/v1/intents/{intent}` returns the request schema, the response format and the exact on-chain layout. | [Intents](using/intents.md#asking-with-an-intent) |
| Escrow withdrawals unlocked after 4 hours. | They unlock after **two more blocks settle** (1 hour each on the testnet, 24 hours on mainnet) or **7 days**, whichever comes first. | [Withdrawing](using/escrow-inference.md#withdrawing) |
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
| The callback got a small gas budget by accident. | A defined stipend (`jobCallbackGas`, 1,000,000 on the testnet). | [Step 4](using/erc8183-jobs.md#step-4-implement-the-callback) |

## If you run a miner

| Before | Now | Details |
|---|---|---|
| You listed canonical intents such as `WEATHER_FORECAST`. | You list **intents**, never family prefixes. `WEATHER_FORECAST` is a prefix. List `WEATHER_FORECAST_LAHORE`, or a `_GENERAL` intent. | [Intents](using/intents.md#prefixes-and-intents) |
| Registration cost gas only. | A small **bond in MACHINA**: $1 for the first intent, $0.10 each up to 9, then $0.07. Approve the Diamond first. It is returned when you deregister (withdraw after 2 days). | [Registering as a Miner](miners/miner-registration.md#step-4-register-on-chain) |
| To change anything you deregistered and registered again. | `updateMiner` (and the relayed `updateMinerFor`) changes your YAML, price, address or intents in one transaction. | [Updating your miner](miners/miner-registration.md#updating-your-miner) |
| The node's model read your whole answer. | You may declare an **`intent_mapping`**: paths and formulas that read each field exactly. | [Intent mapping](miners/yaml-config.md#intent-mapping-optional) |
| Jobs used your `on_chain.request` and `on_chain.fields` blocks. | Jobs no longer read them. The node builds your request from the Intent's inputs and reads your answer into the Intent's processed answer. | [YAML](miners/yaml-config.md#on-chain-jobs-and-the-onchain-block) |

## If you want a new Intent

| Before | Now | Details |
|---|---|---|
| A flat list of 108 intents set at genesis, changed by the admin. | **Prefixes** (families) and **intents** under them. Anyone can **propose** an intent with a $1 MACHINA bond (returned); the admin approves it. A deterministic or hybrid intent carries an on-chain spec. | [Proposing a new intent](using/intents.md#proposing-a-new-intent). Not part of a bounty: bounties use only [Intents that already exist](bounties/rules-and-rewards.md#only-intents-that-already-exist). |

## If you write scoring adapters or contribute data

| Before | Now | Details |
|---|---|---|
| MiniLM `rank_answer` modules, then Q32.32 packages, then full-model float `.wasm` adapters. | **Evaluator adapters as safetensors deltas** (a few MB of LoRA deltas and a reward head) on the validators' **shared Foundation Model**. Every older format is refused (a full-model `.wasm` with `legacy_full_model`). | [Upgrading to the Shared Foundation Model](scoring/upgrade-shared-foundation.md) |
| `registerWasm(hash, url, intent, feeAddress)`, gas only. | `registerWasm(hash, url, prefix, feeAddress, runnableUrl)` with a **$5 MACHINA bond** (returned on deregistration). You register on a **prefix** (a family) and supply a **runnable endpoint** the node checks first. | [Registering directly](scoring/build-a-scoring-module.md#registering-directly) |
