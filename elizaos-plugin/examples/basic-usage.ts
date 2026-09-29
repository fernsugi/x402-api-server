/**
 * Basic Usage Example - Simple Price Check
 *
 * This example shows how to add the x402 DeFi plugin to your ElizaOS agent
 * and fetch live crypto prices with a single query.
 *
 * Prerequisites:
 * 1. npm install @x402-api/elizaos-plugin x402-fetch viem
 * 2. Create a .env file with X402_WALLET_PRIVATE_KEY
 * 3. Fund your wallet with USDC on Base (~$0.001 per call)
 */

import { x402DeFiPlugin } from '@x402-api/elizaos-plugin';
import type { Character } from '@elizaos/core';

// Basic character configuration with x402 plugin
export const character: Character = {
  name: 'DeFi Agent',
  bio: [
    'I help you track crypto prices and DeFi opportunities.',
    'I use the x402 protocol for micropayments.',
  ],
  lore: [
    'Built to demonstrate x402-api integration with ElizaOS.',
  ],
  knowledge: [
    'I can fetch live crypto prices for BTC, ETH, SOL and top movers.',
    'Each price check costs only $0.001 USDC via x402 payments.',
    'I automatically pay for API calls using USDC on Base.',
  ],

  // Add the x402 plugin
  plugins: [
    '@elizaos/plugin-bootstrap',
    x402DeFiPlugin,  // ← This is all you need!
  ],

  messageExamples: [
    [
      {
        user: '{{user1}}',
        content: { text: 'What are the current crypto prices?' },
      },
      {
        user: '{{agentName}}',
        content: {
          text: "Let me check the latest prices for you...",
          action: 'GET_CRYPTO_PRICES',
        },
      },
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'How is the market doing?' },
      },
      {
        user: '{{agentName}}',
        content: {
          text: "I'll fetch the current market data including top movers.",
          action: 'GET_CRYPTO_PRICES',
        },
      },
    ],
  ],

  // Style configuration
  style: {
    all: [
      'Keep responses concise and data-focused',
      'Include emoji for visual appeal (📈 📉)',
      'Format prices with proper currency symbols',
    ],
    chat: ['Be friendly and helpful'],
    post: ['Share insights about market movements'],
  },

  topics: [
    'cryptocurrency',
    'defi',
    'prices',
    'market-data',
  ],

  // Agent metadata
  adjectives: ['helpful', 'data-driven', 'efficient'],
};

/**
 * Example User Interactions:
 *
 * User: "What are crypto prices?"
 * Agent: Fetches /api/price-feed via x402
 *        Returns BTC/ETH/SOL prices + top gainers/losers
 *
 * User: "How is BTC doing?"
 * Agent: Triggers GET_CRYPTO_PRICES action
 *        Parses response and highlights BTC data
 *
 * User: "What's pumping today?"
 * Agent: Focuses on top_movers.gainers from response
 *
 * All of this happens automatically when x402DeFiPlugin is added!
 */

/**
 * Configuration Options:
 *
 * The plugin reads from environment variables:
 * - X402_WALLET_PRIVATE_KEY (required) - Your wallet's hex private key
 * - X402_WALLET_ADDRESS (optional) - For logging only
 * - X402_API_BASE_URL (optional) - Override API endpoint
 *
 * Example .env file:
 * ```
 * X402_WALLET_PRIVATE_KEY=0x1234567890abcdef...
 * X402_WALLET_ADDRESS=0xYourAddress...
 * X402_API_BASE_URL=https://x402-api.fly.dev
 * ```
 *
 * Security Note:
 * Never commit your .env file! Add it to .gitignore immediately.
 */

/**
 * Cost Breakdown:
 *
 * Action: GET_CRYPTO_PRICES
 * Endpoint: /api/price-feed
 * Cost: $0.001 USDC
 *
 * With $1 of USDC, you can make:
 * - 1,000 price checks
 * - ~140 queries per day for a month
 * - Perfect for testing and development!
 */

/**
 * Troubleshooting:
 *
 * Error: "x402-fetch not installed"
 * → Run: npm install x402-fetch viem
 *
 * Error: "No wallet configured"
 * → Add X402_WALLET_PRIVATE_KEY to .env
 *
 * Error: "Insufficient USDC balance"
 * → Fund your wallet on Base:
 *   - Coinbase: withdraw USDC to Base
 *   - Uniswap: swap ETH for USDC on Base
 *   - bridge.base.org: bridge from Ethereum
 *
 * Error: "Payment validation failed"
 * → Ensure wallet has both USDC (for payment) and ETH (for gas)
 * → Check that you're on Base mainnet (chain ID 8453)
 */

export default character;
