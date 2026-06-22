---
description: "One-page guide to run Bitmind and Zeus subnet tests using SubnetSender, SubnetCallback, and the Telegraph Diamond on Fuji."
---

# Subnet Inference Test – Quick Guide

One-page guide to run **Bitmind** and **Zeus** subnet tests using the deployed SubnetSender, SubnetCallback, and Telegraph Diamond on Fuji. **Note:** For current testing, use [Base Sepolia with ERC-8183 jobs](../../examples-and-tutorials/evm-chains/erc8183-job-example.md).

---

## Contract addresses (Fuji)

| Role | Address |
|------|---------|
| **Diamond (Port)** | `0xB966DC4C3f3Def1256fbaB76C132cab7723dfdC6` |
| **SubnetSender** | `0xEbAA0cBc332dd9025b885D9f319FFbef55b55fd4` |
| **SubnetCallback (Receiver)** | `0x5f08a33e0Fa7aa27673a8DbfEc0A89B11b59062e` |

All are on **Avalanche Fuji**. You need Fuji AVAX for gas and **value** (e.g. 0.01 ether) when sending requests so the node can be reimbursed.

---

## Flow

1. In **Remix**, compile **SubnetSender** and use "At Address" with the SubnetSender address above (Fuji).
2. Call **`send`** (Bitmind) or **`sendWithStrings`** (Zeus) with **value** = e.g. `10000000000000000` (0.01 ether).
3. Wait ~20–60 seconds for the node to process and submit the response on-chain.
4. On the **SubnetCallback** contract, read the result (see "Verify result" below).

---

## Example 1 – Bitmind (detect-image)

**Use:** `send` (single param string).

| Parameter | Value |
|-----------|--------|
| **diamond** | `0xB966DC4C3f3Def1256fbaB76C132cab7723dfdC6` |
| **subnetId** | `34` |
| **endpoint** | `/v1/bitmind/detect-image` |
| **paramString** | `https://images.pexels.com/photos/28957752/pexels-photo-28957752/free-photo-of-young-woman-enjoys-summer-with-fresh-oranges.jpeg?auto=compress&cs=tinysrgb&w=800&lazy=load` |
| **callbackContract** | `0x5f08a33e0Fa7aa27673a8DbfEc0A89B11b59062e` |
| **Value** | `10000000000000000` (0.01 ether) |

**Remix – Bitmind step-by-step:**

1. Compile **SubnetSender.sol** (contracts/remix/SubnetSender.sol).
2. Deploy tab → "At Address" → paste `0xEbAA0cBc332dd9025b885D9f319FFbef55b55fd4` → ensure "Environment" is **Injected Provider** and network is **Avalanche Fuji**.
3. In the deployed instance, open **send**.
4. Fill: diamond `0xB966DC4C3f3Def1256fbaB76C132cab7723dfdC6`, subnetId `34`, endpoint `/v1/bitmind/detect-image`, paramString (full image URL above), callbackContract `0x5f08a33e0Fa7aa27673a8DbfEc0A89B11b59062e`.
5. In the "Value" field enter `10000000000000000` (0.01 ether).
6. Transact and sign with a Fuji-funded wallet.

---

## Example 2 – Zeus (weather predict)

**Use:** `sendWithStrings` (five param strings). End chain name must be exact.

| Parameter | Value |
|-----------|--------|
| **diamond** | `0xB966DC4C3f3Def1256fbaB76C132cab7723dfdC6` |
| **subnetId** | `18` |
| **endpoint** | `/v1/18/predict` |
| **paramStrings** | 5 strings (see below) |
| **callbackContract** | `0x5f08a33e0Fa7aa27673a8DbfEc0A89B11b59062e` |
| **Value** | `10000000000000000` (0.01 ether) |

**paramStrings (5 elements in order):**

1. `40.76` (latitude)
2. `-73.86` (longitude)
3. `2m_temperature` (variable)
4. Start datetime (e.g. `2026-03-04T09:57:04`)
5. End datetime (e.g. `2026-03-04T12:57:04`)

Zeus expects **start** within the valid window (see API docs). Use **current time** and **current + 3 hours** for a valid window.

**Generate live paramStrings (Linux/WSL/Git Bash):**

```bash
echo "[\"40.76\",\"-73.86\",\"2m_temperature\",\"$(date -u +'%Y-%m-%dT%H:%M:%S')\",\"$(date -u -d '+3 hours' +'%Y-%m-%dT%H:%M:%S')\"]"
```

Copy the output. In Remix, for **paramStrings** do **not** paste that as one string; use **sendWithStrings** and enter **5 separate** array elements: `40.76`, `-73.86`, `2m_temperature`, then the 4th and 5th strings from the command output (start and end datetime).

**Remix – Zeus step-by-step:**

1. Same as Bitmind: compile **SubnetSender.sol**, "At Address" `0xEbAA0cBc332dd9025b885D9f319FFbef55b55fd4`, Fuji.
2. Run the bash command above to get the JSON array; copy the **4th and 5th** strings (start and end datetime) from the output.
3. Open **sendWithStrings** (not `send`).
4. Fill: diamond `0xB966DC4C3f3Def1256fbaB76C132cab7723dfdC6`, subnetId `18`, endpoint `/v1/18/predict`, callbackContract `0x5f08a33e0Fa7aa27673a8DbfEc0A89B11b59062e`.
5. For **paramStrings**: Remix shows an array. Add **5** elements:
   * `40.76`
   * `-73.86`
   * `2m_temperature`
   * (start datetime, e.g. `2026-03-04T09:57:04`)
   * (end datetime, e.g. `2026-03-04T12:57:04`)
   Do **not** paste the whole JSON array as one string; use five separate string inputs.
6. Value: `10000000000000000` (0.01 ether) → transact.

---

## Verify result (SubnetCallback)

**Contract:** `0x5f08a33e0Fa7aa27673a8DbfEc0A89B11b59062e` on Fuji.

**Explorer:** Open the contract on [Snowscan (Fuji)](https://testnet.snowscan.xyz) → Read contract.

**Common reads:**

| Function | Use case |
|----------|----------|
| **`callCount()`** | Number of callbacks received (≥ 1 = success). |
| **`getLastResponseSummary()`** | id, success, errorMessage, count, primaryResult, secondaryResult. |
| **Bitmind** | **`getBitmindConfidence()`**, **`getBitmindIsAI()`** |
| **Zeus** | **`getZeusVariableData()`**, **`getZeusVariableUnit()`**, **`getZeusTimeData()`** |

---

## Summary – functions

| Contract | Function | When |
|----------|----------|------|
| **SubnetSender** | `send(diamond, subnetId, endpoint, paramString, callbackContract)` | Bitmind: one param string (e.g. image URL). Send **value** (e.g. 0.01 ether). |
| **SubnetSender** | `sendWithStrings(diamond, subnetId, endpoint, paramStrings[], callbackContract)` | Zeus: five param strings (lat, lon, variable, start_datetime, end_datetime). Send **value**. |
| **SubnetCallback** | `getBitmindConfidence()`, `getBitmindIsAI()`, `getLastResponseSummary()`, `callCount()` | After request; read result on Fuji. |
| **SubnetCallback** | `getZeusVariableData()`, `getZeusVariableUnit()`, `getLastResponseSummary()`, `callCount()` | After request; read result on Fuji. |

**Endpoints:** Use **`/v1/bitmind/detect-image`** (Bitmind) and **`/v1/18/predict`** (Zeus) so the node strips the prefix and routes correctly.  
**Value:** Always send value (e.g. 0.01 ether) with `send` or `sendWithStrings` so the Diamond can reimburse the node.
