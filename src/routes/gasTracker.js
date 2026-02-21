/**
 * /api/gas-tracker
 *
 * Current gas prices across multiple EVM chains with speed tiers
 * and estimated transaction costs in USD.
 *
 * Chains: Ethereum, Base, Polygon, Arbitrum
 * Attempts real data via public RPCs; falls back to realistic mock.
 *
 * x402 Price: 0.001 USDC (1000 micro-units)
 */

'use strict';

const express = require('express');
const axios = require('axios');
const { requirePayment } = require('../middleware/x402');

const router = express.Router();

const PRICE_MICRO = 1000;

const CHAINS = {
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    rpc: 'https://eth.llamarpc.com',
    nativeToken: 'ETH',
    gasUnits: { transfer: 21000, swap: 150000, nftMint: 85000 },
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpc: 'https://mainnet.base.org',
    nativeToken: 'ETH',
    gasUnits: { transfer: 21000, swap: 150000, nftMint: 85000 },
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpc: 'https://polygon-rpc.com',
    nativeToken: 'POL',
    gasUnits: { transfer: 21000, swap: 150000, nftMint: 85000 },
  },
  arbitrum: {
    name: 'Arbitrum',
    chainId: 42161,
    rpc: 'https://arb1.arbitrum.io/rpc',
    nativeToken: 'ETH',
    gasUnits: { transfer: 21000, swap: 150000, nftMint: 85000 },
  },
};

// Rough native token prices for USD estimation (updated periodically)
const TOKEN_PRICES_USD = { ETH: 2750, POL: 0.45 };

const cache = { data: null, ts: 0, TTL_MS: 15_000 };

/**
 * Fetch gas price from a chain's RPC via eth_gasPrice.
 */
async function fetchGasPrice(rpc) {
  const { data } = await axios.post(rpc, {
    jsonrpc: '2.0',
    method: 'eth_gasPrice',
    params: [],
    id: 1,
  }, { timeout: 5000 });
  if (data?.result) {
    return parseInt(data.result, 16);
  }
  return null;
}

function weiToGwei(wei) {
  return parseFloat((wei / 1e9).toFixed(4));
}

function estimateCostUsd(gasUnits, gasPriceWei, nativeToken) {
  const costInNative = (gasUnits * gasPriceWei) / 1e18;
  const priceUsd = TOKEN_PRICES_USD[nativeToken] || 2750;
  return parseFloat((costInNative * priceUsd).toFixed(4));
}

async function fetchAllGasPrices() {
  const now = Date.now();
  if (cache.data && now - cache.ts < cache.TTL_MS) {
    return { data: cache.data, cached: true, source: 'rpc' };
  }

  const results = {};
  let anyReal = false;

  await Promise.allSettled(
    Object.entries(CHAINS).map(async ([key, chain]) => {
      try {
        const gasPriceWei = await fetchGasPrice(chain.rpc);
        if (gasPriceWei) {
          anyReal = true;
          const baseGwei = weiToGwei(gasPriceWei);
          results[key] = buildChainData(chain, baseGwei, gasPriceWei);
        }
      } catch {
        // Will use mock fallback below
      }
    })
  );

  // Fill any missing chains with mock data
  for (const [key, chain] of Object.entries(CHAINS)) {
    if (!results[key]) {
      const mockGwei = key === 'ethereum' ? 28 : key === 'base' ? 0.008 : key === 'polygon' ? 35 : 0.1;
      const mockWei = mockGwei * 1e9;
      results[key] = buildChainData(chain, mockGwei, mockWei, true);
    }
  }

  cache.data = results;
  cache.ts = now;
  return { data: results, cached: false, source: anyReal ? 'rpc' : 'mock' };
}

function buildChainData(chain, baseGwei, basePriceWei, isMock = false) {
  return {
    chain: chain.name,
    chain_id: chain.chainId,
    native_token: chain.nativeToken,
    is_mock: isMock,
    gas_price_gwei: {
      slow: parseFloat((baseGwei * 0.8).toFixed(4)),
      normal: parseFloat(baseGwei.toFixed(4)),
      fast: parseFloat((baseGwei * 1.4).toFixed(4)),
    },
    estimated_cost_usd: {
      transfer: {
        slow: estimateCostUsd(chain.gasUnits.transfer, basePriceWei * 0.8, chain.nativeToken),
        normal: estimateCostUsd(chain.gasUnits.transfer, basePriceWei, chain.nativeToken),
        fast: estimateCostUsd(chain.gasUnits.transfer, basePriceWei * 1.4, chain.nativeToken),
      },
      swap: {
        slow: estimateCostUsd(chain.gasUnits.swap, basePriceWei * 0.8, chain.nativeToken),
        normal: estimateCostUsd(chain.gasUnits.swap, basePriceWei, chain.nativeToken),
        fast: estimateCostUsd(chain.gasUnits.swap, basePriceWei * 1.4, chain.nativeToken),
      },
      nft_mint: {
        slow: estimateCostUsd(chain.gasUnits.nftMint, basePriceWei * 0.8, chain.nativeToken),
        normal: estimateCostUsd(chain.gasUnits.nftMint, basePriceWei, chain.nativeToken),
        fast: estimateCostUsd(chain.gasUnits.nftMint, basePriceWei * 1.4, chain.nativeToken),
      },
    },
  };
}

router.get(
  '/',
  requirePayment({
    resource: '/api/gas-tracker',
    description: 'Current gas prices across Ethereum, Base, Polygon, Arbitrum with speed tiers and USD cost estimates.',
    maxAmountRequired: PRICE_MICRO,
  }),
  async (req, res) => {
    try {
      const { data, cached, source } = await fetchAllGasPrices();

      res.json({
        timestamp: new Date().toISOString(),
        source,
        cached,
        cache_ttl_seconds: cache.TTL_MS / 1000,
        payment: req.x402,
        data,
      });
    } catch (err) {
      console.error('[gas-tracker] Error:', err.message);
      res.status(503).json({ error: 'Failed to fetch gas prices', message: err.message });
    }
  }
);

module.exports = router;
