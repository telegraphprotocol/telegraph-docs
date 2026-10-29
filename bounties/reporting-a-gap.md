---
description: How to report a new gap so it can become a bounty — what to include, how maintainers reduce it to a reusable task, what must stay out of public Issues, and how to report security problems.
---

# Reporting a Gap

Anyone can propose a gap. Open one from the
[Issue chooser](https://github.com/telegraphprotocol/bounties/issues/new/choose)
and pick the form that fits (see [Kinds of Work](kinds-of-work.md#issue-forms)).
Every report starts as a proposal in `status:triage`.

## Before you report

- **Search** open and closed Issues first. Your gap may already be listed.
- **Start from evidence**: real demand, an observed failure, or a verified,
  time-sensitive release. Don't open an Issue just because an improvement is
  imaginable.
- **Name an existing intent.** Season II bounties use only intents that
  already exist. A gap report never proposes a new intent.

## What to include

1. What useful outcome is blocked, or what market coverage is missing.
2. Evidence that the gap is real.
3. The reusable intent or component involved, if you know it.
4. What observable result would close it.

For a new model, API or tool release, cite the official release source, use
existing intents where they fit, and define success as fair measurement, not a
particular rank.

## What happens next

A maintainer reduces the report to the **smallest reusable bounty** and checks
five things:

1. What real outcome is blocked or improvable?
2. Which reusable intent or component causes it?
3. What exactly needs to change?
4. How will completion be verified?
5. How important is it right now?

| Too broad | Good |
|---|---|
| Build an Agriculture miner. | Add independent miner supply for `WEATHER_FORECAST_VERIFY`; it currently blocks several active apps. |

Once the gap is real, distinct, reusable and verifiable, and any reward terms
are clear, the maintainer runs `/open` and it becomes claimable.

## Keep these out of public Issues

The board is public. Never post:

- customer identities, prompts, files, budgets or contracts;
- private diagnostics or monitoring thresholds;
- hidden evaluation questions, reference answers or qualification inputs;
- intent-specific evaluation weaknesses (describe evaluation gaps at **Category** level only);
- credentials, keys or exploit details.

Mark fictional examples clearly, and state funding or buyer commitments only
after they have been independently approved.

## Security problems

Report exploitable vulnerabilities, leaked secrets and bypasses **privately**,
never in a public Issue:

- email **info@telegraphprotocol.com** with the subject `[SECURITY] Telegraph vulnerability report`; or
- use the repository's **Security** tab, if private reporting is enabled.

Send only what is needed to establish impact in the first message. The team will
arrange a secure channel for the rest. A public hardening Issue can follow once
the sensitive details are removed or the problem is fixed.
