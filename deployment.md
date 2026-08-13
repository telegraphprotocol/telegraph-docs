---
description: Step-by-step guide to deploying a Telegraph protocol node on Base Sepolia.
---

# Deploying a Node

How to build, configure, and run a Telegraph node.

## Prerequisites

- **Go 1.25+** — for building the node binary
- **Foundry** (`forge` + `cast`) — for contract deployment and interaction
- **PostgreSQL 16** — for node state storage
- **Base Sepolia ETH** — for gas (get testnet ETH from a [Base Sepolia faucet](https://www.alchemy.com/faucets/base-sepolia))
- **Base Sepolia RPC** — Alchemy or Infura endpoint

## 1. Clone and Build

> **Access required.** The node source repository is currently private. Contact the Telegraph team for access before starting — the clone below will 404 otherwise.

```bash
git clone https://github.com/telegraphprotocol/Telegraph
cd Telegraph
go build -o /usr/local/bin/telegraph .
```

## 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|---|---|
| `PRIVATE_KEY` | Node wallet private key |
| `DB_URL` or `POSTGRES_DSN` | PostgreSQL connection string |
| `EVM_HTTP_URL` | Base Sepolia RPC URL |
| `EVM_WSS_URL` | (Optional) Base Sepolia WSS URL for event listener |
| `DIAMOND_ADDRESS` | Diamond proxy address |
| `PORT` | HTTP server port (default: 7044) |
| `LITELLM_API_KEY` | (Optional) API key for LiteLLM-based miners |
| `BITMIND_API_KEY` | (Optional) API key for BitMind miner |
| `ZEUS_API_KEY` | (Optional) API key for Zeus weather miner |
| `DAEMON_CYCLE_INTERVAL` | (Optional) Daemon poll interval (e.g., `30m`) |

## 3. Set Up PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER telegraph WITH PASSWORD 'telegraph';"
sudo -u postgres psql -c "CREATE DATABASE telegraph OWNER telegraph;"
```

The node auto-creates tables on first run via the schema migration.

## 4. Deploy Contracts

Deploy the Diamond and all facets to Base Sepolia:

```bash
cd contracts
source ../.env
export PRIVATE_KEY DIAMOND_ADDRESS

forge script script/FullDeploy.s.sol \
  --rpc-url $EVM_HTTP_URL --broadcast \
  --libraries evm/AuthLib.sol:AuthLib:0x9107d79604Fc3DefF9831c4b06fd05e7add51F19 \
  --libraries evm/libraries/BLS.sol:BLS:0x9eA9fD72a8Ec047A96132246064Cc5c0b853C4c0
```

Configure the diamond after deployment:

```bash
forge script script/ConfigureDiamond.s.sol --rpc-url $EVM_HTTP_URL --broadcast
```

## 5. Start the Node

```bash
/usr/local/bin/telegraph
```

Or with systemd:

```ini
[Unit]
Description=Telegraph Protocol Node
After=network.target postgresql.service

[Service]
Type=simple
User=<user>
ExecStart=/usr/local/bin/telegraph
WorkingDirectory=/path/to/Telegraph
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable telegraph
sudo systemctl start telegraph
```

Check logs:

```bash
sudo journalctl -u telegraph -f
```

## 6. Verify Health

```bash
# HTTP API
curl http://127.0.0.1:7044/daemon/health

# Active miners
curl http://127.0.0.1:7044/api/miners

# On-chain intents
cast call $DIAMOND "getCanonicalIntents()(string[])" --rpc-url $EVM_HTTP_URL
```

## 7. Register Miners

Register a miner YAML on-chain:

```bash
YAML_HASH="0x$(sha256sum my-miner.yaml | awk '{print $1}')"
YAML_URL="ipfs://<cid>"  # or https://your-host.com/miner.yaml

cast send $DIAMOND \
  "registerMiner(string,bytes32,address,uint256,string[])" \
  "$YAML_URL" \
  "$YAML_HASH" \
  "$FEE_ADDRESS" \
  10000 \
  '["CHAT_COMPLETION","WEB_SEARCH"]' \
  --rpc-url $EVM_HTTP_URL --private-key $PRIVATE_KEY
```

See the full [Miner Registration guide](miners/miner-registration.md) for details.

## Testnet Node

A public testnet node is available for testing:

| Service | Endpoint |
|---|---|
| HTTP API | `https://devnode.telegraphprotocol.com` |
| WebSocket | `wss://devnode.telegraphprotocol.com/engine/ws` |
| Engine Ask | `https://devnode.telegraphprotocol.com/engine/v1/ask` |

See [Addresses & Parameters](protocol/addresses-and-params.md) for contract addresses and protocol configuration.
