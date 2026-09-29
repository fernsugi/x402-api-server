/**
 * x402 API Server — Production
 *
 * Pay-per-call crypto/DeFi data endpoints using HTTP 402 Payment Required.
 * Agents pay in USDC on Base; no API keys, no subscriptions.
 *
 * Endpoints:
 *   GET /                    → Landing page
 *   GET /api/price-feed      → Aggregated crypto prices (0.001 USDC)
 *   GET /api/whale-tracker   → Observed top-holder concentration (0.005 USDC)
 *   GET /api/funding-rates   → Indicative perp funding spreads (0.008 USDC)
 *   GET /api/gas-tracker     → Multi-chain gas prices (0.001 USDC)
 *   GET /api/token-scanner   → GoPlus security signals (0.003 USDC)
 *   GET /api/dex-quotes      → ParaSwap route quote (0.002 USDC)
 *   GET /api/yield-scanner   → Top DeFi yields (0.005 USDC)
 *   GET /api/wallet-profiler → Observed wallet balances (0.008 USDC)
 *   GET /health              → Health check (free)
 *   GET /api/endpoints       → Machine-readable endpoint catalog (free)
 */

'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { version: APP_VERSION } = require('../package.json');

const priceFeedRouter = require('./routes/priceFeed');
const whaleTrackerRouter = require('./routes/whaleTracker');
const fundingRatesRouter = require('./routes/fundingRates');
const gasTrackerRouter = require('./routes/gasTracker');
const tokenScannerRouter = require('./routes/tokenScanner');
const dexQuotesRouter = require('./routes/dexQuotes');
const yieldScannerRouter = require('./routes/yieldScanner');
const walletProfilerRouter = require('./routes/walletProfiler');
const {
  PAY_TO_ADDRESS,
  SUPPORTED_PAYMENT_PROOFS,
  EXPERIMENTAL_PAYMENT_PROOFS,
} = require('./middleware/x402');
const { getSettlementMode, isEip3009SettlementConfigured } = require('./payment-config');
const { BAZAAR_SCHEMAS } = require('./bazaar-schemas');

const app = express();
const PORT = process.env.PORT || 4020;
const NODE_ENV = process.env.NODE_ENV || 'development';
const EIP3009_SETTLEMENT_MODE = getSettlementMode();
const EIP3009_STATUS_LINE = isEip3009SettlementConfigured()
  ? `- EIP-3009 transferWithAuthorization: enabled in this deployment via ${EIP3009_SETTLEMENT_MODE} settlement`
  : '- EIP-3009 transferWithAuthorization: disabled in this deployment until settlement credentials are configured';

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
    version: APP_VERSION,
    protocol: 'x402',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    pay_to: PAY_TO_ADDRESS,
  });
});

function endpointCatalog() {
  return {
    x402Version: 1,
    server: 'x402-api-server',
    description: 'Pay-per-call crypto/DeFi data API using the x402 payment protocol',
    pay_to: PAY_TO_ADDRESS,
    network: 'base',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    asset_name: 'USDC',
    payment_proofs_supported: SUPPORTED_PAYMENT_PROOFS,
    payment_proofs_experimental: EXPERIMENTAL_PAYMENT_PROOFS,
    endpoints: [
      {
        path: '/api/price-feed',
        method: 'GET',
        description: 'BTC, ETH, SOL prices and selected 24h movers from CoinGecko or CoinLore fallback.',
        price_usdc: 0.001,
        price_micro: 1000,
      },
      {
        path: '/api/whale-tracker',
        method: 'GET',
        description: 'GoPlus top-holder sample and reported supply concentration; no transfer history or Gini.',
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
        description: 'Hourly Hyperliquid and dYdX v4 funding rates with indicative spread comparison.',
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
        description: 'GoPlus ERC-20 security flags and disclosed heuristic risk score; unavailable fields are null.',
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
        description: 'One live ParaSwap aggregate route quote; no independent DEX comparison.',
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
        description: 'Live DefiLlama pool APYs and TVL, filterable by chain, asset, and TVL.',
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
        description: 'Priced wallet balances from Blockscout or limited public RPC fallback; partial coverage disclosed.',
        price_usdc: 0.008,
        price_micro: 8000,
        params: [
          { name: 'address', required: true },
          { name: 'chain', default: 'all' },
        ],
      },
    ],
  };
}

app.get('/api/endpoints', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(endpointCatalog());
});

// A stable, public discovery document for agents that start from the domain.
// Bazaar registration itself still requires a facilitator to settle and index
// a paid request; this manifest does not assert a marketplace listing.
app.get(['/.well-known/x402', '/.well-known/x402.json'], (req, res) => {
  const catalog = endpointCatalog();
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    name: 'x402-api',
    description: 'Pay-per-call crypto and DeFi data for AI agents',
    url: 'https://x402-api.fly.dev',
    x402Version: catalog.x402Version,
    network: catalog.network,
    asset: catalog.asset,
    payTo: catalog.pay_to,
    endpoints: catalog.endpoints,
    openapi: 'https://x402-api.fly.dev/openapi.json',
    llms: 'https://x402-api.fly.dev/llms.txt',
    bazaarCatalog: 'https://x402-api.fly.dev/api/bazaar',
    agentRegistration: 'https://x402-api.fly.dev/.well-known/agent-registration.json',
    mcp: {
      registryName: 'io.github.fernsugi/x402-api',
      npmPackage: '@x402-api/mcp-server',
    },
  });
});

app.get('/openapi.json', (req, res) => {
  const catalog = endpointCatalog();
  const paths = Object.fromEntries(catalog.endpoints.map((endpoint) => [endpoint.path, {
    get: {
      operationId: endpoint.path.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
      summary: endpoint.description,
      description: `Price: ${endpoint.price_usdc} USDC per successful call on Base. Request without payment to receive an x402 v1 challenge. Upstream data is checked before payment is requested.`,
      parameters: (endpoint.params || []).map(param => ({
        name: param.name,
        in: 'query',
        required: Boolean(param.required),
        schema: {
          type: typeof param.default === 'number' ? 'number' : 'string',
          ...(param.default !== undefined ? { default: param.default } : {}),
        },
      })),
      responses: {
        200: { description: 'Live data returned after payment', content: { 'application/json': { schema: { type: 'object' } } } },
        402: { description: 'x402 v1 payment challenge, including price and Base USDC payment requirements', content: { 'application/json': { schema: { type: 'object' } } } },
        400: { description: 'Invalid query parameters' },
        503: { description: 'Live upstream data unavailable; no payment requested' },
      },
    },
  }]));
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    openapi: '3.1.0',
    info: { title: 'x402-api', version: APP_VERSION, description: 'Eight paid crypto and DeFi data endpoints. HTTP 402 challenges describe USDC payment on Base.' },
    servers: [{ url: 'https://x402-api.fly.dev' }],
    paths,
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
    payment_proofs_supported: SUPPORTED_PAYMENT_PROOFS,
    payment_proofs_experimental: EXPERIMENTAL_PAYMENT_PROOFS,
    resources: Object.entries(BAZAAR_SCHEMAS).map(([path, schema]) => ({
      path,
      method: 'GET',
      schema,
    })),
    _note: 'V1 discovery is in accepts[].outputSchema on 402 responses. Facilitator indexing requires a settled request. Production proof support depends on settlement configuration; legacy txHash is opt-in.',
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

GET /api/price-feed      $0.001 USDC  BTC/ETH/SOL prices + selected movers (CoinGecko/CoinLore)
GET /api/gas-tracker     $0.001 USDC  Multi-chain gas: ETH, Base, Polygon, Arbitrum
GET /api/dex-quotes      $0.002 USDC  ParaSwap aggregate route (params: ?from=ETH&to=USDC&amount=1)
GET /api/token-scanner   $0.003 USDC  Token security analysis (params: ?token=PEPE)
GET /api/whale-tracker   $0.005 USDC  GoPlus top-holder sample (params: ?token=ETH)
GET /api/yield-scanner   $0.005 USDC  Top DeFi yields across protocols (params: ?chain=ethereum&min_tvl=1000000)
GET /api/funding-rates   $0.008 USDC  Hyperliquid and dYdX hourly rates and indicative spreads (params: ?asset=ETH)
GET /api/wallet-profiler $0.008 USDC  Observed priced balances; coverage can be partial (params: ?address=0x...)

## Free Endpoints
GET /health                           Server health check
GET /api/endpoints                    Machine-readable endpoint catalog (JSON)
GET /api/bazaar                       Bazaar discovery schemas (JSON)
GET /.well-known/x402                Public agent discovery manifest (JSON)
GET /openapi.json                    OpenAPI 3.1 description of paid routes
GET /.well-known/agent-registration.json  ERC-8004 registration file

## Payment
Network: Base (chain ID 8453)
Asset: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
Pay-to: ${PAY_TO_ADDRESS}
Protocol: x402 (402 payment instructions + Base64 payment proof in X-Payment)

## Current Payment Proofs
- Legacy txHash proof is disabled unless X402_ENABLE_TXHASH=true with durable shared X402_DATA_DIR
${EIP3009_STATUS_LINE}

## Integration
npm: @x402-api/mcp-server or @x402-api/elizaos-plugin (Base EIP-3009 clients)
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

server.on('error', (err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

module.exports = app;
