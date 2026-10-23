---
description: Common issues when using the Telegraph protocol and how to resolve them.
---

# Troubleshooting Common Issues

## x402 Payment (HTTP 402)

### Getting 402 errors when calling /engine/v1/ask

The x402 payment gate requires a valid USDC payment. An HTTP 402 response includes a payment challenge — you need to sign and submit the payment before retrying.

1. Ensure your wallet has **Base Sepolia USDC** (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`).
2. Get Base Sepolia USDC from the [Circle faucet](https://faucet.circle.com).
3. Use the payment flow: receive 402 challenge → sign permit → post payment → retry request.

### "invalid_exact_evm_signature" error

The EIP-712 domain name in the payment signature doesn't match. Base Sepolia USDC uses `"USDC"` (not `"USD Coin"`). Ensure your signing code uses the correct token name.

## ERC-8183 Jobs

### Job stuck in Funded state — never resolved

Jobs progress through states: Funded (`0`) → Terminal (`1`), or Cancelled (`2`).

**A job that stays Funded has failed, not stalled.** Resolution happens per job, within seconds of the miner answering — it is not batched into an epoch. If the miner is unreachable or returns an error, the listener deliberately does *not* resolve the job: there is no failed terminal state, your callback is never called, and the job sits in Funded indefinitely.

1. Check the job state on-chain. Note the doubled parentheses — `getJob` returns a struct, and without them `cast` fails with `could not decode output`:
```bash
cast call <diamond> "getJob(uint256)((address,bytes32,address,uint256,uint256,uint256,uint8,uint256))" <jobId> --rpc-url <rpc>
# (agent, intentId, callback, budget, minerPayment, protocolFee, state, createdAt)
```

2. Ensure a miner supporting your intent is registered and active.
3. Verify your job's OnChainData format matches what the miner expects:
   - `strings[0]` = model name (for LLM miners)
   - `strings[1]` onward = alternating role/content pairs for the `chat_messages` format
4. **Recover your funds with `cancelJob`.** Only the original agent can cancel, and it refunds the full budget to your escrow:
```bash
cast send <diamond> "cancelJob(uint256)" <jobId> --rpc-url <rpc> --private-key <key>
```

### Job reached Terminal but the result looks wrong

Check the output hash committed on-chain:

```bash
cast call <diamond> "getJobOutput(uint256)(bytes32)" <jobId> --rpc-url <rpc>
```

A non-zero hash means the miner answered and the job resolved. If the *content* isn't what you expected, the usual cause is an `OnChainData` layout mismatch — the response is packed at the indexes the serving miner declares in its YAML `on_chain.fields` block, not in a fixed order. Check that block for the miner that served you.

A reverting callback does not show up here: the protocol calls your callback inside `try … catch {}`, so the job reaches Terminal and the miner is paid even if delivery to your contract failed.

## Miner Registration

### "Schema validation failed"

You don't need the node's logs to read this — the full validator output is on the registration:

```bash
curl -s https://devnode.telegraphprotocol.com/api/miners/<registrationId> | jq -r '.miner.rejection_reason'
```

Your YAML file has validation errors. Common causes:

- **`Additional property X is not allowed`**: every block in the YAML is a closed set — the root, each `endpoints[]` entry, `auth`, and `semantics.signal_mapping` all reject unlisted keys. The usual culprit is `input_schema`/`output_schema` placed **inside** an endpoint; they are top-level fields. See [YAML Configuration](miners/yaml-config.md#endpoints)
- **Missing `base_url`**: Add a `base_url` starting with `http://` or `https://`
- **`signal_mapping.type` not allowed**: Remove the `type:` field. Use only `confidence_field`, `label_field`, and `reason_field`
- **`slug` not kebab-case**: Use lowercase letters and hyphens only
- **Invalid `auth.type`**: Must be `bearer`, `header`, or `none`
- **Missing `supported_intents`**: Add at least one canonical intent string

A schema failure is terminal — the node will not retry it. Fix the YAML, re-pin it, and call `updateMiner` with the new URL and hash; you do not need to register again from scratch.

Look the registration up by `registrationId`, not by slug — a by-slug lookup returns whoever is serving that slug, which after a slug clash is not you.

### "Request-contract validation failed"

Distinct from a schema failure: the YAML is structurally valid, but it does not describe how to call you. The reason names each finding.

- **`no endpoint declares any intents`** — routing selects an endpoint by intent, so an endpoint with no `intents:` can never be chosen. With none anywhere, the registration would be live and permanently unreachable. Add `intents:` to the endpoint(s) serving your `supported_intents`.
- **`endpoint X has no description`** — the request builder is handed the description to work out how to call the endpoint. Add one that says what it does.
- **`endpoint X declares intent Y not listed in semantics.supported_intents`** — the endpoint claims something the miner never declared. Add it to `supported_intents` or drop it from the endpoint.

Terminal, like a schema failure: fix, re-pin, `updateMiner`.

**Already registered before these checks?** Nothing happens to you. They apply when a YAML is registered or re-submitted, never to a miner already running — active miners keep serving, and a node restart will not deregister them. If a re-submission is refused, your **existing registration keeps serving and keeps your slug**; only the new registration is rejected, so the update simply does not take effect until the YAML is fixed.

Not rejections, but worth fixing: an endpoint with no `params` (the node then guesses your field names — the most common reason an active miner fails the calls it receives), and a single endpoint with no `intents` while others have them (that is how a utility endpoint is declared). Both come back in `warnings` from the validator.

### Sandbox returns 401 but the same key works from my machine

The validator reports the exact credential it sent. Each entry in `results[]` carries `auth_applied` — location, header name, and the value with the secret masked — and the `error` string repeats it:

```
auth failed: HTTP 401 — the node sent [header Authorization: "TES…23 (10 chars)"].
Compare this against what your upstream expects.
```

Compare that against what your API wants. The usual cause is a YAML declaring **both** a top-level `auth.type` and an `auth.inject[]` entry on the same header: the `inject[]` entry wins and the prefix from `auth.type` is dropped, so an upstream expecting `Authorization: Bearer <key>` receives a bare `<key>`. `auth_applied` flags this case as `OVERWRITTEN`.

Declare the prefix on the inject entry instead of relying on `auth.type`:

```yaml
auth:
  type: none
  inject:
    - in: header
      name: Authorization
      prefix: "Bearer "
```

The production dispatcher resolves the same conflict the same way, so this is a real failure and not a sandbox artefact.

### "credential store unreachable"

```
miner "your-slug": credential store unreachable, refusing to call upstream unauthenticated
```

The node could not read your credential from its database and declined to make the call rather than send it without auth — an unauthenticated call would burn a slot on **your** upstream's rate limit and come back `401`, which looks like the node losing your key. Transient; it clears when the database recovers. Your key is fine and does not need reinstalling.

### "slug is already served by ... a different wallet" / "YAML id is already in use"

Both are terminal identity rejections, not schema errors.

- **slug** — a slug is a miner's identity, and only the wallet holding it may register it. Choose another, or have the current owner `deregisterMiner` first. Re-registering your own slug is always fine, including `updateMiner` and taking over a slug whose holder has deregistered.
- **`id`** — requests are routed on `id`, so two miners sharing one means one serves the other's traffic. Pick an unused id, re-pin, `updateMiner`.

A rejected registration releases its slug, so the name is claimable by anyone straight away — fix and re-submit promptly.

### Miner calls go out unauthenticated

No credential is installed for that slug. The node reads **no** environment variable for miner keys, and `auth.env_var` in the YAML names nothing — it is accepted for backward compatibility and ignored. Install the key with `POST /miner-dispatcher/miners/<slug>/api-key`; see [API keys](miners/miner-registration.md#installing-or-rotating-your-api-key).

Other causes of the same symptom:

- **The key was installed before the registration was live.** It is bound to the wallet holding the slug, so there was nothing to bind it to. The endpoint returns `404` in that case; re-install after registering.
- **The slug changed hands.** A stored key is released only while the installing wallet still holds the slug. The new holder installs their own.

If the YAML uses `auth.inject[]` rather than a top-level `auth` block, an unresolved credential fails the request outright instead — the error names the injection.

### "Hash mismatch" error

The SHA-256 of your hosted YAML doesn't match the on-chain hash. Your YAML content changed after you registered. Recompute the hash and point your registration at it with `updateMiner`, which replaces the entry in a single transaction:

```bash
sha256sum my-miner.yaml | awk '{print "0x"$1}'  # recompute
cast send <diamond> "updateMiner(uint256,string,bytes32,address,uint256,string[])" \
  <registrationId> "<yamlUrl>" "<newHash>" "<feeAddress>" <minPriceUsdc> '["INTENT"]' \
  --rpc-url <rpc> --private-key <key>
```

A common cause is a trailing-newline difference between the file you hashed and the bytes your host actually serves. Hash exactly what the URL returns:

```bash
curl -s "<yamlUrl>" | sha256sum
```

### Miner stuck in pending state

Activation is **not** tied to an epoch boundary — the node activates each registration as it processes that registration's event, usually within a minute. Waiting for an epoch will not help. If you're still pending:

Ask the node about the registration directly — you don't need log access:

```bash
curl -s https://devnode.telegraphprotocol.com/api/miners/<registrationId> \
  | jq '.miner | {activation_status, rejection_reason, fetch_attempts, retrying}'
```

If it comes back `pending`, activation really is just in flight — wait. Any other status is the answer:

- `unreachable` — the YAML URL didn't answer. `retrying: true` means the node re-fetches roughly every 5 minutes, up to 5 attempts; nothing to do unless it later flips to `rejected`. Confirm the URL is publicly reachable in the meantime.
- `rejected` — terminal. A schema or hash failure does **not** leave you pending; the row is rejected and `rejection_reason` quotes the validator verbatim. Fix the YAML and call `updateMiner`.

For a hash failure specifically, confirm the SHA-256 of what the URL serves matches your on-chain `yamlHash` — `curl -s <url> | sha256sum`.

### API key update rejected

```
{"error":"signature does not match the wallet that registered this miner"}
```

The signer is not the address in the miner registry. Check which wallet owns the
slug — the challenge response tells you:

```bash
KEY_HASH=$(cast keccak "<the key you intend to install>")
curl -X POST "https://<node>/miner-dispatcher/miners/<slug>/api-key/challenge" \
  -H "Content-Type: application/json" \
  -d "{\"key_hash\":\"$KEY_HASH\"}" | jq .address
```

```
{"error":"api_key does not match the key_hash this challenge was issued for — ..."}
```

A challenge authorises exactly one key: the signature commits to its
fingerprint. Request the challenge with the `key_hash` of the key you actually
intend to install, and send that same key in the update body.

```
{"error":"key_hash must be keccak256 of the api_key you intend to install, ..."}
```

Send `{"key_hash":"0x<64 hex digits>"}` — the keccak256 of the key, never the key
itself. A `404` here usually means you called the endpoint as a `GET`; it is a
`POST`, so the fingerprint never lands in an access log.

Other `401`s mean the challenge was already used, expired (5 minutes), or was
issued for a different miner — request a fresh one. A `422` means your own
endpoints rejected the key; `results` names which, and nothing was stored, so
your previous key keeps serving. A `429` means the key was changed in the last
30 seconds; that cooldown only starts once a key is actually **stored**, so a
rejected key costs you nothing but a new challenge.

### Miner errors read `miner error N: ...` instead of `upstream error N: ...`

The miner declares an `errors:` block in its YAML, so the node surfaces the
provider's own message instead of a slice of raw response body. Miners without
that block keep the `upstream error N: <raw body>` form. Nothing is reworded in
either case — see [YAML Configuration](miners/yaml-config.md).

### Validation said `valid: true`, but my miner fails every real call

The endpoint sandbox tests **reachability and credentials, not correctness**.
Anything that isn't a `401`, `403` or `5xx` counts as a pass — including `400`
and `404`. So a YAML with a wrong `external_path` validates clean:

```json
{ "path": "/forecast", "method": "GET", "status": 404, "success": true }
```

Read `status` on every entry in `results[]`, not just `success`. A `4xx` there
means the sandbox reached your API and was authenticated, but the request it
guessed was wrong — which is expected for parameters, and a real problem for a
path. Endpoints reported as `skipped (multipart/file upload)` were never called
at all; test those yourself.

The other common cause of "registered and active, but every call fails" is a
missing `params` block. Without one the node has to guess your field names.
See [Validation API](miners/validation-api.md#what-success-actually-proves).

### Where do I check a scoring module's status?

By `registrationId`, on any node — the same three free endpoints cover every
case:

```bash
curl -s https://devnode.telegraphprotocol.com/engine/validator/v1/wasm/<registrationId>
curl -s https://devnode.telegraphprotocol.com/engine/validator/v1/addresses/<yourAddress>/wasm
curl -s https://devnode.telegraphprotocol.com/engine/v1/intents/<INTENT>/wasm
```

`ActivationStatus` is the state, `RejectionReason` says exactly which check
failed, and `EvalDetails` carries the evaluation breakdown. For a model adapter,
first look at `decision` in `EvalDetails`: `awaiting_material` means it is
pending **by design** until its intent has evaluation material (see
[A model adapter stays pending, waiting for material](#a-model-adapter-stays-pending-waiting-for-material)).
Otherwise a module that stays `pending` for a long time is usually a binary the
node cannot fetch or re-hash — check `EvalErrorCount`, which reaches `3` before
the record is rejected outright. `GET /api/wasm/<registrationId>` shows the same
record with a `stage` field and `eval` as a parsed object. Full field reference:
[Checking your module's status](scoring/build-a-scoring-module.md#checking-your-modules-status).

Remember scoring modules hash with **keccak256**, not the SHA-256 used for miner
YAMLs. A hash mismatch rejection right after registering is almost always this.

## Scoring Modules

### `zero fee address` when registering a module

`registerWasm` takes a fourth argument now — your MACHINA payout address — and
it must be non-zero:

```solidity
registerWasm(bytes32 wasmHash, string wasmUrl, string intent, address feeAddress)
```

If you are still sending the three-argument form the call fails earlier, because
that signature no longer exists on the Diamond. Either way, add the payout
address. See [Build a Scoring Module](scoring/build-a-scoring-module.md).

Modules registered before this field existed read back `address(0)` from
`getWasm`. That means no payout address was ever set for them — it does not
default to the author. Deregister and re-register to set one.

### `LibMetaTx: bad signature` on a relayed registration

The `*For` entry points (`registerWasmFor`, `registerMinerFor`,
`deregisterEntityFor`, `deregisterMinerFor`) verify an EIP-712 signature instead
of trusting the sender. In order of how often it is the cause:

1. **`verifyingContract` is not the Diamond.** It must be the Diamond address,
   not the facet you took the ABI from. This is by far the most common mistake.
2. **`chainId` does not match** the chain you are sending to (84532 on Base
   Sepolia).
3. **The nonce is stale.** Re-read `metaTxNonce(yourAddress)` right before
   signing. One counter covers all four entry points.
4. **A field was changed after signing** — including reordering a
   `supportedIntents` array, which changes the hash.
5. **You are replaying a signature.** Each one is good for exactly one call.

`LibMetaTx: signature expired` means `deadline` has passed; sign a new one. A
relay that reverts does **not** consume your nonce, so signatures you already
prepared stay valid.

### `getWasm` returns the wrong number of values

`getWasm` now returns **eight** values, with `address feeAddress` last. An ABI
still declaring seven decodes the first seven correctly and silently never sees
the payout address. Update the ABI rather than the call.

### "MiniLM rank_answer scoring modules are retired"

```
MiniLM rank_answer scoring modules are retired and are no longer accepted: …
```

The file you registered is neither a model adapter nor a comparator module
for a deterministic intent. The node no longer runs `rank_answer` modules, so
it rejects one without loading it. Register a model adapter (judgment or hybrid
intent) or a comparator module (deterministic intent)
instead — see [Build a Scoring Module](scoring/build-a-scoring-module.md).

### A model adapter stays pending, waiting for material

`EvalDetails` (or `eval` on `GET /api/wasm/<registrationId>`) shows
`decision: "awaiting_material"`, and `stage` is `awaiting_compatible_material`.
Nothing is wrong with the module: its intent has nothing fair to compete on yet.
It is not rejected, nothing is charged against its attempts, and there is no
time limit. The `reason` says which case applies:

- `no published snapshot` — the intent (or a child of the family) has no frozen
  evaluation-pool snapshot for the round yet. Material is frozen once per epoch,
  so upload some and wait for the next epoch.
- `too few distinct submitters` — fewer than 5 different contributors have
  material in the pool.
- `awaiting_seed_epoch: no confirmed epoch recorded after the latest
  registration in the round` — the sample is drawn from an epoch confirmed after
  every candidate registered. It clears when the next epoch is confirmed.
- `only N usable pairs in the sampled batch (need 10)` — too little of the
  sample could be scored.
- `intent is not on the eval-pool path` — the node does not classify the intent
  as judgment or hybrid.

Check the pool with `GET /api/evalpool/status?intent_id=<INTENT>`. Waiting
candidates are tried again when new material is frozen and after every epoch
rollover. See [Contribute Evaluation Data](scoring/contribute-evaluation-data.md).

### `lost the competition` or `rejected in competition`

A model adapter replaces the current module only by beating it on the same hidden
sample. The `RejectionReason` names the bar it missed:

- `win rate A% did not beat the incumbent (registration N) at B% by the
  replacement margin 2.00 points on the same P-pair sample` — it needed the
  current module's rate plus 2 points.
- `win rate A% on P pairs is below the absolute floor 70.00%` — this floor also
  applies to the first module for an intent.
- `child intent C of family F: win rate … is below the per-child floor 60.00%`
  — a family module must hold up on every child with 10 or more scored pairs.
- `A% vs winning candidate N at B% on the same sample` — another candidate in the
  same round won. A round has at most one winner.
- `rejected in competition for X: …` (`decision: "invalid"`) — the package failed
  to load or errored while scoring.

A rejection is final. Improve the module and register it again under its new
hash.

### `served by family K: register the adapter on K, not on its child X`

You registered a judgment or hybrid module on a child intent `X`, and the family
`K` above it already has a live module of the same class that serves `X`. Only
the family registers. Register your improved module on `K`, where it competes
against `K`'s current module on every child's data. A child registered while the
family's module was still pending is rejected this way once that module goes
live. Check with `GET /api/wasm?resolve=X`.

### `Q32.32 wide adapters are retired`, `float adapter: …` or `adapter metadata: …`

Stage 1 refused the file:

- `Q32.32 wide adapters are retired; rebuild as a float adapter (abi_version 2)`
  — the file is an adapter in the old Q32.32 format (a bare `.imwq`, a package
  exporting `imwq_*` functions, or one whose `telegraph.adapter` section says
  `abi_version` 1). Rebuild it with the current
  [adapter kit](https://github.com/telegraphprotocol/telegraph-wasm-baseline);
  see [Train a Scoring Adapter](scoring/train-a-scoring-adapter.md).
- `float adapter: no telegraph.adapter section` — you registered the raw baked
  file. Run it through the kit's `adapterbuild`, which adds the section, and
  register its output.
- `adapter metadata: built for scoring ABI version N, this node implements
  version 2`, `… declares runtime "X"; this node runs only "onnx_f32" adapters`,
  `… declares no class`, `… declares class "hybrid" but the intent is a
  "judgment" intent` (or the reverse), or `… max_tokens N is outside [1, 512]` —
  fix the section and package again.
- `float adapter: imports the host does not provide: …` — the module imports
  something outside the node's fixed sandbox (sockets, file writes, another
  import module). Rebuild for `wasm32-wasip1` without the extra dependency.
- `… not a WASI command: no "_start" function export` or `… exports
  "_initialize": a WASI reactor, not a command` — the node runs an adapter as a
  command.
- `… above this host's limit of 49152 pages (3072 MiB)` — the model needs more
  than the node's 3 GiB memory cap.
- `float adapter: N bytes exceeds the M-byte adapter limit
  (ADAPTER_WASM_MAX_BYTES)` — larger than the node allows (1 GiB by default).
  `WASM from … exceeds the 32 MB limit` means the start of the file did not
  identify it as a model adapter (no `_start` export), so the comparator limit
  applied.
- `float adapters score judgment and hybrid intents; X is a deterministic intent
  and takes a comparator module` — registered for the wrong intent.
- `adapter metadata: training record: …` — the optional `training` record is
  malformed (no `family`, empty `children`, a child that is not the family or a
  `_`-child of it, a duplicate, negative `pairs`, or `accuracy`/`spearman` out of
  range).

A model adapter must carry the `telegraph.adapter` section; a comparator module
may leave it out. See
[The telegraph.adapter section](scoring/build-a-scoring-module.md#the-telegraphadapter-section).

### Comparator module rejected

A comparator module for a deterministic intent must match the reference rule
within ±10 basis points on every test case:

- `comparator disagrees with the reference by more than ±10 bps on N of M cases;
  first: …` — the named case is the first one it got wrong, and `EvalDetails`
  lists up to five in `first_mismatches`. Common causes: treating Exact or
  PassFail as a tolerance band, passing truth and miner in the wrong order (truth
  comes first), dividing RelTol by the miner value instead of
  `max(|truth|, 1)`, or computing `difference × 10000` in 64 bits.
- `returned different results for identical inputs across two runs` — the module
  keeps state between calls. A comparator must be a pure function.
- `comparator evaluation exceeded its time budget` — it did not finish in time.
- `comparator module failed to load` — not a valid module, or it is missing
  `imw_score_deterministic`, `imw_alloc` or `imw_free`.

A rejected comparator leaves the intent on its previous module.

## Evaluation Data

### Upload refused on `POST /api/evalpool/submissions`

Errors are `{"error": "…", "code": "…"}`:

- `401 signature_required` — send both `X-Evalpool-Signature` and
  `X-Evalpool-Nonce`.
- `401 signer_mismatch` — the signature recovers to a different address than
  `submitter`. Either the wrong key signed, or the message the node rebuilt
  differs from the one you signed. Sign the sha256 of the **exact** bytes you
  send (use `curl --data-binary`, not `-d`, which strips newlines), with the same
  `intent_id`, nonce and the node's chain ID.
- `401 bad_signature` — not 65-byte hex, or no address can be recovered.
- `409 nonce_reused` — use a fresh nonce (8 to 128 characters) for every upload.
- `400 missing_submitter` / `missing_intent_id` / `bad_nonce`.
- `413 body_too_large` — the body is over 32 MB. Split the file on whole lines and
  upload each part with its own nonce.

Rows over 64 KiB, invalid JSON, or an `intent_id` that doesn't match are refused
one by one and listed in `errors`; the rest of the upload is stored. A
`truth_source` row with no `source`, or with `prompt`, `chosen` or `rejected`,
is refused the same way. See
[Contribute Evaluation Data](scoring/contribute-evaluation-data.md#signing-and-uploading).

### Evaluation rows held in quarantine or rejected

`GET /api/evalpool/submissions/mine?submitter=<yourAddress>` shows each row's
`status` and `reason_code`:

- `quarantine` with `rate_limited` — over the daily limit (5,000 rows or 32 MiB per
  intent per UTC day, by default) or over the pool-share cap. Held, not deleted:
  it is admitted automatically on a later day, or once others add to the pool.
- `quarantine` with no reason — not checked yet.
- `superseded` with `duplicate_case` — another row already holds that question.
  The first valid upload wins.
- `rejected` with `near_duplicate` — the prompt is too similar to an existing
  question.
- `rejected` with `too_short`, `too_long`, `missing_field`, `identical_answers`,
  `invalid_utf8`, `control_chars` or `schema_mismatch` — see the
  [reason codes](scoring/contribute-evaluation-data.md#what-happens-to-your-rows).
- `admitted` — fine. It becomes `eligible` at the next freeze.

For a truth source (`label_kind: truth_source`):

- `rejected` with `source_unparseable` — not YAML or JSON, or not a valid miner
  YAML document. The schema error is the same one a miner YAML would get. Compare
  it with the [example](scoring/contribute-evaluation-data.md#writing-one).
- `rejected` with `source_no_endpoint` — no endpoint lists the intent you
  uploaded it under (or `"*"`) in `intents`.
- `rejected` with `source_url_rejected` — `base_url` and `endpoint_base_url`
  must be absolute `https://` URLs to a public host: no `localhost`, `*.local`,
  `*.internal`, metadata hosts, private, loopback or link-local IPs, or
  `user:pass@`.
- `rejected` with `source_auth_unsupported` — the source declares credentials
  (`auth.type` other than `none`, `auth.inject` or `auth.env_var`). Only APIs
  that need no key are accepted.
- `rejected` with `source_too_large` — over 32 KB or 32 endpoints.
- `superseded` with `duplicate_case` — the same endpoints and parameters are
  already uploaded for that intent. A different name or slug does not make it a
  different source.

### A deterministic intent is not ranked

A deterministic intent (or the checkable part of a hybrid one) is scored against
a reference value built each epoch from truth sources in the evaluation pool.
When it gets no reference, it is not ranked that epoch and its miners keep their
previous ranking. Nothing is held against them. Validators log one of two
warnings:

- `[truth-source] no truth-source material for this intent in its active
  snapshot` — the intent has no truth source in the ranking half of the
  snapshot the epoch uses. Upload one (see
  [Truth sources](scoring/contribute-evaluation-data.md#truth-sources-deterministic-intents)).
  It is used from the epoch after the next freeze.
- `[truth-source] every sampled truth source failed` — up to 3 sources were
  picked and none gave a usable value: an error status, a timeout, an answer
  over 1 MB, a host that resolves to a non-public address, or an answer the
  node could not read. On a node, a parse failure on every source usually means
  the response parser is off (see
  [Node Setup](validators/validator-setup.md#scoring-and-evaluation-pool-settings)).

Check the pool with `GET /api/evalpool/status?intent_id=<INTENT>` and your rows
with `GET /api/evalpool/submissions/mine?submitter=<yourAddress>`.

### Uploaded evaluation rows are not used yet

Expected. The pool is frozen **once per epoch, at the epoch rollover**, and a
frozen snapshot is used from the epoch that starts then. Rows you upload during
epoch N are used from epoch N+1. The running epoch keeps the snapshot it started
with, so every validator scores an epoch on the same material. Truth sources
follow the same rule.

`GET /api/evalpool/status?intent_id=<INTENT>` shows `snapshot` (the latest frozen
one, with the epoch it is active from) next to `active_snapshot` (what
`current_epoch` uses). An intent's pool is used only once at least 5 different
contributors have material in it (`min_submitters`).

## WebSocket Signals

### WS connection drops immediately after connecting

Common causes:
- Invalid EIP-191 signature during wallet challenge
- Insufficient escrow balance — approve, then deposit USDC first:
```bash
cast send 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "approve(address,uint256)" <diamond> 1000000 --rpc-url <rpc> --private-key <key>
cast send <diamond> "depositUSDC(uint256)" 1000000 --rpc-url <rpc> --private-key <key>
cast call  <diamond> "escrowBalance(address)(uint256)" <yourAddress> --rpc-url <rpc>
```
(`1000000` = 1.0 USDC in 6‑decimal units, which is the WebSocket minimum. Skipping the approval fails with `ERC20: transfer amount exceeds allowance`.)

- Network firewall blocking WebSocket connections

### "wallet verification required for ask"

`ask` and `ask_direct` are **not** anonymous over WebSocket. Only `list_subnets` and `ping` work without a wallet. Reconnect with `?wallet_address=0x...` and complete the `auth_wallet` → `wallet_verify` handshake first.

### "insufficient escrow for delivery" on ask/ask_direct

```json
{"type":"error","data":{"message":"insufficient escrow for delivery: committed=10000 μUSDC + price=10000 μUSDC > available=15000 μUSDC"}}
```

Different from the connect-time rejection above: that gate runs **once**, when
you authenticate. `ask` and `ask_direct` additionally check escrow before
**every** call, at a flat $0.01 each, queued for deduction at the next epoch
close.

So clearing the $1.00 minimum to get connected does not buy unlimited calls —
`committed` is what this epoch has already charged you but not yet settled, and
once `committed + price` passes your available balance you get this instead of a
result. Deposit more and retry on the same connection:

```bash
cast send $DIAMOND "depositUSDC(uint256)" 1000000 --rpc-url $RPC --private-key $KEY
```

See [How `ask` and `ask_direct` are billed](using/websocket-signals.md#how-ask-and-ask_direct-are-billed).

### No signals received after subscribing

1. Verify your subscription with the `list_subscriptions` action on the same WebSocket connection — there is no HTTP endpoint for this.

2. Check you haven't hit your session `spend_limit_usdc`. When you do, the server sends a `limit_reached` message, cancels the subscription and closes the connection; you have to reconnect and resubscribe with a new limit.

3. Signals are generated by the daemon cycle and by user-initiated ask requests. The daemon runs on a configurable interval (default 30 minutes in production).

## Engine Ask Endpoint

### 404 on /v1/ask

The ask endpoint is at `/engine/v1/ask`, not `/v1/ask`. The engine routes are mounted under `/engine/`.

### Request returns null or empty

The engine classifies your query to an intent, then routes to the best-scored miner for that intent. If no miner supports the classified intent, the result may be empty. Check available intents:

```bash
curl http://<node>:7044/api/miners
```

### `422 request is predicted to fail` on /engine/v1/ask/{minerId}

```json
{"error":"request is predicted to fail","warnings":["miner \"zeus\" has reached its rate limit — ..."]}
```

The node checked your request against the miner's declared limits and expects it
to be rejected upstream, so it refused before calling out. **Nothing is charged**
— x402 settles only on a `2xx`. Either pick another miner for the same Intent,
fix the payload if the warning is about your request, or resend with
`"acknowledge_warnings": true` to run it regardless.

Rate limits are counted **node-wide per miner**, so this can fire on your first
request if other traffic already spent the allowance — and waiting may not help
as much as switching miners.

The auto-routed `POST /engine/v1/ask` never returns this: it attaches warnings to
the response and still runs, because a fallback miner is lined up behind the
primary. Over WebSocket, `ask_direct` halts with an `error` message and takes the
same `acknowledge_warnings` field, while `ask` warns on its `executing` message.

## Contract Interactions

### "Function not authorized by enough owners"

Admin functions like `diamondCut` require owner authorization before execution. Authorize first:

```bash
cast send <diamond> "authorize(string)" "<functionName>" --rpc-url <rpc> --private-key <key>
cast send <diamond> "<functionName>(...)" ... --rpc-url <rpc> --private-key <key>
```

### "Function does not exist"

The selector isn't registered on the diamond. Check which facet (if any) handles it:

```bash
cast call <diamond> "facetAddress(bytes4)(address)" <selector> --rpc-url <rpc>
```

Returns `0x0000...` if the function isn't available. It may need to be added via `diamondCut`.

### Transaction nonce errors with cast

The node may consume nonces faster than `cast send`. Retry with a delay:

```bash
cast send ... --rpc-url <rpc> --private-key <key> || sleep 3 && cast send ... --rpc-url <rpc> --private-key <key>
```
