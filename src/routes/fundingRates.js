/**
 * /api/funding-rates
 *
 * Perpetual futures funding rate comparison across major protocols.
 * Identifies arbitrage opportunities where funding rate differentials
 * can be captured by simultaneously going long on one venue and short on another.
 *
 * Protocols covered: Hyperliquid, dYdX v4, Aevo, GMX, Drift (Solana), Vertex
 *
 * ⚠️  MOCK DATA — Structure is production-realistic; replace with real
 *     protocol API calls to each venue's funding rate endpoints.
 *     Most protocols expose funding rates via public REST APIs.
 *
 * Query params:
 *   ?asset=<BTC|ETH|SOL|...>   (default: shows all)
 *   ?min_spread=<number>         Filter for arb spreads >= N bps (default: 0)
 *
 * x402 Price: 0.008 USDC (8000 micro-units)
 */

'use strict';

const express = require('express');
const { requirePayment } = require('../middleware/x402');

const router = express.Router();

// Price: 0.008 USDC = 8000 micro-units
const PRICE_MICRO = 8000;

const PROTOCOLS = ['hyperliquid', 'dydx_v4', 'aevo', 'gmx', 'drift', 'vertex'];

const ASSETS = ['BTC', 'ETH', 'SOL', 'SUI', 'AVAX', 'ARB', 'OP', 'DOGE', 'LINK', 'UNI'];

/**
 * ⚠️  MOCK: Generate realistic funding rate data.
 *
 * Real implementation:
 *   - Hyperliquid: GET https://api.hyperliquid.xyz/info (type: "metaAndAssetCtxs")
 *   - dYdX v4: GET https://indexer.dydx.trade/v4/perpetualMarkets
 *   - Aevo: GET https://api.aevo.xyz/funding
 *   - GMX: On-chain from GMX V2 contracts
 *   - Drift: On-chain Solana / Drift SDK
 *   - Vertex: GET https://prod.vertexprotocol.com/v1/query?type=all_products
 */
function generateMockFundingRates(timestamp) {
  const t = timestamp / 1000; // seconds since epoch

  // Simulate time-varying rates with sinusoidal base + noise
  function rate(base, protocol, asset) {
    const pSeed = protocol.length * 7;
    const aSeed = asset.charCodeAt(0) * 13;
    const drift = Math.sin(t / 3600 + pSeed) * 0.0002;
    const noise = ((pSeed * aSeed * 9301 + t) % 233280) / 233280 * 0.0004 - 0.0002;
    return parseFloat((base + drift + noise).toFixed(6));
  }

  const baseRates = {
    BTC: 0.0001,
    ETH: 0.00008,
    SOL: 0.00015,
    SUI: 0.0003,
    AVAX: 0.00012,
    ARB: -0.00005,
    OP: 0.00018,
    DOGE: 0.00025,
    LINK: 0.00009,
    UNI: 0.00006,
  };

  const protocolMultipliers = {
    hyperliquid: 1.0,
    dydx_v4: 0.9,
    aevo: 1.15,
    gmx: 0.8,
    drift: 1.2,
    vertex: 0.95,
  };

  const result = {};
  for (const asset of ASSETS) {
    result[asset] = {};
    for (const protocol of PROTOCOLS) {
      const base = (baseRates[asset] || 0.0001) * protocolMultipliers[protocol];
      const r = rate(base, protocol, asset);
      result[asset][protocol] = {
        funding_rate: r,                              // Per 8h funding rate (fraction)
        annualized_pct: parseFloat((r * 3 * 365 * 100).toFixed(2)), // APR %
        predicted_rate: rate(base * 1.05, protocol, asset),
        open_interest_usd: Math.floor(((protocol.length * asset.length * 1_234_567) % 5_000_000_000) + 100_000_000),
        next_funding_in_ms: 8 * 3600 * 1000 - (timestamp % (8 * 3600 * 1000)),
        last_updated: new Date(timestamp).toISOString(),
      };
    }
  }
  return result;
}

/**
 * Find funding rate arbitrage opportunities across protocols.
 * Long on lowest-rate venue, short on highest-rate venue.
 */
function findArbOpportunities(rates, minSpreadBps = 0) {
  const opportunities = [];

  for (const asset of Object.keys(rates)) {
    const entries = Object.entries(rates[asset]).map(([protocol, data]) => ({
      protocol,
      rate: data.funding_rate,
      annualized_pct: data.annualized_pct,
    }));

    entries.sort((a, b) => a.rate - b.rate);

    const lowest = entries[0];
    const highest = entries[entries.length - 1];
    const spreadBps = parseFloat(((highest.rate - lowest.rate) * 10000).toFixed(2));

    if (spreadBps >= minSpreadBps) {
      const annualizedArb = parseFloat(((highest.rate - lowest.rate) * 3 * 365 * 100).toFixed(2));
      opportunities.push({
        asset,
        long_venue: lowest.protocol,
        long_rate: lowest.rate,
        short_venue: highest.protocol,
        short_rate: highest.rate,
        spread_bps: spreadBps,
        annualized_arb_pct: annualizedArb,
        signal: annualizedArb > 20 ? 'STRONG' : annualizedArb > 8 ? 'MODERATE' : 'WEAK',
        note: `Go long ${asset}-PERP on ${lowest.protocol}, short on ${highest.protocol}. Net carry: ${annualizedArb.toFixed(1)}% APR`,
      });
    }
  }

  return opportunities.sort((a, b) => b.annualized_arb_pct - a.annualized_arb_pct);
}

// Apply x402 payment gate
router.get(
  '/',
  requirePayment({
    resource: '/api/funding-rates',
    description: 'Perpetual futures funding rate comparison across Hyperliquid, dYdX v4, Aevo, GMX, Drift, Vertex. Includes arb spread analysis.',
    maxAmountRequired: PRICE_MICRO,
  }),
  (req, res) => {
    const assetFilter = req.query.asset?.toString().toUpperCase().trim();

    // Validate min_spread: must be a finite, non-negative number
    const rawMinSpread = parseFloat(req.query.min_spread || '0');
    if (!isFinite(rawMinSpread) || rawMinSpread < 0) {
      return res.status(400).json({
        error: 'Invalid min_spread',
        hint: 'min_spread must be a non-negative finite number (e.g. 0, 0.5, 2)',
      });
    }
    const minSpreadBps = rawMinSpread;

    const now = Date.now();
    // ⚠️  MOCK DATA
    const allRates = generateMockFundingRates(now);

    // Filter by asset if specified
    let rates = allRates;
    if (assetFilter) {
      if (!ASSETS.includes(assetFilter)) {
        return res.status(400).json({
          error: 'Unknown asset',
          valid_assets: ASSETS,
        });
      }
      rates = { [assetFilter]: allRates[assetFilter] };
    }

    const arbOpportunities = findArbOpportunities(rates, minSpreadBps);

    res.json({
      timestamp: new Date(now).toISOString(),
      source: 'mock', // ⚠️ Replace with real protocol API calls in production
      mock_warning: 'Funding rates are procedurally generated for demo purposes.',
      payment: req.x402,
      query: { asset: assetFilter || 'all', min_spread_bps: minSpreadBps },
      protocols: PROTOCOLS,
      assets_covered: ASSETS,
      funding_interval_hours: 8,
      data: rates,
      arb_opportunities: arbOpportunities,
      metadata: {
        // Real funding rate sources to integrate:
        real_sources: {
          hyperliquid: 'https://api.hyperliquid.xyz/info',
          dydx_v4: 'https://indexer.dydx.trade/v4/perpetualMarkets',
          aevo: 'https://api.aevo.xyz/funding',
          gmx: 'on-chain GMX V2 contracts (Arbitrum)',
          drift: 'Drift SDK / on-chain Solana',
          vertex: 'https://prod.vertexprotocol.com/v1/query',
        },
      },
    });
  }
);

module.exports = router;
