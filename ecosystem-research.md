# x402 Ecosystem Research — Potential Customers & Partners for x402-api
**Research date:** 2026-02-23  
**Our API:** https://x402-api.fly.dev  
**Our 8 endpoints:** price-feed, gas-tracker, dex-quotes, token-scanner, whale-tracker, yield-scanner, funding-rates, wallet-profiler

---

## 📊 Ecosystem Scale (x402.org as of Feb 2026)

| Metric | Value |
|--------|-------|
| Total transactions | 75.41M |
| Total volume | $24.24M |
| Unique buyers | 94.06K |
| Unique sellers | 22K |
| Growth | 10,000%+ YoY |

The ecosystem is **real and growing fast.** Coinbase, Cloudflare, Google, Visa, Stripe, and AWS are all actively building with x402.

---

## ⚔️ COMPETITIVE LANDSCAPE — DeFi Data x402 APIs

### 🔴 Direct Competitors (most important to understand)

#### 1. CoinGecko x402 API
- **URL:** https://docs.coingecko.com/docs/x402 | https://www.coingecko.com/en/api/x402
- **Price:** $0.01 USDC per request (10x our price-feed)
- **Coverage:** Token prices, onchain token data, trending pools, search pools — 5 endpoints
- **Reach:** CoinGecko's full brand + 94.06K x402 buyers
- **How to reach:** feedback form: https://forms.gle/J2gF7sZ3PSucj8F58
- **Their gap vs us:** Only price/market data. No gas, no DEX quotes, no token security, no whale analysis, no yield scanner, no funding rates, no wallet profiler. We're 10x cheaper per call and have DeFi-specific analytics they don't touch.

#### 2. MoonMaker API (CLOSEST competitor)
- **URL:** https://api.moonmaker.cc | https://api.moonmaker.cc/llms.txt
- **Price:** $0.02–$0.10 USDC per call
- **Endpoints (11):** signal/BTC, context/BTC, regime, risk/BTC, institutions, events, market/etf, market/overview, yields, dex/alpha, defi/recommend
- **Overlap with us:**
  - `/yields` → overlaps our `/api/yield-scanner`
  - `/dex/alpha` → partially overlaps our `/api/dex-quotes`
  - `/signal` + `/regime` → no direct equivalent (we don't have signals)
  - `/risk` → partly overlaps our `/api/token-scanner`
- **Their gap vs us:** No gas tracker, no whale tracker, no wallet profiler. We're cheaper on comparable endpoints. They focus on *trading signals*; we focus on *raw data*.
- **How to reach:** GitHub or the API's feedback channels (no public GitHub repo found yet)
- **Differentiation:** MoonMaker is opinionated (signals/recommendations); we're raw data for agents to reason over themselves.

#### 3. Alfred's Digital Bazaar / httpay.xyz
- **URL:** https://httpay.xyz | https://github.com/Alfredz0x/alfreds-digital-bazaar
- **Price:** $0.001–$0.01 USDC per call
- **Scope:** 186 endpoints including some DeFi (funding rates, liquidation sentinel, yield pool watcher, token holder monitor, DEX quotes, bridge routes, MEV scanner, approval auditor)
- **Overlap:** High on DeFi endpoints — overlaps our funding-rates, whale-tracker, yield-scanner, token-scanner, dex-quotes
- **How to reach:** GitHub Issues on alfreds-digital-bazaar repo | dev.to: @alfredz0x
- **Notes:** Alfred (ERC-8004 agent #18032) is building aggressively. Their endpoints are broader but shallower. Dev article published *1 day ago* — very active.
- **Opportunity:** Could integrate/partner rather than compete — our data as a backend source for Alfred's endpoints?

#### 4. Apollo Intelligence MCP Server
- **URL:** https://www.npmjs.com/package/@apollo_ai/mcp-proxy | https://github.com/bnmbnmai/mcp-proxy
- **Price:** Unknown (pay-per-call)
- **Scope:** 26-tool MCP server — crypto, DeFi, OSINT, proxy, search
- **Overlap:** DeFi + crypto data endpoints
- **How to reach:** GitHub Issues on mcp-proxy repo

#### 5. Nansen API + Corbits (x402 integration)
- **URL:** https://www.nansen.ai/api
- **Notes:** Nansen's API is integrated with x402 by Corbits to enable "seamless developer access to real-time onchain data." This is institutional onchain analytics — premium tier above us.
- **Opportunity:** Our endpoints are cheaper entry point; Nansen is the premium upgrade path. No direct conflict.

---

## 🎯 POTENTIAL CUSTOMERS (AI Agents That Could Pay Our API)

### Category A: DeFi Trading Bots / Agents — HIGH VALUE 🔥

#### 1. Allreality/jupiter-bot
- **URL:** https://github.com/Allreality/jupiter-bot
- **What:** Jupiter DEX trading bot with x402 payment middleware for Solana
- **Could use:** dex-quotes, funding-rates, price-feed
- **How to reach:** GitHub Issues
- **Notes:** Active Solana DEX trader — needs cross-chain data

#### 2. x402.Cards
- **URL:** https://x402.cards
- **What:** Real-time command deck for tokenized AI agents in DeFi. Unifies automated strategies, data oracles, risk engines, and crawlers with x402 streaming payments on IOTA EVM.
- **Could use:** yield-scanner, funding-rates, whale-tracker, dex-quotes, price-feed
- **How to reach:** Website contact or GitHub (search x402cards)
- **DeFi fit:** 🔥 PERFECT — they're literally building a DeFi agent dashboard

#### 3. kimbo128/DRAIN
- **URL:** https://github.com/kimbo128/DRAIN
- **What:** Decentralized Runtime for AI Networks — trustless micropayments for AI agents
- **Could use:** price-feed, dex-quotes, whale-tracker
- **How to reach:** GitHub Issues
- **Notes:** Active as of Feb 22, 2026

#### 4. AuditAgent (daveylupes)
- **URL:** https://github.com/daveylupes/AuditAgent-
- **What:** First production Solana autonomous agent for micropayments for premium APIs with Visa TAP
- **Could use:** token-scanner, wallet-profiler
- **How to reach:** GitHub Issues
- **Notes:** Security audit focused — our token-scanner and wallet-profiler are directly relevant

#### 5. Chainlink CRE x402 Price Alerts
- **URL:** https://github.com/smartcontractkit/x402-cre-price-alerts
- **What:** Crypto price alert system with x402 micropayments, Chainlink CRE workflows, AI natural language interface
- **Could use:** price-feed, funding-rates
- **How to reach:** GitHub Issues (Chainlink devs)
- **Notes:** Chainlink's own sample project — if we get listed here, it's huge credibility

### Category B: Agent Frameworks & Infrastructure — INTEGRATION PARTNERS 🤝

#### 6. samthedataman/x402-sdk (LangChain Integration)
- **URL:** https://github.com/samthedataman/x402-sdk
- **What:** x402 SDK with LangChain integration — enables LangChain AI agents to make autonomous micropayments. Includes `create_x402_agent` with daily spending limits.
- **Could use:** All our endpoints as tools for LangChain agents
- **How to reach:** GitHub Issues
- **Notes:** If we create a LangChain tool wrapper for our API, this is the natural SDK to target

#### 7. Google A2A x402 Extension
- **URL:** https://github.com/google-agentic-commerce/a2a-x402
- **What:** Agent-to-Agent protocol extension with cryptocurrency payments. Python + TypeScript. Multi-agent payment orchestration.
- **Could use:** Our API as a service that A2A agents can purchase
- **How to reach:** GitHub Issues on a2a-x402
- **Notes:** Google-backed A2A protocol — getting listed as an example A2A-compatible API would be significant

#### 8. AndreaRettaroli/m2m (Machine-to-Machine Protocol)
- **URL:** https://github.com/AndreaRettaroli/m2m
- **What:** x402 + A2A + MCP combined protocol for machine-to-machine payments
- **Could use:** Our API as a data service in M2M workflows
- **How to reach:** GitHub Issues

#### 9. rsquaredsolutions2026/PayRail402
- **URL:** https://github.com/rsquaredsolutions2026/payrail402
- **What:** Agent treasury management — wallets, budgets, automatic x402 payments for AI agents
- **Could use:** Our API for portfolio/DeFi data agents manage
- **How to reach:** GitHub Issues

#### 10. MorpheusAIs/x402-playground
- **URL:** https://github.com/MorpheusAIs/x402-playground
- **What:** Experimental AI chat app letting users execute x402-wrapped APIs and MCP servers using Morpheus LLM inference (OpenAI, Anthropic, Google)
- **Could use:** Our endpoints as x402-wrapped APIs in their marketplace
- **How to reach:** GitHub Issues | Morpheus Discord
- **Notes:** They specifically look for x402-enabled APIs to showcase — EASY INTEGRATION WIN

#### 11. xpaysh/agentic-economy-boilerplate (xpay✦)
- **URL:** https://github.com/xpaysh/agentic-economy-boilerplate | https://github.com/xpaysh/docs
- **What:** "Rosetta Stone for Agentic Payments" — one vending machine with 5+ protocol implementations. Educational boilerplate for devs.
- **Could use:** Our API as an example of a real-world x402 seller
- **How to reach:** GitHub Issues on awesome-x402 or agentic-economy-boilerplate
- **Notes:** They maintain awesome-x402 list — **getting listed there reaches the entire x402 developer community**

#### 12. Vault-0 (0-Vault/Vault-0)
- **URL:** https://github.com/0-Vault/Vault-0
- **What:** Encrypted secret vault + agent monitor + x402 wallet for OpenClaw. Handles 402 detection, EIP-3009 signing, policy-gated auto-settlement.
- **Could use:** Our API as a default data source for OpenClaw agents
- **How to reach:** GitHub Issues
- **Notes:** Specifically built for OpenClaw — highly relevant to our context

### Category C: Platform-Level Projects — DISTRIBUTION OPPORTUNITIES 🚀

#### 13. AWS Agentic Serverless Payments (aws-samples)
- **URL:** https://github.com/aws-samples/sample-agentic-serverless-payments
- **What:** AWS's official x402 reference architecture using Amazon Bedrock, Lambda, AgentKit. Pay-per-use AI content generation.
- **Could use:** Our DeFi data endpoints as example paid API calls
- **How to reach:** GitHub Issues | AWS devrel (Simon Goldberg, Chris Wajule mentioned)
- **Notes:** Updated Feb 22, 2026 (TODAY) — extremely active. Getting our API mentioned in their README = massive AWS developer audience

#### 14. TreasureProject/aifrens-sdk
- **URL:** https://github.com/TreasureProject/aifrens-sdk
- **What:** Official SDK for AI Frens API — chat with AI agents, generate images/videos/memes with x402 payments
- **Could use:** DeFi data for AI agents responding to crypto-related queries
- **How to reach:** GitHub Issues | Treasure Discord

#### 15. IQAI (IQAIcom/iqai-x402-agent)
- **URL:** https://github.com/IQAIcom/iqai-x402-agent
- **What:** IQ.ai x402 agent template (now moved to adk-ts-samples)
- **Could use:** DeFi data in IQ AI's knowledge graph agents
- **How to reach:** IQ.ai Discord | GitHub

#### 16. homebrewroboticsclub/Task-router-x402
- **URL:** https://github.com/homebrewroboticsclub/Task-router-x402
- **What:** Task router orchestrating robots and agents with x402 payment integration
- **Could use:** Price/gas data for autonomous transaction decisions
- **How to reach:** GitHub Issues

#### 17. Cronos Conductor (edwardtay/cronos-conductor)
- **URL:** https://github.com/edwardtay/cronos-conductor
- **What:** AI agent orchestration on Cronos using x402 for machine-to-machine payments
- **Could use:** DeFi data for Cronos chain agents
- **How to reach:** GitHub Issues

#### 18. AutonomiX (casaislabs/AutonomiX)
- **URL:** https://github.com/casaislabs/AutonomiX
- **What:** Web3 platform combining x402 micropayments + ERC-8004 agent NFTs, paywalled APIs on Base Sepolia
- **Could use:** Our API as an agent data source
- **How to reach:** GitHub Issues

---

## 📝 Key Dev.to / Blog Post Activity

- **"I Built 186 AI Agent APIs in a Weekend"** — Alfred Zhang, dev.to/alfredz0x (published ~Feb 22, 2026) — Active builder, httpay.xyz. DeFi APIs, x402, ERC-8004. Comment on his post or open an issue on his GitHub.
- **Circle Blog** — "Autonomous Payments using Circle Wallets, USDC, and x402" — Oct 2025. Circle's developer blog reaching wallets builders.
- **Ledger Academy** — "What is x402?" — Dec 2025. Consumer education piece.
- **DWF Labs Research** — "Inside x402" — Nov 2025. VC/institutional audience.

---

## 🧭 STRATEGIC ANALYSIS

### Our Competitive Moat

| Dimension | CoinGecko x402 | MoonMaker | httpay.xyz | **x402-api (ours)** |
|-----------|---------------|-----------|-----------|----------------------|
| Price/call | $0.01 | $0.02–$0.10 | $0.001–$0.01 | **$0.001–$0.008** |
| Price-feed | ✅ | ✅ | ✅ | ✅ |
| Gas tracker | ❌ | ❌ | ❌ | ✅ |
| DEX quotes | ❌ | Partial | ✅ | ✅ |
| Token security | ❌ | Partial | ✅ | ✅ |
| Whale tracker | ❌ | ❌ | ✅ | ✅ |
| Yield scanner | ❌ | ✅ | ✅ | ✅ |
| Funding rates | ❌ | ✅ | ✅ | ✅ |
| Wallet profiler | ❌ | ❌ | Partial | ✅ |
| ERC-8004 registered | Unknown | Unknown | ✅ (#18032) | ✅ (#18763) |
| MCP server | ❌ | ❌ | ❌ | ✅ (in repo) |
| ElizaOS plugin | ❌ | ❌ | ❌ | ✅ (in repo) |

**Verdict:** We have the broadest DeFi-specific coverage at the lowest price per call. CoinGecko wins on brand recognition. httpay.xyz wins on endpoint count. MoonMaker wins on signals/AI interpretation. **We win on DeFi depth + price + agent ecosystem integrations (MCP + ElizaOS).**

### Immediate Differentiators to Emphasize
1. **Gas tracker** — nobody else offers this via x402
2. **Wallet profiler** — rare, high-value for risk assessment agents
3. **MCP server** — Claude can call us natively without custom integration
4. **ElizaOS plugin** — direct path to ElizaOS agent ecosystem

---

## 🎯 TOP PRIORITY OUTREACH TARGETS

### Tier 1 — High Impact, Easy Win
1. **xpaysh/awesome-x402** — Open a PR to add x402-api to their list. Reaches entire x402 developer community.
2. **MorpheusAIs/x402-playground** — Open GitHub Issue to propose adding our API to their showcase. They explicitly want x402 API examples.
3. **Alfred Zhang (httpay.xyz/dev.to)** — Comment on his dev.to post, propose partnership. Our data as his backend?
4. **AWS aws-samples repo** — GitHub Issue suggesting our API as example of real x402 DeFi seller.

### Tier 2 — Strategic Integration  
5. **samthedataman/x402-sdk** — Build and PR a LangChain tool wrapper for our API
6. **google-agentic-commerce/a2a-x402** — Open Issue: "x402-api as example A2A service provider"
7. **Chainlink CRE (smartcontractkit/x402-cre-price-alerts)** — Suggest our price-feed + funding-rates as alternative data source

### Tier 3 — DeFi Agent Ecosystem
8. **x402.Cards** — Direct outreach via website; they need exactly what we provide
9. **DRAIN (kimbo128)** — GitHub Issue
10. **Vault-0** — GitHub Issue (especially relevant given OpenClaw connection)

---

## 📋 Action Items

- [ ] Submit PR to xpaysh/awesome-x402 adding x402-api to API Examples section
- [ ] Open issue on MorpheusAIs/x402-playground — offer our API as x402 showcase
- [ ] Comment on Alfred's dev.to article + open GitHub discussion on httpay.xyz
- [ ] Build a `/llms.txt` file for x402-api (MoonMaker has one — we should too)
- [ ] Open issue on aws-samples/sample-agentic-serverless-payments — suggest DeFi data use case
- [ ] Submit to x402.org ecosystem page (contact Coinbase devrel)
- [ ] Create LangChain tool wrapper (x402-sdk integration)
- [ ] Reach out to x402.Cards — they need our exact endpoints

---

## 🔗 Sources
- awesome-x402: https://github.com/xpaysh/awesome-x402
- x402.org: https://x402.org (stats: 75.41M txns, 94K buyers, 22K sellers)
- CoinGecko x402: https://docs.coingecko.com/docs/x402
- MoonMaker llms.txt: https://api.moonmaker.cc/llms.txt  
- Alfred's bazaar: https://httpay.xyz | https://dev.to/alfredz0x/...
- GitHub topics: https://github.com/topics/x402-agent (30 repos)
- AWS sample: https://github.com/aws-samples/sample-agentic-serverless-payments
- The Block on Stripe+x402: https://www.theblock.co/post/389352/stripe-adds-x402-integration-usdc-agent-payments
