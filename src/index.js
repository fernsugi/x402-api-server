/**
 * x402 API Server
 *
 * Pay-per-call crypto/DeFi data endpoints using the HTTP 402 Payment Required protocol.
 * Agents pay in USDC on Base; no API keys, no subscriptions.
 *
 * Port: 4020  (x402 → 4020, cute, right?)
 *
 * Endpoints:
 *   GET /                    → Landing page (HTML)
 *   GET /api/price-feed      → Aggregated crypto prices (0.001 USDC)
 *   GET /api/whale-tracker   → Token holder concentration (0.005 USDC)
 *   GET /api/funding-rates   → Perp funding rate arb scanner (0.008 USDC)
 *   GET /health              → Health check (free)
 *   GET /api/endpoints       → Machine-readable endpoint catalog (free)
 */

'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const priceFeedRouter = require('./routes/priceFeed');
const whaleTrackerRouter = require('./routes/whaleTracker');
const fundingRatesRouter = require('./routes/fundingRates');
const { PAY_TO_ADDRESS } = require('./middleware/x402');

const app = express();
const PORT = process.env.PORT || 4020;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'views')));

// ── API Routes (payment-gated) ───────────────────────────────────────────────
app.use('/api/price-feed', priceFeedRouter);
app.use('/api/whale-tracker', whaleTrackerRouter);
app.use('/api/funding-rates', fundingRatesRouter);

// ── Free Routes ──────────────────────────────────────────────────────────────

/** Health check — always free */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    protocol: 'x402',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
  });
});

/**
 * Machine-readable endpoint catalog.
 * Useful for AI agents discovering what this server offers without
 * having to parse HTML. Could also be served as an MCP resource.
 */
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
        params: [],
        example_response: {
          timestamp: '2026-02-21T08:00:00.000Z',
          source: 'CoinGecko',
          data: {
            core: [
              { id: 'bitcoin', price_usd: 98000, change_24h_pct: 2.1 },
              { id: 'ethereum', price_usd: 2750, change_24h_pct: -0.8 },
              { id: 'solana', price_usd: 185, change_24h_pct: 4.2 },
            ],
            top_movers: {
              gainers: [{ id: 'hyperliquid', change_24h_pct: 12.4 }],
              losers: [{ id: 'arbitrum', change_24h_pct: -5.3 }],
            },
          },
        },
      },
      {
        path: '/api/whale-tracker',
        method: 'GET',
        description: 'Token holder concentration: whale distribution, Gini coefficient, large transfer alerts.',
        price_usdc: 0.005,
        price_micro: 5000,
        params: [
          { name: 'token', type: 'string', default: 'ETH', description: 'Token symbol or address' },
          { name: 'chain', type: 'string', default: 'ethereum', description: 'Chain: ethereum | base | solana | arbitrum | optimism' },
        ],
        example_response: {
          data: {
            token: 'ETH',
            holder_count: 1250000,
            concentration_metrics: {
              top_10_pct: 38.2,
              gini_coefficient: 0.74,
            },
          },
        },
      },
      {
        path: '/api/funding-rates',
        method: 'GET',
        description: 'Perpetual futures funding rates across Hyperliquid, dYdX v4, Aevo, GMX, Drift, Vertex. Includes arb opportunity ranking.',
        price_usdc: 0.008,
        price_micro: 8000,
        params: [
          { name: 'asset', type: 'string', default: 'all', description: 'Asset symbol: BTC | ETH | SOL | ...' },
          { name: 'min_spread', type: 'number', default: 0, description: 'Minimum arb spread in bps to include in results' },
        ],
        example_response: {
          arb_opportunities: [
            { asset: 'SOL', long_venue: 'gmx', short_venue: 'drift', spread_bps: 3.8, annualized_arb_pct: 51.6, signal: 'STRONG' },
          ],
        },
      },
    ],
  });
});

/** Landing page — served from views/index.html */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', hint: 'GET /api/endpoints for available routes' });
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ██╗  ██╗██╗  ██╗ ██████╗ ██████╗ ');
  console.log('   ╚██╗██╔╝██║  ██║██╔═══██╗╚════██╗');
  console.log('    ╚███╔╝ ███████║██║   ██║ █████╔╝');
  console.log('    ██╔██╗ ╚════██║██║   ██║██╔═══╝ ');
  console.log('   ██╔╝ ██╗     ██║╚██████╔╝███████╗');
  console.log('   ╚═╝  ╚═╝     ╚═╝ ╚═════╝ ╚══════╝');
  console.log('');
  console.log(`  x402 API Server running on http://localhost:${PORT}`);
  console.log(`  Pay-per-call DeFi data · USDC on Base`);
  console.log('');
  console.log('  Endpoints:');
  console.log(`    http://localhost:${PORT}/api/price-feed      → 0.001 USDC`);
  console.log(`    http://localhost:${PORT}/api/whale-tracker   → 0.005 USDC`);
  console.log(`    http://localhost:${PORT}/api/funding-rates   → 0.008 USDC`);
  console.log('');
  console.log(`  Receiving: ${PAY_TO_ADDRESS}`);
  console.log(`  Network: Base mainnet (chain ID 8453)`);
  console.log('');
  console.log('  ⚠️  MOCK MODE: Payment verification is not real.');
  console.log('     Wire up real Base chain verification before going live.');
  console.log('');
});

module.exports = app;
