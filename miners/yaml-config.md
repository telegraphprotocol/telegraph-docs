---
description: The YAML Miner Standard — how to write the configuration file that describes your API to the Telegraph protocol.
---

# YAML Configuration

The Telegraph Miner Standard is declarative: instead of writing code, you write a YAML file that describes your API — its endpoints, authentication method, parameter mappings, signal type, and pricing. The protocol reads this YAML to understand how to route requests to you and how to interpret your responses.

Every YAML you register is public. Agents and validators can read it to understand your capabilities. Make it accurate and complete.

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
    type: weather_risk
    label_field: model
  supported_intents:
    - WEATHER_CHECK
    - WEATHER_FORECAST
```

## Field Reference

### Top-Level Fields

| Field | Required | Description |
|---|---|---|
| `version` | Yes | Always `"1"` |
| `kind` | Yes | `"miner"` for on-demand inference, `"validator"` for polled data |
| `id` | Yes | Numeric miner ID used in API paths (`/engine/v1/ask/{id}`) |
| `slug` | Yes | kebab-case identifier, must be unique (e.g., `bittensor-sn18-zeus`) |
| `protocol` | No | `"bittensor"` (default) or `"generic"` |
| `name` | Yes | Human-readable display name |
| `description` | No | Description for routing context and documentation |
| `base_url` | Yes | Upstream API base URL (must start with `https://`) |

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
| `property` | No | `size_bytes`, `value`, `length`, or `count` |
| `value_bytes` | No | Byte threshold |
| `value_num` | No | Numeric threshold |
| `operator` | No | `lte`, `gte`, `lt`, `gt`, or `eq` |

### Auth

| Field | Required | Description |
|---|---|---|
| `auth.type` | Yes | `"bearer"`, `"header"`, or `"none"` |
| `auth.env_var` | If type ≠ none | The **name** of an environment variable holding your API key. Never put the raw key in the YAML. |
| `auth.header_name` | No | Header to inject the key into. Defaults to `Authorization` for `bearer`. |
| `auth.value_prefix` | No | Prefix prepended to the key value (e.g., `"APIKey "`, `"Token "`). Defaults to `"Bearer "` for bearer auth. |

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

`CHAT_COMPLETION`, `LANGUAGE_GENERATION`, `TASK_COMPLETION`, `AGENT_TASK`, `WEB_SEARCH`, `WEATHER_CHECK`, `WEATHER_FORECAST`, `WEATHER_RISK_ASSESSMENT`, `STORM_ALERT`, `DEEPFAKE_DETECTION`, `IMAGE_VERIFICATION`, `VIDEO_VERIFICATION`, `MEDIA_AUTHENTICITY_CHECK`, `AI_DETECTION`, `TELEGRAPH_KNOWLEDGE`, `TEXT_GENERATION`, `HIGH_PERFORMANCE_INFERENCE`, `CONTENT_MODERATION`, `MULTIMODAL_INFERENCE`, `IMAGE_GENERATION`, `TEXT_TO_IMAGE`, `TWITTER_SEARCH`, `NEWS_SEARCH`, `RESEARCH_SYNTHESIS`, `FACT_CHECK`, `TEXT_AUTHENTICITY_CHECK`, `CONTENT_VERIFICATION`

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

When a request arrives from an ERC-8183 job, the node receives raw `OnChainData` arrays and must construct the right HTTP call to your API. Declare this mapping in `on_chain.request`:

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
    type: media_authenticity
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

Before registering on-chain, validate your YAML against a running node using the Validation API:

```bash
curl -X POST http://localhost:7044/miner-dispatcher/validate \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: <node-secret>" \
  -d '{"yaml": "<your-yaml-content>"}'
```

This sandbox-tests every declared endpoint against your upstream API and reports pass/fail per endpoint. The `X-Internal-Secret` header must match the `INTERNAL_SECRET` set in the node's environment — ask the node operator for access. A successful validation response shows which endpoints passed and confirms the YAML is schema-valid.

## Common Validation Failures

| Error | Fix |
|---|---|
| Missing `base_url` | Add a `base_url` starting with `https://` |
| `slug` not kebab-case | Use lowercase letters and hyphens only |
| Invalid `auth.type` | Must be `bearer`, `header`, or `none` |
| Missing `supported_intents` | Add at least one canonical Intent string |
| Invalid `signal_mapping` | Must use only `confidence_field`, `label_field`, and `reason_field` — the `type` field is not allowed |
| Hash mismatch on registration | YAML content changed after you computed the hash — recompute |
