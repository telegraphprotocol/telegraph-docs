---
description: Call a specific miner and endpoint directly from a smart contract, and receive the result in a callback. Gas only — no USDC, no escrow.
---

# On-Chain Miner Requests

An on-chain miner request is the direct way for a contract to ask a **specific miner** for inference. You name the miner and the endpoint, pass parameters as an `OnChainData` struct, and the protocol delivers the result to your callback contract.

This is the lower-level of Telegraph's two on-chain request rails:

| | On-chain miner request | [ERC-8183 job](erc8183-jobs.md) |
|---|---|---|
| You target | a **specific miner + endpoint** | an **Intent** — the protocol picks the miner |
| Cost | gas only | USDC debited from escrow (`jobBasePrice`) |
| Callback | required | optional |
| Concurrency | one outstanding request at a time, protocol-wide | many jobs in flight at once |
| Cancellable | no | yes, `cancelJob` refunds |

Neither rail calls the other. They are separate facets with separate events and separate resolvers — they share only the `subnetMessage` callback signature and the miner layer underneath.

Use a miner request when you already know which miner you want and don't want to pay per call. Use a job when you want the protocol to route by capability and you want the miner paid.

> The on-chain identifiers still use the protocol's original "subnet" vocabulary — `outboundSubnetMessage`, `subnetId`, `subnetMessage`, `SubnetRequestOut`. Those are the literal names on the Diamond and are spelled exactly that way throughout this page. What they address is a **miner**.

## The request lifecycle

```
Your contract → outboundSubnetMessage() → [SubnetRequestOut event]
                                                  ↓
                                    Node maps OnChainData → HTTP request
                                                  ↓
                                          Miner responds
                                                  ↓
                              executeInboundSubnetMessage() on-chain
                                                  ↓
                          callback.subnetMessage(id, success, response, error)
```

## Step 1: Pick a miner and endpoint

The `subnetId` is the numeric `id` field from the miner catalogue:

```bash
curl https://devnode.telegraphprotocol.com/api/miners
```

**The miner must declare an `on_chain.request` block in its YAML.** That block is what tells the node how to turn your `OnChainData` arrays into an HTTP call; without it the node has no mapping and your request is dropped after the event is emitted. To check any miner yourself, fetch its `yaml_url` from the catalogue and look for `on_chain:` → `request:`.

Miners in the live catalogue whose YAML declares that block:

| `subnetId` | Miner | Endpoint keyword | Method |
|---|---|---|---|
| 18 | `bittensor-sn18-zeus` | `predict` | GET |
| 34 | `bittensor-sn34-bitmind` | `detect-image`, `detect-video`, `preprocess-video`, `get-video-upload-url` | POST |
| 104 | `litellm` | `chat` | POST |
| 109 | `gemini` | `chat` | POST |
| 110 | `openrouter` | `chat` | POST |
| 114 | `bedrock-nova-2-lite` | `chat` | POST |
| 115 | `bedrock-deepseek` | `chat` | POST |
| 116 | `bedrock-voxtral` | `chat` | POST |
| 117 | `bedrock-qwen` | `chat` | POST |
| 118 | `bedrock-kimi` | `chat` | POST |
| 200 | `telegraph-chatbot` | `chat` | POST |
| 202 | `tavily` | `search` | POST |

The `endpoint` string you pass is matched against those keywords by substring, longest match wins — so `/chat`, `chat` and `/v1/chat` all select the `chat` entry. It must be 1–64 bytes.

## Step 2: Deploy a callback contract

Unlike jobs, the callback is **mandatory**, and the Diamond checks it at request time.

```solidity
struct OnChainData {
    address[] addresses;
    uint256[] integers;
    string[]  strings;
    bool[]    bools;
}

interface ISubnetReceiverContract {
    function subnetMessage(
        uint256 id,
        bool success,
        OnChainData calldata response,
        string calldata errorMessage
    ) external;
}

contract MyReceiver is ISubnetReceiverContract {
    address public immutable diamond;
    mapping(uint256 => string) public responses;

    constructor(address _diamond) { diamond = _diamond; }

    function subnetMessage(
        uint256 id,
        bool success,
        OnChainData calldata response,
        string calldata errorMessage
    ) external override {
        require(msg.sender == diamond, "only protocol");

        if (success && response.strings.length > 0) {
            responses[id] = response.strings[0];
        }
        // keep this cheap — see below
    }
}
```

Two properties of the callback matter:

- **It must not revert.** `executeInboundSubnetMessage` calls it directly, with no `try/catch` and no gas cap. A reverting callback reverts the whole delivery transaction, and because the request is only marked processed inside that same transaction, the response never lands at all.
- **It must be cheap.** The node pays for the delivery transaction up front and is reimbursed out of the gas subsidy pool afterwards; heavy callback logic is billed to that pool. Store what you need and return.

## Step 3: Send the request

```solidity
uint256 id = IDiamond(diamond).outboundSubnetMessage(
    200,          // subnetId — telegraph-chatbot
    "/chat",      // endpoint keyword
    params,       // OnChainData, shaped by the miner's on_chain.request block
    myReceiver    // your callback contract
);
```

Or from the command line:

```bash
cast send $DIAMOND \
  "outboundSubnetMessage(uint256,string,(address[],uint256[],string[],bool[]),address)(uint256)" \
  200 "/chat" \
  '([],[],["telegraph-assistant","user","What is the Telegraph Protocol?"],[false])' \
  $CALLBACK \
  --rpc-url $RPC --private-key $KEY
```

The call is `payable`. Any ETH you send is added to the protocol's gas subsidy pool, which is what reimburses the node for submitting your response transaction. Sending none is fine.

It emits `SubnetRequestOut`:

```solidity
event SubnetRequestOut(
    uint256 subnetId,
    address sender,
    string  endpoint,
    OnChainData parameters,
    address callbackContract,
    uint256 fee,          // 0 — this rail is not charged in USDC
    address tokenAddress  // address(0)
);
```

### Getting your request id

The request id is a protocol-wide counter, and it is the **return value** of `outboundSubnetMessage` — it is deliberately *not* in the event. A contract caller reads it from the return value directly. From outside, simulate the call to learn the id it would take, or read the record back once the request exists:

```bash
cast call $DIAMOND \
  "getSubnetRequest(uint256)(address,uint256,string,address,uint256,bool)" 3 \
  --rpc-url $RPC
# 0x034Dbd07…  200  "/chat"  0xc0c22Fca…  1786638876  true
#  sender    subnetId endpoint  callback     timestamp  processed
```

The same id is the first argument your callback receives.

## Step 4: Shape the parameters

What goes in each array is defined by the target miner's `on_chain.request` block. For a chat miner using the `chat_messages` format:

- `strings[0]` — model name
- `strings[1]` — role (`"user"`)
- `strings[2]` — content

and continuing in role/content pairs. The same optional extras apply as for jobs: `integers[0]` → `max_tokens`, `bools[0]` → `stream`, `bools[1]` → `logprobs`, and a trailing string that parses as a float → `temperature`.

For a GET-style miner such as Zeus (`predict`), the block defines query parameters instead, and the arrays map onto those by index.

## Step 5: Read the response

The response arrives packed into `OnChainData` at the indexes the miner declares in its YAML `on_chain.fields` block. For `telegraph-chatbot`:

| Slot | Field | Source in the miner's response |
|---|---|---|
| `strings[0]` | `response_text` | `choices.0.message.content` |
| `strings[1]` | `model` | `model` |
| `integers[0]` | `completion_tokens` | `usage.completion_tokens` |
| `integers[1]` | `prompt_tokens` | `usage.prompt_tokens` |

Every miner declares its own layout, so always read the `on_chain.fields` block of the miner you're calling before indexing into the response.

Delivery also emits `SubnetResponseIn(uint256 id, bool success, OnChainData response, string errorMessage)` on the Diamond, which is the easiest thing to watch from off-chain.

## Concurrency: one request at a time

`executeInboundSubnetMessage` resolves against the Diamond's **global** request counter, not against a per-request lookup. It always answers the newest request, protocol-wide.

The consequence is strict: if a second request is created before the first has been answered, the counter has already moved on and **the first request can never be answered**. It stays `processed = false` forever, and its callback never fires. This is protocol-wide, not per-contract — another user's request will strand yours the same way.

Send one request, wait for its callback, then send the next.

## Requirements and failure modes

`outboundSubnetMessage` reverts if:

| Revert | Cause |
|---|---|
| `Invalid endpoint` | endpoint empty or longer than 64 bytes |
| `Invalid callback contract` | callback is the zero address |
| `Callback contract does not exist` | callback address has no code |
| `Callback contract must implement subnetMessage` | callback does not expose `subnetMessage(uint256,bool,(address[],uint256[],string[],bool[]),string)` |
| `Withdrawal requested: cannot send outbound messages` | you have a pending withdrawal on the Diamond |
| `Distribution contract not set` | protocol misconfiguration, not a caller error |

After the request is accepted, a miner-side failure does not revert anything. The node calls your callback with `success = false` and the reason in `errorMessage`, so handle that branch.

## A complete run

Verified on Base Sepolia against the live Diamond `0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8`.

**1. Send the request** to `telegraph-chatbot` (`subnetId` 200), asking it to reply with a single word:

```bash
cast send $DIAMOND \
  "outboundSubnetMessage(uint256,string,(address[],uint256[],string[],bool[]),address)(uint256)" \
  200 "/chat" \
  '([],[],["telegraph-assistant","user","Reply with the single word: Machina"],[false])' \
  $CALLBACK \
  --rpc-url $RPC --private-key $KEY
```

Mined in block 45435294, tx `0x982e446a6f385203b841fddff13bdc17b959fb1be1753c553d48e3a4e2441727`, taking request id **3**.

**2. The node picks up `SubnetRequestOut`** and maps the `OnChainData` arrays onto the miner's HTTP body via its `on_chain.request` block:

```json
{"model":"telegraph-assistant","messages":[{"role":"user","content":"Reply with the single word: Machina"}]}
```

**3. The miner responds**, and the node maps the JSON back onto `OnChainData` using `on_chain.fields`, then submits it.

**4. The callback fires.** `SubnetResponseIn` was emitted in block 45435463, tx `0x9e59b1df2560d6547cf675b6e7174959881f10c96dac3c70fa83b70f22c986a8`, carrying:

```
id            3
success       true
strings[0]    "Machina"              ← response_text
strings[1]    "telegraph-assistant"  ← model
errorMessage  ""
```

The receiving contract's `subnetMessage` ran in the same transaction, and `getSubnetRequest(3)` now reports `processed = true`.

End to end — request mined to callback delivered — took roughly three minutes, most of it the node waiting for the chain's safe head to advance past the request block before it reads the event.
