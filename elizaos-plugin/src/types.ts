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
  slow: number;
  normal: number;
  fast: number;
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
}

export interface GasTrackerData {
  ethereum: ChainGasData;
  base: ChainGasData;
  polygon: ChainGasData;
  arbitrum: ChainGasData;
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
  price_impact_pct: number;
  fee_bps: number;
  fee_usd: number;
  estimated_gas_usd: number;
  route: string[];
  min_output: number;
  expires_in_seconds: number;
}

export interface DexQuotesData {
  pair: string;
  chain: string;
  input_amount: number;
  input_value_usd: number;
  base_rate: number;
  best_dex: string;
  best_output: number;
  savings_vs_worst: number;
  quotes: DexQuote[];
  recommendation: {
    dex: string;
    reason: string;
    output: number;
    total_cost_usd: number;
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
  name: string;
  symbol: string;
  decimals: number;
  chain: string;
  deployer: string;
  deploy_date: string;
  total_supply: number;
  holder_count: number;
  is_verified: boolean;
  has_proxy: boolean;
  has_mint_function: boolean;
  liquidity_locked: boolean;
  honeypot_risk: boolean;
  buy_tax: number;
  sell_tax: number;
  liquidity_usd: number;
  market_cap_usd: number;
  price_usd: number;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_flags: {
    is_verified: boolean;
    has_proxy: boolean;
    has_mint_function: boolean;
    liquidity_locked: boolean;
    honeypot_risk: boolean;
    high_buy_tax: boolean;
    high_sell_tax: boolean;
  };
  age_days: number;
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
  label: string;
  wallet_type: string;
  balance: number;
  percentage: number;
  last_active: string;
  is_contract: boolean;
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
  total_supply: number;
  circulating_supply: number;
  holder_count: number;
  concentration_metrics: {
    top_1_pct: number;
    top_10_pct: number;
    top_20_pct: number;
    gini_coefficient: number;
    herfindahl_index: number;
  };
  distribution_buckets: Array<{
    label: string;
    holder_pct: number;
    supply_pct: number;
  }>;
  top_holders: WhaleHolder[];
  recent_large_transfers: WhaleTransfer[];
}

export interface WhaleTrackerQuery {
  token?: string;  // symbol or address, default: "ETH"
  chain?: string;  // default: "ethereum"
}

// ──────────────────────────────────────────────────────────────
// /api/yield-scanner
// ──────────────────────────────────────────────────────────────

export interface YieldPool {
  protocol: string;
  asset: string;
  chain: string;
  apy: number;
  tvl: number;
  risk_tier: 'low' | 'medium' | 'high';
  type: string;
  updated_at: string;
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
  annualized_pct: number;
  predicted_rate: number;
  open_interest_usd: number;
  next_funding_in_ms: number;
  last_updated: string;
}

export interface ArbOpportunity {
  asset: string;
  long_venue: string;
  long_rate: number;
  short_venue: string;
  short_rate: number;
  spread_bps: number;
  annualized_arb_pct: number;
  signal: 'STRONG' | 'MODERATE' | 'WEAK';
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
  chain: string;
  balance: number;
  price_usd: number;
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
  wallet_type: string;
  chains_active: string[];
  total_value_usd: number;
  defi_value_usd: number;
  portfolio: {
    top_holdings: WalletHolding[];
    allocation: {
      native_tokens_pct: number;
      stablecoins_pct: number;
      defi_tokens_pct: number;
    };
  };
  defi_positions: DefiPosition[];
  activity: {
    total_transactions: number;
    first_seen: string;
    last_active: string;
    age_days: number;
    avg_tx_per_day: number;
    nft_count: number;
  };
  risk_profile: {
    classification: 'conservative' | 'moderate' | 'aggressive';
    stablecoin_ratio: number;
    diversification_score: number;
    defi_exposure_pct: number;
    is_contract: boolean;
    is_multisig: boolean;
  };
}

export interface WalletProfilerQuery {
  address?: string;  // default: Vitalik's wallet
  chain?: string;    // default: "all"
}
