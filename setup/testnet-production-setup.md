---
description: >-
  Set up a Telegraph validator node for testnet or production: config, script
  run, and verification.
---

# Testnet & Production Setup

This guide covers running a **Telegraph validator node** on testnet or production. You'll use config files from the Telegraph team (or your own deployment), run the main setup script, fund your wallet, and verify that the node is registered and listening.

---

## Overview

In short:

1. **Get config** — `networks.config.json` (chains and Diamond addresses) and `subnets.yaml` (subnet API config). Place them in the repo root. The team can provide these, or you generate them by deploying (e.g. testnet).
2. **Deploy contracts (testnet only)** — If you're not using a pre-filled config, run `./deploy-testnet.sh` to deploy Diamonds to testnets and update `networks.config.json`.
3. **Run the setup script** — `./telegraph.sh` installs dependencies, sets up Cassandra, loads networks from config, configures Clef and Telegraph, and asks for your **node IP** and **Genesis node IP** (the latter is usually provided by Telegraph).
4. **Fund the validator** — Send native gas tokens to the Clef wallet on each chain. The script can optionally do this with a deployer key.
5. **Verify** — Use the check-registration, bridge, and subnet-inference test scripts (choose Testnet and the right networks).

**Important:** `telegraph.sh` does **not** deploy contracts. For testnets, run `deploy-testnet.sh` first, or get a ready-made `networks.config.json` and `subnets.yaml` from the team.

---

## Prerequisites

* **Linux/Unix** (e.g. Ubuntu/Debian).
* **Go 1.19+**, **Java 11+**, **Cassandra** — the script can install these if missing.
* **Sudo** for systemd.
* **networks.config.json** and **subnets.yaml** in the repo root (from the team or from your deploy).
* **Genesis node URL** — provided by Telegraph for your environment.

---

## 1. Network config (networks.config.json)

Place `networks.config.json` in the **project root**. It lists every chain and its Telegraph Diamond (Port) address. The script and test scripts read it and sync it into the database.

Example shape:

```json
{
  "testnet": [
    {
      "chainId": 11155111,
      "name": "Sepolia-ETH",
      "type": "EVM",
      "rpcHttp": "https://ethereum-sepolia-rpc.publicnode.com",
      "rpcWs": "wss://ethereum-sepolia-rpc.publicnode.com",
      "diamondAddress": "0x..."
    },
    {
      "chainId": 43113,
      "name": "Avalanche-Fuji",
      "type": "EVM",
      "rpcHttp": "https://avalanche-fuji-c-chain-rpc.publicnode.com",
      "rpcWs": "wss://avalanche-fuji-c-chain-rpc.publicnode.com",
      "diamondAddress": "0x..."
    }
  ],
  "mainnet": [
    { "chainId": 1, "name": "Ethereum", "type": "EVM", "rpcHttp": "...", "rpcWs": "...", "diamondAddress": "0x..." }
  ]
}
```

* **name** — Must match what Telegraph uses (e.g. `"Sepolia-ETH"`, `"Avalanche-Fuji"`). Used for routing.
* **diamondAddress** — Required. The script only loads entries that have a non-empty Diamond address.

If you deploy yourself, `./deploy-testnet.sh` fills the testnet section with deployed addresses.

---

## 2. Subnet config (subnets.yaml)

Place `subnets.yaml` in the **project root**. It defines subnet API endpoints, auth, and timeouts. The script sets `SUBNET_DISPATCHER_CONFIG` in `~/.env` to this file.

Add any API keys in the script or in `~/.env` (e.g. `SUBNET_34_API_KEY`) as required by the auth section in `subnets.yaml`. Don’t remove or rename subnets the network depends on.

---

## 3. Deploying contracts (testnet)

If you’re not using a config from the team, deploy Diamonds to testnets and update the config:

```bash
chmod +x deploy-testnet.sh
./deploy-testnet.sh
```

You’ll be asked for a deployer private key and which networks to deploy to (defaults often include Sepolia and Fuji). The script updates the **testnet** section of `networks.config.json` with the new Diamond addresses. Then run `telegraph.sh` so the DB and node use the updated config.

---

## 4. Running telegraph.sh

From the project root:

```bash
chmod +x telegraph.sh
./telegraph.sh
```

The script will:

1. Install dependencies (Go, Java, Cassandra, jq, expect) if needed.
2. Read `networks.config.json` and load only entries with a valid `diamondAddress`; exit if none.
3. Apply Cassandra schema and migrations, truncate `telegraph.network`, and insert the loaded networks.
4. Insert default subnet config if missing.
5. Set up Clef (download, systemd, wallet creation).
6. **Prompt for:**
   * **This node’s IP/hostname and port** (default 127.0.0.1:7044). Use the address other nodes and Genesis will use to reach you.
   * **Genesis node IP** (and port). Usually provided by Telegraph (e.g. `http://genesis.example.com:7044`). For a single-node test you can use this node’s own URL.
   * **Moniker** (node name), e.g. `TestnetNode`.
7. Create or update the validator entry in the DB (Clef address, moniker, domain).
8. Optionally fund the Clef wallet on each chain with a deployer key; you can skip and fund manually.
9. Build Telegraph, write `~/.env` (CHAIN_ID, CONTRACT_ADDRESS, IP, GENESIS_IP, MONIKER, EXTERNAL_SIGNER_URL, SUBNET_DISPATCHER_CONFIG, AUTO_REGISTER_ALL_NETWORKS, subnet API keys).
10. Create and start `telegraph.service`.

After that, the node loads all networks from the DB and, with `AUTO_REGISTER_ALL_NETWORKS=true`, registers and listens on every Diamond automatically.

---

## 5. Funding the validator wallet

The node needs gas on **every** chain it registers on. Either use the script’s optional funding step or fund manually.

**Get the wallet address** from Clef logs, then send native gas (e.g. ETH on Sepolia, AVAX on Fuji) to that address on each chain in your config.

**Rough minimums:**

* Testnets: about 0.1 ETH equivalent per chain.
* Mainnets: more (e.g. 0.5 ETH equivalent per chain), depending on gas prices.

---

## 6. Verification

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

You should see all testnet/mainnet chains and their Diamond addresses.

**Registration**

In the logs, look for:

```
Successfully registered as signer on Sepolia-ETH (ChainID: 11155111)
Successfully registered as signer on Avalanche-Fuji (ChainID: 43113)
...
```

**Test scripts** (from project root, choose **Testnet** and the right networks):

* `./tests/check-registration.sh` — Node status, Clef, balances, validator DB.
* `./tests/bridge-test.sh` — Cross-chain message (e.g. Sepolia → Fuji).
* `./tests/subnet-inference-test.sh` — Subnet request and callback on one chain.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| Config not parsed | Install `jq`, validate JSON: `cat networks.config.json \| jq .`. Ensure every network has a non-empty `diamondAddress`. |
| Networks skipped | All entries need a valid `diamondAddress`. Deploy or get an updated config. |
| Cassandra | Ensure Cassandra is running; wait 60+ seconds after start; check port 9042 and logs. |
| Clef won’t start | Check `journalctl -u clef.service`, Clef binary path, and password in script. |
| Node doesn’t register | Confirm `AUTO_REGISTER_ALL_NETWORKS=true` and `EXTERNAL_SIGNER_URL` in `~/.env`. Ensure the wallet has gas on all chains; check RPC URLs. |
| Registration tx fails on one chain | Check balance and RPC for that chain; verify Diamond address and gas prices. |
| Migrations fail | Ensure `migrations/*.cql` exist and Cassandra is reachable; try `make db-migrate` if available. |

---

## Security and maintenance

* **Firewall** — Expose port 7044 for the Telegraph API; keep Cassandra (9042) and Clef IPC local or on a secure network.
* **Clef password** — Use a strong password (e.g. 20+ characters); store it securely.
* **Keystore** — Back up the Clef keystore right after creation; keep backups encrypted and offline.
* **Config updates** — When Diamond addresses or RPCs change, update `networks.config.json` (or get a new one from the team), then re-run `./telegraph.sh` and restart the service if needed.

---

## Next steps

* Run the test scripts regularly to confirm bridge and subnet flows.
* See **Local Setup** for a fully local development environment.
* See **Dapp Examples** for integrating your dApps and contracts with the Diamond (Port) for cross-chain messaging and subnet inference.
