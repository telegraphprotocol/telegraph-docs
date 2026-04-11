---
description: >-
  How Telegraph validator nodes sign transactions and HTTP requests — Clef
  (external daemon) vs. raw private key (env var / Docker secret).
---

# Node Signing Modes

## Background

Telegraph validator nodes must sign Ethereum transactions (signer registration, bridge relay callbacks) and sign inter-node HTTP requests (Authorization headers). Previously, this required **Clef** — go-ethereum's external signing daemon — to be running as a separate system service on every machine running a node.

This created friction for automated and containerised deployments where running a persistent sidecar process is impractical. A second signing mode was added: **raw private key**, where the node reads its signing key directly from an environment variable or a Docker secret file, with no external process required.

Both modes are fully supported. Clef is unchanged and still recommended for production bare-metal deployments. Raw private key mode is the recommended path for Docker, Kubernetes, and CI environments.

---

## The Two Modes

### Mode 1 — Clef (original, unchanged)

The node connects to a running Clef daemon via an IPC socket or named pipe.

| What it does | Detail |
|---|---|
| Signing key storage | Clef keystore (encrypted JSON, on disk) |
| Signing process | Node asks Clef to sign; Clef responds via IPC |
| Chain ID tracking | `chain_id.json` file, written before each signing request |
| Required env vars | `EXTERNAL_SIGNER_URL` — path to Clef IPC |
| Requires Clef service | Yes (`clef.service` systemd unit) |

**Set in `.env`:**
```
EXTERNAL_SIGNER_URL=/root/bridge/clef/clef.ipc
```

### Mode 2 — Raw Private Key (new)

The node reads the private key directly from memory at startup. No external process.

| What it does | Detail |
|---|---|
| Signing key storage | Environment variable or file (Docker secret) |
| Signing process | In-process using `go-ethereum/crypto` (EIP-155 compliant) |
| Chain ID tracking | Not needed — chain ID passed directly into `types.NewEIP155Signer` |
| Required env vars | `PRIVATE_KEY` (hex) **or** `PRIVATE_KEY_FILE` (path to file containing hex) |
| Requires Clef service | No |

**Set in `.env` (bare metal / VM):**
```
PRIVATE_KEY=0xabc123...
```

**Set in Docker Compose (secret file):**
```
PRIVATE_KEY_FILE=/run/secrets/validator_private_key
```

### Mutual exclusion

Setting both `PRIVATE_KEY` and `EXTERNAL_SIGNER_URL` at the same time causes the node to `log.Fatal` immediately on startup. Choose one mode.

---

## Where Signing Happens (affected code paths)

Every location that previously hard-exited when `EXTERNAL_SIGNER_URL` was empty now resolves the node's address and key through a dual-mode helper. The affected flows are:

| Flow | Trigger | What changes in raw key mode |
|---|---|---|
| `EnsureNodeIsSignerOnAllNetworks` | Startup (10 s delay) | Derives address from key; calls `GetAuth` with raw key transactor |
| `RegisterSigner` | Other node POSTs `/returnSigned` with collected signatures | Previously returned immediately if no Clef; now proceeds to call `AddSigner` on-chain |
| `RegisterSignerDirectly` | Listener sees ≤1 signer on-chain | Derives address from key; calls `AddSigner` with empty signature arrays |
| `signWithKeyServerUnlocked` | Node asked to co-sign a new node's registration | Signs with EIP-155 + raw key instead of Clef `SignTx` |
| `testEmitEvent` listener | `TestEmit` contract event received | Resolves own address from key for `isMine` validator sync |
| `newSignerEvent` listener | `NewSigner` contract event received | Resolves own address from key for `isMine` validator sync and signing decision |
| `GetAuth` (auth.go) | Any on-chain transaction (AddSigner, etc.) | Returns a `bind.NewKeyedTransactorWithChainID` transactor instead of Clef transactor |
| `signWithKeyServer` (signer.go) | General transaction signing | Dispatches to `signWithRawKey` which uses `types.SignTx` + EIP-155 |
| HTTP Authorization header | Any outgoing API call to another node | Signs `keccak256("Authorization")` with raw key instead of Clef |

---

## Key Resolution Helper

All call sites use a single canonical helper in `tools/tools.go`:

```go
func GetPrivateKey() string {
    // 1. Direct env var (bare metal, .env file, compose environment:)
    if pk := os.Getenv("PRIVATE_KEY"); pk != "" {
        return strings.TrimSpace(pk)
    }
    // 2. File path env var (Docker secrets, K8s secrets)
    path := os.Getenv("PRIVATE_KEY_FILE")
    if path == "" {
        path = "/run/secrets/private_key" // Docker secret default mount
    }
    if data, err := os.ReadFile(path); err == nil {
        return strings.TrimSpace(string(data))
    }
    return ""
}
```

**Priority order:** `PRIVATE_KEY` env → `PRIVATE_KEY_FILE` env → `/run/secrets/private_key` (Docker default).

The private key value is **never logged**. Only the derived Ethereum address is logged at startup.

---

## Setup: Bare Metal / VM (Raw Key Mode)

1. Add to your `.env` (same file as all other node config):
   ```
   PRIVATE_KEY=0x<your-hex-private-key>
   ```
   Do **not** set `EXTERNAL_SIGNER_URL`. Do **not** create `chain_id.json` — it is not used in this mode.

2. No Clef service needed. Remove or disable `clef.service` if previously configured:
   ```bash
   sudo systemctl disable clef.service
   sudo systemctl stop clef.service
   ```

3. Fund the address derived from your private key (not the Clef address) on all chains.

4. Restart Telegraph:
   ```bash
   sudo systemctl restart telegraph.service
   ```

5. Confirm in logs:
   ```
   Signer mode: raw private key (PRIVATE_KEY set). Clef not required.
   Wallet mode: raw private key. Node address: 0x...
   Auto-registration: using raw private key mode. Address: 0x...
   ```

---

## Setup: Docker / Docker Compose (Raw Key Mode)

For general Docker Compose node setup (image, env vars, start/stop/update commands), see the [Docker Setup](docker-setup.md) guide. This section covers the **key security pattern** — using Docker secrets so the private key is never in the compose file or a plain `.env`.

### 1. Create the secrets file on the host

```bash
echo "0x<your-private-key>" > ./docker-prod/secrets/private_key.txt
chmod 600 ./docker-prod/secrets/private_key.txt
```

The file contains only the raw hex key (with or without `0x` prefix). No other content.

### 2. docker-compose configuration

```yaml
services:
  telegraph-validator:
    environment:
      - PRIVATE_KEY_FILE=/run/secrets/validator_private_key
      # Do NOT set EXTERNAL_SIGNER_URL
    secrets:
      - validator_private_key

secrets:
  validator_private_key:
    file: ${PRIVATE_KEY_FILE_PATH}   # set in .env.prod, e.g. ./secrets/private_key.txt
```

### 3. .env.prod values needed

```bash
# Path on the HOST to the private key file
PRIVATE_KEY_FILE_PATH=./secrets/private_key.txt

# All other required node config
NODE_ID=node-01
MONIKER=MyNode
KEY=<mpc-party-key>
PARTY_PASSWORD=<strong-password>
IP=http://<PUBLIC_IP>:7044
PORT=7044
CHAIN_ID=11155111
CONTRACT_ADDRESS=0x...
EVM_HTTP_URL=https://...
EVM_WSS_URL=wss://...
GENESIS_IP=http://<genesis-ip>:7044
AUTO_REGISTER_ALL_NETWORKS=true
LOG_LEVEL=5
```

### 4. Run

```bash
cd docker-prod
docker compose --env-file .env.prod up -d
```

### Important: `.env` file in container

The Go app calls `godotenv.Load()` at startup and will fail if no `.env` file exists in the working directory. When running in Docker, all config comes from injected env vars — there is no `.env` file inside the container. Work around this by mounting an empty file:

```yaml
volumes:
  - /dev/null:/app/.env:ro
```

---

## Setup: telegraph-standalone.sh (Interactive Wizard)

The standalone script (used for automated bare-metal node deployment) prompts for signing mode in **Step 5**:

```
Choose signing mode for this node:
  1) Clef  — external signing daemon (more secure, requires separate service)
  2) Raw private key — inject key directly (simpler, suitable for automated deployments)
Enter 1 or 2 [1]:
```

**If you choose option 2 (raw private key):**
- Enter your private key when prompted (input is hidden — `read -s`)
- The node address is derived automatically using `cast wallet address` (requires Foundry) or prompted manually
- The key is written to `/root/.telegraph-secrets` with `chmod 600` — **not** to the main `.env`
- The systemd `telegraph.service` unit includes `EnvironmentFile=-/root/.telegraph-secrets` so the key is injected at service start
- The Clef setup step is skipped entirely
- No `chain_id.json` is created or needed

**If you choose option 1 (Clef):**
- Behaviour is identical to the original script. Clef is downloaded, configured, and started as a systemd service.

---

## Security Model Comparison

| Concern | Clef | Raw Private Key |
|---|---|---|
| Key at rest | Encrypted JSON keystore on disk (password protected) | Plaintext in env var or chmod-600 file |
| Key in memory | Loaded by Clef process only | Loaded by node process |
| Key logged | Never | Never (only derived address is logged) |
| Key in config files | Never | Never — separate secrets file or Docker secret |
| Key in `.env` | Never | Never — `PRIVATE_KEY` is excluded from `Config.Save()` via `json:"-"` |
| Process isolation | Signing in separate Clef process | Signing in-process |
| Suitable for | Bare metal, high-security production | Docker, K8s, automated deployments |
| Requires sidecar | Yes | No |

### Security invariants enforced in code

1. `PRIVATE_KEY` has `json:"-"` tag — never serialised to `config.json` or `.env` by `Config.Save()`
2. `Config.Save()` does not include `PRIVATE_KEY` in its write map
3. No log statement anywhere prints the key value — only the derived `common.Address`
4. `PRIVATE_KEY` and `EXTERNAL_SIGNER_URL` are mutually exclusive — node fatals on startup if both are set
5. Key is read fresh from `GetPrivateKey()` at each call site — not cached globally
6. Scripts use `read -s` (silent) for key prompts — no terminal echo

---

## Migration: Clef → Raw Key (existing node)

If you have a node currently running with Clef and want to switch:

1. **Export** the private key from the Clef keystore:
   ```bash
   # Find the keystore file
   ls /root/bridge/clef/keystore/
   # Decrypt it using web3 tooling to decrypt the JSON keystore
   # Or use cast: cast wallet import --keystore-dir /root/bridge/clef/keystore/
   ```

2. **Store** the key in `/root/.telegraph-secrets`:
   ```bash
   echo "PRIVATE_KEY=0x<key>" | sudo tee /root/.telegraph-secrets > /dev/null
   sudo chmod 600 /root/.telegraph-secrets
   sudo chown root:root /root/.telegraph-secrets
   ```

3. **Update** `/root/.env` — remove `EXTERNAL_SIGNER_URL` line.

4. **Update** `telegraph.service` systemd unit — add:
   ```ini
   EnvironmentFile=-/root/.telegraph-secrets
   ```
   Remove the `ExecStartPre` or `Requires=clef.service` lines if present.

5. **Disable Clef:**
   ```bash
   sudo systemctl disable clef.service
   sudo systemctl stop clef.service
   ```

6. **Restart Telegraph:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart telegraph.service
   ```

7. **Confirm** the same address is now being used (check logs for `Node address: 0x...`). The on-chain registration is tied to the address, not the signing mechanism — no re-registration needed as long as you use the same key.

---

## Troubleshooting

**`Cannot set both PRIVATE_KEY and EXTERNAL_SIGNER_URL`**
Both are set. Remove one. In raw key mode, unset `EXTERNAL_SIGNER_URL` entirely.

**`Invalid PRIVATE_KEY`**
The key value is malformed. It must be a 32-byte hex string with or without `0x` prefix (64 hex chars). Check for trailing newlines or spaces in the secrets file — `GetPrivateKey()` trims whitespace automatically, but verify with `cat -A`.

**Node shows old Clef address after switching**
You switched the key but the on-chain registration was for the old address. The new address needs to be registered — either via `AUTO_REGISTER_ALL_NETWORKS=true` (automatic on restart) or manually via the contract admin (`superAdminAddSigner`). Also update the `telegraph.validator` Cassandra row.

**`EXTERNAL_SIGNER_URL not set, proceeding without signature`** still appearing
This warning comes from `MakeHTTPRequest` in `tools.go`. If you see it in raw key mode something is wrong — `GetPrivateKey()` should have matched first. Check that `PRIVATE_KEY` or `PRIVATE_KEY_FILE` is actually set in the environment the process sees (`sudo systemctl show telegraph.service --property=Environment`).

**Node registers on one chain but not others**
Registration hash is deterministic (`keccak256(address + IP + moniker)`). The contract records used hashes and rejects re-use. If a node was previously removed and is re-registering, change the moniker or IP slightly to produce a new hash, or wait for the hash expiry.
