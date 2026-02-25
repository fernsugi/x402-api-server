/**
 * /api/wallet-profiler
 *
 * Wallet analysis: portfolio breakdown, holdings, activity level,
 * risk profile. Used by agents for wallet intelligence.
 *
 * Query params:
 *   ?address=<0x...>  (default: Vitalik's wallet)
 *   ?chain=<ethereum|base|arbitrum|polygon|all>  (default: "all")
 *
 * ⚠️  MOCK DATA — Replace with Moralis/Alchemy/Zerion portfolio APIs.
 *
 * x402 Price: 0.008 USDC (8000 micro-units)
 */

'use strict';

const express = require('express');
const { requirePayment } = require('../middleware/x402');

const router = express.Router();

const PRICE_MICRO = 8000;

// Well-known wallets with curated mock data
const KNOWN_WALLETS = {
  '0xd8da6bf26964af9d7eed9e03e53415d37aa96045': {
    label: 'vitalik.eth',
    type: 'individual',
    first_seen: '2015-07-30T00:00:00Z',
  },
  '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8': {
    label: 'Binance Cold Wallet',
    type: 'exchange',
    first_seen: '2018-10-15T00:00:00Z',
  },
};

function generateMockProfile(address, chainFilter) {
  const seed = address.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (min, max) => min + ((seed * 9301 + 49297) % 233280) / 233280 * (max - min);
  const known = KNOWN_WALLETS[address.toLowerCase()];

  // Portfolio holdings
  const allHoldings = [
    { token: 'ETH', chain: 'ethereum', balance: parseFloat(rng(0.5, 12000).toFixed(4)), price_usd: 2750 },
    { token: 'ETH', chain: 'base', balance: parseFloat(rng(0.1, 500).toFixed(4)), price_usd: 2750 },
    { token: 'ETH', chain: 'arbitrum', balance: parseFloat(rng(0.05, 200).toFixed(4)), price_usd: 2750 },
    { token: 'USDC', chain: 'ethereum', balance: parseFloat(rng(100, 5_000_000).toFixed(2)), price_usd: 1 },
    { token: 'USDC', chain: 'base', balance: parseFloat(rng(50, 500_000).toFixed(2)), price_usd: 1 },
    { token: 'USDT', chain: 'ethereum', balance: parseFloat(rng(0, 1_000_000).toFixed(2)), price_usd: 1 },
    { token: 'stETH', chain: 'ethereum', balance: parseFloat(rng(0, 5000).toFixed(4)), price_usd: 2745 },
    { token: 'LINK', chain: 'ethereum', balance: parseFloat(rng(0, 50000).toFixed(2)), price_usd: 18.5 },
    { token: 'UNI', chain: 'ethereum', balance: parseFloat(rng(0, 30000).toFixed(2)), price_usd: 8.2 },
    { token: 'ARB', chain: 'arbitrum', balance: parseFloat(rng(0, 100000).toFixed(2)), price_usd: 1.15 },
    { token: 'AAVE', chain: 'ethereum', balance: parseFloat(rng(0, 2000).toFixed(2)), price_usd: 285 },
    { token: 'POL', chain: 'polygon', balance: parseFloat(rng(0, 200000).toFixed(2)), price_usd: 0.45 },
  ];

  let holdings = chainFilter === 'all'
    ? allHoldings
    : allHoldings.filter(h => h.chain === chainFilter);

  // Add value_usd and filter out zero balances
  holdings = holdings
    .map(h => ({ ...h, value_usd: parseFloat((h.balance * h.price_usd).toFixed(2)) }))
    .filter(h => h.value_usd > 1)
    .sort((a, b) => b.value_usd - a.value_usd);

  const totalValue = holdings.reduce((s, h) => s + h.value_usd, 0);

  // Add percentage
  holdings = holdings.map(h => ({
    ...h,
    portfolio_pct: parseFloat((h.value_usd / totalValue * 100).toFixed(2)),
  }));

  // DeFi positions (mock) — filtered by chainFilter same as holdings
  const allDefiPositions = [
    { protocol: 'Aave V3', type: 'lending', asset: 'USDC', chain: 'ethereum', value_usd: Math.floor(rng(0, totalValue * 0.15)), apy: 4.2 },
    { protocol: 'Lido', type: 'staking', asset: 'stETH', chain: 'ethereum', value_usd: Math.floor(rng(0, totalValue * 0.2)), apy: 3.8 },
    { protocol: 'Uniswap V3', type: 'liquidity', asset: 'ETH/USDC', chain: 'base', value_usd: Math.floor(rng(0, totalValue * 0.1)), apy: 12.5 },
  ];
  const defiPositions = (chainFilter === 'all'
    ? allDefiPositions
    : allDefiPositions.filter(p => p.chain === chainFilter)
  ).filter(p => p.value_usd > 100);

  const defiValue = defiPositions.reduce((s, p) => s + p.value_usd, 0);

  // Activity metrics
  const txCount = Math.floor(rng(10, 50_000));
  const daysSinceFirst = Math.floor((Date.now() - new Date(known?.first_seen || Date.now() - rng(30, 2000) * 86400_000).getTime()) / 86400_000);
  const lastActive = new Date(Date.now() - Math.floor(rng(0, 30)) * 86400_000).toISOString();

  // Risk profile
  const stablePct = holdings.filter(h => ['USDC', 'USDT', 'DAI', 'sDAI'].includes(h.token))
    .reduce((s, h) => s + h.portfolio_pct, 0);
  const riskProfile = stablePct > 60 ? 'conservative'
    : stablePct > 30 ? 'moderate'
    : 'aggressive';

  return {
    address,
    label: known?.label || null,
    wallet_type: known?.type || (txCount > 10000 ? 'power_user' : txCount > 1000 ? 'active' : 'casual'),
    chains_active: [...new Set(holdings.map(h => h.chain))],
    total_value_usd: parseFloat(totalValue.toFixed(2)),
    defi_value_usd: parseFloat(defiValue.toFixed(2)),
    portfolio: {
      top_holdings: holdings.slice(0, 10),
      allocation: {
        native_tokens_pct: parseFloat(holdings.filter(h => ['ETH', 'POL'].includes(h.token)).reduce((s, h) => s + h.portfolio_pct, 0).toFixed(1)),
        stablecoins_pct: parseFloat(stablePct.toFixed(1)),
        defi_tokens_pct: parseFloat(holdings.filter(h => ['AAVE', 'UNI', 'LINK', 'ARB', 'stETH'].includes(h.token)).reduce((s, h) => s + h.portfolio_pct, 0).toFixed(1)),
      },
    },
    defi_positions: defiPositions,
    activity: {
      total_transactions: txCount,
      first_seen: known?.first_seen || new Date(Date.now() - daysSinceFirst * 86400_000).toISOString(),
      last_active: lastActive,
      age_days: daysSinceFirst,
      avg_tx_per_day: parseFloat((txCount / Math.max(daysSinceFirst, 1)).toFixed(2)),
      nft_count: Math.floor(rng(0, 500)),
    },
    risk_profile: {
      classification: riskProfile,
      stablecoin_ratio: parseFloat((stablePct / 100).toFixed(3)),
      diversification_score: Math.min(10, holdings.length),
      defi_exposure_pct: parseFloat((defiValue / Math.max(totalValue, 1) * 100).toFixed(1)),
      is_contract: false,
      is_multisig: rng(0, 1) > 0.85,
    },
  };
}

router.get(
  '/',
  requirePayment({
    resource: '/api/wallet-profiler',
    description: 'Wallet portfolio analysis: holdings, DeFi positions, activity metrics, risk profile. Query with ?address=0x...&chain=all.',
    maxAmountRequired: PRICE_MICRO,
  }),
  (req, res) => {
    const address = (req.query.address || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045').toString().trim();
    const chain = (req.query.chain || 'all').toString().trim().toLowerCase();

    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address format', hint: 'Must be 0x followed by 40 hex characters' });
    }

    const validChains = ['ethereum', 'base', 'arbitrum', 'polygon', 'all'];
    if (!validChains.includes(chain)) {
      return res.status(400).json({ error: 'Invalid chain', valid_chains: validChains });
    }

    const data = generateMockProfile(address, chain);

    res.json({
      timestamp: new Date().toISOString(),
      source: 'mock',
      mock_warning: 'Portfolio data is procedurally generated for demo purposes. Integrate Moralis/Alchemy for production.',
      payment: req.x402,
      query: { address, chain },
      data,
    });
  }
);

module.exports = router;
