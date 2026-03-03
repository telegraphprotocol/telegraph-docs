# Local Setup Guide

This guide explains how to use `local-telegraph.sh` to set up a complete local Telegraph validator node environment for testing and development.

## Overview

The `local-telegraph.sh` script automates the entire local setup process in a clear six-step flow:

1. **Dependencies** – Checks/installs Go, Java, Cassandra, Foundry (anvil, forge, cast), and recommends jq. Use `--skip-deps` to skip checks on repeated runs.
2. **DB setup** – Applies `schema.cql` and runs migrations from `migrations/` using local `cqlsh` (no Docker). Idempotent; safe to re-run.
3. **Local chain and contracts** – Starts Anvil on 8545 (chain 31337) and 8546 (chain 31338) if not running; deploys Diamond on both via `DeployLocal.s.sol`; updates `networks.config.json`. Skip with `--skip-deploy`.
4. **Add contracts to DB** – Truncates `telegraph.network` and inserts local networks from `networks.config.json`; inserts default subnet configs if missing.
5. **Clef and Telegraph** – Downloads Clef, configures systemd, generates wallet, funds it on both local chains (so auto-registration works), builds Telegraph from source, installs binary, creates `~/.env` and systemd `telegraph.service` with `SUBNET_DISPATCHER_CONFIG` and `AUTO_REGISTER_ALL_NETWORKS=true`.
6. **Nodes register and listen** – Not a script step: once Telegraph is running, it reads all networks from the DB and, with `AUTO_REGISTER_ALL_NETWORKS=true`, registers and listens on every Diamond contract/port automatically. No extra script action required.

## Prerequisites

- **Linux/Unix system** (tested on Ubuntu/Debian)
- **Foundry/Anvil** installed (for local chains)
- **Go 1.19+** (will be installed if missing)
- **Java 11+** (will be installed if missing)
- **Cassandra** (will be installed if missing)
- **Root/sudo access** (for systemd services)

## Quick Start

### 1. Configure Subnet API Keys (Optional)

Edit `local-telegraph.sh` and set your subnet API keys:

```bash
export SUBNET_18_API_KEY="your_weather_api_key_here"
export SUBNET_19_API_KEY="your_nineteen_api_key_here"
# ... etc
```

### 2. Set Clef Password

Edit `local-telegraph.sh` and change the default password:

```bash
export CLEF_PASSWORD="YourSecurePassword123"
```

**Important:** Use a strong password (10+ characters).

### 3. Configure Node Identity (Optional)

You can override these via environment variables before running the script:

```bash
export MONIKER="MyLocalNode"
export IP="http://127.0.0.1:7044"
export GENESIS_IP="http://127.0.0.1:7044"
```

### 4. Run the Setup Script

```bash
chmod +x local-telegraph.sh

# Full end-to-end setup (recommended for first run)
./local-telegraph.sh

# Fast reconfigure (rebuild binary, env, services; keep existing contracts + DB)
./local-telegraph.sh --skip-deploy

# Skip dependency checks (when Foundry/jq already installed)
./local-telegraph.sh --skip-deps
```

The full script (`./local-telegraph.sh`) will:
- Install dependencies (Go, Java, Cassandra) if needed
- Start Anvil chains on ports 8545 (chain 31337) and 8546 (chain 31338)
- Deploy Diamond contracts on both chains
- Update `networks.config.json` with deployed contract addresses
- Set up Cassandra schema and run migrations
- Configure Clef service and generate a wallet
- Insert networks and subnet configurations into Cassandra
- Create/refresh validator entry and **fund the validator wallet on both local chains**
- Build the Telegraph binary from source, install it under `/usr/local/bin/telegraph`, and (re)create the `telegraph.service` and `~/.env` (including `SUBNET_DISPATCHER_CONFIG`, `AUTO_REGISTER_ALL_NETWORKS=true`)

**Node registration and listening:** Once Telegraph is running, it loads all networks from the `telegraph.network` table and, with `AUTO_REGISTER_ALL_NETWORKS=true`, automatically registers and listens on every Diamond contract. This is runtime behavior; no separate script step is needed.

## What the Script Does

### 1. Anvil Chain Management

- Checks if Anvil is running on ports 8545 and 8546
- Starts chains if not running:
  - Chain 1: Port 8545, Chain ID 31337
  - Chain 2: Port 8546, Chain ID 31338
- Waits for chains to be ready before proceeding

### 2. Diamond Contract Deployment

- Deploys Diamond contracts using `contracts/script/DeployLocal.s.sol`
- Uses default Anvil account: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- Captures deployed Diamond addresses from Forge output
- Updates `networks.config.json` with deployed addresses

### 3. Database Setup

- Creates Cassandra keyspace `telegraph` if it doesn't exist
- Applies schema from `schema.cql`
- Runs migrations from `migrations/` using **local cqlsh** (no Docker): applies each `migrations/*.cql` in order
- Truncates `telegraph.network` table (local setup only)
- Inserts local networks from `networks.config.json`
- Inserts subnet configurations

### 4. Clef Configuration

- Downloads Clef binary if not present
- Creates systemd service `clef.service`
- Generates wallet account automatically
- Configures expect script for password automation
- Starts Clef service

### 5. Network Configuration

- Reads `networks.config.json` from project root
- Parses `local` section for chain configurations
- Inserts networks into `telegraph.network` table:
  - Chain ID 31337 (Local-Chain-1)
  - Chain ID 31338 (Local-Chain-2)

### 6. Validator Entry

- Extracts Clef wallet address from logs
- Creates/updates validator entry in `telegraph.validator`:
  - `publicethaddress`: Clef account address
  - `moniker`: From `MONIKER` env var or default "LocalTestNode"
  - `domain`: From `IP` env var or default "http://127.0.0.1:7044"
  - `ismine`: `true`
 - **Funds the validator wallet on both local chains (31337, 31338) using Anvil's default rich account (if `cast` is available)** so auto-registration has gas.

### 7. Telegraph Node Configuration

- Builds the Telegraph binary from local source (overwriting any existing install)
- Creates `.env` file in `$HOME/.env` with:
  - `CHAIN_ID=31337`
  - `CONTRACT_ADDRESS`: First local chain Diamond address
  - `EXTERNAL_SIGNER_URL`: Clef IPC path
  - `SUBNET_DISPATCHER_CONFIG`: Path to repo `subnets.yaml`
  - `AUTO_REGISTER_ALL_NETWORKS=true`
  - All subnet API keys
- Writes `/root/config.json` with the same core contract (chain ID, Diamond address, RPC URLs) to keep any legacy paths consistent
- Creates systemd service `telegraph.service`
- Enables and starts Telegraph service

### 8. Auto-Registration

- Node automatically registers as signer on all configured networks
- Triggered on startup (after 10 second delay)
- Uses `AUTO_REGISTER_ALL_NETWORKS=true` flag
- Updates `chain_id.json` before each registration

## Verification Steps

### 1. Check Anvil Chains

```bash
# Check if chains are running
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545

curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8546
```

### 2. Check Clef Service

```bash
sudo systemctl status clef.service
sudo journalctl -u clef.service -f
```

### 3. Check Telegraph Service

```bash
sudo systemctl status telegraph.service
sudo journalctl -u telegraph.service -f
```

### 4. Verify Database Networks

```bash
cqlsh -e "SELECT chainid, name, contractaddress FROM telegraph.network;"
```

Expected output:
```
 chainid | name          | contractaddress
---------+---------------+----------------------------------
   31337 | Local-Chain-1 | 0x... (your deployed Diamond)
   31338 | Local-Chain-2 | 0x... (your deployed Diamond)
```

### 5. Verify Validator Entry

```bash
cqlsh -e "SELECT publicethaddress, moniker, domain, ismine FROM telegraph.validator;"
```

### 6. Verify Node is Registered as Signer

Check Telegraph logs for:
```
Successfully registered as signer on Local-Chain-1 (ChainID: 31337)
Successfully registered as signer on Local-Chain-2 (ChainID: 31338)
```

Or use Forge/cast to check on-chain:

```bash
cd contracts
forge script script/CheckSigner.s.sol --rpc-url http://127.0.0.1:8545
```

### 7. Check Auto-Registration Status

Look for these log messages:
```
AUTO_REGISTER_ALL_NETWORKS is enabled, ensuring node is registered on all networks...
Starting auto-registration on all networks (2 networks)
Successfully registered as signer on Local-Chain-1 (ChainID: 31337)
Successfully registered as signer on Local-Chain-2 (ChainID: 31338)
Auto-registration on all networks completed
```

## Troubleshooting

### Anvil Chains Not Starting

**Problem:** Script fails to start Anvil chains

**Solutions:**
- Check if ports 8545/8546 are already in use: `lsof -i :8545`
- Kill existing Anvil processes: `pkill -f anvil`
- Check Anvil logs: `tail -f /tmp/anvil-8545.log`

### Diamond Deployment Fails

**Problem:** Contract deployment fails

**Solutions:**
- Ensure Anvil chains are running and responsive
- Check Forge is installed: `forge --version`
- Verify contracts directory exists: `ls contracts/script/DeployLocal.s.sol`
- Check deployment logs in script output

### Cassandra Connection Issues

**Problem:** Cannot connect to Cassandra

**Solutions:**
- Check Cassandra is running: `cassandra -v`
- Wait longer for Cassandra to start (can take 60+ seconds)
- Check Cassandra logs: `tail -f /var/log/cassandra/system.log`
- Verify port 9042 is open: `netstat -tlnp | grep 9042`

### Clef Service Not Starting

**Problem:** Clef service fails to start

**Solutions:**
- Check Clef logs: `sudo journalctl -u clef.service -f`
- Verify Clef binary exists: `ls $BRIDGE_DIR/clefBin/clef`
- Check expect script permissions: `ls -l $BRIDGE_DIR/scripts/clef_service.exp`
- Verify password is set correctly in script

### Networks Not Inserted

**Problem:** Networks table is empty after script runs

**Solutions:**
- Check `networks.config.json` exists and is valid JSON
- Verify `jq` is installed (or script will use fallback parser)
- Check script output for parsing errors
- Manually verify config: `cat networks.config.json | jq .local`

### Node Not Auto-Registering

**Problem:** Node doesn't register as signer automatically

**Solutions:**
- Check `.env` has `AUTO_REGISTER_ALL_NETWORKS=true`
- Verify `EXTERNAL_SIGNER_URL` is set correctly
- Check Clef is running and accessible
- Look for errors in Telegraph logs
- Ensure wallet has funds on local chains (for gas)

### Migration Failures

**Problem:** Database migrations fail

**Solutions:**
- Check migration files exist: `ls migrations/*.cql`
- Verify Cassandra is accessible: `cqlsh -e "DESCRIBE KEYSPACES;"`
- Check migration script: `cat scripts/migrate.sh`
- Try running migrations manually: `make db-migrate`

## Manual Steps (If Needed)

### Fund the Clef / Validator Wallet (Fallback)

In normal operation, `local-telegraph.sh` **automatically funds the validator wallet on both local chains** using `cast` and the default Anvil account.
If `cast` is not installed or funding fails (e.g. chains not ready), you can fund manually:

```bash
# Get wallet address from Clef logs
WALLET=$(grep -oE "0x[a-fA-F0-9]{40}" $BRIDGE_DIR/clef_script.log | head -1)

# Fund on chain 1 (using Anvil default account)
cast send $WALLET --value 10ether \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Fund on chain 2
cast send $WALLET --value 10ether \
  --rpc-url http://127.0.0.1:8546 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Manually Register as Signer

If auto-registration fails, you can manually trigger it:

```bash
# Via HTTP endpoint (if exposed)
curl -X POST http://127.0.0.1:7044/api/transaction/register-signer

# Or restart Telegraph service
sudo systemctl restart telegraph.service
```

## Configuration Files

### networks.config.json

The script reads local network configuration from `networks.config.json`:

```json
{
  "local": [
    {
      "chainId": 31337,
      "name": "Local-Chain-1",
      "type": "EVM",
      "rpcHttp": "http://127.0.0.1:8545",
      "rpcWs": "ws://127.0.0.1:8545",
      "diamondAddress": ""  // Will be populated by script
    }
  ]
}
```

**Note:** The script updates `diamondAddress` fields after deployment.

### .env File

Generated at `$HOME/.env` with all node configuration:

- `CHAIN_ID`: 31337 (first local chain)
- `CONTRACT_ADDRESS`: Deployed Diamond address
- `EXTERNAL_SIGNER_URL`: Clef IPC path
- `AUTO_REGISTER_ALL_NETWORKS`: true
- Subnet API keys
- Database connection info

## Multi-node local test (multiple validators)

To run **two or more** validator nodes on the same machine (each with its own signer, like production):

1. Run the multi-validator script from the project root:
   ```bash
   chmod +x scripts/local-multi-validator.sh
   ./scripts/local-multi-validator.sh
   ```
   This runs `local-telegraph.sh` (first node on port 7044), then adds one extra node (port 7045) with its own Cassandra, Clef wallet, and Telegraph process. Each node **auto-registers** as a signer on the Diamond (`AUTO_REGISTER_ALL_NETWORKS=true`).

2. Optional: add more extra nodes:
   ```bash
   ./scripts/local-multi-validator.sh --extra-nodes 2
   ```
   (First node + 2 extra = 3 nodes total; second extra node uses port 7046 and Cassandra on 9044.)

3. If you already have the first node set up:
   ```bash
   ./scripts/local-multi-validator.sh --skip-first
   ```
   Only provisions the extra node(s); Cassandra for each extra node must be reachable (script will try to start it via Docker on 9043, 9044, … if available).

4. **WSL 2 without Docker:** If you run in WSL 2 and Docker is not available, the script exits with instructions. Either enable [Docker Desktop WSL 2 integration](https://docs.docker.com/go/wsl2/), or start a second Cassandra manually on port 9043 (e.g. another instance or a container from a host that has Docker), then run `./scripts/local-multi-validator.sh --skip-first`.

5. Check nodes:
   ```bash
   sudo systemctl status telegraph.service telegraph-node2.service
   sudo journalctl -u telegraph-node2.service -f
   ```

Each extra node has a **separate Clef** (separate signer address), separate Cassandra (so its validator table has exactly one `ismine=true`), and the same Anvil chains/Diamond contracts. The app’s validator DB client supports a non-default Cassandra port via `DB_URL=127.0.0.1:9043` (see `pkg/db/validator`).

## Next Steps

After successful setup:

1. **Check registration**: Run `./tests/check-registration.sh` (choose **Local** when prompted).
2. **Test subnet inference**: Run `./tests/subnet-inference-test.sh` (choose **Local**, then use the node IP if prompted).
3. **Test cross-chain bridging**: Run `./tests/bridge-test.sh` (choose **Local**; deploy or use existing receiver on chain 31338).
4. **Monitor logs**: `sudo journalctl -u telegraph.service -f`
5. **Check database**: Query `telegraph.transaction` and `telegraph.subnet_requests`

## End-to-End Test Scripts (from project root)

### Check registration

- **Script**: `tests/check-registration.sh`
- **What it does**: Checks node status, Clef, wallet balance on configured networks, and validator DB entry.
- **Usage**: From project root, run `./tests/check-registration.sh`. When prompted, choose **(1) Local** (or 2 for Testnet). For Local it uses `networks.config.json` local section and your node IP.

### Subnet inference test (same-chain)

- **Script**: `tests/subnet-inference-test.sh`
- **What it does**:
  - Prompts for **(1) Local** or **(2) Testnet** and **Network** (e.g. Sepolia for testnet).
  - Reads the Diamond address from `networks.config.json` (local or testnet section).
  - Deploys `SubnetTestApp`, deposits gas, emits a BitMind image inference request; verifies response on the callback contract.
- **Usage** (from project root):

```bash
chmod +x tests/subnet-inference-test.sh
./tests/subnet-inference-test.sh
```

Then watch Telegraph logs:

```bash
sudo journalctl -u telegraph.service -f
```

You should see a `SubnetRequestOut` event handled, HTTP call to the BitMind subnet, and a response propagated back to the callback contract if signing is configured.

### Cross-chain bridge test

- **Script**: `tests/bridge-test.sh`
- **What it does**:
  - Prompts for **(1) Local** or **(2) Testnet** and **Network A** (origin) / **Network B** (destination). Default testnet: Sepolia → Fuji.
  - For Local: uses Diamond on 8545 and 8546; for Testnet uses `networks.config.json` testnet section.
  - Optionally deploys `BridgeReceiverTestApp` on destination or uses existing; deposits gas on destination; emits outbound message from origin; verifies message delivery and payload match.
- **Usage** (from project root):

```bash
chmod +x tests/bridge-test.sh
./tests/bridge-test.sh
```

When prompted, choose Local (or Testnet), then **(d)** to deploy a new receiver or **(e)** to use an existing address.

Then monitor Telegraph logs:

```bash
sudo journalctl -u telegraph.service -f
```

You should see a `BridgeSwapOutData` event from chain `31337` and the node’s cross-chain handling flow for that message.

## Cleanup

To reset everything:

```bash
# Stop services
sudo systemctl stop telegraph.service
sudo systemctl stop clef.service

# Kill Anvil chains
pkill -f anvil

# Drop database (WARNING: deletes all data)
cqlsh -e "DROP KEYSPACE IF EXISTS telegraph;"

# Remove systemd services
sudo systemctl disable telegraph.service clef.service
sudo rm /etc/systemd/system/telegraph.service
sudo rm /etc/systemd/system/clef.service
sudo systemctl daemon-reload
```

## Support

For issues or questions:
- Check logs: `sudo journalctl -u telegraph.service -f`
- Review script output for errors
- Verify all prerequisites are installed
- Check `networks.config.json` format
