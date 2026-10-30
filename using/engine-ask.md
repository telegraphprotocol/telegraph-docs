---
description: Request intelligence from Telegraph. Send a question, use a typed capability, or call a specific Miner directly.
---

# Make a Request

The Engine is Telegraph's intelligence coordinator. You send it a question; it picks a Miner, calls that Miner, and returns the result with routing and cost metadata. You never manage Miner endpoints, API keys, or schemas yourself.

There are three ways to ask:

- **Auto-routed, plain language.** You describe what you want and the Engine classifies it and selects the best miner.
- **Auto-routed, canonical.** You name the [intent](intents.md) and send typed `params`. The node validates them before anything is charged.
- **Direct.** You already know which miner you want, so you skip routing and call it by ID, with either the miner's native request or the same canonical `intent` + `params`.

All of them are paid per call, via x402 or from your [escrow](escrow-inference.md). All of them request **fresh, on-demand intelligence**, not a cached result.

> The Engine is not the Daemon. The Engine answers your questions on demand. The Daemon is a separate background service that generates its own questions on a schedule and stores them for the dashboard; see [Read the Daemon Feed](daemon-signals.md). If you want a live answer to your own question, use the Engine.

**Engine base URL (testnet):** `https://devnode.telegraphprotocol.com/engine`

> **A note on naming:** parts of the Telegraph API still use `subnet` in field names (`subnet_id`, `subnet_name` on the [Daemon](daemon-signals.md) and [WebSocket](websocket-signals.md) signal feeds) and tool names (the `tg_engine_*_subnet` [MCP tools](mcp-server.md)). This is legacy naming from when every provider was a Bittensor subnet. Today any provider integrated via YAML is a **miner**. Read `subnet` as "miner" wherever you see it.

## Auto-Routed Ask

Send a natural-language query and let the Engine choose the miner:

```
POST /engine/v1/ask
Content-Type: application/json

{
  "query": "What is the current weather in London?"
}
```

| Field | Required | Description |
|---|---|---|
| `query` | Yes, unless you send `intent` + `params` | Natural-language question. The router classifies it into an Intent and picks a miner. |
| `intent` | With `params` | The Intent the request is for. See [Canonical ask](#canonical-ask-intent-params). |
| `params` | With `intent` | The request's typed params, as the Intent's input schema defines them. |
| `context` | No | Object merged into the routed request body. Use it to pass structured hints the miner understands. For an Intent with an input schema, keys that match the schema's params also stand in for params. |

The endpoint is gated: your first request returns a `402 Payment Required` challenge. Complete the payment and retry exactly as described in [Pay per Request (x402)](x402-inference.md), or pay from escrow with [`scheme: "escrow"`](escrow-inference.md).

**Response shape (illustrative):**

```json
{
  "miner_id": "<selected-miner-id>",
  "miner_name": "<selected-miner-name>",
  "endpoint": "/<selected-endpoint>",
  "result": { "<intent-field>": "<value>" },
  "result_shape": "intent",
  "format_version": 1,
  "field_status": { "<intent-field>": "ok" },
  "input": { "<request-param>": "<value>" },
  "input_schema_version": 1,
  "cost_usd": 0.01,
  "duration_ms": 412,
  "timestamp": "2026-10-30T00:00:00Z",
  "reasoning": "Why the router selected this miner.",
  "intent": "<matched-intent>",
  "signal_hash": "0x<raw-answer-hash>"
}
```

| Field | Meaning |
|---|---|
| `miner_id` / `miner_name` | The miner that served the request: its ID (use it with `POST /engine/v1/ask/{minerId}`) and its display name. May be the fallback rather than the router's first pick. |
| `endpoint` | The upstream path that was called. |
| `result` | The answer. When the node can read it into the Intent's response format, `result` has the same keys, in the same order, whichever miner answered (`result_shape` is `intent`). Otherwise it is the miner's raw output (`result_shape` is `raw`). See [The answer's shape](#the-answers-shape). |
| `result_shape` | `intent` or `raw`. |
| `shape_error` | Why `result` is raw. Only present when `result_shape` is `raw`. |
| `format_version` | The version of the Intent's response format. Omitted when the Intent has no format. |
| `field_status` | The status of each field in `result`, in the format's order. Only present when `result_shape` is `intent`. |
| `input` | The request's params as validated: types normalised, dates in ISO form, defaults applied. Omitted when the Intent has no input schema. |
| `input_schema_version` | The version of the input schema, present with `input`. |
| `cost_usd` | What the call cost, in USD (a number). |
| `duration_ms` | Execution time in milliseconds. It excludes routing and shaping. |
| `reasoning` | Why the router chose this miner. Omitted when empty. |
| `intent` | The Intent the request was matched to. |
| `signal_hash` | The hash the **raw** miner answer was recorded under. Look it up at `GET /engine/v1/signal/{hash}`. Omitted when the ask failed. |
| `warnings` | Advisory notes, for example your body is larger than the miner declared it accepts. The request still ran. Omitted when empty. |

> **Changed in V2.** Before V2, `result` was always the miner's raw output and a separate `parsed` object held any extracted fields. `parsed` is gone; the same information is now `result`. If your code reads the miner's own JSON out of `result`, read the Intent's fields instead, or branch on `result_shape == "raw"`.

### Errors before payment

These are answered before any payment is taken, and nothing is charged:

| Status | Body | Meaning |
|---|---|---|
| `400` | `{"error": "invalid request body"}` | The body is not one JSON object with a non-empty `query`, or an `intent` with `params`. A `message` field says which. |
| `400` | `{"error": "invalid_params", ...}` | `params` do not pass the Intent's input schema. See [Canonical ask](#canonical-ask-intent-params). |
| `400` | `{"error": "no_input_schema", ...}` | You sent `params` for an Intent that has no input schema. Send a free-form `query`. |
| `429` | `{"error": "too many requests, slow down"}` | One client asked about too many **new** questions in a minute (default 60). A question quoted in the last 3 minutes is never refused this way. Wait and retry. |
| `503` | `{"error": "extraction_unavailable", ...}` | The node needed its parser model to read or complete your params and it is off, down or slow. Retry, or send `intent` + `params`. |
| `503` | `{"error": "no_compatible_miner", ...}` | No live miner can take the params, or the Intent you named is served by no live miner right now. It is never served by another Intent's miner. |
| `503` | `{"error": "could not route this question now, try again later"}` | No miner can take the question now. |

### The answer's shape

Different miners for the same Intent answer in different formats. So that your code reads one shape, a node that runs the response parser reads the miner's answer into the Intent's **response format** and returns it as `result`. Every field of the format is read from the answer and the keys are the same whichever miner answered.

A format is an ordered list of fields, each with a name, a description, a type (`number`, `integer`, `string`, `enum`, `bool`, `date`, `datetime`, `list`, `object`) and, where relevant, a unit, a plausible range, the allowed values of an enum, or the texts that mean true and false. Read an Intent's format from `GET /engine/v1/intents/{intent}` (`response.fields`).

How a field is read depends on the miner mapping and the intent format. The node
can extract values into the published shape and reject values it cannot read or
type-check. A shaped result is not an independent verification that a miner's
underlying claim is true; consumers whose decisions require that guarantee must
use an intent and delivery path that provide it.

A field marked **processed** is not copied but worked out for your request: a total over your window, a maximum, whether a reading crosses your threshold. The model must cite the values it used, and code checks that at least one is written in the answer itself.

```json
{
  "result": { "rate": 0.8712, "base": "USD", "quote": "EUR" },
  "result_shape": "intent",
  "format_version": 1,
  "field_status": { "rate": "ok", "base": "ok", "quote": "ok" }
}
```

| `field_status` value | Meaning |
|---|---|
| `ok` | The value was read from the answer. |
| `missing` | The answer has no such value. The field is `null`. |
| `rejected` | The model's reply was unusable: not present word for word in the answer, the wrong type, out of range, or not an allowed value. The field is `null`. |
| `unavailable` | The parser did not answer in time or is down. |

The keys are always all present, in the format's order.

When the node cannot produce the shape, `result` is the miner's raw output, `result_shape` is `raw`, and `shape_error` says why:

| `shape_error` | Meaning |
|---|---|
| `parser_off` | The node does not run the parser. |
| `no_format` | The Intent, and the family it inherits from, has no response format. |
| `parser_unavailable` | The parser did not answer for any field (down, timed out, or the answer was too long). |
| `no_fields_found` | The parser answered, but no field could be read from the answer. |
| `answer_unreadable` | The miner's answer could not be rendered as text for the parser. |

Shaping never changes the status code or what you pay: a raw fallback still returns `200` and still settles. What is stored and signed is always the miner's **raw** answer, and `signal_hash` covers it, so the shaped `result` is a convenience view of it.

Some miners declare an `intent_mapping` in their YAML. Then the node reads their answer through that mapping: each field is found at a declared path and numbers are computed in code (unit conversion, a maximum over a series, a formula) instead of by the model. The reply is the same shape either way.

## Canonical ask: `intent` + `params`

An intent with a published request schema has one canonical set of params. It is
the same whichever miner serves that intent, and the same off-chain and
on-chain. Read the selected intent first:

```bash
curl https://devnode.telegraphprotocol.com/engine/v1/intents/CRYPTO_PRICE_USD
```

```json
{
  "intent_id": "CRYPTO_PRICE_USD",
  "class": "deterministic",
  "request": {
    "schema_version": 1,
    "params": [
      { "name": "symbol", "type": "string", "required": true,
        "description": "Asset symbol, e.g. BTC" }
    ]
  },
  "response": {
    "format_version": 1,
    "fields": [
      { "name": "price_usd", "type": "number", "unit": "US dollars",
        "description": "Current price of the requested asset, in US dollars" }
    ]
  },
  "onchain": { "ready": true }
}
```

The response is trimmed here; the live one also lists the miners and the on-chain layouts.

Then send it:

```bash
curl -X POST https://devnode.telegraphprotocol.com/engine/v1/ask \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <base64-payment-payload>" \
  -d '{"intent":"CRYPTO_PRICE_USD","params":{"symbol":"BTC"}}'
```

### What a param can say

| Key | On | Meaning |
|---|---|---|
| `name` | every param | Unique, `[A-Za-z_][A-Za-z0-9_]*` |
| `type` | every param | `string`, `integer`, `number`, `bool`, `enum`, `date` (`YYYY-MM-DD`), `datetime` (RFC 3339 with a zone, returned in UTC) |
| `required` | any | Must be present and non-empty. `""` counts as missing. An optional param sent as `""` is treated as absent. |
| `description` | any | What it means |
| `allowed` | `enum` | The values. Matched case-insensitively, returned in the schema's spelling. |
| `min` / `max` | `integer`, `number` | Inclusive range |
| `pattern` | `string` | A regular expression the whole value must match |
| `unit` | `integer`, `number` | The value's unit |
| `default` | optional params | Applied when the param is absent |
| `examples` | any | For people |

Validation is deterministic. Coercion is only ever safe: `"3"` is read as the integer `3`, `"five"` is a type error, `2.5` is never an integer, `"true"` and `"false"` are bools, `"yes"` is not. Params the schema does not have are refused (`unknown`), never silently dropped. Limits: the whole `params` object at most 16 KiB of JSON, a string at most 2000 characters, a list at most 100 items.

### How the node completes your request

1. **`intent` + `params` that cover every required param:** validated in code. **No model is called.**
2. **A free-form `query` only:** the parser model reads exactly the schema's params out of the question. It never guesses; anything the question does not state is `null`, and a free-text value that is not in the question is discarded. Then the same validation runs.
3. **`params` that are valid but incomplete, plus a `query`:** your supplied values are validated first (a wrong type or range is refused before any model is called), then the model is asked once for the missing params with your values as known facts. Your values are kept.
4. **A value in the `query` that differs from a supplied param** is refused as a `conflict`, naming both values. The node never overrides what you sent silently.
5. **`context`:** keys that match the schema stand in for params but never override explicit `params`. The whole `context` is still merged into the miner request as before.
6. **Defaults:** only the schema's own `default`s are applied. A required value is never invented.

Whether a **free-form** ask is enforced against the schema is set by the node operator (`INPUT_SCHEMA_MAPPING`: `off`, `shadow` or `on`). Explicit `params` are always validated.

### When `params` are refused

The check runs before any miner is chosen, called or paid. Nothing is charged, no payment authorization is spent and nothing is recorded.

Sending `{"intent": "YOUR_INTENT", "params": {"colour": "red"}}`:

```json
{
  "error": "invalid_params",
  "intent": "YOUR_INTENT",
  "schema_version": 1,
  "problems": [
    {"param": "example_input", "code": "missing", "message": "example_input is required (string)"},
    {"param": "colour", "code": "unknown", "message": "unknown param \"colour\"; this intent takes: example_input"}
  ],
  "message": "example_input is required (string); unknown param \"colour\"; this intent takes: example_input"
}
```

| `code` | Meaning |
|---|---|
| `missing` | A required param is absent or empty |
| `type` | Wrong type |
| `enum` | Not one of the allowed values |
| `range` | Outside `min`/`max` |
| `pattern` | Does not match the pattern |
| `unknown` | The schema has no such param |
| `size` | The whole object is over its size limit (`param` is `""`) |
| `conflict` | `params` or `context` disagree with the `query` (adds `supplied` and `stated`) |

## Direct Ask

When you already know which miner you want, call it by ID and skip routing. There are two request forms. Pick one; mixing them is refused with `400`.

### Native form: the miner's own request

You supply the miner's endpoint and payload yourself:

```
POST /engine/v1/ask/{minerId}
Content-Type: application/json

{
  "method": "POST",
  "endpoint": "/chat",
  "payload": {
    "messages": [{ "role": "user", "content": "Explain Bitcoin in one sentence." }]
  }
}
```

| Field | Required | Description |
|---|---|---|
| `method` | Yes | One of `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. |
| `endpoint` | Yes | The upstream path, for example `/chat`. Must match what the miner's YAML declares. |
| `payload` | Yes | Sent as the request body, or as query parameters when `method` is `GET`. |
| `acknowledge_warnings` | No | Run the request even when the node predicts it will fail. See [Pre-request validation](#pre-request-validation). |

The reply is the miner's raw output. It carries `result_shape: "raw"` to say so, and has **no** `reasoning` or `intent`.

```json
{
  "miner_id": "104",
  "miner_name": "litellm",
  "result": { "...miner's raw output..." },
  "result_shape": "raw",
  "cost_usd": 0.01,
  "duration_ms": 650,
  "timestamp": "2026-10-26T19:24:42Z",
  "signal_hash": "0x7a44569d..."
}
```

### Canonical form: `intent` + `params` on one miner

Send the same typed request you would send to `/ask`, but to a miner you chose:

```bash
curl -X POST https://devnode.telegraphprotocol.com/engine/v1/ask/YOUR_MINER_ID \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <base64-payment-payload>" \
  -d '{"intent": "YOUR_INTENT", "params": {"example_input": "your value"}}'
```

| Field | Required | Description |
|---|---|---|
| `intent` | Unless the miner serves exactly one Intent | The Intent. The miner must serve it. |
| `params` | Unless a `query` or `context` completes it | The Intent's typed params. Same rules as above. |
| `query` | Unless `params` are complete | A free-form question that completes missing params. |
| `context` | No | As on `/ask`. |
| `acknowledge_warnings` | No | As in the native form. |

The node maps your params onto that one miner's own API and calls it. There is **no fallback**. The reply has the same structure as the routed ask: `result` in the Intent's shape, `result_shape`, `field_status`, `input`, `intent`, `endpoint` (the one the mapping chose), `signal_hash`. Two miners with different native APIs answer the same Intent in the same structure.

Errors specific to this form, all before payment:

| Status | Body | Meaning |
|---|---|---|
| `400` | `intent_required` (with `intents: [...]`) | The miner serves several Intents and you named none. |
| `400` | `invalid_params`, `no_input_schema` | As above. |
| `404` | `miner_not_found` | The miner is not registered. |
| `429` | `too many requests, slow down` | Same limit as `/ask`. |
| `503` | `no_compatible_miner` | The miner does not serve the Intent, or none of its endpoints can take the required params. |
| `500` | Upstream failure | No other miner is tried. The body includes `miner_id` and `intent`. |

Replace `{minerId}` with a miner ID or slug from the [discovery endpoint](x402-inference.md#step-1-discover-available-miners). Miner IDs are not stable across time, so always take them from discovery rather than from an example.

Rate limits are counted per miner across the whole node, so a `warnings` entry about a rate limit usually means switching to another miner for the same Intent works better than retrying the same one.

### Pre-request validation

Before calling the miner, the node checks your request against the constraints that miner declared in its YAML: body and parameter sizes, value and count limits, and whether its call-rate allowance is already spent.

**On the direct path this stops the request**, because you named the miner and nothing else will be tried:

```json
{
  "error": "request is predicted to fail",
  "warnings": ["miner \"zeus\" has reached its rate limit; try another miner for this intent, or try again later"],
  "proceed_anyway": {
    "field": "acknowledge_warnings",
    "value": true,
    "note": "resend with this field set to run the request regardless; you are charged only if it runs"
  }
}
```

That comes back as **`422`**, and **you are not charged**. Your options:

1. Pick another miner for the same Intent (usually right for rate limits).
2. Fix the request, if the warning is about your payload.
3. Resend with `"acknowledge_warnings": true` to run it anyway.

**On the auto-routed path nothing is ever blocked.** A fallback is already lined up behind the primary miner, so warnings are attached to the response instead.

### The payment gate runs first

Payment is checked before your request is validated, except for the input checks above. An unregistered miner ID or a malformed native body can still come back as `402` rather than `404` or `400`. You are not charged for it, since payment settles only on success, but you cannot probe an endpoint's shape for free. Check your miner ID and endpoint against `/api/miners` before you build the request.

## Listing Available Miners

```
GET /api/miners
```

Returns a JSON array of every registered miner: numeric `id`, `slug`, `name`, `endpoints` (path, method, and schema), `supported_intents`, `activation_status`, and `min_price_usdc`. Filter server-side instead of fetching the whole catalog: `?intent=`, `?status=`, and `&limit=` are supported. See [Discover Available Miners](x402-inference.md#step-1-discover-available-miners) for the full field reference.

## Available Intents

See [Intents](intents.md) for how prefixes and sub-intents work, how each is scored, and how to propose one. To read the live set:

```bash
curl https://devnode.telegraphprotocol.com/engine/v1/intents
```

## Streaming over WebSocket

The same `ask` and `ask_direct` operations, including `intent` + `params`, are available over the Engine's WebSocket interface, which streams routing progress as events instead of returning a single response. See [Stream over WebSocket](websocket-signals.md).

## When to Use What

| Scenario | Use |
|---|---|
| You aren't sure which rail you want at all | [Choose a Delivery Path](inference-paths.md) |
| You want the best miner picked automatically from a plain question | `POST /engine/v1/ask` with `query` |
| You want a predictable answer shape and a request validated before you pay | `POST /engine/v1/ask` with `intent` + `params` |
| You know exactly which miner you need | `POST /engine/v1/ask/{minerId}` (native or canonical form) |
| You want to understand the payment flow itself | [Pay per Request (x402)](x402-inference.md) |
| You want a live stream of routing events | [Stream over WebSocket](websocket-signals.md) |
| Your smart contract needs the result on-chain | [On-Chain Jobs](erc8183-jobs.md) |
| You want to browse the Daemon's autonomously generated signals | [Read the Daemon Feed](daemon-signals.md) |
