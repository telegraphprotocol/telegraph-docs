---
description: The keys a validator holds, what each is for, and how to protect and rotate them.
---

# Key Management

A validator holds several keys with different purposes and security profiles. Keeping them apart is a protocol requirement, not an option: a compromised hot key must never also endanger your staked MACHINA.

| Key | Used for | Where it lives | Rotatable? |
|---|---|---|---|
| **Manager key** | Stake, unbonding, profile, role hand-off. Registers the validator. | Cold storage or a hardware wallet. Never on the node. | Hand off with `proposeManager` / `acceptManager` |
| **Operator / node key** | Signs every transaction the node sends (epochs, job resolutions, keeper calls, x402 credits, volume push) and, in raw-key mode, delivery logs. | **Clef**, on its own server (mainnet). A raw key in `.env` on testnets and dev. | Yes, with `rotateOperatorKey` and `setup-server.sh rotate` |
| **BLS key** | Signs the epoch state and every job resolution or failure. | The node's `.env`, mode 600. Clef only does ECDSA, so it cannot hold it. | **No.** The registry cannot rotate a BLS key. See below |
| **libp2p key** | Node identity on the network. | A file, mode 600 (`P2P_KEY_PATH`). | Yes |

On mainnet the node refuses to start if `.env` or the libp2p key is readable by other users.

## The Manager Key (cold)

The Manager Key controls your staked MACHINA and high-stakes operations. It should never be online.

**What it does:**
- Registers the validator and posts the stake (`registerValidatorProfile`).
- Initiates unbonding and withdraws the stake.
- **Rotates your Operator Key**: if your hot server is ever compromised, the Manager Key is what lets you replace the Operator Key without losing your stake.
- Updates your public details (`setValidatorDescription`) and hands the manager role to another key (`proposeManager`, `acceptManager`).

**Security requirements:** a hardware wallet (Ledger, Trezor) or cold storage. It signs manually and infrequently. Treat it like the private key to a bank account.

## The Operator / Node Key (hot, but kept in Clef)

The node key is the identity your running node uses on-chain. Every protocol transaction the node sends is signed with it, so it is in constant use.

### On mainnet: Clef is required

On mainnet the node key **never touches the node**. It lives in **Clef**, an external signing daemon, on a separate server. Clef signs only what its rules allow: the diamond functions the node calls, to the mainnet diamond, on chain 1, with no ETH value and a capped fee. Everything else is refused. A stolen node can still ask for those few calls, but it cannot take the key or use it for anything else.

The node reads two settings:

```
VALIDATOR_SIGNER_URL=/path/to/clef.ipc          # or http://<private-ip>:8550
VALIDATOR_ADDRESS=0x<the Clef account the node signs with>
```

The node refuses to start if Clef does not hold `VALIDATOR_ADDRESS`. On mainnet it also refuses to start when a raw `VALIDATOR_KEY`, `OPERATOR_KEY` or `PRIVATE_KEY` is set, and when the node key, the Treasury and the admin are the same address.

Set the signer up with the script in the repository:

```bash
sudo scripts/mainnet/clef/setup-server.sh init <diamond> <private-ip>   # creates the key inside Clef, prints the two .env lines
sudo scripts/mainnet/clef/setup-server.sh rules <diamond> <private-ip>  # install or refresh the rules
sudo scripts/mainnet/clef/setup-server.sh rotate                         # replace the node key safely
```

Clef's HTTP API has no login, so put it on a private network and let only the node reach port 8550. Back up the keystore, `masterseed.json` and both password files offline, together. `scripts/mainnet/clef/rbac-test.sh` proves the rules before launch.

### On testnets and in development

You can use a raw key in the environment instead:

```
VALIDATOR_KEY=0x<node key>        # signs epochs, job resolutions, keeper calls
OPERATOR_KEY=0x<operator key>     # raw-key mode only: signs delivery logs; its address is the validator's operator
```

`PRIVATE_KEY` and `EXTERNAL_SIGNER_URL` are the older names for the same two choices and still work on testnets. Do not set both a raw key and a signer URL.

## The BLS Key

The BLS12-381 key signs the epoch state and every job resolution. It is generated with a proof of possession:

```bash
go run ./scripts/mainnet/blskey -manager <manager-address>
# prints BLS_PRIVATE_KEY, BLS_PUBKEY, BLS_POP
```

- `BLS_PRIVATE_KEY` goes in the node's `.env`. `BLS_PUBKEY` and `BLS_POP` go into `registerValidatorProfile`.
- **The registry cannot rotate a BLS key.** If it leaks, register a second validator profile with a fresh BLS key (registration is owner-only: the owner opens it, the new profile joins, then it is closed again) and unbond the old one. As a last resort the owner can briefly allow `setBLSBypass`, which is for emergencies only and which a mainnet node refuses to run with.
- The proof of possession is signed in a domain of its own, so it can never double as an epoch or job signature.

## Rotating the Operator Key

If your server is compromised or you want a fresh Operator Key:

1. Generate a new key (on mainnet: `setup-server.sh rotate` on the Clef server, which checks the new key before it touches the old one).
2. From the Manager Key, call `rotateOperatorKey(newOperatorKey)` on the Diamond.
3. Update `VALIDATOR_ADDRESS` (or the raw key) on the node and restart it.

The stake stays bonded throughout. The node follows the rotation on its own.

## Backup Requirements

| Key | Backup requirement |
|---|---|
| Manager Key | Encrypted offline backup (paper, hardware wallet). If lost, your staked MACHINA may be permanently inaccessible. |
| Node key (Clef) | The keystore, `masterseed.json` and both password files, offline, together. |
| BLS key | An encrypted offline backup. It cannot be rotated, so losing it means registering a new profile. |

**Never store the Manager Key and any hot key in the same place.** The purpose of the separation is that a breach of the hot server should not be able to reach your staked MACHINA.

## On Testnet

The testnet node is a single-signer genesis node using raw keys in its environment. On it, one key is the sole registered validator. It signs blocks, submits epochs and resolves jobs. It is **not** the Treasury: protocol fees go to the address returned by `getTreasury()`, which is configured separately on the Diamond.

```bash
curl -s https://devnode.telegraphprotocol.com/status          # "publicKey" = the node's signing wallet
cast call $DIAMOND "getTreasury()(address)" --rpc-url $RPC    # where protocol fees land
```

Using one key for every role is a development configuration. A mainnet validator keeps a cold Manager Key, a node key in Clef, and a BLS key in its `.env`, separately.
