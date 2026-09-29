/**
 * TypeScript types for the x402 DeFi API responses.
 * Base URL: https://x402-api.fly.dev
 *
 * All endpoints require x402 micropayment (USDC on Base).
 */

// ──────────────────────────────────────────────────────────────
// Shared
// ──────────────────────────────────────────────────────────────

export interface X402PaymentInfo {
  payer?: string;
  amount?: string;
  token?: string;
}

export interface ApiResponse<T> {
  timestamp: string;
  source: string;
  cached?: boolean;
  payment?: X402PaymentInfo;
  data: T;
}

// ──────────────────────────────────────────────────────────────
// /api/price-feed
// ──────────────────────────────────────────────────────────────

export interface CoinPrice {
  id: string;
  price_usd: number | null;
  change_24h_pct: number | null;
  volume_24h_usd: number | null;
  market_cap_usd: number | null;
  last_updated: string | null;
}

export interface PriceFeedData {
  core: CoinPrice[];
  top_movers: {
    gainers: CoinPrice[];
    losers: CoinPrice[];
  };
}

export interface PriceFeedResponse extends ApiResponse<PriceFeedData> {
  cache_ttl_seconds: number;
}

// ──────────────────────────────────────────────────────────────
// /api/gas-tracker
// ──────────────────────────────────────────────────────────────

export interface GasTier {
  slow: number | null;
  normal: number;
  fast: number | null;
}

export interface ChainGasData {
  chain: string;
  chain_id: number;
  native_token: string;
  is_mock: boolean;
  gas_price_gwei: GasTier;
  estimated_cost_usd: {
    transfer: GasTier;
    swap: GasTier;
    nft_mint: GasTier;
  };
  tier_method: string;
  native_token_price_usd: number | null;
}

export interface GasTrackerData {
  [chain: string]: ChainGasData;
}

export interface GasTrackerResponse extends ApiResponse<GasTrackerData> {
  cache_ttl_seconds: number;
}

// ──────────────────────────────────────────────────────────────
// /api/dex-quotes
// ──────────────────────────────────────────────────────────────

export interface DexQuote {
  dex: string;
  dex_name: string;
  input_token: string;
  output_token: string;
  input_amount: number;
  output_amount: number;
  effective_rate: number;
  price_impact_pct: number | null;
  fee_bps: number | null;
  fee_usd: number | null;
  estimated_gas_usd: number | null;
  route: string[];
  min_output: number | null;
  expires_in_seconds: number | null;
}

export interface DexQuotesData {
  pair: string;
  chain: string;
  input_amount: number;
  input_value_usd: number | null;
  base_rate: number;
  best_dex: string;
  best_output: number;
  savings_vs_worst: number | null;
  quotes: DexQuote[];
  recommendation: {
    dex: string;
    reason: string;
    output: number;
    total_cost_usd: number | null;
  };
}

export interface DexQuotesQuery {
  from?: string;    // default: "ETH"
  to?: string;      // default: "USDC"
  amount?: number;  // default: 1
  chain?: string;   // default: "ethereum"
}

// ──────────────────────────────────────────────────────────────
// /api/token-scanner
// ──────────────────────────────────────────────────────────────

export interface TokenScanData {
  address: string;
  name: string | null;
  symbol: string | null;
  chain: string;
  deployer: string | null;
  deploy_date: string | null;
  total_supply: string | null;
  holder_count: number | null;
  is_verified: boolean | null;
  has_proxy: boolean | null;
  has_mint_function: boolean | null;
  liquidity_locked: boolean | null;
  honeypot_risk: boolean | null;
  buy_tax: number | null;
  sell_tax: number | null;
  liquidity_usd: number | null;
  market_cap_usd: number | null;
  price_usd: number | null;
  risk_score: number | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  risk_score_basis: string;
  risk_flags: {
    is_verified: boolean | null;
    has_proxy: boolean | null;
    has_mint_function: boolean | null;
    liquidity_locked: boolean | null;
    honeypot_risk: boolean | null;
    cannot_buy: boolean | null;
    high_buy_tax: boolean | null;
    high_sell_tax: boolean | null;
  };
  age_days: number | null;
}

export interface TokenScanQuery {
  token?: string;  // address or symbol, default: "PEPE"
  chain?: string;  // default: "ethereum"
}

// ──────────────────────────────────────────────────────────────
// /api/whale-tracker
// ──────────────────────────────────────────────────────────────

export interface WhaleHolder {
  rank: number;
  address: string;
  label: string | null;
  wallet_type: string;
  balance: string | null;
  percentage: number | null;
  is_contract: boolean;
  is_locked: boolean;
}

export interface WhaleTransfer {
  tx_hash: string;
  from: string;
  to: string;
  amount: number;
  usd_value: number;
  timestamp: string;
  transfer_type: string;
}

export interface WhaleTrackerData {
  token: string;
  chain: string;
  token_address: string;
  total_supply: string | null;
  circulating_supply: number | null;
  holder_count: number | null;
  concentration_metrics: {
    top_1_pct: number | null;
    top_10_pct: number | null;
    top_20_pct: number | null;
    gini_coefficient: number | null;
    herfindahl_index: number | null;
  };
  distribution_buckets: Array<{
    label: string;
    holder_pct: number;
    supply_pct: number;
  }>;
  top_holders: WhaleHolder[];
  recent_large_transfers: WhaleTransfer[];
  coverage: { holders_returned: number; gini_available: boolean; recent_transfers_available: boolean; note: string };
}

export interface WhaleTrackerQuery {
  token?: string;  // symbol or address, default: "ETH"
  chain?: string;  // default: "ethereum"
}

// ──────────────────────────────────────────────────────────────
// /api/yield-scanner
// ──────────────────────────────────────────────────────────────

export interface YieldPool {
  pool_id: string;
  protocol: string;
  asset: string;
  chain: string;
  apy: number;
  tvl: number;
  apy_base: number | null;
  apy_reward: number | null;
  stablecoin: boolean | null;
  il_risk: string | null;
  exposure: string | null;
}

export interface YieldScannerQuery {
  chain?: string;    // default: "all"
  min_tvl?: number;  // default: 0
  asset?: string;    // filter by asset symbol
  limit?: number;    // default: 20, max: 50
}

// ──────────────────────────────────────────────────────────────
// /api/funding-rates
// ──────────────────────────────────────────────────────────────

export interface FundingRateEntry {
  funding_rate: number;
  funding_interval_hours: number;
  annualized_pct: number;
  open_interest_usd: number | null;
  rate_kind: string;
}

export interface ArbOpportunity {
  asset: string;
  long_venue: string;
  long_rate: number;
  short_venue: string;
  short_rate: number;
  spread_bps: number;
  annualized_arb_pct: number;
  note: string;
}

export interface FundingRatesData {
  [asset: string]: {
    [protocol: string]: FundingRateEntry;
  };
}

export interface FundingRatesQuery {
  asset?: string;       // BTC, ETH, SOL, etc.
  min_spread?: number;  // minimum spread in bps
}

// ──────────────────────────────────────────────────────────────
// /api/wallet-profiler
// ──────────────────────────────────────────────────────────────

export interface WalletHolding {
  token: string;
  token_address: string | null;
  chain: string;
  balance: number;
  price_usd: number | null;
  value_usd: number;
  portfolio_pct: number;
}

export interface DefiPosition {
  protocol: string;
  type: string;
  asset: string;
  chain: string;
  value_usd: number;
  apy: number;
}

export interface WalletProfileData {
  address: string;
  label: string | null;
  wallet_type: string | null;
  chains_active: string[];
  total_value_usd: number;
  defi_value_usd: number | null;
  portfolio: {
    top_holdings: WalletHolding[];
    unpriced_holdings: Array<{ token: string; token_address: string | null; chain: string; balance: number; price_usd: number | null; value_usd: number | null; reputation: string | null }>;
    allocation: {
      native_tokens_pct: number | null;
      stablecoins_pct: number | null;
      defi_tokens_pct: number | null;
    };
  };
  defi_positions: DefiPosition[];
  activity: {
    total_transactions: number | null;
    first_seen: string | null;
    last_active: string | null;
    age_days: number | null;
    avg_tx_per_day: number | null;
    nft_count: number | null;
  };
  risk_profile: {
    classification: 'conservative' | 'moderate' | 'aggressive' | null;
    stablecoin_ratio: number | null;
    diversification_score: number | null;
    defi_exposure_pct: number | null;
    is_contract: boolean | null;
    is_multisig: boolean | null;
  };
  coverage: { available_chains: string[]; unavailable_chains: string[]; balance_sources: Record<string, string>; priced_holdings: number; unpriced_or_untrusted_holdings: number; valuation_is_partial: boolean; defi_positions_available: boolean; note: string };
}

export interface WalletProfilerQuery {
  address?: string;  // default: Vitalik's wallet
  chain?: string;    // default: "all"
}
