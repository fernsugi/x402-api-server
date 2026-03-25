/**
 * /api/price-feed
 *
 * Aggregated crypto prices: BTC, ETH, SOL + top movers by 24h change.
 * Data sourced from CoinGecko public API (no API key required for basic use).
 *
 * x402 Price: 0.001 USDC (1000 micro-units)
 */

'use strict';

const express = require('express');
const axios = require('axios');
const { requirePayment } = require('../middleware/x402');

const router = express.Router();

// Price: 0.001 USDC = 1000 micro-units (6 decimal places)
const PRICE_MICRO = 1000;

// CoinGecko free API endpoint
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// Core coins always included
const CORE_COINS = ['bitcoin', 'ethereum', 'solana'];

// Top coins to scan for top movers
const MOVER_POOL = [
  'bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple',
  'cardano', 'avalanche-2', 'polkadot', 'chainlink', 'uniswap',
  'sui', 'aptos', 'arbitrum', 'optimism', 'base',
  'hyperliquid', 'berachain-bera', 'sonic', 'story-protocol',
];

/**
 * Fetch prices from CoinGecko with a simple in-memory cache (60s TTL).
 * This reduces CoinGecko rate-limit pressure and speeds up responses.
 */
const cache = { data: null, ts: 0, TTL_MS: 60_000 };

async function fetchPrices() {
  const now = Date.now();
  if (cache.data && now - cache.ts < cache.TTL_MS) {
    return { data: cache.data, cached: true };
  }

  const ids = [...new Set([...CORE_COINS, ...MOVER_POOL])].join(',');
  const url = `${COINGECKO_BASE}/simple/price`;

  const response = await axios.get(url, {
    params: {
      ids,
      vs_currencies: 'usd',
      include_24hr_change: true,
      include_24hr_vol: true,
      include_market_cap: true,
      include_last_updated_at: true,
    },
    timeout: 8000,
    headers: { 'Accept': 'application/json' },
  });

  cache.data = response.data;
  cache.ts = now;
  return { data: response.data, cached: false };
}

/**
 * Format a raw CoinGecko price entry into a clean response object.
 */
function formatCoin(id, raw) {
  if (!raw) return null;
  return {
    id,
    price_usd: raw.usd ?? null,
    change_24h_pct: raw.usd_24h_change != null ? parseFloat(raw.usd_24h_change.toFixed(2)) : null,
    volume_24h_usd: raw.usd_24h_vol ?? null,
    market_cap_usd: raw.usd_market_cap ?? null,
    last_updated: raw.last_updated_at ? new Date(raw.last_updated_at * 1000).toISOString() : null,
  };
}

// Apply x402 payment gate
router.get(
  '/',
  requirePayment({
    resource: '/api/price-feed',
    description: 'Aggregated crypto price feed: BTC, ETH, SOL + top movers by 24h change. Live data from CoinGecko.',
    maxAmountRequired: PRICE_MICRO,
  }),
  async (req, res) => {
    try {
      const { data: raw, cached } = await fetchPrices();

      // Core assets — always returned
      const core = CORE_COINS.map(id => formatCoin(id, raw[id])).filter(Boolean);

      // Top movers — top 5 gainers + top 5 losers (excluding core coins)
      const moversRaw = MOVER_POOL
        .filter(id => !CORE_COINS.includes(id))
        .map(id => formatCoin(id, raw[id]))
        .filter(c => c && c.change_24h_pct !== null);

      const topGainers = moversRaw
        .filter(c => c.change_24h_pct > 0)
        .sort((a, b) => b.change_24h_pct - a.change_24h_pct)
        .slice(0, 5);

      const topLosers = moversRaw
        .filter(c => c.change_24h_pct < 0)
        .sort((a, b) => a.change_24h_pct - b.change_24h_pct)
        .slice(0, 5);

      res.json({
        timestamp: new Date().toISOString(),
        source: 'CoinGecko',
        cached,
        cache_ttl_seconds: cache.TTL_MS / 1000,
        payment: req.x402,
        data: {
          core,
          top_movers: {
            gainers: topGainers,
            losers: topLosers,
          },
        },
      });
    } catch (err) {
      console.error('[price-feed] CoinGecko error:', err.message);

      // Return structured error with fallback mock for dev purposes
      res.status(503).json({
        error: 'Upstream data unavailable',
        message: err.message,
        fallback: {
          timestamp: new Date().toISOString(),
          source: 'mock_fallback',
          data: {
            core: [
              { id: 'bitcoin', price_usd: 98000, change_24h_pct: 2.1, volume_24h_usd: 38_000_000_000, market_cap_usd: 1_920_000_000_000 },
              { id: 'ethereum', price_usd: 2750, change_24h_pct: -0.8, volume_24h_usd: 18_500_000_000, market_cap_usd: 330_000_000_000 },
              { id: 'solana', price_usd: 185, change_24h_pct: 4.2, volume_24h_usd: 5_200_000_000, market_cap_usd: 87_000_000_000 },
            ],
          },
        },
      });
    }
  }
);

module.exports = router;
