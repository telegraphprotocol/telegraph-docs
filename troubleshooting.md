---
description: Common issues when using the Telegraph protocol and how to resolve them.
---

# Troubleshooting Common Issues

## x402 Payment (HTTP 402)

### Getting 402 errors when calling /engine/v1/ask

The x402 payment gate requires a valid USDC payment. An HTTP 402 response includes a payment challenge — you need to sign and submit the payment before retrying.

1. Ensure your wallet has **Base Sepolia USDC** (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`).
2. Get Base Sepolia USDC from the [Circle faucet](https://faucet.circle.com).
3. Use the payment flow: receive 402 challenge → sign permit → post payment → retry request.

### "invalid_exact_evm_signature" error

The EIP-712 domain name in the payment signature doesn't match. Base Sepolia USDC uses `"USDC"` (not `"USD Coin"`). Ensure your signing code uses the correct token name.

## ERC-8183 Jobs

### Job stuck in Funded state — never resolved

Jobs progress through states: Funded (`0`) → Terminal (`1`), or Cancelled (`2`).

**A job that stays Funded has failed, not stalled.** Resolution happens per job, within seconds of the miner answering — it is not batched into an epoch. If the miner is unreachable or returns an error, the listener deliberately does *not* resolve the job: there is no failed terminal state, your callback is never called, and the job sits in Funded indefinitely.

1. Check the job state on-chain. Note the doubled parentheses — `getJob` returns a struct, and without them `cast` fails with `could not decode output`:
```bash
cast call <diamond> "getJob(uint256)((address,bytes32,address,uint256,uint256,uint256,uint8,uint256))" <jobId> --rpc-url <rpc>
# (agent, intentId, callback, budget, minerPayment, protocolFee, state, createdAt)
```

2. Ensure a miner supporting your intent is registered and active.
3. Verify your job's OnChainData format matches what the miner expects:
   - `strings[0]` = model name (for LLM miners)
   - `strings[1]` onward = alternating role/content pairs for the `chat_messages` format
4. **Recover your funds with `cancelJob`.** Only the original agent can cancel, and it refunds the full budget to your escrow:
```bash
cast send <diamond> "cancelJob(uint256)" <jobId> --rpc-url <rpc> --private-key <key>
```

### Job reached Terminal but the result looks wrong

Check the output hash committed on-chain:

```bash
cast call <diamond> "getJobOutput(uint256)(bytes32)" <jobId> --rpc-url <rpc>
```

A non-zero hash means the miner answered and the job resolved. If the *content* isn't what you expected, the usual cause is an `OnChainData` layout mismatch — the response is packed at the indexes the serving miner declares in its YAML `on_chain.fields` block, not in a fixed order. Check that block for the miner that served you.

A reverting callback does not show up here: the protocol calls your callback inside `try … catch {}`, so the job reaches Terminal and the miner is paid even if delivery to your contract failed.

## Miner Registration

### "Schema validation failed" in node logs

Your YAML file has validation errors. Common causes:

- **Missing `base_url`**: Add a `base_url` starting with `http://` or `https://`
- **`signal_mapping.type` not allowed**: Remove the `type:` field. Use only `confidence_field`, `label_field`, and `reason_field`
- **`slug` not kebab-case**: Use lowercase letters and hyphens only
- **Invalid `auth.type`**: Must be `bearer`, `header`, or `none`
- **Missing `supported_intents`**: Add at least one canonical intent string

### "Hash mismatch" error

The SHA-256 of your hosted YAML doesn't match the on-chain hash. Your YAML content changed after you registered. Recompute the hash and point your registration at it with `updateMiner`, which replaces the entry in a single transaction:

```bash
sha256sum my-miner.yaml | awk '{print "0x"$1}'  # recompute
cast send <diamond> "updateMiner(uint256,string,bytes32,address,uint256,string[])" \
  <registrationId> "<yamlUrl>" "<newHash>" "<feeAddress>" <minPriceUsdc> '["INTENT"]' \
  --rpc-url <rpc> --private-key <key>
```

A common cause is a trailing-newline difference between the file you hashed and the bytes your host actually serves. Hash exactly what the URL returns:

```bash
curl -s "<yamlUrl>" | sha256sum
```

### Miner stuck in pending state

Activation is **not** tied to an epoch boundary — the node activates each registration as it processes that registration's event, usually within a minute. Waiting for an epoch will not help. If you're still pending:

- Confirm your YAML is publicly reachable at the declared URL (the node fetches it directly).
- Confirm the SHA-256 of what the URL serves matches your on-chain `yamlHash`.
- Check the node logs for a schema validation error — a rejected YAML stays pending rather than activating.

## WebSocket Signals

### WS connection drops immediately after connecting

Common causes:
- Invalid EIP-191 signature during wallet challenge
- Insufficient escrow balance — approve, then deposit USDC first:
```bash
cast send 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "approve(address,uint256)" <diamond> 1000000 --rpc-url <rpc> --private-key <key>
cast send <diamond> "depositUSDC(uint256)" 1000000 --rpc-url <rpc> --private-key <key>
cast call  <diamond> "escrowBalance(address)(uint256)" <yourAddress> --rpc-url <rpc>
```
(`1000000` = 1.0 USDC in 6‑decimal units, which is the WebSocket minimum. Skipping the approval fails with `ERC20: transfer amount exceeds allowance`.)

- Network firewall blocking WebSocket connections

### "wallet verification required for ask"

`ask` and `ask_direct` are **not** anonymous over WebSocket. Only `list_subnets` and `ping` work without a wallet. Reconnect with `?wallet_address=0x...` and complete the `auth_wallet` → `wallet_verify` handshake first.

### No signals received after subscribing

1. Verify your subscription with the `list_subscriptions` action on the same WebSocket connection — there is no HTTP endpoint for this.

2. Check you haven't hit your session `spend_limit_usdc`. When you do, the server sends a `limit_reached` message, cancels the subscription and closes the connection; you have to reconnect and resubscribe with a new limit.

3. Signals are generated by the daemon cycle and by user-initiated ask requests. The daemon runs on a configurable interval (default 30 minutes in production).

## Engine Ask Endpoint

### 404 on /v1/ask

The ask endpoint is at `/engine/v1/ask`, not `/v1/ask`. The engine routes are mounted under `/engine/`.

### Request returns null or empty

The engine classifies your query to an intent, then routes to the best-scored miner for that intent. If no miner supports the classified intent, the result may be empty. Check available intents:

```bash
curl http://<node>:7044/api/miners
```

## Contract Interactions

### "Function not authorized by enough owners"

Admin functions like `diamondCut` require owner authorization before execution. Authorize first:

```bash
cast send <diamond> "authorize(string)" "<functionName>" --rpc-url <rpc> --private-key <key>
cast send <diamond> "<functionName>(...)" ... --rpc-url <rpc> --private-key <key>
```

### "Function does not exist"

The selector isn't registered on the diamond. Check which facet (if any) handles it:

```bash
cast call <diamond> "facetAddress(bytes4)(address)" <selector> --rpc-url <rpc>
```

Returns `0x0000...` if the function isn't available. It may need to be added via `diamondCut`.

### Transaction nonce errors with cast

The node may consume nonces faster than `cast send`. Retry with a delay:

```bash
cast send ... --rpc-url <rpc> --private-key <key> || sleep 3 && cast send ... --rpc-url <rpc> --private-key <key>
```
