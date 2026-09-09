---
description: Validate a miner YAML, sandbox-test its endpoints and check for identity clashes over HTTP — before you spend gas registering it.
---

# Validation API

Registration is on-chain and cannot be edited. A YAML that fails schema
validation, or whose endpoints don't answer, is rejected **after** you have paid
gas — and the fix is another transaction. The validation API is how you find
that out first, for free.

This is the same check [integrate.telegraphprotocol.com](https://integrate.telegraphprotocol.com)
runs when you paste a YAML into it. The web interface is the easier path if you
have a browser; this page is the API behind it, for scripts and agents.

```
POST https://integrate.telegraphprotocol.com/api/validate
Content-Type: application/json
```

No authentication, no wallet, no gas. It runs against a live Telegraph node and
returns the node's own error strings, so a rejection here is the rejection you
would have got after paying gas.

**A clean result is not a promise of traffic.** It tells you the YAML parses,
the intents are canonical, your identity is free, and your endpoints answer. It
does not check that a request can be *built* for you — that is what
`endpoints[].intents`, `description` and `params` are for, and a YAML missing
them can validate clean and still be routed nothing, or be routed calls it then
fails. See [why those fields decide whether you get
traffic](yaml-config.md#why-description-intents-and-params-decide-whether-you-get-traffic).

## Request

```json
{
  "yaml": "version: \"1\"\nkind: miner\n...",
  "api_key": "sk-...",
  "miner_address": "0xYourWallet"
}
```

| Field | Required | Description |
|---|---|---|
| `yaml` | Yes | The **raw YAML text**, as a JSON string. Not a URL, not base64, not parsed JSON. |
| `api_key` | Conditional | The credential your upstream API needs. Required when your YAML declares auth that consumes one — `auth.type` other than `none`, or an `auth.inject[]` entry with no literal `value`. Omitting it then is a `400`. A keyless miner sends nothing. |
| `miner_address` | No | The wallet that will call `registerMiner`. Supplying it enables the [identity pre-checks](#identity-pre-checks) and lets a validated key be [staged](#what-happens-to-the-api-key) for that wallet. |

The YAML has to survive JSON string escaping intact — newlines, quotes and
backslashes and all. Don't build the body with string concatenation or `sed`;
hand it to a JSON encoder:

```bash
node -e '
const fs = require("fs");
fetch("https://integrate.telegraphprotocol.com/api/validate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ yaml: fs.readFileSync("my-miner.yaml", "utf8") }),
}).then(r => r.json()).then(r => console.log(JSON.stringify(r, null, 2)));
'
```

```python
import requests
body = {"yaml": open("my-miner.yaml").read()}
print(requests.post("https://integrate.telegraphprotocol.com/api/validate", json=body).json())
```

## Response

```json
{
  "valid": true,
  "slug": "demo-openmeteo-miner",
  "name": "Demo Open-Meteo Miner",
  "results": [
    { "path": "/forecast", "method": "GET", "status": 200, "success": true, "latency_ms": 1142 }
  ],
  "api_key_stored": false
}
```

| Field | Meaning |
|---|---|
| `valid` | Whether this YAML would be accepted. `false` means fix something before registering. |
| `slug` / `name` | Read back from the YAML — check these are the identity you meant to claim. |
| `errors` | Every reason `valid` is `false`, as strings. Omitted when there are none. |
| `results` | One entry per declared endpoint, from the sandbox run. Absent when the YAML failed schema validation, because nothing was called. |
| `api_key_stored` | The key was validated **and** saved against the wallet that currently holds this slug. See [below](#what-happens-to-the-api-key). |
| `api_key_staged` | The key was held for `miner_address` until its registration lands. Never `true` alongside `api_key_stored`. |
| `staged_until` | RFC3339 expiry of a staged key. Unclaimed rows are swept after it. |
| `conflicts` | Identity clashes that would get this registration rejected — see [Identity pre-checks](#identity-pre-checks). Only populated when you send `miner_address`. |

Each `results[]` entry:

| Field | Meaning |
|---|---|
| `path` | The endpoint's `path` from your YAML. |
| `method` | The HTTP method actually used. |
| `status` | The status code your upstream returned. |
| `success` | Whether this endpoint passed — read [what that means](#what-success-actually-proves) before trusting it. |
| `error` | Why it failed, when it did. Also carries `skipped (multipart/file upload)` on a pass. |
| `latency_ms` | Round-trip time. Useful as a rough health signal — a 20-second endpoint will time out under real traffic. |

## The two stages

Validation stops at the first stage that fails, so a schema error means you get
no endpoint results at all — fix the schema, then run it again to see them.

**Stage 1 — schema and intents.** Your YAML is checked against the integration
schema, and every intent it declares is checked against the canonical set. No
HTTP requests are made. A failure here returns `valid: false` with `errors` and
no `results`:

```json
{
  "valid": false,
  "errors": [
    "(root): version is required",
    "(root): id is required",
    "(root): slug is required",
    "(root): name is required",
    "(root): base_url is required"
  ],
  "api_key_stored": false
}
```

Every error string here is the one registration would have given you. The
[Common Validation Failures](yaml-config.md#common-validation-failures) table
maps them to fixes.

**Stage 2 — the endpoint sandbox.** Each endpoint in `endpoints[]` is called
for real, at your `base_url`, with your `api_key` injected exactly the way the
production dispatcher would inject it. Each endpoint gets its own timeout (30
seconds on the default node configuration).

The sandbox does not know your API's parameters, so it tries a small sequence
of plausible requests per endpoint and takes the first one that isn't an auth
failure. That is deliberate — it is testing reachability and credentials, not
your business logic.

### What `success` actually proves

**`success: true` means the endpoint was reachable and your credential was
accepted. It does not mean the call was correct.**

The sandbox counts anything that isn't `401`, `403` or `5xx` as a pass —
including `400` and `404`. A `400 Bad Request` still proves your API is up and
accepted your credential; it just did not like the parameters the sandbox
guessed.

The consequence is worth seeing. This YAML points at a path that does not exist
on its upstream, and it still validates clean:

```json
{
  "valid": true,
  "slug": "demo-openmeteo-miner",
  "results": [
    { "path": "/forecast", "method": "GET", "status": 404, "success": true, "latency_ms": 1194 }
  ],
  "api_key_stored": false
}
```

**Read `status` on every result, not just `success`.** A `404` here means the
`external_path` you declared is wrong, and the sandbox will not tell you so.

What each outcome tells you:

| Result | What it means |
|---|---|
| `success: true`, `status` 2xx | Reachable, authenticated, and it liked the request. |
| `success: true`, `status` 4xx | Reachable and authenticated. The sandbox guessed parameters your API rejected — expected, and not a problem to fix here. |
| `success: true`, `error: "skipped (multipart/file upload)"` | Not tested. Multipart and file-upload endpoints need real files, so the sandbox skips them and reports a pass. **You are on your own for these** — test them yourself. |
| `success: false`, `auth failed: HTTP 401` | Your credential was refused. See [Sandbox returns 401](../troubleshooting.md#sandbox-returns-401-but-the-same-key-works-from-my-machine). |
| `success: false`, `server error: HTTP 5xx` | Your upstream is broken or overloaded. Registering now means being routed traffic you can't serve. |
| `success: false`, `status: 0`, `request failed: ...` | The node never got a response — DNS, TLS, firewall, or a `localhost` address that means nothing to a remote node. `status: 0` means no HTTP exchange happened at all. |

A failed endpoint is also copied into the top-level `errors` array, prefixed
with its method and path, so a script can report everything from one field:

```json
{
  "valid": false,
  "errors": ["GET /forecast: request failed: Get \"https://not-a-real-host.example/v1/forecast\": dial tcp: lookup not-a-real-host.example: no such host"],
  "results": [
    { "path": "/forecast", "method": "GET", "status": 0, "success": false,
      "error": "request failed: Get \"https://not-a-real-host.example/v1/forecast\": ...", "latency_ms": 4 }
  ]
}
```

A private or IP-allowlisted upstream fails here for a reason that matters: the
node calling this sandbox is the same kind of host that will call you in
production. If it can't reach you, neither can the network.

## Identity pre-checks

Two things get a registration rejected that no amount of schema correctness
prevents: someone else already holds your `slug`, or your YAML `id` is already
routing traffic to another miner. Both are checked against live node state when
you send `miner_address`, and reported in `conflicts`:

```json
{
  "valid": false,
  "slug": "coingecko",
  "conflicts": [
    "slug \"coingecko\" is already served by an active registration owned by a different wallet (0xffe89e1f0a77c600ad938b57180e5be3e3119f40, registrationId=17). A slug is a miner's identity and only its owner may register it. This will NOT be retried: choose a different slug and re-submit, or have the current owner call deregisterMiner() first."
  ],
  "errors": ["slug \"coingecko\" is already served by ..."],
  "api_key_stored": false
}
```

```json
{
  "conflicts": [
    "YAML id \"900\" is already in use by active miner \"onchain-intel-miner\". Every miner needs its own id — it is the key requests are routed on, so two miners sharing one id means one of them serves the other's traffic. This will NOT be retried: pick an unused id, re-pin the YAML, and re-submit the registration with updateMiner()."
  ]
}
```

Re-registering a slug **you** already hold is not a conflict, so passing your
own `miner_address` is the point — without it the check can't tell your slug
from someone else's and is skipped entirely.

These are advisory. The chain can change between this call and your
transaction, and the check at registration remains the authority.

## What happens to the API key

If every endpoint passes and your YAML actually consumes a credential, the node
tries to keep the key so you don't have to install it separately:

- **The slug has a live registration** → the key is stored against the wallet
  holding it. `api_key_stored: true`.
- **The slug has no holder yet, and you sent `miner_address`** → the key is
  staged against that wallet and installed when a registration for this slug
  arrives *from that same wallet*. `api_key_staged: true`, with `staged_until`.
  A registration from anyone else promotes nothing, and a rejected registration
  leaves the staged key alone — so fixing the YAML and re-registering installs
  it without re-entering the key.
- **Neither** → nothing is kept. `api_key_stored: false`, and `errors` says so.
  Register first, then install the key through the signed flow in
  [Installing or rotating your API key](miner-registration.md#installing-or-rotating-your-api-key).

A staged key is inert until promoted — nothing serves it, and nothing reads it
back out.

> `miner_address` is taken at face value; no signature proves you own it. Naming
> a wallet you don't control overwrites what that wallet staged. Rotating a key
> on an already-registered miner always requires the signed challenge.

## Status codes

| Status | Meaning |
|---|---|
| `200` | The validation ran. **Check `valid` in the body** — a failed YAML is still a `200`. |
| `400` | The request itself was unusable: no `yaml` field, malformed JSON, or `api_key` missing for a YAML that declares auth needing one. |

## Worked example

```bash
$ node -e 'const fs=require("fs");fetch("https://integrate.telegraphprotocol.com/api/validate",
  {method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({yaml:fs.readFileSync("demo-miner.yaml","utf8")})})
  .then(r=>r.json()).then(r=>console.log(JSON.stringify(r,null,2)))'
```

```json
{
  "valid": true,
  "slug": "demo-openmeteo-miner",
  "name": "Demo Open-Meteo Miner",
  "results": [
    { "path": "/forecast", "method": "GET", "status": 200, "success": true, "latency_ms": 1142 }
  ],
  "api_key_stored": false
}
```

`valid: true` with every endpoint passing is your green light to
[register](miner-registration.md). Nothing else in the flow costs money to get
wrong twice.

## Validating against your own node

If you run a Telegraph node, the same validation is served locally at
`POST /miner-dispatcher/validate`, with an identical request and response body.
It is **operator-only** — it makes outbound requests to any `base_url` a caller
submits and writes caller-supplied credentials, so it requires the node's
`INTERNAL_SECRET`:

```bash
curl -X POST http://localhost:8080/miner-dispatcher/validate \
  -H "X-Internal-Secret: $INTERNAL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"yaml":"...","api_key":"...","miner_address":"0xYourWallet"}'
```

| Status | Meaning |
|---|---|
| `401` | Missing or wrong `X-Internal-Secret` |
| `503` | `INTERNAL_SECRET` is not configured on that node, so the endpoint refuses to serve at all |

A public node's `/miner-dispatcher/validate` will return `401` to you. Use
`https://integrate.telegraphprotocol.com/api/validate` instead — it is the same
check, proxied.

## Next Steps

- **[YAML Configuration](yaml-config.md)** — the field reference for what you're validating.
- **[Registering as a Miner](miner-registration.md)** — once it comes back clean.
