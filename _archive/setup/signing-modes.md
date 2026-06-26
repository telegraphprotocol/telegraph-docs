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
| Required env vars | `EXTERNAL_SIGNER_URL` — path to Clef IPC |
| Requires Clef service | Yes (`clef.service` systemd unit) |

**Set in `.env`:**
```
EXTERNAL_SIGNER_URL=/root/bridge/clef/clef.ipc
```

### Mode 2 — Raw Private Key

The node reads the private key directly at startup. No external process.

| What it does | Detail |
|---|---|
| Signing key storage | Environment variable or file (Docker secret) |
| Signing process | In-process, EIP-155 compliant |
| Required env vars | `PRIVATE_KEY` (hex) **or** `PRIVATE_KEY_FILE` (path to file containing hex) |
| Requires Clef service | No |

**Set in `.env` (bare metal / VM):**
```
PRIVATE_KEY=0xabc123...
```

**Set via file (Docker / K8s):**
```
PRIVATE_KEY_FILE=/run/secrets/validator_private_key
```

### Mutual exclusion

Setting both `PRIVATE_KEY` and `EXTERNAL_SIGNER_URL` at the same time causes the node to exit immediately on startup. Choose one mode.

---

## What Gets Signed

Both modes cover all signing operations in the node. In raw private key mode, the same operations are performed in-process rather than delegated to Clef:

- **Signer registration** — transactions submitted to the Port contract on each configured chain at startup and when new chains are detected
- **Bridge relay** — transactions submitted when co-signing cross-chain messages collected from other validators
- **Validator co-signing** — signing a new node's registration when asked by another validator
- **Inter-node HTTP requests** — Authorization headers on all outgoing API calls to peer nodes

The node's Ethereum address is derived from the key at startup and is the same address used for all of the above.

---

## Key Resolution

In raw private key mode, the node resolves the key using the following priority order:

1. `PRIVATE_KEY` environment variable (direct hex value)
2. `PRIVATE_KEY_FILE` environment variable (path to a file containing the hex value)
3. `/run/secrets/private_key` (Docker's default secret mount path, used as a fallback)

The private key value is **never logged**. Only the derived Ethereum address appears in logs at startup.

---

## Setup: Bare Metal / VM (Raw Key Mode)

1. Add to your `.env` (same file as all other node config):
   ```
   PRIVATE_KEY=0x<your-hex-private-key>
   ```
   Do **not** set `EXTERNAL_SIGNER_URL`.

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
echo "0x<your-private-key>" > ./secrets/private_key.txt
chmod 600 ./secrets/private_key.txt
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
    file: ${PRIVATE_KEY_FILE_PATH}   # set in .env, e.g. ./secrets/private_key.txt
```

### 3. .env values needed

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
docker compose --env-file .env up -d
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
- Enter your private key when prompted (input is hidden — no terminal echo)
- The node address is derived automatically (requires Foundry) or prompted manually
- The key is stored separately from the main `.env` with restricted permissions
- The Telegraph service is configured to load it at start
- The Clef setup step is skipped entirely

**If you choose option 1 (Clef):**
- Behaviour is identical to the original script. Clef is downloaded, configured, and started as a systemd service.

---

## Security Model Comparison

| Concern | Clef | Raw Private Key |
|---|---|---|
| Key at rest | Encrypted JSON keystore on disk (password protected) | Plaintext in a permissions-restricted file or injected env var |
| Key in memory | Loaded by Clef process only | Loaded by node process |
| Key logged | Never | Never (only derived address is logged) |
| Key in config files | Never | Never — stored in a separate secrets file or Docker secret |
| Key in `.env` | Never | Never — excluded from config persistence |
| Process isolation | Signing in separate Clef process | Signing in-process |
| Suitable for | Bare metal, high-security production | Docker, K8s, automated deployments |
| Requires sidecar | Yes | No |

### Security guarantees

- The private key is never written to the node's config file or included in config exports
- No log line anywhere in the node prints the key value — only the derived wallet address
- Setting both `PRIVATE_KEY` and `EXTERNAL_SIGNER_URL` is rejected at startup (the node will not start)
- Key prompts in setup scripts use silent input — the value is never echoed to the terminal

---

## Migration: Clef → Raw Key (existing node)

If you have a node currently running with Clef and want to switch:

1. **Export** the private key from the Clef keystore using your preferred web3 tooling to decrypt the JSON keystore file (found in the Clef keystore directory).

2. **Store** the key in a restricted file:
   ```bash
   echo "PRIVATE_KEY=0x<key>" | sudo tee /root/.telegraph-secrets > /dev/null
   sudo chmod 600 /root/.telegraph-secrets
   sudo chown root:root /root/.telegraph-secrets
   ```

3. **Update** `/root/.env` — remove the `EXTERNAL_SIGNER_URL` line.

4. **Update** the `telegraph.service` systemd unit to load the secrets file and remove any Clef dependency lines:
   ```ini
   EnvironmentFile=-/root/.telegraph-secrets
   ```

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

7. **Confirm** the same address is now being used (check logs for `Node address: 0x...`). The on-chain registration is tied to the address, not the signing mechanism — no re-registration is needed as long as you use the same key.

---

## Troubleshooting

**`Cannot set both PRIVATE_KEY and EXTERNAL_SIGNER_URL`**
Both are set. Remove one. In raw key mode, remove `EXTERNAL_SIGNER_URL` from your `.env` entirely.

**`Invalid PRIVATE_KEY`**
The key value is malformed. It must be a 32-byte hex string, with or without the `0x` prefix (64 hex characters total). Check for accidental trailing newlines or spaces in your secrets file — the node trims whitespace automatically, but you can verify the file contents with `cat -A`.

**Node shows old Clef address after switching**
You switched the key but the on-chain registration was for the old address. The new address needs to be registered — either automatically via `AUTO_REGISTER_ALL_NETWORKS=true` on restart, or manually by a network admin. Also update the validator entry in the Cassandra database to reflect the new address.

**Warning about missing signer still appearing after switching to raw key mode**
Check that `PRIVATE_KEY` or `PRIVATE_KEY_FILE` is actually visible to the running service. Verify with:
```bash
sudo systemctl show telegraph.service --property=Environment
```

**Node registers on one chain but not others**
Registration uses a deterministic hash based on the node's address, IP, and moniker. If the contract has already recorded that hash (e.g. from a previous registration attempt), it will reject duplicates. Try changing the moniker or IP slightly to produce a new hash, or wait for the hash to expire.
