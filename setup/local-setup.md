---
description: >-
  Run a complete Telegraph validator node on your machine using local chains
  for development and testing.
---

# Local Setup

This guide walks you through setting up a **local Telegraph environment** on your machine. You'll get two local blockchains, deployed Diamond (Port) contracts, a validator node, and everything needed to try cross-chain messaging and subnet inference without touching testnets or mainnet.

---

## What You Get

The local setup script gives you:

1. **Two local chains** (Anvil) on ports 8545 and 8546, so you can test chain-to-chain flows.
2. **Diamond contracts** deployed on both chains and listed in your config.
3. **Database** (Cassandra) with schema and migrations applied.
4. **Clef** for wallet and signing, plus a **Telegraph** binary that registers and listens on both Diamonds automatically.

Once the node is running, it reads all networks from the database and, with auto-registration enabled, registers and listens on every Diamond—no extra steps.

---

## Before You Start

You'll need:

* A **Linux/Unix** system (e.g. Ubuntu/Debian).
* **Foundry** (Anvil, Forge, Cast) for local chains and contracts.
* **Go**, **Java**, and **Cassandra**—the script can install these if missing.
* **Sudo** access for systemd services.

---

## Quick Start

### 1. Optional: Subnet API keys

If you plan to test subnet inference (e.g. Bitmind), edit the script and set your API keys:

```bash
export SUBNET_18_API_KEY="your_weather_api_key_here"
export SUBNET_19_API_KEY="your_nineteen_api_key_here"
```

You can leave these blank to run the node; subnet requests will need keys when you use them.

### 2. Set a Clef password

In the script, set a strong Clef password (10+ characters):

```bash
export CLEF_PASSWORD="YourSecurePassword123"
```

### 3. Run the script

From the project root:

```bash
chmod +x local-telegraph.sh

# First time: full setup (deps, DB, chains, contracts, Clef, Telegraph)
./local-telegraph.sh

# Later: skip contract deploy and dependency checks for a faster run
./local-telegraph.sh --skip-deploy
./local-telegraph.sh --skip-deps
```

The script will:

* Install dependencies if needed (Go, Java, Cassandra, Foundry, jq).
* Start Anvil on 8545 (chain 31337) and 8546 (chain 31338) if not already running.
* Deploy Diamond contracts on both chains and update `networks.config.json`.
* Apply the DB schema and migrations, then fill the network and subnet tables from config.
* Set up Clef, create a wallet, and fund it on both local chains so the node can register.
* Build Telegraph, install the binary, and create `~/.env` and the `telegraph.service` with auto-registration enabled.

After that, when Telegraph starts, it automatically registers and listens on both local Diamonds.

---

## What the Script Does (in brief)

| Step | What happens |
|------|----------------------|
| **Dependencies** | Checks/installs Go, Java, Cassandra, Foundry, jq. Use `--skip-deps` on repeat runs. |
| **DB** | Applies `schema.cql` and runs `migrations/` with local cqlsh. Safe to re-run. |
| **Chains & contracts** | Starts Anvil on 8545/8546 if needed; deploys Diamond on both; updates `networks.config.json`. Use `--skip-deploy` to keep existing contracts. |
| **DB data** | Clears and repopulates `telegraph.network` from config; adds default subnet configs if missing. |
| **Clef & Telegraph** | Downloads/configures Clef, creates the wallet, funds it on both chains, builds and installs Telegraph, creates `~/.env` and systemd services. |

Node registration and listening happen when Telegraph runs: it loads networks from the DB and, with `AUTO_REGISTER_ALL_NETWORKS=true`, registers and listens on every Diamond.

---

## Verify Everything Works

**Chains**

```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545
```

Repeat for `http://127.0.0.1:8546` to confirm both are up.

**Services**

```bash
sudo systemctl status clef.service
sudo systemctl status telegraph.service
sudo journalctl -u telegraph.service -f
```

**Database**

```bash
cqlsh -e "SELECT chainid, name, contractaddress FROM telegraph.network;"
```

You should see chain IDs 31337 and 31338 with your Diamond addresses.

**Registration**

In the Telegraph logs you should see lines like:

```
Successfully registered as signer on Local-Chain-1 (ChainID: 31337)
Successfully registered as signer on Local-Chain-2 (ChainID: 31338)
```

---

## Running Tests

From the project root:

* **Registration check:** `./tests/check-registration.sh` → choose **(1) Local**.
* **Subnet inference:** `./tests/subnet-inference-test.sh` → choose **Local** and the node IP if asked.
* **Cross-chain bridge:** `./tests/bridge-test.sh` → choose **Local**; deploy a new receiver or use an existing one.

Watch the node with `sudo journalctl -u telegraph.service -f` while tests run.

---

## Multiple Validators (optional)

To run two or more validator nodes on the same machine (each with its own signer):

```bash
chmod +x scripts/local-multi-validator.sh
./scripts/local-multi-validator.sh
```

This sets up the first node (port 7044), then adds an extra node (port 7045) with its own Cassandra and Clef. Use `--extra-nodes 2` for more nodes, or `--skip-first` if the first node is already set up.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| Anvil won’t start | Check ports 8545/8546: `lsof -i :8545`. Stop other Anvil: `pkill -f anvil`. |
| Deploy fails | Ensure Anvil is running and Forge is installed: `forge --version`. |
| Cassandra errors | Confirm Cassandra is up (`cassandra -v`), wait 60+ seconds after start, check port 9042. |
| Clef won’t start | Check `sudo journalctl -u clef.service -f` and that the Clef password is set in the script. |
| Node doesn’t register | Ensure `AUTO_REGISTER_ALL_NETWORKS=true` in `~/.env` and the wallet has funds on both local chains. |
| Migrations fail | Check `migrations/*.cql` exist and Cassandra is reachable; try `make db-migrate` if available. |

---

## Cleanup

To reset the environment:

```bash
sudo systemctl stop telegraph.service clef.service
pkill -f anvil
cqlsh -e "DROP KEYSPACE IF EXISTS telegraph;"
# Remove systemd units if desired, then: sudo systemctl daemon-reload
```

---

## Next Steps

* Run the test scripts above to confirm bridge and subnet flows.
* Read **Testnet / Production Setup** when you’re ready to join testnet or mainnet.
* See **Dapp Examples** for integrating your contracts with the Diamond (Port) for cross-chain and subnet inference.
