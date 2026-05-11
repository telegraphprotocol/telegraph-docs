# YAML Miner Standard — Technical Documentation

## Overview

The YAML Miner Standard is Telegraph's declarative way to add a new subnet or validator integration without writing any Go code. A miner author writes a YAML file describing their API — endpoints, authentication, parameter mappings, signal types, and on-chain data transforms — and the node loads it at runtime.

The schema is versioned as `"2"` in the `version` field, which is the current and only production format.

---

## For Miner Authors

### Minimal Example 

```yaml
version: "2"
kind: subnet
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
    description: Single-point hourly weather forecast.
    param_map:
      variable: hourly

semantics:
  signal_mapping:
    type: weather_risk
    label_field: model
  supported_intents:
    - weather_check
    - storm_alert
    - weather_forecast
    - weather_risk_assessment
```

### Complete Reference

```yaml
version: "2"                     # Required. Must be "2" .
kind: subnet                     # "subnet" (on-demand) or "validator" (polled)
id: 34                           # Required. Numeric subnet ID used in URL paths (/v1/34/...)
slug: bittensor-sn34-bitmind     # Required. kebab-case identifier
protocol: bittensor              # "bittensor" or "generic". Default: bittensor
name: BitMind AI/Human Media Detector  # Required. Human-readable display name
description: >                   # Optional. Description for docs and engine context
  Bittensor Subnet 34 — BitMind detects whether images and videos were
  AI-generated or are authentic.
base_url: https://api.bitmind.ai/oracle/v1  # Required. Upstream API base URL

# ── Authentication ──────────────────────────────────────────────────────────
auth:                             # How the node authenticates to the upstream API
  type: bearer                    # "bearer" | "header" | "none"
  env_var: BITMIND_API_KEY       # Environment variable NAME (never the raw key value)
  header_name: Authorization      # Optional. Defaults to "Authorization" for bearer

# ── Operational Settings ────────────────────────────────────────────────────
rate_limit_per_sec: 5             # Max requests/sec to upstream. 0 = unlimited
cache_ttl_sec: 0                  # Response cache TTL. 0 = no cache
circuit_threshold: 5              # Consecutive failures before circuit opens
circuit_cooldown_seconds: 30     # Seconds before retry after circuit opens

# ── Endpoints ───────────────────────────────────────────────────────────────
endpoints:
  - path: /detect-image              # Incoming path Telegraph exposes
    external_path: /detect-image      # Upstream path to forward to
    method: POST                      # HTTP method
    description: Detect AI-generated images
    endpoint_base_url: https://api.bitmind.ai/v2  # Per-endpoint override 
    content_type: multipart/form-data # Override Content-Type
    multipart_fields: [image]         # Fields to encode as multipart  
    param_map:                        # Query parameter renaming
      lat: latitude
      lon: longitude

  - path: /detect-video
    external_path: /detect-video
    method: POST
    description: Detect AI-generated videos
    multipart_fields: [image, video]

# ── Polling (kind=validator only) ──────────────────────────────────────────
polling:                          # Only valid for kind=validator
  interval_seconds: 300
  cache_ttl_seconds: 60

# ── Schema Hints ───────────────────────────────────────────────────────────
input_schema:                    # Optional. JSON Schema for request body validation
  type: object
  required: [image]
  properties:
    image:
      type: string
      format: binary

output_schema:                   # Optional. JSON Schema describing response shape
  type: object
  properties:
    confidence: { type: number, minimum: 0, maximum: 1 }
    isAI: { type: boolean }

# ── Semantics  ─────────────────────────────────────────────────────────
semantics:
  signal_mapping:
    type: media_authenticity         # Required. Canonical signal type (see enum below)
    confidence_field: confidence      # Response field holding 0-1 score
    label_field: isAI               # Response field holding the primary decision
    reason_field: explanation        # Response field holding reasoning text
  supported_intents:                 # Required . Canonical intent strings.
    - deepfake_detection              # Used by autonomous engine for routing
    - media_authenticity_check
    - image_verification
    - video_verification

# ── On-chain Data Transform  ───────────────────────────────────────────
on_chain:
  description: Current weather snapshot for on-chain signal data.
  transform: llm                    # "llm" (uses GPT-4o) or "direct" (deterministic extraction)
  min_price_usdc: 0.01              # Floor price for x402 payment gating
  prompt_template: |                 # Used only when transform=llm
    Extract the following fields from this weather API response:
    {field_schema}
    Current UTC time: {current_utc}
    Raw response: {raw_response}
  fields:
    strings:
      - index: 0
        name: forecast_time
        description: ISO8601 timestamp of the selected forecast hour.
      - index: 1
        name: location
        description: "lat,lon" string from top-level latitude and longitude.
    integers:
      - index: 0
        name: temperature_celsius_x100
        description: Temperature in Celsius times 100.
        source_path: hourly.2t.0        # Dot-notation path for direct transform
        multiplier: 100                 # Multiply before storing as integer
      - index: 1
        name: wind_speed_ms_x100
        description: Wind speed in m/s times 100.
        source_path: hourly.100u.0
        multiplier: 100
    bools:
      - index: 0
        name: is_ai_generated
        description: Whether the content is AI-generated.
        source_path: isAI
        transform_rule: bool_from_eq:true  # "true" if source equals "true"
    addresses: []                      # EVM addresses for on-chain storage
```

### Field Reference

#### Top-Level Fields (both formats)

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | string | yes | `"2"` |
| `kind` | string | yes | `"subnet"` or `"validator"` |
| `id` | integer | yes | Subnet ID used in URL paths (`/v1/{id}/...`) |
| `slug` | string | yes | kebab-case identifier (e.g., `bittensor-sn18-zeus`) |
| `protocol` | string | no | `"bittensor"` (default) or `"generic"` |
| `name` | string | yes | Human-readable display name |
| `description` | string | no | Description for docs and engine context |
| `base_url` | string | yes | Upstream API base URL (must start with `http://` or `https://`) |

#### Auth

| Field | Type | Required | Description |
|---|---|---|---|
| `auth.type` | string | yes | `"bearer"`, `"header"`, or `"none"` |
| `auth.env_var` | string | if type≠none | Environment variable **name** holding the API key. Never put the raw key in the YAML. |
| `auth.header_name` | string | no | Header name for `type=header`. Defaults to `Authorization` for `type=bearer`. |

**How auth works at runtime:**
- `type: bearer` — reads the env var at runtime and injects `Authorization: Bearer <value>` on each upstream request
- `type: header` — reads the env var at runtime and sets the value on the specified `header_name`
- `type: none` — no auth header is injected

#### Endpoints

| Field | Type | Required | Description |
|---|---|---|---|
| `path` | string | yes | Incoming path Telegraph exposes (e.g., `/predict`) |
| `external_path` | string | yes | Upstream path to forward to (e.g., `/forecast`) |
| `method` | string | yes | HTTP method: GET, POST, PUT, PATCH, DELETE |
| `description` | string | no | Human-readable description |
| `endpoint_base_url` | string | no | Per-endpoint base URL override . Replaces top-level `base_url` for this endpoint. |
| `content_type` | string | no | Override Content-Type for this endpoint |
| `multipart_fields` | string[] | no | Fields to encode as `multipart/form-data`. Enables file uploads. |
| `param_map` | map<string,string> | no | Query parameter renaming: `{incoming: upstream}`. E.g., Zeus: `lat → latitude`. |

If `endpoints` is empty or omitted, the generic adapter passes all paths through unchanged (passthrough mode).

#### Semantics 

| Field | Type | Required | Description |
|---|---|---|---|
| `semantics.signal_mapping.type` | string | yes (if semantics present) | Canonical signal type. Must be one of the defined enum values (see below). |
| `semantics.signal_mapping.confidence_field` | string | no | Response field holding a 0-1 confidence score |
| `semantics.signal_mapping.label_field` | string | no | Response field holding the primary decision/label |
| `semantics.signal_mapping.reason_field` | string | no | Response field holding human-readable reasoning |
| `semantics.supported_intents` | string[] | yes (if semantics present) | Canonical intent strings this integration can fulfill |

**Canonical signal types:** `media_authenticity`, `weather_risk`, `text_authenticity`, `search_relevance`, `language_response`, `multimodal_response`, `task_completion`

**Canonical intents (27 total, also available on-chain):** `language_generation`, `chat_completion`, `text_generation`, `high_performance_inference`, `embeddings`, `content_moderation`, `weather_check`, `storm_alert`, `weather_forecast`, `weather_risk_assessment`, `multimodal_inference`, `image_generation`, `text_to_image`, `task_completion`, `agent_task`, `web_search`, `twitter_search`, `news_search`, `research_synthesis`, `fact_check`, `text_authenticity_check`, `ai_text_detection`, `content_verification`, `deepfake_detection`, `media_authenticity_check`, `image_verification`, `video_verification`

#### On-Chain Data Transform 

| Field | Type | Required | Description |
|---|---|---|---|
| `on_chain.description` | string | no | Human-readable description of on-chain data |
| `on_chain.transform` | string | yes | `"llm"` or `"direct"` |
| `on_chain.prompt_template` | string | if transform=llm | LLM prompt template. Placeholders: `{field_schema}`, `{raw_response}`, `{current_utc}` |
| `on_chain.min_price_usdc` | number | no | Floor price for x402 payment gating (e.g., `0.01` = 1 cent) |
| `on_chain.fields` | object | yes | Grouped field definitions |

**Field item properties:**

| Property | Type | Required | Description |
|---|---|---|---|
| `index` | integer | yes | Position in the on-chain array |
| `name` | string | yes | Key name in the intermediate JSON |
| `description` | string | yes | What to extract (used by LLM or as docs) |
| `source_path` | string | no | Dot-notation path into raw response (for `direct` transform) |
| `multiplier` | number | no | Multiply numeric value before storing as integer |
| `transform_rule` | string | no | Optional rule: `bool_from_int` or `bool_from_eq:<value>` |

### Parameter Mapping Examples

**Zeus weather API** — the upstream uses `latitude`/`longitude` but callers use `lat`/`lon`:
```yaml
endpoints:
  - path: /predict
    external_path: /v1/forecast/point
    method: GET
    param_map:
      lat: latitude
      lon: longitude
      variable: hourly
```

**BitMind image upload** — binary fields encoded as multipart:
```yaml
endpoints:
  - path: /detect-image
    external_path: /detect-image
    method: POST
    multipart_fields: [image]
```

#### On-Chain Request Mapping (`on_chain.request`)

When a web3 on-chain request arrives (via `outboundSubnetMessage`), the node must construct an HTTP request to the upstream API from raw on-chain arrays (strings, integers, bools). The `on_chain.request` block declares how to map on-chain data into HTTP query params or JSON body fields — per endpoint.

```yaml
on_chain:
  request:
    - endpoint: chat              # Matches a suffix of the on-chain endpoint (e.g. /subnet/102/chat)
      method: POST                # HTTP method for the upstream call
      body:                       # JSON body fields mapped from on-chain arrays
        model: { source: strings.0 }
        messages: { source: strings.1, format: chat_messages }

    - endpoint: predict
      method: GET
      query_params:               # Query parameters mapped from on-chain arrays
        lat: { source: strings.0 }
        lon: { source: strings.1 }
        hourly: { source: strings.2 }
        start_datetime: { source: strings.3, optional: true }
        end_datetime: { source: strings.4, optional: true }
```

**Source formats** — where to read the field value from the on-chain arrays:
- `strings.N` — value from `strings[]` at index N
- `numbers.N` — value from `integers[]` at index N (stored as `uint256` / `*big.Int`)
- `bools.N` — value from `bools[]` at index N

**Special formats for body fields:**
- `format: chat_messages` — Treats strings starting at the source index as alternating `role`/`content` pairs. Auto-detects `temperature` from trailing unpaired float, `max_tokens` from `numbers[0]`, `stream` from `bools[0]`, and `logprobs` from `bools[1]`. Used by OpenAI, Groq, Chutes, and all OpenAI-compatible LLM subnets.
- `type: float` — Parses the string source as a `float64` number.
- `optional: true` — Omits the field if the source value is empty/missing.

**Endpoint matching**: The node matches the on-chain endpoint path against the YAML `request[].endpoint` keyword using substring matching (`strings.Contains`). The longest matching keyword wins to avoid ambiguous sub-matches (e.g., `search/mini` matches before `search`).

### On-Chain Transform Examples

**Direct transform (deterministic field extraction):**
```yaml
on_chain:
  transform: direct
  fields:
    integers:
      - index: 0
        name: is_ai_confidence_x10000
        source_path: confidence
        multiplier: 10000
    bools:
      - index: 0
        name: is_ai_generated
        source_path: isAI
        transform_rule: bool_from_eq:true
```

**LLM transform (complex response parsing):**
```yaml
on_chain:
  transform: llm
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

---

## For Node Operators

### How YAML Loading Works

All miner YAMLs are loaded exclusively on-chain:

1. **On-chain registry** — Miners register YAMLs via `MinerRegistryFacet.registerMiner()`. The listener picks up `MinerRegistered` events from the blockchain, fetches and validates the YAML from the declared URL, and activates it at the next epoch boundary. No restart is needed.

2. **Epoch boundary activation** — New registrations are staged as "pending" and promoted to "active" at the next epoch boundary. This ensures all nodes converge on the same block. Active miners are hot-loaded into the dispatcher's routing engine.

3. **Startup rehydration** — On restart, the node rehydrates all previously active miners from its local database. No data is lost.

YAML files shipped in the reference integrations directory are **documentation only** — they illustrate the schema contract but are never loaded by the dispatcher at runtime. All live integrations come from on-chain registrations.

### Adding a New Miner (On-Chain)

Register via the smart contract. The node fetches the YAML from the declared URL, validates it against the schema, and activates it at the next epoch boundary. No rebuild or restart needed.

### Schema Validation

Every YAML is validated against the canonical schema before activation. If validation fails, the entry is stored as rejected and the miner must deregister and re-register with a corrected file.

Common validation failures:
- Missing `base_url` (required)
- `slug` not in `kebab-case` format
- Invalid `auth.type` (must be `bearer`, `header`, or `none`)
- Missing `supported_intents` in `semantics` block (required)
- Invalid `semantics.signal_mapping.type` (must be one of the enum values)

### Intent-Based Routing

The node indexes all loaded miners by their declared `supported_intents`. When the autonomous engine receives a task for a given intent, it routes to the miner that declared that intent. If multiple miners declare the same intent, the most recently activated one wins.

---

## For Executives

### What the YAML Standard Enables

1. **Zero-code integrations:** Adding a new subnet requires only a YAML file. No Go code changes, no rebuilds for on-chain registrations.

2. **Permissionless participation:** Any miner can register their YAML on-chain. Nodes validate and activate automatically.

3. **Self-describing APIs:** Each YAML declares endpoints, auth, schemas, and signal types. The autonomous engine can construct correct requests without hardcoded knowledge.

4. **On-chain data bridge:** The `on_chain` block defines how raw API responses are transformed into deterministic on-chain data — enabling the blockchain to consume real-world signals.

5. **x402 pricing integration:** `on_chain.min_price_usdc` sets the floor price for per-request payments, connecting the miner standard to the payment layer.

### Design Decisions

1. **YAML over JSON:** YAML is more human-readable for miner authors. The loader converts to JSON internally for schema validation.

2. **Env vars for secrets, not raw keys:** The `auth.env_var` field stores the **name** of an environment variable, never the key value itself. This prevents secrets from being committed to git or stored on-chain.

3. **Slug as deduplication key:** The node indexes miners by slug. When a new registration with the same slug arrives (e.g., after deregister + re-register), it replaces the previous one.

4. **Multipart and param_map in YAML:** These cover the most common per-miner API customizations declaratively, without requiring any code changes.

---

## Related Documentation

- [Miner Registry](miner-registry-facet.md) — On-chain registration, epoch activation, and catch-up
- [x402 Payment Protocol](x402-payment.md) — Per-request payment gating using `min_price_usdc`