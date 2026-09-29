/** Live hourly perpetual funding data from Hyperliquid and dYdX. */
'use strict';

const express = require('express');
const axios = require('axios');
const { requirePayment } = require('../middleware/x402');
const { prepareLive, RequestError } = require('../middleware/prepare-live');
const { createLiveCache } = require('../services/live-cache');

const router = express.Router();
const PRICE_MICRO = 8000;
const HYPERLIQUID_URL = process.env.HYPERLIQUID_INFO_URL || 'https://api.hyperliquid.xyz/info';
const DYDX_URL = process.env.DYDX_MARKETS_URL || 'https://indexer.dydx.trade/v4/perpetualMarkets';
const loadCached = createLiveCache(30_000, 1);

function finiteNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rateEntry(rate, openInterestUsd, rateKind) {
  return {
    funding_rate: rate,
    funding_interval_hours: 1,
    annualized_pct: Number((rate * 24 * 365 * 100).toFixed(2)),
    open_interest_usd: openInterestUsd == null ? null : Number(openInterestUsd.toFixed(2)),
    rate_kind: rateKind,
  };
}

async function fetchRates() {
  return loadCached('all', async () => {
    const [hlResponse, dydxResponse] = await Promise.allSettled([
      axios.post(HYPERLIQUID_URL, { type: 'metaAndAssetCtxs' }, {
        timeout: 8_000, headers: { 'Content-Type': 'application/json' },
      }),
      axios.get(DYDX_URL, { timeout: 8_000, headers: { Accept: 'application/json' } }),
    ]);

    const [metadata, contexts] = hlResponse.status === 'fulfilled' ? hlResponse.value.data || [] : [];
    const dydxMarkets = dydxResponse.status === 'fulfilled' ? dydxResponse.value.data?.markets : null;
    if ((!Array.isArray(metadata?.universe) || !Array.isArray(contexts)) &&
        (!dydxMarkets || typeof dydxMarkets !== 'object')) {
      throw new Error('Both funding providers are unavailable');
    }

    const rates = {};
    (metadata?.universe || []).forEach((market, index) => {
      if (market.isDelisted || !market.name) return;
      const context = contexts[index];
      const rate = finiteNumber(context?.funding);
      const openInterest = finiteNumber(context?.openInterest);
      const markPrice = finiteNumber(context?.markPx);
      if (rate == null) return;
      rates[market.name] = {
        hyperliquid: rateEntry(rate, openInterest != null && markPrice != null
          ? openInterest * markPrice : null, 'current'),
      };
    });

    for (const market of Object.values(dydxMarkets || {})) {
      if (market.status !== 'ACTIVE' || !market.ticker?.endsWith('-USD')) continue;
      const asset = market.ticker.slice(0, -4);
      const rate = finiteNumber(market.nextFundingRate);
      const openInterest = finiteNumber(market.openInterest);
      const oraclePrice = finiteNumber(market.oraclePrice);
      if (rate == null) continue;
      rates[asset] ||= {};
      rates[asset].dydx_v4 = rateEntry(rate, openInterest != null && oraclePrice != null
        ? openInterest * oraclePrice : null, 'next_predicted');
    }

    if (Object.keys(rates).length === 0) throw new Error('No live funding rates found');
    return {
      rates,
      available: [
        ...(Array.isArray(metadata?.universe) ? ['hyperliquid'] : []),
        ...(dydxMarkets && typeof dydxMarkets === 'object' ? ['dydx_v4'] : []),
      ],
    };
  });
}

function spreadRows(rates, minSpreadBps) {
  const rows = [];
  for (const [asset, venues] of Object.entries(rates)) {
    const entries = Object.entries(venues).sort((a, b) => a[1].funding_rate - b[1].funding_rate);
    if (entries.length < 2) continue;
    const [lowVenue, low] = entries[0];
    const [highVenue, high] = entries[entries.length - 1];
    const spread = (high.funding_rate - low.funding_rate) * 10_000;
    if (spread < minSpreadBps) continue;
    rows.push({
      asset,
      long_venue: lowVenue,
      long_rate: low.funding_rate,
      short_venue: highVenue,
      short_rate: high.funding_rate,
      spread_bps: Number(spread.toFixed(4)),
      annualized_arb_pct: Number((spread * 24 * 365 / 100).toFixed(2)),
      note: 'Indicative rate spread only; venues report current versus predicted rates. Trading fees, basis risk and funding changes are excluded.',
    });
  }
  return rows.sort((a, b) => b.spread_bps - a.spread_bps);
}

router.get(
  '/',
  prepareLive(async req => {
    const asset = String(req.query.asset ?? 'all').trim().toUpperCase();
    if (asset !== 'ALL' && !/^[A-Z0-9]{2,15}$/.test(asset)) {
      throw new RequestError('asset must be a perp symbol such as BTC');
    }
    const minSpreadText = String(req.query.min_spread ?? '0').trim();
    const minSpreadBps = Number(minSpreadText);
    if (!minSpreadText || !Number.isFinite(minSpreadBps) || minSpreadBps < 0) {
      throw new RequestError('min_spread must be a non-negative number of basis points');
    }
    const { value: live, cached } = await fetchRates();
    const allRates = live.rates;
    if (asset !== 'ALL' && !allRates[asset]) throw new RequestError(`No live funding market for ${asset}`, 404);
    const rates = asset === 'ALL' ? allRates : { [asset]: allRates[asset] };
    return { asset, minSpreadBps, rates, cached, available: live.available,
      opportunities: spreadRows(rates, minSpreadBps) };
  }),
  requirePayment({
    resource: '/api/funding-rates',
    description: 'Live hourly perpetual funding rates from Hyperliquid and dYdX with indicative spread comparison.',
    maxAmountRequired: PRICE_MICRO,
  }),
  (req, res) => {
    const { asset, minSpreadBps, rates, cached, available, opportunities } = req.liveData;
    res.json({
      timestamp: new Date().toISOString(),
      source: available.map(name => name === 'dydx_v4' ? 'dYdX v4' : 'Hyperliquid'),
      cached,
      cache_ttl_seconds: 30,
      payment: req.x402,
      query: { asset: asset.toLowerCase() === 'all' ? 'all' : asset, min_spread_bps: minSpreadBps },
      protocols: available,
      unavailable_protocols: ['hyperliquid', 'dydx_v4'].filter(name => !available.includes(name)),
      assets_covered: Object.keys(rates),
      funding_interval_hours: 1,
      data: rates,
      arb_opportunities: opportunities,
    });
  },
);

module.exports = router;
