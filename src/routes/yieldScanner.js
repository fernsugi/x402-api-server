/** Live yield pools from DefiLlama. Upstream data is checked before payment. */
'use strict';

const express = require('express');
const axios = require('axios');
const { requirePayment } = require('../middleware/x402');
const { prepareLive, RequestError } = require('../middleware/prepare-live');
const { createLiveCache } = require('../services/live-cache');

const router = express.Router();
const PRICE_MICRO = 5000;
const POOLS_URL = process.env.DEFILLAMA_YIELDS_URL || 'https://yields.llama.fi/pools';
const loadCached = createLiveCache(5 * 60_000, 1);
const VALID_CHAINS = ['ethereum', 'base', 'arbitrum', 'polygon', 'all'];

async function getPools() {
  return loadCached('all-pools', async () => {
    const { data } = await axios.get(POOLS_URL, {
      timeout: 15_000,
      maxContentLength: 20_000_000,
      headers: { Accept: 'application/json' },
    });
    if (!Array.isArray(data?.data) || data.data.length === 0) {
      throw new Error('DefiLlama returned no yield pools');
    }
    return data.data;
  });
}

function parseQuery(query) {
  const chain = String(query.chain ?? 'all').trim().toLowerCase();
  if (!VALID_CHAINS.includes(chain)) throw new RequestError(`Invalid chain. Use: ${VALID_CHAINS.join(', ')}`);

  const minTvlText = String(query.min_tvl ?? '0').trim();
  const minTvl = Number(minTvlText);
  if (!minTvlText || !Number.isFinite(minTvl) || minTvl < 0) {
    throw new RequestError('min_tvl must be a non-negative finite number');
  }

  const limitText = String(query.limit ?? '20').trim();
  const limit = Number(limitText);
  if (!/^\d+$/.test(limitText) || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new RequestError('limit must be an integer from 1 to 50');
  }

  const asset = String(query.asset ?? '').trim().toUpperCase();
  if (asset && !/^[A-Z0-9._/-]{1,30}$/.test(asset)) {
    throw new RequestError('asset must be a token symbol, such as USDC');
  }
  return { chain, min_tvl: minTvl, asset: asset || 'all', limit };
}

router.get(
  '/',
  prepareLive(async req => {
    const query = parseQuery(req.query);
    const { value: pools, cached } = await getPools();
    const data = pools
      .filter(pool => !pool.outlier && Number.isFinite(pool.apy) && pool.apy >= 0 &&
        Number.isFinite(pool.tvlUsd) && pool.tvlUsd >= query.min_tvl &&
        (query.chain === 'all' || String(pool.chain).toLowerCase() === query.chain) &&
        (query.asset === 'all' || String(pool.symbol).toUpperCase().includes(query.asset)))
      .sort((a, b) => b.apy - a.apy)
      .slice(0, query.limit)
      .map(pool => ({
        pool_id: pool.pool,
        protocol: pool.project,
        asset: pool.symbol,
        chain: String(pool.chain).toLowerCase(),
        apy: pool.apy,
        apy_base: pool.apyBase ?? null,
        apy_reward: pool.apyReward ?? null,
        tvl: pool.tvlUsd,
        stablecoin: pool.stablecoin ?? null,
        il_risk: pool.ilRisk ?? null,
        exposure: pool.exposure ?? null,
      }));
    return { query, data, cached };
  }),
  requirePayment({
    resource: '/api/yield-scanner',
    description: 'Current DeFi pool APYs and TVL from DefiLlama, filterable by chain, asset, and TVL.',
    maxAmountRequired: PRICE_MICRO,
  }),
  (req, res) => {
    const { query, data, cached } = req.liveData;
    res.json({
      timestamp: new Date().toISOString(),
      source: 'DefiLlama',
      cached,
      cache_ttl_seconds: 300,
      payment: req.x402,
      query,
      total_results: data.length,
      data,
      metadata: { note: 'APY is historical/provider reported, not a guarantee. No protocol safety rating is inferred.' },
    });
  },
);

module.exports = router;
