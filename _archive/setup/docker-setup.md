---
description: >-
  Run a Telegraph validator node using Docker Compose — no source code or
  compilation required.
---

# Docker Setup

This guide covers running a Telegraph validator node with Docker Compose. Docker pulls the Telegraph image automatically — no repository clone or Go build needed.

For signing mode background (Clef vs. raw private key) and advanced Docker secrets configuration, see [Node Signing Modes](signing-modes.md).

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (with the Docker daemon running)
- [Docker Compose](https://docs.docker.com/compose/install/) (included in Docker Desktop)

Verify your installation:

```bash
docker --version
docker compose version
```

---

## Quick Start

1. Create a folder for your node:

```bash
mkdir telegraph-node && cd telegraph-node
```

2. Download the required files into that folder:

```
telegraph-node/
  docker-compose.yml     ← provided by Telegraph team
  .env                   ← copy from .env.prod.example and fill in your values
```

3. Fill in your `.env` file (see [Configuration](#configuration) below).

4. Start the node:

```bash
docker compose --env-file .env up -d
```

Docker will automatically pull the Telegraph image from Docker Hub — no source code or compilation needed.

---

## Configuration

Copy `.env.prod.example` to `.env` and fill in your values:

```bash
cp .env.prod.example .env
```

### Environment Variables Reference

| Variable | Description | Example |
|---|---|---|
| `NODE_ID` | Unique identifier for this node in the Telegraph network | `node-abc123` |
| `MONIKER` | Human-readable name displayed in network listings | `telegraph-node-01` |
| `NAME` | Network/chain this node connects to | `ETH-Sepolia` |
| `IP` | Public URL where this node is reachable by peers | `http://<YOUR_PUBLIC_IP>:7044` |
| `PORT` | Port this node listens on for incoming connections | `7044` |
| `KEY` | Shared secret key for TSS (Threshold Signature Scheme) operations | *(secret)* |
| `PARTY_PASSWORD` | Password protecting threshold signing operations | *(secret)* |
| `PRIVATE_KEY_FILE_PATH` | Path on the **host** to your private key file | `./validator.key` |
| `IS_GENESIS` | Whether this is the genesis (founding) node | `false` |
| `GENESIS_IP` | Genesis node URL for bootstrapping (ignored if `IS_GENESIS=true`) | `http://18.229.137.38:7044` |
| `THRESHOLD` | Minimum signers required for threshold signature operations | `3` |
| `CHAIN_ID` | Target blockchain chain ID | `11155111` (Sepolia) |
| `CONTRACT_ADDRESS` | Address of the Telegraph Port contract on the target chain | `0x...` |
| `EVM_HTTP_URL` | HTTP RPC endpoint for the EVM blockchain | `https://sepolia.infura.io/v3/YOUR_KEY` |
| `EVM_WSS_URL` | WebSocket RPC endpoint for real-time blockchain events | `wss://sepolia.infura.io/ws/v3/YOUR_KEY` |
| `SUBNET_ENABLED` | Enable/disable subnet inference functionality | `true` |
| `SUBNET_DEFAULT_TIMEOUT_MS` | Timeout in milliseconds for subnet inference requests | `30000` |
| `SUBNET_MAX_RETRIES` | Max retry attempts for failed subnet requests | `3` |
| `SUBNET_RATE_LIMIT_PER_MINUTE` | Rate limit for subnet requests (requests/min) | `100` |
| `LOG_LEVEL` | Logging verbosity: `2`=Error, `3`=Warn, `4`=Info, `5`=Debug | `5` |
| `BITMIND_API_KEY` | API key for Bitmind subnet provider (Subnet 34) | *(secret)* |
| `ZEUS_API_KEY` | API key for Zeus subnet provider (Subnet 42) | *(secret)* |
| `CORCEL_API_KEY` | API key for Corcel subnet provider (Subnet 19) | *(secret)* |

### Private Key File

`PRIVATE_KEY_FILE_PATH` should point to a plain text file on the host containing your private key as a single hex string:

```
0xYOUR_PRIVATE_KEY_HEX
```

The `0x` prefix is optional — the node trims whitespace and handles it automatically. Keep this file secure and never commit it to version control:

```bash
chmod 600 ./validator.key
```

For the full Docker secrets pattern (key never in `.env`, mounted via Docker secrets), see [Node Signing Modes — Docker Setup](signing-modes.md#setup-docker--docker-compose-raw-key-mode).

---

## Running the Node

### Start (background)

```bash
docker compose --env-file .env up -d
```

### Start (foreground — see logs immediately)

```bash
docker compose --env-file .env up
```

### Stop

```bash
docker compose --env-file .env down
```

### Restart

```bash
docker compose --env-file .env down
docker compose --env-file .env up -d
```

### Update to the latest image

```bash
docker compose --env-file .env down
docker compose --env-file .env pull
docker compose --env-file .env up -d
```

---

## Logs

### Stream all service logs

```bash
docker compose --env-file .env logs -f
```

### Stream logs for a specific service

```bash
# Validator logs only
docker compose --env-file .env logs -f telegraph-validator

# Cassandra logs only
docker compose --env-file .env logs -f cassandra
```

### View last N lines (no follow)

```bash
docker compose --env-file .env logs --tail=100 telegraph-validator
```

---

## Maintenance & Reset

### Check running containers

```bash
docker compose --env-file .env ps
```

### Stop and remove containers (keep data volumes)

```bash
docker compose --env-file .env down
```

### Full reset — remove containers, volumes, and networks

> **This deletes all persistent data including Cassandra state.** Only use this for a clean start.

```bash
docker compose --env-file .env down -v --remove-orphans
```

### Remove unused Docker resources (system-wide cleanup)

```bash
docker system prune -f

# To also remove unused volumes:
docker system prune -f --volumes
```
