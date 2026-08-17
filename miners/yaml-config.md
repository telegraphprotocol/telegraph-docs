---
description: The YAML Miner Standard — how to write the configuration file that describes your API to the Telegraph protocol.
---

# YAML Configuration

The Telegraph Miner Standard is declarative: instead of writing code, you write a YAML file that describes your API — its endpoints, authentication method, parameter mappings, signal type, and pricing. The protocol reads this YAML to understand how to route requests to you and how to interpret your responses.

Every YAML you register is public. Agents and validators can read it to understand your capabilities. Make it accurate and complete.

> **Start from a working file.** [`example-miner.yaml`](https://github.com/telegraphprotocol/telegraph-examples/blob/master/frontend/yaml/example-miner.yaml) covers every block on this page, with a comment on each explaining what it does and whether it's required. It wraps a free weather API that needs no key, so you can register it as-is, watch the flow work end to end, then swap in your own API.

## Minimal Example

This is the simplest valid miner YAML — a weather forecasting miner:

```yaml
version: "1"
kind: miner
id: 18
slug: bittensor-sn18-zeus
protocol: bittensor
name: Zeus Weather Forecasting (Bittensor SN18)
description: AI-powered hourly weather forecasting backed by the Bittensor network.
base_url: https://api.zeussubnet.com

auth:
  type: header
  header_name: X-API-Key
  env_var: ZEUS_API_KEY

endpoints:
  - path: /predict
    external_path: /v1/forecast/point
    method: GET
    param_map:
      lat: latitude
      lon: longitude

semantics:
  signal_mapping:
    label_field: model
  supported_intents:
    - WEATHER_CHECK
    - WEATHER_FORECAST
```

## Field Reference

### Top-Level Fields

| Field | Required | Description |
|---|---|---|
The schema requires exactly six top-level fields: `version`, `kind`, `id`, `slug`, `name`, `base_url`. Everything else is optional, though a miner with no `endpoints` or `semantics` won't be routable.

| Field | Required | Description |
|---|---|---|
| `version` | Yes | Always `"1"` |
| `kind` | Yes | `"miner"` for on-demand inference, `"validator"` for polled data, `"subnet"` for a Bittensor subnet integration |
| `id` | Yes | Numeric miner ID used in API paths (`/engine/v1/ask/{id}`) |
| `slug` | Yes | kebab-case identifier, must be unique — pattern `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `protocol` | No | `"bittensor"` or `"generic"` |
| `name` | Yes | Human-readable display name |
| `description` | No | Description for routing context and documentation |
| `base_url` | Yes | Upstream API base URL. Must start with `http://` or `https://` — plain `http` is accepted, and is what node-local miners use. |
| `input_schema` | No | JSON Schema describing the request body, surfaced to callers via `/api/miners` |
| `output_schema` | No | JSON Schema describing the response body |
| `polling` | No | For `kind: validator` — requires `polling.interval_seconds` |
| `cache_ttl_sec` | No | Response cache lifetime |
| `rate_limit_per_sec` | No | Client-side rate cap the node applies to your upstream |
| `circuit_threshold` | No | Consecutive failures before the node trips the circuit breaker |
| `circuit_cooldown_seconds` | No | How long the breaker stays open |

### Docs (Optional)

| Field | Description |
|---|---|
| `docs.website` | Official website URL |
| `docs.documentation` | API documentation URL |
| `docs.repository` | Source code repository URL |
| `docs.twitter` | Twitter/X handle or profile URL |
| `docs.discord` | Discord server invite URL |

### Limitations (Optional)

Declare known constraints the integration enforces. Machine-enforced codes: `MAX_BODY_SIZE`, `MAX_PARAM_SIZE`, `MAX_PARAM_VALUE`, `MAX_PARAM_COUNT`.

Each entry:
| Field | Required | Description |
|---|---|---|
| `code` | Yes | Machine-readable code (UPPER_SNAKE_CASE) |
| `message` | Yes | Human-readable description |
| `param` | No | Request body key this applies to |
| `property` | No | `size_bytes`, `value`, `length`, `count`, or `rate` |
| `value_bytes` | No | Byte threshold |
| `value_num` | No | Numeric threshold |
| `operator` | No | `lte`, `gte`, `lt`, `gt`, or `eq` |
| `window_seconds` | No | For `property: rate` only: the window `value_num` applies over, e.g. 5 per `1s`, or 100 per `2592000s` (30 days) |

#### Declaring a rate limit

`property: rate` is the one limitation the node cannot check from the request
itself — it depends on how many times the node has already called you. Declare
your provider's real allowance and the node checks it *before* spending a
caller's money:

```yaml
limitations:
  - code: ACCOUNT_QUOTA
    message: Free tier allows 100 requests per month
    property: rate
    value_num: 100
    window_seconds: 2592000
```

Counts are **node-wide per miner**, not per caller: the node holds one upstream
account for you, so all traffic draws on the same allowance.

> **A miner that declares no rate limit still gets one.** The node applies a
> default backstop of **600 calls/minute** per miner (operator-tunable via
> `MINER_DEFAULT_RATE_PER_MIN`; `0` disables it). It sits far above normal
> traffic — it exists to stop a runaway agent loop hammering you, not to
> enforce a number. Declaring your real limit always beats inheriting this one.

### Errors (Optional)

Tell the protocol where your API reports failures, as dot-paths into your JSON
response body. Numeric segments index arrays (e.g. `errors.0.message`).

| Field | Description |
|---|---|
| `errors.message_path` | Path to your human-readable error message, e.g. `detail` or `errors.0.message` |
| `errors.code_path` | Path to your machine-readable error code, e.g. `error.code` |
| `errors.status_path` | Path to a status you report **inside a 200 response** |
| `errors.success_values` | Values at `status_path` that mean success. Defaults to `["200"]` |

`message_path` and `code_path` just make failures readable — the caller sees
your wording instead of a slice of raw response body.

**`status_path` matters more than it looks.** Some APIs answer `HTTP 200` even
when the call failed, and report the real outcome in the body:

```json
{ "responseData": { "translatedText": "'XX' IS AN INVALID SOURCE LANGUAGE" },
  "responseDetails": "'XX' IS AN INVALID SOURCE LANGUAGE",
  "responseStatus": "403" }
```

To the protocol that is a successful call, because the HTTP status said so. The
caller gets charged, and your error text is stored as a signal. If your API
behaves this way, say so:

```yaml
errors:
  message_path: responseDetails
  status_path: responseStatus
  success_values: ["200"]
```

Now the protocol sees the failure, the call fails properly, **your caller is not
charged**, and no signal is recorded. If your API uses real HTTP status codes,
omit `status_path` — there is nothing to declare.

The check is deliberately conservative: no `status_path` is never a failure, and
a path that does not resolve is never a failure. An API that omits the field on
success will not have healthy calls turned into errors.

> Collectors accept the same `errors:` block, with the same fields and meaning.

### Auth

| Field | Required | Description |
|---|---|---|
The whole `auth` block is optional — omit it for an open API. If you do include it, `auth.type` is required.

| Field | Required | Description |
|---|---|---|
| `auth.type` | Yes (within `auth`) | `"bearer"`, `"header"`, or `"none"` |
| `auth.env_var` | If type ≠ none | The **name** of an environment variable holding your API key. Never put the raw key in the YAML. |
| `auth.header_name` | No | Header to inject the key into. Defaults to `Authorization` for `bearer`. |
| `auth.value_prefix` | No | Prefix prepended to the key value (e.g., `"APIKey "`, `"Token "`). Defaults to `"Bearer "` for bearer auth. |
| `auth.inject` | No | List of extra injection points, for APIs that want the key somewhere other than a header |

Each `auth.inject[]` entry requires `in` and `name`:

| Field | Required | Description |
|---|---|---|
| `in` | Yes | `"header"`, `"query"`, `"body"`, or `"multipart"` |
| `name` | Yes | Parameter or header name to inject under |
| `env_var` | No | Environment variable holding the value, if different from `auth.env_var` |
| `value_prefix` | No | Prefix prepended to the injected value |

Use `in: query` for the many APIs that expect `?apikey=...` rather than a header.

The node reads the environment variable at runtime. Your API key is never stored on-chain — only the `env_var` name is.

### Endpoints

| Field | Required | Description |
|---|---|---|
| `path` | Yes | Incoming path Telegraph exposes (e.g., `/predict`) |
| `external_path` | Yes | Upstream path to forward to |
| `method` | Yes | `GET`, `POST`, `PUT`, `PATCH`, or `DELETE` |
| `description` | No | Human-readable description |
| `endpoint_base_url` | No | Per-endpoint base URL, overrides top-level `base_url` for this endpoint only |
| `content_type` | No | Override `Content-Type` header for this endpoint |
| `multipart_fields` | No | Fields to encode as `multipart/form-data` (for file uploads) |
| `param_map` | No | Rename incoming query params to upstream names: `{incoming: upstream}` |

### Semantics

The `semantics` block defines what your API does and how validators should interpret your responses.

| Field | Required | Description |
|---|---|---|
| `semantics.signal_mapping.confidence_field` | No | Response field holding a 0–1 confidence score |
| `semantics.signal_mapping.label_field` | No | Response field holding the primary decision |
| `semantics.signal_mapping.reason_field` | No | Response field holding reasoning text |
| `semantics.supported_intents` | Yes | List of canonical Intent strings this miner can fulfill |

**IMPORTANT:** The `signal_mapping` only accepts `confidence_field`, `label_field`, and `reason_field`. The `type` field is not allowed.

**Canonical Intents (declare at least one):**

The canonical set lives on-chain and changes over time — intents are added and removed. Declaring one that isn't canonical makes your `registerMiner` transaction **revert**, so read the live set rather than copying a list:

```bash
# the authoritative source
cast call "$DIAMOND" "getCanonicalIntents()(string[])" --rpc-url "$RPC"

# or, with descriptions and how many miners serve each
curl https://devnode.telegraphprotocol.com/engine/v1/intents
```

See [Intents](../using/intents.md) for what each one means and how it's scored.

### On-Chain Data Transform

The `on_chain` block defines how your API responses are translated into the `OnChainData` struct used by ERC-8183 jobs and on-chain callbacks.

| Field | Required | Description |
|---|---|---|
| `on_chain.transform` | Yes | `"direct"` (deterministic field extraction) or `"llm"` (LLM-assisted parsing) |
| `on_chain.min_price_usdc` | No | Floor price for x402 payment gating (e.g., `0.01`) |
| `on_chain.fields.strings[]` | Varies | Text fields to extract into the `strings[]` array |
| `on_chain.fields.integers[]` | Varies | Numeric fields (stored as scaled integers) |
| `on_chain.fields.bools[]` | Varies | Boolean fields |

**Direct transform example** — deterministically extract a score field:

```yaml
on_chain:
  transform: direct
  min_price_usdc: 0.01
  fields:
    integers:
      - index: 0
        name: confidence_x10000
        source_path: confidence
        multiplier: 10000
    bools:
      - index: 0
        name: is_ai_generated
        source_path: isAI
        transform_rule: bool_from_eq:true
```

**LLM transform example** — use GPT-4o to parse a complex response:

```yaml
on_chain:
  transform: llm
  min_price_usdc: 0.01
  prompt_template: |
    Extract these fields from the weather data:
    {field_schema}
    Current UTC: {current_utc}
    Data: {raw_response}
  fields:
    integers:
      - index: 0
        name: temperature_celsius_x100
        description: Temperature in Celsius times 100 at nearest forecast hour.
```

### On-Chain Request Mapping

When a request arrives from an ERC-8183 job or an [on-chain miner request](../using/onchain-miner-requests.md), the node receives raw `OnChainData` arrays and must construct the right HTTP call to your API. Declare this mapping in `on_chain.request`:

Without this block your miner can still serve HTTP and WebSocket traffic, but it cannot be targeted by an on-chain miner request at all — the node has no way to build the call.

```yaml
on_chain:
  request:
    - endpoint: predict
      method: GET
      query_params:
        lat: { source: strings.0 }
        lon: { source: strings.1 }
        variable: { source: strings.2, optional: true }
    
    - endpoint: chat
      method: POST
      body:
        model: { source: strings.0 }
        messages: { source: strings.1, format: chat_messages }
```

**Source format:** `strings.N`, `numbers.N`, or `bools.N` to read from the respective `OnChainData` array at position N.

The `format: chat_messages` shorthand reads alternating role/content pairs from the source index. For example, with `strings=["telegraph-assistant", "user", "What is 2+2"]` and `source: strings.1`, this produces `messages: [{"role":"user","content":"What is 2+2"}]`. Make sure there are at least 2 elements at the source index (one role + one content). For multiple messages, continue alternating: `role, content, role, content, ...`.

**Available source options:**

| Option | Description |
|---|---|
| `source: strings.N` | Value from the `strings[]` array |
| `source: numbers.N` | Value from the `integers[]` array |
| `source: bools.N` | Value from the `bools[]` array |
| `format: chat_messages` | Builds role/content pairs from `strings[idx:]` for OpenAI-compatible APIs |
| `type: float` | Parses the source string as a float64 |
| `type: int` | Parses the source string as an int64 |
| `optional: true` | Omits the field if the source is empty or out of range |
| `content_type` | Per-request Content-Type override (e.g., `application/json`)

### Operational Settings (Optional)

```yaml
rate_limit_per_sec: 5       # Max upstream requests per second (0 = unlimited)
cache_ttl_sec: 0            # Response cache TTL in seconds (0 = no cache)
circuit_threshold: 5        # Consecutive failures before circuit breaker opens
circuit_cooldown_seconds: 30  # Seconds before retry after circuit opens
```

## Complete Example

A full example for a deepfake detection miner (Bittensor SN34 BitMind):

```yaml
version: "1"
kind: miner
id: 34
slug: bittensor-sn34-bitmind
protocol: bittensor
name: BitMind AI/Human Media Detector
description: Detects whether images and videos were AI-generated or authentic.
base_url: https://subnet-api.bitmindlabs.ai

auth:
  type: bearer
  env_var: BITMIND_API_KEY

rate_limit_per_sec: 5
circuit_threshold: 5
circuit_cooldown_seconds: 30

endpoints:
  - path: /detect-image
    external_path: /detect-image
    method: POST
    description: Detect AI-generated images
    multipart_fields: [image]

  - path: /detect-video
    external_path: /detect-video
    method: POST
    description: Detect AI-generated videos
    multipart_fields: [image, video]

semantics:
  signal_mapping:
    confidence_field: confidence
    label_field: isAI
    reason_field: explanation
  supported_intents:
    - DEEPFAKE_DETECTION
    - MEDIA_AUTHENTICITY_CHECK
    - IMAGE_VERIFICATION
    - VIDEO_VERIFICATION

on_chain:
  transform: direct
  min_price_usdc: 0.02
  fields:
    integers:
      - index: 0
        name: confidence_x10000
        source_path: confidence
        multiplier: 10000
    bools:
      - index: 0
        name: is_ai_generated
        source_path: isAI
        transform_rule: bool_from_eq:true
```

## Validation Before Registration

Registration is on-chain and cannot be edited, so validate your YAML first.

Use **[integrate.telegraphprotocol.com](https://integrate.telegraphprotocol.com)**. Paste your YAML, supply your API key if your endpoints need one, and it sandbox-tests every declared endpoint against your real upstream API and reports pass/fail for each. It then pins the YAML and registers it for you.

Validation catches the mistakes that are expensive to fix later: a schema violation, an endpoint that doesn't respond, or an auth setup that doesn't actually authenticate.

## Common Validation Failures

| Error | Fix |
|---|---|
| Missing `base_url` | Add a `base_url` starting with `https://` |
| `slug` not kebab-case | Use lowercase letters and hyphens only |
| Invalid `auth.type` | Must be `bearer`, `header`, or `none` |
| Missing `supported_intents` | Add at least one canonical Intent string |
| Invalid `signal_mapping` | Must use only `confidence_field`, `label_field`, and `reason_field` — the `type` field is not allowed |
| Hash mismatch on registration | YAML content changed after you computed the hash — recompute |
