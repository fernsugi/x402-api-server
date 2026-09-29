/**
 * Price Monitoring & Alert System Example
 *
 * This example demonstrates building an agent that monitors crypto prices,
 * tracks gas fees, and sends alerts based on user-defined thresholds.
 *
 * Features:
 * - Real-time price tracking
 * - Gas price monitoring across chains
 * - DEX quote comparison
 * - Token security scanning
 * - Automated alerts (via ElizaOS services)
 */

import {
  x402DeFiPlugin,
  type PriceFeedResponse,
  type GasTrackerResponse,
  type DexQuotesData,
  type TokenScanData,
} from '@x402-api/elizaos-plugin';
import type { Character, Service } from '@elizaos/core';

/**
 * Character configuration for price monitoring agent
 */
export const priceMonitorAgent: Character = {
  name: 'Price Sentinel',
  bio: [
    'I monitor crypto prices and alert you when conditions are met.',
    'I track gas fees to help you time transactions optimally.',
    'I scan tokens for security risks before you trade.',
  ],

  plugins: [
    '@elizaos/plugin-bootstrap',
    x402DeFiPlugin,
  ],

  knowledge: [
    'I can track prices for BTC, ETH, SOL, and custom tokens',
    'I monitor gas prices across Ethereum, Base, Polygon, and Arbitrum',
    'I compare DEX quotes to find best swap rates',
    'I scan tokens for honeypots, rug pulls, and security issues',
    'I send alerts when prices cross thresholds or gas is optimal',
  ],

  messageExamples: [
    [
      {
        user: '{{user1}}',
        content: { text: 'Alert me when ETH drops below $2,000' },
      },
      {
        user: '{{agentName}}',
        content: {
          text: "I'll monitor ETH and notify you when it reaches $2,000. Currently checking prices...",
          action: 'GET_CRYPTO_PRICES',
        },
      },
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'Is this token safe? 0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' },
      },
      {
        user: '{{agentName}}',
        content: {
          text: "Let me scan that token address for security issues...",
          action: 'SCAN_TOKEN',
        },
      },
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'Compare swap rates: 1 ETH to USDC on Base' },
      },
      {
        user: '{{agentName}}',
        content: {
          text: "I'll check rates across Uniswap, SushiSwap, and 1inch...",
          action: 'GET_DEX_QUOTES',
        },
      },
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'Should I send my transaction now or wait?' },
      },
      {
        user: '{{agentName}}',
        content: {
          text: "Let me check current gas prices to help you decide...",
          action: 'GET_GAS_PRICES',
        },
      },
    ],
  ],

  topics: [
    'price-monitoring',
    'gas-optimization',
    'token-security',
    'dex-aggregation',
    'transaction-timing',
  ],

  style: {
    all: [
      'Be proactive with alerts and suggestions',
      'Use emoji for visual alerts (🚨 ⚠️ ✅)',
      'Present comparisons in clear tables',
      'Always explain risk factors',
    ],
    chat: [
      'Respond quickly to price queries',
      'Provide context with each alert',
    ],
  },

  adjectives: ['vigilant', 'data-driven', 'proactive', 'security-conscious'],
};

/**
 * Advanced: Background Price Monitoring Service
 *
 * This service runs in the background and checks prices periodically,
 * sending alerts when user-defined conditions are met.
 *
 * Note: This is pseudocode showing the concept. Actual implementation
 * would require extending ElizaOS Service class and integrating with
 * agent state management.
 */

interface PriceAlert {
  token: string;
  condition: 'above' | 'below';
  threshold: number;
  enabled: boolean;
}

interface GasAlert {
  chain: string;
  maxGwei: number;
  enabled: boolean;
}

/**
 * Example: Setting up price alerts
 *
 * User: "Alert me when ETH goes above $3,000"
 * Agent: Parses request → creates alert:
 * {
 *   token: 'ETH',
 *   condition: 'above',
 *   threshold: 3000,
 *   enabled: true
 * }
 *
 * User: "Notify me when Arbitrum gas is below 0.1 gwei"
 * Agent: Creates gas alert:
 * {
 *   chain: 'arbitrum',
 *   maxGwei: 0.1,
 *   enabled: true
 * }
 */

/**
 * Example Alert Responses:
 *
 * Price Alert Triggered:
 * ```
 * 🚨 PRICE ALERT
 *
 * ETH: $3,125.50 (+4.2% today)
 *
 * Your threshold: $3,000
 * Current status: ABOVE target ✅
 *
 * Market context:
 * • BTC: $45,230 (+2.1%)
 * • SOL: $98.34 (+6.8%)
 *
 * Would you like to:
 * 1. Take profit?
 * 2. Update alert threshold?
 * 3. Disable this alert?
 * ```
 *
 * Gas Alert Triggered:
 * ```
 * ⛽ GAS ALERT
 *
 * Arbitrum: 0.08 gwei (slow)
 *
 * Your threshold: 0.1 gwei
 * Current status: BELOW target ✅
 *
 * Transaction costs:
 * • Transfer: $0.02
 * • Swap: $0.08
 * • NFT mint: $0.15
 *
 * 💡 Optimal time to transact!
 * ```
 */

/**
 * DEX Quote Comparison Example:
 *
 * User: "What's the best rate to swap 1 ETH for USDC?"
 *
 * Agent Response:
 * ```
 * 🔄 DEX QUOTE COMPARISON
 *
 * Trading: 1 ETH → USDC
 * Chain: Ethereum
 *
 * Quotes:
 * 1. Uniswap V3: 2,345.67 USDC
 *    • Price impact: 0.02%
 *    • Gas: $3.21
 *    • Route: ETH → USDC (direct)
 *
 * 2. 1inch: 2,347.89 USDC ⭐ BEST
 *    • Price impact: 0.01%
 *    • Gas: $4.15
 *    • Route: ETH → WETH → USDC
 *
 * 3. SushiSwap: 2,343.12 USDC
 *    • Price impact: 0.03%
 *    • Gas: $2.89
 *    • Route: ETH → USDC (direct)
 *
 * 💡 Recommendation: Use 1inch for +$2.22 profit after gas
 *
 * Total savings vs worst quote: $4.77
 * ```
 */

/**
 * Token Security Scan Example:
 *
 * User: "Is this token safe? 0x6982508145454ce325ddbe47a25d4ec3d2311933"
 *
 * Agent Response:
 * ```
 * 🔍 TOKEN SECURITY SCAN
 *
 * Token: PEPE
 * Address: 0x6982...1933
 * Chain: Ethereum
 *
 * ✅ Security Checks:
 * • Contract verified: YES
 * • Not a proxy: YES (not upgradeable)
 * • No mint function: YES (cannot create new tokens)
 * • Liquidity locked: YES (until 2025-12-31)
 * • Not a honeypot: YES (can sell)
 *
 * ⚠️ Risk Factors:
 * • Buy tax: 0% ✅
 * • Sell tax: 0% ✅
 * • Holder count: 142,356 ✅
 * • Top 10 holders: 28.5% (medium concentration)
 *
 * Overall Risk Score: 0.25 (LOW)
 * Classification: Community Token
 *
 * 💡 Assessment: Relatively safe, but watch whale holdings
 * ```
 */

/**
 * Multi-Endpoint Usage Example:
 *
 * User: "I want to swap 10 ETH for USDC. Help me optimize."
 *
 * Agent executes in sequence:
 *
 * 1. GET_CRYPTO_PRICES → Current ETH price ($0.001)
 * 2. GET_GAS_PRICES → Optimal gas timing ($0.001)
 * 3. GET_DEX_QUOTES → Best swap rate ($0.002)
 * 4. SCAN_TOKEN → Verify USDC contract ($0.003)
 *
 * Total cost: $0.007
 *
 * Response:
 * ```
 * 📊 SWAP OPTIMIZATION ANALYSIS
 *
 * Trade: 10 ETH → USDC
 * Current ETH: $2,345.67
 * Expected output: ~$23,456.70
 *
 * 🔄 Best Quote: 1inch
 * • You get: 23,478.90 USDC
 * • Price impact: 0.05%
 * • Slippage: 0.5% (safe)
 *
 * ⛽ Gas Analysis:
 * • Current: 35 gwei (normal)
 * • Cost: $12.45
 * • Recommendation: EXECUTE NOW ✅
 *
 * ✅ Token Security:
 * • USDC verified by Circle
 * • Risk score: 0.05 (VERY LOW)
 *
 * 💡 Total cost after gas: 23,466.45 USDC
 * Savings vs worst DEX: $22.23
 *
 * Ready to proceed? (React with ✅ to confirm)
 * ```
 */

/**
 * Configuration for Monitoring Service:
 *
 * Store alerts in agent state:
 * ```typescript
 * interface MonitoringState {
 *   priceAlerts: PriceAlert[];
 *   gasAlerts: GasAlert[];
 *   lastCheck: number;
 *   checkIntervalMs: number;
 * }
 * ```
 *
 * Default intervals:
 * - Price checks: Every 5 minutes
 * - Gas checks: Every 2 minutes
 * - Token scans: On-demand only
 *
 * Cost per hour:
 * - Price: 12 checks × $0.001 = $0.012/hour
 * - Gas: 30 checks × $0.001 = $0.030/hour
 * - Total: $0.042/hour = $1.01/day
 *
 * Budget-friendly monitoring! 💰
 */

/**
 * Advanced Features to Implement:
 *
 * 1. Historical price tracking
 *    - Store price data in database
 *    - Generate price charts
 *    - Calculate moving averages
 *
 * 2. Smart alerts
 *    - "Alert me when ETH moves 5% in any direction"
 *    - "Notify if gas drops below 20 gwei for 30+ minutes"
 *    - "Warn if new token has high risk score"
 *
 * 3. Portfolio rebalancing
 *    - Set target allocations (e.g., 60% ETH, 40% USDC)
 *    - Auto-execute swaps when gas is optimal
 *    - Track rebalancing history and performance
 *
 * 4. Multi-user support
 *    - Each user has their own alert config
 *    - Aggregate monitoring for efficiency
 *    - Per-user cost tracking
 */

/**
 * Testing Without Real Payments:
 *
 * For development, you can:
 *
 * 1. Use a dummy private key (calls will fail at payment):
 *    X402_WALLET_PRIVATE_KEY=0x0000...0001
 *
 * 2. Mock x402-fetch in tests:
 *    ```typescript
 *    jest.mock('x402-fetch', () => ({
 *      fetch: async (url) => {
 *        // Return mock data based on URL
 *        if (url.includes('price-feed')) {
 *          return { ok: true, json: async () => mockPriceData };
 *        }
 *      }
 *    }));
 *    ```
 *
 * 3. Deploy your own x402-api instance with test mode
 *
 * See README.md for more testing strategies
 */

export default priceMonitorAgent;
