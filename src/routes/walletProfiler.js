/** Public-chain wallet balances and activity from Blockscout. */
'use strict';

const express = require('express');
const axios = require('axios');
const { requirePayment } = require('../middleware/x402');
const { prepareLive, RequestError } = require('../middleware/prepare-live');
const { createLiveCache } = require('../services/live-cache');

const router = express.Router();
const EXPLORERS = {
  ethereum: process.env.ETHEREUM_BLOCKSCOUT_URL || 'https://eth.blockscout.com',
  base: process.env.BASE_BLOCKSCOUT_URL || 'https://base.blockscout.com',
  arbitrum: process.env.ARBITRUM_BLOCKSCOUT_URL || 'https://arbitrum.blockscout.com',
  polygon: process.env.POLYGON_BLOCKSCOUT_URL || 'https://polygon.blockscout.com',
};
const RPCS = {
  ethereum: process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com',
  base: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  arbitrum: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  polygon: process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com',
};
const USDC = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  polygon: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
};
const NATIVE = { ethereum: 'ETH', base: 'ETH', arbitrum: 'ETH', polygon: 'POL' };
const COINLORE_BASE = process.env.COINLORE_API_BASE || 'https://api.coinlore.net/api';
// Explorer retries followed by RPC fallback used to take over 30 seconds.
// Bound the whole chain lookup so slow sources cannot hold up every chain.
const CHAIN_BUDGET_MS = 6_000;
const EXPLORER_TIMEOUT_MS = 2_000;
const loadCached = createLiveCache(60_000, 100);
const priceCache = createLiveCache(60_000, 1);

function finitePositive(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function tokenHolding(item, chain) {
  const decimals = Number(item?.token?.decimals);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  const raw = finitePositive(item.value);
  if (raw == null) return null;
  const balance = raw / 10 ** decimals;
  if (!Number.isFinite(balance) || balance <= 0) return null;
  const price = finitePositive(item.token.exchange_rate);
  return {
    token: item.token.symbol || 'UNKNOWN',
    token_address: item.token.address_hash,
    chain,
    balance,
    price_usd: price,
    value_usd: price == null ? null : Number((balance * price).toFixed(2)),
    reputation: item.token.reputation || null,
  };
}

async function rpc(chain, method, params, signal) {
  const { data } = await axios.post(RPCS[chain], { jsonrpc: '2.0', id: 1, method, params }, {
    timeout: 6_000, signal, headers: { 'Content-Type': 'application/json' },
  });
  if (!/^0x[0-9a-fA-F]+$/.test(data?.result || '')) throw new Error(`${chain} RPC failed`);
  return BigInt(data.result);
}

async function fallbackPrices(signal) {
  const { value } = await priceCache('wallet', async () => {
    const { data } = await axios.get(`${COINLORE_BASE}/tickers/`, {
      params: { start: 0, limit: 100 }, timeout: 2_000, signal,
    });
    if (!Array.isArray(data?.data)) throw new Error('CoinLore wallet prices unavailable');
    return Object.fromEntries(data.data.map(item => [item.symbol, Number(item.price_usd)]));
  });
  return value;
}

async function fetchRpcBalances(address, chain, accountData, counterData, signal) {
  const calldata = `0x70a08231${address.slice(2).toLowerCase().padStart(64, '0')}`;
  const [nativeResult, usdcResult, priceResult] = await Promise.allSettled([
    rpc(chain, 'eth_getBalance', [address, 'latest'], signal),
    rpc(chain, 'eth_call', [{ to: USDC[chain], data: calldata }, 'latest'], signal),
    fallbackPrices(signal),
  ]);
  if (nativeResult.status !== 'fulfilled' && usdcResult.status !== 'fulfilled') {
    throw new Error(`${chain} Blockscout and public RPCs unavailable`);
  }
  const prices = priceResult.status === 'fulfilled' ? priceResult.value : {};
  const holdings = [];
  if (nativeResult.status === 'fulfilled' && nativeResult.value > 0n) {
    const balance = Number(nativeResult.value) / 1e18;
    const price = finitePositive(prices[NATIVE[chain]]);
    holdings.push({ token: NATIVE[chain], token_address: null, chain, balance,
      price_usd: price, value_usd: price == null ? null : Number((balance * price).toFixed(2)),
      reputation: 'native' });
  }
  if (usdcResult.status === 'fulfilled' && usdcResult.value > 0n) {
    const balance = Number(usdcResult.value) / 1e6;
    const price = finitePositive(prices.USDC);
    holdings.push({ token: 'USDC', token_address: USDC[chain], chain, balance,
      price_usd: price, value_usd: price == null ? null : Number((balance * price).toFixed(2)),
      reputation: 'ok' });
  }
  return {
    holdings,
    transaction_count: /^\d+$/.test(String(counterData?.transactions_count))
      ? Number(counterData.transactions_count) : null,
    is_contract: accountData?.is_contract ?? null,
    account_metadata_available: Boolean(accountData),
    source: 'public RPC (native and USDC only)',
  };
}

async function fetchChain(address, chain, signal) {
  const base = `${EXPLORERS[chain]}/api/v2/addresses/${address}`;
  const request = path => axios.get(`${base}${path}`, {
    timeout: EXPLORER_TIMEOUT_MS,
    signal,
    headers: { Accept: 'application/json' },
    maxContentLength: 8_000_000,
  }).then(response => response.data);
  const tokenBalances = async () => {
    try { return await request('/token-balances'); }
    catch (error) {
      if (signal.aborted) throw error;
      await new Promise(resolve => setTimeout(resolve, 300));
      return request('/token-balances');
    }
  };
  const [account, balances, counters] = await Promise.allSettled([
    request(''), tokenBalances(), request('/counters'),
  ]);
  const accountData = account.status === 'fulfilled' ? account.value : null;
  const counterData = counters.status === 'fulfilled' ? counters.value : null;
  if (balances.status !== 'fulfilled' || !Array.isArray(balances.value)) {
    return fetchRpcBalances(address, chain, accountData, counterData, signal);
  }

  const holdings = balances.value.map(item => tokenHolding(item, chain)).filter(Boolean);
  const nativeRaw = finitePositive(accountData?.coin_balance);
  if (nativeRaw != null) {
    const balance = nativeRaw / 1e18;
    const price = finitePositive(accountData.exchange_rate);
    holdings.push({
      token: NATIVE[chain], token_address: null, chain, balance,
      price_usd: price, value_usd: price == null ? null : Number((balance * price).toFixed(2)),
      reputation: 'native',
    });
  }
  return {
    holdings,
    transaction_count: /^\d+$/.test(String(counterData?.transactions_count))
      ? Number(counterData.transactions_count) : null,
    is_contract: accountData?.is_contract ?? null,
    account_metadata_available: Boolean(accountData),
    source: 'Blockscout',
  };
}

async function getChain(address, chain) {
  return loadCached(`${chain}:${address.toLowerCase()}`, () =>
    fetchChain(address, chain, AbortSignal.timeout(CHAIN_BUDGET_MS)));
}

router.get(
  '/',
  prepareLive(async req => {
    const address = String(req.query.address ?? '').trim();
    const chain = String(req.query.chain ?? 'all').trim().toLowerCase();
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new RequestError('address is required and must be an EVM address');
    }
    if (chain !== 'all' && !Object.hasOwn(EXPLORERS, chain)) {
      throw new RequestError(`Invalid chain. Use: ${Object.keys(EXPLORERS).join(', ')}, all`);
    }

    const selected = chain === 'all' ? Object.keys(EXPLORERS) : [chain];
    const results = await Promise.allSettled(selected.map(name => getChain(address, name)));
    const unavailable = selected.filter((_, index) => results[index].status !== 'fulfilled');
    const available = selected.filter((_, index) => results[index].status === 'fulfilled');
    if (available.length === 0) throw new Error('No Blockscout wallet balance source is available');

    const rawHoldings = results.flatMap(result => result.status === 'fulfilled'
      ? result.value.value.holdings : []);
    const priced = rawHoldings.filter(item => item.value_usd != null &&
      (item.reputation === 'ok' || item.reputation === 'native'));
    const unpriced = rawHoldings.filter(item => item.value_usd == null ||
      (item.reputation !== 'ok' && item.reputation !== 'native'));
    const totalValue = priced.reduce((sum, item) => sum + item.value_usd, 0);
    const holdings = priced.sort((a, b) => b.value_usd - a.value_usd).map(item => ({
      ...item,
      portfolio_pct: totalValue > 0 ? Number((item.value_usd / totalValue * 100).toFixed(2)) : null,
    }));
    const stableValue = holdings.filter(item => ['USDC', 'USDT', 'DAI', 'USDB'].includes(item.token.toUpperCase()))
      .reduce((sum, item) => sum + item.value_usd, 0);
    const nativeValue = holdings.filter(item => item.token_address === null)
      .reduce((sum, item) => sum + item.value_usd, 0);
    const percentages = value => totalValue > 0 ? Number((value / totalValue * 100).toFixed(2)) : null;
    const counts = results.filter(result => result.status === 'fulfilled')
      .map(result => result.value.value.transaction_count).filter(value => value != null);
    const balanceSources = Object.fromEntries(results.flatMap((result, index) =>
      result.status === 'fulfilled' ? [[selected[index], result.value.value.source]] : []));

    return {
      address, chain,
      cached: results.every(result => result.status === 'fulfilled' && result.value.cached),
      data: {
        address,
        label: null,
        wallet_type: null,
        chains_active: [...new Set(holdings.map(item => item.chain))],
        total_value_usd: Number(totalValue.toFixed(2)),
        defi_value_usd: null,
        portfolio: {
          top_holdings: holdings.slice(0, 10),
          unpriced_holdings: unpriced.slice(0, 10),
          allocation: {
            native_tokens_pct: percentages(nativeValue),
            stablecoins_pct: percentages(stableValue),
            defi_tokens_pct: null,
          },
        },
        defi_positions: [],
        activity: {
          total_transactions: counts.length ? counts.reduce((a, b) => a + b, 0) : null,
          first_seen: null, last_active: null, age_days: null, avg_tx_per_day: null, nft_count: null,
        },
        risk_profile: {
          classification: null,
          stablecoin_ratio: totalValue > 0 ? Number((stableValue / totalValue).toFixed(4)) : null,
          diversification_score: null,
          defi_exposure_pct: null,
          is_contract: available.length === 1
            ? results[selected.indexOf(available[0])].value.value.is_contract : null,
          is_multisig: null,
        },
        coverage: {
          available_chains: available,
          unavailable_chains: unavailable,
          provider_budget_ms: CHAIN_BUDGET_MS,
          balance_sources: balanceSources,
          priced_holdings: priced.length,
          unpriced_or_untrusted_holdings: unpriced.length,
          valuation_is_partial: true,
          defi_positions_available: false,
          note: 'This is a valuation of priced wallet balances, not a complete net worth or PnL calculation.',
        },
      },
    };
  }),
  requirePayment({
    resource: '/api/wallet-profiler',
    description: 'Observed wallet balances from Blockscout or limited public RPC fallback; partial coverage disclosed.',
    maxAmountRequired: 8000,
  }),
  (req, res) => res.json({
    timestamp: new Date().toISOString(),
    source: 'Blockscout / public RPC',
    cached: req.liveData.cached,
    cache_ttl_seconds: 60,
    payment: req.x402,
    query: { address: req.liveData.address, chain: req.liveData.chain },
    data: req.liveData.data,
  }),
);

module.exports = router;
