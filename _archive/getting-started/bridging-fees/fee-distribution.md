# Fee Distribution

> **Note:** This section documents a legacy fee model involving wTAO. The current protocol uses native chain tokens for gas and a flat 2% USDC protocol fee for inference. See [x402 Payment & Dynamic Pricing](../../miner-registry/x402-payment.md) for the current model.

## Inference Fees (Current)

| Component | Rate | Details |
|-----------|------|---------|
| Protocol fee | 2% (200 bps) | Deducted from USDC payment before MACHINA swap |
| Miner payout | 98% of payment | Remaining USDC swapped to MACHINA via Uniswap V3 |

## Cross-Chain Gas (Current)

Users deposit gas in the destination chain's native token via `depositGas`. The node uses this balance to pay for on-chain transaction costs when delivering cross-chain messages. See [Gas Deposit](../../examples-and-tutorials/evm-chains/gas-deposit.md).
| EVM (Testnets)     | EVM (Testnets)     | Sender pays 100% Gas Fee   | N/A                           | N/A                                  | Testnet Coin Fee          |
| EVM Ethereum       | EVM (Testnets)     | Sender pays 100% Gas Fee   | N/A                           | N/A                                  | Cannot interact           |
| EVM (Testnets)     | EVM Ethereum       | Sender pays 100% Gas Fee   | N/A                           | N/A                                  | Cannot interact           |
| EVM (Non Ethereum) | EVM (Testnets)     | Sender pays 100% Gas Fee   | N/A                           | N/A                                  | Cannot interact           |
| EVM (Testnets)     | EVM (Non Ethereum) | Sender pays 100% Gas Fee   | N/A                           | N/A                                  | Cannot interact           |
