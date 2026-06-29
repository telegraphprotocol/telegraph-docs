---
description: Why validators need two separate keys, what each is for, and how to manage them securely.
---

# Key Management

Validators must maintain two distinct cryptographic keys with different purposes and security profiles. This separation is a protocol requirement — it is not optional. Using the same key for both roles creates a security vulnerability where a compromised hot key also endangers your staked MACHINA.

## The Two Keys

### Manager Key (Cold)

The Manager Key controls your staked MACHINA and high-stakes operations. It should never be online.

**What the Manager Key does:**
- Stakes MACHINA to your validator profile.
- Initiates unbonding and withdrawals.
- Claims emission rewards from the Port Contract.
- **Rotates your Operator Key** — if your hot server is ever compromised, the Manager Key is what lets you safely replace the Operator Key without losing your stake.

**Security requirements:** This key should be on a hardware wallet (Ledger, Trezor) or in cold storage. It signs transactions manually, infrequently. Treat it like the private key to a bank account.

### Operator Key (Hot)

The Operator Key is the identity your running node uses in the BFT consensus protocol. It must be accessible on the server running the Telegraph node binary.

**What the Operator Key does:**
- Signs Signal Receipts for each finalized BFT round.
- Participates in commit-reveal consensus (signs commitments and reveals).
- Identifies your node on the P2P network.

**Security requirements:** This key is in active use 24/7. It should be stored as an environment variable (`PRIVATE_KEY=0x...`) or using Clef — an external signing daemon. If this key is compromised, you can replace it using your Manager Key without unbonding your stake.

## Setting Up the Operator Key

The node binary reads the Operator Key from one of two sources:

**Option 1 — Raw private key (simple, recommended for Docker/Kubernetes):**

In your `.env` file:
```
PRIVATE_KEY=0x<your-operator-private-key>
```

The key is loaded at startup and used for all signing operations. Protect the file with `chmod 600`.

**Option 2 — Clef external signer (recommended for bare-metal production):**

Clef is a Go Ethereum signing daemon that keeps the key in a separate process. Your Telegraph node communicates with Clef via a socket:

```
EXTERNAL_SIGNER_URL=/path/to/clef.ipc
```

Do not set both `PRIVATE_KEY` and `EXTERNAL_SIGNER_URL` — the node will fail to start if both are present.

## Rotating the Operator Key

If your server is compromised or you want to refresh the Operator Key, use your Manager Key to rotate it:

1. Generate a new Operator Key.
2. Sign a rotation transaction from your Manager Key.
3. Call `rotateOperatorKey(newOperatorKey)` on the Diamond contract.
4. Update `PRIVATE_KEY` (or Clef) on your server with the new key and restart the node.

The stake remains bonded throughout the rotation — you don't need to unbond.

## Backup Requirements

| Key | Backup requirement |
|---|---|
| Manager Key | Encrypted offline backup (paper, hardware wallet). If lost, your staked MACHINA may be permanently inaccessible. |
| Operator Key | Backup in a separate secure location. If lost, you can rotate it using the Manager Key. |

**Never store both keys in the same location.** The purpose of the separation is that a breach of the hot server should not be able to access your staked MACHINA.

## On Testnet

The testnet node is currently configured as a single-signer genesis node using a `PRIVATE_KEY` in the environment:

```
PRIVATE_KEY=0x<key>
```

The node wallet (`0xB82E4DE09f1C43BBD9ca4907c01f1EEd65a521B9`) is both the Treasury address and the sole registered signer. This is a development configuration — mainnet validators will have distinct Manager and Operator keys with staked MACHINA from separate cold wallets.
