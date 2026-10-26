---
description: The old on-chain miner request rail (outboundSubnetMessage) was removed with SubnetFacet. On-chain requests are now jobs. This page shows how to move over.
---

# On-Chain Miner Requests (removed)

> **This rail no longer exists.** `SubnetFacet` was deleted from the Diamond, and with it `outboundSubnetMessage`, the `SubnetRequestOut` and `SubnetResponseIn` events, `getSubnetRequest` and `executeInboundSubnetMessage`. Every on-chain request is now a **job**. Use [On-Chain Jobs](erc8183-jobs.md).

If you are reading this because a contract of yours calls `outboundSubnetMessage`, it will revert on a current deployment. Here is what to change.

## What was different, and what it is now

| | Old miner request | Job (now) |
|---|---|---|
| Entry point | `outboundSubnetMessage(subnetId, endpoint, params, callback)` | `createJob`, `createJobCapped`, `createJobAndPay` or `createJobForMiner` |
| You target | a miner id and an endpoint keyword | an **intent** (`bytes32` hash of its canonical name) |
| Cost | gas only | USDC, from escrow or paid in the same call |
| Concurrency | one outstanding request protocol-wide | many jobs in flight at once |
| Callback | mandatory | optional |
| Request layout | the miner's YAML `on_chain.request` block | the **intent's** layout, the same for every miner |
| Answer layout | the miner's YAML `on_chain.fields` block | the **intent's** processed answer, the same for every miner |
| Failure | callback called with `success = false` | the quorum fails the job, you are refunded, callback called with `success = false` |

## Moving a contract over

1. **Pick an intent instead of a miner.** Find the intent your old miner served, for example from `GET /engine/v1/intents/{intent}/miners`. The intent id is `keccak256` of its canonical name.
2. **Read the intent's layout.** `GET /engine/v1/intents/{intent}` returns `onchain.request` (where each input goes) and `onchain.response` (where each answer field arrives). You no longer read a miner's YAML.
3. **Pay for it.** Fund escrow and use `createJobCapped`, or approve the Diamond and use `createJobAndPay`.
4. **Keep your callback, change what it reads.** The function is still `subnetMessage(uint256,bool,OnChainData,string)`. `success` is now meaningful: `false` means the job failed and you were refunded. Read the answer by the intent's layout.
5. **Pin a miner if you must.** `createJobForMiner(intentId, miner, ...)` tries one registration first and falls back to the intent's ranked miners, so a single miner outage does not fail your job.

Everything is explained step by step, with the reverts you may hit, in [On-Chain Jobs](erc8183-jobs.md).

## A note on the `subnet` names

The callback keeps its legacy name, `subnetMessage`, and your callback contract may still implement `ISubnetReceiverContract`. Only the request side was removed. What `subnet` addresses is a **miner**, as everywhere else in the API.
