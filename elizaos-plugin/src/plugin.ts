/**
 * x402 DeFi API — ElizaOS Plugin
 *
 * Wraps all 8 pay-per-call DeFi endpoints as ElizaOS actions.
 * Payments handled automatically via x402-fetch (USDC on Base).
 *
 * @example
 * ```typescript
 * // In your character file:
 * import { x402DeFiPlugin } from '@x402-api/elizaos-plugin';
 *
 * export const character: Character = {
 *   name: 'DeFi Agent',
 *   plugins: [
 *     '@elizaos/plugin-bootstrap',
 *     x402DeFiPlugin,
 *   ],
 * };
 * ```
 */

import type { Plugin, IAgentRuntime } from '@elizaos/core';
import { type X402ClientConfig, X402_API_BASE_URL } from './client.js';
import { createPriceFeedAction } from './actions/priceFeed.js';
import { createGasTrackerAction } from './actions/gasTracker.js';
import { createDexQuotesAction } from './actions/dexQuotes.js';
import { createTokenScannerAction } from './actions/tokenScanner.js';
import { createWhaleTrackerAction } from './actions/whaleTracker.js';
import { createYieldScannerAction } from './actions/yieldScanner.js';
import { createFundingRatesAction } from './actions/fundingRates.js';
import { createWalletProfilerAction } from './actions/walletProfiler.js';

export interface X402PluginConfig {
  /**
   * Base URL for the API.
   * @default 'https://x402-api.fly.dev'
   */
  baseUrl?: string;

  /**
   * Wallet private key for automatic x402 payment.
   * Can also be set via X402_WALLET_PRIVATE_KEY env variable.
   * WARNING: Keep this secret! Use env vars, never hardcode.
   */
  walletPrivateKey?: string;

  /**
   * Your wallet address (used for logging).
   * Can also be set via X402_WALLET_ADDRESS env variable.
   */
  walletAddress?: string;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeoutMs?: number;
}

/**
 * Create the x402 DeFi plugin with configuration.
 *
 * @example
 * ```typescript
 * import { createX402Plugin } from '@x402-api/elizaos-plugin';
 *
 * const plugin = createX402Plugin({
 *   walletPrivateKey: process.env.X402_WALLET_PRIVATE_KEY,
 * });
 * ```
 */
export function createX402Plugin(pluginConfig: X402PluginConfig = {}): Plugin {
  let clientConfig: X402ClientConfig = {
    baseUrl: pluginConfig.baseUrl || X402_API_BASE_URL,
    timeoutMs: pluginConfig.timeoutMs || 30_000,
  };

  return {
    name: 'x402-defi-api',
    description:
      'Pay-per-call DeFi intelligence: prices, gas, DEX quotes, token security, ' +
      'whale tracking, yields, funding rates, and wallet analysis. ' +
      'Powered by x402 micropayments (USDC on Base). Base cost: $0.001–$0.008 per query.',

    /**
     * Called once when ElizaOS loads the plugin.
     * Reads wallet configuration from runtime settings or env vars.
     */
    init: async (runtimeConfig: Record<string, string>, runtime: IAgentRuntime) => {
      // Resolve wallet private key from multiple sources (priority order):
      // 1. Plugin config (passed directly)
      // 2. Runtime settings (from character file or .env via elizaos)
      // 3. Process environment
      // getSetting returns string | boolean | number | null — we cast to string for URL/key values
      const privateKey =
        pluginConfig.walletPrivateKey ||
        (runtime.getSetting('X402_WALLET_PRIVATE_KEY') as string | null) ||
        process.env.X402_WALLET_PRIVATE_KEY;

      const walletAddress =
        pluginConfig.walletAddress ||
        (runtime.getSetting('X402_WALLET_ADDRESS') as string | null) ||
        process.env.X402_WALLET_ADDRESS;

      const baseUrl =
        pluginConfig.baseUrl ||
        (runtime.getSetting('X402_API_BASE_URL') as string | null) ||
        process.env.X402_API_BASE_URL ||
        X402_API_BASE_URL;

      clientConfig = {
        baseUrl,
        walletPrivateKey: privateKey,
        walletAddress,
        timeoutMs: pluginConfig.timeoutMs || 30_000,
      };

      if (privateKey) {
        console.log('[x402-plugin] Wallet configured — automatic payment enabled');
        console.log(`[x402-plugin] API: ${baseUrl}`);
      } else {
        console.warn(
          '[x402-plugin] WARNING: No wallet private key configured.\n' +
          '  Set X402_WALLET_PRIVATE_KEY in your .env file to enable automatic x402 payments.\n' +
          '  Without it, API calls will return a 402 Payment Required error.\n' +
          '  See: https://github.com/sugi/x402-api-server#configuration'
        );
      }
    },

    actions: [
      // All 8 actions are created lazily with the clientConfig reference
      // (clientConfig is mutated in init, so actions see the updated config)
      createPriceFeedAction(clientConfig),
      createGasTrackerAction(clientConfig),
      createDexQuotesAction(clientConfig),
      createTokenScannerAction(clientConfig),
      createWhaleTrackerAction(clientConfig),
      createYieldScannerAction(clientConfig),
      createFundingRatesAction(clientConfig),
      createWalletProfilerAction(clientConfig),
    ],
  };
}

/**
 * Default export: pre-configured plugin with env-based settings.
 * Wallet key is read from X402_WALLET_PRIVATE_KEY at runtime.
 */
export const x402DeFiPlugin = createX402Plugin();
