---
description: The YAML Miner Standard. How to write the configuration file that describes your API to the Telegraph protocol, including intents and intent mapping.
---

# YAML Configuration

The Telegraph Miner Standard is declarative: instead of writing code, you write a YAML file that describes your API: its endpoints, authentication method, parameter mappings, signal type, and pricing. The protocol reads this YAML to understand how to route requests to you and how to interpret your responses.

Every YAML you register is public. Agents and validators can read it to understand your capabilities. Make it accurate and complete.

> **Start from a working file.** [`example-miner.yaml`](https://github.com/telegraphprotocol/telegraph-examples/blob/master/frontend/yaml/example-miner.yaml) covers every block on this page, with a comment on each explaining what it does and whether it's required. It wraps a free weather API that needs no key, so you can register it as-is, watch the flow work end to end, then swap in your own API.

## What changed in V2 (read this if you have an older YAML)

| Topic | Before | Now |
|---|---|---|
| Intents you list | A flat list of canonical names such as `WEATHER_FORECAST` | **Intents only, never prefixes.** Use `WEATHER_CHECK_TEMPERATURE`, not `WEATHER_CHECK`. A prefix is refused with `a prefix is not an intent`. See [Intents must be intents](#intents-must-be-intents-not-prefixes). |
| Reading your answers | The node's parser model read your whole answer | You may declare an **`intent_mapping`** so the node locates each field by path and computes numbers in code. See [Intent mapping](#intent-mapping-optional). |
| Requests from on-chain jobs | The `on_chain.request` block mapped `OnChainData` onto your HTTP call | **Not used for jobs.** A job's request is built from the intent's inputs. See [On-chain jobs](#on-chain-jobs-and-the-on_chain-block). |

## Minimal Example

This is the simplest valid miner YAML, a weather miner:

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

endpoints:
  - path: /predict
    external_path: /v1/forecast/point
    method: GET
    description: Hourly weather forecast for a single latitude/longitude point.
    intents: [WEATHER_CHECK_TEMPERATURE]
    params:
      query:
        required:
          - name: lat
            type: number
            intents: ["*"]
            description: "Latitude in decimal degrees, -90 to 90."
          - name: lon
            type: number
            intents: ["*"]
            description: "Longitude in decimal degrees, -180 to 180."
    param_map:
      lat: latitude
      lon: longitude

semantics:
  signal_mapping:
    label_field: model
  supported_intents:
    - WEATHER_CHECK_TEMPERATURE
```

`description` and `intents` are on the endpoint because they are required. A YAML without them is refused at registration. `params` is not required, but it is what stops the node guessing your field names, so treat it as part of the minimum in practice.

## Field Reference

### Top-Level Fields

The schema requires exactly six top-level fields: `version`, `kind`, `id`, `slug`, `name`, `base_url`. Everything else is optional, though a miner with no `endpoints` or `semantics` won't be routable.

> **Every block below is a closed set.** The schema sets `additionalProperties: false` at the root *and* inside `endpoints[]`, `auth`, and `semantics.signal_mapping`. A key that isn't listed here is not ignored. It fails validation outright with `Additional property <name> is not allowed`, and your registration is rejected. There is no way to attach custom fields.

| Field | Required | Description |
|---|---|---|
| `version` | Yes | Always `"1"` |
| `kind` | Yes | `"miner"` for on-demand inference, `"validator"` for polled data, `"subnet"` for a Bittensor subnet integration |
| `id` | Yes | Numeric miner ID used in API paths (`/engine/v1/ask/{id}`). Must be unused. Requests are routed on it, so a clash is rejected |
| `slug` | Yes | kebab-case identifier, pattern `^[a-z0-9]+(-[a-z0-9]+)*$`. Your identity: only the wallet holding it may register it |
| `protocol` | No | `"bittensor"` or `"generic"` |
| `name` | Yes | Human-readable display name |
| `description` | No | Description for routing context and documentation |
| `base_url` | Yes | Upstream API base URL. Must start with `http://` or `https://` |
| `input_schema` | No | **Top-level only.** JSON Schema describing the request body, surfaced to callers via `/api/miners` |
| `output_schema` | No | **Top-level only.** JSON Schema describing the response body |
| `intent_mapping` | No | How each intent's request becomes your request, and where each answer field sits in your response. See [Intent mapping](#intent-mapping-optional) |
| `polling` | No | For `kind: validator`, requires `polling.interval_seconds` |
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

| Field | Required | Description |
|---|---|---|
| `code` | Yes | Machine-readable code (UPPER_SNAKE_CASE) |
| `message` | Yes | Human-readable description |
| `param` | No | Request body key this applies to |
| `property` | No | `size_bytes`, `value`, `length`, `count`, or `rate` |
| `value_bytes` | No | Byte threshold |
| `value_num` | No | Numeric threshold |
| `operator` | No | `lte`, `gte`, `lt`, `gt`, or `eq` |
| `window_seconds` | No | For `property: rate` only: the window `value_num` applies over, for example 5 per `1s`, or 100 per `2592000s` (30 days) |

#### Declaring a rate limit

`property: rate` is the one limitation the node cannot check from the request itself, because it depends on how many times the node has already called you. Declare your provider's real allowance and the node checks it *before* spending a caller's money:

```yaml
limitations:
  - code: ACCOUNT_QUOTA
    message: Free tier allows 100 requests per month
    property: rate
    value_num: 100
    window_seconds: 2592000
```

Counts are **node-wide per miner**, not per caller: the node holds one upstream account for you, so all traffic draws on the same allowance.

> **A miner that declares no rate limit still gets one.** The node applies a default backstop of **600 calls/minute** per miner (operator-tunable via `MINER_DEFAULT_RATE_PER_MIN`; `0` disables it). It exists to stop a runaway agent loop hammering you, not to enforce a number. Declaring your real limit always beats inheriting this one. A rate-limit refusal from your upstream is not counted as a miner failure.

### Errors (Optional)

Tell the protocol where your API reports failures, as dot-paths into your JSON response body. Numeric segments index arrays (for example `errors.0.message`).

| Field | Description |
|---|---|
| `errors.message_path` | Path to your human-readable error message, for example `detail` or `errors.0.message` |
| `errors.code_path` | Path to your machine-readable error code, for example `error.code` |
| `errors.status_path` | Path to a status you report **inside a 200 response** |
| `errors.success_values` | Values at `status_path` that mean success. Defaults to `["200"]` |

`message_path` and `code_path` just make failures readable. **`status_path` matters more than it looks.** Some APIs answer `HTTP 200` even when the call failed, and report the real outcome in the body:

```json
{ "responseData": { "translatedText": "'XX' IS AN INVALID SOURCE LANGUAGE" },
  "responseDetails": "'XX' IS AN INVALID SOURCE LANGUAGE",
  "responseStatus": "403" }
```

To the protocol that is a successful call, because the HTTP status said so. The caller gets charged, and your error text is stored as a signal. If your API behaves this way, say so:

```yaml
errors:
  message_path: responseDetails
  status_path: responseStatus
  success_values: ["200"]
```

Now the protocol sees the failure, the call fails properly, **your caller is not charged**, and no signal is recorded. If your API uses real HTTP status codes, omit `status_path`. The check is deliberately conservative: no `status_path` is never a failure, and a path that does not resolve is never a failure.

> Collectors accept the same `errors:` block, with the same fields and meaning.

### Auth

The whole `auth` block is optional. Omit it for an open API. If you include it, `auth.type` is required.

| Field | Required | Description |
|---|---|---|
| `auth.type` | Yes (within `auth`) | `"bearer"`, `"header"`, or `"none"` |
| `auth.env_var` | No | **Not read.** Accepted for backward compatibility only. See [API keys](#api-keys) |
| `auth.header_name` | No | Header to inject the key into. Defaults to `Authorization` for `bearer` |
| `auth.value_prefix` | No | Prefix prepended to the key value (for example `"APIKey "`, `"Token "`). Defaults to `"Bearer "` for bearer auth |
| `auth.inject` | No | List of extra injection points, for APIs that want the key somewhere other than a header |

Each `auth.inject[]` entry requires `in` and `name`:

| Field | Required | Description |
|---|---|---|
| `in` | Yes | `"header"`, `"query"`, `"body"`, or `"multipart"` |
| `name` | Yes | Parameter or header name to inject under |
| `secret` | No | Selects one value from a multi-secret JSON key (for example `api_key`, `api_secret`). Omit for single-secret providers |
| `env_var` | No | **Not read.** Accepted for backward compatibility only |
| `value_prefix` | No | Prefix prepended to the injected value |

Use `in: query` for the many APIs that expect `?apikey=...` rather than a header.

### API keys

Your key never goes in the YAML. A YAML is public, pinned to IPFS and hashed on-chain, and the key is not read from the node's environment either. You install it against your slug, signing with the wallet that registered the miner: see [Installing or rotating your API key](miner-registration.md#installing-or-rotating-your-api-key).

- **Register first.** With no live registration for the slug there is no wallet to bind the key to, and the endpoint returns `404`.
- **The key belongs to the wallet, not the slug.** It is released only while that wallet still holds the slug. `updateMiner` keeps it (same wallet). If a slug changes hands, the new holder gets nothing.

For a multi-secret provider, install a JSON object as the key and select the parts with `secret` in each `auth.inject[]` entry.

If no key resolves, the two auth styles differ: a top-level `auth` block is called **unauthenticated** (so you see upstream `401`s), while an unresolved `auth.inject[]` entry **fails the request before any upstream call**, naming the injection.

### Endpoints

| Field | Required | Description |
|---|---|---|
| `path` | Yes | Incoming path Telegraph exposes (for example `/predict`) |
| `external_path` | Yes | Upstream path to forward to |
| `method` | Yes | `GET`, `POST`, `PUT`, `PATCH`, or `DELETE` |
| `description` | **Yes** | What this endpoint does. Not decoration: the request builder is given this text to decide how to call you. See below |
| `intents` | **Yes\*** | The **intents** this endpoint serves, for example `[FX_NOW_EUR]`. Without it no intent can select this endpoint. See below |
| `params` | Recommended | The request contract: which parameters this endpoint takes, where they go, and which are required. See below |
| `endpoint_base_url` | No | Per-endpoint base URL, overrides top-level `base_url` for this endpoint only |
| `content_type` | No | Override `Content-Type` header for this endpoint |
| `multipart_fields` | No | Fields to encode as `multipart/form-data` (for file uploads) |
| `param_map` | No | Rename incoming query params to upstream names: `{incoming: upstream}` |

**Those ten fields are the whole list.** Anything else inside an `endpoints[]` entry is rejected.

\* At least one endpoint must declare `intents`, and registration is refused if none does. An *individual* endpoint may omit it when it is a utility endpoint not meant to be selected by intent (a health check, an upload-URL helper). That produces a warning, not a rejection. The first intent in an endpoint's list labels its calls.

### Why `description`, `intents` and `params` decide whether you get traffic

These three are how the node works out **how to call you**. A miner that omits them registers successfully and then answers badly, which is much harder to debug than a rejection.

For every question routed to your miner the node has to turn a natural-language task into an HTTP request against your API. It has your YAML and nothing else:

- **`intents`** decides *whether the endpoint is reachable at all*. Routing selects an endpoint by intent. An endpoint declaring no intents can never be selected.
- **`description`** decides *which* endpoint is picked when several serve the same intent, and tells the request builder what the endpoint expects. "Detect AI-generated images" is useful; "endpoint" is not.
- **`params`** decides *whether the request is well-formed*. Without it the builder has to guess your field names. Guessing is the single most common cause of a miner rejecting the calls Telegraph sends it: the node asks for `q`, your API wanted `query`, and every call comes back `400`.

If your miner is registered and active but scoring badly or returning errors on requests that look fine by hand, missing `params` is the first thing to check.

### `params` : the request contract

`params` groups parameters by **where they go** (`body`, `query`, `path`, `header`, `multipart`) and each group splits into `required` and `optional`. Which array a parameter sits in is what marks it required.

```yaml
endpoints:
  - path: /forecast
    external_path: /v1/forecast/point
    method: GET
    description: Hourly weather forecast for a single latitude/longitude point.
    intents: [WEATHER_CHECK_TEMPERATURE]
    params:
      query:
        required:
          - name: lat
            type: number
            intents: ["*"]
            description: "Latitude in decimal degrees, -90 to 90."
          - name: lon
            type: number
            intents: ["*"]
            description: "Longitude in decimal degrees, -180 to 180."
        optional:
          - name: units
            type: string
            intents: ["*"]
            description: "Temperature units. Defaults to celsius."
            accepted_fields:
              - value: celsius
                intents: ["*"]
                description: Degrees Celsius.
              - value: fahrenheit
                intents: ["*"]
                description: Degrees Fahrenheit.
```

| Field | Required | Description |
|---|---|---|
| `name` | Yes | The name sent upstream, after any `param_map` rename |
| `type` | Yes | `string`, `integer`, `number`, `boolean`, `array`, or `object` |
| `intents` | Yes | Which of the endpoint's intents need this parameter, or `["*"]` for all |
| `description` | Recommended | What the value means, plus any constraint the caller must satisfy: ranges, formats, units, enums |
| `accepted_fields` | No | The allowed values, each with its own `description` and `intents` |

**Put your validation rules in `description`.** Without an `intent_mapping`, the node does not enforce ranges or formats for you; the description is what the request builder reads to avoid sending a value your API will reject. `"Latitude in decimal degrees, -90 to 90"` prevents a bad call; `"latitude"` does not.

**`intents` on a parameter is how one endpoint serves several intents.** When `/chat` handles both `CHAT_COMPLETION_GENERAL` and `WEB_SEARCH_GENERAL` and the difference is a `model` value, express it with `accepted_fields` carrying different `intents`.

The most common mistake is `input_schema` / `output_schema`. They describe a request and a response, so nesting them under the endpoint they describe is the natural guess, but they are **top-level** fields, and the schema refuses them anywhere else:

```yaml
# REJECTED: "endpoints.0: Additional property input_schema is not allowed"
endpoints:
  - path: /check-tx
    external_path: /check-tx
    method: GET
    input_schema:            # not allowed here
      type: object
```

```yaml
# CORRECT: the schema blocks sit at the top level
endpoints:
  - path: /check-tx
    external_path: /check-tx
    method: GET

input_schema:
  type: object
  required: [tx_hash]
  properties:
    tx_hash:
      type: string
      pattern: "^0x[0-9a-fA-F]{64}$"

output_schema:
  type: object
  properties:
    status: { type: string }
```

`input_schema` is a single top-level block, so a miner exposing several endpoints with different request shapes describes them in one schema (or omits it). It is documentation surfaced to callers, not a per-endpoint validator.

### Semantics

| Field | Required | Description |
|---|---|---|
| `semantics.signal_mapping.confidence_field` | No | Response field holding a 0-1 confidence score |
| `semantics.signal_mapping.label_field` | No | Response field holding the primary decision |
| `semantics.signal_mapping.reason_field` | No | Response field holding reasoning text |
| `semantics.supported_intents` | Yes | The **intents** this miner can fulfill |

`signal_mapping` only accepts `confidence_field`, `label_field`, and `reason_field`. The `type` field is not allowed.

### Intents must be intents, not prefixes

The catalog has **prefixes** (families such as `FX_NOW`) and **intents** (specific questions such as `FX_NOW_EUR`). Miners serve intents. In your YAML:

- `semantics.supported_intents` lists intents.
- Every endpoint's `intents:` list and every parameter's `intents:` list uses intents.
- The same intents appear in the `supportedIntents` argument of `registerMiner`.

Listing a prefix is refused at registration (`a prefix is not an intent`). Every intent you list gets its questions put to your miner every round, and your answers are read by the node's parser, so list only what your API genuinely answers.

```bash
cast call "$DIAMOND" "getCanonicalIntents()(string[])" --rpc-url "$RPC"      # the intents
cast call "$DIAMOND" "getPrefixes()(string[],uint8[])" --rpc-url "$RPC"       # the families
curl https://devnode.telegraphprotocol.com/engine/v1/intents                  # with miner counts
```

If no intent fits, use a `_GENERAL` child (21 judgment families ship with one, listed in [Intents](../using/intents.md#_general-intents)), or [propose a new intent](../using/intents.md#proposing-a-new-intent).

### Intent mapping (optional)

`intent_mapping` tells the node, **for each intent you serve**, how to build your request from the user's request and where each field of the intent's response format sits in your answer. A miner without it is called and read exactly as before. With it, the node reads your answers precisely instead of asking a model to find the values.

It needs the node to run the parser model (`PARSER_LLM_ENABLED=true`, with a NuExtract-style model recommended). Nodes where `INTENT_MAPPING_ENABLED` is off ignore it.

```yaml
intent_mapping:
  FX_NOW_EUR:
    endpoint: /query                 # a declared endpoint path
    vars:                            # values read from the request, not sent to you
      quote: Quote currency of the pair, ISO 4217 code.
    input:                           # your param -> how to fill it
      from: { from: base, how: "Base currency code, upper case." }
      to:   { from: quote }
    output:                          # intent response field -> where it is in your answer
      rate:  { path: "rates.{to}", unit: quote per base }
      as_of: { path: date }
```

How it is used:

- **Requests.** The extraction model fills your params from the question, using a typed template built from the endpoint's `params`, `input_schema`, and each param's `how`. Constants and time params are filled in code. The result is checked against your YAML before sending: every required param present, types, `enum` values and `pattern`s. An optional value that fails is dropped; a required one that is missing or fails means the request is not sent and the router uses its fallback miner.
- **Answers.** Each field is located with its `path`. **Numbers are computed in code**: the located value, a series reduced with `reduce`, converted from `unit`, or a `formula`. Every other field comes from one model call that sees only the located values. Copied text and numbers must appear verbatim in them, and enums must be allowed values. A field the mapping does not list is reported `missing`.

Arithmetic is never left to the model. On real answers it misconverted every Kelvin temperature and half the rouble cross rates, while it read located values correctly every time no arithmetic was needed.

| Field | Type | Description |
|---|---|---|
| `intent_mapping.<INTENT>.endpoint` | string | Declared endpoint `path` that serves the intent |
| `...vars.<name>` | string | A value read from the request that is not sent to you but is needed to read your answer (`{name}` in a path or formula). The text describes it to the model |
| `...input.<param>.from` | string or string[] | Where the value comes from: an intent input name (or several), `const` (with `value`), or a time: `now` (current hour), `today` or `tomorrow` (00:00 UTC) |
| `...input.<param>.value` | any | The constant for `from: const` |
| `...input.<param>.add_hours_from` / `default_hours` | string / number | Time params: hours to add, read from the request under this name; `default_hours` when the request gives none (for example a window end = now + hours) |
| `...input.<param>.time_format` | `rfc3339` or `date` | Format of a time value. Default `rfc3339` |
| `...input.<param>.how` | string | How to write the value (`Solana -> solana`, `upper case`). Shown to the model |
| `...output.<field>.path` | string | Dot path into your answer. A number indexes an array, `*` matches every key, `x[]` is every element of `x`, `{name}` is a request value (a param sent, a `vars` value, or the question key) |
| `...output.<field>.unit` | string | The unit your answer gives the value in. Code converts it to the field's unit: one of the field's `unit_aliases`, or Kelvin / Fahrenheit / Celsius, fraction / percent / basis points, wei / gwei, km/h / m/s / mph / knots, Unix ms / s. A unit with no conversion is not guessed: the field is rejected, never stored as the raw number |
| `...output.<field>.reduce` | `max` `min` `first` `last` `sum` `mean` | Reduce a series to one value. Required when the path selects several numbers |
| `...output.<field>.formula` | string | Arithmetic computed in code: `+ - * /`, parentheses, numbers and answer paths (each resolving to one number); text after `;` is a comment. It must read at least one answer path: a constant, or one built only from `{name}` request values, is rejected at registration |
| `...output.<field>.how` | string | Anything else about reading the value. Shown to the model |

Find the field names you map to from the intent itself: `GET /engine/v1/intents/{intent}` returns `response.fields` (what to produce) and `request.params` (what the user sends).

An invalid mapping is rejected at registration with `intent_mapping invalid registrationId=N errors=[...]`.

### On-chain jobs and the `on_chain` block

**Jobs no longer read your `on_chain.request` or `on_chain.fields`.** When a contract creates a [job](../using/erc8183-jobs.md), the node builds your API request from the intent's inputs (the same request builder used for `ask`), and reads your answer into the intent's processed answer. The on-chain layout is fixed per intent, the same whichever miner serves it. So you do not have to map `OnChainData` arrays yourself, and your answer is delivered to the contract the same way as every other miner's.

You can still include an `on_chain` block. It is accepted for older nodes. If you keep one:

| Field | Required | Description |
|---|---|---|
| `on_chain.transform` | Yes (if `on_chain` is present) | `"direct"` or `"llm"` |
| `on_chain.min_price_usdc` | No | Floor price for x402 payment gating (for example `0.01`) |
| `on_chain.fields.strings[]`, `integers[]`, `bools[]` | Varies | Legacy field extraction into `OnChainData` |
| `on_chain.request[]` | No | Legacy mapping of `OnChainData` onto your HTTP request. Not used for jobs |

### Operational Settings (Optional)

```yaml
rate_limit_per_sec: 5         # Max upstream requests per second (0 = unlimited)
cache_ttl_sec: 0              # Response cache TTL in seconds (0 = no cache)
circuit_threshold: 5          # Consecutive failures before circuit breaker opens
circuit_cooldown_seconds: 30  # Seconds before retry after circuit opens
```

## Complete Example

A full example for a media authenticity miner (Bittensor SN34 BitMind). Its intents are the `_GENERAL` children of the judgment families:

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

rate_limit_per_sec: 5
circuit_threshold: 5
circuit_cooldown_seconds: 30

endpoints:
  - path: /detect-image
    external_path: /detect-image
    method: POST
    description: Detect whether a supplied image was AI-generated or authentic.
    intents: [DEEPFAKE_DETECTION_GENERAL, MEDIA_AUTHENTICITY_CHECK_GENERAL, IMAGE_VERIFICATION_GENERAL]
    multipart_fields: [image]
    params:
      multipart:
        required:
          - name: image
            type: string
            intents: ["*"]
            description: "The image to classify, as a multipart file part. JPEG or PNG, up to 10 MB."

  - path: /detect-video
    external_path: /detect-video
    method: POST
    description: Detect whether a supplied video was AI-generated or authentic.
    intents: [DEEPFAKE_DETECTION_GENERAL, MEDIA_AUTHENTICITY_CHECK_GENERAL, VIDEO_VERIFICATION_GENERAL]
    multipart_fields: [image, video]
    params:
      multipart:
        required:
          - name: video
            type: string
            intents: ["*"]
            description: "The video to classify, as a multipart file part. MP4, up to 50 MB."

semantics:
  signal_mapping:
    confidence_field: confidence
    label_field: isAI
    reason_field: explanation
  supported_intents:
    - DEEPFAKE_DETECTION_GENERAL
    - MEDIA_AUTHENTICITY_CHECK_GENERAL
    - IMAGE_VERIFICATION_GENERAL
    - VIDEO_VERIFICATION_GENERAL
```

## Validation Before Registration

Registration is on-chain and cannot be edited, so validate your YAML first.

Use **[integrate.telegraphprotocol.com](https://integrate.telegraphprotocol.com)**. Paste your YAML, supply your API key if your endpoints need one, and it sandbox-tests every declared endpoint against your real upstream API and reports pass or fail for each. It then pins the YAML and registers it for you.

The same check is available over HTTP: `POST https://integrate.telegraphprotocol.com/api/validate`, no auth, no wallet. Full contract: [Validation API](validation-api.md).

Validation catches the mistakes that are expensive to fix later: a schema violation, an endpoint that doesn't respond, or an auth setup that doesn't actually authenticate. It also applies the **request-contract checks** (at least one endpoint with `intents`, a `description` on every endpoint, a non-empty `supported_intents`) using exactly the rules registration uses.

Two results are worth reading rather than skimming:

- **`warnings`** never blocks registration, but it is where "this endpoint declares no `params`" appears.
- **`auth_applied`**, on each endpoint result, is the exact credential the sandbox sent, with the secret masked. If your upstream returns `401` while the same key works from your own machine, compare it against what your API expects. It is the fastest way to spot a missing or doubled `Bearer ` prefix.

## Common Validation Failures

| Error | Fix |
|---|---|
| Missing `base_url` | Add a `base_url` starting with `https://` |
| `slug` not kebab-case | Use lowercase letters and hyphens only |
| Invalid `auth.type` | Must be `bearer`, `header`, or `none` |
| Missing `supported_intents` | Add at least one canonical **intent** |
| `a prefix is not an intent` (at registration) | You listed a family such as `FX_NOW`. List its intents, for example `FX_NOW_EUR` |
| `unsupported intent` (at registration) | The intent is not canonical. Check `isCanonicalIntent`, or propose it |
| `no endpoint declares any intents` | No endpoint has an `intents:` list, so nothing can route to you. Add it to the endpoint(s) serving your `supported_intents` |
| `endpoint X has no description` | Every endpoint needs a `description:` |
| `endpoint X declares intent Y not listed in semantics.supported_intents` | An endpoint claims an intent the miner never declared. Add it to `supported_intents`, or remove it from the endpoint |
| `intent_mapping invalid ... formula reads no value from the miner's answer` | A `formula` uses only numbers or `{name}` request values. Make it read a path in your answer |
| Invalid `signal_mapping` | Must use only `confidence_field`, `label_field`, and `reason_field` |
| `endpoints.N: Additional property X is not allowed` | An `endpoints[]` entry has a key outside the ten listed above. Most often `input_schema` or `output_schema`: move them to the top level |
| `(root): Additional property X is not allowed` | A top-level key isn't in the field reference. The schema accepts no custom fields |
| `semantics.signal_mapping: Additional property type is not allowed` | Remove `type` |
| Hash mismatch on registration | YAML content changed after you computed the hash. Recompute |

Every row above is a real validator error string, so searching this page for the text in your rejection reason will land on the fix.
