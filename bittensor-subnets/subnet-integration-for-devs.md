---
description: "Technical implementation: OnChainData encoding, per-endpoint request/response indices, and subnet inference specs."
---

# Subnet Integration for Developers (Technical Guide)

This document is the **technical implementation guide** for subnet inference. It explains how **inference** works with Telegraph’s Diamond (Port) contracts: how data is passed as the **OnChainData** struct, how it is serialized and deserialized per subnet/endpoint, and how to build requests and read responses in your contracts. For a quick overview of integrated subnets (HTTP vs contract, high-level flow), see [Integrated Subnets (Overview)](integrated-subnets.md).

---

## 1. Overview

### 1.1 Why OnChainData?

Telegraph uses a single struct, **OnChainData**, for:

- **Cross-chain messages:** payload sent from one chain and delivered to a destination contract.
- **Subnet inference:** input sent to a subnet API and the response returned to your callback contract.

The struct is the same in both flows. It uses four typed arrays so that:

- The Diamond can validate and forward payloads without interpreting content.
- Each **subnet** and **endpoint** defines how those arrays map to API parameters and responses.
- Contracts use **array indices** to set inputs and read outputs in a predictable way.

### 1.2 Struct Definition (Solidity)

```solidity
struct OnChainData {
    address[] addresses;   // max length 5
    uint256[] integers;    // max length 5
    string[]  strings;     // max length 5
    bool[]    bools;       // max length 5
}
```

- **Array length:** The Diamond enforces `length <= 5` for each array **on outbound** (the `parameters` or `data` you send). **Inbound** response payloads (built by the node) are not length-checked by the contract, so some endpoints may return more than 5 elements in one array (e.g. Bitmind detect-video response has 9 integers).
- **Naming:** In Solidity the second field is `integers`; in Go/docs it may be referred to as `Numbers`. Same data.

### 1.3 Encoding Rules (What Goes Where)

These rules are implemented in the node’s mapping and response builders; follow them when building requests and reading responses.

| Data type | Store in | Notes |
|-----------|----------|--------|
| **Pure integers** (no decimal part) | `integers[]` | e.g. `fps`, `duration`, `width`, `height`, `frames`, `peak`, `startTime`, `endTime` (when whole seconds), `absurdity.score`, token counts |
| **Floats / decimals** | `strings[]` | Confidence, temperature, lat/lon with decimals, etc. Always as string (e.g. `"0.894501287500829"`, `"58.9"`) |
| **URLs, model names, summaries, verdicts, text** | `strings[]` | Any free-form or variable-length text |
| **Booleans** | `bools[]` | e.g. `isAI`, `rich`, `stream` |
| **Large or variable-length arrays** (e.g. forecast values, timestamps) | `strings[]` as **one** comma-separated string | No array type in OnChainData; concatenate and split in your contract if needed |
| **Addresses** | `addresses[]` | For subnet inference endpoints in this doc, **always empty** (length 0). Used only when an endpoint explicitly defines address slots. |

- **preprocess-video:** `endTime` can have decimals (e.g. 58.9) → stored as **string** in `strings[]`. In **detect-video** and **detect-image** request, `startTime`/`endTime` are whole seconds → `integers[]`.
- **Confidence** (and any decimal score) → always **string** in `strings[]`.
- Only user-relevant fields are mapped; internal/metadata fields (e.g. `generation_time`) are omitted.

---

## 2. Inference Flow (Subnet)

1. **Your contract** (or a script) calls the Diamond:
   - `outboundSubnetMessage(subnetId, endpoint, parameters, callbackContract)`
   - `parameters` is an **OnChainData** instance filled according to the **endpoint spec** (see below).
2. **Telegraph node** reads the event, maps `parameters` to the subnet API (using the endpoint’s mapping), calls the API.
3. **Node** maps the API response back into **OnChainData** and submits a transaction that calls:
   - `callbackContract.subnetMessage(id, success, response, errorMessage)`
   - `response` is **OnChainData** with layout defined by the same endpoint.
4. **Your callback** implements `ISubnetReceiverContract.subnetMessage(...)` and reads `response.addresses`, `response.integers`, `response.strings`, `response.bools` at the **indices** documented for that endpoint.

So: **input** = how you fill `parameters` (request); **output** = how you read `response` (callback). Both are OnChainData with endpoint-specific index semantics.

---

## 3. Understanding the Mapping (Source and Index)

Off-chain, each supported **endpoint** has a mapping that defines:

- **Source:** which array — `Addresses`, `Numbers` (integers), `Strings`, or `Bools`.
- **Index:** position in that array (0-based).
- **Semantic:** what that slot means (e.g. “model”, “prompt”, “confidence”).

As a developer you don’t need the internal mapping table; you need the **contract-facing** spec: which index of which array to use for each input and output. The sections below give that per subnet/endpoint.

---

## 4. Endpoint Format

The **endpoint** argument to `outboundSubnetMessage` must match what the node expects. The canonical form is:

```text
/subnet/<subnetId>/<path>
```

Examples:

- `/subnet/34/detect-image` (Bitmind image detection)
- `/subnet/18/predict` (Zeus weather)
- `/subnet/64/chat/completions` (Chutes chat)

Use the **exact** endpoint string for the capability you use; scripts and docs sometimes show alternate paths (e.g. `/v1/...`). If the node is configured with the canonical `/subnet/...` form, your contract must pass that same string.

---

## 5. Subnet-by-Subnet: Request (Input) and Response (Output)

Below, “request” = how to fill **OnChainData** for `outboundSubnetMessage(..., parameters, ...)`. “Response” = how to read **OnChainData** in `subnetMessage(..., response, ...)`.

### 5.1 Subnet 1 — Chat

| Endpoint            | Description        |
|--------------------|--------------------|
| `/subnet/1/chat`   | Chat completion    |

**Request**

| Array     | Index | Meaning        | Notes                          |
|----------|-------|----------------|---------------------------------|
| strings  | 0     | Model          | Model name                     |
| strings  | 1..N  | RoleContent    | Alternating role, content, …   |
| numbers  | 0     | Temperature    |                                |
| numbers  | 1     | MaxTokens      |                                |
| numbers  | 2     | TopP           |                                |
| bools    | 0     | Stream         |                                |
| bools    | 1     | Logprobs       |                                |

**Response**  
Defined by the node’s mapping for subnet 1 chat (e.g. assistant message in `strings`); check node/docs for the exact layout.

---

### 5.2 Subnet 18 — Zeus (Weather / Predict)

Zeus uses GET-style parameters. Single endpoint: `/subnet/18/predict` (external API may be `/v1/zeus/forecast`).

**Request**

| Array    | Index | Field           | Description / Example |
|----------|-------|-----------------|----------------------|
| strings  | 0     | latitude        | Latitude as string (can have decimals) — e.g. `"52.377956"` |
| strings  | 1     | longitude       | Longitude as string — e.g. `"4.897070"` |
| strings  | 2     | hourly          | Requested variable(s); comma-separated if multiple — e.g. `"total_precipitation"` or `"total_precipitation,relative_humidity_2m"` |
| strings  | 3     | start_datetime  | Start datetime (ISO 8601) — e.g. `"2025-11-12T08:00:00"` |
| strings  | 4     | end_datetime    | End datetime (ISO 8601) — e.g. `"2025-11-12T10:00:00"` |
| integers | —     | (empty)         | Not used; lat/long and datetimes are strings |
| bools    | —     | (empty)         | |
| addresses| —     | (empty)         | |

**Response**

All numeric/time series data is kept with full precision in strings (comma-separated where there are multiple values).

| Array    | Index | Field                     | Description / Example |
|----------|-------|---------------------------|------------------------|
| strings  | 0     | requested_variable.data   | All forecast values, comma-separated — e.g. `"280.7013854980469,280.853271484375,..."` |
| strings  | 1     | requested_variable.unit   | Unit of the variable — e.g. `"K"`, `"mm"`, `"%"` |
| strings  | 2     | time.data                 | All timestamps, comma-separated — e.g. `"2025-12-18 06:00:00+01:00,..."` |
| strings  | 3     | time.unit                 | Typically `"ISO 8601 (tz-aware)"` |
| strings  | 4     | grid.latitude             | Grid point latitude — e.g. `"52.37795639038086"` |
| strings  | 5     | grid.longitude            | Grid point longitude — e.g. `"4.897069931030273"` |
| integers | —     | (empty)                   | |
| bools    | —     | (empty)                   | |
| addresses| —     | (empty)                   | |

---

### 5.3 Subnet 19 — Chat, Completions, Image

| Endpoint                         | Description        |
|----------------------------------|--------------------|
| `/subnet/19/chat/completions`    | Chat completions   |
| `/subnet/19/completions`         | Text completion    |
| `/subnet/19/text-to-image`      | Text-to-image      |
| `/subnet/19/image-to-image`      | Image-to-image     |
| `/subnet/19/avatar`              | Avatar             |

**Request (chat/completions)**

| Array   | Index | Meaning     |
|---------|-------|-------------|
| strings | 0     | Messages (JSON-encoded chat messages) |
| strings | 1     | Model       |
| numbers | 0     | Temperature (often scaled, e.g. 70 = 0.7) |
| numbers | 1     | MaxTokens   |
| numbers | 2     | TopP        |
| bools   | 0     | Stream      |

**Request (completions)**

| Array   | Index | Meaning     |
|---------|-------|-------------|
| strings | 0     | Prompt      |
| strings | 1     | Model       |
| numbers | 0,1,2 | Temperature, MaxTokens, TopP |
| bools   | 0     | Stream      |

**Request (text-to-image)**

| Array   | Index | Meaning        |
|---------|-------|----------------|
| strings | 0     | Prompt         |
| strings | 1     | Model          |
| strings | 2     | NegativePrompt |
| numbers | 0,1,2,3 | Steps, Width, Height, CfgScale |

**Request (image-to-image)**

| Array   | Index | Meaning        |
|---------|-------|----------------|
| strings | 0     | InitImage      |
| strings | 1     | Prompt         |
| strings | 2     | Model          |
| strings | 3     | NegativePrompt |
| numbers | 0..4  | Steps, Width, Height, CfgScale, ImageStrength |

**Request (avatar)**  
Similar pattern: InitImage, Prompt, NegativePrompt, then numbers for Steps, Width, Height, CfgScale, IpadapterStrength, ControlStrength.

**Response**  
Subnet 19 responses are mapped back to OnChainData by the node (e.g. generated text or image URL in `strings`). Exact layout depends on endpoint; use the same indexing pattern as other subnets.

---

### 5.4 Subnet 32 — ItsAI (Detect Text)

| Endpoint                 | Description  |
|--------------------------|--------------|
| `/subnet/32/detect-text` | Text detection |

**Request**

| Array   | Index | Meaning  |
|---------|-------|----------|
| strings | 0     | Text     |
| bools   | 0     | DeepScan |

**Response**

| Array   | Index | Meaning  |
|---------|-------|---------|
| strings | 0     | Result  | Raw response (e.g. JSON string) |

---

### 5.5 Subnet 34 — Bitmind (Image/Video)

| Endpoint                          | Description          |
|-----------------------------------|----------------------|
| `/subnet/34/detect-image`         | Image AI detection   |
| `/subnet/34/detect-video`         | Video AI detection (with optional rich absurdity analysis) |
| `/subnet/34/preprocess-video`     | Video preprocessing  |
| `/subnet/34/get-video-upload-url` | Get upload URL       |

For all four Bitmind endpoints, **addresses** is always empty (length 0).

---

**1. detect-video**

*Request (input)*

| Array    | Index | Field      | Description / Example |
|----------|-------|------------|------------------------|
| bools    | 0     | rich       | Enable rich absurdity analysis — e.g. `true` |
| strings  | 0     | video      | Full URL of the video to analyze — e.g. `"http://.../BigBuckBunny.mp4"` |
| integers | 0     | startTime  | Start time in seconds (from original) — e.g. `0` |
| integers | 1     | endTime    | End time in seconds (from original) — e.g. `60` |
| integers | 2     | fps        | Sampling frames per second — e.g. `1` |
| addresses| —     | (empty)    | |

*Response (output)*

| Array    | Index | Field                        | Description / Example |
|----------|-------|------------------------------|------------------------|
| bools    | 0     | isAI                         | `true` if detected as AI-generated |
| strings  | 0     | confidence                   | Overall confidence — e.g. `"0.894501287500829"` |
| strings  | 1     | absurdity.summary            | Full text summary of unusual elements |
| strings  | 2     | absurdity.verdict            | Overall absurdity verdict text |
| strings  | 3     | browserCompatibleUrl         | Browser-playable processed video URL |
| strings  | 4     | processedVideoUrl            | Downloadable processed video URL (with marks) |
| integers | 0     | absurdity.score              | Absurdity score — e.g. `70` |
| integers | 1     | absurdity.metadata.frames    | Number of frames analyzed — e.g. `15` |
| integers | 2     | absurdity.metadata.peak      | Peak absurdity value — e.g. `85` |
| integers | 3     | videoMetadata.duration       | Processed duration (seconds) — e.g. `60` |
| integers | 4     | videoMetadata.width          | Video width (pixels) — e.g. `1280` |
| integers | 5     | videoMetadata.height         | Video height (pixels) — e.g. `720` |
| integers | 6     | videoMetadata.fps             | FPS used for processing — e.g. `1` |
| integers | 7     | videoMetadata.startTime      | Start time in original (sec) — e.g. `0` |
| integers | 8     | videoMetadata.endTime        | End time in original (sec) — e.g. `60` |

The node currently sends **9 integers** for detect-video response. The Diamond does not enforce the ≤5 limit on **inbound** response payloads, so this is valid.

---

**2. detect-image**

*Request (input)*

| Array    | Index | Field  | Description / Example |
|----------|-------|--------|------------------------|
| strings  | 0     | image  | Full URL of the image to analyze — e.g. `"https://images.pexels.com/..."` |
| bools    | —     | (empty)| |
| integers | —     | (empty)| |
| addresses| —     | (empty)| |

*Response (output)*

| Array    | Index | Field      | Description / Example |
|----------|-------|------------|------------------------|
| bools    | 0     | isAI       | `true` if detected as AI-generated |
| strings  | 0     | confidence | Overall confidence — e.g. `"0.9358000964014767"` (always string; decimals preserved) |
| integers | —     | (empty)    | |
| addresses| —     | (empty)    | |

---

**3. preprocess-video**

*Request (input)*  
`endTime` can have decimals (e.g. 58.9) → must be sent as **string** in `strings[1]`.

| Array    | Index | Field     | Description / Example |
|----------|-------|-----------|------------------------|
| strings  | 0     | video     | Full URL of the video to preprocess — e.g. `"https://www.w3schools.com/tags/mov_bbb.mp4"` |
| strings  | 1     | endTime   | End time in seconds, as string (decimals preserved) — e.g. `"58.9"` |
| integers | 0     | startTime | Start time in seconds (from original) — e.g. `0` |
| integers | 1     | fps       | Sampling frames per second — e.g. `1` |
| bools    | —     | (empty)   | |
| addresses| —     | (empty)   | |

*Response (output)*

| Array    | Index | Field                   | Description / Example |
|----------|-------|-------------------------|------------------------|
| strings  | 0     | browserCompatibleUrl   | Browser-playable clip URL |
| strings  | 1     | processedVideoUrl       | Downloadable processed clip URL |
| strings  | 2     | videoMetadata.endTime   | End time in seconds — e.g. `"58.9"` (string for decimals) |
| integers | 0     | videoMetadata.duration  | Processed duration (seconds) — e.g. `10` |
| integers | 1     | videoMetadata.width     | Width (pixels) — e.g. `320` |
| integers | 2     | videoMetadata.height    | Height (pixels) — e.g. `176` |
| integers | 3     | videoMetadata.fps       | FPS used — e.g. `1` |
| integers | 4     | videoMetadata.startTime | Start time (seconds) — e.g. `0` |
| bools    | —     | (empty)                 | |
| addresses| —     | (empty)                 | |

---

**4. get-video-upload-url**

*Request (input)*

| Array    | Index | Field    | Description / Example |
|----------|-------|----------|------------------------|
| strings  | 0     | filename | Original filename of the video being uploaded — e.g. `"mov_bbb.mp4"` |
| strings  | 1     | (optional) ContentType | If used by endpoint |
| bools    | —     | (empty)  | |
| integers | —     | (empty)  | |
| addresses| —     | (empty)  | |

*Response (output)*

| Array    | Index | Field    | Description / Example |
|----------|-------|----------|------------------------|
| strings  | 0     | videoUrl | Final public URL of the uploaded video (after successful upload) — e.g. `"https://applications-temp-videos-ap-southeast-1.s3...mov_bbb.mp4?..."` |
| strings  | 1     | fileKey  | Internal S3 object key (for tracking or reference) — e.g. `"upload/1766036440360-bc7793a9-...-mov_bbb.mp4"` |
| integers | —     | (empty)  | |
| bools    | —     | (empty)  | |
| addresses| —     | (empty)  | |

---

### 5.6 Subnet 64 — Chutes (LLM Inference: Chat & Completions)

| Endpoint                        | Description     |
|---------------------------------|-----------------|
| `/subnet/64/chat/completions`   | Chat (messages array) |
| `/subnet/64/completions`        | Simple prompt completion |

For Chutes endpoints, **addresses** is always empty (length 0). Temperature and other decimals go in **strings[]**; whole numbers (e.g. max_tokens, token counts) go in **integers[]**.

---

**1. chat/completions**

*Request (input)*  
Single message: `strings[0]=model`, `strings[1]=role`, `strings[2]=content`, `strings[3]=temperature` (as string). Multiple messages: repeat role/content pairs (e.g. `message_role_0`, `message_content_0`, then `message_role_1`, `message_content_1`, …); temperature (and optional stop) typically in the last string slot(s).

| Array    | Index | Field              | Description / Example |
|----------|-------|--------------------|------------------------|
| strings  | 0     | model              | Model name — e.g. `"chutesai/Mistral-Small-3.1-24B-Instruct-2503"` |
| strings  | 1     | message_role_0     | Role of first message — e.g. `"user"` |
| strings  | 2     | message_content_0  | Content of first message — e.g. `"Hello, how are you?"` |
| strings  | 3     | temperature        | Temperature as string (decimal) — e.g. `"0.7"` |
| integers | 0     | max_tokens         | Maximum tokens to generate — e.g. `100` |
| bools    | 0     | stream             | Optional; default false |
| bools    | 1     | logprobs           | Optional |
| addresses| —     | (empty)            | |

*Response (output)*

| Array    | Index | Field            | Description / Example |
|----------|-------|------------------|------------------------|
| strings  | 0     | generated_text   | Assistant reply — `choices[0].message.content` |
| strings  | 1     | model            | Model used (echoed back) |
| integers | 0     | completion_tokens| Tokens in generated response — e.g. `19` |
| integers | 1     | prompt_tokens    | Tokens in input prompt — e.g. `184` |
| integers | 2     | total_tokens     | Sum of prompt + completion — e.g. `203` |
| bools    | —     | (empty)          | |
| addresses| —     | (empty)          | |

---

**2. completions**

*Request (input)*

| Array    | Index | Field        | Description / Example |
|----------|-------|--------------|------------------------|
| strings  | 0     | model        | Model name — e.g. `"chutesai/Mistral-Small-3.1-24B-Instruct-2503"` |
| strings  | 1     | prompt       | Input prompt text — e.g. `"The capital of France is"` |
| strings  | 2     | temperature  | Temperature as string — e.g. `"0.7"` |
| integers | 0     | max_tokens   | Maximum tokens to generate — e.g. `50` |
| bools    | 0,1   | stream, logprobs | Optional |
| addresses| —     | (empty)      | |

*Response (output)*  
Same as chat/completions: primary field is `choices[0].text` (mapped to `strings[0]` as `generated_text`).

| Array    | Index | Field            | Description / Example |
|----------|-------|------------------|------------------------|
| strings  | 0     | generated_text   | Completion text |
| strings  | 1     | model            | Model used |
| integers | 0     | completion_tokens| Tokens generated |
| integers | 1     | prompt_tokens    | Tokens in prompt |
| integers | 2     | total_tokens     | Total tokens used |
| addresses| —     | (empty)          | |

---

**Summary: Chutes input mappings**

| Endpoint                | bools[]       | strings[]                                      | integers[]        |
|-------------------------|---------------|-------------------------------------------------|-------------------|
| chat/completions        | [0]: stream, [1]: logprobs (optional) | [0]: model, [1]: role_0, [2]: content_0, [3]: temperature | [0]: max_tokens |
| completions             | [0]: stream, [1]: logprobs (optional) | [0]: model, [1]: prompt, [2]: temperature | [0]: max_tokens |

Chutes also has **image management endpoints** (list images, create, get, logs, delete). Their request/response OnChainData layouts follow the same encoding rules (integers for counts/IDs where whole numbers, strings for URLs and text); for exact index specs for those endpoints, refer to the node implementation or subnet documentation.

---

## 6. Using Inference in Your Contracts

### 6.1 Sending a Request

1. **Choose subnet and endpoint** (e.g. Bitmind image: subnet `34`, endpoint `/subnet/34/detect-image`).
2. **Build OnChainData** using the request table for that endpoint:
   - Allocate `addresses`, `integers`, `strings`, `bools` (lengths ≤ 5).
   - Set each slot that the endpoint expects (e.g. for detect-image: `strings[0] = imageUrl`).
3. **Ensure gas:** User must have deposited gas on the Diamond for the node (e.g. `depositGas`) or send ETH in the same tx as `outboundSubnetMessage` (if the Diamond supports it).
4. Call:
   ```solidity
   uint256 id = port.outboundSubnetMessage(
       subnetId,
       endpoint,
       parameters,  // OnChainData
       callbackContract
   );
   ```
5. **Store or use `id`** if you need to correlate the callback with the request.

### 6.2 Receiving the Response

1. Implement **ISubnetReceiverContract**:
   ```solidity
   function subnetMessage(
       uint256 id,
       bool success,
       OnChainData calldata response,
       string calldata errorMessage
   ) external;
   ```
2. **Restrict caller** to the Diamond (e.g. `require(msg.sender == port)`).
3. If `!success`, use `errorMessage` and optionally `response` (may still contain partial data).
4. If `success`, read the **response** using the **response** table for the endpoint you called:
   - Example (Bitmind detect-image): `response.strings[0]` = confidence, `response.bools[0]` = isAI.
   - Example (Chutes): `response.strings[0]` = generated text, `response.integers[0..2]` = token counts.
5. Use lengths (`response.strings.length`, etc.) before indexing to avoid out-of-bounds.

### 6.3 Example: Bitmind detect-image in Solidity

**Request:**

```solidity
address[] memory addresses;
uint256[] memory integers;
string[] memory strings = new string[](1);
bool[] memory bools;

strings[0] = "https://example.com/image.jpg";

OnChainData memory parameters = OnChainData({
    addresses: addresses,
    integers: integers,
    strings: strings,
    bools: bools
});

uint256 id = port.outboundSubnetMessage(
    34,                          // subnetId
    "/subnet/34/detect-image",   // endpoint
    parameters,
    callbackContract
);
```

**Callback (reading response):**

```solidity
function subnetMessage(
    uint256 id,
    bool success,
    OnChainData calldata response,
    string calldata errorMessage
) external override {
    require(msg.sender == address(port), "Only Port");
    if (!success) {
        // handle errorMessage
        return;
    }
    if (response.strings.length > 0) {
        string memory confidence = response.strings[0];
        // use confidence (e.g. parse to uint256 or use as string)
    }
    if (response.bools.length > 0) {
        bool isAI = response.bools[0];
        // use isAI
    }
}
```

### 6.4 Example: Zeus Predict

**Request:**

```solidity
string[] memory strings = new string[](5);
strings[0] = "52.377956";   // latitude
strings[1] = "4.897070";   // longitude
strings[2] = "total_precipitation";
strings[3] = "2025-11-12T08:00:00";
strings[4] = "2025-11-12T10:00:00";

OnChainData memory parameters = OnChainData({
    addresses: new address[](0),
    integers: new uint256[](0),
    strings: strings,
    bools: new bool[](0)
});

port.outboundSubnetMessage(18, "/subnet/18/predict", parameters, callbackContract);
```

**Callback:** Read `response.strings[0]` (variable data), `response.strings[1]` (unit), `response.strings[2]` (time data), etc., as in the Zeus response table.

---

## 7. Array Index Summary (Quick Reference)

- **OnChainData** has four arrays: `addresses`, `integers`, `strings`, `bools`. **Outbound** (your request) is limited to **max length 5** per array by the Diamond; **inbound** (node response) is not length-checked (e.g. Bitmind detect-video can return 9 integers).
- **Indices are 0-based.** Empty or unused slots can be omitted (shorter arrays) or left zero/empty.
- **Per-endpoint:** Request layout = how you fill the arrays; response layout = how the node fills them when calling your callback. Always use the spec for the **exact** endpoint (subnet + path).
- **Complex or variable-length data:** Encode in a single string (e.g. `strings[0]` as JSON for messages, prompts, or key-value data). Large arrays (e.g. forecast values, timestamps) → one comma-separated string in `strings[]`.

**Rules (what goes where):**

| Type | Array | Notes |
|------|--------|--------|
| Pure integers (no decimals) | `integers[]` | fps, duration, width, height, token counts, startTime/endTime (whole seconds), absurdity.score |
| Floats / decimals | `strings[]` | Confidence, temperature, lat/lon with decimals, endTime like 58.9 — always as string |
| URLs, model names, summaries, verdicts, text | `strings[]` | |
| Booleans | `bools[]` | isAI, rich, stream, logprobs |
| Large/value arrays | `strings[]` | Single comma-separated string; split in your contract if needed |
| Addresses (subnet inference) | `addresses[]` | Always empty (length 0) for endpoints in this doc |

---

## 8. References

**Documentation (this GitBook):**

- [Integrated Subnets (Overview)](integrated-subnets.md) — Quick overview, HTTP vs contract, high-level request/response.
- [Dapp Integration](../setup/dapp-integration.md) — Gas, cross-chain, and subnet flow.
- [Subnet Inference Example](../examples-and-tutorials/evm-chains/subnet-inference-example.md) — Minimal contract example.
- [Subnet Inference Test – Quick Guide](../dapp-examples/subnet-inference-test-quick-guide.md) — BitMind and Zeus on Fuji.

**Telegraph repo (contracts / node):**

- **Interfaces:** `contracts/evm/interfaces/OnChainData.sol`, `ISubnetReceiverContract.sol`, `IDestinationContract.sol`
- **Diamond (Port):** `contracts/evm/Port.sol` — `outboundSubnetMessage`, array length checks (≤ 5)
- **Example scripts:** `contracts/script/EmitBitmindRequest.s.sol`, `EmitZeusRequest.s.sol` — building OnChainData for Bitmind and Zeus
- **Example callback:** `contracts/remix/SubnetCallback.sol` — stores last response and documents response layout for Zeus and Bitmind
- **Mapping source (Go):** `modules/bittensor/bittensor.mapping.go` — `SubnetEndpointMappings`, `MapOnChainDataToStruct`, `MapStructToOnChainData`
- **Request/response mapping (listener):** `pkg/listener/listener.subnetRequest.go` — `mapOnChainDataToAPIRequest`, `mapAPIResponseToOnChainData`, subnet-specific mappers

---

## 9. Changelog / Notes

- Endpoint strings must match the node’s expected value; canonical form is `/subnet/<id>/<path>`.
- Some response arrays (e.g. Bitmind detect-video) can have more than 5 numeric fields; the node packs them into the `numbers` array up to the contract limit; check node mapping if you need every field.
- For subnets not listed here (e.g. 20, 22, 42), the same pattern applies: request = fill OnChainData by index; response = read by index per that endpoint’s spec from the node or codebase.
