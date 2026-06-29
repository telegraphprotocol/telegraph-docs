---
description: Create on-chain AI inference jobs from a smart contract using the ERC-8183 standard — your contract funds the job and receives the result via callback.
---

# On-Chain Jobs (ERC-8183)

ERC-8183 is an on-chain standard for agentic commerce: a smart contract creates a job by escrowing USDC, specifies what it wants (an Intent and parameters), and receives the result via a callback function once the validators finalize it. No off-chain coordination needed — the entire lifecycle is on-chain.

Use this when:
- A smart contract needs AI inference as part of its logic (e.g., a prediction market settling on AI-verified data, a DeFi protocol adjusting parameters based on on-chain signals).
- You want trustless, auditable proof that the result came from the protocol's consensus process.
- You want composability — your callback contract can take any action on receipt of the result.

## The Job Lifecycle

```
Agent (your contract) → createJob() → [JobCreated event]
                                            ↓
                              Protocol listener routes to miner
                                            ↓
                                    Miner responds
                                            ↓
                              Validators score & reach consensus
                                            ↓
                            transitionToTerminal() called on-chain
                                            ↓
                        98% USDC → TWAP → MACHINA → miner
                        2% USDC → Treasury
                                            ↓
                          callback.subnetMessage() called on your contract
```

States: `Pending (0)` → `Active (1)` → `Terminal`

## Step 1: Deposit USDC to Escrow

Your contract (or wallet) must hold USDC in the Diamond's escrow before creating a job.

First, approve the Diamond to spend your USDC:

```
ERC20.approve(
  diamondAddress,  // 0x45b0A6e07E2e15D203f3B5285945c549221f5b0a
  amount           // USDC amount in 6-decimal units
)
```

Then deposit:

```
EscrowFacet.depositUSDC(amount)
```

The Diamond address on Base Sepolia is `0x45b0A6e07E2e15D203f3B5285945c549221f5b0a`. The escrow has a 4-hour timelock on withdrawals, so deposit what you'll need for your jobs.

## Step 2: Find the Intent ID

Each miner has an Intent ID — a `bytes32` derived from the miner's address, their YAML hash, and their registration block number. You need this to target a specific miner capability.

Query the registered miners to find an intentId:

```
cast call 0x45b0A6e07E2e15D203f3B5285945c549221f5b0a \
  "getMiner(uint256)" 12 \
  --rpc-url https://base-sepolia.g.alchemy.com/v2/<KEY>
```

Or use the intentId from the `/miner-dispatcher/integrations` API response.

A live example intent ID on testnet: `0xccd42820467c59d6f703fb6d0fe57d6303fbfaa893759ee493c29293adfdc1f7`

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

This struct is how you pass parameters to the miner. What goes in each array depends on the Intent — check the miner's YAML `on_chain.request` block for the expected format. For example, an LLM call would put the model name in `strings[0]` and the chat messages in `strings[1]`.

**Example using cast:**

```bash
cast send 0x45b0A6e07E2e15D203f3B5285945c549221f5b0a \
  "createJob(bytes32,(address[],uint256[],string[],bool[]),address)" \
  "0xccd42820467c59d6f703fb6d0fe57d6303fbfaa893759ee493c29293adfdc1f7" \
  "([],[],[\"gpt-4o-mini\",\"user:What is 2+2?\"],[])" \
  "0xYourCallbackContract" \
  --rpc-url https://base-sepolia.g.alchemy.com/v2/<KEY> \
  --private-key <YOUR_KEY>
```

This emits a `JobCreated` event with:

| Field | Description |
|---|---|
| `jobId` | Sequential job identifier |
| `agent` | Your wallet/contract address |
| `intentId` | The intent you targeted |
| `callback` | Where the result will be delivered |
| `budget` | Total USDC escrowed |
| `minerPayment` | 98% of budget → miner (via TWAP) |
| `protocolFee` | 2% of budget → Treasury |

All 61 live jobs on testnet show the same split: budget=10000 (0.01 USDC) → minerPayment=9800 + protocolFee=200.

## Step 4: Implement the Callback

Your callback contract must implement `subnetMessage`. This function is called by the protocol after BFT finalization:

```solidity
function subnetMessage(
    uint256 jobId,
    bool success,
    OnChainData memory response,
    string memory errorMessage
) external {
    require(msg.sender == DIAMOND_ADDRESS, "only protocol");
    
    if (success) {
        // response.strings[0] might be the LLM reply
        // response.integers[0] might be a numeric score
        // handle result...
    } else {
        // handle error
        emit JobFailed(jobId, errorMessage);
    }
}
```

The `callback` address you specify in `createJob` must be a deployed contract with code — the protocol validates this before accepting the job.

## Step 5: Wait for Terminal

After `JobCreated`, the protocol listener:
1. Detects the event and decodes the `OnChainData` params.
2. Routes to the miner matching the `intentId`.
3. Receives the miner's response.
4. Queues it for the next epoch settlement.
5. Calls `transitionToTerminal(jobId, outputHash, minerAddress, blsSignature, response)`.

The `transitionToTerminal` function signature:
```
transitionToTerminal(uint256,bytes32,address,bytes,uint256,(address[],uint256[],string[],bool[]))
```

After terminal transition:
- The protocol fee (200 = $0.002 USDC) goes to the Treasury.
- The miner payment (9800 = $0.0098 USDC) enters the TWAP Settler to purchase MACHINA for the miner.
- Your callback contract receives the result.

## Cancelling a Job

If you need to cancel a job before it reaches Terminal:

```
JobFacet.cancelJob(jobId)
```

Only the original `agent` can cancel. Cancelled jobs return the USDC budget to your escrow. A job cannot be cancelled once it has reached Terminal.

## Budget and Pricing

The minimum job budget is set by the target miner's floor price × the current demand multiplier. At genesis on testnet with unconfigured demand tiers, all jobs cost 0.01 USDC (10,000 in 6-decimal units).

Check the current price before creating a job by reading the miner's `minPriceUsdc` from the Diamond:

```bash
cast call 0x45b0A6e07E2e15D203f3B5285945c549221f5b0a \
  "getMiner(uint256)" <minerId> \
  --rpc-url https://base-sepolia.g.alchemy.com/v2/<KEY>
```
