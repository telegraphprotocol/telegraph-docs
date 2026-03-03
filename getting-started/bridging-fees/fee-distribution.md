# Fee Distribution

| **Starting Chain** | **Ending Chain**   | **Gas Fee Responsibility** | **End Chain Node Reward (%)** | **End Chain Telegraph Corp Fee (%)** | **Fee Estimate Example**  |
| ------------------ | ------------------ | -------------------------- | ----------------------------- | ------------------------------------ | ------------------------- |
| EVM (Non Ethereum) | EVM Ethereum       | Sender pays 100% Gas Fee   | 50% wTAO based on TX          | 50%                                  | Total Gas + Fee Breakdown |
| EVM Ethereum       | EVM (Non Ethereum) | Sender pays 100% Gas Fee   | 50% wTAO based on TX          | 50                                   | Total Gas + Fee Breakdown |
| EVM (Testnets)     | EVM (Testnets)     | Sender pays 100% Gas Fee   | N/A                           | N/A                                  | Testnet Coin Fee          |
| EVM Ethereum       | EVM (Testnets)     | Sender pays 100% Gas Fee   | N/A                           | N/A                                  | Cannot interact           |
| EVM (Testnets)     | EVM Ethereum       | Sender pays 100% Gas Fee   | N/A                           | N/A                                  | Cannot interact           |
| EVM (Non Ethereum) | EVM (Testnets)     | Sender pays 100% Gas Fee   | N/A                           | N/A                                  | Cannot interact           |
| EVM (Testnets)     | EVM (Non Ethereum) | Sender pays 100% Gas Fee   | N/A                           | N/A                                  | Cannot interact           |
