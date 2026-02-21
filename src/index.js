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

const app = express();
const PORT = process.env.PORT || 4020;
const NODE_ENV = process.env.NODE_ENV || 'development';

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
