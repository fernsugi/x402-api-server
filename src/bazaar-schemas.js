/**
 * Bazaar Discovery Schemas
 *
 * Machine-readable input/output schemas for all x402-gated endpoints.
 * These are included in 402 Payment Required responses so that AI agents
 * can automatically discover, understand, and use each endpoint.
 *
 * Format is compatible with the Coinbase x402 Bazaar discovery extension:
 *   https://docs.cdp.coinbase.com/x402/bazaar
 *
 * When the Coinbase facilitator adds Base mainnet (eip155:8453) support,
 * migrating to the full v2 SDK is straightforward — schemas are already defined.
 */

'use strict';

const { declareDiscoveryExtension } = require('@x402/extensions/bazaar');

/**
 * Map of API resource path → Bazaar discovery extension metadata.
 * Keys match the `resource` field passed to requirePayment().
 */
const BAZAAR_SCHEMAS = {

  '/api/price-feed': declareDiscoveryExtension({
    output: {
      example: {
        timestamp: '2025-01-01T00:00:00.000Z',
        source: 'CoinGecko',
        cached: false,
        cache_ttl_seconds: 60,
        data: {
          core: [
            { id: 'bitcoin', price_usd: 98000, change_24h_pct: 2.1, volume_24h_usd: 38000000000, market_cap_usd: 1920000000000, last_updated: '2025-01-01T00:00:00.000Z' },
            { id: 'ethereum', price_usd: 2750, change_24h_pct: -0.8, volume_24h_usd: 18500000000, market_cap_usd: 330000000000, last_updated: '2025-01-01T00:00:00.000Z' },
            { id: 'solana', price_usd: 185, change_24h_pct: 4.2, volume_24h_usd: 5200000000, market_cap_usd: 87000000000, last_updated: '2025-01-01T00:00:00.000Z' },
          ],
          top_movers: {
            gainers: [{ id: 'sui', price_usd: 3.2, change_24h_pct: 12.5, volume_24h_usd: 980000000, market_cap_usd: 9200000000 }],
            losers: [{ id: 'near', price_usd: 4.1, change_24h_pct: -8.3, volume_24h_usd: 650000000, market_cap_usd: 4700000000 }],
          },
        },
      },
      schema: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', description: 'ISO 8601 response timestamp' },
          source: { type: 'string' },
          cached: { type: 'boolean' },
          cache_ttl_seconds: { type: 'number' },
          data: {
            type: 'object',
            properties: {
              core: {
                type: 'array',
                description: 'BTC, ETH, SOL — always included',
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
                  gainers: { type: 'array', description: 'Top 5 24h gainers (excl. core)' },
                  losers: { type: 'array', description: 'Top 5 24h losers (excl. core)' },
                },
              },
            },
          },
        },
        required: ['timestamp', 'data'],
      },
    },
  }),

  '/api/whale-tracker': declareDiscoveryExtension({
    input: {
      token: { type: 'string', description: 'Token symbol (ETH, BTC, SOL, etc.)', default: 'ETH' },
      chain: { type: 'string', description: 'Chain: ethereum, base, solana, etc.', default: 'ethereum' },
    },
    output: {
      example: {
        token: 'ETH',
        chain: 'ethereum',
        timestamp: '2025-01-01T00:00:00.000Z',
        holder_stats: {
          total_holders: 95000000,
          top10_pct: 28.4,
          top100_pct: 42.1,
          gini_coefficient: 0.71,
          concentration_risk: 'moderate',
        },
        whale_tiers: [
          { tier: 'mega_whale', min_balance: 10000, holder_count: 142, pct_supply: 8.2 },
          { tier: 'whale', min_balance: 1000, holder_count: 1840, pct_supply: 12.6 },
          { tier: 'dolphin', min_balance: 100, holder_count: 24000, pct_supply: 18.1 },
        ],
        recent_large_transfers: [
          { amount: 5000, usd_value: 13750000, from: '0xabc...', to: '0xdef...', timestamp: '2025-01-01T00:00:00Z', type: 'exchange_withdrawal' },
        ],
      },
      schema: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          chain: { type: 'string' },
          timestamp: { type: 'string' },
          holder_stats: {
            type: 'object',
            properties: {
              total_holders: { type: 'number' },
              top10_pct: { type: 'number', description: 'Percent of supply held by top 10 wallets' },
              top100_pct: { type: 'number' },
              gini_coefficient: { type: 'number', description: '0=perfectly equal, 1=maximum concentration' },
              concentration_risk: { type: 'string', enum: ['low', 'moderate', 'high', 'critical'] },
            },
          },
          whale_tiers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tier: { type: 'string' },
                min_balance: { type: 'number' },
                holder_count: { type: 'number' },
                pct_supply: { type: 'number' },
              },
            },
          },
          recent_large_transfers: { type: 'array' },
        },
      },
    },
  }),

  '/api/funding-rates': declareDiscoveryExtension({
    input: {
      asset: { type: 'string', description: 'Asset symbol or "all" for all markets', default: 'all' },
      min_spread: { type: 'number', description: 'Minimum arb spread % to include (e.g. 0.1)', default: 0 },
    },
    output: {
      example: {
        timestamp: '2025-01-01T00:00:00.000Z',
        venues_checked: ['hyperliquid', 'dydx', 'aevo', 'gmx', 'drift', 'vertex'],
        top_opportunities: [
          {
            asset: 'BTC',
            long_venue: 'dydx',
            short_venue: 'hyperliquid',
            long_rate_8h: -0.0015,
            short_rate_8h: 0.0032,
            spread: 0.0047,
            annualized_yield_pct: 20.5,
            risk_notes: 'Capital lockup, basis risk',
          },
        ],
        by_asset: {
          BTC: [
            { venue: 'hyperliquid', rate_8h: 0.0032, annualized_pct: 14.2, open_interest_usd: 890000000 },
            { venue: 'dydx', rate_8h: -0.0015, annualized_pct: -6.7, open_interest_usd: 420000000 },
          ],
        },
      },
      schema: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          venues_checked: { type: 'array', items: { type: 'string' } },
          top_opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                asset: { type: 'string' },
                long_venue: { type: 'string' },
                short_venue: { type: 'string' },
                spread: { type: 'number', description: 'Rate spread (basis points)' },
                annualized_yield_pct: { type: 'number' },
              },
            },
          },
          by_asset: {
            type: 'object',
            description: 'Funding rates keyed by asset symbol',
          },
        },
      },
    },
  }),

  '/api/gas-tracker': declareDiscoveryExtension({
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
          polygon: {
            slow: { gwei: 80, usd_transfer: 0.002, usd_swap: 0.008, wait_min: 3 },
            standard: { gwei: 120, usd_transfer: 0.003, usd_swap: 0.012, wait_min: 1 },
            fast: { gwei: 200, usd_transfer: 0.005, usd_swap: 0.020, wait_min: 0.5 },
          },
          arbitrum: {
            slow: { gwei: 0.1, usd_transfer: 0.005, usd_swap: 0.020, wait_min: 1 },
            standard: { gwei: 0.15, usd_transfer: 0.008, usd_swap: 0.030, wait_min: 0.5 },
            fast: { gwei: 0.25, usd_transfer: 0.012, usd_swap: 0.050, wait_min: 0.2 },
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
                slow: { type: 'object', properties: { gwei: { type: 'number' }, usd_transfer: { type: 'number' }, usd_swap: { type: 'number' }, wait_min: { type: 'number' } } },
                standard: { type: 'object' },
                fast: { type: 'object' },
              },
            },
          },
        },
        required: ['timestamp', 'chains'],
      },
    },
  }),

  '/api/token-scanner': declareDiscoveryExtension({
    input: {
      token: { type: 'string', description: 'Token symbol (PEPE, SHIB) or contract address (0x...)', default: 'PEPE' },
      chain: { type: 'string', description: 'Blockchain to scan', default: 'ethereum' },
    },
    output: {
      example: {
        token: 'PEPE',
        chain: 'ethereum',
        contract: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
        timestamp: '2025-01-01T00:00:00.000Z',
        risk_score: 42,
        risk_level: 'medium',
        security: {
          verified: true,
          renounced: true,
          proxy: false,
          honeypot: false,
          sell_tax_pct: 0,
          buy_tax_pct: 0,
          blacklist_function: false,
          mint_function: false,
        },
        liquidity: {
          total_usd: 28500000,
          locked_pct: 95,
          top_pool: 'Uniswap V3',
          pools: [{ name: 'Uniswap V3', liquidity_usd: 24000000, pair: 'PEPE/WETH' }],
        },
        holder_stats: {
          count: 182000,
          top10_pct: 22.1,
          top_holder: { address: '0xabc...', pct: 8.4 },
        },
        flags: [],
        score_breakdown: { contract_risk: 10, liquidity_risk: 15, holder_risk: 17, trading_risk: 0 },
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
          flags: { type: 'array', items: { type: 'string' }, description: 'Risk flag strings' },
        },
        required: ['token', 'chain', 'risk_score', 'risk_level'],
      },
    },
  }),

  '/api/dex-quotes': declareDiscoveryExtension({
    input: {
      from: { type: 'string', description: 'Input token symbol or contract address', default: 'ETH' },
      to: { type: 'string', description: 'Output token symbol or contract address', default: 'USDC' },
      amount: { type: 'number', description: 'Input amount (in token units)', default: 1 },
      chain: { type: 'string', description: 'Chain to query (ethereum, base, polygon, arbitrum)', default: 'ethereum' },
    },
    output: {
      example: {
        from: 'ETH',
        to: 'USDC',
        amount: 1,
        chain: 'ethereum',
        timestamp: '2025-01-01T00:00:00.000Z',
        best_quote: {
          venue: '1inch',
          out_amount: 2748.32,
          price_impact_pct: 0.03,
          estimated_gas_usd: 4.20,
          route: ['ETH', 'WETH', 'USDC'],
          savings_vs_worst_usd: 6.42,
        },
        all_quotes: [
          { venue: '1inch', out_amount: 2748.32, price_impact_pct: 0.03, estimated_gas_usd: 4.20 },
          { venue: 'uniswap_v3', out_amount: 2746.18, price_impact_pct: 0.05, estimated_gas_usd: 3.80 },
          { venue: 'sushiswap', out_amount: 2741.90, price_impact_pct: 0.12, estimated_gas_usd: 3.50 },
        ],
        market_reference: { mid_price: 2749.50, spread_bps: 12 },
      },
      schema: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          amount: { type: 'number' },
          chain: { type: 'string' },
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
          market_reference: { type: 'object' },
        },
        required: ['from', 'to', 'amount', 'best_quote'],
      },
    },
  }),

  '/api/yield-scanner': declareDiscoveryExtension({
    input: {
      chain: { type: 'string', description: 'Chain filter or "all"', default: 'all' },
      min_tvl: { type: 'number', description: 'Minimum TVL in USD', default: 0 },
      asset: { type: 'string', description: 'Asset filter (USDC, ETH, etc.) or "all"', default: 'all' },
      limit: { type: 'number', description: 'Max results to return', default: 20 },
    },
    output: {
      example: {
        timestamp: '2025-01-01T00:00:00.000Z',
        count: 3,
        filters_applied: { chain: 'all', asset: 'all', min_tvl: 0 },
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
            rewards: [{ token: 'USDe', apy_pct: 18.4 }],
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
                type: { type: 'string', description: 'lending, staking, liquidity_pool, yield_trading' },
                risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
                url: { type: 'string' },
              },
              required: ['protocol', 'asset', 'chain', 'apy_pct', 'tvl_usd'],
            },
          },
        },
        required: ['timestamp', 'count', 'opportunities'],
      },
    },
  }),

  '/api/wallet-profiler': declareDiscoveryExtension({
    input: {
      address: { type: 'string', description: 'EVM wallet address (0x...) or ENS name', default: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      chain: { type: 'string', description: 'Chain or "all" for multi-chain', default: 'all' },
    },
    output: {
      example: {
        address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        ens: 'vitalik.eth',
        label: 'vitalik.eth',
        timestamp: '2025-01-01T00:00:00.000Z',
        total_usd: 1250000,
        risk_score: 28,
        risk_level: 'low',
        activity: {
          first_tx: '2015-07-30',
          last_tx: '2025-01-01',
          tx_count: 1842,
          defi_protocols_used: 47,
          active_chains: ['ethereum', 'base', 'optimism'],
        },
        holdings: [
          { token: 'ETH', amount: 350.5, usd_value: 962875, chain: 'ethereum', price_usd: 2748 },
          { token: 'USDC', amount: 45000, usd_value: 45000, chain: 'base', price_usd: 1.0 },
        ],
        defi_positions: [
          { protocol: 'aave_v3', type: 'supply', asset: 'USDC', amount: 30000, usd_value: 30000, apy: 6.8 },
        ],
        tags: ['whale', 'defi_power_user', 'nft_collector', 'early_adopter'],
      },
      schema: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          ens: { type: 'string' },
          label: { type: 'string' },
          total_usd: { type: 'number' },
          risk_score: { type: 'number', description: '0-100 activity-based risk score' },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          activity: {
            type: 'object',
            properties: {
              first_tx: { type: 'string', description: 'ISO date of first transaction' },
              last_tx: { type: 'string' },
              tx_count: { type: 'number' },
              defi_protocols_used: { type: 'number' },
              active_chains: { type: 'array', items: { type: 'string' } },
            },
          },
          holdings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                token: { type: 'string' },
                amount: { type: 'number' },
                usd_value: { type: 'number' },
                chain: { type: 'string' },
              },
            },
          },
          defi_positions: { type: 'array' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['address', 'holdings'],
      },
    },
  }),

};

module.exports = { BAZAAR_SCHEMAS };
