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

Then load the schema from the node source (Step 2): `schema.sql` first, then every file in `migrations/`, in filename order. Every migration is written to be safe to run more than once.

```bash
psql "$POSTGRES_DSN" -f schema.sql
for f in migrations/*.sql; do psql "$POSTGRES_DSN" -f "$f"; done
```

The node reads and writes the tables and columns these migrations create, so apply them **before** you start the node. Migration `0009_v2_eval_pipeline.sql` in particular adds the evaluation pool, the scoring-module competition and new columns on epoch scores. A node started without it fails to write epoch scores, and every evaluation-pool and competition query fails. Migration `0024_truth_source_material.sql` lets the evaluation pool hold truth sources and adds the columns where each epoch's reference value is stored with the answers it was built from. A node started without it fails every reference-value query, so no deterministic or hybrid Intent is ranked, and truth-source uploads are refused.

## Step 2: Get the Node Binary

> **Access required.** The node source repository is currently private and there is no public release download yet. Contact the Telegraph team for repository access or a pre-built binary before starting this step.

Once you have access, build from source:

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
DIAMOND_ADDRESS=0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
MACHINA_ADDRESS=0x7b9Bd0e5f9a4D0A01db18823De1D8442C84993b7

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
ITSAI_API_KEY=...
SAPLING_API_KEY=...
OPENAI_API_KEY=sk-...
OPENAI_API_MODEL=gpt-4o-mini

# ─── Engine & Daemon ──────────────────────────────────────────────────────────
DAEMON_CYCLE_INTERVAL=3h           # 3h for production, 2m for testing
COLLECTORS_YAML_DIR=/path/to/collectors
INTEGRATIONS_DIR=/path/to/integrations

# ─── Internal Security ────────────────────────────────────────────────────────
INTERNAL_SECRET=<random-secret>    # Used for internal API calls (e.g., /validate)
VALIDATOR_KEY=0x...                # Optional separate validator signing key
OPERATOR_KEY=0x...                 # Optional separate operator key
```

### Scoring and Evaluation Pool Settings

Judgment and hybrid Intents are scored by model adapters: one `.wasm` of about 574 MB each, with a float32 model and its engine inside. The node keeps them on disk and loads them in batches each epoch, inside a RAM budget, so more Intents make the epoch longer rather than using more memory. All of these are optional unless noted.

```bash
# ─── Scoring modules ─────────────────────────────────────────────────────────
TOKENIZER_JSON=/path/to/tokenizer.json   # needed to run judgment/hybrid adapters
ADAPTER_RAM_BUDGET_BYTES=8GiB            # default: half the memory available to the process
ADAPTER_BYTES_DIR=/var/lib/telegraph/adapters
WASM_COMPILE_CACHE_DIR=/var/lib/telegraph/wasm_compile_cache
```

| Variable | Default | What it does |
|---|---|---|
| `TOKENIZER_JSON` | none | The ModernBERT `tokenizer.json` that adapters are scored with. Without a usable tokenizer the node cannot run judgment or hybrid adapters and logs `no usable tokenizer for the adapter promote path` at startup. |
| `TOKENIZER_SHA256` | The network's pinned tokenizer hash | The tokenizer file must have this sha256 or it is refused, because a different vocabulary would score confidently against the wrong tokens. Leave it unset. |
| `ADAPTER_RAM_BUDGET_BYTES` | Half the memory available to the process (Linux `MemTotal`, capped by a cgroup limit); `4GiB` if it can't be read | RAM loaded adapters may hold at once. Accepts bytes or `KiB`/`MiB`/`GiB`. Before its first load an adapter is estimated at 4× its file size (a 574 MB adapter at about 2.3 GB: its working memory while scoring plus the copy the runtime keeps). An adapter larger than the whole budget loads alone. The effective value is logged at startup (`adapter RAM budget`). |
| `ADAPTER_BYTES_DIR` | `CANDIDATE_WASM_DIR` (`data/wasm_candidates`) | Where downloaded scoring modules are stored, one file per hash, re-read each epoch. Size it for every live adapter (about 574 MB each). |
| `WASM_COMPILE_CACHE_DIR` | In memory | Directory for compiled module code, so reloading an adapter each epoch, and after a restart, skips compiling. Safe to delete; it is rebuilt on demand. |
| `ADAPTER_WASM_MAX_BYTES` | `1073741824` (1 GiB) | Largest model adapter a registration may download, in bytes. A value above 2 GiB is capped at 2 GiB with a warning. The old name `WIDE_WASM_MAX_BYTES` is still read, with a deprecation warning. |
| `ADAPTER_WASM_FETCH_BUDGET` | `30m` | Time allowed to download one model adapter (a Go duration). The old name `WIDE_WASM_FETCH_BUDGET` is still read, with a deprecation warning. |

**Evaluation pool.** Uploads are curated as they arrive, and the pool is frozen once per epoch at the rollover; there is no timer to set.

| Variable | Default | What it does |
|---|---|---|
| `EVALPOOL_REQUIRE_SIGNATURE` | `true` | Uploads must be signed. `false` attributes rows to whatever address the uploader claims; local testing only, never on a public node. |
| `EVALPOOL_MIN_PROMPT_CHARS` / `EVALPOOL_MIN_ANSWER_CHARS` | `16` / `8` | Minimum lengths, in characters. |
| `EVALPOOL_MAX_PROMPT_CHARS` / `EVALPOOL_MAX_ANSWER_CHARS` | `16000` / `32000` | Maximum lengths. |
| `EVALPOOL_NEAR_DUP_THRESHOLD` | `0.85` | Similarity at which a prompt counts as a near-duplicate of an existing question. |
| `EVALPOOL_MAX_ROWS_PER_DAY` / `EVALPOOL_MAX_BYTES_PER_DAY` | `5000` / `33554432` | Per contributor, per intent, per UTC day. Overflow waits for a later day. |
| `EVALPOOL_MAX_POOL_SHARE` / `EVALPOOL_SHARE_MIN_POOL` | `0.5` / `200` | Once an intent's pool has this many rows, one contributor may hold at most this share. |
| `EVALPOOL_RANKING_SPLIT_BPS` | `5000` | Share of questions, in basis points, used for miner ranking; the rest are kept hidden for testing scoring modules. |
| `JUDGMENT_QUESTIONS_FROM_POOL` | `true` | Judgment Intents take their ranking question from the evaluation pool when they have an active snapshot. |
| `JUDGMENT_POOL_STRICT` | `false` | `true`: a judgment Intent with no active snapshot is not ranked that epoch, and its miners keep their previous ranking. `false`: it falls back to a stored question, if the node has one. |
| `TRUTH_SOURCE_ALLOW_PRIVATE` | `false` | **Local testing only.** `true` accepts and calls truth sources on `http://` and on private or loopback hosts. A node configured for mainnet refuses to start with it set. |

**Truth sources.** Deterministic Intents, and the comparator half of hybrid Intents, get their reference value from truth sources in the evaluation pool (see [Truth sources](../scoring/contribute-evaluation-data.md#truth-sources-deterministic-intents)). There is nothing per Intent to configure. The node builds each source's request with the request builder (below), calls it with the same timeout as a miner call, and reads the answer **only** with the response parser. Set `PARSER_LLM_ENABLED=true`: with the parser off or unreachable, every truth source fails, and no deterministic or hybrid Intent gets a reference value or is ranked.

**Protocol parameters.** `EVALPOOL_REPLACEMENT_MARGIN` (default `0.02`), `EVALPOOL_MIN_WINRATE` (`0.70`) and `EVALPOOL_BATCH_SIZE` (`200`) decide which scoring module wins a competition. Every validator must use the same values, so leave them at their defaults.

**Optional model servers.** Each runs on its own server and is off unless configured.

| Variables | What it does |
|---|---|
| `REQUEST_BUILDER_LLM_URL`, `REQUEST_BUILDER_LLM_MODEL`, `REQUEST_BUILDER_LLM_KEY` | A dedicated OpenAI-compatible model that turns a question into each miner's HTTP request, for live routing and epoch scoring. It builds truth-source requests too. Unset, requests are built on `OPENAI_API_URL` with `ROUTER_MODEL`. `URL` and `MODEL` must be set together: one without the other, `KEY` alone, or a malformed URL stops the node at startup with `request builder LLM config: …`. The key never falls back to `OPENAI_API_KEY`. |
| `INTENT_CLASSIFIER_ENABLED`, `INTENT_CLASSIFIER_URL`, `INTENT_CLASSIFIER_MODEL`, `INTENT_CLASSIFIER_KEY`, `INTENT_CLASSIFIER_MIN_CONF`, `INTENT_CLASSIFIER_SECONDARY_MIN_CONF`, `INTENT_CLASSIFIER_TIMEOUT_SECONDS`, `INTENT_CLASSIFIER_LABELS_PATH` | A fine-tuned classifier for the intent step of live routing (`INTENT_CLASSIFIER_ENABLED=true`; server default `http://127.0.0.1:8090`). When its top answer is below `INTENT_CLASSIFIER_MIN_CONF` (default `0.5`), out of scope, or the server is unreachable, the request takes the normal LLM route. A malformed value leaves the LLM classifier in place. |
| `PARSER_LLM_ENABLED`, `PARSER_LLM_URL`, `PARSER_LLM_MODEL`, `PARSER_LLM_KEY`, `PARSER_LLM_TIMEOUT_SECONDS`, `PARSER_LLM_SHADOW`, `PARSER_LLM_MAX_BODY_CHARS`, `PARSER_LLM_USER_ENABLED`, `PARSER_LLM_USER_TIMEOUT_SECONDS` | A small OpenAI-compatible model that reads the scored value out of a miner's raw answer for deterministic and hybrid Intents (`PARSER_LLM_ENABLED=true`; server default `http://127.0.0.1:8000/v1`). It is also the only reader of truth-source answers, so deterministic and hybrid Intents get no reference value without it. With `PARSER_LLM_USER_ENABLED` (default `true`) the value is also returned to callers as `parsed` on `POST /engine/v1/ask` and WebSocket `ask`. `PARSER_LLM_SHADOW=true` logs the model's value next to the older parsers but still scores with the older parsers. A malformed value turns the parser off. |

The request builder and the parser can share one server.

**Removed settings.** The node no longer generates questions or reference answers with an LLM, so `GROUNDTRUTH_MODEL`, `GROUNDTRUTH_LLM_TIMEOUT_SECONDS`, `GROUNDTRUTH_MAX_TOKENS` and `SEARXNG_URL` are no longer read. `SCORING_WASM_PATH`, `WASM_POOL_SIZE` and `CONVERTER_MODEL` went with the retired `rank_answer` evaluator adapter. `EVALPOOL_SNAPSHOT_INTERVAL` is ignored (a node that still sets it logs a warning once at startup). Remove them from your `.env`.

### Ports the Node Listens On

| Port | Purpose |
|---|---|
| 7044 | Main HTTP API (miner dispatcher, engine, daemon, admin) |
| 4001 | P2P libp2p (QUIC) — peer discovery and communication |
| 3000 | Next.js frontend (if the Intelligence Terminal UI is running) |

Open port **7044** and **4001** in your firewall. 3000 is optional.

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

curl http://localhost:7044/api/miners
# Returns JSON array of loaded miner integrations
```

Check that the node is loading miners from the on-chain registry by watching startup logs — you should see `MinerRegistered` events being processed and integrations being hot-loaded.

## Step 6: Register as a Validator Signer

Once your node is running and synced, register your Operator Key as a signer. Until this succeeds the node observes the chain but cannot submit anything — its transactions revert with `Caller must be a valid signer`.

```bash
cast send 0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8 \
  "addSigner(address,address,string,string,uint8[],bytes32[],bytes32[],bytes32[])" \
  <operator-key-address> \
  0x0000000000000000000000000000000000000000 \
  "http://your-node-host:7044" \
  "my-moniker" \
  "[]" "[]" "[]" "[]" \
  --rpc-url https://base-sepolia.g.alchemy.com/v2/<KEY> \
  --private-key <MANAGER_KEY>
```

| Argument | Meaning |
|---|---|
| `_signer` | The Operator Key address being added — this is the wallet your node signs with, the same one `GET /status` reports as `publicKey` |
| `_feeAddress` | Payout address. Pass the zero address on Base Sepolia |
| `_domain` | **Where other validators reach your node, including the port.** Liveness probes hit `<domain>/status`, so a bare host without `:7044` probes port 80 and your node reads as unreachable |
| `_moniker` | A human-readable label for your node |
| `sigV`, `sigR`, `sigS`, `hashes` | Approval signatures from the existing signer set. Pass four empty arrays when adding the **first** signer to a deployment; after that the set must approve the addition and the call reverts with `Signer threshold not met` without enough signatures |

Adding the first signer also stamps the deployment's `nodeStartTime`, which the signature threshold is measured against.

After registration, confirm the node is a recognised signer:

```bash
cast call 0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8 \
  "isValidSigner(address)(bool)" <operator-key-address> \
  --rpc-url https://base-sepolia.g.alchemy.com/v2/<KEY>
# → true

cast call 0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8 \
  "getSigners()" \
  --rpc-url https://base-sepolia.g.alchemy.com/v2/<KEY>
```

`addSigner` reverts with `New signer cannot be an existing signer` if the address is already registered, so a repeat call is safe to attempt but will not succeed twice.

## Step 7: Monitor Liveness

The protocol penalizes validators for missed rounds. Monitor your node:

```bash
# Watch for missed rounds in logs
journalctl -u telegraph -f | grep -i "missed\|error\|penalty"

# Check node status
curl http://localhost:7044/status
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
# Apply the database migrations BEFORE starting it (safe to re-run all of them)
for f in migrations/*.sql; do psql "$POSTGRES_DSN" -f "$f"; done
sudo mv telegraph-linux-amd64 /usr/local/bin/telegraph
sudo systemctl start telegraph
```

The node rehydrates its state from PostgreSQL and the on-chain registry on restart. It does not apply database migrations itself: apply every file in `migrations/` **before** starting a new binary, because the new code reads and writes the columns they add. Re-running a migration that is already applied is harmless. After the update, remove any [removed settings](#scoring-and-evaluation-pool-settings) from your `.env`.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Node fails to start with key error | Both `PRIVATE_KEY` and `EXTERNAL_SIGNER_URL` set | Use only one signing method |
| "No USDC accumulated — skipping submit" in logs | Normal on dev/testnet with no agent traffic | Expected behaviour; not an error |
| Integrations not loading | Missing or invalid YAML at the declared URL | Check `MinerRegistered` event processing in logs |
| DB errors on startup | PostgreSQL not running or wrong DSN | Verify `psql` works with the configured DSN |
| Port 7044 already in use | Another process on that port | Change `PORT=` in `.env` or stop the conflicting process |
| `intent_registry` table missing | Known schema gap on current testnet | Non-critical; `/engine/v1/intents` returns error but other endpoints work |
| Epoch score writes fail with a missing column (`case_id`, `corpus_version`), or evaluation-pool queries fail | The new binary started before `migrations/0009_v2_eval_pipeline.sql` was applied | Apply the migrations in `migrations/`, in order, then restart |
| Node stops at startup with `request builder LLM config: …` | `REQUEST_BUILDER_LLM_URL` and `REQUEST_BUILDER_LLM_MODEL` not set together, `REQUEST_BUILDER_LLM_KEY` set alone, or a malformed URL | Set both URL and model, or unset all three to build requests on `OPENAI_API_URL` |
| `no usable tokenizer for the adapter promote path` at startup | `TOKENIZER_JSON` unset, unreadable, or not the pinned tokenizer (sha256 mismatch) | Point `TOKENIZER_JSON` at the ModernBERT `tokenizer.json`; leave `TOKENIZER_SHA256` unset |
| `epoch is on course to OVERRUN` warning | Model-scored Intents don't fit the epoch at the current RAM budget | Raise `ADAPTER_RAM_BUDGET_BYTES` (fewer, larger batches) or `EPOCH_INTENT_CONCURRENCY` if CPU allows. Intents whose batch never ran are logged as `intents NOT REACHED this epoch` and keep their previous ranking |
| `EVALPOOL_SNAPSHOT_INTERVAL no longer exists and is ignored` | The setting was removed; the pool freezes once per epoch at rollover | Remove it from `.env` |
| Reference-value queries fail with a missing column (`corpus_version`, `sources`), or truth-source uploads are refused by a `label_kind` check | The new binary started before `migrations/0024_truth_source_material.sql` was applied | Apply the migrations in `migrations/`, in order, then restart |
| `[truth-source] no truth-source material for this intent in its active snapshot` | The Intent has no truth source in the ranking half of its active evaluation-pool snapshot | Expected until a contributor uploads one; it is used from the epoch after it is frozen. The Intent keeps its previous ranking meanwhile |
| `[truth-source] every sampled truth source failed`, with `[truth-source] source did not produce a value` and `stage: parse` | Response parser off or unreachable (`response parser not installed` means it is off) | Set `PARSER_LLM_ENABLED=true` and check the parser server. Other stages: `build_request` (request builder failed or timed out), `call` (source error status, timeout, oversized or non-public answer), `scale` (unusable value) |
| `TRUTH_SOURCE_ALLOW_PRIVATE="…" is a development switch and must be unset on mainnet` at startup | The local-testing switch is set on a mainnet node | Unset it |
