/** Current multi-chain gas quotes from public RPCs, with live USD estimates. */
'use strict';

const express = require('express');
const axios = require('axios');
const { requirePayment } = require('../middleware/x402');
const { prepareLive } = require('../middleware/prepare-live');
const { createLiveCache } = require('../services/live-cache');

const router = express.Router();
const CHAINS = {
  ethereum: { name: 'Ethereum', chainId: 1, rpc: process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com', nativeToken: 'ETH' },
  base: { name: 'Base', chainId: 8453, rpc: process.env.BASE_GAS_RPC_URL || 'https://mainnet.base.org', nativeToken: 'ETH' },
  polygon: { name: 'Polygon', chainId: 137, rpc: process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com', nativeToken: 'POL' },
  arbitrum: { name: 'Arbitrum', chainId: 42161, rpc: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc', nativeToken: 'ETH' },
};
const GAS_UNITS = { transfer: 21_000, swap: 150_000, nft_mint: 85_000 };
const PRICE_URL = process.env.COINGECKO_API_BASE || 'https://api.coingecko.com/api/v3';
const loadCached = createLiveCache(15_000, 1);

async function rpc(url, method, params) {
  const { data } = await axios.post(url, { jsonrpc: '2.0', method, params, id: 1 }, {
    timeout: 5_000,
    headers: { 'Content-Type': 'application/json' },
  });
  if (data?.error || !data?.result) throw new Error(`${method} failed`);
  return data.result;
}

function median(values) {
  const sorted = values.sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function getChainGas(chain) {
  const [quote, history] = await Promise.allSettled([
    rpc(chain.rpc, 'eth_gasPrice', []),
    rpc(chain.rpc, 'eth_feeHistory', ['0x5', 'latest', [10, 50, 90]]),
  ]);
  if (quote.status !== 'fulfilled' && history.status !== 'fulfilled') {
    throw new Error(`${chain.name} RPC unavailable`);
  }

  const normalQuote = quote.status === 'fulfilled' ? Number(BigInt(quote.value)) : null;
  let tiers = { slow: null, normal: normalQuote, fast: null };
  let tierMethod = 'eth_gasPrice (normal only)';
  if (history.status === 'fulfilled') {
    const fees = history.value;
    const nextBase = Number(BigInt(fees.baseFeePerGas?.at(-1) || '0x0'));
    const rewards = Array.isArray(fees.reward) ? fees.reward : [];
    if (nextBase > 0 && rewards.length > 0) {
      const tips = [0, 1, 2].map(i => median(rewards.map(row => Number(BigInt(row[i] || '0x0')))));
      tiers = {
        slow: nextBase + tips[0],
        normal: Math.max(normalQuote || 0, nextBase + tips[1]),
        fast: Math.max(normalQuote || 0, nextBase + tips[1], nextBase + tips[2]),
      };
      tierMethod = 'eth_feeHistory reward percentiles (10/50/90)';
    }
  }
  if (tiers.normal == null) throw new Error(`${chain.name} returned no gas price`);
  return { tiers, tierMethod };
}

function round(value, places = 6) {
  return Number(value.toFixed(places));
}

function costs(tiers, priceUsd) {
  const native = {};
  const usd = {};
  for (const [operation, units] of Object.entries(GAS_UNITS)) {
    native[operation] = {};
    usd[operation] = {};
    for (const [tier, wei] of Object.entries(tiers)) {
      const cost = wei == null ? null : units * wei / 1e18;
      native[operation][tier] = cost == null ? null : round(cost, 10);
      usd[operation][tier] = cost == null || priceUsd == null ? null : round(cost * priceUsd, 6);
    }
  }
  return { native, usd };
}

async function fetchGas() {
  return loadCached('all', async () => {
    const [chainResults, pricesResult] = await Promise.all([
      Promise.allSettled(Object.entries(CHAINS).map(async ([key, chain]) => [key, await getChainGas(chain)])),
      axios.get(`${PRICE_URL}/simple/price`, {
        params: { ids: 'ethereum,polygon-ecosystem-token', vs_currencies: 'usd' },
        timeout: 6_000,
      }).then(response => response.data).catch(() => null),
    ]);
    const prices = {
      ETH: Number.isFinite(pricesResult?.ethereum?.usd) ? pricesResult.ethereum.usd : null,
      POL: Number.isFinite(pricesResult?.['polygon-ecosystem-token']?.usd)
        ? pricesResult['polygon-ecosystem-token'].usd : null,
    };
    const data = {};
    const unavailable = [];
    Object.entries(CHAINS).forEach(([key, chain], index) => {
      const result = chainResults[index];
      if (result.status !== 'fulfilled') { unavailable.push(key); return; }
      const { tiers, tierMethod } = result.value[1];
      const { native, usd } = costs(tiers, prices[chain.nativeToken]);
      data[key] = {
        chain: chain.name,
        chain_id: chain.chainId,
        native_token: chain.nativeToken,
        is_mock: false,
        tier_method: tierMethod,
        native_token_price_usd: prices[chain.nativeToken],
        gas_price_gwei: Object.fromEntries(Object.entries(tiers).map(([tier, wei]) => [
          tier, wei == null ? null : round(wei / 1e9, 6),
        ])),
        estimated_cost_native: native,
        estimated_cost_usd: usd,
      };
    });
    if (Object.keys(data).length === 0) throw new Error('All public gas RPCs are unavailable');
    return { data, unavailable };
  });
}

router.get(
  '/',
  prepareLive(async () => {
    const { value, cached } = await fetchGas();
    return { ...value, cached };
  }),
  requirePayment({
    resource: '/api/gas-tracker',
    description: 'Current gas quotes from Ethereum, Base, Polygon, Arbitrum RPCs; unavailable chains are reported.',
    maxAmountRequired: 1000,
  }),
  (req, res) => res.json({
    timestamp: new Date().toISOString(),
    source: 'public RPCs',
    cached: req.liveData.cached,
    cache_ttl_seconds: 15,
    unavailable_chains: req.liveData.unavailable,
    estimation_note: 'Operation gas units are estimates; L2 data fees and execution differences may add cost.',
    payment: req.x402,
    data: req.liveData.data,
  }),
);

module.exports = router;
