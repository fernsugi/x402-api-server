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
      chain: { type: 'string', description: 'Chain: ethereum, base, solana, arbitrum, optimism', default: 'ethereum' },
    },
    output: {
      example: {
        timestamp: '2025-01-01T00:00:00.000Z',
        source: 'mock',
        mock_warning: 'Data is procedurally generated for demo purposes.',
        query: { token: 'ETH', chain: 'ethereum' },
        data: {
          token: 'ETH',
          chain: 'ethereum',
          total_supply: 120000000,
          circulating_supply: 95000000,
          holder_count: 95000000,
          concentration_metrics: {
            top_1_pct: 12.5,
            top_10_pct: 28.4,
            top_20_pct: 42.1,
            gini_coefficient: 0.71,
            herfindahl_index: 0.023456,
          },
          distribution_buckets: [
            { label: 'Minnows (<$100)', holder_pct: 55.2, supply_pct: 2.1 },
            { label: 'Fish ($100–$1K)', holder_pct: 24.8, supply_pct: 4.7 },
            { label: 'Dolphins ($1K–$10K)', holder_pct: 12.1, supply_pct: 8.3 },
            { label: 'Sharks ($10K–$100K)', holder_pct: 5.4, supply_pct: 13.2 },
            { label: 'Whales ($100K–$1M)', holder_pct: 2.1, supply_pct: 22.4 },
            { label: 'Mega-Whales (>$1M)', holder_pct: 0.4, supply_pct: 49.3 },
          ],
          top_holders: [
            {
              rank: 1,
              address: '0xabc...',
              label: 'Binance Hot Wallet',
              wallet_type: 'exchange',
              balance: 10000000,
              percentage: 8.4,
              last_active: '2025-01-01T00:00:00.000Z',
              is_contract: true,
            },
          ],
          recent_large_transfers: [
            {
              tx_hash: '0xdef...',
              from: '0xabc...',
              to: '0x123...',
              amount: 5000,
              usd_value: 13750000,
              timestamp: '2025-01-01T00:00:00.000Z',
              transfer_type: 'exchange_outflow',
            },
          ],
        },
      },
      schema: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', description: 'ISO 8601 response timestamp' },
          source: { type: 'string', description: '"mock" until real API is wired up' },
          mock_warning: { type: 'string' },
          query: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              chain: { type: 'string' },
            },
          },
          data: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              chain: { type: 'string' },
              total_supply: { type: 'number', description: 'Total token supply' },
              circulating_supply: { type: 'number' },
              holder_count: { type: 'number', description: 'Estimated total number of holders' },
              concentration_metrics: {
                type: 'object',
                properties: {
                  top_1_pct: { type: 'number', description: 'Percent of supply held by top 1 wallet' },
                  top_10_pct: { type: 'number', description: 'Percent of supply held by top 10 wallets' },
                  top_20_pct: { type: 'number', description: 'Percent of supply held by top 20 wallets' },
                  gini_coefficient: { type: 'number', description: '0=perfectly equal, 1=maximum concentration' },
                  herfindahl_index: { type: 'number', description: 'HHI concentration score (lower is more distributed)' },
                },
              },
              distribution_buckets: {
                type: 'array',
                description: 'Holder distribution by USD value tier',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string', description: 'Tier label e.g. "Whales ($100K–$1M)"' },
                    holder_pct: { type: 'number', description: 'Percent of all holders in this tier' },
                    supply_pct: { type: 'number', description: 'Percent of supply held by this tier' },
                  },
                },
              },
              top_holders: {
                type: 'array',
                description: 'Top 20 holders by balance',
                items: {
                  type: 'object',
                  properties: {
                    rank: { type: 'number' },
                    address: { type: 'string' },
                    label: { type: 'string', description: 'Known label (e.g. exchange name) or unlabeled' },
                    wallet_type: { type: 'string', description: 'exchange, protocol, whale, foundation, team, dao' },
                    balance: { type: 'number', description: 'Raw token balance' },
                    percentage: { type: 'number', description: 'Percent of total supply' },
                    last_active: { type: 'string', description: 'ISO 8601 timestamp of last on-chain activity' },
                    is_contract: { type: 'boolean' },
                  },
                },
              },
              recent_large_transfers: {
                type: 'array',
                description: 'Recent large transfers involving top holders',
                items: {
                  type: 'object',
                  properties: {
                    tx_hash: { type: 'string' },
                    from: { type: 'string' },
                    to: { type: 'string' },
                    amount: { type: 'number', description: 'Token amount transferred' },
                    usd_value: { type: 'number', description: 'Estimated USD value at time of transfer' },
                    timestamp: { type: 'string' },
                    transfer_type: { type: 'string', description: 'exchange_outflow, accumulation, etc.' },
                  },
                },
              },
            },
            required: ['token', 'chain', 'concentration_metrics', 'distribution_buckets', 'top_holders'],
          },
        },
        required: ['timestamp', 'query', 'data'],
      },
    },
  }),

  '/api/funding-rates': declareDiscoveryExtension({
    input: {
      asset: { type: 'string', description: 'Asset symbol (e.g. BTC, ETH, SOL) or omit for all', default: 'all' },
      min_spread: { type: 'number', description: 'Minimum arb spread in basis points (e.g. 0.5)', default: 0 },
    },
    output: {
      example: {
        timestamp: '2025-01-01T00:00:00.000Z',
        source: 'mock',
        query: { asset: 'all', min_spread_bps: 0 },
        protocols: ['hyperliquid', 'dydx_v4', 'aevo', 'gmx', 'drift', 'vertex'],
        assets_covered: ['BTC', 'ETH', 'SOL', 'SUI', 'AVAX', 'ARB', 'OP', 'DOGE', 'LINK', 'UNI'],
        funding_interval_hours: 8,
        data: {
          BTC: {
            hyperliquid: {
              funding_rate: 0.0001,
              annualized_pct: 10.95,
              predicted_rate: 0.000105,
              open_interest_usd: 890000000,
              next_funding_in_ms: 14400000,
              last_updated: '2025-01-01T00:00:00.000Z',
            },
            dydx_v4: {
              funding_rate: -0.00009,
              annualized_pct: -9.86,
              predicted_rate: -0.000094,
              open_interest_usd: 420000000,
              next_funding_in_ms: 14400000,
              last_updated: '2025-01-01T00:00:00.000Z',
            },
          },
        },
        arb_opportunities: [
          {
            asset: 'BTC',
            long_venue: 'dydx_v4',
            long_rate: -0.00009,
            short_venue: 'hyperliquid',
            short_rate: 0.0001,
            spread_bps: 1.9,
            annualized_arb_pct: 20.8,
            signal: 'STRONG',
            note: 'Go long BTC-PERP on dydx_v4, short on hyperliquid. Net carry: 20.8% APR',
          },
        ],
      },
      schema: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          source: { type: 'string' },
          query: {
            type: 'object',
            properties: {
              asset: { type: 'string' },
              min_spread_bps: { type: 'number' },
            },
          },
          protocols: { type: 'array', items: { type: 'string' }, description: 'Protocols included in this response' },
          assets_covered: { type: 'array', items: { type: 'string' } },
          funding_interval_hours: { type: 'number' },
          data: {
            type: 'object',
            description: 'Funding rates keyed by asset symbol, then protocol name',
            additionalProperties: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  funding_rate: { type: 'number', description: 'Per-interval rate (fraction, e.g. 0.0001 = 0.01%)' },
                  annualized_pct: { type: 'number', description: 'Annualized APR percent' },
                  predicted_rate: { type: 'number' },
                  open_interest_usd: { type: 'number' },
                  next_funding_in_ms: { type: 'number', description: 'Milliseconds until next funding payment' },
                  last_updated: { type: 'string' },
                },
              },
            },
          },
          arb_opportunities: {
            type: 'array',
            description: 'Sorted by annualized_arb_pct descending',
            items: {
              type: 'object',
              properties: {
                asset: { type: 'string' },
                long_venue: { type: 'string' },
                long_rate: { type: 'number' },
                short_venue: { type: 'string' },
                short_rate: { type: 'number' },
                spread_bps: { type: 'number', description: 'Rate spread in basis points' },
                annualized_arb_pct: { type: 'number', description: 'Estimated annualized yield from the arb' },
                signal: { type: 'string', enum: ['STRONG', 'MODERATE', 'WEAK'] },
                note: { type: 'string', description: 'Human-readable arb description' },
              },
            },
          },
        },
        required: ['timestamp', 'data', 'arb_opportunities'],
      },
    },
  }),

  '/api/gas-tracker': declareDiscoveryExtension({
    output: {
      example: {
        timestamp: '2025-01-01T00:00:00.000Z',
        source: 'rpc',
        cached: false,
        cache_ttl_seconds: 15,
        data: {
          ethereum: {
            chain: 'Ethereum',
            chain_id: 1,
            native_token: 'ETH',
            is_mock: false,
            gas_price_gwei: { slow: 17.6, normal: 22.0, fast: 30.8 },
            estimated_cost_usd: {
              transfer: { slow: 0.36, normal: 0.45, fast: 0.63 },
              swap: { slow: 2.57, normal: 3.21, fast: 4.50 },
              nft_mint: { slow: 1.46, normal: 1.82, fast: 2.55 },
            },
          },
          base: {
            chain: 'Base',
            chain_id: 8453,
            native_token: 'ETH',
            is_mock: false,
            gas_price_gwei: { slow: 0.006, normal: 0.008, fast: 0.011 },
            estimated_cost_usd: {
              transfer: { slow: 0.0001, normal: 0.0002, fast: 0.0002 },
              swap: { slow: 0.0009, normal: 0.0011, fast: 0.0015 },
              nft_mint: { slow: 0.0005, normal: 0.0006, fast: 0.0009 },
            },
          },
        },
      },
      schema: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          source: { type: 'string', description: '"rpc" if live data was fetched, "mock" if fallback' },
          cached: { type: 'boolean' },
          cache_ttl_seconds: { type: 'number' },
          data: {
            type: 'object',
            description: 'Gas data keyed by chain name (ethereum, base, polygon, arbitrum)',
            additionalProperties: {
              type: 'object',
              properties: {
                chain: { type: 'string', description: 'Human-readable chain name' },
                chain_id: { type: 'number' },
                native_token: { type: 'string', description: 'ETH or POL' },
                is_mock: { type: 'boolean' },
                gas_price_gwei: {
                  type: 'object',
                  properties: {
                    slow: { type: 'number' },
                    normal: { type: 'number' },
                    fast: { type: 'number' },
                  },
                },
                estimated_cost_usd: {
                  type: 'object',
                  description: 'USD cost estimates per operation type',
                  properties: {
                    transfer: {
                      type: 'object',
                      properties: { slow: { type: 'number' }, normal: { type: 'number' }, fast: { type: 'number' } },
                    },
                    swap: {
                      type: 'object',
                      properties: { slow: { type: 'number' }, normal: { type: 'number' }, fast: { type: 'number' } },
                    },
                    nft_mint: {
                      type: 'object',
                      properties: { slow: { type: 'number' }, normal: { type: 'number' }, fast: { type: 'number' } },
                    },
                  },
                },
              },
            },
          },
        },
        required: ['timestamp', 'data'],
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
      amount: { type: 'number', description: 'Input amount (in token units, must be > 0)', default: 1 },
      chain: { type: 'string', description: 'Chain to query (ethereum, base, polygon, arbitrum)', default: 'ethereum' },
    },
    output: {
      example: {
        timestamp: '2025-01-01T00:00:00.000Z',
        source: 'mock',
        query: { from: 'ETH', to: 'USDC', amount: 1, chain: 'ethereum' },
        data: {
          pair: 'ETH/USDC',
          chain: 'ethereum',
          input_amount: 1,
          input_value_usd: 2750,
          base_rate: 2750,
          best_dex: '1inch',
          best_output: 2748.32,
          savings_vs_worst: 6.42,
          quotes: [
            {
              dex: '1inch',
              dex_name: '1inch Aggregator',
              input_token: 'ETH',
              output_token: 'USDC',
              input_amount: 1,
              output_amount: 2748.32,
              effective_rate: 2748.32,
              price_impact_pct: 0.03,
              fee_bps: 0,
              fee_usd: 0,
              estimated_gas_usd: 8.50,
              route: ['ETH', 'WETH', 'USDC'],
              min_output: 2734.58,
              expires_in_seconds: 30,
            },
          ],
          recommendation: {
            dex: '1inch Aggregator',
            reason: 'Aggregator finds optimal split routes across liquidity sources',
            output: 2748.32,
            total_cost_usd: 8.50,
          },
        },
      },
      schema: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          source: { type: 'string' },
          query: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              amount: { type: 'number' },
              chain: { type: 'string' },
            },
          },
          data: {
            type: 'object',
            properties: {
              pair: { type: 'string', description: 'e.g. "ETH/USDC"' },
              chain: { type: 'string' },
              input_amount: { type: 'number' },
              input_value_usd: { type: 'number' },
              base_rate: { type: 'number' },
              best_dex: { type: 'string' },
              best_output: { type: 'number' },
              savings_vs_worst: { type: 'number', description: 'Output difference between best and worst DEX' },
              quotes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    dex: { type: 'string' },
                    dex_name: { type: 'string' },
                    input_token: { type: 'string' },
                    output_token: { type: 'string' },
                    input_amount: { type: 'number' },
                    output_amount: { type: 'number' },
                    effective_rate: { type: 'number' },
                    price_impact_pct: { type: 'number' },
                    fee_bps: { type: 'number' },
                    fee_usd: { type: 'number' },
                    estimated_gas_usd: { type: 'number' },
                    route: { type: 'array', items: { type: 'string' } },
                    min_output: { type: 'number', description: 'Min output with 0.5% slippage' },
                    expires_in_seconds: { type: 'number' },
                  },
                },
              },
              recommendation: {
                type: 'object',
                properties: {
                  dex: { type: 'string' },
                  reason: { type: 'string' },
                  output: { type: 'number' },
                  total_cost_usd: { type: 'number' },
                },
              },
            },
            required: ['pair', 'quotes', 'best_dex', 'recommendation'],
          },
        },
        required: ['timestamp', 'data'],
      },
    },
  }),

  '/api/yield-scanner': declareDiscoveryExtension({
    input: {
      chain: { type: 'string', description: 'Chain filter (ethereum, base, arbitrum, polygon) or "all"', default: 'all' },
      min_tvl: { type: 'number', description: 'Minimum TVL in USD (must be >= 0)', default: 0 },
      asset: { type: 'string', description: 'Asset filter (USDC, ETH, etc.) or omit for all', default: 'all' },
      limit: { type: 'number', description: 'Max results to return (1–50, must be >= 1)', default: 20 },
    },
    output: {
      example: {
        timestamp: '2025-01-01T00:00:00.000Z',
        source: 'mock',
        query: { chain: 'all', min_tvl: 0, asset: 'all', limit: 20 },
        total_results: 3,
        data: [
          {
            protocol: 'Ethena',
            asset: 'sUSDe',
            chain: 'ethereum',
            apy: 18.5,
            tvl: 5600000000,
            risk_tier: 'high',
            type: 'synthetic',
            updated_at: '2025-01-01T00:00:00.000Z',
          },
          {
            protocol: 'Morpho Blue',
            asset: 'USDC',
            chain: 'base',
            apy: 7.5,
            tvl: 420000000,
            risk_tier: 'medium',
            type: 'lending',
            updated_at: '2025-01-01T00:00:00.000Z',
          },
          {
            protocol: 'Aave V3',
            asset: 'USDC',
            chain: 'base',
            apy: 5.1,
            tvl: 1200000000,
            risk_tier: 'low',
            type: 'lending',
            updated_at: '2025-01-01T00:00:00.000Z',
          },
        ],
        metadata: {
          risk_tiers: {
            low: 'Battle-tested protocols, audited, >$1B TVL',
            medium: 'Established protocols, audited, moderate complexity',
            high: 'Higher yields from IL risk, newer protocols, or leveraged strategies',
          },
          real_source: 'https://yields.llama.fi/pools (DefiLlama Yields API)',
        },
      },
      schema: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          source: { type: 'string' },
          query: {
            type: 'object',
            properties: {
              chain: { type: 'string' },
              min_tvl: { type: 'number' },
              asset: { type: 'string' },
              limit: { type: 'number' },
            },
          },
          total_results: { type: 'number', description: 'Number of results returned' },
          data: {
            type: 'array',
            description: 'Yield opportunities sorted by APY descending',
            items: {
              type: 'object',
              properties: {
                protocol: { type: 'string', description: 'Protocol name e.g. Aave V3, Lido, Ethena' },
                asset: { type: 'string', description: 'Asset symbol e.g. USDC, stETH, sUSDe' },
                chain: { type: 'string', description: 'Chain: ethereum, base, arbitrum, polygon' },
                apy: { type: 'number', description: 'Annual percentage yield (percent, e.g. 5.1 = 5.1%)' },
                tvl: { type: 'number', description: 'Total value locked in USD' },
                risk_tier: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Risk classification' },
                type: { type: 'string', description: 'Strategy type: lending, staking, liquidity, synthetic, vault, savings, yield_trading' },
                updated_at: { type: 'string', description: 'ISO 8601 timestamp of last data update' },
              },
              required: ['protocol', 'asset', 'chain', 'apy', 'tvl', 'risk_tier', 'type'],
            },
          },
          metadata: { type: 'object' },
        },
        required: ['timestamp', 'total_results', 'data'],
      },
    },
  }),

  '/api/wallet-profiler': declareDiscoveryExtension({
    input: {
      address: { type: 'string', description: 'EVM wallet address (0x followed by 40 hex chars)', default: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      chain: { type: 'string', description: 'Chain or "all" for multi-chain (ethereum, base, arbitrum, polygon)', default: 'all' },
    },
    output: {
      example: {
        timestamp: '2025-01-01T00:00:00.000Z',
        source: 'mock',
        query: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', chain: 'all' },
        data: {
          address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          label: 'vitalik.eth',
          wallet_type: 'power_user',
          chains_active: ['ethereum', 'base', 'arbitrum'],
          total_value_usd: 1250000,
          defi_value_usd: 75000,
          portfolio: {
            top_holdings: [
              { token: 'ETH', chain: 'ethereum', balance: 350.5, price_usd: 2750, value_usd: 963875, portfolio_pct: 77.1 },
              { token: 'USDC', chain: 'base', balance: 45000, price_usd: 1, value_usd: 45000, portfolio_pct: 3.6 },
            ],
            allocation: {
              native_tokens_pct: 78.2,
              stablecoins_pct: 12.4,
              defi_tokens_pct: 9.4,
            },
          },
          defi_positions: [
            { protocol: 'Aave V3', type: 'lending', asset: 'USDC', chain: 'ethereum', value_usd: 30000, apy: 4.2 },
          ],
          activity: {
            total_transactions: 1842,
            first_seen: '2015-07-30T00:00:00Z',
            last_active: '2025-01-01T00:00:00Z',
            age_days: 3442,
            avg_tx_per_day: 0.53,
            nft_count: 47,
          },
          risk_profile: {
            classification: 'aggressive',
            stablecoin_ratio: 0.124,
            diversification_score: 10,
            defi_exposure_pct: 6.0,
            is_contract: false,
            is_multisig: false,
          },
        },
      },
      schema: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          source: { type: 'string' },
          query: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              chain: { type: 'string' },
            },
          },
          data: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              label: { type: 'string', description: 'Known label (e.g. vitalik.eth, Binance Cold Wallet) or null' },
              wallet_type: { type: 'string', description: 'individual, exchange, power_user, active, casual' },
              chains_active: { type: 'array', items: { type: 'string' } },
              total_value_usd: { type: 'number', description: 'Total portfolio value in USD' },
              defi_value_usd: { type: 'number', description: 'Value held in DeFi positions' },
              portfolio: {
                type: 'object',
                properties: {
                  top_holdings: {
                    type: 'array',
                    description: 'Top 10 holdings by value, sorted by value_usd descending',
                    items: {
                      type: 'object',
                      properties: {
                        token: { type: 'string' },
                        chain: { type: 'string' },
                        balance: { type: 'number' },
                        price_usd: { type: 'number' },
                        value_usd: { type: 'number' },
                        portfolio_pct: { type: 'number', description: 'Percentage of total portfolio value' },
                      },
                    },
                  },
                  allocation: {
                    type: 'object',
                    properties: {
                      native_tokens_pct: { type: 'number' },
                      stablecoins_pct: { type: 'number' },
                      defi_tokens_pct: { type: 'number' },
                    },
                  },
                },
              },
              defi_positions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    protocol: { type: 'string' },
                    type: { type: 'string', description: 'lending, staking, liquidity' },
                    asset: { type: 'string' },
                    chain: { type: 'string' },
                    value_usd: { type: 'number' },
                    apy: { type: 'number' },
                  },
                },
              },
              activity: {
                type: 'object',
                properties: {
                  total_transactions: { type: 'number' },
                  first_seen: { type: 'string', description: 'ISO 8601 timestamp of first transaction' },
                  last_active: { type: 'string', description: 'ISO 8601 timestamp of most recent transaction' },
                  age_days: { type: 'number', description: 'Days since first transaction' },
                  avg_tx_per_day: { type: 'number' },
                  nft_count: { type: 'number' },
                },
              },
              risk_profile: {
                type: 'object',
                properties: {
                  classification: { type: 'string', enum: ['conservative', 'moderate', 'aggressive'] },
                  stablecoin_ratio: { type: 'number', description: '0–1 fraction of portfolio in stablecoins' },
                  diversification_score: { type: 'number', description: '0–10 score based on number of distinct holdings' },
                  defi_exposure_pct: { type: 'number', description: 'Percent of portfolio in DeFi positions' },
                  is_contract: { type: 'boolean' },
                  is_multisig: { type: 'boolean' },
                },
              },
            },
            required: ['address', 'total_value_usd', 'portfolio', 'activity', 'risk_profile'],
          },
        },
        required: ['timestamp', 'data'],
      },
    },
  }),

};

module.exports = { BAZAAR_SCHEMAS };
