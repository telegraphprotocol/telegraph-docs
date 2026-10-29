---
description: How the bounty board supports the Season II (H2) hackathon. Missions, app ideas, how they map to Intents, and why their bounties come first.
---

# Bounties and Season II

**Season II (H2)** is Telegraph's hackathon: teams build real apps for 15
**missions**, such as agriculture, exchanges or personal agents. Dates, tracks,
prizes and who can take part are set by the official
[Season II rules](https://hackathon.telegraphprotocol.com/rules). This page
covers only how the bounty board helps.

## How bounties help Season II

A Season II app gets its answers from Telegraph Intents. For the app to get
*good* answers, the network must rank the miners of those Intents, and for that
each Intent needs evaluation material and a judge. The bounties ask for exactly
that.

Each bounty says which Season II app ideas need its Intent, under **Who needs
it**, and carries a `mission:` label for each mission it serves. Bounties for
mandatory Intents that app ideas need, or that a Season II team needs, are
marked `priority:p1` and come first.

## Missions and Intents

A mission is an app's goal. An Intent is one reusable kind of question. A
mission is built from several Intents.

For example, an agriculture app might plan when to sell livestock from
weather, satellite and market answers. The planning is the app's own logic. The
reusable questions underneath it, such as `WEATHER_FORECAST_VERIFY` and
`SATELLITE_IMAGERY_ANALYSIS`, are Intents. An app's own logic never becomes a
new Intent.

## The map

The bounty board publishes which Intents each mission uses:

| File | What's in it |
|---|---|
| [Missions](https://github.com/telegraphprotocol/bounties/blob/main/docs/MISSIONS.md) | The 15 missions and the Intents each one starts from |
| [Intents](https://github.com/telegraphprotocol/bounties/blob/main/docs/INTENTS.md) | The Intent catalogue, in plain text |
| [Reuse map](https://github.com/telegraphprotocol/bounties/blob/main/docs/NETWORK_MAP.md) | Which Intents appear in the most missions |

The map is a starting point. An app may use any Intent that fits it.

## If you're building a Season II app

- Use Intents that already exist. See [Intents](../using/intents.md).
- If an Intent your app needs can't be ranked yet, its bounty is the place to
  help, or to ask others to.
