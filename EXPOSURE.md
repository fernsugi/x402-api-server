# Exposure and conversion work — 30 September 2026

## Published result

| Surface | Result |
| --- | --- |
| Production API | 1.0.5 deployed to the existing Fly app; health check passed |
| Workflow demos | [Three public demos](https://x402-api.fly.dev/demos/), with runnable examples and explicit workflow budgets |
| Walkthrough videos | Three 18-second MP4 assets on [API release 1.0.4](https://github.com/fernsugi/x402-api-server/releases/tag/v1.0.4) |
| MCP package | [@x402-api/mcp-server 1.0.5](https://www.npmjs.com/package/@x402-api/mcp-server) published |
| Official MCP Registry | [io.github.fernsugi/x402-api 1.0.5](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.fernsugi%2Fx402-api/versions/1.0.5) published |
| GitHub | [API PR 12](https://github.com/fernsugi/x402-api-server/pull/12) and [MCP PR 5](https://github.com/fernsugi/x402-api-mcp-server/pull/5) merged; descriptions, topics and demo homepages updated |

Registry publication now uses scoped GitHub OIDC through a release workflow, without a permanent publisher secret. [Initial publication](https://github.com/fernsugi/x402-api-mcp-server/actions/runs/36681576179) succeeded; the [release-triggered repeat](https://github.com/fernsugi/x402-api-mcp-server/actions/runs/36682070030) also succeeded and skipped the existing version.

## What ships

- Three browser demos and runnable Node workflows: token check, ETH funding comparison, and one ParaSwap quote with gas. Default inspect mode never signs or pays.
- Recorded examples contain actual public-provider responses captured through local development payment bypass. These are labelled with their time; they are not production settlement evidence.
- Concrete query URLs in the free endpoint catalogue, workflow JSON, sitemap, and crawler instructions.
- MCP 1.0.5 adds referral headers, payment-aware tool annotations, a pinned recipient and refreshed examples.
- Optional first-party attribution journal can record visits, install link clicks, challenges, settled payments and response delivery. It remains disabled in production at the owner's request. Raw wallet addresses, IPs, payment signatures, and arbitrary query values are excluded from that journal. Payer and browser session identifiers are HMAC pseudonyms.

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

- [Glama](https://glama.ai/mcp/servers/fernsugi/x402-api-mcp-server): ownership claimed, description and environment configuration corrected, repository synced, build and release succeeded. The running server reported MCP 1.0.5 and all eight tools; the public schema now shows the corrected descriptions. Glama's own release label increments independently of the npm package version. Its historical tool-quality score was not refreshed by this build.
- nohumans.directory: all 7,068 active records scanned; all eight routes already listed. All eight listings claimed and their names, descriptions, categories and response schemas corrected. Free recorded previews are explicitly historical; generic catalogue pages were removed as alleged response samples. No new listing fee paid.
- Seven directory listings were verified at the audit. The [wallet listing](https://nohumans.directory/l/1a3a97e9-b01) remains failing: the 16:16:48 JST probe on 30 September recorded its twentieth consecutive failure and a score of about 0.122. Its public record does not disclose the individual failure reason. CDP independently reproduced a ten-second timeout on the same URL, revealing a slow provider path missed by our earlier checks. API 1.0.5 now bounds each chain lookup to six seconds and cancels slow requests; partial coverage is disclosed. The external CDP validation request subsequently completed in 5.361 seconds and passed reachability, HTTP 402 and JSON checks. Directory reputation recovery still requires successful independent probes. Next check was due by 18:16:48 JST under its two-hour tier.
- The directory's paid-verification badges date to 20 August 2026. They are historical evidence, not proof of this release. Its on-chain figures are shared receiving-wallet totals across eight listings; do not add them together or attribute them to one endpoint.
- Coinbase Bazaar: all 19,119 resources in the public catalogue scanned without errors; no `x402-api.fly.dev` match. The current merchant lookup also returns zero resources for our receiving wallet. CDP's free validator specifically rejects x402 v1 and requires v2 for new Bazaar discovery. After a compatible migration, indexing requires a successful settlement through CDP; our existing direct settlement does not submit that record. There is no separate registration form. The local Bazaar schema is discoverable metadata, not a marketplace listing. See [Coinbase's current seller guide](https://docs.cdp.coinbase.com/x402/seller/get-discovered).
- Official MCP Registry: `io.github.fernsugi/x402-api` is now 1.0.5, matching npm.
- The existing [awesome-x402-servers submission, PR 7](https://github.com/fffilimonov/awesome-x402-servers/pull/7), now includes the refreshed tools, workflow demos and video release. It is mergeable but remains open. Our account has only read permission on the upstream repository, whose maintainer controls merging.
- Reddit and X posting excluded by the owner. Distribution uses GitHub releases, runnable examples, video assets and existing relevant directory submissions.

## Controlled paid verification

`node examples/demo.mjs all-endpoints --pay` tests all eight routes at an unchanged total price of 0.033 USDC. Owner requested skipping this paid check. It requires a dedicated local client wallet and explicit spending approval. Never borrow the production settlement private key. These requests are tagged `test`; their settlement is not organic sales.

## Success criteria

Count first paid calls and repeat observed payers by source after publication. Compare settled revenue with operating cost. More listings, visits or downloads alone do not prove more customer demand. Follow provider and directory failures before spending on promotion.

No revenue increase has been demonstrated from this exposure work. The earlier wallet audit found 294 incoming EIP-3009 USDC transfers totalling 1.249 USDC; those are gross wallet inflows, not proven net profit or a count of API customers. Tracking remains disabled, so source conversion and repeat-use attribution are not currently measured.

## Verification and cleanup

- Nine API tests and one MCP test passed, including mocked payment signing, recipient rejection, workflow spending caps and journal behaviour. The new wallet test deliberately hangs explorer and RPC responses, checks that available Base balances survive, and confirms an all-provider failure returns 503 before payment.
- All eight live routes returned unpaid 402 challenges using valid example inputs. No real USDC was spent on the refreshed release.
- All three browser workflows were checked in inspect mode. Recorded timestamps remain visible in the compact layout, with no horizontal overflow. Videos were checked for duration and representative content.
- Temporary installed dependency folders were removed after verification; lockfiles and generated published MCP output were retained. Existing nonce data and local unpublished integration notes were preserved.

For the earlier provider and payment repairs, see [REVIVAL.md](REVIVAL.md). Remaining exposure gaps are the wallet directory failure, the unindexed Bazaar resource, and the upstream community-list review. The owner excluded Reddit/X posting, additional storage and paid verification.

The follow-up wallet fix is deployed as API 1.0.5. Its [external validation record](media/wallet-validation-1.0.5.json) is an unpaid reachability check, not a production payment test. Shorter provider deadlines may reduce balance coverage during slow upstream periods; the response reports unavailable chains and the six-second budget.

Primary references: [Fly storage pricing](https://docs.fly.io/about/pricing/), [nohumans seller API](https://api.nohumans.directory/llms.txt), [Glama methodology](https://glama.ai/mcp/methodology), [Coinbase discovery API](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/list-x402-resources).
