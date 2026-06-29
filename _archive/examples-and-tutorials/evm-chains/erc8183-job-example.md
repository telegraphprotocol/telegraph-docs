---
description: "Create an ERC-8183 job, retrieve on-chain results, and get raw miner responses."
---

# ERC-8183 Job Example

This tutorial covers the full job lifecycle: creating a job on-chain, waiting for automatic resolution by a Telegraph node, and retrieving both the on-chain output and the raw miner response. Use this alongside the [Subnet Inference Example](subnet-inference-example.md) if you prefer the traditional subnet callback pattern.

---

## How ERC-8183 Jobs Work

The JobFacet on the Diamond supports the ERC-8183 standard for AI job requests:

1. **Create** — An agent calls `createJob` with miner addresses, budgets, intent strings, and an optional executor address
2. **Listen** — Telegraph nodes detect the `JobCreated` event, resolve the intent to the best available miner, and dispatch the inference request
3. **Resolve** — The node calls `transitionToTerminal` on-chain with the output hash, auto-resolving the job
4. **Settle** — The settlement engine executes a Uniswap V3 swap (USDC → MACHINA) and pays the miner
5. **Retrieve** — The agent fetches on-chain job details via `getJob` and the raw miner response from the node's result endpoint

---

## 1. Creating a Job

Call `createJob` on the Diamond. The function signature is:

```
createJob(address[] miners, uint256[] budgets, string[] intents, bool[] supportsBatchedResponses)
```

Each array must have the same length. `miners` declares which miners (by registration address) you are willing to use. `budgets` sets the maximum USDC payment per miner. `intents` declares what kind of intelligence you need. `supportsBatchedResponses` can be set to `false` for individual jobs.

### Example with Cast

```bash
DIAMOND="0x45b0A6e07E2e15D203f3B5285945c549221f5b0a"
RPC="https://base-sepolia.g.alchemy.com/v2/aKrIQPvnY5pM8AkdVNDM7"

cast send "$DIAMOND" \
  "createJob(address[],uint256[],string[],bool[])" \
  "[0xB82E4DE09f1C43BBD9ca4907c01f1EEd65a521B9]" \
  "[10000]" \
  '["chat_completion"]' \
  "[false]" \
  --rpc-url "$RPC" \
  --private-key "$AGENT_PRIVATE_KEY"
```

- `miners`: Array of operator addresses eligible to fulfill this job
- `budgets`: Max USDC per miner in 6-decimal format (10000 = $0.01, 100000 = $0.10)
- `intents`: Canonical intent strings from the intent registry
- `supportsBatchedResponses`: Whether multiple results can be batched

### Parameter Reference

| Parameter | Type | Description |
|---|---|---|
| `miners` | `address[]` | Miner operator addresses eligible to fulfill the job |
| `budgets` | `uint256[]` | Maximum USDC payment per miner (6-decimal, min 10000 = $0.01) |
| `intents` | `string[]` | Canonical intent strings (e.g., `"chat_completion"`, `"web_search"`) |
| `supportsBatchedResponses` | `bool[]` | Whether batching is supported per miner (use `false` for single jobs) |

**Array lengths must match.** Each index corresponds to one miner-budget-intent triplet.

---

## 2. Waiting for Resolution

After job creation, a Telegraph node automatically:

1. Detects the `JobCreated` event on-chain
2. Maps the intent string to the best registered miner's slug
3. Dispatches the inference request through the miner's declared API
4. Receives the response and computes the `keccak256` output hash
5. Calls `transitionToTerminal` on the Diamond with the output hash

On Base Sepolia with an active node, resolution typically completes within 15–30 seconds. No manual action is needed.

---

## 3. Retrieving On-Chain Job Details

Use `getJob(jobId)` on the Diamond to read the job state:

```bash
cast call "$DIAMOND" \
  "getJob(uint256)(address,uint256,string,uint8,bool,bytes32)" \
  "$JOB_ID" \
  --rpc-url "$RPC"
```

Returns: agent address, budget, intent, state enum, terminal flag, output hash.

The output hash (`bytes32`) is the `keccak256` of the miner's raw response. You can verify consistency against the raw response retrieved from the node.

State enum values: `0` = Pending, `1` = Dispatched, `2` = Terminal.

---

## 4. Retrieving the Raw Miner Response

Every resolved job stores the raw miner response off-chain. Fetch it from any Telegraph node:

```bash
curl http://your-node:7044/v1/job/$JOB_ID/result
```

Returns the raw JSON response exactly as returned by the miner's API. No filtering or transformation is applied. You can verify this against the on-chain `outputHash`:

```bash
# Verify result matches on-chain hash
RAW_HASH=$(curl -s http://your-node:7044/v1/job/$JOB_ID/result | keccak-256)
echo "Raw hash: $RAW_HASH"
echo "On-chain hash: $ON_CHAIN_OUTPUT_HASH"
```

This gives agents full auditability: on-chain proof of resolution plus the complete raw response.

---

## Summary

| Step | What to do |
|------|------------|
| 1 | Call `createJob(miners, budgets, intents, supportsBatchedResponses)` on the Diamond |
| 2 | Wait ~15–30s for auto-resolution (no action needed) |
| 3 | Call `getJob(jobId)` on-chain to verify job state and output hash |
| 4 | Call `GET /v1/job/{id}/result` on any Telegraph node to get the raw miner response |
| 5 | Verify: `keccak256(rawResponse) == outputHash` |

## Related Documentation

- [Dapp Examples — Interface & Implementation Guide](../../dapp-examples/README.md) — Full Diamond interface reference
- [Subnet Inference Example](subnet-inference-example.md) — Traditional subnet callback pattern
- [Contract Documentation](../../contract-documentation/port-contract.md) — Diamond facets and events
- [Miner Registry](../../miner-registry/README.md) — Registering as a miner
