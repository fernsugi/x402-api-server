/**
 * x402 API Server — Production
 *
 * Pay-per-call crypto/DeFi data endpoints using HTTP 402 Payment Required.
 * Agents pay in USDC on Base; no API keys, no subscriptions.
 *
 * Endpoints:
 *   GET /                    → Landing page
 *   GET /api/price-feed      → Aggregated crypto prices (0.001 USDC)
 *   GET /api/whale-tracker   → Token holder concentration (0.005 USDC)
 *   GET /api/funding-rates   → Perp funding rate arb scanner (0.008 USDC)
 *   GET /api/gas-tracker     → Multi-chain gas prices (0.001 USDC)
 *   GET /api/token-scanner   → Token security & risk analysis (0.003 USDC)
 *   GET /api/dex-quotes      → DEX swap quote comparison (0.002 USDC)
 *   GET /api/yield-scanner   → Top DeFi yields (0.005 USDC)
 *   GET /api/wallet-profiler → Wallet portfolio analysis (0.008 USDC)
 *   GET /health              → Health check (free)
 *   GET /api/endpoints       → Machine-readable endpoint catalog (free)
 */

'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const priceFeedRouter = require('./routes/priceFeed');
const whaleTrackerRouter = require('./routes/whaleTracker');
const fundingRatesRouter = require('./routes/fundingRates');
const gasTrackerRouter = require('./routes/gasTracker');
const tokenScannerRouter = require('./routes/tokenScanner');
const dexQuotesRouter = require('./routes/dexQuotes');
const yieldScannerRouter = require('./routes/yieldScanner');
const walletProfilerRouter = require('./routes/walletProfiler');
const { PAY_TO_ADDRESS } = require('./middleware/x402');
const { BAZAAR_SCHEMAS } = require('./bazaar-schemas');

const app = express();
const PORT = process.env.PORT || 4020;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust the reverse proxy (Fly.io, nginx, etc.) so req.protocol reflects
// the original https:// scheme rather than the internal http:// hop.
// Required for correct x402 payment instruction URLs behind Fly.io.
app.set('trust proxy', true);

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Payment', 'Authorization'],
  exposedHeaders: ['X-Payment-Response'],
}));

// Structured logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'views')));

// Request ID for tracing
app.use((req, res, next) => {
  req.requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ── API Routes (payment-gated) ───────────────────────────────────────────────
app.use('/api/price-feed', priceFeedRouter);
app.use('/api/whale-tracker', whaleTrackerRouter);
app.use('/api/funding-rates', fundingRatesRouter);
app.use('/api/gas-tracker', gasTrackerRouter);
app.use('/api/token-scanner', tokenScannerRouter);
app.use('/api/dex-quotes', dexQuotesRouter);
app.use('/api/yield-scanner', yieldScannerRouter);
app.use('/api/wallet-profiler', walletProfilerRouter);

// ── Free Routes ──────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    protocol: 'x402',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    pay_to: PAY_TO_ADDRESS,
  });
});

app.get('/api/endpoints', (req, res) => {
  res.json({
    x402Version: 1,
    server: 'x402-api-server',
    description: 'Pay-per-call crypto/DeFi data API using the x402 payment protocol',
    pay_to: PAY_TO_ADDRESS,
    network: 'base',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    asset_name: 'USDC',
    endpoints: [
      {
        path: '/api/price-feed',
        method: 'GET',
        description: 'Aggregated crypto price feed: BTC, ETH, SOL + top 24h movers. Live data from CoinGecko.',
        price_usdc: 0.001,
        price_micro: 1000,
      },
      {
        path: '/api/whale-tracker',
        method: 'GET',
        description: 'Token holder concentration: whale distribution, Gini coefficient, large transfer alerts.',
        price_usdc: 0.005,
        price_micro: 5000,
        params: [
          { name: 'token', default: 'ETH' },
          { name: 'chain', default: 'ethereum' },
        ],
      },
      {
        path: '/api/funding-rates',
        method: 'GET',
        description: 'Perp funding rates across Hyperliquid, dYdX v4, Aevo, GMX, Drift, Vertex + arb ranking.',
        price_usdc: 0.008,
        price_micro: 8000,
        params: [
          { name: 'asset', default: 'all' },
          { name: 'min_spread', default: 0 },
        ],
      },
      {
        path: '/api/gas-tracker',
        method: 'GET',
        description: 'Gas prices across Ethereum, Base, Polygon, Arbitrum with speed tiers and USD cost estimates.',
        price_usdc: 0.001,
        price_micro: 1000,
      },
      {
        path: '/api/token-scanner',
        method: 'GET',
        description: 'Token security & risk analysis: contract verification, holder stats, liquidity, rug-pull risk flags.',
        price_usdc: 0.003,
        price_micro: 3000,
        params: [
          { name: 'token', default: 'PEPE' },
          { name: 'chain', default: 'ethereum' },
        ],
      },
      {
        path: '/api/dex-quotes',
        method: 'GET',
        description: 'Compare swap quotes across Uniswap, SushiSwap, 1inch with price impact and route optimization.',
        price_usdc: 0.002,
        price_micro: 2000,
        params: [
          { name: 'from', default: 'ETH' },
          { name: 'to', default: 'USDC' },
          { name: 'amount', default: 1 },
          { name: 'chain', default: 'ethereum' },
        ],
      },
      {
        path: '/api/yield-scanner',
        method: 'GET',
        description: 'Top DeFi yields across Aave, Compound, Morpho, Lido, Pendle, Ethena. Filter by chain, asset, TVL.',
        price_usdc: 0.005,
        price_micro: 5000,
        params: [
          { name: 'chain', default: 'all' },
          { name: 'min_tvl', default: 0 },
          { name: 'asset', default: 'all' },
          { name: 'limit', default: 20 },
        ],
      },
      {
        path: '/api/wallet-profiler',
        method: 'GET',
        description: 'Wallet portfolio analysis: holdings, DeFi positions, activity metrics, risk profile.',
        price_usdc: 0.008,
        price_micro: 8000,
        params: [
          { name: 'address', default: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
          { name: 'chain', default: 'all' },
        ],
      },
    ],
  });
});

// ── Bazaar Discovery Endpoint ─────────────────────────────────────────────────
// Machine-readable catalog for AI agents — compatible with x402 Bazaar extension
// @see https://docs.cdp.coinbase.com/x402/bazaar
app.get('/api/bazaar', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    x402Version: 1,
    bazaarCompatible: true,
    server: 'x402-api-server',
    description: 'Pay-per-call crypto/DeFi data API. No API keys, no subscriptions. Pay USDC per request on Base.',
    pay_to: PAY_TO_ADDRESS,
    network: 'eip155:8453',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    asset_symbol: 'USDC',
    facilitator: 'https://x402.org/facilitator',
    resources: Object.entries(BAZAAR_SCHEMAS).map(([path, schema]) => ({
      path,
      method: 'GET',
      schema,
    })),
    _note: 'extensions.bazaar schema included in every 402 Payment Required response',
  });
});

// ── ERC-8004 Domain Verification ─────────────────────────────────────────────
app.get('/.well-known/agent-registration.json', (req, res) => {
  const regPath = path.join(__dirname, '..', 'agent-registration.json');
  res.set('Content-Type', 'application/json');
  res.set('Cache-Control', 'public, max-age=86400');
  res.sendFile(regPath);
});

// ── LLMs.txt (AI-readable API description) ──────────────────────────────────
app.get('/llms.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(`# x402-api — Pay-Per-Call DeFi Data API for AI Agents
# https://x402-api.fly.dev
# ERC-8004 Agent #18763 on Base

## Overview
x402-api is a DeFi and crypto data API that uses the x402 protocol (HTTP 402 Payment Required).
AI agents pay per request in USDC on Base — no API keys, no subscriptions, no accounts needed.

## Endpoints
All endpoints require USDC payment via the x402 protocol.

GET /api/price-feed      $0.001 USDC  BTC/ETH/SOL prices + top movers/losers (CoinGecko)
GET /api/gas-tracker     $0.001 USDC  Multi-chain gas: ETH, Base, Polygon, Arbitrum
GET /api/dex-quotes      $0.002 USDC  DEX swap quotes (params: ?from=ETH&to=USDC&amount=1)
GET /api/token-scanner   $0.003 USDC  Token security analysis (params: ?token=PEPE)
GET /api/whale-tracker   $0.005 USDC  Large transfer alerts + holder concentration (params: ?token=ETH)
GET /api/yield-scanner   $0.005 USDC  Top DeFi yields across protocols (params: ?chain=ethereum&min_tvl=1000000)
GET /api/funding-rates   $0.008 USDC  Perp funding rates on Hyperliquid + others (params: ?asset=ETH)
GET /api/wallet-profiler $0.008 USDC  Wallet portfolio + activity analysis (params: ?address=0x...)

## Free Endpoints
GET /health                           Server health check
GET /api/endpoints                    Machine-readable endpoint catalog (JSON)
GET /api/bazaar                       Bazaar discovery schemas (JSON)
GET /.well-known/agent-registration.json  ERC-8004 registration file

## Payment
Network: Base (chain ID 8453)
Asset: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
Pay-to: 0x60264c480b67adb557efEd22Cf0e7ceA792DefB7
Protocol: x402 (EIP-3009 transferWithAuthorization)

## Integration
npm: x402-fetch (auto-handles 402 payment flow)
MCP: @x402-api/mcp-server
ElizaOS: @x402-api/elizaos-plugin

## Links
Landing: https://x402-api.fly.dev
BaseScan: https://basescan.org/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/18763
GitHub: https://github.com/fernsugi/x402-api-server
Blog: https://dev.to/fernsugi/i-built-a-defi-data-api-where-ai-agents-pay-per-call-heres-how-oeg
`);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', hint: 'GET /api/endpoints for available routes' });
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(`[error] [${req.requestId}]`, err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
let server;

function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Start ─────────────────────────────────────────────────────────────────────
server = app.listen(PORT, () => {
  console.log('');
  console.log('  ██╗  ██╗██╗  ██╗ ██████╗ ██████╗ ');
  console.log('   ╚██╗██╔╝██║  ██║██╔═══██╗╚════██╗');
  console.log('    ╚███╔╝ ███████║██║   ██║ █████╔╝');
  console.log('    ██╔██╗ ╚════██║██║   ██║██╔═══╝ ');
  console.log('   ██╔╝ ██╗     ██║╚██████╔╝███████╗');
  console.log('   ╚═╝  ╚═╝     ╚═╝ ╚═════╝ ╚══════╝');
  console.log('');
  console.log(`  x402 API Server running on http://localhost:${PORT}`);
  console.log(`  Environment: ${NODE_ENV}`);
  console.log(`  Pay-per-call DeFi data · USDC on Base`);
  console.log('');
  console.log('  Endpoints:');
  console.log(`    /api/price-feed      → 0.001 USDC`);
  console.log(`    /api/whale-tracker   → 0.005 USDC`);
  console.log(`    /api/funding-rates   → 0.008 USDC`);
  console.log(`    /api/gas-tracker     → 0.001 USDC`);
  console.log(`    /api/token-scanner   → 0.003 USDC`);
  console.log(`    /api/dex-quotes      → 0.002 USDC`);
  console.log(`    /api/yield-scanner   → 0.005 USDC`);
  console.log(`    /api/wallet-profiler → 0.008 USDC`);
  console.log('');
  console.log(`  Receiving: ${PAY_TO_ADDRESS}`);
  console.log(`  Network: Base mainnet (chain ID 8453)`);
  console.log('');
  if (NODE_ENV !== 'production') {
    console.log('  ⚠️  DEVELOPMENT MODE: Mock payments accepted.');
    console.log('     Set NODE_ENV=production for real verification.');
  } else {
    console.log('  ✅ PRODUCTION MODE: Real on-chain verification active.');
  }
  console.log('');
});

module.exports = app;
