---
description: Dated changes to testnet payments: networks, assets, payee and facilitator. Check it if your agent has a spend allow-list.
---

# Testnet Payment Changes

Dated changes to how the live testnet node (`https://devnode.telegraphprotocol.com`) asks for payment. Times are UTC. The 402 challenge is always the final word: read `accepts[]` each time instead of hard-coding it.

## Today (20 November 2026)

| | Value |
|---|---|
| Diamond (payee for escrow and Ethereum Sepolia payments) | `0x72a70e949362670Bf8bceAd24eFC5b8f950aa08b` |
| Ethereum Sepolia | `escrow` scheme only. `exact` is off. |
| Base Sepolia (`eip155:84532`) | `exact`, USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, payee `0xC0A3FB6d3F1f4B54617d29ffbdA4663Af5F96e2e` (Treasury wallet, off the Diamond's books) |
| Solana Devnet | `exact`, USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| Test USDC on the Diamond (escrow deposits) | `0xcc194e1a843B658526D0D5C431f670028582Ae17` |
| Facilitator | `https://x402.org/facilitator` |

## Changes

| When (UTC) | Change |
|---|---|
| 19 Nov 19:05 | `exact` on Ethereum Sepolia switched off. The facilitator moved to `https://x402.org/facilitator`. The 402 now lists Base Sepolia and Solana Devnet `exact`, plus `escrow` on Ethereum Sepolia. Reason: `facilitator.x402.rs` accepted Ethereum Sepolia payments but never sent the settlement transaction (no settlement since 17 Nov 09:21). |
| 17 Nov 15:29 | The Diamond's USDC went back to the test token `0xcc19…Ae17`. The 402 asked for Circle USDC (`0x1c7D…7238`) from 06:30 to 15:29. The payee stayed the Diamond. |
| 17 Nov 06:30 | New Diamond `0x72a7…a08b` live. The old Diamond `0x3624…b99b` is retired and no node watches it. The 402 asked for Circle USDC. |

## Known limits

- `x402.org/facilitator` is a shared public service. Settlements can fail for a few hours at a time. A failed settlement charges nothing: the node answers 402 and does no work.
- A Base Sepolia or Solana payment is not credited to escrow and is not refunded automatically if the request then fails.
- An ask with `max_budget_usdc` must be paid from escrow while Ethereum Sepolia `exact` is off.
