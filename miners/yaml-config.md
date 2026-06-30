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
| `id` | Yes | Numeric miner ID used in API paths (`/miner-dispatcher/v1/{id}/...`) |
| `slug` | Yes | kebab-case identifier, must be unique (e.g., `bittensor-sn18-zeus`) |
| `protocol` | No | `"bittensor"` (default) or `"generic"` |
| `name` | Yes | Human-readable display name |
| `description` | No | Description for routing context and documentation |
| `base_url` | Yes | Upstream API base URL (must start with `https://`) |

### Auth

| Field | Required | Description |
|---|---|---|
| `auth.type` | Yes | `"bearer"`, `"header"`, or `"none"` |
| `auth.env_var` | If type ≠ none | The **name** of an environment variable holding your API key. Never put the raw key in the YAML. |
| `auth.header_name` | No | Header to inject the key into. Defaults to `Authorization` for `bearer`. |

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
| `semantics.signal_mapping.type` | Yes | Canonical signal type (see table below) |
| `semantics.signal_mapping.confidence_field` | No | Response field holding a 0–1 confidence score |
| `semantics.signal_mapping.label_field` | No | Response field holding the primary decision |
| `semantics.signal_mapping.reason_field` | No | Response field holding reasoning text |
| `semantics.supported_intents` | Yes | List of canonical Intent strings this miner can fulfill |

**Canonical signal types:**

| Type | Use case |
|---|---|
| `language_response` | LLM completions, chat |
| `weather_risk` | Weather forecasting and alerts |
| `media_authenticity` | Deepfake and AI-content detection |
| `text_authenticity` | AI text detection |
| `search_relevance` | Web search results |
| `multimodal_response` | Image generation, vision tasks |
| `task_completion` | Agent task execution |

**Canonical Intents (declare at least one):**

`LANGUAGE_GENERATION`, `CHAT_COMPLETION`, `TEXT_GENERATION`, `HIGH_PERFORMANCE_INFERENCE`, `EMBEDDINGS`, `CONTENT_MODERATION`, `WEATHER_CHECK`, `STORM_ALERT`, `WEATHER_FORECAST`, `WEATHER_RISK_ASSESSMENT`, `MULTIMODAL_INFERENCE`, `IMAGE_GENERATION`, `TEXT_TO_IMAGE`, `TASK_COMPLETION`, `AGENT_TASK`, `WEB_SEARCH`, `TWITTER_SEARCH`, `NEWS_SEARCH`, `RESEARCH_SYNTHESIS`, `FACT_CHECK`, `TEXT_AUTHENTICITY_CHECK`, `AI_TEXT_DETECTION`, `CONTENT_VERIFICATION`, `DEEPFAKE_DETECTION`, `MEDIA_AUTHENTICITY_CHECK`, `IMAGE_VERIFICATION`, `VIDEO_VERIFICATION`

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

**Source format:** `strings.N`, `numbers.N`, or `bools.N` to read from the respective `OnChainData` array at position N. The `format: chat_messages` shorthand handles alternating role/content pairs for LLM APIs automatically.

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
| Invalid `signal_mapping.type` | Must be one of the 7 canonical signal types |
| Hash mismatch on registration | YAML content changed after you computed the hash — recompute |
