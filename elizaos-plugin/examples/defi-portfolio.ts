/**
 * DeFi Portfolio Tracking Example
 *
 * This example demonstrates using multiple x402-api endpoints to build
 * a comprehensive DeFi portfolio tracker agent.
 *
 * Features:
 * - Check current prices
 * - Track gas fees across chains
 * - Analyze wallet holdings
 * - Monitor whale activity
 * - Find best yield opportunities
 */

import {
  x402DeFiPlugin,
  createPriceFeedAction,
  createGasTrackerAction,
  createWalletProfilerAction,
  createWhaleTrackerAction,
  createYieldScannerAction,
  type X402ClientConfig,
} from '@x402-api/elizaos-plugin';
import type { Character, Plugin } from '@elizaos/core';

/**
 * Option 1: Use the full plugin (recommended for most use cases)
 */
export const portfolioAgentFull: Character = {
  name: 'Portfolio Tracker',
  bio: [
    'I help you monitor your DeFi portfolio across chains.',
    'I track prices, gas fees, wallet holdings, and yield opportunities.',
  ],

  plugins: [
    '@elizaos/plugin-bootstrap',
    x402DeFiPlugin,  // All 8 endpoints included
  ],

  knowledge: [
    'I can analyze any wallet address and show portfolio breakdown',
    'I track gas prices across Ethereum, Base, Polygon, and Arbitrum',
    'I monitor whale wallets to identify smart money moves',
    'I scan DeFi protocols for best yield opportunities',
  ],

  messageExamples: [
    [
      {
        user: '{{user1}}',
        content: { text: 'Analyze wallet 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      },
      {
        user: '{{agentName}}',
        content: {
          text: "I'll profile that wallet and show you the portfolio breakdown...",
          action: 'PROFILE_WALLET',
        },
      },
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'What are the gas fees on Arbitrum?' },
      },
      {
        user: '{{agentName}}',
        content: {
          text: "Let me check the current gas prices across all chains...",
          action: 'GET_GAS_PRICES',
        },
      },
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'Find me the best USDC yields' },
      },
      {
        user: '{{agentName}}',
        content: {
          text: "I'll scan all DeFi protocols for top USDC yields...",
          action: 'SCAN_YIELDS',
        },
      },
    ],
  ],

  topics: [
    'defi',
    'portfolio-tracking',
    'yield-farming',
    'gas-optimization',
    'whale-tracking',
  ],

  style: {
    all: [
      'Present data in clear tables or lists',
      'Highlight important metrics (APY, gas fees, risk scores)',
      'Suggest actionable insights based on data',
    ],
  },
};

/**
 * Option 2: Custom plugin with only the endpoints you need
 * (useful for reducing costs by limiting available actions)
 */
const portfolioConfig: X402ClientConfig = {
  baseUrl: process.env.X402_API_BASE_URL || 'https://x402-api.fly.dev',
  walletPrivateKey: process.env.X402_WALLET_PRIVATE_KEY,
  timeoutMs: 15000,
};

const portfolioPluginCustom: Plugin = {
  name: 'portfolio-tracker-custom',
  description: 'Custom portfolio tracking with selected x402 endpoints',

  // Only include the actions you need
  actions: [
    createPriceFeedAction(portfolioConfig),      // $0.001
    createGasTrackerAction(portfolioConfig),     // $0.001
    createWalletProfilerAction(portfolioConfig), // $0.008
    createYieldScannerAction(portfolioConfig),   // $0.005
    // Omitted: DEX quotes, token scanner, whale tracker, funding rates
  ],
};

export const portfolioAgentCustom: Character = {
  name: 'Portfolio Tracker (Optimized)',
  bio: [
    'I track your DeFi portfolio with cost-optimized endpoint selection.',
  ],

  plugins: [
    '@elizaos/plugin-bootstrap',
    portfolioPluginCustom,  // Only 4 actions instead of 8
  ],

  knowledge: [
    'I focus on portfolio essentials: prices, gas, wallet analysis, and yields',
    'I skip less-used features like DEX quotes and whale tracking to save costs',
  ],
};

/**
 * Example Workflow: Daily Portfolio Check
 *
 * 1. User: "Give me my daily portfolio update"
 *
 * 2. Agent executes in sequence:
 *    a) GET_CRYPTO_PRICES → Shows market overview ($0.001)
 *    b) PROFILE_WALLET → Analyzes user's wallet ($0.008)
 *    c) SCAN_YIELDS → Finds best opportunities ($0.005)
 *    d) GET_GAS_PRICES → Suggests optimal transaction timing ($0.001)
 *
 * 3. Total cost: $0.015 per daily check
 *    → $0.45/month for daily updates
 *    → Less than a coffee! ☕
 */

/**
 * Example Output Format:
 *
 * User: "Analyze my portfolio"
 *
 * Agent Response:
 * ```
 * 📊 Portfolio Analysis for 0xd8dA...96045
 *
 * Total Value: $45,234.56
 *
 * Holdings:
 * • ETH: 12.5 ($23,750.00) - 52.5%
 * • USDC: 15,000 ($15,000.00) - 33.2%
 * • AAVE: 450 ($6,484.50) - 14.3%
 *
 * DeFi Positions:
 * • Aave V3 (Ethereum): $15,000 USDC at 4.2% APY
 * • Uniswap V3 LP: ETH/USDC at $8,750 TVL
 *
 * Activity (7d):
 * • 8 transactions
 * • $2,340 volume
 *
 * Risk Score: 0.35 (Low-Medium)
 * Classification: Yield Farmer
 *
 * 💡 Insight: Your USDC could earn 5.8% APY on Morpho (vs 4.2% on Aave)
 *
 * ⛽ Gas Recommendation: ETH gas is 25 gwei (normal) - good time to rebalance!
 * ```
 */

/**
 * Multi-Chain Portfolio Tracking
 *
 * The x402-api supports multiple chains. You can track holdings across:
 * - Ethereum mainnet
 * - Base
 * - Arbitrum
 * - Polygon
 * - Optimism
 *
 * Example query:
 * User: "Show my Base portfolio"
 * Agent: Calls PROFILE_WALLET with chain parameter
 */

/**
 * Cost Optimization Tips:
 *
 * 1. Cache results when possible
 *    - Prices: refresh every 5-10 minutes
 *    - Portfolio: refresh on user request or hourly
 *    - Yields: refresh every 30 minutes
 *    - Gas: refresh every 5 minutes
 *
 * 2. Batch queries intelligently
 *    - Don't fetch gas prices if user just checked 2 min ago
 *    - Combine price + portfolio data in response
 *
 * 3. Use custom plugins (Option 2) to exclude unused endpoints
 *
 * 4. Set daily/weekly budget limits
 *    - Track spending in agent state
 *    - Alert user if approaching limit
 *    - Implement request throttling
 */

/**
 * Advanced: Portfolio Alerts
 *
 * Extend this example with ElizaOS services for background monitoring:
 *
 * ```typescript
 * class PortfolioAlertService extends Service {
 *   static serviceType = 'PORTFOLIO_ALERTS';
 *
 *   async start() {
 *     setInterval(async () => {
 *       // Check portfolio every hour
 *       const portfolio = await this.runtime.executeAction('PROFILE_WALLET', {...});
 *
 *       // Alert on significant changes
 *       if (portfolio.total_value_change_24h < -0.05) {
 *         await this.runtime.notify('⚠️ Portfolio down 5% in 24h');
 *       }
 *
 *       // Alert on yield opportunities
 *       const yields = await this.runtime.executeAction('SCAN_YIELDS', {...});
 *       const bestYield = yields.pools[0];
 *
 *       if (bestYield.apy > 10) {
 *         await this.runtime.notify(`🌾 High yield alert: ${bestYield.apy}% APY on ${bestYield.protocol}`);
 *       }
 *     }, 3600_000); // Every hour
 *   }
 * }
 * ```
 */

/**
 * Integration with Other Plugins:
 *
 * Combine x402-api with other ElizaOS plugins for powerful workflows:
 *
 * 1. @elizaos/plugin-sql
 *    - Store portfolio history in database
 *    - Track performance over time
 *    - Generate reports and charts
 *
 * 2. @elizaos/plugin-evm
 *    - Execute trades based on x402-api data
 *    - Rebalance portfolio automatically
 *    - Harvest yields when optimal
 *
 * 3. @elizaos/plugin-solana
 *    - Cross-chain portfolio tracking (EVM + Solana)
 *    - Arbitrage opportunities between chains
 */

export default portfolioAgentFull;
