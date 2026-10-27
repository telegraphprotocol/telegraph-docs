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
| `VALIDATOR_KEY` | The node key: signs epochs, job resolutions, keeper calls and x402 credits. On mainnet use Clef instead (`VALIDATOR_SIGNER_URL` + `VALIDATOR_ADDRESS`); a mainnet node refuses a raw key. `PRIVATE_KEY` is the older name for the same thing on testnets |
| `OPERATOR_KEY` | (Optional, raw-key mode) Signs delivery logs |
| `BLS_PRIVATE_KEY` | The BLS key that signs the epoch state and job resolutions |
| `EPOCH_DURATION_SECONDS` | Epoch (block) length. Default `86400` (24 h); it used to be `3600`. Lower it for testing |
| `DEPLOY_BLOCK` | (Fresh node) The block the Diamond was deployed at, so the node syncs from there and sees the genesis prefixes and intents |
| `PARSER_LLM_ENABLED` | Set `true` to read miner answers into each Intent's shape and to score deterministic and hybrid Intents |
| `INPUT_SCHEMA_MAPPING` | `off`, `shadow` or `on`: whether free-form asks are checked against the Intent's request schema |
| `DB_URL` or `POSTGRES_DSN` | PostgreSQL connection string |
| `EVM_HTTP_URL` | Base Sepolia RPC URL |
| `EVM_WSS_URL` | (Optional) Base Sepolia WSS URL for event listener |
| `DIAMOND_ADDRESS` | Diamond proxy address |
| `PORT` | HTTP server port (default: 7044) |
| `DAEMON_CYCLE_INTERVAL` | (Optional) Daemon poll interval (e.g., `30m`) |
| `INTERNAL_SECRET` | Operator secret for `/validate` and the operator key-install path |
| `TOKENIZER_JSON` | Path to the ModernBERT `tokenizer.json`. Needed to run judgment and hybrid scoring modules |
| `ADAPTER_RAM_BUDGET_BYTES` | (Optional) RAM loaded scoring adapters may hold at once (default: half the memory available to the process) |
| `ADAPTER_BYTES_DIR` | (Optional) Where downloaded scoring modules are stored (about 574 MB per judgment or hybrid adapter) |
| `WASM_COMPILE_CACHE_DIR` | (Optional) Cache for compiled module code, so adapters reload without recompiling |

Evaluation-pool limits, the optional request-builder, intent-classifier and response-parser model servers, and the settings that were removed are listed in [Scoring and Evaluation Pool Settings](validators/validator-setup.md#scoring-and-evaluation-pool-settings).

Miner API keys are **not** environment variables. The node reads none from the environment — per-miner variables such as `LITELLM_API_KEY` or `ZEUS_API_KEY` are inert and should be removed. Install each miner's key against its slug instead:

```bash
curl -X POST https://<node>/miner-dispatcher/miners/<slug>/api-key \
  -H "X-Internal-Secret: $INTERNAL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"api_key":"<key>"}'
```

The key binds to the wallet holding that slug, so the miner must be registered first.

## 3. Set Up PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER telegraph WITH PASSWORD 'telegraph';"
sudo -u postgres psql -c "CREATE DATABASE telegraph OWNER telegraph;"
```

The node does not apply the schema itself. Load `schema.sql`, then every file in `migrations/` in filename order, **before** starting the node (and again before starting any new binary). Each file is safe to re-run:

```bash
psql "$POSTGRES_DSN" -f schema.sql
for f in migrations/*.sql; do psql "$POSTGRES_DSN" -f "$f"; done
```

The node reads and writes what the migrations add (`0001` to `0027` today). Apply them **before** the binary starts; the node does not apply them for you. Starting a binary before `migrations/0009_v2_eval_pipeline.sql` is applied makes epoch score writes and every evaluation-pool query fail. Starting one before `0023_intent_response_formats.sql` breaks every shaped answer and every on-chain job, and before `0026_job_results_format.sql` breaks job results. Starting one before `migrations/0024_truth_source_material.sql` makes every reference-value query fail, so deterministic and hybrid Intents are not ranked, and truth-source uploads are refused.

Deterministic and hybrid Intents get their reference value from truth sources in the evaluation pool, read by the response parser. Set `PARSER_LLM_ENABLED=true` on a scoring node, or none of them is ranked. `TRUTH_SOURCE_ALLOW_PRIVATE` is for local testing only; a mainnet node refuses to start with it set. See [Scoring and Evaluation Pool Settings](validators/validator-setup.md#scoring-and-evaluation-pool-settings).

## 4. Deploy Contracts

> **The V2 contracts are a fresh deployment.** `SubnetFacet` was removed and there is no in-place upgrade for jobs. Deploy a new Diamond rather than upgrading an old one, and copy existing miners across with the migration import (below).

Contracts are deployed with Foundry scripts in `contracts/`. Build the whole project once first, so every script and the verification step use the same build:

```bash
cd contracts
forge clean && forge build
```

**1. Deploy the Diamond and its facets.** `DeployProd.s.sol` fits every transaction under the per-transaction gas cap, picks gas limits from the chain on Sepolia, and resumes if it stops partway. It seeds the genesis **prefixes** (no intents) and refuses to run while any genesis name has no kind.

```bash
MACHINA_PREMINT=0 \
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e \
GENESIS_BLS_BYPASS=true \
SETTLEMENT_ORACLE=<node-key-address> \
PRIVATE_KEY=<admin-key> \
forge script script/DeployProd.s.sol:DeployProd --rpc-url $EVM_HTTP_URL \
  --broadcast --slow --skip-simulation --gas-estimate-multiplier 110
```

- `GENESIS_BLS_BYPASS=true` is for a first deploy without a validator key. Genesis then registers the validator and turns the bypass off (`setBLSBypass(false,false)`). A mainnet node refuses to start while it is on.
- `KEEP_MIGRATION_OPEN=true` keeps miner registration closed after the deploy, for a network that will import existing miners (below). Without it the deploy closes the migration at the end.
- Left without `USDC_ADDRESS` the script deploys a publicly mintable mock token, which is fine for development and useless for anything else (facilitators only settle tokens they recognise).
- Record the deploy block as `DEPLOY_BLOCK` for your nodes.

**2. Install the settlement upgrade** (entitlements and emissions):

```bash
PRIVATE_KEY=<admin-key> DIAMOND_ADDRESS=<diamond> \
forge script script/UpgradeToFlywheel.s.sol:UpgradeToFlywheel --rpc-url $EVM_HTTP_URL \
  --broadcast --slow --skip-simulation --gas-estimate-multiplier 110
```

**3. Register the validator** (BLS key and stake) and publish its details. See [Node Setup, Step 6](validators/validator-setup.md#step-6-register-as-a-validator).

**4. Add the intents miners will serve.** The deploy seeds only prefixes, and a miner cannot register on a prefix. Add intents from a catalog file (each carries its spec):

```bash
# from the node repository root; INTENTS_FILE is relative to contracts/
DIAMOND_ADDRESS=$DIAMOND_ADDRESS RPC_URL=$EVM_HTTP_URL PRIVATE_KEY=<admin-key> \
  INTENTS_FILE=script/intents/fx_now.json ./scripts/prod/register-intents.sh
# DRY_RUN=1 lists what it would do without sending
```

Files shipped in `contracts/script/intents/`: `fx_now.json`, `weather_check.json`, `deterministic.json`, `security.json`, `judgment.json` (a `<PREFIX>_GENERAL` intent for 21 judgment prefixes) and `e2e_mock_chat.json`. Anyone else can propose further intents; the admin approves them. See [Intents](using/intents.md#proposing-a-new-intent).

**5. (Optional) Import existing miners** from the previous deployment. An admin copies every active miner across with the same owner, id, YAML, price and intents. The tool prints a plan first and sends nothing until you add `-apply`:

```bash
go run ./scripts/mainnet/migrate-registry \
    -from-rpc <old-rpc> -from <old-diamond> -to-rpc "$EVM_HTTP_URL" -to <new-diamond>
PRIVATE_KEY=<admin> go run ./scripts/mainnet/migrate-registry ... -apply
cast send $DIAMOND "closeMigration()" ...   # ends imports for good and opens registration
```

**6. Verify.** `scripts/mainnet/verify-deployment.sh` checks the deployment, and `scripts/mainnet/check-deploy-gas.py` checks that every deploy transaction fits the gas cap.

For mainnet, follow the operations runbook (`docs/mainnet-runbook.md` in the node repository): keys and Clef, genesis order, RPC failover and rollback.

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

# Prefixes and intents on-chain
cast call $DIAMOND "getPrefixes()(string[],uint8[])" --rpc-url $EVM_HTTP_URL
cast call $DIAMOND "getCanonicalIntents()(string[])" --rpc-url $EVM_HTTP_URL
```

## 7. Register Miners

Register a miner YAML on-chain. List **intents**, never prefixes:

```bash
YAML_HASH="0x$(sha256sum my-miner.yaml | awk '{print $1}')"
YAML_URL="ipfs://<cid>"  # or https://your-host.com/miner.yaml

cast send $DIAMOND \
  "registerMiner(string,bytes32,address,uint256,string[])" \
  "$YAML_URL" \
  "$YAML_HASH" \
  "$FEE_ADDRESS" \
  10000 \
  '["CHAT_COMPLETION_GENERAL","WEB_SEARCH_GENERAL"]' \
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
