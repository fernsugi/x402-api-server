/**
 * Bazaar-enabled x402 v2 Middleware
 *
 * Implements the official Coinbase x402 v2 SDK with Bazaar discovery extension.
 * When agents hit a 402, the Coinbase facilitator at x402.org/facilitator will
 * extract the Bazaar metadata and index this API in the global discovery catalog.
 *
 * Agents can then find our endpoints at:
 *   https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources
 *
 * @see https://docs.cdp.coinbase.com/x402/bazaar
 */

'use strict';

const { paymentMiddleware } = require('@x402/express');
const { declareDiscoveryExtension } = require('@x402/extensions/bazaar');
const { registerExactEvmScheme } = require('@x402/evm/exact/server');
const { x402ResourceServer, HTTPFacilitatorClient } = require('@x402/core/server');

const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS || '0x60264c480b67adb557efEd22Cf0e7ceA792DefB7';
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://x402.org/facilitator';
const NETWORK = 'eip155:8453'; // Base mainnet

/**
 * Build x402 v2 payment middleware with Bazaar discovery extensions.
 *
 * Route format: "METHOD /path" → RouteConfig
 * Each route declares input/output schemas for the Bazaar catalog.
 */
function createX402Middleware() {
  // Create resource server with Coinbase facilitator
  const resourceServer = new x402ResourceServer(
    new HTTPFacilitatorClient({ url: FACILITATOR_URL })
  );

  // Register EVM exact payment scheme (supports Base, Ethereum, etc.)
  registerExactEvmScheme(resourceServer);

  // Route configuration with Bazaar discovery metadata
  const routes = {

    'GET /api/price-feed': {
      accepts: {
        scheme: 'exact',
        payTo: PAY_TO_ADDRESS,
        price: '$0.001',
        network: NETWORK,
      },
      description: 'Aggregated crypto price feed: BTC, ETH, SOL + top movers by 24h change. Live data from CoinGecko.',
      mimeType: 'application/json',
      extensions: {
        ...declareDiscoveryExtension({
          output: {
            example: {
              timestamp: '2025-01-01T00:00:00.000Z',
              source: 'CoinGecko',
              cached: false,
              cache_ttl_seconds: 60,
              data: {
                core: [
                  { id: 'bitcoin', price_usd: 98000, change_24h_pct: 2.1, volume_24h_usd: 38000000000, market_cap_usd: 1920000000000 },
                  { id: 'ethereum', price_usd: 2750, change_24h_pct: -0.8, volume_24h_usd: 18500000000, market_cap_usd: 330000000000 },
                  { id: 'solana', price_usd: 185, change_24h_pct: 4.2, volume_24h_usd: 5200000000, market_cap_usd: 87000000000 },
                ],
                top_movers: {
                  gainers: [{ id: 'sui', price_usd: 3.2, change_24h_pct: 12.5 }],
                  losers: [{ id: 'near', price_usd: 4.1, change_24h_pct: -8.3 }],
                },
              },
            },
            schema: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', description: 'ISO timestamp of response' },
                source: { type: 'string' },
                cached: { type: 'boolean' },
                cache_ttl_seconds: { type: 'number' },
                data: {
                  type: 'object',
                  properties: {
                    core: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          price_usd: { type: 'number' },
                          change_24h_pct: { type: 'number' },
                          volume_24h_usd: { type: 'number' },
                          market_cap_usd: { type: 'number' },
                          last_updated: { type: 'string' },
                        },
                      },
                    },
                    top_movers: {
                      type: 'object',
                      properties: {
                        gainers: { type: 'array' },
                        losers: { type: 'array' },
                      },
                    },
                  },
                },
              },
              required: ['timestamp', 'data'],
            },
          },
        }),
      },
    },

    'GET /api/whale-tracker': {
      accepts: {
        scheme: 'exact',
        payTo: PAY_TO_ADDRESS,
        price: '$0.005',
        network: NETWORK,
      },
      description: 'Token holder concentration analysis: whale distribution, Gini coefficient, large transfer alerts.',
      mimeType: 'application/json',
      extensions: {
        ...declareDiscoveryExtension({
          input: {
            token: { type: 'string', description: 'Token symbol (e.g. ETH, BTC)', default: 'ETH' },
            chain: { type: 'string', description: 'Blockchain (ethereum, base, solana)', default: 'ethereum' },
          },
          output: {
            example: {
              token: 'ETH',
              chain: 'ethereum',
              holder_stats: {
                total_holders: 95000000,
                top10_pct: 28.4,
                top100_pct: 42.1,
                gini_coefficient: 0.71,
              },
              whale_tiers: [
                { tier: 'mega_whale', min_balance: 10000, holder_count: 142 },
                { tier: 'whale', min_balance: 1000, holder_count: 1840 },
              ],
              recent_large_transfers: [
                { amount: 5000, usd_value: 13750000, from: '0xabc...', to: '0xdef...', timestamp: '2025-01-01T00:00:00Z' },
              ],
            },
            schema: {
              type: 'object',
              properties: {
                token: { type: 'string' },
                chain: { type: 'string' },
                holder_stats: {
                  type: 'object',
                  properties: {
                    total_holders: { type: 'number' },
                    top10_pct: { type: 'number', description: '% held by top 10 wallets' },
                    top100_pct: { type: 'number' },
                    gini_coefficient: { type: 'number', description: '0=equal, 1=max concentration' },
                  },
                },
                whale_tiers: { type: 'array' },
                recent_large_transfers: { type: 'array' },
              },
            },
          },
        }),
      },
    },

    'GET /api/funding-rates': {
      accepts: {
        scheme: 'exact',
        payTo: PAY_TO_ADDRESS,
        price: '$0.008',
        network: NETWORK,
      },
      description: 'Perp funding rates across Hyperliquid, dYdX v4, Aevo, GMX, Drift, Vertex. Arb opportunity ranking.',
      mimeType: 'application/json',
      extensions: {
        ...declareDiscoveryExtension({
          input: {
            asset: { type: 'string', description: 'Asset to filter (or "all")', default: 'all' },
            min_spread: { type: 'number', description: 'Min arb spread % to include', default: 0 },
          },
          output: {
            example: {
              timestamp: '2025-01-01T00:00:00.000Z',
              top_opportunities: [
                {
                  asset: 'BTC',
                  long_venue: 'dydx',
                  short_venue: 'hyperliquid',
                  long_rate_8h: -0.0015,
                  short_rate_8h: 0.0032,
                  spread: 0.0047,
                  annualized_yield_pct: 20.5,
                },
              ],
              by_asset: {
                BTC: [
                  { venue: 'hyperliquid', rate_8h: 0.0032, annualized_pct: 14.2 },
                  { venue: 'dydx', rate_8h: -0.0015, annualized_pct: -6.7 },
                ],
              },
            },
            schema: {
              type: 'object',
              properties: {
                timestamp: { type: 'string' },
                top_opportunities: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      asset: { type: 'string' },
                      long_venue: { type: 'string' },
                      short_venue: { type: 'string' },
                      spread: { type: 'number' },
                      annualized_yield_pct: { type: 'number' },
                    },
                  },
                },
                by_asset: { type: 'object', description: 'Funding rates keyed by asset symbol' },
              },
            },
          },
        }),
      },
    },

    'GET /api/gas-tracker': {
      accepts: {
        scheme: 'exact',
        payTo: PAY_TO_ADDRESS,
        price: '$0.001',
        network: NETWORK,
      },
      description: 'Gas prices across Ethereum, Base, Polygon, Arbitrum with speed tiers and USD cost estimates.',
      mimeType: 'application/json',
      extensions: {
        ...declareDiscoveryExtension({
          output: {
            example: {
              timestamp: '2025-01-01T00:00:00.000Z',
              chains: {
                ethereum: {
                  slow: { gwei: 15, usd_transfer: 0.42, usd_swap: 2.10, wait_min: 5 },
                  standard: { gwei: 22, usd_transfer: 0.62, usd_swap: 3.10, wait_min: 2 },
                  fast: { gwei: 35, usd_transfer: 0.98, usd_swap: 4.90, wait_min: 1 },
                },
                base: {
                  slow: { gwei: 0.001, usd_transfer: 0.0001, usd_swap: 0.001, wait_min: 2 },
                  standard: { gwei: 0.002, usd_transfer: 0.0002, usd_swap: 0.002, wait_min: 1 },
                  fast: { gwei: 0.005, usd_transfer: 0.0005, usd_swap: 0.005, wait_min: 0.5 },
                },
              },
            },
            schema: {
              type: 'object',
              properties: {
                timestamp: { type: 'string' },
                chains: {
                  type: 'object',
                  description: 'Gas data keyed by chain name',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      slow: { type: 'object' },
                      standard: { type: 'object' },
                      fast: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        }),
      },
    },

    'GET /api/token-scanner': {
      accepts: {
        scheme: 'exact',
        payTo: PAY_TO_ADDRESS,
        price: '$0.003',
        network: NETWORK,
      },
      description: 'Token security & risk analysis: contract verification, holder stats, liquidity, rug-pull risk flags.',
      mimeType: 'application/json',
      extensions: {
        ...declareDiscoveryExtension({
          input: {
            token: { type: 'string', description: 'Token symbol or contract address', default: 'PEPE' },
            chain: { type: 'string', description: 'Blockchain to scan', default: 'ethereum' },
          },
          output: {
            example: {
              token: 'PEPE',
              chain: 'ethereum',
              contract: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
              risk_score: 42,
              risk_level: 'medium',
              security: {
                verified: true,
                renounced: true,
                proxy: false,
                honeypot: false,
                sell_tax_pct: 0,
                buy_tax_pct: 0,
              },
              liquidity: {
                total_usd: 28500000,
                locked_pct: 95,
                top_pool: 'Uniswap V3',
              },
              holder_stats: {
                count: 182000,
                top10_pct: 22.1,
              },
              flags: [],
            },
            schema: {
              type: 'object',
              properties: {
                token: { type: 'string' },
                chain: { type: 'string' },
                contract: { type: 'string' },
                risk_score: { type: 'number', description: '0-100, lower is safer' },
                risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                security: {
                  type: 'object',
                  properties: {
                    verified: { type: 'boolean' },
                    renounced: { type: 'boolean' },
                    honeypot: { type: 'boolean' },
                    sell_tax_pct: { type: 'number' },
                    buy_tax_pct: { type: 'number' },
                  },
                },
                liquidity: { type: 'object' },
                holder_stats: { type: 'object' },
                flags: { type: 'array', description: 'Risk flag strings' },
              },
            },
          },
        }),
      },
    },

    'GET /api/dex-quotes': {
      accepts: {
        scheme: 'exact',
        payTo: PAY_TO_ADDRESS,
        price: '$0.002',
        network: NETWORK,
      },
      description: 'Compare swap quotes across Uniswap, SushiSwap, 1inch with price impact and route optimization.',
      mimeType: 'application/json',
      extensions: {
        ...declareDiscoveryExtension({
          input: {
            from: { type: 'string', description: 'Input token symbol or address', default: 'ETH' },
            to: { type: 'string', description: 'Output token symbol or address', default: 'USDC' },
            amount: { type: 'number', description: 'Input amount', default: 1 },
            chain: { type: 'string', description: 'Chain to query', default: 'ethereum' },
          },
          output: {
            example: {
              from: 'ETH',
              to: 'USDC',
              amount: 1,
              chain: 'ethereum',
              best_quote: {
                venue: '1inch',
                out_amount: 2748.32,
                price_impact_pct: 0.03,
                estimated_gas_usd: 4.20,
                route: ['ETH', 'WETH', 'USDC'],
              },
              all_quotes: [
                { venue: '1inch', out_amount: 2748.32, price_impact_pct: 0.03 },
                { venue: 'uniswap_v3', out_amount: 2746.18, price_impact_pct: 0.05 },
                { venue: 'sushiswap', out_amount: 2741.90, price_impact_pct: 0.12 },
              ],
            },
            schema: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                amount: { type: 'number' },
                best_quote: {
                  type: 'object',
                  properties: {
                    venue: { type: 'string' },
                    out_amount: { type: 'number' },
                    price_impact_pct: { type: 'number' },
                    estimated_gas_usd: { type: 'number' },
                    route: { type: 'array', items: { type: 'string' } },
                  },
                },
                all_quotes: { type: 'array' },
              },
            },
          },
        }),
      },
    },

    'GET /api/yield-scanner': {
      accepts: {
        scheme: 'exact',
        payTo: PAY_TO_ADDRESS,
        price: '$0.005',
        network: NETWORK,
      },
      description: 'Top DeFi yields across Aave, Compound, Morpho, Lido, Pendle, Ethena. Filter by chain, asset, TVL.',
      mimeType: 'application/json',
      extensions: {
        ...declareDiscoveryExtension({
          input: {
            chain: { type: 'string', description: 'Chain filter or "all"', default: 'all' },
            min_tvl: { type: 'number', description: 'Minimum TVL in USD', default: 0 },
            asset: { type: 'string', description: 'Asset filter or "all"', default: 'all' },
            limit: { type: 'number', description: 'Max results', default: 20 },
          },
          output: {
            example: {
              timestamp: '2025-01-01T00:00:00.000Z',
              count: 3,
              opportunities: [
                {
                  protocol: 'ethena',
                  asset: 'USDe',
                  chain: 'ethereum',
                  apy_pct: 18.4,
                  tvl_usd: 2800000000,
                  type: 'staking',
                  risk_level: 'medium',
                  url: 'https://ethena.fi',
                },
                {
                  protocol: 'pendle',
                  asset: 'stETH',
                  chain: 'ethereum',
                  apy_pct: 12.1,
                  tvl_usd: 850000000,
                  type: 'yield_trading',
                  risk_level: 'medium',
                },
                {
                  protocol: 'aave_v3',
                  asset: 'USDC',
                  chain: 'base',
                  apy_pct: 6.8,
                  tvl_usd: 420000000,
                  type: 'lending',
                  risk_level: 'low',
                },
              ],
            },
            schema: {
              type: 'object',
              properties: {
                timestamp: { type: 'string' },
                count: { type: 'number' },
                opportunities: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      protocol: { type: 'string' },
                      asset: { type: 'string' },
                      chain: { type: 'string' },
                      apy_pct: { type: 'number' },
                      tvl_usd: { type: 'number' },
                      type: { type: 'string' },
                      risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
                      url: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        }),
      },
    },

    'GET /api/wallet-profiler': {
      accepts: {
        scheme: 'exact',
        payTo: PAY_TO_ADDRESS,
        price: '$0.008',
        network: NETWORK,
      },
      description: 'Wallet portfolio analysis: holdings, DeFi positions, activity metrics, risk profile.',
      mimeType: 'application/json',
      extensions: {
        ...declareDiscoveryExtension({
          input: {
            address: { type: 'string', description: 'Wallet address to analyze', default: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
            chain: { type: 'string', description: 'Chain or "all"', default: 'all' },
          },
          output: {
            example: {
              address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
              label: 'vitalik.eth',
              total_usd: 1250000,
              risk_score: 28,
              activity: {
                first_tx: '2015-07-30',
                last_tx: '2025-01-01',
                tx_count: 1842,
                defi_protocols_used: 47,
              },
              holdings: [
                { token: 'ETH', amount: 350, usd_value: 962500, chain: 'ethereum' },
                { token: 'USDC', amount: 45000, usd_value: 45000, chain: 'base' },
              ],
              defi_positions: [
                { protocol: 'aave_v3', type: 'supply', asset: 'USDC', amount: 30000, usd_value: 30000, apy: 6.8 },
              ],
              ens: 'vitalik.eth',
              tags: ['whale', 'defi_power_user', 'nft_collector'],
            },
            schema: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                label: { type: 'string', description: 'ENS or known label' },
                total_usd: { type: 'number' },
                risk_score: { type: 'number', description: '0-100, activity-based risk' },
                activity: { type: 'object' },
                holdings: { type: 'array' },
                defi_positions: { type: 'array' },
                ens: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
              },
              required: ['address', 'holdings'],
            },
          },
        }),
      },
    },

  };

  return paymentMiddleware(routes, resourceServer);
}

module.exports = { createX402Middleware, PAY_TO_ADDRESS };
