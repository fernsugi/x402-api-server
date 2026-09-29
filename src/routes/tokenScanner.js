/** Live ERC-20 security signals from GoPlus. */
'use strict';

const express = require('express');
const { requirePayment } = require('../middleware/x402');
const { prepareLive } = require('../middleware/prepare-live');
const { getTokenSecurity, flag, numberOrNull } = require('../services/goplus');

const router = express.Router();

function scan(raw, address, chain) {
  const isOpenSource = flag(raw.is_open_source);
  const isHoneypot = flag(raw.is_honeypot);
  const cannotBuy = flag(raw.cannot_buy);
  const hasProxy = flag(raw.is_proxy);
  const mintable = flag(raw.is_mintable);
  const buyTax = numberOrNull(raw.buy_tax);
  const sellTax = numberOrNull(raw.sell_tax);

  // A simple disclosed heuristic, based only on signals the provider returned.
  let score = 0;
  if (isHoneypot) score += 55;
  if (cannotBuy) score += 30;
  if (isOpenSource === false) score += 15;
  if (hasProxy) score += 10;
  if (mintable) score += 15;
  if (buyTax != null && buyTax > 5) score += 10;
  if (sellTax != null && sellTax > 10) score += 15;
  score = Math.min(score, 100);
  const enoughSignals = isHoneypot !== null && isOpenSource !== null;
  const riskScore = enoughSignals ? score : null;
  const riskLevel = riskScore == null ? 'UNKNOWN' : riskScore >= 75 ? 'CRITICAL'
    : riskScore >= 50 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW';

  return {
    address,
    name: raw.token_name || null,
    symbol: raw.token_symbol || null,
    chain,
    deployer: raw.creator_address || null,
    deploy_date: null,
    total_supply: raw.total_supply || null,
    holder_count: numberOrNull(raw.holder_count),
    is_verified: isOpenSource,
    has_proxy: hasProxy,
    has_mint_function: mintable,
    liquidity_locked: null,
    honeypot_risk: isHoneypot,
    buy_tax: buyTax,
    sell_tax: sellTax,
    liquidity_usd: null,
    market_cap_usd: null,
    price_usd: null,
    risk_score: riskScore,
    risk_score_basis: 'Local heuristic over available GoPlus flags; not an audit or guarantee',
    risk_level: riskLevel,
    risk_flags: {
      is_verified: isOpenSource,
      has_proxy: hasProxy,
      has_mint_function: mintable,
      liquidity_locked: null,
      honeypot_risk: isHoneypot,
      cannot_buy: cannotBuy,
      high_buy_tax: buyTax == null ? null : buyTax > 5,
      high_sell_tax: sellTax == null ? null : sellTax > 10,
    },
    age_days: null,
  };
}

router.get(
  '/',
  prepareLive(async req => {
    const token = String(req.query.token ?? 'PEPE').trim();
    const chain = String(req.query.chain ?? 'ethereum').trim().toLowerCase();
    const { raw, cached, address } = await getTokenSecurity(token, chain);
    return { token, chain, cached, data: scan(raw, address, chain) };
  }),
  requirePayment({
    resource: '/api/token-scanner',
    description: 'Current GoPlus ERC-20 security signals and a disclosed heuristic risk score. Use a contract address or supported symbol.',
    maxAmountRequired: 3000,
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
