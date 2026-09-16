---
description: Fund once, then call as often as you like — no per-request settlement, no facilitator round trip, and a receipt for every call.
---

# Paying from Escrow

Escrow is the second way to pay a Telegraph node. You deposit USDC into the Port Contract once, and every call after that is authorized against that balance and settled in a single on-chain transaction at the end of the epoch.

It is **not** a separate payment API. It is one more entry in the same x402 `accepts` array, sent in the same `X-PAYMENT` header, with the same base64 envelope and the same field names as the EVM `exact` scheme. Only `scheme` differs. A client that already speaks x402 changes one string.

This page covers the escrow mechanics. For the x402 rail it sits alongside, see [Paying with x402](x402-inference.md). For what to send and get back, see [Engine Inference](engine-ask.md).

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

The trade-off is that escrow needs funding before the first call, and your balance is only as current as the last epoch settlement.

## What You Need

- A USDC balance on **Base Sepolia** (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`).
- A wallet that can sign an EIP-191 `personal_sign` message.
- The Diamond address for the node you are calling — see [Addresses & Parameters](../protocol/addresses-and-params.md).

**Engine base URL (testnet):** `https://devnode.telegraphprotocol.com/engine`

## Step 1: Fund Your Escrow

Approve the Diamond for the USDC you want to deposit, then deposit it:

```solidity
IERC20(USDC).approve(DIAMOND, amount);
EscrowFacet(DIAMOND).depositUSDC(amount);   // amount in 6-decimal uUSDC
```

There is no minimum deposit for HTTP calls: your balance only has to cover the call itself plus whatever this epoch has already charged you. (The **1.00 USDC** floor is a WebSocket rule, enforced when the connection opens.) Deposit more than one call's worth anyway — a call refused for balance is a call you have to sign and send again.

Read your balance back at any time:

```solidity
EscrowFacet(DIAMOND).escrowBalance(you);      // raw deposited balance
EscrowFacet(DIAMOND).effectiveBalance(you);   // what you can actually spend
EscrowFacet(DIAMOND).agentDebt(you);          // unpaid deliveries, if any
```

`effectiveBalance` is the one the node checks against: your deposit, minus anything pending withdrawal, minus any gas reserve.

> If a settlement ever finds your escrow short, the shortfall is recorded on-chain as **debt** and delivery is suspended until you top up. The next deposit clears the debt first, before anything reaches spendable balance.

## Step 2: Read the Challenge

Escrow is priced on the same routes x402 is — `POST /engine/v1/ask` and `POST /engine/v1/ask/{minerId}`. Call one with no payment header and you get the usual 402, whose body lists the schemes it accepts. Look for the entry whose `scheme` is `escrow`:

```json
{
  "scheme": "escrow",
  "network": "eip155:84532",
  "price": "$0.01",
  "payTo": "0x5a2324aa18613fad4e44bdf0d6c73ec1f6d87ff8",
  "extra": {
    "description": "Deduct from the caller's Telegraph escrow balance at the next epoch close. Fund it once with EscrowFacet.depositUSDC(amount); no per-request settlement.",
    "resource": "/v1/ask",
    "signWith": "personal_sign (EIP-191)",
    "message": "Telegraph Escrow Payment\n\nWallet: {from}\nPay To: 0x5a2324aa…\nAmount: 10000 uUSDC\nResource: /v1/ask\nNonce: {nonce}\nValid After: {validAfter}\nValid Before: {validBefore}"
  }
}
```

`extra.message` is the exact template you sign, with `{from}`, `{nonce}`, `{validAfter}` and `{validBefore}` to fill in. Three things about it trip people up:

- **Read the amount off the message template.** The first challenge quotes a human `price` (`"$0.01"`), while the fresh challenge attached to a *refusal* carries `amount` in μUSDC instead. The `Amount:` line of `extra.message` is present in both, so that is the reliable place to read the figure for `authorization.value`. For a $0.01 call it is `10000`.
- **`resource` is the path *inside* the engine** — `/v1/ask`, without the `/engine` prefix you actually called. Sign the template as given; do not rebuild it from your request URL.
- **Lowercase your address when you substitute `{from}`.** The node lowercases the wallet and payTo before it checks your signature, so a checksummed address signs different bytes and is rejected with `signature is from …, not authorization.from …`.

## Step 3: Sign and Send

Sign the reconstructed message with `personal_sign`, then send it back in `X-PAYMENT` as base64 JSON:

```json
{
  "x402Version": 2,
  "scheme": "escrow",
  "network": "eip155:84532",
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

Send it in `X-PAYMENT`, **not** `PAYMENT-SIGNATURE` — that header belongs to the x402 `exact` rail and escrow is not read from it.

Rules the node enforces, all of them committed to by the signature:

- `value` must equal the quoted amount **exactly**. Underpaying and overpaying are both refused.
- `to` must be the Diamond.
- The validity window (`validBefore` − `validAfter`) may be at most **2 minutes**.
- `nonce` must not have been used before by this wallet.
- The `resource` is inside the signed message, so a signature bought for one endpoint cannot be presented at another.

> The signed message is deliberately **not** an EIP-3009 `TransferWithAuthorization`. A valid one of those is a bearer instrument — anyone who lifted it out of a log or a proxy could submit it to the USDC contract and actually move your money. Escrow proves intent, so it signs a human-readable message that no contract will ever accept.

## Step 4: Read the Receipt

A served request returns `X-PAYMENT-RESPONSE` (base64 JSON):

```json
{
  "success": true,
  "scheme": "escrow",
  "network": "eip155:84532",
  "payer": "0xyourwallet…",
  "amount": "10000",
  "settlement": "epoch",
  "epoch": 314
}
```

There is **no transaction hash**, and that is not an omission. Escrow does not touch the chain per request, which is the entire point. `settlement: "epoch"` says the charge is applied when the epoch closes, and `epoch` names the `submitEpoch` transaction it will ride — that is the transaction to look for on-chain.

**A request that fails is never billed and carries no receipt.** Treat a missing header on a non-2xx as "not charged" — and retry with a fresh nonce, never the one you just sent.

## Putting It Together

The whole rail is three fetches and a signature — no SDK, no facilitator, no on-chain call per request:

```ts
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const NODE = 'https://devnode.telegraphprotocol.com/engine';
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() });

export async function ask(question: string) {
  const body = JSON.stringify({ query: question });   // the field is `query`
  const json = { 'Content-Type': 'application/json' };

  // 1 — read the challenge
  const challenge = await fetch(`${NODE}/v1/ask`, { method: 'POST', headers: json, body })
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

  // 2 — fill the template in place and sign it verbatim
  const message = template
    .replace('{from}', authorization.from)
    .replace('{nonce}', authorization.nonce)
    .replace('{validAfter}', authorization.validAfter)
    .replace('{validBefore}', authorization.validBefore);
  const signature = await wallet.signMessage({ message });

  // 3 — same request, now carrying the authorization
  const payment = btoa(JSON.stringify({
    x402Version: 2,
    scheme: 'escrow',
    network: escrow.network,
    payload: { signature, authorization },
  }));
  const res = await fetch(`${NODE}/v1/ask`, {
    method: 'POST', headers: { ...json, 'X-PAYMENT': payment }, body,
  });
  if (res.status === 402) throw new Error((await res.json()).reason);

  const header = res.headers.get('X-PAYMENT-RESPONSE');
  return { answer: await res.json(), receipt: header ? JSON.parse(atob(header)) : null };
}
```

To smoke-test a wallet from a terminal before wiring any of that up:

```bash
NODE=https://devnode.telegraphprotocol.com/engine
ADDR=$(cast wallet address --private-key "$PRIVATE_KEY" | tr 'A-Z' 'a-z')
NOW=$(date +%s)
NONCE="test-$NOW"

curl -sS -X POST "$NODE/v1/ask" -H 'Content-Type: application/json' \
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
  '{x402Version:2,scheme:"escrow",network:"eip155:84532",
    payload:{signature:$s,authorization:{from:$f,to:$t,value:$v,validAfter:$a,validBefore:$b,nonce:$n}}}' \
  | base64 -w0)

curl -sS -D - -X POST "$NODE/v1/ask" -H 'Content-Type: application/json' \
  -H "X-PAYMENT: $PAYMENT" -d '{"query":"What is the current price of Bitcoin?"}'
```

The body field is `query` — see [Engine Inference](engine-ask.md). Sending anything else is refused *after* the payment is accepted, with `400 {"error":"invalid request body"}`, and the nonce is spent.

An unfunded wallet gets `insufficient escrow for delivery: committed=0 μUSDC + price=10000 μUSDC > available=0 μUSDC`, which is a useful signal on its own: it means the signature verified and only the balance is missing.

## When a Payment Is Refused

Every refusal is a `402` whose body carries a `reason` and a fresh challenge, so a client that can fix the problem knows what to sign next.

| `reason` contains | What happened |
|---|---|
| `costs N uUSDC, authorization offers M` | `value` disagrees with the quote — re-read the challenge |
| `already been used` | Replayed nonce — mint a fresh one |
| `expired at …` / `not valid yet` | Outside the validity window; check your clock |
| `valid for …; the maximum is 2m0s` | Window longer than 2 minutes |
| `escrow pays the diamond at …` | `to` is not the Diamond |
| `signature is from …, not authorization.from …` | Signer does not match the claimed payer |
| `insufficient escrow for delivery: committed=… + price=… > available=…` | Balance too low — deposit more. `committed` is what this epoch has already charged you |
| `delivery suspended: outstanding debt of …` | A past settlement found you short; deposit at least the debt to clear it |

**Whether a refusal burns your nonce depends on where it failed.** Everything checked before the signature — network, recipient, amount, timestamps, the signature itself — is rejected without recording the nonce, so it stays usable. Once the signature verifies the nonce is spent, and it stays spent even if the call is then refused for balance: handing back a reusable signature after a rejection would be a replay window. The simple rule is to mint a fresh nonce for every attempt.

## Withdrawing

Withdrawals are timelocked, so an agent cannot drain its balance out from under deliveries already in flight:

```solidity
EscrowFacet(DIAMOND).requestWithdraw(amount);   // starts the timelock
EscrowFacet(DIAMOND).executeWithdraw();         // after it expires
EscrowFacet(DIAMOND).cancelWithdraw();          // changed your mind
```

While a withdrawal is pending, the requested amount is excluded from `effectiveBalance`, so it can no longer be spent on calls.

## Related

- [Paying with x402](x402-inference.md) — the per-request rail escrow sits alongside
- [Choosing an Inference Path](inference-paths.md) — which rail fits your workload
- [WebSocket Signal Subscriptions](websocket-signals.md) — escrow is what funds streamed signals
- [Troubleshooting](../troubleshooting.md)
