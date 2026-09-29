# Revival review — 29 September 2026

## Workspace

- `x402-api-server`: paid HTTP API and landing page. This is the live product's source repo.
- `x402-api-mcp-server`: MCP wrapper with eight tools.
- `x402-api-integrations/elizaos-plugin`: separate multichain package. This folder has no Git repository in the current workspace.
- `awesome-x402-servers`: a separate fork branch with an unmerged listing, now updated locally. Do not confuse it with the published `xpaysh/awesome-x402` entry.

## What changed locally

| Paid route | Live source | Important limit |
|---|---|---|
| price feed | CoinGecko, then CoinLore | Movers come from a selected asset set or CoinLore's top 100 |
| gas tracker | Public Ethereum, Base, Arbitrum, Polygon RPCs | Gas units are estimates; unavailable chains are reported |
| DEX quotes | ParaSwap | One aggregate route, not independent DEX quotes |
| token scanner | GoPlus | Heuristic flags, not an audit; missing fields are null |
| whale tracker | GoPlus | Top-holder sample; no Gini or transfer history |
| yield scanner | DefiLlama | Provider-reported APY; no safety rating |
| funding rates | Hyperliquid and dYdX v4 | Current versus predicted rates; spreads exclude fees and basis risk |
| wallet profiler | Blockscout; limited public RPC fallback | Priced balances only; RPC fallback sees native coin and USDC |

All routes now validate and load available live data before the payment middleware. If an upstream fails, the API returns 503 without a payment response. Responses disclose source, cache state, and partial coverage where relevant. The landing page and Bazaar discovery examples were updated to match the live response shapes.

The MCP and two ElizaOS clients sign the API's Base USDC EIP-3009 challenge with a default 0.01 USDC per-call cap. The multichain package still supports manual payments on its configured chains; automatic payment to this API uses Base only. Legacy transaction-hash proof is disabled by default to avoid replay after ephemeral storage loss. The server now requires an explicit `X402_SETTLEMENT_PRIVATE_KEY` for direct settlement.

## Discovery and revenue

- [Base Blockscout's incoming token-transfer history](https://base.blockscout.com/address/0x60264c480b67adb557efEd22Cf0e7ceA792DefB7?tab=token_transfers) for the configured payee showed 294 Base USDC `transferWithAuthorization` receipts totaling **1.249 USDC** from 20 March through 26 September 2026 (queried 29 September; seven API pages, 301 incoming token transfers scanned). This is gross on-chain wallet inflow, not net profit. The chain alone cannot attribute every receipt to this API, and Fly logs do not cover the full period. The new structured settlement log will support route-level attribution going forward.
- Confirmed public listings: `xpaysh/awesome-x402`, the official MCP Registry, Glama, PulseMCP, 24K Labs, VerifyMCP, 402radar, and npm `@x402-api/mcp-server`. The MCP npm package and official Registry both serve 1.0.4 as of 29 September 2026. Third-party directories may still show older metadata until they recrawl.
- API 1.0.3 was deployed to Fly on 29 September 2026. `/.well-known/x402`, `/openapi.json`, catalog links, and the domain registration file are live. Free health/catalog routes returned 200; all eight paid routes returned 402 with v1-discoverable schema in an unpaid production smoke test. No real paid request was made.
- Release versions: API 1.0.3 is live on Fly; MCP 1.0.4 and embedded ElizaOS plugin 1.0.2 are published on npm. The official MCP Registry entry is 1.0.4.
- Base Agent #18763 is real and owned by the receiving wallet, but `tokenURI(18763)` is an embedded Base64 `data:` URI containing the old web and x402 root links. A server deploy will update the domain verification file, not that on-chain snapshot. Publishing the new OpenAPI link on-chain requires the owner's `setAgentURI` transaction.
- The x402 v1 Bazaar field was malformed: `accepts[].outputSchema` held only the v2 output block. It now includes HTTP input, GET method, query parameters, and an example output. The official v1 extractor recognizes all eight routes. The self-hosted `/api/bazaar` catalog does not itself create an external Bazaar listing; facilitator indexing requires a compatible settled request.
- Each successful non-mock settlement now writes a structured `x402_payment_settled` log with route, micro-USDC amount, and transaction hash. Use that together with 402 request counts and 503 counts to measure which routes convert and where provider failures lose sales. Do not change prices until this data shows demand by route.
- The old paid smoke script depended on `x402-fetch` and its large vulnerable dev tree. It now signs this API's exact x402 v1 EIP-3009 challenge using `viem`, verifies recipient and a 0.01 USDC cap, and was exercised against a local fake server with signature verification. API and MCP locks return zero findings from full `npm audit`; the embedded ElizaOS plugin has zero production findings (`--omit=dev`).
- The unpublished multichain ElizaOS plugin still has 10 production audit findings in its Solana dependency tree (6 moderate, 4 high). `npm audit fix` cannot resolve them within compatible ranges; its suggested forced downgrade would break the plugin. Do not publish that package until the Solana dependencies and payment path are migrated and retested.
- The multichain ElizaOS package is distinct from the embedded Base plugin and is not published on npm. Preserve its source.
- Removed four generated `node_modules` folders (about 2.5 GB total) and workspace Finder `.DS_Store` files. Package locks and build outputs remain. Run `npm ci` in a package before its next local build or test.

## Verification

- API: five automated tests for payment gating, agent discovery, invalid input, legacy proof rejection, and wallet RPC fallback.
- MCP: a fake-server test signs a Base USDC challenge through an actual MCP tool call.
- Embedded ElizaOS plugin: fake-server signature and cap test.
- Multichain ElizaOS package: fake-server signature and cap tests.
- Eight routes were smoke-tested with local development mock payments and live public providers. Price feed used CoinLore when CoinGecko returned 403. The wallet route succeeded with Blockscout and its RPC fallback has a stubbed test.
- No real USDC payment was performed. The API production deployment, unpaid live smoke test, npm publication, and official MCP Registry update passed.

## Release gates

1. The Fly app has deployed `X402_SETTLEMENT_PRIVATE_KEY` and `X402_SETTLEMENT_MODE` secrets; their values were not read. Confirm a real EIP-3009 settlement with the dedicated test wallet before treating the paid flow as verified.
2. Review client usage before deploying: legacy `txHash` proofs are disabled by default. Enable them only with a durable `X402_DATA_DIR` shared across every instance.
3. Run one controlled mainnet EIP-3009 paid smoke test using a dedicated wallet after the deployment configuration is confirmed. `npm test` is free; `npm run test:eip3009` spends real USDC.
4. API deployment and the MCP and embedded ElizaOS package releases are complete. Keep their schemas and clients aligned in future releases.
5. Replace the DefiLlama legacy `/pools` source before **13 November 2026**. [DefiLlama says the free endpoint stops then](https://newsletter.defillama.com/p/your-exchange-s-numbers-might-not-be-real-here-s-how-to-check); later access requires an API plan or a different public source.
6. Plan a separate x402 v2 migration and client compatibility test. This server currently speaks its legacy JSON x402 v1 challenge.
7. MCP package 1.0.4 and the official MCP Registry update are complete. Revalidate the manifest when publishing a future version.
8. After the new discovery URLs are live, update Agent #18763's on-chain `agentURI` from the owner wallet if desired. This is an on-chain transaction and was not attempted.
