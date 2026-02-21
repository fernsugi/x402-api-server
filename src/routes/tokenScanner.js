/**
 * /api/token-scanner
 *
 * Token security & risk analysis — contract info, holder stats, liquidity,
 * risk flags for rug-pull detection agents.
 *
 * Query params:
 *   ?token=<address|symbol>  (default: "PEPE")
 *   ?chain=<ethereum|base|arbitrum|polygon>  (default: "ethereum")
 *
 * ⚠️  MOCK DATA — Structure is production-realistic; replace with real
 *     contract analysis via Etherscan, GoPlus, or custom scanner.
 *
 * x402 Price: 0.003 USDC (3000 micro-units)
 */

'use strict';

const express = require('express');
const { requirePayment } = require('../middleware/x402');

const router = express.Router();

const PRICE_MICRO = 3000;

const KNOWN_TOKENS = {
  PEPE: {
    address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    name: 'Pepe',
    symbol: 'PEPE',
    decimals: 18,
    chain: 'ethereum',
    deployer: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    deploy_date: '2023-04-14T00:00:00Z',
    total_supply: 420_690_000_000_000,
    holder_count: 285_000,
    is_verified: true,
    has_proxy: false,
    has_mint_function: false,
    liquidity_locked: true,
    honeypot_risk: false,
    buy_tax: 0,
    sell_tax: 0,
    liquidity_usd: 82_000_000,
    market_cap_usd: 4_200_000_000,
    price_usd: 0.00001,
    risk_score: 15,
  },
  SHIB: {
    address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    name: 'Shiba Inu',
    symbol: 'SHIB',
    decimals: 18,
    chain: 'ethereum',
    deployer: '0xB8f226dDb7bC672E27dffB67e4adAbFa8c0dFA08',
    deploy_date: '2020-08-01T00:00:00Z',
    total_supply: 999_999_000_000_000,
    holder_count: 1_380_000,
    is_verified: true,
    has_proxy: false,
    has_mint_function: false,
    liquidity_locked: true,
    honeypot_risk: false,
    buy_tax: 0,
    sell_tax: 0,
    liquidity_usd: 145_000_000,
    market_cap_usd: 8_100_000_000,
    price_usd: 0.0000081,
    risk_score: 12,
  },
};

function generateMockToken(token, chain) {
  const seed = token.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (min, max) => min + ((seed * 9301 + 49297) % 233280) / 233280 * (max - min);
  const isAddress = token.startsWith('0x') && token.length === 42;

  const hasProxy = rng(0, 1) > 0.7;
  const hasMint = rng(0, 1) > 0.75;
  const liquidityLocked = rng(0, 1) > 0.4;
  const honeypot = rng(0, 1) > 0.85;
  const isVerified = rng(0, 1) > 0.3;
  const buyTax = honeypot ? parseFloat(rng(5, 50).toFixed(1)) : parseFloat(rng(0, 5).toFixed(1));
  const sellTax = honeypot ? parseFloat(rng(10, 99).toFixed(1)) : parseFloat(rng(0, 5).toFixed(1));

  let riskScore = 0;
  if (!isVerified) riskScore += 25;
  if (hasProxy) riskScore += 15;
  if (hasMint) riskScore += 20;
  if (!liquidityLocked) riskScore += 15;
  if (honeypot) riskScore += 30;
  if (buyTax > 5) riskScore += 10;
  if (sellTax > 10) riskScore += 15;
  riskScore = Math.min(100, riskScore);

  return {
    address: isAddress ? token : `0x${Array.from({ length: 40 }, (_, k) => '0123456789abcdef'[(seed * (k + 1) * 7919) % 16]).join('')}`,
    name: isAddress ? 'Unknown Token' : token,
    symbol: isAddress ? '???' : token.toUpperCase().slice(0, 6),
    decimals: 18,
    chain,
    deployer: `0x${Array.from({ length: 40 }, (_, k) => '0123456789abcdef'[(seed * (k + 3) * 1013) % 16]).join('')}`,
    deploy_date: new Date(Date.now() - Math.floor(rng(7, 730)) * 86400_000).toISOString(),
    total_supply: Math.floor(rng(1_000_000, 1_000_000_000_000)),
    holder_count: Math.floor(rng(50, 500_000)),
    is_verified: isVerified,
    has_proxy: hasProxy,
    has_mint_function: hasMint,
    liquidity_locked: liquidityLocked,
    honeypot_risk: honeypot,
    buy_tax: buyTax,
    sell_tax: sellTax,
    liquidity_usd: Math.floor(rng(1_000, 50_000_000)),
    market_cap_usd: Math.floor(rng(10_000, 500_000_000)),
    price_usd: parseFloat(rng(0.0000001, 1.5).toFixed(8)),
    risk_score: riskScore,
  };
}

router.get(
  '/',
  requirePayment({
    resource: '/api/token-scanner',
    description: 'Token security & risk analysis: contract info, holder stats, liquidity, rug-pull risk flags. Query with ?token=PEPE&chain=ethereum.',
    maxAmountRequired: PRICE_MICRO,
  }),
  (req, res) => {
    const token = (req.query.token || 'PEPE').toString().trim().slice(0, 42);
    const chain = (req.query.chain || 'ethereum').toString().trim().toLowerCase();

    const validChains = ['ethereum', 'base', 'arbitrum', 'polygon'];
    if (!validChains.includes(chain)) {
      return res.status(400).json({ error: 'Invalid chain', valid_chains: validChains });
    }

    const known = KNOWN_TOKENS[token.toUpperCase()];
    const tokenData = known || generateMockToken(token, chain);

    const riskLevel = tokenData.risk_score <= 20 ? 'LOW'
      : tokenData.risk_score <= 50 ? 'MEDIUM'
      : tokenData.risk_score <= 75 ? 'HIGH'
      : 'CRITICAL';

    res.json({
      timestamp: new Date().toISOString(),
      source: 'mock',
      mock_warning: 'Data is procedurally generated for demo purposes. Integrate GoPlus/Etherscan for production.',
      payment: req.x402,
      query: { token, chain },
      data: {
        ...tokenData,
        risk_level: riskLevel,
        risk_flags: {
          is_verified: tokenData.is_verified,
          has_proxy: tokenData.has_proxy,
          has_mint_function: tokenData.has_mint_function,
          liquidity_locked: tokenData.liquidity_locked,
          honeypot_risk: tokenData.honeypot_risk,
          high_buy_tax: tokenData.buy_tax > 5,
          high_sell_tax: tokenData.sell_tax > 10,
        },
        age_days: Math.floor((Date.now() - new Date(tokenData.deploy_date).getTime()) / 86400_000),
      },
    });
  }
);

module.exports = router;
