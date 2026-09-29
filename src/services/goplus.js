'use strict';

const axios = require('axios');
const { RequestError } = require('../middleware/prepare-live');
const { createLiveCache } = require('./live-cache');

const API_BASE = process.env.GOPLUS_API_BASE || 'https://api.gopluslabs.io/api/v1';
const CHAIN_IDS = { ethereum: 1, base: 8453, arbitrum: 42161, polygon: 137 };
const KNOWN = {
  ethereum: {
    PEPE: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    SHIB: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    ETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  base: {
    ETH: '0x4200000000000000000000000000000000000006',
    WETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
};
const loadCached = createLiveCache(60_000, 200);

function resolveToken(token, chain) {
  if (!Object.hasOwn(CHAIN_IDS, chain)) {
    throw new RequestError(`Invalid chain. Use: ${Object.keys(CHAIN_IDS).join(', ')}`);
  }
  const input = String(token || '').trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(input)) return { address: input, requested: input };
  const address = KNOWN[chain]?.[input.toUpperCase()];
  if (!address) {
    throw new RequestError('Use a token contract address. Symbol shortcuts: PEPE, SHIB, ETH/WETH, USDC where listed for the selected chain.');
  }
  return { address, requested: input.toUpperCase() };
}

function flag(value) {
  return value === '1' || value === 1 ? true : value === '0' || value === 0 ? false : null;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function getTokenSecurity(token, chain) {
  const resolved = resolveToken(token, chain);
  const key = `${chain}:${resolved.address.toLowerCase()}`;
  const { value, cached } = await loadCached(key, async () => {
    const { data } = await axios.get(`${API_BASE}/token_security/${CHAIN_IDS[chain]}`, {
      params: { contract_addresses: resolved.address },
      timeout: 8_000,
      headers: {
        Accept: 'application/json',
        ...(process.env.GOPLUS_API_TOKEN ? { Authorization: `Bearer ${process.env.GOPLUS_API_TOKEN}` } : {}),
      },
    });
    const record = data?.result?.[resolved.address.toLowerCase()];
    if (data?.code !== 1 || !record || typeof record !== 'object') {
      throw new RequestError('No security data for this token contract', 404);
    }
    return record;
  });
  return { raw: value, cached, ...resolved };
}

module.exports = { CHAIN_IDS, resolveToken, getTokenSecurity, flag, numberOrNull };
