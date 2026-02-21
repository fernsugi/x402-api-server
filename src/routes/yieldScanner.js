/**
 * /api/yield-scanner
 *
 * Top DeFi yields across major protocols: Aave, Compound, Morpho, Lido,
 * Rocket Pool, Pendle, Ethena, Maker DSR, Convex, Yearn.
 *
 * Query params:
 *   ?chain=<ethereum|base|arbitrum|polygon|all>  (default: "all")
 *   ?min_tvl=<number>     Minimum TVL in USD (default: 0)
 *   ?asset=<symbol>       Filter by asset (e.g., ETH, USDC)
 *   ?limit=<number>       Max results (default: 20, max: 50)
 *
 * ⚠️  MOCK DATA — Replace with DefiLlama yields API or direct protocol calls.
 *
 * x402 Price: 0.005 USDC (5000 micro-units)
 */

'use strict';

const express = require('express');
const { requirePayment } = require('../middleware/x402');

const router = express.Router();

const PRICE_MICRO = 5000;

// Mock yield pool data — realistic as of early 2026
const YIELD_POOLS = [
  { protocol: 'Lido', asset: 'stETH', chain: 'ethereum', apy: 3.8, tvl: 28_500_000_000, risk_tier: 'low', type: 'staking' },
  { protocol: 'Rocket Pool', asset: 'rETH', chain: 'ethereum', apy: 3.5, tvl: 4_200_000_000, risk_tier: 'low', type: 'staking' },
  { protocol: 'Aave V3', asset: 'USDC', chain: 'ethereum', apy: 4.2, tvl: 8_100_000_000, risk_tier: 'low', type: 'lending' },
  { protocol: 'Aave V3', asset: 'USDC', chain: 'base', apy: 5.1, tvl: 1_200_000_000, risk_tier: 'low', type: 'lending' },
  { protocol: 'Aave V3', asset: 'ETH', chain: 'ethereum', apy: 2.1, tvl: 6_800_000_000, risk_tier: 'low', type: 'lending' },
  { protocol: 'Aave V3', asset: 'USDC', chain: 'arbitrum', apy: 4.8, tvl: 950_000_000, risk_tier: 'low', type: 'lending' },
  { protocol: 'Compound V3', asset: 'USDC', chain: 'ethereum', apy: 3.9, tvl: 3_200_000_000, risk_tier: 'low', type: 'lending' },
  { protocol: 'Compound V3', asset: 'USDC', chain: 'base', apy: 4.7, tvl: 680_000_000, risk_tier: 'low', type: 'lending' },
  { protocol: 'Morpho Blue', asset: 'USDC', chain: 'ethereum', apy: 6.8, tvl: 2_800_000_000, risk_tier: 'medium', type: 'lending' },
  { protocol: 'Morpho Blue', asset: 'ETH', chain: 'ethereum', apy: 3.2, tvl: 1_500_000_000, risk_tier: 'medium', type: 'lending' },
  { protocol: 'Morpho Blue', asset: 'USDC', chain: 'base', apy: 7.5, tvl: 420_000_000, risk_tier: 'medium', type: 'lending' },
  { protocol: 'Ethena', asset: 'sUSDe', chain: 'ethereum', apy: 18.5, tvl: 5_600_000_000, risk_tier: 'high', type: 'synthetic' },
  { protocol: 'Maker DSR', asset: 'sDAI', chain: 'ethereum', apy: 5.0, tvl: 7_200_000_000, risk_tier: 'low', type: 'savings' },
  { protocol: 'Pendle', asset: 'PT-stETH', chain: 'ethereum', apy: 8.2, tvl: 1_800_000_000, risk_tier: 'medium', type: 'yield_trading' },
  { protocol: 'Pendle', asset: 'PT-eETH', chain: 'arbitrum', apy: 9.1, tvl: 450_000_000, risk_tier: 'medium', type: 'yield_trading' },
  { protocol: 'Convex', asset: 'crvUSD/USDC', chain: 'ethereum', apy: 12.4, tvl: 890_000_000, risk_tier: 'medium', type: 'liquidity' },
  { protocol: 'Yearn V3', asset: 'USDC', chain: 'ethereum', apy: 5.8, tvl: 620_000_000, risk_tier: 'medium', type: 'vault' },
  { protocol: 'Yearn V3', asset: 'DAI', chain: 'ethereum', apy: 5.5, tvl: 410_000_000, risk_tier: 'medium', type: 'vault' },
  { protocol: 'Aerodrome', asset: 'USDC/ETH', chain: 'base', apy: 22.1, tvl: 380_000_000, risk_tier: 'high', type: 'liquidity' },
  { protocol: 'Aerodrome', asset: 'USDC/cbBTC', chain: 'base', apy: 15.3, tvl: 210_000_000, risk_tier: 'high', type: 'liquidity' },
  { protocol: 'GMX', asset: 'GLP', chain: 'arbitrum', apy: 11.5, tvl: 520_000_000, risk_tier: 'high', type: 'liquidity' },
  { protocol: 'Camelot', asset: 'GRAIL/ETH', chain: 'arbitrum', apy: 28.3, tvl: 85_000_000, risk_tier: 'high', type: 'liquidity' },
  { protocol: 'Aave V3', asset: 'USDC', chain: 'polygon', apy: 3.6, tvl: 420_000_000, risk_tier: 'low', type: 'lending' },
];

router.get(
  '/',
  requirePayment({
    resource: '/api/yield-scanner',
    description: 'Top DeFi yields across Aave, Compound, Morpho, Lido, Pendle, Ethena and more. Filter by chain, asset, TVL.',
    maxAmountRequired: PRICE_MICRO,
  }),
  (req, res) => {
    const chainFilter = (req.query.chain || 'all').toString().trim().toLowerCase();
    const minTvl = parseFloat(req.query.min_tvl || '0') || 0;
    const assetFilter = req.query.asset?.toString().trim().toUpperCase();
    const limit = Math.min(parseInt(req.query.limit || '20') || 20, 50);

    const validChains = ['ethereum', 'base', 'arbitrum', 'polygon', 'all'];
    if (!validChains.includes(chainFilter)) {
      return res.status(400).json({ error: 'Invalid chain', valid_chains: validChains });
    }

    // Add slight time-based variation to APYs
    const now = Date.now();
    let pools = YIELD_POOLS.map(p => ({
      ...p,
      apy: parseFloat((p.apy + Math.sin(now / 3600000 + p.protocol.length) * 0.3).toFixed(2)),
      tvl: p.tvl,
      updated_at: new Date(now - Math.floor(Math.random() * 3600_000)).toISOString(),
    }));

    // Apply filters
    if (chainFilter !== 'all') pools = pools.filter(p => p.chain === chainFilter);
    if (minTvl > 0) pools = pools.filter(p => p.tvl >= minTvl);
    if (assetFilter) pools = pools.filter(p => p.asset.toUpperCase().includes(assetFilter));

    // Sort by APY descending
    pools.sort((a, b) => b.apy - a.apy);
    pools = pools.slice(0, limit);

    res.json({
      timestamp: new Date().toISOString(),
      source: 'mock',
      mock_warning: 'Yields are simulated for demo purposes. Integrate DefiLlama API for production.',
      payment: req.x402,
      query: { chain: chainFilter, min_tvl: minTvl, asset: assetFilter || 'all', limit },
      total_results: pools.length,
      data: pools,
      metadata: {
        risk_tiers: {
          low: 'Battle-tested protocols, audited, >$1B TVL',
          medium: 'Established protocols, audited, moderate complexity',
          high: 'Higher yields from IL risk, newer protocols, or leveraged strategies',
        },
        real_source: 'https://yields.llama.fi/pools (DefiLlama Yields API)',
      },
    });
  }
);

module.exports = router;
