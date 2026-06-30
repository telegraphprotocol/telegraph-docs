---
description: Step-by-step guide to running a Telegraph validator node on Base Sepolia testnet or mainnet.
---

# Node Setup

This guide walks through setting up a Telegraph validator node from scratch. The node is a single Go binary that handles: listening for on-chain events, routing inference requests to miners, participating in BFT consensus (once multiple validators are active), running the Daemon for autonomous signal generation, and serving the API for agents.

**Note on testnet:** The current testnet runs as a single-signer genesis node. BFT consensus requires at least 43 of 64 validators and is not operational on testnet. All other protocol mechanics — miner routing, job creation, x402 payments, the Daemon, and the Engine — are fully functional.

## Prerequisites

- Linux server (Ubuntu/Debian recommended), minimum 4GB RAM.
- [PostgreSQL 14](https://www.postgresql.org/) installed and running locally.
- Go 1.25+ (if building from source), or the pre-built binary.
- [Foundry](https://getfoundry.sh) (`cast`) for sending registration transactions.
- An Alchemy account for Base Sepolia RPC access.
- Your Operator Key (see [Key Management](key-management.md)).

## Step 1: Set Up the Database

Telegraph uses PostgreSQL for storing request logs, daemon results, subscriptions, and epoch state.

```bash
sudo -u postgres psql -c "CREATE USER telegraph WITH PASSWORD 'telegraph';"
sudo -u postgres psql -c "CREATE DATABASE telegraph OWNER telegraph;"
```

The node creates all required tables on first startup — no manual schema migration needed.

## Step 2: Get the Node Binary

Either download the pre-built binary or build from source:

```bash
# Download pre-built (replace URL with the current release)
curl -O https://releases.telegraph.network/telegraph-linux-amd64
chmod +x telegraph-linux-amd64
sudo mv telegraph-linux-amd64 /usr/local/bin/telegraph
```

Or build from source:

```bash
git clone https://github.com/telegraphprotocol/Telegraph.git
cd Telegraph
go build -o telegraph .
sudo mv telegraph /usr/local/bin/telegraph
```

## Step 3: Configure Environment Variables

Copy the environment template and fill in your values:

```bash
cp .env.example .env
chmod 600 .env
```

Minimum required configuration for testnet:

```bash
# ─── Chain ────────────────────────────────────────────────────────────────────
CHAIN_ID=84532
CHAIN_TYPE=EVM
NAME=base-sepolia
EVM_HTTP_URL=https://base-sepolia.g.alchemy.com/v2/<YOUR_KEY>
EVM_WSS_URL=wss://base-sepolia.g.alchemy.com/v2/<YOUR_KEY>

# ─── Contract Addresses ───────────────────────────────────────────────────────
DIAMOND_ADDRESS=0x45b0A6e07E2e15D203f3B5285945c549221f5b0a
USDC_ADDRESS=0xfFC3a7e0F71E9b48D8DBa86dc7d7B44aB24edD18
MACHINA_ADDRESS=0xbAd88F9F77AdCF455d8a6aC08B2d1bA2b312f3e7

# ─── Node Identity ────────────────────────────────────────────────────────────
ID=my-telegraph-node
MONIKER=my-telegraph-node
PORT=7044
P2P_PORT=4001

# ─── Signing ──────────────────────────────────────────────────────────────────
PRIVATE_KEY=0x<your-operator-private-key>
# OR use Clef:
# EXTERNAL_SIGNER_URL=/path/to/clef.ipc

# ─── Database ─────────────────────────────────────────────────────────────────
POSTGRES_DSN=postgres://telegraph:telegraph@127.0.0.1:5432/telegraph?sslmode=disable
DB_URL=postgres://telegraph:telegraph@127.0.0.1:5432/telegraph?sslmode=disable

# ─── Genesis Node ─────────────────────────────────────────────────────────────
IS_GENESIS=false
GENESIS_IP=13.237.89.59    # IP of the bootstrap node
```

### Optional but Recommended

```bash
# ─── x402 Payment Gate ───────────────────────────────────────────────────────
FACILITATOR_URL=https://facilitator.payai.network
BASE_RECEIVING_ADDRESS=0x<your-evm-address>
SOLANA_RECEIVING_ADDRESS=<your-solana-address>

# ─── Miner API Keys (upstream provider credentials) ─────────────────────────────
ZEUS_API_KEY=boreas_...
BITMIND_API_KEY=bitmind-...
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-...
OPENAI_API_MODEL=gpt-4o-mini
CORCEL_API_KEY=...

# ─── Engine & Daemon ──────────────────────────────────────────────────────────
DAEMON_CYCLE_INTERVAL=3h           # 3h for production, 2m for testing
COLLECTORS_YAML_DIR=/path/to/collectors
INTEGRATIONS_DIR=/path/to/integrations

# ─── Internal Security ────────────────────────────────────────────────────────
INTERNAL_SECRET=<random-secret>    # Used for internal API calls (e.g., /validate)
VALIDATOR_KEY=0x...                # Optional separate validator signing key
OPERATOR_KEY=0x...                 # Optional separate operator key
```

### Ports the Node Listens On

| Port | Purpose |
|---|---|
| 7044 | Main HTTP API (miner dispatcher, engine, daemon, admin) |
| 4001 | P2P libp2p (QUIC) — peer discovery and communication |
| 8080 | Engine sub-process (internal; Engine routes through 7044) |
| 3000 | Next.js frontend (if the Intelligence Terminal UI is running) |

Open port **7044** and **4001** in your firewall. Keep 8080 internal (localhost only) and 3000 optional.

## Step 4: Run the Node

### As a systemd Service (Recommended)

Create `/etc/systemd/system/telegraph.service`:

```ini
[Unit]
Description=Telegraph Node
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
EnvironmentFile=/home/ubuntu/.env
ExecStart=/usr/local/bin/telegraph
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable telegraph
sudo systemctl start telegraph
sudo journalctl -u telegraph -f   # Follow logs
```

### Directly (for testing)

```bash
source .env
/usr/local/bin/telegraph
```

## Step 5: Verify the Node is Running

Check the API health:

```bash
curl http://localhost:7044/daemon/health
# {"status":"ok","time":"2026-06-26T18:25:32Z"}

curl http://localhost:7044/miner-dispatcher/integrations
# Returns JSON array of loaded miner integrations
```

Check that the node is loading miners from the on-chain registry by watching startup logs — you should see `MinerRegistered` events being processed and integrations being hot-loaded.

## Step 6: Register as a Validator Signer

Once your node is running and synced, register your Operator Key as a signer:

```bash
cast send 0x45b0A6e07E2e15D203f3B5285945c549221f5b0a \
  "addSigner(bytes,address,string,string)" \
  <pubkey-bytes> \
  <operator-key-address> \
  "my-moniker" \
  "enode://..." \
  --rpc-url https://base-sepolia.g.alchemy.com/v2/<KEY> \
  --private-key <MANAGER_KEY>
```

After registration, your node's wallet should appear in the signer list:

```bash
cast call 0x45b0A6e07E2e15D203f3B5285945c549221f5b0a \
  "getSigners()" \
  --rpc-url https://base-sepolia.g.alchemy.com/v2/<KEY>
```

## Step 7: Monitor Liveness

The protocol penalizes validators for missed rounds. Monitor your node:

```bash
# Watch for missed rounds in logs
journalctl -u telegraph -f | grep -i "missed\|error\|penalty"

# Check node status
curl http://localhost:7044/engine/v1/node/status
```

Key things to monitor:
- **BFT participation** — once multiple validators are live, watch for commit-reveal round participation in logs.
- **zkTLS proofs** — if you're the elected Leader for a round, watch for successful zkTLS scrape + proof generation.
- **Database health** — PostgreSQL connectivity; the node logs DB errors at startup if connection fails.

## Updating the Binary

When a new version is released:

```bash
sudo systemctl stop telegraph
sudo mv /usr/local/bin/telegraph /usr/local/bin/telegraph.bak
# Download/build new binary
sudo mv telegraph-linux-amd64 /usr/local/bin/telegraph
sudo systemctl start telegraph
```

The node rehydrates its state from PostgreSQL and the on-chain registry on restart — no manual migration needed.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Node fails to start with key error | Both `PRIVATE_KEY` and `EXTERNAL_SIGNER_URL` set | Use only one signing method |
| "No USDC accumulated — skipping submit" in logs | Normal on dev/testnet with no agent traffic | Expected behaviour; not an error |
| Integrations not loading | Missing or invalid YAML at the declared URL | Check `MinerRegistered` event processing in logs |
| DB errors on startup | PostgreSQL not running or wrong DSN | Verify `psql` works with the configured DSN |
| Port 7044 already in use | Another process on that port | Change `PORT=` in `.env` or stop the conflicting process |
| `intent_registry` table missing | Known schema gap on current testnet | Non-critical; `/engine/v1/intents` returns error but other endpoints work |
