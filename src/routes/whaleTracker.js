/** Live top-holder concentration from GoPlus token security data. */
'use strict';

const express = require('express');
const { requirePayment } = require('../middleware/x402');
const { prepareLive } = require('../middleware/prepare-live');
const { getTokenSecurity, numberOrNull } = require('../services/goplus');

const router = express.Router();

function sumPercent(holders) {
  if (holders.length === 0 || holders.some(holder => holder.percentage === null)) return null;
  return Number(holders.reduce((sum, holder) => sum + (holder.percentage || 0), 0).toFixed(4));
}

router.get(
  '/',
  prepareLive(async req => {
    const token = String(req.query.token ?? 'ETH').trim();
    const chain = String(req.query.chain ?? 'ethereum').trim().toLowerCase();
    const { raw, cached, address } = await getTokenSecurity(token, chain);
    if (!Array.isArray(raw.holders) || raw.holders.length === 0) {
      throw new Error('GoPlus returned no holder distribution for this token');
    }

    const holders = raw.holders
      .map((holder, index) => ({
        rank: index + 1,
        address: holder.address,
        label: holder.tag || null,
        wallet_type: holder.is_contract ? 'contract' : 'wallet',
        balance: holder.balance || null,
        percentage: numberOrNull(holder.percent) == null
          ? null : Number((Number(holder.percent) * 100).toFixed(4)),
        is_contract: Boolean(holder.is_contract),
        is_locked: holder.is_locked === 1 || holder.is_locked === '1',
      }))
      .filter(holder => /^0x[0-9a-fA-F]{40}$/.test(holder.address));

    const data = {
      token: raw.token_symbol || token.toUpperCase(),
      token_address: address,
      chain,
      total_supply: raw.total_supply || null,
      circulating_supply: null,
      holder_count: numberOrNull(raw.holder_count),
      concentration_metrics: {
        top_1_pct: holders[0]?.percentage ?? null,
        top_10_pct: sumPercent(holders.slice(0, 10)),
        top_20_pct: holders.length >= 20 ? sumPercent(holders.slice(0, 20)) : null,
        gini_coefficient: null,
        herfindahl_index: null,
      },
      distribution_buckets: [],
      top_holders: holders,
      recent_large_transfers: [],
      coverage: {
        holders_returned: holders.length,
        gini_available: false,
        recent_transfers_available: false,
        note: 'Top-holder sample only. Full distribution and transfer history are not supplied by this provider.',
      },
    };
    return { token, chain, cached, data };
  }),
  requirePayment({
    resource: '/api/whale-tracker',
    description: 'Current top-holder concentration for an ERC-20 token from GoPlus. Full Gini and transfer alerts are unavailable.',
    maxAmountRequired: 5000,
  }),
  (req, res) => {
    const { token, chain, cached, data } = req.liveData;
    res.json({
      timestamp: new Date().toISOString(),
      source: 'GoPlus',
      cached,
      cache_ttl_seconds: 60,
      payment: req.x402,
      query: { token, chain },
      data,
    });
  },
);

module.exports = router;
