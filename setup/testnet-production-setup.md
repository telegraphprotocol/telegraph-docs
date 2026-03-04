---
description: >-
  Set up a Telegraph validator node for testnet or production using the
  standalone script: one script, no repo required, interactive config.
---

# Testnet & Production Setup

This guide explains how to set up a Telegraph validator node using the **standalone setup script**. You need only this single script—no repository clone and no separate config files. The script installs dependencies, creates schema and config from your answers, sets up Clef (new or existing wallet), and configures the Telegraph service.

## Overview

1. **Get the script** – Download `telegraph-standalone.sh` (e.g. via `curl`). No repo or local config files are required.
2. **Run the script** – It runs in **7 steps** and asks for everything interactively: dependencies, this node’s IP, Genesis node IP, moniker, chain/Diamond/RPCs (or use defaults), and Clef (new wallet or existing keystore).
3. **Interactive config** – You can accept defaults for testnet (Sepolia + Fuji with Alchemy RPCs and known Diamond addresses) or customize chains, Diamond addresses, and RPCs when prompted.
4. **Clef** – Choose to create a new wallet or use an **existing Clef wallet** (path to keystore, optional single address). Useful for existing validator runners.
5. **Fund validator** – Fund the Clef wallet on each chain; the script can optionally fund using a deployer key.
6. **Verify** – Use `systemctl` and `cqlsh` as in the verification section; run any test scripts you have (e.g. from another repo) against the node.

The script **stops the Telegraph service** (if running) before replacing the binary, uses **Alchemy RPCs by default** to avoid public-node timeouts, and defaults Genesis to `54.252.48.30`. All config (Genesis IP, this node IP, moniker, Clef password, chains, Diamond addresses) comes from **prompts or defaults**.

---

## Prerequisites

- **Linux/Unix system** (tested on Ubuntu/Debian)
- **Root/sudo access** (for systemd, Cassandra, and install paths)
- **Genesis node URL** (if this is not the Genesis node)—typically shared by Telegraph Devs, e.g. `http://54.252.48.30:7044`
- **Optional:** Path to an existing Clef config directory (folder containing `keystore` with `UTC--*` key files) if reusing a wallet

No repo clone, `networks.config.json`, or `subnets.yaml` are required—the script creates schema, config, and DB from your answers and embeds subnet config.

---

## 1. Get and run the standalone script

Download and execute the script. The Telegraph binary is downloaded by the script unless you override it.

```bash
curl -sO <url-to-telegraph-standalone.sh>
chmod +x telegraph-standalone.sh
./telegraph-standalone.sh
```

To use a custom Telegraph binary URL (e.g. your own build or bucket):

```bash
TELEGRAPH_BINARY_URL=https://your-bucket.s3.region.amazonaws.com/telegraph ./telegraph-standalone.sh
```

The script has **no dependency on the repo**. It creates schema, config, and DB from prompts and writes files under the install directory (default `/root/telegraph`).

---

## 2. Interactive configuration (what the script will ask)

The script runs in **7 steps**. Below is what you’ll see and what to prepare.

### Step 1 — Dependencies

- **Check and install missing dependencies?** (default: yes)  
  Installs `curl`, `wget`, `tar`, `expect`, and optionally **Cassandra 4.1** if not present. Starts and enables Cassandra and waits for it to be ready (up to 60s).

### Step 2 — Node configuration

- **This node’s IP** – Script detects the primary IPv4; you can accept it or enter another (e.g. public IP for other nodes to reach you).
- **This node’s port** – Default `7044`.
- **Is this the Genesis node?** – If **yes**, this node’s URL is used as Genesis. If **no**, you’ll enter:
  - **Genesis node IP or hostname** – Default `54.252.48.30`.
  - **Genesis node port** – Default `7044`.
- **Node moniker** – Name for your node, e.g. `TelegraphNode`.

**Tip:** If you’re not the Genesis node, get the correct Genesis URL (e.g. `http://<host>:7044`) from Telegraph Devs.

### Step 3 — Network details (chains, Diamond, RPCs)

- **Edit network details?** (default: no)  
  - **No** – Uses default testnet: **Sepolia** and **Avalanche Fuji** with Alchemy RPCs and known Diamond addresses. No input needed.  
  - **Yes** – You’ll set:
    - **Number of chains** (e.g. `2` for Sepolia + Fuji).
    - For each chain: **Chain ID**, **Chain name**, **RPC HTTP URL**, **RPC WebSocket URL**, **Diamond (Port) contract address**.  
    Chains with invalid or empty Diamond addresses are skipped. You need at least one valid chain.

Default Diamond addresses (testnet) and Alchemy-based RPCs are built in so most users can accept defaults.

### Step 4 — Cassandra schema & data

The script creates the Cassandra schema (from an embedded `schema.cql`), clears the old `telegraph` keyspace if present, reapplies it, inserts the networks you configured, and inserts default subnet config rows. No interaction required here.

### Step 5 — Clef setup (new wallet or existing)

- **Use an existing Clef wallet?** (default: no)  
  - **No** – Creates a **new** Clef wallet: installs Clef binary, creates keystore, expect script, and systemd service. You’ll set a **password** for the new wallet (or use the default suggested).  
  - **Yes** – For **existing validator runners** who already have a Clef keystore:
    - **Path to existing Clef config directory** – Folder that contains `keystore` with `UTC--*` key files (e.g. `/home/ubuntu/bridge/clef`). You can press Enter to try common paths.
    - **Use only one specific address?** – Optionally enter one address (e.g. `0x1B5bdc...`) to copy only that key; otherwise all keys in that keystore are copied into the node’s keystore.
    - **Password** – You must use the **same password** that was used when that wallet was created.

After Clef is ready, the script creates/updates the **validator** entry in Cassandra (moniker, domain, `ismine`). It may then ask:

- **Fund validator wallet on chains using deployer private key?** (default: no) – If yes, you provide a deployer private key (hex) and the script attempts to send a small amount to the validator address on each configured chain (e.g. via `cast send` if available). You can skip and fund manually.

### Step 6 — Telegraph binary and .env

- The script **stops `telegraph.service`** if it’s running, then downloads the Telegraph binary (or uses `TELEGRAPH_BINARY_URL`), installs it to `/usr/local/bin/telegraph`, and creates:
  - `chain_id.json` (and Clef chain_id path),
  - `~/.env` (all node and Clef settings, subnet config path, etc.),
  - `config.json` for the node.

No prompts here unless something fails.

### Step 7 — Telegraph systemd service

- Installs and enables `telegraph.service`, starts it, and prints a short summary (paths, how to check status and logs).

---

## 3. Paths and files created by the script

| Purpose            | Path / variable (defaults) |
|--------------------|----------------------------|
| Install root       | `INSTALL_DIR` → `/root/telegraph` |
| Bridge/clef root   | `BRIDGE_DIR` → same as `INSTALL_DIR` |
| Schema             | `$INSTALL_DIR/schema.cql` |
| Subnet config      | `$INSTALL_DIR/subnets.yaml` (full config with API keys; created by script) |
| Clef binary        | `$BRIDGE_DIR/clefBin/clef` |
| Clef config/keystore | `$BRIDGE_DIR/clef` (e.g. `clef/keystore`) |
| Scripts (expect)   | `$BRIDGE_DIR/scripts/` (e.g. `clef_service.exp`) |
| Env and app config | `~/.env`, `/root/config.json` |
| Telegraph binary   | `/usr/local/bin/telegraph` |

The script uses **root** as the service user and does not switch to another user; dependencies and dirs stay under the install root.

---

## 4. After setup: what you need to do

- **Fund the validator wallet** on each chain if the script did not fund it (or you skipped that step). Use the wallet address shown in the script output or in `$BRIDGE_DIR/clef_script.log`.
- **Backup the Clef keystore** (e.g. `$BRIDGE_DIR/clef/keystore/`) and store it securely.
- **Verify** services and DB as in the Verification section below.

---

## 5. Verification steps

### Check services

```bash
sudo systemctl status clef.service
sudo systemctl status telegraph.service
sudo journalctl -u telegraph.service -f
sudo journalctl -u clef.service -f
```

### Check Cassandra and networks

```bash
cqlsh -e "SELECT chainid, name, contractaddress FROM telegraph.network;"
cqlsh -e "SELECT publicethaddress, moniker, domain, ismine FROM telegraph.validator WHERE ismine = true;"
```

### Check logs for registration

Telegraph logs should show registration on each configured network, e.g.:

```
Successfully registered as signer on Sepolia-ETH (ChainID: 11155111)
...
```

---

## 6. Changing config later

- **Genesis IP, node IP, moniker, chains, Diamond addresses:** Re-run the standalone script (with the same or updated answers). Ensure Clef and keystore are preserved if you want to keep the same validator key; the script supports “use existing Clef” and will copy from your existing path again if needed.
- **Telegraph binary only:** Set `TELEGRAPH_BINARY_URL` and run the script again, or replace `/usr/local/bin/telegraph` manually and restart `telegraph.service`.
- **Clef password:** You can set `CLEF_PASSWORD` in `~/.env` (script uses `EnvironmentFile=-/root/.env` for the Clef service) and restart `clef.service` so you don’t have to re-run the full setup.

---

## 7. Troubleshooting

### Cassandra not starting

- Wait up to 60s; the script waits for `cqlsh -e "DESCRIBE KEYSPACES;"` to succeed.
- Check: `sudo systemctl status cassandra`, `tail -f /var/log/cassandra/system.log`, port `9042` open.

### Clef not ready / password errors

- Check: `sudo journalctl -u clef.service -f` and `$BRIDGE_DIR/clef_script.log`.
- When using an **existing** wallet, use the **same password** as when that wallet was created.
- Ensure `$BRIDGE_DIR/clef/keystore` contains the expected `UTC--*` key files.

### No valid chains

- If you chose “Edit network details”, ensure at least one chain has a valid 40‑hex Diamond address (`0x...`). Empty or invalid Diamond addresses are skipped.

### Telegraph service not starting

- Confirm `.env` exists at `~/.env` and `EXTERNAL_SIGNER_URL` points to the Clef IPC path (e.g. `$BRIDGE_DIR/clef/clef.ipc`).
- Ensure Clef is running and the validator wallet is funded on each chain for registration.

### RPC / context deadline exceeded

- The script uses **Alchemy** RPCs by default for Sepolia and Fuji to reduce public-node timeouts. If you edited networks and see timeouts, switch to Alchemy or another reliable RPC and re-run the script (or update DB and `.env` manually).

---

## 8. Security and operational notes

- **Firewall:** Open port **7044** for Telegraph; restrict **9042** (Cassandra) to localhost or VPN if possible.
- **Clef password:** Use a strong password; store it in `~/.env` or a secret manager, never in repo or logs.
- **Keystore:** Backup `$BRIDGE_DIR/clef/keystore` immediately; keep backups encrypted and offline.
- **Existing Clef:** When reusing an existing wallet, the script copies keys into the node’s keystore; keep the original keystore secure and backed up.

---

## 9. Summary

| Before (old flow) | Now (standalone) |
|-------------------|------------------|
| Get `networks.config.json` and `subnets.yaml` from devs | No separate config files; script creates everything from prompts |
| Clone repo, run `telegraph.sh` | Single script; no repo required |
| Manual Clef or repo-specific Clef path | Script asks: new wallet or **existing Clef** (path + optional single address) |
| Multiple scripts (deploy-testnet, telegraph.sh) | One script; optional custom binary via `TELEGRAPH_BINARY_URL` |

You only need the **standalone script**. Run it, follow the **7-step interactive config** (accept defaults for testnet or customize chains/Diamond/RPCs and Clef), then fund the validator and verify with the commands above.
