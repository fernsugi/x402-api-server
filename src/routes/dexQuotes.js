/** Live swap route quote from the ParaSwap aggregator. */
'use strict';

const express = require('express');
const axios = require('axios');
const { ethers } = require('ethers');
const { requirePayment } = require('../middleware/x402');
const { prepareLive, RequestError } = require('../middleware/prepare-live');
const { createLiveCache } = require('../services/live-cache');

const router = express.Router();
const NETWORKS = { ethereum: 1, base: 8453, arbitrum: 42161, polygon: 137 };
const API_BASE = process.env.PARASWAP_API_BASE || 'https://apiv5.paraswap.io';
const tokenCache = createLiveCache(60 * 60_000, 4);
const quoteCache = createLiveCache(15_000, 100);

async function getTokens(network) {
  const { value } = await tokenCache(network, async () => {
    const { data } = await axios.get(`${API_BASE}/tokens/${network}`, { timeout: 8_000 });
    if (!Array.isArray(data?.tokens) || data.tokens.length === 0) {
      throw new Error('ParaSwap token list unavailable');
    }
    return data.tokens;
  });
  return value;
}

function resolveToken(input, tokens) {
  const value = String(input).trim();
  const matches = /^0x[0-9a-fA-F]{40}$/.test(value)
    ? tokens.filter(token => token.address.toLowerCase() === value.toLowerCase())
    : tokens.filter(token => token.symbol.toUpperCase() === value.toUpperCase());
  if (matches.length !== 1) {
    throw new RequestError(matches.length ? `Ambiguous token ${value}; use its contract address`
      : `Token ${value} is not supported by ParaSwap on this chain`);
  }
  return matches[0];
}

function parseQuery(query) {
  const chain = String(query.chain ?? 'ethereum').trim().toLowerCase();
  if (!Object.hasOwn(NETWORKS, chain)) {
    throw new RequestError(`Invalid chain. Use: ${Object.keys(NETWORKS).join(', ')}`);
  }
  const from = String(query.from ?? 'ETH').trim();
  const to = String(query.to ?? 'USDC').trim();
  const amount = String(query.amount ?? '1').trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount) || amount.length > 35 || Number(amount) <= 0) {
    throw new RequestError('amount must be a positive decimal number');
  }
  if (from.toLowerCase() === to.toLowerCase()) throw new RequestError('from and to must differ');
  return { chain, from, to, amount };
}

async function fetchQuote(query) {
  const network = NETWORKS[query.chain];
  const tokens = await getTokens(network);
  const input = resolveToken(query.from, tokens);
  const output = resolveToken(query.to, tokens);
  if (input.address.toLowerCase() === output.address.toLowerCase()) {
    throw new RequestError('from and to resolve to the same token');
  }
  let srcAmount;
  try {
    srcAmount = ethers.parseUnits(query.amount, input.decimals).toString();
  } catch {
    throw new RequestError(`amount has too many decimal places for ${input.symbol}`);
  }

  const key = `${network}:${input.address}:${output.address}:${srcAmount}`;
  const { value: route, cached } = await quoteCache(key, async () => {
    const { data } = await axios.get(`${API_BASE}/prices/`, {
      params: {
        srcToken: input.address,
        destToken: output.address,
        amount: srcAmount,
        srcDecimals: input.decimals,
        destDecimals: output.decimals,
        side: 'SELL',
        network,
      },
      timeout: 10_000,
    });
    if (!data?.priceRoute?.destAmount || !Array.isArray(data.priceRoute.bestRoute)) {
      throw new RequestError('No executable swap route for this pair and amount', 422);
    }
    return data.priceRoute;
  });

  const outputAmount = Number(ethers.formatUnits(route.destAmount, output.decimals));
  const inputAmount = Number(query.amount);
  const gasUsd = route.gasCostUSD != null && Number.isFinite(Number(route.gasCostUSD))
    ? Number(route.gasCostUSD) : null;
  const srcUsd = route.srcUSD != null && Number.isFinite(Number(route.srcUSD))
    ? Number(route.srcUSD) : null;
  const exchanges = [...new Set(route.bestRoute.flatMap(segment => segment.swaps || [])
    .flatMap(swap => swap.swapExchanges || []).map(exchange => exchange.exchange))];
  const quote = {
    dex: 'paraswap',
    dex_name: 'ParaSwap aggregate route',
    input_token: input.symbol,
    output_token: output.symbol,
    input_token_address: input.address,
    output_token_address: output.address,
    input_amount: inputAmount,
    output_amount: outputAmount,
    effective_rate: outputAmount / inputAmount,
    price_impact_pct: null,
    fee_bps: null,
    fee_usd: null,
    estimated_gas_usd: gasUsd,
    route: exchanges,
    min_output: null,
    expires_in_seconds: null,
    quote_block: route.blockNumber || null,
  };
  return {
    cached,
    data: {
      pair: `${input.symbol}/${output.symbol}`,
      chain: query.chain,
      input_amount: inputAmount,
      input_value_usd: srcUsd,
      base_rate: outputAmount / inputAmount,
      best_dex: quote.dex,
      best_output: outputAmount,
      savings_vs_worst: null,
      quotes: [quote],
      recommendation: {
        dex: quote.dex_name,
        reason: 'Best route returned by ParaSwap; no independent venue comparison was made.',
        output: outputAmount,
        total_cost_usd: null,
      },
    },
  };
}

router.get(
  '/',
  prepareLive(async req => {
    const query = parseQuery(req.query);
    return { query, ...await fetchQuote(query) };
  }),
  requirePayment({
    resource: '/api/dex-quotes',
    description: 'Live ParaSwap aggregate route quote for a token pair and amount. No independent DEX comparison.',
    maxAmountRequired: 2000,
  }),
  (req, res) => res.json({
    timestamp: new Date().toISOString(),
    source: 'ParaSwap',
    cached: req.liveData.cached,
    cache_ttl_seconds: 15,
    payment: req.x402,
    query: req.liveData.query,
    data: req.liveData.data,
  }),
);

module.exports = router;
