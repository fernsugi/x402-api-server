/** Honest, compact discovery examples for the live API. Values are illustrative. */
'use strict';

const { declareDiscoveryExtension } = require('@x402/extensions/bazaar');

function schemaFor(value) {
  if (value === null) return {};
  if (Array.isArray(value)) return { type: 'array', items: value.length ? schemaFor(value[0]) : {} };
  if (typeof value === 'object') return {
    type: 'object',
    properties: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, schemaFor(child)])),
  };
  return { type: typeof value };
}

function discovery(input, source, data, extra = {}) {
  const example = {
    timestamp: '2026-09-29T00:00:00.000Z',
    source,
    cached: false,
    ...extra,
    data,
  };
  return declareDiscoveryExtension({
    input,
    output: { example, schema: schemaFor(example) },
  });
}

const tokenInput = {
  token: { type: 'string', description: 'ERC-20 contract address or a supported symbol', default: 'PEPE' },
  chain: { type: 'string', description: 'ethereum, base, arbitrum, polygon', default: 'ethereum' },
};

const BAZAAR_SCHEMAS = {
  '/api/price-feed': discovery({}, 'CoinGecko', {
    core: [{ id: 'bitcoin', price_usd: 100000, change_24h_pct: 1.2, volume_24h_usd: 1000000, market_cap_usd: 10000000, last_updated: '2026-09-29T00:00:00.000Z' }],
    top_movers: { gainers: [], losers: [] },
  }),
  '/api/gas-tracker': discovery({}, 'public RPCs', {
    ethereum: { chain: 'Ethereum', chain_id: 1, native_token: 'ETH', is_mock: false,
      tier_method: 'eth_feeHistory reward percentiles (10/50/90)', native_token_price_usd: 2000,
      gas_price_gwei: { slow: 1, normal: 2, fast: 3 },
      estimated_cost_native: { transfer: { slow: 0.000021, normal: 0.000042, fast: 0.000063 } },
      estimated_cost_usd: { transfer: { slow: 0.042, normal: 0.084, fast: 0.126 } },
    },
  }, { unavailable_chains: [], estimation_note: 'Gas units are estimates; L2 data fees may add cost.' }),
  '/api/dex-quotes': discovery({
    from: { type: 'string', default: 'ETH' }, to: { type: 'string', default: 'USDC' },
    amount: { type: 'string', default: '1' }, chain: { type: 'string', default: 'ethereum' },
  }, 'ParaSwap', {
    pair: 'ETH/USDC', chain: 'ethereum', input_amount: 1, input_value_usd: 2000,
    base_rate: 1990, best_dex: 'paraswap', best_output: 1990, savings_vs_worst: null,
    quotes: [{ dex: 'paraswap', dex_name: 'ParaSwap aggregate route', input_token: 'ETH',
      output_token: 'USDC', input_amount: 1, output_amount: 1990, effective_rate: 1990,
      price_impact_pct: null, fee_bps: null, fee_usd: null, estimated_gas_usd: 2,
      route: ['uniswapv3'], min_output: null, expires_in_seconds: null, quote_block: null }],
    recommendation: { dex: 'ParaSwap aggregate route', reason: 'No independent venue comparison was made.', output: 1990, total_cost_usd: null },
  }),
  '/api/token-scanner': discovery(tokenInput, 'GoPlus', {
    address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', name: 'Pepe', symbol: 'PEPE',
    chain: 'ethereum', deployer: null, deploy_date: null, total_supply: null, holder_count: 100000,
    is_verified: true, has_proxy: false, has_mint_function: false, liquidity_locked: null,
    honeypot_risk: false, buy_tax: 0, sell_tax: 0, liquidity_usd: null, market_cap_usd: null,
    price_usd: null, risk_score: 0, risk_score_basis: 'Local heuristic over available GoPlus flags; not an audit or guarantee',
    risk_level: 'LOW', risk_flags: { is_verified: true, has_proxy: false, has_mint_function: false,
      liquidity_locked: null, honeypot_risk: false, cannot_buy: false, high_buy_tax: false, high_sell_tax: false },
    age_days: null,
  }),
  '/api/whale-tracker': discovery(tokenInput, 'GoPlus', {
    token: 'PEPE', token_address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', chain: 'ethereum',
    total_supply: null, circulating_supply: null, holder_count: 100000,
    concentration_metrics: { top_1_pct: 10, top_10_pct: 30, top_20_pct: null, gini_coefficient: null, herfindahl_index: null },
    distribution_buckets: [], top_holders: [{ rank: 1, address: '0x0000000000000000000000000000000000000001',
      label: null, wallet_type: 'wallet', balance: '1000000', percentage: 10, is_contract: false, is_locked: false }],
    recent_large_transfers: [], coverage: { holders_returned: 10, gini_available: false,
      recent_transfers_available: false, note: 'Top-holder sample only; transfer history unavailable.' },
  }),
  '/api/yield-scanner': discovery({
    chain: { type: 'string', default: 'all' }, asset: { type: 'string', default: 'all' },
    min_tvl: { type: 'number', default: 0 }, limit: { type: 'number', default: 20 },
  }, 'DefiLlama', [{ pool_id: 'example', protocol: 'example', asset: 'USDC', chain: 'base',
    apy: 3, apy_base: 3, apy_reward: 0, tvl: 1000000, stablecoin: true, il_risk: 'no', exposure: 'single' }],
  { total_results: 1, metadata: { note: 'APY is historical/provider reported, not a guarantee. No protocol safety rating is inferred.' } }),
  '/api/funding-rates': discovery({
    asset: { type: 'string', default: 'all' }, min_spread: { type: 'number', default: 0 },
  }, ['Hyperliquid', 'dYdX v4'], {
    BTC: { hyperliquid: { funding_rate: 0.00001, funding_interval_hours: 1, annualized_pct: 8.76,
      open_interest_usd: 1000000, rate_kind: 'current' },
    dydx_v4: { funding_rate: 0.00002, funding_interval_hours: 1, annualized_pct: 17.52,
      open_interest_usd: 1000000, rate_kind: 'next_predicted' } },
  }, { protocols: ['hyperliquid', 'dydx_v4'], funding_interval_hours: 1, arb_opportunities: [] }),
  '/api/wallet-profiler': discovery({
    address: { type: 'string', description: 'Required EVM wallet address' },
    chain: { type: 'string', default: 'all' },
  }, 'Blockscout', {
    address: '0x0000000000000000000000000000000000000001', label: null, wallet_type: null,
    chains_active: ['base'], total_value_usd: 10, defi_value_usd: null,
    portfolio: { top_holdings: [{ token: 'USDC', token_address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      chain: 'base', balance: 10, price_usd: 1, value_usd: 10, reputation: 'ok', portfolio_pct: 100 }],
    unpriced_holdings: [],
    allocation: { native_tokens_pct: 0, stablecoins_pct: 100, defi_tokens_pct: null } },
    defi_positions: [], activity: { total_transactions: null, first_seen: null, last_active: null,
      age_days: null, avg_tx_per_day: null, nft_count: null },
    risk_profile: { classification: null, stablecoin_ratio: 1, diversification_score: null,
      defi_exposure_pct: null, is_contract: null, is_multisig: null },
    coverage: { available_chains: ['base'], unavailable_chains: [], balance_sources: { base: 'Blockscout' }, priced_holdings: 1,
      unpriced_or_untrusted_holdings: 0, valuation_is_partial: true,
      defi_positions_available: false, note: 'Priced wallet balances only; not complete net worth or PnL.' },
  }),
};

// The v1 facilitator reads discovery data from accepts[].outputSchema.
// extensions.bazaar is the v2 location and does not index a v1 challenge.
function v1OutputSchemaFor(resource) {
  const info = BAZAAR_SCHEMAS[resource]?.bazaar?.info;
  if (!info) return undefined;
  return {
    input: {
      ...info.input,
      method: 'GET',
      discoverable: true,
    },
    ...(info.output?.example ? { output: info.output.example } : {}),
  };
}

module.exports = { BAZAAR_SCHEMAS, v1OutputSchemaFor };
