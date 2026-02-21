/**
 * /api/dex-quotes
 *
 * Compare swap quotes across DEXs for a given token pair and amount.
 * DEXs: Uniswap V3, SushiSwap, 1inch Aggregator
 *
 * Query params:
 *   ?from=<symbol>    (default: "ETH")
 *   ?to=<symbol>      (default: "USDC")
 *   ?amount=<number>  (default: 1, in from-token units)
 *   ?chain=<chain>    (default: "ethereum")
 *
 * ⚠️  MOCK DATA — Structure is production-realistic; replace with real
 *     DEX aggregator APIs (1inch, 0x, Paraswap) for production.
 *
 * x402 Price: 0.002 USDC (2000 micro-units)
 */

'use strict';

const express = require('express');
const { requirePayment } = require('../middleware/x402');

const router = express.Router();

const PRICE_MICRO = 2000;

// Mock base prices for common tokens
const BASE_PRICES = {
  ETH: 2750, BTC: 98000, SOL: 185, USDC: 1, USDT: 1, DAI: 1,
  LINK: 18.5, UNI: 8.2, AAVE: 285, ARB: 1.15, OP: 2.1,
  PEPE: 0.00001, SHIB: 0.0000081, DOGE: 0.28,
};

const DEXS = [
  { id: 'uniswap_v3', name: 'Uniswap V3', fee_bps: 30 },
  { id: 'sushiswap', name: 'SushiSwap', fee_bps: 30 },
  { id: '1inch', name: '1inch Aggregator', fee_bps: 0 },
];

function generateQuotes(from, to, amount, chain) {
  const fromPrice = BASE_PRICES[from.toUpperCase()] || 1;
  const toPrice = BASE_PRICES[to.toUpperCase()] || 1;
  const baseRate = fromPrice / toPrice;
  const inputValueUsd = amount * fromPrice;

  const seed = (from + to + chain).split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  const quotes = DEXS.map((dex, i) => {
    // Slight variation per DEX
    const spread = 1 - (((seed * (i + 1) * 7919) % 1000) / 1000) * 0.008; // 0–0.8% variation
    const effectiveRate = baseRate * spread;
    const outputAmount = parseFloat((amount * effectiveRate).toFixed(8));
    const feeBps = dex.fee_bps;
    const feeUsd = parseFloat((inputValueUsd * feeBps / 10000).toFixed(4));

    // Price impact scales with amount
    const priceImpactPct = parseFloat(Math.min(inputValueUsd / 5_000_000 * 0.5, 15).toFixed(4));
    const outputAfterImpact = parseFloat((outputAmount * (1 - priceImpactPct / 100)).toFixed(8));

    return {
      dex: dex.id,
      dex_name: dex.name,
      input_token: from.toUpperCase(),
      output_token: to.toUpperCase(),
      input_amount: amount,
      output_amount: outputAfterImpact,
      effective_rate: parseFloat(effectiveRate.toFixed(8)),
      price_impact_pct: priceImpactPct,
      fee_bps: feeBps,
      fee_usd: feeUsd,
      estimated_gas_usd: parseFloat((chain === 'ethereum' ? 8.5 + i * 1.2 : 0.05 + i * 0.01).toFixed(2)),
      route: dex.id === '1inch'
        ? [from.toUpperCase(), 'WETH', to.toUpperCase()]
        : [from.toUpperCase(), to.toUpperCase()],
      min_output: parseFloat((outputAfterImpact * 0.995).toFixed(8)),
      expires_in_seconds: 30,
    };
  });

  // Sort by best output
  quotes.sort((a, b) => b.output_amount - a.output_amount);

  return {
    pair: `${from.toUpperCase()}/${to.toUpperCase()}`,
    chain,
    input_amount: amount,
    input_value_usd: parseFloat(inputValueUsd.toFixed(2)),
    base_rate: parseFloat(baseRate.toFixed(8)),
    best_dex: quotes[0].dex,
    best_output: quotes[0].output_amount,
    savings_vs_worst: parseFloat((quotes[0].output_amount - quotes[quotes.length - 1].output_amount).toFixed(8)),
    quotes,
    recommendation: {
      dex: quotes[0].dex_name,
      reason: quotes[0].dex === '1inch'
        ? 'Aggregator finds optimal split routes across liquidity sources'
        : `Best effective rate with ${quotes[0].price_impact_pct}% price impact`,
      output: quotes[0].output_amount,
      total_cost_usd: parseFloat((quotes[0].fee_usd + quotes[0].estimated_gas_usd).toFixed(2)),
    },
  };
}

router.get(
  '/',
  requirePayment({
    resource: '/api/dex-quotes',
    description: 'Compare swap quotes across Uniswap, SushiSwap, 1inch for any token pair. Query with ?from=ETH&to=USDC&amount=1.',
    maxAmountRequired: PRICE_MICRO,
  }),
  (req, res) => {
    const from = (req.query.from || 'ETH').toString().trim().toUpperCase().slice(0, 10);
    const to = (req.query.to || 'USDC').toString().trim().toUpperCase().slice(0, 10);
    const amount = parseFloat(req.query.amount || '1') || 1;
    const chain = (req.query.chain || 'ethereum').toString().trim().toLowerCase();

    const validChains = ['ethereum', 'base', 'arbitrum', 'polygon'];
    if (!validChains.includes(chain)) {
      return res.status(400).json({ error: 'Invalid chain', valid_chains: validChains });
    }

    if (from === to) {
      return res.status(400).json({ error: 'from and to tokens must be different' });
    }

    const data = generateQuotes(from, to, amount, chain);

    res.json({
      timestamp: new Date().toISOString(),
      source: 'mock',
      mock_warning: 'Quotes are simulated for demo purposes. Integrate 1inch/0x/Paraswap APIs for production.',
      payment: req.x402,
      query: { from, to, amount, chain },
      data,
    });
  }
);

module.exports = router;
