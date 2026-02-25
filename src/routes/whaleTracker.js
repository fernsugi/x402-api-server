/**
 * /api/whale-tracker
 *
 * Top holder concentration analysis for any ERC-20/SPL token.
 * Reports whale concentration, Gini coefficient, distribution buckets,
 * and recent large transfers.
 *
 * ⚠️  MOCK DATA — Structure is production-realistic; replace with real
 *     on-chain data by integrating Etherscan/Moralis/Alchemy token holder APIs.
 *
 * Query params:
 *   ?token=<symbol|address>   (default: "ETH")
 *   ?chain=<base|ethereum|solana>  (default: "ethereum")
 *
 * x402 Price: 0.005 USDC (5000 micro-units)
 */

'use strict';

const express = require('express');
const { requirePayment } = require('../middleware/x402');

const router = express.Router();

// Price: 0.005 USDC = 5000 micro-units
const PRICE_MICRO = 5000;

/** ⚠️  MOCK: Generate realistic-looking holder distribution data */
function generateMockHolderData(token, chain) {
  const seed = token.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (min, max) => min + ((seed * 9301 + 49297) % 233280) / 233280 * (max - min);

  // Simulate different concentration levels per token
  const concentration = token.toUpperCase() === 'BTC' ? 0.38
    : token.toUpperCase() === 'ETH' ? 0.42
    : token.toUpperCase() === 'SOL' ? 0.55
    : 0.3 + rng(0, 0.4);

  const totalSupply = Math.floor(rng(100_000_000, 21_000_000_000));
  const topHolders = [];

  let remaining = concentration;
  const holderCount = 20;

  for (let i = 0; i < holderCount; i++) {
    const share = i === 0
      ? concentration * 0.35              // Largest holder gets 35% of concentration
      : remaining * (0.1 + rng(0, 0.25)); // Others get diminishing shares

    remaining -= share;

    const walletTypes = ['exchange', 'protocol', 'whale', 'foundation', 'team', 'dao'];
    const walletType = i < 3 ? 'exchange' : walletTypes[Math.floor(rng(0, walletTypes.length))];

    topHolders.push({
      rank: i + 1,
      address: `0x${Array.from({ length: 40 }, (_, k) =>
        '0123456789abcdef'[(seed * (k + 1) * (i + 1) * 7919) % 16]
      ).join('')}`,
      label: i < 3 ? ['Binance Hot Wallet', 'Coinbase Custody', 'Kraken Exchange'][i]
        : walletType === 'protocol' ? `Protocol Reserve ${i}`
        : walletType === 'foundation' ? 'Foundation Treasury'
        : walletType === 'dao' ? 'DAO Governance'
        : `Unlabeled Whale #${i}`,
      wallet_type: walletType,
      balance: Math.floor(totalSupply * share),
      percentage: parseFloat((share * 100).toFixed(4)),
      last_active: new Date(Date.now() - Math.floor(rng(0, 30)) * 86400_000).toISOString(),
      is_contract: walletType !== 'whale',
    });
  }

  // Normalize percentages so top 20 sum correctly
  const topShare = topHolders.reduce((s, h) => s + h.percentage, 0);

  const gini = parseFloat((0.4 + concentration * 0.5).toFixed(3)); // 0–1 scale

  return {
    token: token.toUpperCase(),
    chain,
    total_supply: totalSupply,
    circulating_supply: Math.floor(totalSupply * (0.6 + rng(0, 0.35))),
    holder_count: Math.floor(rng(10_000, 2_000_000)),
    concentration_metrics: {
      top_1_pct: parseFloat((topHolders[0].percentage).toFixed(2)),
      top_10_pct: parseFloat(topHolders.slice(0, 10).reduce((s, h) => s + h.percentage, 0).toFixed(2)),
      top_20_pct: parseFloat(topShare.toFixed(2)),
      gini_coefficient: gini,
      herfindahl_index: parseFloat(topHolders.slice(0, 10).reduce((s, h) => s + (h.percentage / 100) ** 2, 0).toFixed(6)),
    },
    distribution_buckets: [
      { label: 'Minnows (<$100)', holder_pct: 55.2, supply_pct: 2.1 },
      { label: 'Fish ($100–$1K)', holder_pct: 24.8, supply_pct: 4.7 },
      { label: 'Dolphins ($1K–$10K)', holder_pct: 12.1, supply_pct: 8.3 },
      { label: 'Sharks ($10K–$100K)', holder_pct: 5.4, supply_pct: 13.2 },
      { label: 'Whales ($100K–$1M)', holder_pct: 2.1, supply_pct: 22.4 },
      { label: 'Mega-Whales (>$1M)', holder_pct: 0.4, supply_pct: 49.3 },
    ],
    top_holders: topHolders,
    recent_large_transfers: [
      {
        tx_hash: `0x${Array.from({length:64}, (_,i) => '0123456789abcdef'[(seed*i*13)%16]).join('')}`,
        from: topHolders[2]?.address,
        to: topHolders[5]?.address,
        amount: Math.floor(totalSupply * 0.005),
        usd_value: Math.floor(rng(5_000_000, 50_000_000)),
        timestamp: new Date(Date.now() - 3600_000 * 2).toISOString(),
        transfer_type: 'exchange_outflow',
      },
      {
        tx_hash: `0x${Array.from({length:64}, (_,i) => '0123456789abcdef'[(seed*i*17+3)%16]).join('')}`,
        from: topHolders[8]?.address,
        to: topHolders[1]?.address,
        amount: Math.floor(totalSupply * 0.002),
        usd_value: Math.floor(rng(1_000_000, 10_000_000)),
        timestamp: new Date(Date.now() - 3600_000 * 6).toISOString(),
        transfer_type: 'accumulation',
      },
    ],
  };
}

// Apply x402 payment gate
router.get(
  '/',
  requirePayment({
    resource: '/api/whale-tracker',
    description: 'Top holder concentration analysis: whale distribution, Gini coefficient, transfer alerts. Query with ?token=ETH&chain=ethereum.',
    maxAmountRequired: PRICE_MICRO,
  }),
  (req, res) => {
    const token = (req.query.token || 'ETH').toString().trim().slice(0, 66);
    const chain = (req.query.chain || 'ethereum').toString().trim().toLowerCase();

    const validChains = ['ethereum', 'base', 'solana', 'arbitrum', 'optimism'];
    if (!validChains.includes(chain)) {
      return res.status(400).json({
        error: 'Invalid chain',
        valid_chains: validChains,
      });
    }

    // ⚠️  MOCK DATA — Replace with real Etherscan/Moralis/Alchemy call
    const holderData = generateMockHolderData(token, chain);

    res.json({
      timestamp: new Date().toISOString(),
      source: 'mock', // ⚠️ Change to 'moralis' / 'etherscan' / 'alchemy' in production
      mock_warning: 'Data is procedurally generated for demo purposes. Wire up a real token holder API for production use.',
      payment: req.x402,
      query: { token, chain },
      data: holderData,
    });
  }
);

module.exports = router;
