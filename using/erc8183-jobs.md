---
description: Create on-chain AI inference jobs from a smart contract using the ERC-8183 standard — your contract funds the job and receives the result via callback.
---

# On-Chain Jobs (ERC-8183)

ERC-8183 is an on-chain standard for agentic commerce: a smart contract creates a job by escrowing USDC, specifies what it wants (an Intent and parameters), and receives the result via a callback function once the protocol resolves it. No off-chain coordination needed — the entire lifecycle is on-chain.

Use this when:
- A smart contract needs AI inference as part of its logic (e.g., a prediction market settling on AI-verified data, a DeFi protocol adjusting parameters based on on-chain signals).
- You want an auditable on-chain record of the request, the miner that served it, and a hash committing to the result.
- You want composability — your callback contract can take any action on receipt of the result.

> **Testnet maturity.** On Base Sepolia the job rail is wired end to end but lightly exercised, and BLS signature verification over job resolution is currently disabled (`blsPublicKey[0] == 0`), so resolution is authorised by the settlement oracle rather than a validator quorum. Treat on-chain jobs as functional-but-early on testnet.

## The Job Lifecycle

```
Agent (your contract) → createJob() → [JobCreated event]
                                            ↓
                              Protocol listener routes to miner
                                            ↓
                                    Miner responds
                                            ↓
                            transitionToTerminal() called on-chain
                              (by the settlement authority)
                                            ↓
                        98% USDC → TWAP → MACHINA → miner
                        2% USDC → Treasury
                                            ↓
                          callback.subnetMessage() called on your contract
```

States: `Funded (0)` → `Terminal (1)` (on completion), or `Cancelled (2)` if cancelled before it reaches Terminal.

## Step 1: Deposit USDC to Escrow

Your wallet (or contract) must hold USDC in the Diamond's escrow before creating a job. The escrow is funded in the token the Diamond is configured to use — on Base Sepolia that is Circle's canonical USDC, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. You can confirm it yourself:

```bash
cast call $DIAMOND "usdcToken()(address)" --rpc-url $RPC
```

Approve first, then deposit. Skipping the approval fails with `ERC20: transfer amount exceeds allowance`:

```bash
# 1 — approve the Diamond to move your USDC
cast send 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "approve(address,uint256)" $DIAMOND 1000000 \
  --rpc-url $RPC --private-key $KEY

# 2 — deposit into escrow
cast send $DIAMOND "depositUSDC(uint256)" 1000000 \
  --rpc-url $RPC --private-key $KEY

# 3 — confirm it landed
cast call $DIAMOND "escrowBalance(address)(uint256)" $YOUR_ADDRESS --rpc-url $RPC
```

`escrowBalance(address)` is the only escrow getter exposed on the Diamond — `getEscrowBalance()` and `available()` are not part of the external surface.

Deposit at least one job's worth (see [Budget and Pricing](#budget-and-pricing)). The escrow has a 4-hour timelock on withdrawals, so deposit what you'll actually need.

## Step 2: Find the Intent ID

`createJob` takes a `bytes32` intentId. There are two kinds, and which one you need depends on the intent.

**Option A — hash the intent name.** For the intents the listener resolves by name, the intentId is simply the keccak256 of the canonical intent string:

```bash
cast keccak "CHAT_COMPLETION"
# 0xccd42820467c59d6f703fb6d0fe57d6303fbfaa893759ee493c29293adfdc1f7
```

The job is then routed to whichever live miner currently ranks best for that intent. This works for:

`LANGUAGE_GENERATION` · `CHAT_COMPLETION` · `WEATHER_CHECK` · `STORM_ALERT` · `WEATHER_FORECAST` · `TASK_COMPLETION` · `AGENT_TASK` · `WEB_SEARCH` · `NEWS_SEARCH` · `FACT_CHECK` · `AI_TEXT_DETECTION` · `CONTENT_VERIFICATION` · `DEEPFAKE_DETECTION` · `MEDIA_AUTHENTICITY_CHECK` · `IMAGE_VERIFICATION` · `VIDEO_VERIFICATION`

**Option B — read a specific miner's registration.** Every registration also gets its own intentId, derived as `keccak256(miner ‖ yamlHash ‖ registrationBlock)`. Use this to pin a job to one specific miner, and for any canonical intent not in the list above (`CRYPTO_PRICE`, `TVL_LOOKUP`, `SPORTS_SCORE`, `TELEGRAPH_KNOWLEDGE`, and the rest). It is the **fifth** return value of `getMiner`:

```bash
cast call $DIAMOND \
  "getMiner(uint256)(address,string,bytes32,bool,bytes32,address,uint256,string[])" \
  63 --rpc-url $RPC

# → field 4 (bool)    active     — must be true
# → field 5 (bytes32) intentId   — the value you pass to createJob
```

There is no index from intent to registration, so finding one means walking `1..minerCount()` and keeping the entries where `active == true`. Note that the numeric `id` in the `/api/miners` response is **not** a registrationId — the two are separate namespaces.

## Step 3: Create the Job

Call `createJob` on the Diamond contract. The function signature:

```
createJob(bytes32 intentId, OnChainData params, address callback)
```

where `OnChainData` is:

```solidity
struct OnChainData {
    address[] addresses;  // EVM addresses (up to 5)
    uint256[] integers;   // Integer values
    string[] strings;     // Text, URLs, or decimals as strings
    bool[] bools;         // Boolean flags
}
```

This struct is how you pass parameters to the miner. What goes in each array depends on the Intent — check the miner's YAML `on_chain.request` block for the expected format. For an LLM chat completion, the `chat_messages` format expects role/content pairs from the source index:

- `strings[0]` — model name (must be one the target miner accepts — see its `input_schema` in `/api/miners`)
- `strings[1]` — role (e.g., `"user"`)
- `strings[2]` — content (e.g., `"What is 2+2?"`)

For multiple messages, continue alternating role/content.

The other arrays carry optional generation settings, picked up automatically when present:

| Slot | Becomes |
|---|---|
| `integers[0]` | `max_tokens` (when greater than zero) |
| `bools[0]` | `stream` |
| `bools[1]` | `logprobs` |
| trailing odd `strings[]` entry that parses as a float | `temperature` |

**Example — Chat completion job:**

```bash
cast send 0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8 \
  "createJob(bytes32,(address[],uint256[],string[],bool[]),address)(uint256)" \
  "0xccd42820467c59d6f703fb6d0fe57d6303fbfaa893759ee493c29293adfdc1f7" \
  '([],[],["telegraph-assistant","user","What is 2+2?"],[false])' \
  "0x0000000000000000000000000000000000000000" \
  --rpc-url https://base-sepolia.g.alchemy.com/v2/<KEY> \
  --private-key <YOUR_KEY>
```

This emits a `JobCreated` event with exactly four fields:

```solidity
event JobCreated(
    uint256 indexed jobId,
    address indexed agent,
    bytes32 intentId,
    address callback
);
```

| Field | Description |
|---|---|
| `jobId` | Sequential job identifier |
| `agent` | Your wallet/contract address |
| `intentId` | The intent you targeted |
| `callback` | Where the result will be delivered |

**The amounts are not in the event.** `budget`, `minerPayment` and `protocolFee` are stored on the job record — read them back with `getJob(jobId)`:

```bash
cast call $DIAMOND \
  "getJob(uint256)((address,bytes32,address,uint256,uint256,uint256,uint8,uint256))" \
  $JOB_ID --rpc-url $RPC
# (agent, intentId, callback, budget, minerPayment, protocolFee, state, createdAt)
```

Note the doubled parentheses — `getJob` returns a struct, and without the extra pair `cast` fails with `could not decode output`.

The fee is `protocolFeeBasisPoints` on the Diamond, which defaults to 200 (2%), leaving 98% for the miner. At the current job price of `1000000` that's `minerPayment=980000` + `protocolFee=20000`.

## Step 4: Implement the Callback

A callback is optional. Pass the zero address if you don't want one — the job still runs and still settles, you just read the outcome yourself with `getJob` and `getJobOutput`. If you *do* pass an address, it must be a deployed contract with code; `createJob` reverts with `callback has no code` otherwise.

Your callback contract implements `subnetMessage` (the name is legacy — it delivers a miner's result):

```solidity
function subnetMessage(
    uint256 jobId,
    bool success,
    OnChainData memory response,
    string memory errorMessage
) external {
    require(msg.sender == DIAMOND_ADDRESS, "only protocol");

    // success is always true and errorMessage always "" — see below.
    // Where each value lands is fixed by the miner's YAML on_chain.fields.
    string memory reply = response.strings[0];
    // handle result...
}
```

Two things about how this is actually invoked matter more than the signature:

- **`success` is always `true` and `errorMessage` is always `""`.** The callback only fires on a successful resolution — a failed job never reaches Terminal, so it never calls you at all. Don't build an error path here; see [When a job fails](#when-a-job-fails).
- **Your revert is swallowed.** The protocol calls you inside `try … catch {}`. If your callback reverts, runs out of gas, or misbehaves, the job **still** transitions to Terminal and the miner is **still** paid. You will not get a retry and there is no on-chain signal that delivery failed. Keep the callback minimal — store the result and do heavy work in a separate transaction.

### Where your result lands

`response` is not free-form. Each value is placed at the index the serving miner declares in its YAML `on_chain.fields` block, so the layout is knowable ahead of time. For the Telegraph Knowledge miner, for example:

| Slot | Field | Taken from the miner's response |
|---|---|---|
| `strings[0]` | `response_text` | `choices.0.message.content` |
| `strings[1]` | `model` | `model` |
| `integers[0]` | `completion_tokens` | `usage.completion_tokens` |
| `integers[1]` | `prompt_tokens` | `usage.prompt_tokens` |

Check the `on_chain.fields` block of the miner you're targeting before you index into `response`.

## Step 5: Wait for Terminal

After `JobCreated`, the protocol listener:
1. Detects the event and re-reads the `createJob` calldata to recover your `OnChainData` params — the event itself doesn't carry them.
2. Routes to the miner matching the `intentId`.
3. Receives the miner's response and maps it into an `OnChainData` response.
4. Calls `transitionToTerminal` for that job.

**This is not batched into the epoch.** Each job is resolved on its own as soon as the miner answers — expect seconds, not an epoch boundary.

The `transitionToTerminal` function takes six arguments (`blsSalt` is easy to miss):
```
transitionToTerminal(uint256,bytes32,address,bytes,uint256,(address[],uint256[],string[],bool[]))
                     jobId   outputHash miner blsSig blsSalt response
```

It is permissioned — only the settlement oracle (or the contract owner) can call it, so you cannot resolve your own job.

After terminal transition:
- The protocol fee (`20000` = $0.02 USDC at the current price) goes to the Treasury.
- The miner payment (`980000` = $0.98 USDC) is swapped USDC → MACHINA and sent to the miner.
- Your callback contract receives the result, if you supplied one.

## When a job fails

If the miner is unreachable or returns an error, the listener **deliberately does not resolve the job**. There is no "failed" terminal state and no error callback:

- The job stays in `Funded` (state `0`) indefinitely.
- Your callback is never called.
- Your budget is still debited from escrow, but it is still yours.

Recovery is `cancelJob(jobId)`, which returns the full budget to your escrow. This is by design — an unresolvable job leaves the money somewhere its owner can still reach, rather than paying a miner that did no work.

So: **a job sitting in `Funded` for more than a minute or two is not still in progress — it has failed, and you should cancel it.**

## Cancelling a Job

If you need to cancel a job before it reaches Terminal:

```
JobFacet.cancelJob(jobId)
```

Only the original `agent` can cancel. Cancelled jobs return the USDC budget to your escrow. A job cannot be cancelled once it has reached Terminal.

## Budget and Pricing

**You do not choose the budget.** `createJob` prices the job itself and debits that amount from your escrow. The price is a single protocol-wide `jobBasePrice`, scaled by the [demand multiplier](../protocol/addresses-and-params.md#demand-multiplier-tiers) for the target Intent's 24-hour volume.

A miner's `minPriceUsdc` — the floor price used for x402 pay-per-call inference — is **not** used for job pricing. Read the job price instead:

```bash
cast call $DIAMOND "getJobBasePrice()(uint256)" --rpc-url $RPC
# 1000000  → 1.000000 USDC per job at the base rate
```

At the time of writing that is **1 USDC per job**, so escrow at least `1000000` before calling `createJob`. If your available escrow is short, the call reverts with `insufficient escrow balance`.

Because the multiplier only ever raises the price, budget for more than the base rate on a busy intent.
