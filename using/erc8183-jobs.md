---
description: Request processed intelligence from a smart contract and receive it in an authenticated callback.
---

# Use Intelligence On-Chain

ERC-8183 is an on-chain standard for agentic commerce. A smart contract creates a **job**: it pays for it, names an [intent](intents.md) and its parameters, and receives the result in a callback once the protocol resolves it. The whole lifecycle is on-chain.

Jobs are the **only** on-chain request rail. The older "on-chain miner request" (`outboundSubnetMessage`) was removed together with `SubnetFacet`. See [On-Chain Miner Requests](onchain-miner-requests.md) for how to move over.

Use jobs when:
- A smart contract needs intelligence as part of its logic (a prediction market settling on verified data, a DeFi protocol adjusting a parameter).
- You want an auditable on-chain record of the request, the miner that answered, and a hash committing to the answer.
- You want your callback to take any action on receipt of the result.

> **Two things changed in V2 that affect every integration.** First, the request and the answer are now **fixed per intent**. You no longer read a miner's YAML to learn where things go; you read the intent's layout from the node. Second, a job can **fail**. If no miner can answer, the validator quorum fails the job and your agent is refunded at once, and your callback is told.

## The job lifecycle

```
Your contract → createJob*() → [JobCreated event, carries the request]
                                          ↓
                      Node routes to the intent's ranked miners
                      builds the miner request from the intent's inputs
                                          ↓
                                  Miner responds
                                          ↓
              Node reads the answer into the intent's processed answer
                                          ↓
         Validator quorum signs the resolution (or a failure)
                                          ↓
       transitionToTerminal()  or  failJob()   called on-chain
                                          ↓
   resolved: 98% USDC → TWAP → MACHINA → miner, 2% USDC → Treasury, callback gets the answer
   failed:   agent refunded at once, callback gets ok = false
```

States: `Funded (0)`, then `Terminal (1)` when resolved, or `Cancelled (2)` when cancelled or failed.

## Step 1: Put USDC where the job can be paid from

You can pay a job two ways.

**Pay from escrow.** Deposit USDC to the Diamond's escrow first, then call `createJob` or `createJobCapped`. The price is debited from escrow.

```bash
# approve the Diamond to move your USDC, then deposit into escrow
cast send $USDC "approve(address,uint256)" $DIAMOND 1000000 --rpc-url $RPC --private-key $KEY
cast send $DIAMOND "depositUSDC(uint256)" 1000000 --rpc-url $RPC --private-key $KEY
cast call $DIAMOND "escrowBalance(address)(uint256)" $YOUR_ADDRESS --rpc-url $RPC
```

**Pay in the same call.** `createJobAndPay` pulls the price from the caller's own USDC with `transferFrom`, so the caller only approves the Diamond. Escrow is not touched. This lets a dapp pull its user's USDC and pay in one transaction.

> Escrow withdrawals unlock after two more blocks settle (blocks are 24h) or after 7 days, whichever comes first. They no longer use a 4-hour timelock. See [Paying from Escrow](escrow-inference.md#withdrawing).

## Step 2: Find the intent id and its layout

`createJob*` takes a `bytes32 intentId`. It is the `keccak256` of the **canonical intent name**:

```bash
cast keccak "FX_NOW_EUR"
```

It must be a canonical **intent**, not a prefix and not a miner registration id. Anything else reverts with `not a canonical intent`. A prefix such as `FX_NOW` is not an intent. See [Intents](intents.md).

Then read the intent's layout. This is the contract between you and the node:

```bash
curl https://devnode.telegraphprotocol.com/engine/v1/intents/FX_NOW_EUR
```

Look at three things in the reply.

- `onchain.ready` must be `true`. If it is `false`, a job for that intent fails at once with reason 3 (see [When a job fails](#when-a-job-fails)). `onchain.reason` says why.
- `onchain.request` is where each input goes in your `params`.
- `onchain.response` is where each field of the answer arrives in your callback.

Each entry has a `slot` (`strings`, `integers` or `bools`) and an `index` within it:

```json
"onchain": {
  "ready": true,
  "request":  [ { "name": "location", "type": "string",  "slot": "strings",  "index": 0, "max_bytes": 256 },
                { "name": "window_hours", "type": "integer", "slot": "integers", "index": 0, "range": [1, 240] } ],
  "response": [ { "name": "temp_c", "type": "number", "slot": "integers", "index": 0, "decimals": 2,
                  "unit": "degrees Celsius", "range": [-90, 60] } ],
  "off_chain": ["summary"]
}
```

(The names above are illustrative. Read the real ones from the node.)

### How values are laid out

| Type | Slot | As |
|---|---|---|
| `number` | `integers` | `round(value x 10^decimals)`, half away from zero, as an int256. A negative value arrives in two's complement. The `decimals` come from the layout. |
| `integer` | `integers` | the value |
| `bool` | `bools` | the value |
| `string`, `enum`, `date`, `datetime` | `strings` | the value as text, at most 256 bytes |

So a temperature of `-3.5` degrees with `decimals: 2` is `-350` in `integers[0]`, and the callback must cast it with `int256(response.integers[0])`.

Fields marked `off_chain` (lists, objects, long free text, values only given "when stated", values that just echo your request) stay in the API answer and are **left out** of the callback. The callback gets the other fields in order.

> **A job's params are public and permanent.** They are in the `JobCreated` event, on chain, for good. Send no personal data the intent does not need. For example, `PAYMENT_METHOD_VERIFY` takes only a card's BIN, and names sent to `SANCTIONS_SCREENING_MATCH`, addresses and IPs are visible to anyone.

### The layout only grows

An intent's on-chain request and answer slots are only ever **appended**. They are never reordered, retyped or rescaled. A breaking change is published as a new intent. So a contract that reads `integers[0]` today will read the same thing later.

## Step 3: Create the job

Pick the function that fits.

| Function | Pays from | Use it when |
|---|---|---|
| `createJob(intentId, params, callback)` | escrow | You do not need a price limit. |
| `createJobCapped(intentId, params, callback, maxBudget)` | escrow | You want protection from a price that rose between your quote and inclusion. Reverts `job price above maxBudget`. |
| `createJobAndPay(intentId, params, callback, maxBudget)` | your own USDC | A dapp pays for its user, or you hold no escrow. Approve the Diamond first. |
| `createJobForMiner(intentId, miner, params, callback, maxBudget, payNow)` | escrow, or your USDC with `payNow` | You want one registered miner tried first. It is never refused or failed over that choice: a miner that does not serve the intent, or does not answer, gives way to the intent's ranked miners. |

`params` is an `OnChainData`:

```solidity
struct OnChainData {
    address[] addresses;  // up to 5
    uint256[] integers;
    string[]  strings;
    bool[]    bools;
}
```

Example (layout from step 2). `WEATHER_FORECAST_LAHORE` here is a **placeholder** with the layout `integers[0]` = hours, `strings[0]` = location. Replace it with a real intent from `GET /engine/v1/intents` and build `params` from that intent's `onchain.request`, or the call reverts `not a canonical intent`:

```bash
cast send $DIAMOND \
  "createJobCapped(bytes32,(address[],uint256[],string[],bool[]),address,uint256)(uint256)" \
  "$(cast keccak 'WEATHER_FORECAST_LAHORE')" \
  '([],[24],["Lahore"],[])' \
  "$CALLBACK" 1500000 \
  --rpc-url $RPC --private-key $KEY
```

The job is created and `JobCreated` is emitted:

```solidity
event JobCreated(
    uint256 indexed jobId,
    address indexed agent,
    bytes32 intentId,
    address callback,
    uint256 miner,        // 0, or the registration id you asked for
    OnChainData params    // your request
);
```

The node reads your request from this event. It does not re-read the transaction.

### Price

**You do not choose the budget.** The job is priced by the protocol, scaled by the [demand multiplier](../protocol/addresses-and-params.md#demand-multiplier-tiers) for the target Intent's 24-hour volume, and debited when the transaction runs. Read the base price with `cast call $DIAMOND "getJobBasePrice()(uint256)"`. A miner's `min_price_usdc` is not used for job pricing. Amounts are not in the event; read them with `getJob`:

```bash
cast call $DIAMOND \
  "getJob(uint256)((address,bytes32,address,uint256,uint256,uint256,uint8,uint256))" \
  $JOB_ID --rpc-url $RPC
# (agent, intentId, callback, budget, minerPayment, protocolFee, state, createdAt)
```

## Step 4: Implement the callback

A callback is optional. Pass the zero address if you do not want one, and read the outcome yourself with `getJob` and `getJobOutput`. If you pass an address it must be a contract with code, or `createJob` reverts with `callback has no code`.

The callback keeps the same function name it always had:

```solidity
function subnetMessage(
    uint256 jobId,
    bool    success,
    OnChainData memory response,
    string  memory errorMessage
) external;
```

(The name is legacy. It delivers a job's result.) What changed is what the arguments mean.

| | Resolved | Failed |
|---|---|---|
| `success` | `true` | **`false`** |
| `response` | the intent's processed answer, laid out as in step 2 | empty |
| `errorMessage` | `""` | the reason in words |

The failure messages are exactly:

| Reason | `errorMessage` |
|---|---|
| 1 | `no miner answered` |
| 2 | `the request does not fit the intent's inputs` |
| 3 | `the node could not process the answer` |

Write a real error branch:

```solidity
function subnetMessage(uint256 jobId, bool success, OnChainData calldata response, string calldata errorMessage) external {
    require(msg.sender == DIAMOND, "only protocol");
    if (!success) {
        failed[jobId] = errorMessage;      // you are already refunded; decide what to do next
        return;
    }
    // Read by the layout from step 2. A number is value x 10^decimals as an int256.
    int256 tempX100 = int256(response.integers[0]);
    results[jobId] = tempX100;
}
```

Things that are true of how you are called:

- **Your revert is swallowed.** The protocol calls you inside `try ... catch`. If your callback reverts or runs out of gas, the job **still** settles (resolved or failed) and there is no retry.
- **You get a gas stipend.** The Diamond forwards `protocolParams().jobCallbackGas` (1,000,000 on the testnet; at most 2,000,000). The node sizes the resolving transaction from its gas estimate so the stipend is never starved. A callback that copies large arrays into storage can still exceed it, in which case your contract is simply not told. **Keep the callback to a few cheap writes** and do anything expensive in a transaction you send yourself.
- **A callback with no code is skipped**, not reverted.

A dapp that pays for its user: because the **dapp** is the agent, a refund lands in the **dapp's** escrow, not the user's. The dapp must send it on to its user.

## Step 5: Wait for the outcome

Each job is resolved on its own as soon as a miner has answered. It is **not** batched into the epoch. Expect seconds to a few minutes, not an epoch boundary.

What the node does after `JobCreated`:

1. Sends the job to the intent's **ranked miners**. It is never failed over a miner that is simply down: it tries the next one.
2. Builds the miner's API request from the intent's inputs (the same request builder an `ask` uses).
3. Reads the miner's answer into the intent's processed answer with the response parser.
4. Has the **validator quorum** sign the resolution. The signature binds the chain, the validator set, the job, the miner and the exact response, so nobody can change the answer on the way to the chain. The node builds the message itself and signs only if the chain's own view agrees.
5. Calls `transitionToTerminal`.

After `transitionToTerminal`:
- The protocol fee goes to the Treasury.
- The miner payment is swapped USDC to MACHINA and sent to the miner.
- `JobTerminal(jobId, fee, minerPaid)` is emitted and your callback runs.

Read the node's record of the job (the raw miner answer, and which format the answer reached the chain in):

```bash
curl https://devnode.telegraphprotocol.com/engine/v1/job/42
curl https://devnode.telegraphprotocol.com/engine/v1/job/42/result
```

## When a job fails

If no miner can answer, the job is **failed, never resolved with a made-up answer**. The validator quorum signs `failJob(jobId, reason, ...)`. Your agent is refunded **at once** (not after the cancel delay). No miner is paid. `JobFailed(jobId, reason)` is emitted and your callback is called with `success = false`.

| Reason | When it happens |
|---|---|
| 1 | No miner answered. Every candidate was tried, or no live miner serves the intent. |
| 2 | The request does not fit the intent's inputs: a value missing, out of range, not allowed. It was not dispatched. |
| 3 | The node could not process the answer. Its request builder or parser stayed unavailable through every retry (the node retries for 37 minutes), **or at once** because the intent has no on-chain answer format (`onchain.ready` is false) or the node has no request builder. A miner's raw answer never goes on-chain. |

Other rules worth knowing:
- An answer with a field the parser could not read is never sent with an invented `0` or `""`. The job tries its next miner instead.
- An empty answer pays no miner.
- A failure never replaces an answer already held for the same job.

You no longer need to guess whether a job "is still in progress". A job that has not resolved or failed after a few minutes can still be cancelled, see below. The state of a job in `Funded` for a long time means the quorum could not finish it; check `GET /engine/v1/job/{id}/result` for an `error_msg`.

## Cancelling a job

```
JobFacet.cancelJob(jobId)
```

Only the original `agent` can cancel, and only after `protocolParams().jobCancelDelay` (genesis 1 hour) has passed since funding. Before that it reverts `job cancel lock`; after the job resolved or failed it reverts `job not fundable`. A cancelled job returns the budget to the agent's escrow, repaying any delivery debt first.

## A complete run

The intent below is a placeholder, as in step 3. Substitute a real one.

```bash
# 1. fund escrow
cast send $USDC "approve(address,uint256)" $DIAMOND 2000000 --rpc-url $RPC --private-key $KEY
cast send $DIAMOND "depositUSDC(uint256)" 2000000 --rpc-url $RPC --private-key $KEY

# 2. read the layout and the price
curl -s https://devnode.telegraphprotocol.com/engine/v1/intents/WEATHER_FORECAST_LAHORE | jq .onchain
cast call $DIAMOND "getJobBasePrice()(uint256)" --rpc-url $RPC

# 3. create the job, capped
cast send $DIAMOND \
  "createJobCapped(bytes32,(address[],uint256[],string[],bool[]),address,uint256)(uint256)" \
  "$(cast keccak 'WEATHER_FORECAST_LAHORE')" '([],[24],["Lahore"],[])' "$CALLBACK" 2000000 \
  --rpc-url $RPC --private-key $KEY

# 4. watch it: state 1 = resolved, 2 = cancelled or failed
cast call $DIAMOND \
  "getJob(uint256)((address,bytes32,address,uint256,uint256,uint256,uint8,uint256))" \
  $JOB_ID --rpc-url $RPC
cast call $DIAMOND "getJobOutput(uint256)(bytes32)" $JOB_ID --rpc-url $RPC
```

The repository includes a sample consumer (`contracts/evm/examples/AllSubnetsCallbackContract.sol`) and a script that steps real jobs through a node (`scripts/mainnet/node-demo.sh`).

## Reverts you may hit

| Revert | Cause |
|---|---|
| `not a canonical intent` | `intentId` is not the hash of a canonical intent name (a prefix, a registration id, a removed or misspelled name) |
| `job price above maxBudget` | The price rose above your limit |
| `insufficient escrow balance` | Escrow is short (for `createJob` and `createJobCapped`) |
| `USDC payment failed` or a token error | `createJobAndPay` without enough balance or allowance |
| `callback has no code` | The callback address is not a contract |
| `job cancel lock` | `cancelJob` before the cancel delay |
| `job not fundable` | `cancelJob` or `failJob` on a job that is already resolved, failed or cancelled |
| `not enough gas for the callback` | A resolution sent by hand with too little gas. The node sizes this itself. |
