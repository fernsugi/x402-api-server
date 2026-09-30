# Exposure and conversion work — 30 September 2026

## What ships

- Three browser demos and runnable Node workflows: token check, ETH funding comparison, and one ParaSwap quote with gas. Default inspect mode never signs or pays.
- Recorded examples contain actual public-provider responses captured through local development payment bypass. These are labelled with their time; they are not production settlement evidence.
- Concrete query URLs in the free endpoint catalogue, workflow JSON, sitemap, and crawler instructions.
- MCP 1.0.5 adds referral headers, payment-aware tool annotations, a pinned recipient and refreshed examples.
- First-party attribution journal records visits, install link clicks, challenges, settled payments and response delivery. Raw wallet addresses, IPs, payment signatures, and arbitrary query values are excluded. Payer and browser session identifiers are HMAC pseudonyms.

## Measurement rules

Crawler probes are separate from client challenges. Mock payments never count as settlements. `test` means operator activity, not customer revenue. Install link clicks are not package installs; npm's public download figures are aggregate and delayed. Source labels can be supplied by callers, so they are hints, not verified referral identity. First/repeat payers refer to the first settlement in retained journals, not their lifetime history. A settlement and a successful response are separate events.

Analytics is disabled unless `X402_ANALYTICS_DIR` and `X402_ANALYTICS_KEY` are both configured. Journals survive a deployment only on mounted persistent storage. `fly.analytics.toml` prepares two 1GB volumes for the two existing Machines: $0.30/month storage at Fly's current $0.15/GB rate. Owner declined added storage; tracking stays disabled in this deployment. No third-party analytics account is needed. Collect private journals from every Machine before generating combined reports; they are separate storage shards, not replicated copies.

```sh
# Per-Machine report; machine IDs are from `fly machine list`.
fly ssh console --app x402-api --machine MACHINE_ID -C 'node scripts/analytics-report.js'
# Private cross-Machine aggregation: export --events from each Machine, combine
# locally, then call reportEvents from src/services/analytics.js. Never publish
# the private journal or pseudonymous identifiers as release assets.
```

## Directory audit

- Glama ownership claimed; description corrected. Previous tool inspection was 1.0.3 from March. Rebuild from current GitHub source before calling the schema refreshed.
- nohumans.directory: all 7,068 active records scanned; all eight routes already listed. Seven verified, wallet profiler failing at audit time. Existing edits are free; no new listing fee needed. Paid-verification badges are historical evidence, not proof of the refreshed release.
- Coinbase Bazaar: all 19,119 resources in the public catalogue scanned without errors; no `x402-api.fly.dev` match. Direct settlement does not submit a new indexed facilitator record. The local Bazaar schema is discoverable metadata, not a marketplace listing.
- Official MCP Registry: `io.github.fernsugi/x402-api`; npm publication must precede the version update.
- Reddit and X posting excluded by the owner. Distribution uses GitHub releases, runnable examples, video assets and existing relevant directory submissions.

## Controlled paid verification

`node examples/demo.mjs all-endpoints --pay` tests all eight routes at an unchanged total price of 0.033 USDC. Owner requested skipping this paid check. It requires a dedicated local client wallet and explicit spending approval. Never borrow the production settlement private key. These requests are tagged `test`; their settlement is not organic sales.

## Success criteria

Count first paid calls and repeat observed payers by source after publication. Compare settled revenue with operating cost. More listings, visits or downloads alone do not prove more customer demand. Follow provider and directory failures before spending on promotion.

Primary references: [Fly storage pricing](https://docs.fly.io/about/pricing/), [nohumans seller API](https://api.nohumans.directory/llms.txt), [Glama methodology](https://glama.ai/mcp/methodology), [Coinbase discovery API](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/list-x402-resources).
