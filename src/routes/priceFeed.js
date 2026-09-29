/** Live BTC, ETH, SOL and market movers from CoinGecko. */
'use strict';

const express = require('express');
const axios = require('axios');
const { requirePayment } = require('../middleware/x402');
const { prepareLive } = require('../middleware/prepare-live');
const { createLiveCache } = require('../services/live-cache');

const router = express.Router();
const COINGECKO_BASE = process.env.COINGECKO_API_BASE || 'https://api.coingecko.com/api/v3';
const COINLORE_BASE = process.env.COINLORE_API_BASE || 'https://api.coinlore.net/api';
const CORE_COINS = ['bitcoin', 'ethereum', 'solana'];
const MOVER_POOL = [
  'bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple', 'cardano',
  'avalanche-2', 'polkadot', 'chainlink', 'uniswap', 'sui', 'aptos',
  'arbitrum', 'optimism', 'hyperliquid', 'berachain-bera', 'sonic',
];
const loadCached = createLiveCache(60_000, 1);

function formatCoin(id, raw) {
  if (!raw || !Number.isFinite(raw.usd) || raw.usd <= 0) return null;
  return {
    id,
    price_usd: raw.usd,
    change_24h_pct: Number.isFinite(raw.usd_24h_change)
      ? Number(raw.usd_24h_change.toFixed(2)) : null,
    volume_24h_usd: raw.usd_24h_vol ?? null,
    market_cap_usd: raw.usd_market_cap ?? null,
    last_updated: raw.last_updated_at ? new Date(raw.last_updated_at * 1000).toISOString() : null,
  };
}

async function fetchCoinGecko() {
  const { data } = await axios.get(`${COINGECKO_BASE}/simple/price`, {
      params: {
        ids: MOVER_POOL.join(','),
        vs_currencies: 'usd',
        include_24hr_change: true,
        include_24hr_vol: true,
        include_market_cap: true,
        include_last_updated_at: true,
      },
      timeout: 8_000,
      headers: { Accept: 'application/json' },
    });
  const core = CORE_COINS.map(id => formatCoin(id, data?.[id]));
  if (core.some(coin => !coin)) throw new Error('CoinGecko returned incomplete core prices');
  const movers = MOVER_POOL.filter(id => !CORE_COINS.includes(id))
    .map(id => formatCoin(id, data[id]))
    .filter(coin => coin && coin.change_24h_pct != null);
  return {
    source: 'CoinGecko',
    coverage: 'Selected major assets',
    core,
    top_movers: {
      gainers: movers.filter(coin => coin.change_24h_pct > 0)
        .sort((a, b) => b.change_24h_pct - a.change_24h_pct).slice(0, 5),
      losers: movers.filter(coin => coin.change_24h_pct < 0)
        .sort((a, b) => a.change_24h_pct - b.change_24h_pct).slice(0, 5),
    },
  };
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function fetchCoinLore() {
  const { data } = await axios.get(`${COINLORE_BASE}/tickers/`, {
    params: { start: 0, limit: 100 }, timeout: 8_000,
    headers: { Accept: 'application/json' },
  });
  if (!Array.isArray(data?.data)) throw new Error('CoinLore returned no tickers');
  const tickers = data.data.map(item => ({
    id: item.nameid,
    price_usd: numberOrNull(item.price_usd),
    change_24h_pct: numberOrNull(item.percent_change_24h),
    volume_24h_usd: numberOrNull(item.volume24),
    market_cap_usd: numberOrNull(item.market_cap_usd),
    last_updated: null,
  })).filter(item => item.id && item.price_usd != null && item.price_usd > 0);
  const core = CORE_COINS.map(id => tickers.find(item => item.id === id));
  if (core.some(item => !item)) throw new Error('CoinLore returned incomplete core prices');
  const movers = tickers.filter(item => !CORE_COINS.includes(item.id) && item.change_24h_pct != null);
  return {
    source: 'CoinLore',
    coverage: 'Top 100 ranked assets returned by CoinLore',
    core,
    top_movers: {
      gainers: movers.filter(item => item.change_24h_pct > 0)
        .sort((a, b) => b.change_24h_pct - a.change_24h_pct).slice(0, 5),
      losers: movers.filter(item => item.change_24h_pct < 0)
        .sort((a, b) => a.change_24h_pct - b.change_24h_pct).slice(0, 5),
    },
  };
}

async function getPrices() {
  return loadCached('prices', async () => {
    try { return await fetchCoinGecko(); }
    catch (primaryError) {
      try { return await fetchCoinLore(); }
      catch (backupError) {
        throw new Error(`Both price sources failed: ${primaryError.message}; ${backupError.message}`);
      }
    }
  });
}

router.get(
  '/',
  prepareLive(async () => {
    const { value: data, cached } = await getPrices();
    return { data, cached };
  }),
  requirePayment({
    resource: '/api/price-feed',
    description: 'Live BTC, ETH, SOL prices and 24-hour movers from CoinGecko or CoinLore.',
    maxAmountRequired: 1000,
  }),
  (req, res) => {
    res.json({
      timestamp: new Date().toISOString(),
      source: req.liveData.data.source,
      coverage: req.liveData.data.coverage,
      cached: req.liveData.cached,
      cache_ttl_seconds: 60,
      payment: req.x402,
      data: { core: req.liveData.data.core, top_movers: req.liveData.data.top_movers },
    });
  },
);

module.exports = router;
