# Telegraph Docs

The documentation for the [Telegraph Protocol](https://telegraphprotocol.com), published at **[anjoman.ai/docs](https://anjoman.ai/docs)**.

This repository holds the content only: Markdown pages and the table of contents (`SUMMARY.md`). There is nothing to build here. Merging to `main` publishes the change to the live site.

## What is covered

| Path | Content |
|---|---|
| `introduction.md`, `whats-new-v2.md` | What Telegraph is, and what changed in V2 |
| `using/` | How to discover intents, make a request, pay for it, and receive the result |
| `miners/` | How to run a miner: YAML configuration, the validation API, registration |
| `scoring/` | How to build, train and register an evaluator adapter, and contribute evaluation data |
| `bounties/` | Contributing through bounties: your first bounty, evaluation material, rules and rewards |
| `protocol/` | How the protocol works: tokenomics, roles, addresses and parameters |
| `SUMMARY.md` | The table of contents. It sets the sidebar order and which pages are published |

## Contributing

### Suggest an edit
Every page on the site has a **Suggest an edit** button. It opens that page's file in GitHub, where you can propose a change and open a pull request.

### Larger changes
1. Create a branch, or fork the repository.
2. Edit or add Markdown files.
3. Open a pull request against `main`.
4. A code owner (see [`.github/CODEOWNERS`](.github/CODEOWNERS)) reviews it.
5. After the merge, the change appears on the site within a few minutes.

## Writing pages

- **Publish a page by listing it in `SUMMARY.md`.** A file that is not listed is not published. Add it as `* [Title](section/page.md)` under a `##` section, and indent two spaces to nest it.
- **Use relative `.md` links** between pages, for example `[Intents](../using/intents.md#reading-the-catalog)`. Do not link to site paths such as `/using/intents`.
- **Give every page a `description`** in its front matter, and start the body with a single `#` heading. The page title comes from that heading.
- **Write pages that stand on their own.** A reader should be able to understand, build and troubleshoot from the page without outside help.

Two extras are supported:

- **Callouts:** a blockquote that starts with `> [!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!DANGER]` or `[!IMPORTANT]`.
- **Link cards:** a table whose first header cell starts with `I want to` becomes a grid of cards. The first column is the label and the second is the link.

## How publishing works

When a pull request is merged to `main`, a workflow first checks that every page listed in `SUMMARY.md` exists and is a `.md` file, and then publishes the docs to the site. A pull request that lists a missing page will break that check, so test your links before you merge.

The old address `docs.telegraphprotocol.com` redirects to [anjoman.ai/docs](https://anjoman.ai/docs).

## Related repositories

| Repository | Purpose |
|---|---|
| [telegraphprotocol/Telegraph](https://github.com/telegraphprotocol/Telegraph) | Protocol node source code (private; request access) |
| [telegraphprotocol/Telegraph-api-docs](https://github.com/telegraphprotocol/Telegraph-api-docs) | OpenAPI specs and API reference |
| [telegraphprotocol/Telegraph-MCP](https://github.com/telegraphprotocol/Telegraph-MCP) | MCP server for AI agents |
| [telegraphprotocol/bounties](https://github.com/telegraphprotocol/bounties) | Public bounty board, intent catalogue and mission map |
