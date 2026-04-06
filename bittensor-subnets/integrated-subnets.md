---
description: >-
  Quick overview: use Bittensor subnets from your dApp via HTTP or smart
  contracts, with request/response summaries.
---

# Integrated Subnets (Overview)

Telegraph integrates **Bittensor subnets** so you can call AI and inference APIs (chat, image/video detection, weather, search, and more) from your dApps. You can use subnets in two ways: **over HTTP** via the Subnet-Dispatcher, or **from smart contracts** via the Diamond (Port). This page is a **quick overview**; for detailed OnChainData encoding, per-endpoint index specs, and implementation details, see [Subnet Integration for Developers](subnet-integration-for-devs.md).

***

## Overview

### What are integrated subnets?

**Integrated subnets** are Bittensor subnet APIs (Zeus, BitMind, Chutes, DeSearch, etc.) exposed through Telegraph in a unified way:

* **Subnet-Dispatcher** — Central HTTP gateway with load balancing, rate limiting, circuit breaking, and logging. Use it from backends, scripts, or any HTTP client.
* **Diamond (Port) contract** — Same subnets are callable from smart contracts. Your contract calls `outboundSubnetMessage`; the node runs the subnet request off-chain and delivers the result to your callback via `subnetMessage`.

Both paths hit the same underlying subnet APIs; the difference is whether you call over HTTP or from chain.

### Architecture

```
┌─────────────────┐                    ┌─────────────────────────────────┐
│  Your dApp      │                    │   Subnet-Dispatcher              │
│  (Frontend /    │ ──── HTTP ────────▶│   Load balancing, rate limit,   │
│   Backend)      │                    │   circuit breaker, logging       │
└─────────────────┘                    └───────────────┬─────────────────┘
                                                       │
┌─────────────────┐                    ┌───────────────▼─────────────────┐
│  Your contract  │                    │  Subnet clients                │
│  (Diamond call  │ ──── Event ────────▶  Zeus, BitMind, Chutes,         │
│  + callback)    │                    │  DeSearch, Nineteen, etc.       │
└─────────────────┘                    └───────────────┬─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │  Subnet APIs    │
                                              │  (External)     │
                                              └─────────────────┘
```

***

## Two ways to use subnets

| Use case           | Method                                                                     | Best for                                                                          |
| ------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **HTTP**           | Subnet-Dispatcher `POST/GET` to `/subnet-dispatcher/v1/{subnet_id}/{path}` | Backends, scripts, non-blockchain clients, high throughput.                       |
| **Smart contract** | Diamond `outboundSubnetMessage` + callback `subnetMessage`                 | On-chain logic, user-paid gas, trustless execution, composability with DeFi/NFTs. |

***

## Building a dApp with subnet inference (contract flow)

To use subnets from a **smart contract**:

1. **Gas** — User must have gas balance on the Diamond on that chain (same chain as the request). Use `depositGas(amount)` with `msg.value == amount`. See [Dapp Integration](../setup/dapp-integration.md) and [Gas Deposit](../examples-and-tutorials/evm-chains/gas-deposit.md).
2. **Encode request** — Build parameters as `OnChainData` (see below). Endpoint and encoding depend on the subnet (see [Subnet inference API reference](integrated-subnets.md#subnet-inference-api-reference) below).
3.  **Send request** — Call on the Diamond:

    ```solidity
    uint256 id = IDiamond(diamond).outboundSubnetMessage(
        subnetId,
        endpoint,
        parameters,   // OnChainData
        callbackContract
    );
    ```

    Optional: send native token in the same tx to credit gas.
4.  **Receive response** — Your **callback contract** on the same chain must implement:

    ```solidity
    function subnetMessage(
        uint256 id,
        bool success,
        OnChainData calldata response,
        string calldata errorMessage
    ) external;
    ```

    Restrict so only the Diamond can call it (`msg.sender == diamond`). Decode the subnet result from `response` (see per-subnet response mapping below).

### OnChainData (payload shape)

All subnet request parameters and callback responses use this struct (each array max length **5**):

```solidity
struct OnChainData {
    address[] addresses;
    uint256[] integers;
    string[]  strings;
    bool[]    bools;
}
```

Encode the subnet’s input in these arrays; in `subnetMessage`, decode the subnet’s output from the same arrays. Exact mapping is per subnet (see API reference).

***

## Subnet inference API reference

Below is the **request/response specification** for each integrated subnet. Use it to:

* Call the **HTTP API** (Subnet-Dispatcher) with the correct method, path, and body/query.
* Build **OnChainData** for `outboundSubnetMessage` and decode **OnChainData** in `subnetMessage`.

**Base URL (HTTP):** `http://localhost:7044/subnet-dispatcher/v1` (port may vary; default 7044.)

**Contract endpoint string:** Use the path without the dispatcher prefix, e.g. `/v1/bitmind/detect-image`, `/v1/18/predict`, so the node can route correctly.

***

### Subnet 1 — Apex SN1 (Chat)

| Property      | Value            |
| ------------- | ---------------- |
| **Subnet ID** | 1                |
| **Name**      | Apex SN1         |
| **Purpose**   | Chat completions |

**HTTP**

| Item             | Spec                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| **Method**       | POST                                                                                               |
| **Path**         | `/1/chat`                                                                                          |
| **Request body** | `model` (string), `messages` (array of `{ role, content }`), optional: `temperature`, `max_tokens` |
| **Response**     | Chat completion (model, choices with `message.role`, `message.content`, `usage`)                   |

**Example request (HTTP):**

```json
{
  "model": "gpt-4",
  "messages": [{"role": "user", "content": "Hello!"}],
  "temperature": 0.7,
  "max_tokens": 100
}
```

**Contract:** Encode `model` and conversation in `strings`; decode assistant content and usage from `response.strings` / `response.integers` as defined by your app.

***

### Subnet 18 — Zeus (Weather / Forecast)

| Property      | Value               |
| ------------- | ------------------- |
| **Subnet ID** | 18                  |
| **Name**      | Zeus                |
| **Purpose**   | Weather predictions |

**HTTP**

| Item             | Spec                                                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Method**       | GET                                                                                                                                                                                 |
| **Path**         | `/18/predict`                                                                                                                                                                       |
| **Query params** | `lat` (required, -90–90), `lon` (required, -180–180), `start_timestamp` (required, Unix s), `end_timestamp` (optional) or `predict_hours` (1–168), `variable` (optional, see below) |
| **Response**     | `generation_time`, `grid`, `time` (ISO 8601), and a key for the variable (e.g. `2m_temperature`) with `data` and `unit`                                                             |

**Variables:** `2m_temperature`, `100m_u_component_of_wind`, `100m_v_component_of_wind`, `surface_pressure`, `total_precipitation`, `2m_dewpoint_temperature`.

**Time window:** Start must be between 5 days in the past and 7 days in the future.

**Example (HTTP):**

```
GET /subnet-dispatcher/v1/18/predict?lat=40.76&lon=-73.86&start_timestamp=<unix>&predict_hours=3&variable=2m_temperature
```

**Contract (OnChainData):** Use **5 strings** in order: `lat`, `lon`, `variable`, `start_datetime` (e.g. ISO), `end_datetime`. Example: `["40.76", "-73.86", "2m_temperature", "2026-03-04T09:57:04", "2026-03-04T12:57:04"]`. Decode forecast from `response.strings` (e.g. variable data/unit) or from the node’s mapping of Zeus JSON into OnChainData.

***

### Subnet 20 — Bounty (Task automation)

| Property      | Value           |
| ------------- | --------------- |
| **Subnet ID** | 20              |
| **Name**      | Bounty          |
| **Purpose**   | Task automation |

**HTTP**

| Item             | Spec                                            |
| ---------------- | ----------------------------------------------- |
| **Method**       | POST                                            |
| **Path**         | `/20/chat`                                      |
| **Request body** | `messages` (array), optional `tools` (array)    |
| **Response**     | Task/chat result (structure as per Bounty API). |

**Contract:** Encode messages and tools in `strings`; decode result from `response.strings`.

***

### Subnet 22 — DeSearch (Search)

| Property      | Value                  |
| ------------- | ---------------------- |
| **Subnet ID** | 22                     |
| **Name**      | DeSearch               |
| **Purpose**   | Search and web queries |

**HTTP**

| Item             | Spec                                                                            |
| ---------------- | ------------------------------------------------------------------------------- |
| **Method**       | POST                                                                            |
| **Path**         | `/22/search` or `/22/web`                                                       |
| **Request body** | `prompt`, `model`, optional `tools` (e.g. `["web_search"]`), `streaming` (bool) |
| **Response**     | Search/completion result.                                                       |

**Example (HTTP):**

```json
{
  "prompt": "What is the weather today?",
  "model": "gpt-4",
  "tools": ["web_search"],
  "streaming": false
}
```

**Contract:** Encode prompt, model, tools in `strings`; decode search result from `response.strings`.

***

### Subnet 32 — ItsAI (Text detection)

| Property      | Value                       |
| ------------- | --------------------------- |
| **Subnet ID** | 32                          |
| **Name**      | ItsAI                       |
| **Purpose**   | AI-generated text detection |

**HTTP**

| Item             | Spec                                     |
| ---------------- | ---------------------------------------- |
| **Method**       | POST                                     |
| **Path**         | `/32/detect-text`                        |
| **Request body** | `text` (string)                          |
| **Response**     | `isAI` (bool), `confidence` (number 0–1) |

**Example request (HTTP):**

```json
{
  "text": "Sample text to analyze for AI detection"
}
```

**Example response:**

```json
{
  "isAI": false,
  "confidence": 0.85
}
```

**Contract:** Request: put the text in `strings[0]`. Callback: e.g. `response.bools[0]` = `isAI`, `response.strings[0]` or `response.integers[0]` for confidence (depending on node mapping).

***

### Subnet 34 — BitMind (Image / Video detection)

| Property      | Value                               |
| ------------- | ----------------------------------- |
| **Subnet ID** | 34                                  |
| **Name**      | BitMind                             |
| **Purpose**   | Image and video AI-origin detection |

#### Detect Image

| Item             | Spec                                 |
| ---------------- | ------------------------------------ |
| **Method**       | POST                                 |
| **Path**         | `/34/detect-image`                   |
| **Request body** | `image` (string: base64 or URL)      |
| **Response**     | `isAI` (bool), `confidence` (number) |

**Example response:**

```json
{
  "isAI": false,
  "confidence": 0.95
}
```

**Contract:** Request: `strings[0]` = image URL or base64. Callback: e.g. `response.bools[0]` = `isAI`, `response.strings[0]` = confidence string or use an integer slot if the node maps it.

#### Detect Video

| Item             | Spec                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Method**       | POST                                                                                                              |
| **Path**         | `/34/detect-video`                                                                                                |
| **Request body** | `video` (URL or base64), optional: `startTime`, `endTime`, `fps`, `rich` (bool)                                   |
| **Response**     | `isAI`, `confidence`, optional `absurdity` (summary, verdict, score), `browserCompatibleUrl`, `processedVideoUrl` |

**Example request (HTTP):**

```json
{
  "video": "https://example.com/video.mp4",
  "startTime": 0,
  "endTime": 10,
  "fps": 1,
  "rich": true
}
```

**Contract:** Encode `video` (and optionally times/fps/rich) in `strings`/`integers`/`bools`; decode `isAI`, `confidence`, and optional fields from `response`.

#### Get video upload URL

| Item             | Spec                       |
| ---------------- | -------------------------- |
| **Method**       | POST                       |
| **Path**         | `/34/get-video-upload-url` |
| **Request body** | `filename` (string)        |
| **Response**     | `videoUrl`, `fileKey`      |

**Contract:** Request: `strings[0]` = filename. Callback: `response.strings[0]` = videoUrl, `response.strings[1]` = fileKey (or as your node maps).

***

### Subnet 64 — Chutes (LLM completions)

| Property      | Value                                     |
| ------------- | ----------------------------------------- |
| **Subnet ID** | 64                                        |
| **Name**      | Chutes                                    |
| **Purpose**   | High-performance LLM chat and completions |

**HTTP**

| Item           | Spec                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Chat**       | POST `/64/chat/completions` — body: `model`, `messages` (array of `{ role, content }`), optional `temperature`, `max_tokens`              |
| **Completion** | POST `/64/completions` — body: `model`, `prompt`, optional `temperature`, `max_tokens`                                                    |
| **Response**   | Standard OpenAI-like: `model`, `choices` (e.g. `choices[0].message.content`), `usage` (prompt\_tokens, completion\_tokens, total\_tokens) |

**Example request (HTTP) — chat:**

```json
{
  "model": "deepseek-chat",
  "messages": [{"role": "user", "content": "Hello!"}],
  "temperature": 0.7,
  "max_tokens": 100
}
```

**Example response:**

```json
{
  "model": "deepseek-chat",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you?"
    }
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 12,
    "total_tokens": 22
  }
}
```

**Contract:** Encode model, messages or prompt, and options in `strings`/`integers`; decode assistant content from `response.strings[0]` and usage from `response.integers` if the node maps them.

***

## Quick reference table

| Subnet ID | Name     | Purpose               | Main endpoint(s)                                                   | HTTP method |
| --------- | -------- | --------------------- | ------------------------------------------------------------------ | ----------- |
| 1         | Apex SN1 | Chat                  | `/1/chat`                                                          | POST        |
| 18        | Zeus     | Weather               | `/18/predict`                                                      | GET         |
| 19        | Nineteen | Completions, image    | `/19/chat/completions`, `/19/text-to-image`                        | POST        |
| 20        | Bounty   | Task automation       | `/20/chat`                                                         | POST        |
| 22        | DeSearch | Search                | `/22/search`, `/22/web`                                            | POST        |
| 32        | ItsAI    | Text detection        | `/32/detect-text`                                                  | POST        |
| 34        | BitMind  | Image/video detection | `/34/detect-image`, `/34/detect-video`, `/34/get-video-upload-url` | POST        |
| 64        | Chutes   | LLM chat/completions  | `/64/chat/completions`, `/64/completions`                          | POST        |

***

## HTTP status and errors

| Code | Meaning                                               |
| ---- | ----------------------------------------------------- |
| 200  | Success                                               |
| 400  | Bad request (validation failed)                       |
| 404  | Subnet not found                                      |
| 502  | Subnet API error                                      |
| 503  | Circuit breaker open (subnet temporarily unavailable) |

Error body shape:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common errors: `"subnet not found"`, `"request validation failed"`, `"circuit breaker open"`, `"rate limit exceeded"`.

***

## Health check (HTTP)

```bash
curl http://localhost:7044/subnet-dispatcher/healthz
```

Expected: `{"status":"ok"}`.

***

## Related docs

* [Subnet Integration for Developers](subnet-integration-for-devs.md) — Technical guide: OnChainData encoding, endpoint indices, request/response mapping.
* [Dapp Integration](../setup/dapp-integration.md) — Gas, cross-chain, and subnet flows.
* [Subnet Inference Example](../examples-and-tutorials/evm-chains/subnet-inference-example.md) — Minimal contract example.
* [Subnet Inference Test – Quick Guide](../dapp-examples/subnet-inference-test-quick-guide.md) — BitMind and Zeus on Fuji.
* [Dapp Examples — Interface & Implementation Guide](../dapp-examples/) — Diamond interfaces and flows.
* [Port Contract](../contract-documentation/port-contract.md) — Diamond facets and events.
