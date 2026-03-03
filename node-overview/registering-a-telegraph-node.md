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
* **RPC Provider Account** (**CRITICAL**): The public RPC are unreliable. You must sign up for a free or paid account with an RPC provider and use it to configure the script.
* Funds (On Standby): You will need native gas tokens (ETH, MATIC, AVAX, etc.) ready to send _after_ the script creates your node's new wallet. You don't need to create the wallet, the script will automatically create the wallet for your node and node will wait for you to send funds to it. This  &#x20;

**Note:**\
You should update the default configurations for Clef and your Bridge to make things more secure, as these are placeholder paths and public and prone to attacks. **You are responsible for keeping your node safe.**

### Operational Costs

* Gas Fees: For the current setup, you (the node operator) must pay for the gas for the transactions. The roadmap includes a mechanism to pass future transaction fees to the end-users.
* Subnet API Keys: The node's purpose is to query subnets. For now, you can run the node without these keys. In the future, it is expected that node operators will _not_ have to pay for these API keys, as the fees will be passed to the user.

### Step 1: Prepare Environment Variables

### Part 1: Configure the Installation Script

Do not run the script yet. You must edit it first.

1. If this is a fresh server, you should run\
   `sudo apt update && sudo apt upgrade -y`\
   `sudo apt install -y build-essential linux-headers-$(uname -r)`
2. Download the `telegraph.sh` script to your server.
3. Open the script in a text editor (e.g., `vim telegraph-setup.sh`).
4. Find and edit the following variables inside the script file:
   * `SERVICE_USER`: Change  `"root"` to match your server's username (e.g., `export SERVICE_USER="root"`), preferably keep `"root"` to avoid permission errors.
   * `BRIDGE_DIR`: Ensure this path is correct for your user (e.g., `export BRIDGE_DIR="/root/bridge"`).
   * `CLEF_PASSWORD`: Change the default password to a secure password of 10 characters or more.
   * `MONIKER`: Set your node's public display name (in the `.env` section near the end).
   * `IP`: Set your node's public-facing IP address (e.g., `IP='http://24.156.99.202:7044'`) or domain name (e.g., `IP='https://node.telegraph.com'`). You can use your servers .
   * `GENESIS_IP`: Set your node's GENESIS\_IP address (e.g., `GENESIS_IP='http://24.156.99.202:7044'`) or domain name (e.g., `GENESIS_IP='https://node.telegraph.com'`). It should be the **same as `IP`: address**
5. Configure RPC Endpoints (CRITICAL):
   * Find the section defining the RPC URLs (e.g., `AMOY_HTTP_URL=...`).
   * Replace the default `SEPOLIA_HTTP_URL, SEPOLIA_WSS_URL, BSC_HTTP_URL` etc, with your  provider URL that includes your API key.
   * Example:
     * Default (might fail): `AMOY_HTTP_URL=https://rpc.ankr.com/polygon_amoy`
     * Correct (with key): `AMOY_HTTP_URL=https://rpc.ankr.com/polygon_amoy/YOUR_UNIQUE_API_KEY_HERE`
6. Subnet API Keys (**leave for now**):
   * You can leave these blank for now. They are not required to get the node running.

Before running anything, ensure you have set all required environment variables. These include:

* **MONIKER**: Your node's display name.
* **GENESIS\_IP**: The Genesis IP address, **same as IP address**.
* **IP**: Your node's public IP address.\
  &#xNAN;_&#x54;ip: For better security, use a domain name and implement best practices such as a reverse proxy, firewall rules, and other security measures to protect your node._
* No API keys for subnets are need for now.

### Step 2: Run the Telegraph Installation Script

You will receive or download a **setup script** (example below). This script will automate the installation and setup process for:

* Dependencies (Go, GCC, Cassandra, Java, Curl, etc.)
* Cassandra database schema
* Clef signing service
* Downloading and configuring the `telegraph` binary
* Setting up systemd services for Clef and Telegraph

**Do not edit the script unless you know what you are doing!**

#### ⚠️ Script Warnings

* **Configure all required environment variables** in the script before proceeding.
* **Configure custom RPCs** for all networks.
* **Back up your wallet keystore file after it has been created by the script.**
* **Send enough funds to your Bridge Wallet, created by script, on all supported networks, the minimum amount should be**[ _**0.01**_](#user-content-fn-1)[^1] **ETH in native currency.**

**Example: How to run**

```sh
chmod +x telegraph-setup.sh
./telegraph-setup.sh
```

### Step 3: Fund the Bridge Wallet

After running the script, it will output your **Bridge Wallet address** (look for `"Available accounts"` in the logs).

* **Send enough native gas tokens** (e.g., ETH, BNB, MATIC, AVAX) to this wallet on **all supported networks**. **The minimum amount should be**[ _**0.01**_](#user-content-fn-1)[^1] **ETH in native currency.**
* The node will not register unless it holds enough funds.

> **Tip:** Back up your keystore file (`$HOME/bridge/clef/keystore`) to a safe location, depending upon your path.

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

> Not at this time. The script is designed to create a new wallet managed by Clef. You can work with Clef to manage or add your own wallet, but do so before moving forward with the registration and adding fund. Telegraph always uses the 1st wallet, so you make sure that your wallet is first.

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
