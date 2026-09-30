# x402 API Server

[![npm: MCP Server](https://img.shields.io/npm/v/@x402-api/mcp-server?label=MCP%20Server&color=blue)](https://www.npmjs.com/package/@x402-api/mcp-server)
[![npm: ElizaOS Plugin](https://img.shields.io/npm/v/@x402-api/elizaos-plugin?label=ElizaOS%20Plugin&color=green)](https://www.npmjs.com/package/@x402-api/elizaos-plugin)
[![Listed on awesome-x402](https://img.shields.io/badge/awesome--x402-listed-orange)](https://github.com/xpaysh/awesome-x402)

> **Pay-per-call crypto/DeFi data API using HTTP 402 Payment Required.**  
> No API keys. No subscriptions. AI agents pay USDC on Base, per request.

```
  ██╗  ██╗██╗  ██╗ ██████╗ ██████╗
   ╚██╗██╔╝██║  ██║██╔═══██╗╚════██╗
    ╚███╔╝ ███████║██║   ██║ █████╔╝
    ██╔██╗ ╚════██║██║   ██║██╔═══╝
   ██╔╝ ██╗     ██║╚██████╔╝███████╗
   ╚═╝  ╚═╝     ╚═╝ ╚═════╝ ╚══════╝
```

🌐 **Live at:** [https://x402-api.fly.dev](https://x402-api.fly.dev)  
🤖 **Agent Identity:** [#18763 on Base (ERC-8004)](https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)  
📝 **Blog Post:** [I Built a DeFi Data API Where AI Agents Pay Per Call](https://dev.to)

---

## What Is This?

This is a DeFi/crypto data API server where **payment is part of the HTTP protocol itself**.

Every endpoint costs a small USDC micropayment — between 0.001 and 0.008 USDC (fractions of a cent). When a client hits a protected endpoint, the server responds with `HTTP 402 Payment Required` and precise payment instructions. The client pays, retries with proof, and gets data.

No accounts. No OAuth. No billing dashboard. Just: *"this costs 0.003 USDC — pay here."*

This model is designed for **AI agents**: autonomous software that needs to call APIs without a human reaching for a credit card. The agent holds a wallet, pays exactly what's needed, and moves on.

**The stack:**
- [x402 Protocol](https://github.com/coinbase/x402) — HTTP 402-based micropayment standard by Coinbase
- USDC on [Base](https://base.org) — L2 mainnet, sub-cent fees, instant finality
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) — on-chain identity registration for AI agents
- Express.js backend — straightforward, auditable, no framework magic

---

## Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/price-feed` | **0.001 USDC** | BTC/ETH/SOL prices + selected 24h movers (CoinGecko, CoinLore fallback) |
| `GET /api/gas-tracker` | **0.001 USDC** | Multi-chain gas prices (ETH, Base, Polygon, Arbitrum) with speed tiers |
| `GET /api/dex-quotes` | **0.002 USDC** | One live ParaSwap aggregate route quote; no independent venue comparison |
| `GET /api/token-scanner` | **0.003 USDC** | GoPlus ERC-20 security flags and disclosed heuristic risk score |
| `GET /api/whale-tracker` | **0.005 USDC** | GoPlus top-holder sample and reported supply share |
| `GET /api/yield-scanner` | **0.005 USDC** | DefiLlama pool APYs and TVL; no safety rating |
| `GET /api/funding-rates` | **0.008 USDC** | Hyperliquid and dYdX v4 hourly funding with indicative spreads |
| `GET /api/wallet-profiler` | **0.008 USDC** | Blockscout priced balances or limited public RPC fallback; partial coverage |
| `GET /api/endpoints` | **Free** | Machine-readable endpoint catalog |
| `GET /.well-known/x402` | **Free** | Agent discovery manifest with prices and integration links |
| `GET /openapi.json` | **Free** | OpenAPI 3.1 route descriptions for agents and tools |
| `GET /health` | **Free** | Health check |

**Already listed:** [Official MCP Registry](https://registry.modelcontextprotocol.io/?q=io.github.fernsugi%2Fx402-api), [Glama](https://glama.ai/mcp/servers/fernsugi/x402-api-mcp-server), and [awesome-x402](https://github.com/xpaysh/awesome-x402#defi--finance). The local `awesome-x402-servers` checkout has a separate unmerged listing branch; it is not the upstream listing.

The API uses x402 v1 challenges. Its `accepts[].outputSchema` now carries the v1 Bazaar discovery input and example output; the free `/api/bazaar` route is a self-hosted catalog. A facilitator indexes an endpoint only after a compatible paid settlement, so a local schema does not prove Bazaar visibility.

Each paid route checks its upstream source before the payment gate. Invalid input returns 400; unavailable live data returns 503 without a payment response. Successful reads are cached briefly to limit public-provider load.

The public-source coverage has limits: ParaSwap provides one aggregate route rather than a comparison of independent venues; GoPlus exposes a top-holder sample and security flags, not a full holder distribution, transfer alerts, or contract audit; Blockscout balances omit DeFi positions and PnL; funding spreads compare Hyperliquid current rates with dYdX predicted rates and exclude execution costs. Yield APYs are provider reported and do not measure safety. If a provider changes or rate limits access, the route fails closed before charging.

**Yield source deadline:** [DefiLlama says its free legacy `/pools` endpoint will stop on 13 November 2026](https://newsletter.defillama.com/p/your-exchange-s-numbers-might-not-be-real-here-s-how-to-check). The current yield route uses it. An API-plan migration or a new public source is needed before that date; the route will return 503 without charging if its source stops responding.

### Query Parameters

| Endpoint | Parameter | Example |
|----------|-----------|---------|
| `/api/dex-quotes` | `from`, `to`, `amount` | `?from=ETH&to=USDC&amount=1.5` |
| `/api/token-scanner` | `token` | `?token=PEPE` or `?token=0x...` |
| `/api/whale-tracker` | `token` | `?token=ETH` |
| `/api/yield-scanner` | `chain`, `min_tvl` | `?chain=base&min_tvl=1000000` |
| `/api/funding-rates` | `asset` | `?asset=BTC` |
| `/api/wallet-profiler` | `address` | `?address=0x...` |

---

## How x402 Works

The [x402 protocol](https://github.com/coinbase/x402) extends the long-forgotten `HTTP 402 Payment Required` status code into a machine-readable micropayment standard.

### The Payment Flow

**Step 1 — Initial request (no payment)**
```http
GET /api/price-feed HTTP/1.1
Host: x402-api.fly.dev
```

**Step 2 — Server returns 402**
```http
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "error": "Payment Required",
  "accepts": [{
    "scheme": "exact",
    "network": "base",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x60264c480b67adb557efEd22Cf0e7ceA792DefB7",
    "maxAmountRequired": "1000",
    "resource": "https://x402-api.fly.dev/api/price-feed",
    "description": "Live crypto price feed",
    "extra": {
      "name": "USD Coin",
      "chainId": 8453,
      "supportedProofs": ["eip3009_transferWithAuthorization"],
      "experimentalProofs": []
    }
  }]
}
```

**Step 3 — Client pays and retries**
```http
GET /api/price-feed HTTP/1.1
Host: x402-api.fly.dev
X-Payment: <base64-encoded payment proof>
```

**Step 4 — Server verifies and responds**
```http
HTTP/1.1 200 OK
X-Payment-Response: {"success":true,"txHash":"0x..."}
Content-Type: application/json

{ "source": "CoinGecko", "data": { "core": [{ "id": "bitcoin", "price_usd": 100000 }], "top_movers": { "gainers": [], "losers": [] } } }
```

### Payment Verification

Production payments use **EIP-3009 `transferWithAuthorization`** when you configure one of these:

1. **Direct settlement** via `X402_SETTLEMENT_PRIVATE_KEY` — the server submits `transferWithAuthorization` on-chain and pays gas.
2. **Custom facilitator settlement** via `X402_FACILITATOR_URL` — the server forwards the signed authorization to your facilitator.

Without settlement configuration, the server cannot accept production payments. The legacy transaction-hash proof is disabled by default because its replay record must survive redeploys and be shared across instances. Enable it only with `X402_ENABLE_TXHASH=true` and a durable shared `X402_DATA_DIR`.

**Receiving wallet:** `0x60264c480b67adb557efEd22Cf0e7ceA792DefB7`
**Network:** Base mainnet (chain ID 8453)
**Asset:** USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)

---

## Client integration

The included [MCP server](https://github.com/fernsugi/x402-api-mcp-server) and ElizaOS packages read this server's JSON x402 v1 challenge, sign a Base USDC EIP-3009 authorization, and retry with a Base64 JSON `X-Payment` header. Each automatic client has a 0.01 USDC default per-call cap. The server must have direct or facilitator settlement configured for those clients to pay.

Client packages using newer x402 v2 headers have not been verified against this legacy v1 server. Keep the compatibility check in place before making a mainnet payment. `scripts/test-eip3009.mjs` performs a real paid transaction and is deliberately outside `npm test`.

**Receiving wallet:** `0x60264c480b67adb557efEd22Cf0e7ceA792DefB7`
**Network:** Base mainnet (chain ID 8453)
**Asset:** USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)

---

## ERC-8004 Identity

This API is registered as an AI agent on Base via [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) — the Ethereum standard for on-chain agent identity.

**Agent ID:** #18763  
**Registry contract:** [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)  
**Network:** Base mainnet

The registration includes:
- Agent name and description
- Service endpoints (web + x402)
- x402 capability flag
- Reputation-based trust signals

This lets discovery services, AI marketplaces, and other agents find and verify this API on-chain — no centralized registry required.

**See the domain verification document:** [`agent-registration.json`](./agent-registration.json). Agent #18763 currently stores a Base64 `data:` URI on-chain. That embedded snapshot advertises only the web root and x402 root, so updating this file or deploying the server will not change the on-chain service list. The owner must call `setAgentURI` to publish a refreshed on-chain registration after reviewing the new public URLs.

---

## Integrations

### MCP Server (Claude Desktop / Claude API)

The MCP (Model Context Protocol) server now lives in its own standalone repo:

- GitHub: [fernsugi/x402-api-mcp-server](https://github.com/fernsugi/x402-api-mcp-server)
- npm: [`@x402-api/mcp-server`](https://www.npmjs.com/package/@x402-api/mcp-server)

**Quick setup:**

```bash
# Run without payment (inspect mode)
npx @x402-api/mcp-server

# Run with auto-pay
X402_WALLET_PRIVATE_KEY=0x... npx @x402-api/mcp-server
```

**Add to Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "x402-api": {
      "command": "npx",
      "args": ["@x402-api/mcp-server"],
      "env": {
        "X402_WALLET_PRIVATE_KEY": "0x<your_key>"
      }
    }
  }
}
```

→ See the standalone MCP repo for full docs: [x402-api-mcp-server README](https://github.com/fernsugi/x402-api-mcp-server#readme)

### ElizaOS Plugin

The [`elizaos-plugin/`](./elizaos-plugin/) directory contains an ElizaOS plugin that gives autonomous agents natural-language access to all 8 endpoints.

**Install:**

```bash
npm install @x402-api/elizaos-plugin
```

**Register in your ElizaOS agent:**

```typescript
import { x402ApiPlugin } from '@x402-api/elizaos-plugin';

export const agent: Character = {
  name: 'DeFi Agent',
  plugins: [
    x402ApiPlugin({
      walletPrivateKey: process.env.X402_WALLET_PRIVATE_KEY,
    }),
  ],
};
```

The plugin adds 8 actions: `GET_CRYPTO_PRICES`, `GET_GAS_PRICES`, `GET_DEX_QUOTES`, `SCAN_TOKEN`, `TRACK_WHALES`, `SCAN_YIELDS`, `GET_FUNDING_RATES`, `PROFILE_WALLET`.

→ See [`elizaos-plugin/README.md`](./elizaos-plugin/README.md) for full docs.

---

## Local Development

```bash
git clone https://github.com/fernsugi/x402-api-server
cd x402-api-server
cp .env.example .env   # defaults to development mode
npm install
npm run dev            # auto-reload on changes
```

In development mode (`NODE_ENV=development`), any non-empty `X-PAYMENT` header is accepted — no real payments needed for local testing.

```bash
# Get 402 response with payment instructions
curl -i http://localhost:4020/api/price-feed

# Test with mock payment (dev only)
curl http://localhost:4020/api/price-feed -H "X-Payment: test"
```

---

## Architecture

```
src/
├── index.js                 # Express server + graceful shutdown
├── payment-config.js        # Settlement mode + proof support detection
├── middleware/
│   └── x402.js              # x402 payment gate middleware
├── routes/
│   ├── priceFeed.js         # /api/price-feed (CoinGecko + CoinLore fallback)
│   ├── gasTracker.js        # /api/gas-tracker (live public RPC)
│   ├── dexQuotes.js         # /api/dex-quotes
│   ├── tokenScanner.js      # /api/token-scanner
│   ├── whaleTracker.js      # /api/whale-tracker
│   ├── yieldScanner.js      # /api/yield-scanner
│   ├── fundingRates.js      # /api/funding-rates
│   └── walletProfiler.js    # /api/wallet-profiler
├── services/
│   └── verifier.js          # txHash verifier + EIP-3009 settlement
└── views/
    └── index.html           # Landing page

elizaos-plugin/              # @x402-api/elizaos-plugin

Standalone sibling repo:
x402-api-mcp-server/         # @x402-api/mcp-server
```

---

## Deployment

### Fly.io (recommended)

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
./deploy.sh
```

### Docker

```bash
docker compose up -d
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PAY_TO_ADDRESS` | `0x60264c...DefB7` | USDC receiving wallet on Base |
| `PORT` | `4020` | Server port |
| `NODE_ENV` | `development` | Set `production` for real payment verification |
| `BASE_RPC_URL` | `https://mainnet.base.org` | Base RPC URL |
| `X402_SETTLEMENT_MODE` | `auto` | `auto`, `direct`, `facilitator`, or `disabled` |
| `X402_SETTLEMENT_PRIVATE_KEY` | none | Sponsor key for direct `transferWithAuthorization` settlement |
| `X402_FACILITATOR_URL` | none | Custom facilitator URL for EIP-3009 settlement |
| `X402_FACILITATOR_API_KEY` | none | Optional bearer token for your facilitator |
| `X402_ENABLE_TXHASH` | `false` | Legacy txHash proof opt in; also requires durable `X402_DATA_DIR` shared by all instances |
| `X402_DATA_DIR` | local data dir | Durable nonce store path when txHash is enabled |

---

## Links

- 🌐 [Landing Page](https://x402-api.fly.dev)
- 📖 [x402 Protocol](https://github.com/coinbase/x402)
- ⛓️ [Base Chain](https://base.org)
- 🔎 [Agent #18763 on BaseScan](https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)
- 📝 [ERC-8004 Spec](https://eips.ethereum.org/EIPS/eip-8004)
- 🤖 [MCP Server](https://github.com/fernsugi/x402-api-mcp-server)
- 🤖 [ElizaOS Plugin](./elizaos-plugin/)

---

## License

MIT

## Agent workflows

[Explore three demos](https://x402-api.fly.dev/demos/?utm_source=github) or run [the examples](examples/README.md): PEPE token flags + holder sample (0.008 USDC), ETH funding comparison (0.008), and ParaSwap quote + gas (0.003). Inspect mode is free and never signs a payment. Paid mode pins the official recipient and enforces a total budget.

Free `/api/workflows` and `/api/endpoints` include concrete valid query URLs. The [MCP package](https://www.npmjs.com/package/@x402-api/mcp-server) exposes all eight tools. Optional first-party journals measure visits, install link clicks, payment challenges, settled calls and first/repeat observed payers; crawler probes and operator testing are separate. See [EXPOSURE.md](EXPOSURE.md).
