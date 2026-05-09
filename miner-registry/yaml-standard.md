# YAML Miner Standard — Technical Documentation

## Overview

The YAML Miner Standard is Telegraph's declarative way to add a new subnet or validator integration without writing any Go code. An integration author writes a YAML file describing their API — endpoints, authentication, parameter mappings, signal types, and on-chain data transforms — and the node loads it at runtime.

There are two supported schema versions:

- **v1** — Flat layout with `signal_mapping` at root level. Legacy but fully supported.
- **v2** — Current version. Adds the `semantics` block (`signal_mapping` + `supported_intents`), the `on_chain` block (data transforms and pricing), and per-endpoint `endpoint_base_url` overrides.

Both versions produce the same internal `SubnetCfg` struct. The loader detects the `version` field and routes to the correct parser and schema.

---

## For Miner Authors

### Minimal Example (v2)

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

### Complete v2 Reference

```yaml
version: "2"                     # Required. Must be "2" for v2.
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
    endpoint_base_url: https://api.bitmind.ai/v2  # Per-endpoint override (v2 only)
    content_type: multipart/form-data # Override Content-Type
    multipart_fields: [image]         # Fields to encode as multipart (v2: string list)
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

# ── Semantics (v2) ─────────────────────────────────────────────────────────
semantics:
  signal_mapping:
    type: media_authenticity         # Required. Canonical signal type (see enum below)
    confidence_field: confidence      # Response field holding 0-1 score
    label_field: isAI               # Response field holding the primary decision
    reason_field: explanation        # Response field holding reasoning text
  supported_intents:                 # Required for v2. Canonical intent strings.
    - deepfake_detection              # Used by autonomous engine for routing
    - media_authenticity_check
    - image_verification
    - video_verification

# ── On-chain Data Transform (v2) ───────────────────────────────────────────
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

#### Top-Level Fields (v1 and v2)

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | string | yes | `"1"` or `"2"` |
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
- `type: bearer` — reads `os.Getenv(env_var)`, sets `Authorization: Bearer <value>` (handles double-prefix gracefully)
- `type: header` — reads `os.Getenv(env_var)`, sets the value on the specified `header_name`
- `type: none` — no auth header injected

#### Endpoints

| Field | Type | Required | Description |
|---|---|---|---|
| `path` | string | yes | Incoming path Telegraph exposes (e.g., `/predict`) |
| `external_path` | string | yes | Upstream path to forward to (e.g., `/forecast`) |
| `method` | string | yes | HTTP method: GET, POST, PUT, PATCH, DELETE |
| `description` | string | no | Human-readable description |
| `endpoint_base_url` | string | no | Per-endpoint base URL override (v2 only). Replaces top-level `base_url` for this endpoint. |
| `content_type` | string | no | Override Content-Type for this endpoint |
| `multipart_fields` | string[] | no | Fields to encode as `multipart/form-data`. Enables file uploads. |
| `param_map` | map<string,string> | no | Query parameter renaming: `{incoming: upstream}`. E.g., Zeus: `lat → latitude`. |

If `endpoints` is empty or omitted, the generic adapter passes all paths through unchanged (passthrough mode).

#### Semantics (v2 only)

| Field | Type | Required | Description |
|---|---|---|---|
| `semantics.signal_mapping.type` | string | yes (if semantics present) | Canonical signal type. Must be one of the defined enum values (see below). |
| `semantics.signal_mapping.confidence_field` | string | no | Response field holding a 0-1 confidence score |
| `semantics.signal_mapping.label_field` | string | no | Response field holding the primary decision/label |
| `semantics.signal_mapping.reason_field` | string | no | Response field holding human-readable reasoning |
| `semantics.supported_intents` | string[] | yes (if semantics present) | Canonical intent strings this integration can fulfill |

**Canonical signal types:** `media_authenticity`, `weather_risk`, `text_authenticity`, `search_relevance`, `language_response`, `multimodal_response`, `task_completion`

**Canonical intents (27 total, also available on-chain):** `language_generation`, `chat_completion`, `text_generation`, `high_performance_inference`, `embeddings`, `content_moderation`, `weather_check`, `storm_alert`, `weather_forecast`, `weather_risk_assessment`, `multimodal_inference`, `image_generation`, `text_to_image`, `task_completion`, `agent_task`, `web_search`, `twitter_search`, `news_search`, `research_synthesis`, `fact_check`, `text_authenticity_check`, `ai_text_detection`, `content_verification`, `deepfake_detection`, `media_authenticity_check`, `image_verification`, `video_verification`

#### On-Chain Data Transform (v2 only)

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

### How the Loader Works

The node loads integration YAMLs from two paths:

1. **Embedded filesystem** (built into the binary): `modules/subnet-dispatcher/integrations/*.yaml`
2. **On-chain registry** (hot-loaded at epoch boundaries): `HotRegister(rawYAML)` validates and activates

```
Startup:
  LoadFromFS(embedded, "integrations/")  →  validates v1/v2 YAMLs
  hydrateDispatcher()                     →  loads active DB records into dispatcher

At epoch boundary:
  activatePending()
    → For each "pending" record:
        HotRegister(rawYAML)
          → LoadBytes(rawYAML) validates against v2 schema
          → generic.New(cfg) creates adapter
          → reg.Upsert(adapter) replaces by slug
```

### Adding a New Miner (File-Based)

Place a new YAML file in `modules/subnet-dispatcher/integrations/` and rebuild. The embedded filesystem picks it up automatically.

### Adding a New Miner (On-Chain)

Register via the smart contract. The node will fetch the YAML from the URL, validate it, and activate it at the next epoch boundary. No rebuild or restart needed. See [Miner Registry](miner-registry.md) for the full flow.

### Schema Validation

The loader validates every YAML against the canonical JSON Schema (`integration.v2.schema.json` or `integration.v1.schema.json`). If validation fails, the integration is stored as "rejected" and logged:

```
processMinerRecord: schema validation failed registrationId=27 errors=[(root): base_url is required]
```

Common validation failures:
- Missing `base_url` (required in v2)
- Missing `slug` pattern compliance (must be `kebab-case`)
- Invalid `auth.type` (must be `bearer`, `header`, or `none`)
- Missing `supported_intents` in `semantics` block (required in v2)
- Invalid `semantics.signal_mapping.type` (must be one of the enum values)

### Intent-Based Routing

The dispatcher builds an `intentMap` from all loaded integrations' `supported_intents`. This maps canonical intent strings to integration slugs:

```
"weather_check" → "bittensor-sn18-zeus"
"deepfake_detection" → "bittensor-sn34-bitmind"
```

The autonomous engine uses this map for deterministic routing — given an intent, it knows which integration to call.

---

## For Executives

### What the YAML Standard Enables

1. **Zero-code integrations:** Adding a new subnet requires only a YAML file. No Go code changes, no rebuilds for on-chain registrations.

2. **Permissionless participation:** Any miner can register their YAML on-chain. Nodes validate and activate automatically.

3. **Self-describing APIs:** Each YAML declares endpoints, auth, schemas, and signal types. The autonomous engine can construct correct requests without hardcoded knowledge.

4. **On-chain data bridge:** The `on_chain` block defines how raw API responses are transformed into deterministic on-chain data — enabling the blockchain to consume real-world signals.

5. **x402 pricing integration:** `on_chain.min_price_usdc` sets the floor price for per-request payments, connecting the integration standard to the payment layer.

### v1 vs v2 Differences

| Feature | v1 | v2 |
|---|---|---|
| Signal mapping | Root-level `signal_mapping` | Nested under `semantics` |
| Supported intents | Not in YAML | `semantics.supported_intents` array |
| On-chain config | Not available | `on_chain` block with transform + fields |
| Endpoint base URL override | Not available | `endpoint_base_url` per endpoint |
| Signal type enum | Free string | Strict enum validation |
| Canonical intent validation | Not available | Warning for unknown intents |

### Design Decisions

1. **YAML over JSON:** YAML is more human-readable for integration authors. The loader converts to JSON internally for schema validation.

2. **Env vars for secrets, not raw keys:** The `auth.env_var` field stores the **name** of an environment variable, never the key value itself. This prevents secrets from being committed to git or stored on-chain.

3. **Slug as deduplication key:** The dispatcher indexes adapters by slug. When a new registration with the same slug arrives (e.g., after deregister + re-register), it replaces the old one.

4. **Two schema versions, one internal struct:** Both v1 and v2 convert to the same `SubnetCfg` Go struct. The dispatch layer doesn't know which version the file was.

5. **Multipart and param_map in YAML:** These are the most common per-adapter customizations. Rather than requiring Go code for every new API quirk, we express them declaratively in the YAML.

---

## Related Documentation

- [Miner Registry](miner-registry.md) — On-chain registration, epoch activation, and catch-up
- [x402 Payment Protocol](x402-payment.md) — Per-request payment gating using `min_price_usdc`
- [Subnet Dispatcher Overview](../documentation/SUBNET_DISPATCHER_OVERVIEW.md) — Generic adapter architecture