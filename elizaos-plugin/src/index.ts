/**
 * @x402-api/elizaos-plugin
 *
 * ElizaOS plugin wrapping the x402 DeFi API — 8 pay-per-call endpoints
 * for crypto prices, gas, DEX quotes, token security, whale tracking,
 * yields, funding rates, and wallet analysis.
 *
 * @see https://x402-api.fly.dev
 * @see https://github.com/sugi/x402-api-server
 */

// Main plugin
export { x402DeFiPlugin, createX402Plugin } from './plugin.js';
export type { X402PluginConfig } from './plugin.js';

// Client utilities
export { x402ApiRequest, extractParams, X402_API_BASE_URL } from './client.js';
export type { X402ClientConfig } from './client.js';

// Individual action factories (for custom composition)
export { createPriceFeedAction } from './actions/priceFeed.js';
export { createGasTrackerAction } from './actions/gasTracker.js';
export { createDexQuotesAction } from './actions/dexQuotes.js';
export { createTokenScannerAction } from './actions/tokenScanner.js';
export { createWhaleTrackerAction } from './actions/whaleTracker.js';
export { createYieldScannerAction } from './actions/yieldScanner.js';
export { createFundingRatesAction } from './actions/fundingRates.js';
export { createWalletProfilerAction } from './actions/walletProfiler.js';

// TypeScript types for all API responses
export type {
  // Shared
  X402PaymentInfo,
  ApiResponse,

  // Price Feed
  CoinPrice,
  PriceFeedData,
  PriceFeedResponse,

  // Gas Tracker
  GasTier,
  ChainGasData,
  GasTrackerData,
  GasTrackerResponse,

  // DEX Quotes
  DexQuote,
  DexQuotesData,
  DexQuotesQuery,

  // Token Scanner
  TokenScanData,
  TokenScanQuery,

  // Whale Tracker
  WhaleHolder,
  WhaleTransfer,
  WhaleTrackerData,
  WhaleTrackerQuery,

  // Yield Scanner
  YieldPool,
  YieldScannerQuery,

  // Funding Rates
  FundingRateEntry,
  ArbOpportunity,
  FundingRatesData,
  FundingRatesQuery,

  // Wallet Profiler
  WalletHolding,
  DefiPosition,
  WalletProfileData,
  WalletProfilerQuery,
} from './types.js';
