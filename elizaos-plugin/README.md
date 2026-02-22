# @x402-api/elizaos-plugin

> ElizaOS plugin for **pay-per-call DeFi intelligence** — powered by [x402](https://x402.org) micropayments (USDC on Base)

Give your ElizaOS agent real-time access to 8 DeFi data endpoints for as little as **$0.001 per query**. No API keys, no subscriptions — just pay per call in USDC.

## Endpoints

| Action | Endpoint | Cost |
|--------|----------|------|
| `GET_CRYPTO_PRICES` | `/api/price-feed` | $0.001 |
| `GET_GAS_PRICES` | `/api/gas-tracker` | $0.001 |
| `GET_DEX_QUOTES` | `/api/dex-quotes` | $0.002 |
| `SCAN_TOKEN` | `/api/token-scanner` | $0.003 |
| `TRACK_WHALES` | `/api/whale-tracker` | $0.005 |
| `SCAN_YIELDS` | `/api/yield-scanner` | $0.005 |
| `GET_FUNDING_RATES` | `/api/funding-rates` | $0.008 |
| `PROFILE_WALLET` | `/api/wallet-profiler` | $0.008 |

**API Base URL:** `https://x402-api.fly.dev`

---

## Installation

```bash
npm install @x402-api/elizaos-plugin
# or
bun add @x402-api/elizaos-plugin
```

### For automatic payments (required for production)

```bash
npm install x402-fetch viem
```

---

## Quick Start

### 1. Add to your character file

```typescript
// src/character.ts
import { x402DeFiPlugin } from '@x402-api/elizaos-plugin';

export const character: Character = {
  name: 'DeFi Agent',
  plugins: [
    '@elizaos/plugin-bootstrap',
    '@elizaos/plugin-sql',
    x402DeFiPlugin,  // ← add this
  ],
};
```

### 2. Configure your wallet

The plugin needs a wallet with USDC on Base to pay for API calls.

```bash
# .env
X402_WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
```

> **⚠️ Security:** Never commit your private key. Use `.env` files and add them to `.gitignore`.

### 3. Fund your wallet

Your wallet needs USDC on Base. Get some from:
- [Coinbase](https://coinbase.com) → withdraw USDC to Base
- [Uniswap on Base](https://app.uniswap.org) → swap ETH for USDC
- [bridge.base.org](https://bridge.base.org) → bridge from Ethereum

Costs are tiny — $1 of USDC covers **125–1000 queries** depending on the endpoint.

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `X402_WALLET_PRIVATE_KEY` | Your wallet's private key (hex) | — |
| `X402_WALLET_ADDRESS` | Your wallet address (for logging) | — |
| `X402_API_BASE_URL` | API base URL override | `https://x402-api.fly.dev` |

### Programmatic Config

```typescript
import { createX402Plugin } from '@x402-api/elizaos-plugin';

const plugin = createX402Plugin({
  walletPrivateKey: process.env.MY_KEY,
  baseUrl: 'https://x402-api.fly.dev',  // or your own instance
  timeoutMs: 15000,
});

export const character: Character = {
  plugins: [plugin],
};
```

---

## What Each Action Does

### 💰 GET_CRYPTO_PRICES
Fetches live prices for BTC, ETH, SOL + top 5 gainers/losers by 24h change. Data from CoinGecko.

**Triggers when you say:**
- "What are the current crypto prices?"
- "How is the market doing?"
- "Price feed"

---

### ⛽ GET_GAS_PRICES
Current gas prices across Ethereum, Base, Polygon, and Arbitrum. Returns slow/normal/fast tiers with USD cost estimates for transfers, swaps, and NFT mints.

**Triggers when you say:**
- "What are the gas fees right now?"
- "How much does an ETH swap cost?"
- "Check gas prices on Arbitrum"

---

### 🔄 GET_DEX_QUOTES
Compare swap quotes across Uniswap V3, SushiSwap, and 1inch for any token pair. Shows price impact, fees, gas costs, and best route.

**Triggers when you say:**
- "What's the best rate to swap 1 ETH for USDC?"
- "Compare DEX quotes for BTC/USDC on Base"
- "How much USDT do I get for 500 USDC?"

**Params extracted from message:** from/to tokens, amount, chain

---

### 🔍 SCAN_TOKEN
Security scan for any ERC-20 token. Checks: contract verification, proxy/upgradeable, mint function, liquidity lock, honeypot detection, buy/sell tax, holder count, risk score.

**Triggers when you say:**
- "Is PEPE safe? Check for rug"
- "Scan this token: 0x6982..."
- "Is this a honeypot?"

**Params:** token symbol or address, chain

---

### 🐋 TRACK_WHALES
Top holder distribution analysis. Returns concentration metrics (Gini coefficient, Herfindahl index), distribution buckets, top 20 holders with labels, and recent large transfers.

**Triggers when you say:**
- "Are whales accumulating ETH?"
- "Show whale activity for PEPE"
- "Who are the top holders of SOL?"

---

### 🌾 SCAN_YIELDS
Find the best DeFi yield opportunities across 10+ protocols: Aave, Compound, Morpho, Lido, Rocket Pool, Pendle, Ethena, Maker DSR, Convex, Yearn, Aerodrome, and more. Filter by chain, asset, TVL, and risk tier.

**Triggers when you say:**
- "What are the best DeFi yields right now?"
- "Find safe USDC yields on Base"
- "Best ETH staking rates?"

---

### 📊 GET_FUNDING_RATES
Perpetual futures funding rates across Hyperliquid, dYdX v4, Aevo, GMX, Drift, and Vertex. Automatically identifies arbitrage opportunities (long on lowest-rate venue, short on highest).

**Triggers when you say:**
- "What are the current perp funding rates?"
- "Is there a funding rate arb for ETH?"
- "Compare funding rates across venues"

---

### 👛 PROFILE_WALLET
Full wallet analysis: portfolio breakdown, DeFi positions, activity metrics, risk classification. Supports ENS and known wallet labels.

**Triggers when you say:**
- "Analyze wallet 0xd8dA..."
- "What's in vitalik's wallet?"
- "Profile this address: 0x..."

---

## How x402 Payments Work

The [x402 protocol](https://x402.org) is a standard for HTTP micropayments:

```
1. Agent → GET /api/price-feed
2. Server → 402 Payment Required + payment details
3. x402-fetch → sign & broadcast USDC transfer on Base
4. Agent → GET /api/price-feed + X-PAYMENT header
5. Server → validate payment → 200 OK + data
```

This happens **automatically** when you install `x402-fetch` and provide a wallet key. From your agent's perspective, it's just a normal API call.

### Without x402-fetch

If `x402-fetch` is not installed, the plugin will:
1. Make the request
2. Receive a 402 response
3. Throw a helpful error explaining how to configure payment

This is useful for **testing** the plugin structure without spending USDC.

---

## TypeScript Types

All API response types are exported:

```typescript
import type {
  PriceFeedResponse,
  GasTrackerResponse,
  DexQuotesData,
  TokenScanData,
  WhaleTrackerData,
  YieldPool,
  ArbOpportunity,
  WalletProfileData,
} from '@x402-api/elizaos-plugin';
```

---

## Advanced: Custom Action Composition

Use only the actions you need:

```typescript
import {
  createPriceFeedAction,
  createTokenScannerAction,
  type X402ClientConfig,
} from '@x402-api/elizaos-plugin';
import type { Plugin } from '@elizaos/core';

const config: X402ClientConfig = {
  baseUrl: 'https://x402-api.fly.dev',
  walletPrivateKey: process.env.X402_WALLET_PRIVATE_KEY,
};

const myPlugin: Plugin = {
  name: 'my-defi-plugin',
  description: 'Selected DeFi actions',
  actions: [
    createPriceFeedAction(config),
    createTokenScannerAction(config),
  ],
};
```

---

## Running Your Own API Instance

The API server is open source. Deploy your own:

```bash
git clone https://github.com/sugi/x402-api-server
cd x402-api-server
fly deploy
```

Then point the plugin at your instance:

```bash
X402_API_BASE_URL=https://your-api.fly.dev
```

---

## Development & Testing

```bash
# Install deps
npm install

# Build TypeScript
npm run build

# Watch mode
npm run dev
```

### Testing without real payments

Set a dummy private key to test plugin loading (calls will fail at payment step):

```bash
X402_WALLET_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001
```

Or mock `x402-fetch` in your tests.

---

## Publishing to npm

```bash
npm run build
npm publish --access public
```

Or with Bun:

```bash
bun run build
bun publish
```

---

## Compatibility

| ElizaOS Version | Plugin Version | Notes |
|----------------|----------------|-------|
| `>=1.0.0` | `1.x` | Full support |
| `0.x` | Not supported | Use the raw API client instead |

---

## License

MIT © Sugi

---

## Links

- **API Server:** https://x402-api.fly.dev
- **x402 Protocol:** https://x402.org
- **ElizaOS Docs:** https://docs.elizaos.ai
- **Source Code:** https://github.com/sugi/x402-api-server
