---
description: >-
  This page guides you through setting up and registering a new Telegraph Node.
  Please follow these instructions exactly to avoid common error so your node is
  registered and operational.
---

# Registering a Telegraph Node

### Prerequisites

Before you begin, make sure you have:

* **FAQs:** At the end of this page, you will find FAQs, make sure to give it a read for more context.
* **Server**: A server running Ubuntu 22.04.1 LTS. Other versions may fail.
* **Hardware**: A minimum of 8 GB RAM and 16 GB Disk.
* **RPC Provider Account** (**CRITICAL**): Public RPCs are unreliable. Sign up for a free or paid RPC provider and use your URLs (with API key) when the setup script prompts for RPCs, or when editing a script that requires pre-configured RPCs. The standalone script can use built-in default testnet RPCs if you accept defaults.
* Funds (On Standby): You will need native gas tokens (ETH, MATIC, AVAX, etc.) ready to send _after_ the script creates your node's new wallet. You don't need to create the wallet, the script will automatically create the wallet for your node and node will wait for you to send funds to it. This  &#x20;

**Note:**\
You should update the default configurations for Clef and your Bridge to make things more secure, as these are placeholder paths and public and prone to attacks. **You are responsible for keeping your node safe.** For full details on the standalone setup script (interactive prompts, paths, Clef options), see [Testnet & Production Setup](../setup/testnet-production-setup.md).

### Operational Costs

* Gas Fees: For the current setup, you (the node operator) must pay for the gas for the transactions. The roadmap includes a mechanism to pass future transaction fees to the end-users.
* Subnet API Keys: The node's purpose is to query subnets. For now, you can run the node without these keys. In the future, it is expected that node operators will _not_ have to pay for these API keys, as the fees will be passed to the user.

### Step 1: Prepare for Setup

What you need before running the setup script:

1. **Server prep** (if fresh): Run `sudo apt update && sudo apt upgrade -y` and `sudo apt install -y build-essential linux-headers-$(uname -r)` if needed.
2. **Have ready:**
   * **MONIKER**: Your node's public display name.
   * **IP**: Your node's public-facing IP or domain (e.g. `http://YOUR_IP:7044`). For security, prefer a domain with a reverse proxy and firewall.
   * **GENESIS_IP**: If **you are the Genesis node**, this is the same as your node's URL. If **not**, get the Genesis URL from Telegraph Devs. The setup script will prompt for this.
   * **RPC endpoints**: Public RPCs are unreliable. With the **standalone setup script** you can accept the default testnet (Sepolia + Fuji with built-in RPCs) or, when prompted, supply your own RPC URLs (with your provider API key). With other scripts, configure RPCs in the script or config as required.
   * **Subnet API keys**: Not required to get the node running; you can leave them blank.
3. **Clef password**: Use a secure password (10+ characters). The standalone script prompts for it; other scripts may require you to set it in the script before running.

**If you use the standalone script** (`telegraph.sh`): you do **not** edit the script first—it asks for these values interactively. **If you use a different setup script** that requires editing (e.g. `SERVICE_USER`, `BRIDGE_DIR`, `CLEF_PASSWORD`, `MONIKER`, `IP`, `GENESIS_IP`, RPC URLs), edit those in the script before running as that script's documentation instructs.

### Step 2: Run the Telegraph Installation Script

You will receive or download a **setup script**. It automates:

* Dependencies (e.g. Cassandra, Java, Curl, expect)
* Cassandra database schema
* Clef signing service (new wallet or existing)
* Downloading and configuring the `telegraph` binary
* Systemd services for Clef and Telegraph

**If you use the standalone script** (`telegraph.sh`): run it without editing; it prompts for all config. **If you use a script that requires pre-configured variables**, edit those before running as instructed in Step 1.

#### ⚠️ Before and after running

* **Back up your wallet keystore** after the script creates it (path is shown at the end of setup; e.g. `/root/telegraph/clef/keystore` for the standalone script, or `$BRIDGE_DIR/clef/keystore`).
* **Send enough funds** to your Bridge Wallet on **all supported networks**—minimum **[0.01](#user-content-fn-1)[^1] ETH** in native currency per network. Registration will not proceed without sufficient gas.

**Example: standalone script**

```sh
curl -sO <url-to-telegraph.sh>
chmod +x telegraph.sh
./telegraph.sh
```

For other scripts, run as provided (e.g. `chmod +x telegraph-setup.sh && ./telegraph-setup.sh`).

### Step 3: Fund the Bridge Wallet

After running the script, it will output your **Bridge Wallet address** (look for `"Available accounts"` in the logs).

* **Send enough native gas tokens** (e.g., ETH, BNB, MATIC, AVAX) to this wallet on **all supported networks**. **The minimum amount should be**[ _**0.01**_](#user-content-fn-1)[^1] **ETH in native currency.**
* The node will not register unless it holds enough funds.

> **Tip:** Back up your keystore to a safe location. The path depends on your setup (e.g. `$BRIDGE_DIR/clef/keystore`; for the standalone script, often `/root/telegraph/clef/keystore`).

* **Check Balances**:
  * The script checks if your wallet has enough native gas tokens (for transaction fees) on **all supported networks**.
  * If any network has insufficient gas, registration will not proceed.
* **Registration Transaction**:
  * The script creates a transaction that calls the smart contract's `addSigner` function, registering your node.
  * The transaction will **fail** if:
    * You have not funded your wallet adequately (gas fees).
  * The process **waits** and checks every 10 seconds until all funds are confirmed. The minimum required amount is 0.01 ETH on all the supported networks

### Step 4: Success Verification

* Once the smart contract transaction is mined and confirmed, your node is registered.
* The script and systemd service will keep your node online.
* You can verify your node's status by checking logs or querying the smart contract for your wallet's registration.

### Registration Logic Summary

The registration is handled programmatically (see below for simplified explanation):

* The script checks your wallet balance for gas on all required networks.
* If balances are sufficient, the script:
  * Calls the `addSigner` function on the core contract with your node details.
  * Waits for the transaction to be mined.
  * Confirms registration.

If you encounter any errors, check:

* Wallet approval status for the contract
* Correct environment variable values
* Check log via `journalctl -u telegraph.service -f` or `journalctl -u clef.service -f`.

### Example: Script Output

```
Wallet 0 is Telegraph Bridge Wallet, Fund it on all Networks:
Available accounts:
0xABCDEF1234567890...
...
✓ Subnet configurations verified successfully
Sufficient balance available on all networks
Add signer transaction sent: 0x...
Registration successful!
```

### Updating Your Node

When a new version of the `telegraph` binary is released, follow these steps to update:

```
sudo systemctl stop telegraph.service
sudo rm -rf /usr/local/bin/telegraph
sudo wget -O /usr/local/bin/telegraph https://telegraph-binary.s3.eu-north-1.amazonaws.com/telegraph
sudo chmod +x /usr/local/bin/telegraph
sudo systemctl daemon-reload
sudo systemctl restart clef.service 
sudo systemctl restart telegraph.service
sudo journalctl -u telegraph.service -f
```

### FAQ

#### What is the Bridge Wallet?

> It's the Ethereum wallet generated and managed by Clef, used for all node transactions and registration.

#### Can I use my own existing wallet or hardware wallet?

> **With the standalone setup script:** Yes. When prompted, choose to use an existing Clef wallet and provide the path to the directory that contains the `keystore` (with `UTC--*` key files). You can optionally specify a single address to use. Use the same password as when that wallet was created. Telegraph uses the first available wallet in the keystore unless you specified one address.  
> **With other scripts:** They may only create a new wallet; check that script's documentation. If you add your own wallet via Clef, ensure it is the first (or only) wallet before registration and funding.

#### Do I need to manually approve the contract?

> No, the script handles contract approval automatically. Just ensure your wallet has enough gas.

#### How do I know if my node is registered?

> Check the node logs for "Add signer transaction sent" and "Sufficient balance available". You can also query the smart contract.

### Troubleshooting

* **Insufficient balance:** Fund your Bridge Wallet with native gas tokens.
* **Smart contract approval errors:** Ensure no other process is locking your wallet or Clef.
* **Service errors:** Use `sudo systemctl status telegraph.service` and `clef.service` for troubleshooting.



### Security Notes

* **Do not share** your keystore or private keys.
* Always **back up** your wallet before proceeding.
* Only run scripts from trusted sources.

### Next Steps

* Monitor your node and keep your software updated.
* Join the community for support and updates.

[^1]: 
