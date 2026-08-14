# Testnet wallet for doc verification

Address: `0x903063F796D536C5367C68589dab4943FdFca91C` (Base Sepolia)

Funded with $20 USDC for testing documented Engine/x402 endpoints against
the live node (devnode.telegraphprotocol.com). No ETH loaded yet, so
on-chain calls (e.g. escrow deposit for WebSocket `subscribe`) aren't
possible until it's topped up.

Private key lives outside this repo at
`~/.claude/telegraph-testnet-wallet/wallet.json`, never commit key
material here.

**Use only with the user's explicit permission for a specific test** —
don't spend from this wallet unprompted, even for doc verification.
