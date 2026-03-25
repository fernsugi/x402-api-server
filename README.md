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
| `GET /api/price-feed` | **0.001 USDC** | BTC/ETH/SOL prices + top 24h movers (live CoinGecko) |
| `GET /api/gas-tracker` | **0.001 USDC** | Multi-chain gas prices (ETH, Base, Polygon, Arbitrum) with speed tiers |
| `GET /api/dex-quotes` | **0.002 USDC** | Compare swap quotes across Uniswap, SushiSwap, 1inch |
| `GET /api/token-scanner` | **0.003 USDC** | Token security & risk analysis — rug-pull detection flags |
| `GET /api/whale-tracker` | **0.005 USDC** | Token holder concentration, Gini coefficient, whale alerts |
| `GET /api/yield-scanner` | **0.005 USDC** | Top DeFi yields across Aave, Compound, Morpho, Lido, Pendle + more |
| `GET /api/funding-rates` | **0.008 USDC** | Perp funding rates across 6 venues + arb ranking |
| `GET /api/wallet-profiler` | **0.008 USDC** | Wallet portfolio analysis, holdings, activity, risk profile |
| `GET /api/endpoints` | **Free** | Machine-readable endpoint catalog |
| `GET /health` | **Free** | Health check |

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
      "facilitatorUrl": "https://x402.org/facilitator"
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

{ "btc": 95420.12, "eth": 3241.88, ... }
```

### Payment Verification

In production mode, the server verifies payments via:

1. **EIP-3009 signature** — Validates the `transferWithAuthorization` EIP-712 signature, checks amount, recipient, expiry, and on-chain nonce.
2. **Transaction hash** — Confirms a submitted Base transaction contains a USDC transfer to the receiving address.

Both methods include replay protection.

**Receiving wallet:** `0x60264c480b67adb557efEd22Cf0e7ceA792DefB7`  
**Network:** Base mainnet (chain ID 8453)  
**Asset:** USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)

---

## Using with x402-fetch

[x402-fetch](https://www.npmjs.com/package/x402-fetch) is the official client library from Coinbase that handles the payment flow automatically. Drop it in as a `fetch` replacement.

### Installation

```bash
npm install x402-fetch viem
```

### Basic Usage

```typescript
import { wrapFetchWithPayment } from 'x402-fetch';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

// Wrap fetch — payments handled automatically
const fetchWithPayment = wrapFetchWithPayment(fetch, walletClient);

// Just call the API — 402 is handled transparently
const response = await fetchWithPayment('https://x402-api.fly.dev/api/price-feed');
const data = await response.json();
console.log(data);
```

### What `wrapFetchWithPayment` Does

1. Makes the initial request
2. If 402 → parses payment requirements
3. Signs the payment authorization (EIP-3009 `transferWithAuthorization`)
4. Retries the request with `X-Payment` header
5. Returns the successful response

**Your wallet needs USDC on Base mainnet.** You can bridge USDC from Ethereum to Base using the [Base Bridge](https://bridge.base.org) or buy directly on Coinbase.

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

**See the registration data:** [`agent-registration.json`](./agent-registration.json)

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
git clone https://github.com/sugi/x402-api-server
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
├── middleware/
│   └── x402.js              # x402 payment gate middleware
├── routes/
│   ├── priceFeed.js         # /api/price-feed (live CoinGecko)
│   ├── gasTracker.js        # /api/gas-tracker (real RPC + mock)
│   ├── dexQuotes.js         # /api/dex-quotes
│   ├── tokenScanner.js      # /api/token-scanner
│   ├── whaleTracker.js      # /api/whale-tracker
│   ├── yieldScanner.js      # /api/yield-scanner
│   ├── fundingRates.js      # /api/funding-rates
│   └── walletProfiler.js    # /api/wallet-profiler
├── services/
│   └── verifier.js          # EIP-3009 + tx hash payment verifier
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
