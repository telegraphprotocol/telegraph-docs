---
description: Upload questions with better and worse answers, or truth sources for deterministic intents, to the evaluation pool. How to sign an upload, the limits, when your rows start being used, and how their use is recorded.
---

# Contribute Evaluation Data

The **evaluation pool** is the set of questions, example answers and truth
sources the network uses to judge [scoring modules](build-a-scoring-module.md),
to rank miners on open-ended intents, and to get the reference value that
deterministic answers are checked against. Anyone with an Ethereum key can add
to it. Each upload is signed, and every row is credited to the address that
signed it.

You don't need to run a node or register anything on-chain. You sign a file of
rows and post it to a node.

## What the pool is used for

The pool holds two kinds of material (see
[How answers are scored](../using/intents.md#how-answers-are-scored)):

- **Questions with answers** serve **judgment** and **hybrid** intents.
- **Truth sources** serve **deterministic** intents and the checkable part of
  **hybrid** intents. A truth source describes a public API that answers the
  intent's question. Each epoch the node asks a few of them and checks miners
  against the result. See [Truth sources](#truth-sources-deterministic-intents).

Each row in an intent's pool is placed in one of two halves. The half is fixed
per row, and you don't choose it.

| Half | Used for | Who sees it |
|---|---|---|
| **Testing** | Deciding whether a new scoring module replaces the current one. Both are scored on the same hidden sample, and the module that orders your better and worse answers correctly more often wins. See [Stage 2 for wide adapters](build-a-scoring-module.md#stage-2-for-wide-adapters-competition-on-the-hidden-evaluation-pool). Truth sources in this half are not used. | Nobody outside the validators. It is never sent to a miner or to a module author's endpoint. |
| **Ranking** | The question miners are asked when a judgment intent is ranked each epoch, and the truth sources a deterministic or hybrid intent's reference value comes from. | Miners, since they have to answer it. |

An intent's questions are used only once the pool holds material from **at
least 5 different contributors**. Samples draw evenly across contributors, so no
single contributor can dominate a test. Truth sources have no such minimum: one
is enough for an intent to be scored.

Rows are never shown back. The endpoints on this page return counts, states and
row identities, never row content.

## What a row looks like

Upload a JSON Lines file: one JSON object per line, one intent per upload.

```json
{"prompt":"Review this Go function for bugs: func div(a, b int) int { return a / b }","chosen":"It panics when b is 0. Check b and return an error instead of dividing.","rejected":"Looks fine, no issues.","label_kind":"preference_pair","provenance":{"source_kind":"human","source_url":"https://example.com/review/123"}}
```

| Field | Required | Meaning |
|---|---|---|
| `prompt` | Yes | The question. |
| `chosen` | Depends on `label_kind` | The better answer. |
| `rejected` | Depends on `label_kind` | The worse answer. |
| `label_kind` | No | `preference_pair` (default), `ground_truth` or `graded_exemplar`. A truth source uses `truth_source` and a different row shape (see [Truth sources](#truth-sources-deterministic-intents)). |
| `intent_id` | No | If present, it must match the intent you upload to. |
| `provenance` | No | Where the row came from: `source_kind` and `source_url`. |

What each `label_kind` needs:

| `label_kind` | Needs |
|---|---|
| `preference_pair` | Non-empty `chosen` and `rejected`, and they must differ. |
| `ground_truth` | Non-empty `chosen`. `rejected` is optional; if present it must differ from `chosen`. |
| `graded_exemplar` | Same as `ground_truth`. |

**One question, one row.** The node normalises each prompt (Unicode NFC, runs of
whitespace collapsed to one space) and treats two rows with the same normalised
prompt in the same intent as the same question. The first valid upload of a
question keeps it. Later ones are marked as duplicates.

**Provenance** is recorded on each row as a class. A row with an `http(s)`
`source_url` is `attested`. A row whose `source_kind` is `llm`, `synthetic`,
`generated` or `model` is always `unverified`, whatever URL it carries. Anything
else is `unverified`.

## Signing and uploading

Uploads go to:

```
POST /api/evalpool/submissions?intent_id=<INTENT>&submitter=<your address>
```

with two headers:

| Header | Value |
|---|---|
| `X-Evalpool-Signature` | Your EIP-191 (`personal_sign`) signature of the message below, as 65-byte hex. |
| `X-Evalpool-Nonce` | A fresh value, 8 to 128 characters. Each nonce works once per signer. |

The message you sign is exactly these five lines, joined by `\n`, with no
trailing newline:

```
Telegraph eval-pool submission v1
intent_id: <INTENT>
body_sha256: <lower-case hex sha256 of the exact request body>
nonce: <the X-Evalpool-Nonce value>
chain_id: <the node's chain ID>
```

The node rebuilds this message, recovers the signer and checks that it matches
`submitter`. The body hash means the signature covers exactly the bytes you
send. The nonce stops replays, and the chain ID stops a signature being reused
on another network. On the Base Sepolia testnet node the chain ID is `84532`.

The whole flow from the command line with [Foundry](https://getfoundry.sh):

```bash
NODE=https://devnode.telegraphprotocol.com
INTENT=CODE_REVIEW
FILE=items.jsonl
ADDR=0xYourContributorAddress

BODY_SHA=$(sha256sum "$FILE" | cut -d' ' -f1)
NONCE=$(openssl rand -hex 16)
MSG=$(printf 'Telegraph eval-pool submission v1\nintent_id: %s\nbody_sha256: %s\nnonce: %s\nchain_id: %s' \
  "$INTENT" "$BODY_SHA" "$NONCE" 84532)

SIG=$(cast wallet sign --private-key "$CONTRIBUTOR_PRIVATE_KEY" "$MSG")

curl -s -X POST "$NODE/api/evalpool/submissions?intent_id=$INTENT&submitter=$ADDR" \
  -H "Content-Type: application/x-ndjson" \
  -H "X-Evalpool-Signature: $SIG" \
  -H "X-Evalpool-Nonce: $NONCE" \
  --data-binary @"$FILE"
```

Use `--data-binary`, not `-d`. `curl -d` strips the newlines, so the node hashes
different bytes than you signed and the upload fails with `signer_mismatch`.

If you have access to the node source, its `cmd/evalpool-upload` command does
the same thing: it reads the key from `EVALPOOL_PRIVATE_KEY` (or `--key-file`),
signs, and splits a large file into parts on whole lines, each part with its own
nonce. With `--kind truth_source` it uploads one truth source file instead (see
[Uploading a truth source](#uploading-a-truth-source)).

There is no fee or bond for uploading.

### The response

```json
{
  "intent_id": "CODE_REVIEW",
  "submitter": "0xabc…",
  "signed": true,
  "received": 120,
  "accepted": 118,
  "duplicate": 1,
  "rejected": 1,
  "errors": ["row 7: invalid JSON: …"],
  "curated": 118,
  "state_counts": { "admitted": 110, "rejected": 3, "superseded": 2, "quarantine": 3 }
}
```

| Field | Meaning |
|---|---|
| `received` | Rows read from the body. |
| `accepted` | Rows newly stored. Each one is then checked (see [What happens to your rows](#what-happens-to-your-rows)). |
| `duplicate` | Rows whose prompt, `chosen` and `rejected` (after normalisation) match a row already stored. |
| `rejected` | Rows refused before storage: over 64 KiB, invalid JSON, a NUL character, an `intent_id` that doesn't match, an unknown `label_kind`, or an empty `prompt`. For truth sources: a `truth_source` row with no `source` or with `prompt`/`chosen`/`rejected`, or a `source` field on any other kind of row. `errors` lists them (up to 50). |
| `curated` | State changes made by the checks that ran right after the upload. |
| `state_counts` | The whole intent's pool by state, after those checks. |

A `200` means the upload was read. Whether each row is good enough is decided
per row: look the rows up afterwards.

### Errors

Error bodies are `{"error": "<message>", "code": "<code>"}`.

| Status | `code` | Meaning |
|---|---|---|
| `400` | `missing_intent_id` / `missing_submitter` | A query parameter is missing. `submitter` is required even though the signature identifies you. |
| `400` | `bad_nonce` | The nonce is shorter than 8 or longer than 128 characters. |
| `401` | `signature_required` | The signature or nonce header is missing. |
| `401` | `bad_signature` | The signature is not 65-byte hex, or no address can be recovered from it. |
| `401` | `signer_mismatch` | The signature recovers to a different address than `submitter`. Either the wrong key signed, or the message the node rebuilt differs from the one you signed: the body bytes, `intent_id`, nonce or chain ID changed. |
| `409` | `nonce_reused` | You already used this nonce. Sign again with a new one. |
| `413` | `body_too_large` | The body is over 32 MB. Split the file on whole lines and upload each part with its own nonce. |

## Limits

These are the node defaults. A node can change them.

| Limit | Default |
|---|---|
| Request body | 32 MB |
| One row | 64 KiB |
| `prompt` length | 16 to 16,000 characters |
| `chosen` / `rejected` length | 8 to 32,000 characters each |
| Near-duplicate prompts | A prompt 85% or more similar to an existing question in the pool is rejected. |
| Rows per day | 5,000 rows or 32 MiB per contributor, per intent, per UTC day. Rows over the limit wait and are admitted on a later day. |
| Share of the pool | Once an intent's pool has 200 rows, one contributor may hold at most half of it. Rows over the cap wait until others contribute. |

The minimums are there so one question can't be split into many tiny rows.
Lengths count characters after normalisation.

## What happens to your rows

Every stored row starts in `quarantine` and is checked right after the upload,
and again at every epoch rollover.

| State | Meaning |
|---|---|
| `quarantine` | Stored, not checked yet, or waiting because of a daily or pool-share limit (`reason_code: rate_limited`). Rows held by a limit are released automatically. |
| `admitted` | Passed every check. It joins the pool at the next freeze (below). |
| `eligible` | In a frozen snapshot of the pool. Only these rows are ever used. |
| `rejected` | Failed a check. `reason_code` says which. |
| `superseded` | Another row already holds this question (`reason_code: duplicate_case`). |
| `revoked` | Withdrawn from the pool. Not used. |

Reason codes on `rejected` and held rows:

| `reason_code` | Meaning |
|---|---|
| `rate_limited` | Over the daily limit or the pool-share cap. Held, not deleted. |
| `duplicate_case` | Same normalised prompt as a row already in the pool. |
| `near_duplicate` | The prompt is too similar to an existing question. |
| `missing_field` | A field the `label_kind` needs is empty. |
| `identical_answers` | `chosen` and `rejected` are the same. |
| `unknown_label_kind` | `label_kind` is not one of the three above. |
| `too_short` / `too_long` | A field is outside the length limits. |
| `invalid_utf8` / `control_chars` | The text is not valid UTF-8, or carries control characters. |
| `schema_mismatch` | The intent's answer is a number, but `chosen` states none. |
| `malformed_payload` | The stored row could not be read. |
| `source_unparseable` / `source_no_endpoint` / `source_url_rejected` / `source_auth_unsupported` / `source_too_large` | A truth source failed a check. See [What a truth source must pass](#what-a-truth-source-must-pass). |

Truth sources skip the prompt and answer checks above. A truth source is a
`duplicate_case` when the same API call is already in the pool for the intent.

## Truth sources (deterministic intents)

A deterministic intent has one right answer: an exchange rate, a price, a
count. The network doesn't have that answer built in. It comes from **truth
sources** that contributors upload to the pool. The checkable part of a hybrid
intent works the same way.

A truth source describes one public API that answers the intent's question,
written in the same format as a [miner YAML](../miners/yaml-config.md). The node
checks it against the same schema, with the same loader, that miner YAMLs use,
so anything that is valid in a miner YAML is valid here.

A truth source is evaluation material, **not a miner**. Uploading one registers
nothing on-chain. It is never routed traffic, never ranked and never paid as a
miner. The same address can upload truth sources and run a miner.

### Writing one

```yaml
version: '1'
kind: miner
id: 0
slug: truth-frankfurter-ecb
protocol: generic
name: Frankfurter (ECB reference rates)
description: Free, public, no-key exchange-rate API serving the ECB daily reference rates.
base_url: https://api.frankfurter.app
auth:
  type: none
endpoints:
- path: /latest
  external_path: /latest?from=USD
  method: GET
  description: Latest USD exchange rate for one currency. USE THIS for FX_NOW.
  intents:
  - FX_NOW
  params:
    query:
      required:
      - name: to
        type: string
        intents:
        - '*'
        description: Three-letter target currency code (e.g. EUR, CAD, SEK).
semantics:
  supported_intents:
  - FX_NOW
```

- At least one endpoint must list the intent (or `"*"`) in `intents`.
- `id` and `slug` are required by the schema but are only labels here. They
  don't need to be unique among miners.
- Describe the parameters in `params`, as you would for a miner. The node builds
  the request from them.
- The API must need **no key**: `auth.type: none`. Keys are never stored or sent
  for a truth source.

### Uploading a truth source

Upload it to the same endpoint, signed the same way, under the intent it
answers. A truth source is one row with `label_kind: truth_source` and a
`source` field. `source` is either the YAML (or JSON) text as a JSON string, or
the document as a JSON object. The row has no `prompt`, `chosen` or `rejected`.

```json
{"label_kind":"truth_source","source":"version: '1'\nkind: miner\nid: 0\nslug: truth-frankfurter-ecb\nname: Frankfurter\nbase_url: https://api.frankfurter.app\nauth: {type: none}\nendpoints:\n- {path: /latest, external_path: /latest?from=USD, method: GET, intents: [FX_NOW], params: {query: {required: [{name: to, type: string, intents: ['*']}]}}}\n"}
```

Sign and send that line exactly as in [Signing and uploading](#signing-and-uploading).
A source that serves several intents is uploaded once per intent.

With the node source, `cmd/evalpool-upload` wraps the YAML file into this row and
signs it for you:

```bash
export EVALPOOL_PRIVATE_KEY=<contributor key>
go run ./cmd/evalpool-upload --node https://<node> --chain-id <CHAIN_ID> \
  --intent FX_NOW --kind truth_source \
  --file cmd/evalpool-upload/examples/truth_source.example.yaml
```

`--kind truth_source` is assumed for a `.yaml` or `.yml` file.

### What a truth source must pass

Each uploaded source is checked like any other row, and the result is on the row
(see [Checking your rows](#checking-your-rows)):

| `reason_code` | Status | When |
|---|---|---|
| `source_unparseable` | `rejected` | Not YAML or JSON, or not a valid miner YAML document. The error is the same one a miner YAML would get. Also used for a multipart endpoint that serves the intent. |
| `source_no_endpoint` | `rejected` | No endpoint lists the intent (or `"*"`) in `intents`. |
| `source_url_rejected` | `rejected` | `base_url` or `endpoint_base_url` is not an absolute `https://` URL to a public host. Refused: `localhost`, `*.local`, `*.internal`, cloud metadata hosts, private, loopback or link-local IP addresses, and `user:pass@` in the URL. `external_path` must be a path, not a URL. The address the host resolves to is checked again each time the source is called. |
| `source_auth_unsupported` | `rejected` | The source declares credentials: `auth.type` other than `none`, `auth.inject`, or `auth.env_var`. |
| `source_too_large` | `rejected` | Over 32 KB, or more than 32 endpoints. |
| `duplicate_case` | `superseded` | The same endpoints and parameters are already uploaded for the intent. A different `name`, `slug` or `id` does not make it a different source. |
| `rate_limited` | `quarantine` | The usual per-contributor [limits](#limits). |

### How a truth source is used

Truth sources are frozen with the rest of the pool, once per epoch (see
[When your rows take effect](#when-your-rows-take-effect)). Each epoch, for
each question of a deterministic or hybrid intent, the node:

1. Picks **up to 3** truth sources from the ranking half of the intent's active
   snapshot. The pick uses a seed derived from the epoch's ranking seed, and
   draws across contributors before it takes a second source from anyone.
2. Calls each one. The request is built from your YAML by the same request
   builder that builds miner requests.
3. Reads the value out of each answer with the node's response parser and the
   intent's answer format.
4. Takes the **median** of the values it could read (the lower of the two middle
   values when there is an even number). The sources don't need to agree.

That median is the reference every miner's answer is checked against for that
question. It is fixed once per epoch, so every miner is scored against the same
value.

A source that fails (an error status, a timeout, an answer over 1 MB, or an
answer the parser can't read) simply doesn't count toward the median.

If an intent has no truth source in the ranking half of its active snapshot, or
every source picked for a question fails, that question gets no reference. An
intent with no reference for any question is **not ranked that epoch**: its
miners keep their previous ranking and are not penalised.

**A new deterministic intent needs no code.** Once the intent has its scoring
settings on the node (its questions, comparison rule and tolerance) and at least
one truth source in an active snapshot, it is scored.

## When your rows take effect

The pool is **frozen once per epoch, at the epoch rollover**. Each frozen
snapshot is used from the epoch that starts at that rollover, and the epoch that
is already running keeps the snapshot it started with. So rows you upload during
epoch N are frozen at the rollover into N+1 and used from epoch N+1 on.

This keeps every validator scoring an epoch on the same material. You can upload
at any time; nothing is blocked while an epoch runs. Truth sources follow the
same rule: a source uploaded during epoch N is first called in epoch N+1.

A test of a new scoring module reads the snapshot that was active for the epoch
its sample is drawn from, so a test that has already been seeded keeps using the
older snapshot.

## How your rows are used, and how use is recorded

- **Testing half.** Rows are sampled to compare scoring modules. Your rows decide
  nothing on their own: a sample draws evenly across contributors.
- **Ranking half.** Each epoch, a judgment intent with an active snapshot asks
  its miners one question from this half. When at least one miner's answer to
  your question is scored, the node records the use: the epoch, the intent, the
  question, your address and which scoring module scored it. The record is
  marked final once the ranking it fed is applied. There is no public endpoint
  for this record.
- **Truth sources.** When a reference value is built from your source and at
  least one miner is scored against it, the node records the use the same way:
  the epoch, the intent, your source and your address. Only sources whose answer
  counted toward the median are recorded. The record is marked final once the
  ranking it fed is applied.

## Checking your rows

Your rows, newest first, with state and reason. No content is returned.

```bash
curl -s "https://devnode.telegraphprotocol.com/api/evalpool/submissions/mine?submitter=0xYourAddress&intent_id=CODE_REVIEW"
```

```json
{
  "submitter": "0xabc…",
  "count": 2,
  "rows": [
    { "intent_id": "CODE_REVIEW", "row_hash": "9a…", "case_id": "41…", "status": "eligible",
      "provenance_class": "attested", "quality_rules_version": "evalpool-quality-v1",
      "created_at": "…", "updated_at": "…" },
    { "intent_id": "CODE_REVIEW", "row_hash": "c0…", "case_id": "77…", "status": "rejected",
      "reason_code": "near_duplicate", "provenance_class": "unverified",
      "created_at": "…", "updated_at": "…" }
  ]
}
```

`intent_id` is optional. `limit` (default 500, at most 5,000) and `offset` page
through the list.

The pool for one intent:

```bash
curl -s "https://devnode.telegraphprotocol.com/api/evalpool/status?intent_id=CODE_REVIEW"
```

```json
{
  "intent_id": "CODE_REVIEW",
  "counts": [
    { "status": "eligible", "count": 1180 },
    { "status": "quarantine", "reason": "rate_limited", "count": 40 }
  ],
  "by_state": { "eligible": 1180, "quarantine": 40 },
  "submitters": 7,
  "eligible_submitters": 6,
  "min_submitters": 5,
  "snapshot": { "corpus_version": "5f1c…", "rows": 1180, "submitters": 6, "activation_epoch": 1043, "...": "..." },
  "active_snapshot": { "corpus_version": "a2d9…", "rows": 1104, "submitters": 6, "activation_epoch": 1041, "...": "..." },
  "current_epoch": 1042
}
```

| Field | Meaning |
|---|---|
| `counts` / `by_state` | Rows by state (and reason). |
| `submitters` / `eligible_submitters` | Distinct contributors, in total and with rows in the pool. |
| `min_submitters` | How many contributors the pool needs before it is used. |
| `snapshot` | The most recently frozen snapshot, with the epoch it is active from (`activation_epoch`). It may not be in use yet. `null` until the first freeze. |
| `active_snapshot` | The snapshot the current epoch uses. `null` when none is active yet. |
| `current_epoch` | The node's current epoch. |

`intent_id` is required here.

If your rows are `eligible` but `active_snapshot` is older than `snapshot`, they
are waiting for the next epoch. See
[Uploaded evaluation rows are not used yet](../troubleshooting.md#uploaded-evaluation-rows-are-not-used-yet).
