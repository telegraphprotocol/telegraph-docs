---
description: Fund once, then call as often as you like. No per-request settlement, no facilitator round trip, and a receipt for every call.
---

# Pay from Escrow

Escrow is the second way to pay a Telegraph node. You deposit USDC into the Port Contract once, and every call after that is authorized against that balance and charged in the epoch's ledger root: one Merkle-sum root for every account, carried in a single on-chain transaction at the end of the epoch.

It is **not** a separate payment API. It is one more entry in the same x402 `accepts` array, sent in the same `X-PAYMENT` header, with the same base64 envelope and the same field names as the EVM `exact` scheme. Only `scheme` differs. A client that already speaks x402 changes one string.

This page covers escrow. For x402, see [Pay per Request (x402)](x402-inference.md). For request and result shapes, see [Make a Request](engine-ask.md).

## Why Escrow Instead of x402

x402 spends a facilitator round trip and an on-chain settlement **per request**. Escrow spends neither.

| | x402 | Escrow |
|---|---|---|
| Per-request on-chain transaction | Yes | No |
| Facilitator round trip | Yes | No |
| Funding | Per call | Once, up front |
| Settlement | Immediately, per payment | Once per epoch, batched |
| Latency added | Facilitator verify + settle | Signature check only |

Both rails converge on exactly the same aggregator, the same merkle root and the same claim path. A miner cannot tell which one paid it.

The trade-off is that escrow needs funding before the first call.

## What You Need

- A USDC balance on **Ethereum Sepolia** (`0xcc194e1a843B658526D0D5C431f670028582Ae17`). It is a test token: claim it from the [Anjoman faucet](https://anjoman.ai/dashboard/faucet), or mint it directly with `cast send 0xcc194e1a843B658526D0D5C431f670028582Ae17 "mint(address,uint256)" <yourAddress> 10000000 --rpc-url https://ethereum-sepolia-rpc.publicnode.com --private-key <key>` (10 USDC).
- A wallet that can sign an EIP-191 `personal_sign` message.
- The Diamond address for the node you are calling. See [Addresses & Parameters](../protocol/addresses-and-params.md).

**Engine base URL (testnet):** `https://devnode.telegraphprotocol.com/engine`

## Step 1: Fund Your Escrow

Approve the Diamond for the USDC you want to deposit, then deposit it:

```solidity
IERC20(USDC).approve(DIAMOND, amount);
LedgerFacet(DIAMOND).depositUSDC(amount);   // amount in 6-decimal uUSDC
```

From a terminal with `cast` (2000000 = 2.00 USDC):

```bash
export DIAMOND=0x72a70e949362670Bf8bceAd24eFC5b8f950aa08b
export USDC=0xcc194e1a843B658526D0D5C431f670028582Ae17
export RPC=https://ethereum-sepolia-rpc.publicnode.com
export NODE=https://devnode.telegraphprotocol.com
cast send $USDC "approve(address,uint256)" $DIAMOND 2000000 --rpc-url $RPC --private-key $KEY
cast send $DIAMOND "depositUSDC(uint256)" 2000000 --rpc-url $RPC --private-key $KEY
curl -s $NODE/v1/ledger/account/$YOUR_ADDRESS | jq '{deposited, balance, available}'
# "2000000" each on a fresh wallet; x402 leftovers are credited to the same balance
```

> Balances on the previous Diamond (`0x3624…b99b`) do not carry over. Deposit again on this one.

There is no minimum deposit for HTTP calls: your balance only has to cover what the call may cost (one call, or the ask's whole [`max_budget_usdc`](engine-ask.md#multi-miner-asks-max_budget_usdc), which is held while it runs) plus whatever has already been billed to you and not yet charged in a root. (The **1.00 USDC** floor is a WebSocket rule, enforced when the connection opens.) Deposit more than one ask's worth anyway, because a call refused for balance is a call you have to sign and send again.

Read your balance back at any time. The chain holds what you deposited, withdrew and requested; the node's ledger roots hold what you were charged and credited, so the node joins the two:

```bash
curl -s $NODE/v1/ledger/account/$YOUR_ADDRESS
```

| Field | Meaning |
|---|---|
| `deposited`, `withdrawn` | On chain |
| `charged`, `credited` | In the node's newest ledger root: your asks, and x402 leftovers credited back |
| `unbilled` | Usage billed but not in a root yet |
| `balance` | `deposited + credited − charged − withdrawn` |
| `available` | `balance − unbilled −` any withdrawal request: what asks may still spend. This is the number the node checks |
| `request` | Your withdrawal request, if any, and its `status` (see [Withdrawing](#withdrawing)) |
| `charge_limit`, `charged_this_block` | Your charge limit per block (`setMyChargeLimit`), and what this block has used of it |

Amounts are μUSDC as decimal strings. On chain, `ledgerAccount(address)` returns `(deposited, withdrawn, requested, requestedAt)`.

> An x402 payment whose request failed after the payment settled, or the unused part of a budgeted x402 ask, is credited to this same balance at the next epoch close (your `credited`), so you can spend it here. See [When a Paid Request Fails](x402-inference.md#when-a-paid-request-fails).

> There is no on-chain debt. Usage a root could not charge yet stays `unbilled` and counts against `available` until a later root charges it.

### Funding somebody else

`depositUSDCFor(beneficiary, amount)` pays from your wallet and credits somebody else's escrow. No signature from them is required, because it grants you nothing: only they can ever spend or withdraw it.

```solidity
IERC20(USDC).approve(DIAMOND, amount);
LedgerFacet(DIAMOND).depositUSDCFor(userWallet, amount);
```

```bash
cast send $USDC "approve(address,uint256)" $DIAMOND 2000000 --rpc-url $RPC --private-key $KEY
cast send $DIAMOND "depositUSDCFor(address,uint256)" $USER_WALLET 2000000 --rpc-url $RPC --private-key $KEY
```

Useful for sponsoring your users' intelligence requests, topping up a fleet of agent wallets, or funding a hot agent key from a cold one.

## Step 2: Read the Challenge

Escrow is priced on the same routes x402 is: `POST /engine/v1/ask` and `POST /engine/v1/ask/{minerId}`. Call one with no payment header and you get the usual 402, whose body lists the schemes it accepts. Look for the entry whose `scheme` is `escrow`. For an ask with [`max_budget_usdc`](engine-ask.md#multi-miner-asks-max_budget_usdc) it quotes the budget: you sign for the budget, it is held while the ask runs, only the calls whose answers are used are billed, and the rest of the hold is released.

```json
{
  "scheme": "escrow",
  "network": "eip155:11155111",
  "price": "$0.01",
  "payTo": "0x72a70e949362670bf8bcead24efc5b8f950aa08b",
  "extra": {
    "description": "Charged to the caller's Telegraph escrow balance in the next ledger block. Fund it once with LedgerFacet.depositUSDC(amount); no per-request settlement.",
    "resource": "/v1/ask",
    "signWith": "personal_sign (EIP-191)",
    "message": "Telegraph Escrow Payment\n\nWallet: {from}\nPay To: 0x72a70e94…\nNetwork: eip155:11155111\nAmount: 10000 uUSDC\nResource: /v1/ask\nNonce: {nonce}\nValid After: {validAfter}\nValid Before: {validBefore}"
  }
}
```

`extra.message` is the exact template you sign, with `{from}`, `{nonce}`, `{validAfter}` and `{validBefore}` to fill in. Things that trip people up:

- **`Network:` is part of what you sign.** It names the chain the escrow lives on, so a signature cannot be replayed on another chain. A node on Ethereum mainnet refuses a signature without it. Do not rebuild the message: sign the template as given.
- **Read the amount off the message template.** The first challenge quotes a human `price` (`"$0.01"`), while the fresh challenge attached to a *refusal* carries `amount` in μUSDC instead. The `Amount:` line of `extra.message` is present in both, so that is the reliable place to read the figure for `authorization.value`.
- **`resource` is the path *inside* the engine**: `/v1/ask`, without the `/engine` prefix you actually called. Sign the template as given.
- **Lowercase your address when you substitute `{from}`.** The node lowercases the wallet and payTo before it checks your signature, so a checksummed address signs different bytes and is rejected with `signature is from …, not authorization.from …`.

## Step 3: Sign and Send

Sign the reconstructed message with `personal_sign`, then send it back in `X-PAYMENT` as base64 JSON:

```json
{
  "x402Version": 2,
  "scheme": "escrow",
  "network": "eip155:11155111",
  "payload": {
    "signature": "0x…",
    "authorization": {
      "from": "0xyourwallet…",
      "to": "0xdiamond…",
      "value": "10000",
      "validAfter": "1789466100",
      "validBefore": "1789466200",
      "nonce": "any-unique-string"
    }
  }
}
```

Send it in `X-PAYMENT`, **not** `PAYMENT-SIGNATURE`. That header belongs to the x402 `exact` rail and escrow is not read from it.

Rules the node enforces, all of them committed to by the signature:

- `value` must equal the quoted amount **exactly**. Underpaying and overpaying are both refused.
- `to` must be the Diamond.
- The validity window (`validBefore` minus `validAfter`) may be at most **2 minutes**.
- `nonce` must not have been used before by this wallet. Nonces are remembered **across node restarts and across nodes** until the authorization expires, so a nonce you used yesterday is not reusable.
- The `resource` and the `Network` are inside the signed message, so a signature bought for one endpoint or chain cannot be presented at another.

> The signed message is deliberately **not** an EIP-3009 `TransferWithAuthorization`. A valid one of those is a bearer instrument: anyone who lifted it out of a log or a proxy could submit it to the USDC contract and actually move your money. Escrow proves intent, so it signs a human-readable message that no contract will ever accept.

## Step 4: Read the Receipt

A served request returns `X-PAYMENT-RESPONSE` (base64 JSON) carrying the standard Telegraph receipt:

```json
{
  "receipt_hash": "0xf2d3ec3113cc8e284ea988cba134d93351ee9f28a8358f4b6575a917b2a09591",
  "rail": "escrow",
  "payer": "0xyourwallet…",
  "miner": "377",
  "intent": "CRYPTO_PRICE_USD",
  "amount_uusdc": "10000",
  "epoch_id": 314,
  "settlement": "epoch",
  "chain": "telegraph",
  "timestamp": 1789466181
}
```

An ask with `max_budget_usdc` that used several miners is billed one row per paid call. The header carries the first row's receipt; the reply's `fulfillment.payments` lists every row with its `receipt_hash`.

`receipt_hash` is the auditable identifier for this one consumption. It is the key of the delivery's row in the node's ledger and the `Finalised_Receipt_Hash` in the signed Delivery Log Entry submitted with the epoch, so it identifies your call, and nothing else, permanently. You can later prove the call was billed in a specific epoch block with `GET /v1/blocks/{epochId}/deliveries/{receiptHash}`. It is at the node root, not under `/engine`: `https://devnode.telegraphprotocol.com/v1/blocks/{epochId}/deliveries/{receiptHash}`. Until that epoch's block is recorded it answers `404 {"error":"no block recorded for this epoch"}`; on the testnet that is up to about an hour. Then it returns your `delivery` (payer, miner, intent, `usdc`), a Merkle `proof` and the block's `deliveries_root`. `GET /v1/blocks/{epochId}` returns the whole block.

There is **no `tx_hash`**, and that is not an omission. Escrow does not touch the chain per request, which is the entire point. `chain` says so positively: `telegraph` means the protocol settles this at the epoch boundary rather than an external chain settling it now. `epoch_id` names the epoch whose ledger root charges it (the root rides that epoch's `submitEpoch`).

The same receipt object, field for field, is returned by the x402 rail (in `X-TELEGRAPH-RECEIPT`) and by the WebSocket rail (as a `receipt` message).

**A request that fails is never billed and carries no receipt.** Treat a missing header on a non-2xx as "not charged", and retry with a fresh nonce, never the one you just sent.

## Putting It Together

The whole rail is three fetches and a signature, with no SDK, no facilitator, and no on-chain call per request:

```ts
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const NODE = 'https://devnode.telegraphprotocol.com';
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({ account, chain: sepolia, transport: http() });

export async function ask(question: string) {
  // max_budget_usdc: a multi-miner ask that may cost up to $0.26, first call included (or { intent, params, ... })
  const body = JSON.stringify({ query: question, max_budget_usdc: 260000 });
  const json = { 'Content-Type': 'application/json' };

  // 1: read the challenge
  const challenge = await fetch(`${NODE}/engine/v1/ask`, { method: 'POST', headers: json, body })
    .then((r) => r.json());
  const escrow = challenge.accepts.find((a: any) => a.scheme === 'escrow');
  if (!escrow) throw new Error('this node does not accept escrow');

  const template: string = escrow.extra.message;
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: account.address.toLowerCase(),        // lowercase, or the signature will not match
    to: escrow.payTo,
    value: template.match(/Amount:\s*(\d+)\s*uUSDC/)![1],
    validAfter: String(now - 5),
    validBefore: String(now + 100),             // window must stay under 2 minutes
    nonce: crypto.randomUUID(),                 // fresh every attempt
  };

  // 2: fill the template in place and sign it verbatim (it already contains Network)
  const message = template
    .replace('{from}', authorization.from)
    .replace('{nonce}', authorization.nonce)
    .replace('{validAfter}', authorization.validAfter)
    .replace('{validBefore}', authorization.validBefore);
  const signature = await wallet.signMessage({ message });

  // 3: same request body, now carrying the authorization
  const payment = btoa(JSON.stringify({
    x402Version: 2,
    scheme: 'escrow',
    network: escrow.network,
    payload: { signature, authorization },
  }));
  const res = await fetch(`${NODE}/engine/v1/ask`, {
    method: 'POST', headers: { ...json, 'X-PAYMENT': payment }, body,
  });
  if (res.status === 402) throw new Error((await res.json()).reason);

  const header = res.headers.get('X-PAYMENT-RESPONSE');
  return { answer: await res.json(), receipt: header ? JSON.parse(atob(header)) : null };
}
```

To run it, save it as `escrow.mts` in a folder with `viem` and `tsx` installed
(`npm init -y && npm install viem tsx`), add this line at the end of the file,
and run `PRIVATE_KEY=0x... npx tsx escrow.mts`:

```ts
console.log(await ask('What is the current price of Bitcoin?'));
```

An unfunded wallet throws `insufficient escrow for delivery: …`, which proves the
signature is right and only the deposit is missing.

To smoke-test a wallet from a terminal before wiring any of that up (it needs `cast`, `jq` and a funded escrow; it spends $0.01):

```bash
PRIVATE_KEY=$KEY   # your testnet key
NODE=https://devnode.telegraphprotocol.com
ADDR=$(cast wallet address --private-key "$PRIVATE_KEY" | tr 'A-Z' 'a-z')
NOW=$(date +%s)
NONCE="test-$NOW"

curl -sS -X POST "$NODE/engine/v1/ask" -H 'Content-Type: application/json' \
  -d '{"query":"What is the current price of Bitcoin?"}' > challenge.json

TEMPLATE=$(jq -r '.accepts[] | select(.scheme=="escrow") | .extra.message' challenge.json)
PAYTO=$(jq -r '.accepts[] | select(.scheme=="escrow") | .payTo' challenge.json)
VALUE=$(printf '%s' "$TEMPLATE" | sed -n 's/.*Amount: \([0-9]*\) uUSDC.*/\1/p')

MESSAGE=$(printf '%s' "$TEMPLATE" \
  | sed -e "s/{from}/$ADDR/" -e "s/{nonce}/$NONCE/" \
        -e "s/{validAfter}/$((NOW-5))/" -e "s/{validBefore}/$((NOW+100))/")
SIG=$(cast wallet sign --private-key "$PRIVATE_KEY" "$MESSAGE")

PAYMENT=$(jq -cn --arg s "$SIG" --arg f "$ADDR" --arg t "$PAYTO" --arg v "$VALUE" \
  --arg a "$((NOW-5))" --arg b "$((NOW+100))" --arg n "$NONCE" \
  '{x402Version:2,scheme:"escrow",network:"eip155:11155111",
    payload:{signature:$s,authorization:{from:$f,to:$t,value:$v,validAfter:$a,validBefore:$b,nonce:$n}}}' \
  | base64 | tr -d '\n')

curl -sS -D - -X POST "$NODE/engine/v1/ask" -H 'Content-Type: application/json' \
  -H "X-PAYMENT: $PAYMENT" -d '{"query":"What is the current price of Bitcoin?"}'
```

You should see `HTTP/2 200`, an `x-payment-response` header and the answer in the body. Decode the header with `base64 -d` to read your receipt (see [Step 4](#step-4-read-the-receipt)).

The same script pays a direct ask: change both URLs to
`$NODE/engine/v1/ask/{minerId}`. The template you sign then reads
`Resource: /v1/ask/{minerId}`, and since you sign the template as given, nothing
else changes. Sending the same `X-PAYMENT` twice is refused with
`authorization.nonce has already been used`.

The body is a `query`, or an `intent` with `params`. See [Make a Request](engine-ask.md). A body that is neither is refused *after* the payment is accepted, with `400 {"error":"invalid request body"}`, and the nonce is spent. (A request whose `params` do not fit the intent's schema is refused *before* payment and costs nothing.)

An unfunded wallet gets `insufficient escrow for delivery: unbilled=0 μUSDC + price=10000 μUSDC > balance=0 μUSDC`, which is a useful signal on its own: it means the signature verified and only the balance is missing.

## When a Payment Is Refused

Every refusal is a `402` whose body carries a `reason` and a fresh challenge, so a client that can fix the problem knows what to sign next.

| `reason` contains | What happened |
|---|---|
| `costs N uUSDC, authorization offers M` | `value` disagrees with the quote. Re-read the challenge for the exact body you are sending |
| `already been used` | Replayed nonce. Mint a fresh one |
| `authorization could not be recorded; retry with a new nonce` | The node could not record your nonce, so it refused rather than accept a replayable authorization. Retry with a fresh nonce |
| `expired at …` / `not valid yet` | Outside the validity window; check your clock |
| `valid for …; the maximum is 2m0s` | Window longer than 2 minutes |
| `escrow pays the diamond at …` | `to` is not the Diamond |
| network or chain mismatch | The message names a different chain than the node's. Sign the template exactly as given |
| `signature is from …, not authorization.from …` | Signer does not match the claimed payer |
| `insufficient escrow for delivery: unbilled=… + price=… > balance=…` | Balance too low for this call (or this ask's budget). Deposit more. `unbilled` counts calls billed but not yet charged in a root; a pending withdrawal request is not spendable either |
| `charge limit reached for this block …` | Your charge limit per block is used up. Wait for the next block, or raise it with `setMyChargeLimit` |

**Whether a refusal burns your nonce depends on where it failed.** Everything checked before the signature (network, recipient, amount, timestamps, the signature itself) is rejected without recording the nonce, so it stays usable. Once the signature verifies the nonce is spent, and it stays spent even if the call is then refused for balance. The simple rule is to mint a fresh nonce for every attempt.

## Withdrawing

Withdrawals are two steps, with a wait between them, so an agent cannot drain its balance out from under deliveries already in flight:

1. `requestWithdraw(amount)` on the Diamond. The amount stops paying for asks at once. A new request replaces the old one and restarts its clock; `cancelWithdraw()` drops it.
2. Wait until `GET /v1/ledger/account/<address>` shows `request.status` `ready`: a ledger root built at least 30 minutes after your request has activated (its activation delay is 15 minutes on Sepolia), so it has charged what you used before asking.
3. `GET /v1/ledger/proof/<address>` returns the ready-made `calldata`: `executeWithdraw(seq, proofs)`, the proof of your balance in the active root. Send it to the Diamond from the same wallet. It pays `min(requested, your balance under that root)`.

```bash
cast send $DIAMOND "requestWithdraw(uint256)" 1000000 --rpc-url $RPC --private-key $KEY
curl -s $NODE/v1/ledger/account/$YOUR_ADDRESS | jq .request.status      # wait for "ready"
cast send $DIAMOND "$(curl -s $NODE/v1/ledger/proof/$YOUR_ADDRESS | jq -r .calldata)" --rpc-url $RPC --private-key $KEY
```

- `request.status` is `none`, `waiting_root` (no root covers the request yet), `waiting_activation` (an accepted root covers it, its delay is not over), `ready`, or `fallback_open`.
- If a new root activates between fetching the proof and sending it, the transaction reverts `ledger: stale proof, fetch a new one`: fetch the proof again.
- **If the node is down or roots are stuck:** 7 days after the request (`fallback_at`), the same proof route returns fallback calldata (`executeWithdrawFallback`), which pays against the active root's credits and the highest charge over the active and every pending root. Anyone with the published leaf files can build it.
- While a withdrawal is pending, the requested amount is excluded from `available`, so it can no longer be spent on calls. A user who requests their whole balance cannot pay for anything while it waits.
- Calls you made before asking are still charged by the root that covers the request, so you may receive less than you asked for. This is deliberate.

## Related

- [Pay per Request (x402)](x402-inference.md): the per-request rail escrow sits alongside
- [Choose a Delivery Path](inference-paths.md): which rail fits your workload
- [Stream over WebSocket](websocket-signals.md): escrow is what funds streamed signals
