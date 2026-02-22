import type { Action, IAgentRuntime, Memory, State, HandlerCallback, HandlerOptions, ActionResult } from '@elizaos/core';
import { x402ApiRequest, type X402ClientConfig } from '../client.js';
import type { PriceFeedResponse } from '../types.js';

export function createPriceFeedAction(config: X402ClientConfig): Action {
  return {
    name: 'GET_CRYPTO_PRICES',
    similes: [
      'PRICE_FEED',
      'GET_PRICES',
      'CRYPTO_PRICES',
      'TOKEN_PRICES',
      'MARKET_PRICES',
      'CHECK_PRICE',
      'PRICE_CHECK',
      'CURRENT_PRICES',
      'MARKET_DATA',
    ],
    description:
      'Fetch live crypto prices for BTC, ETH, SOL and top movers by 24h change. ' +
      'Data sourced from CoinGecko. Costs $0.001 USDC via x402.',

    validate: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
      // Always valid — no required parameters
      return true;
    },

    handler: async (
      _runtime: IAgentRuntime,
      message: Memory,
      _state?: State,
      _options?: HandlerOptions,
      callback?: HandlerCallback
    ) => {
      try {
        const data = await x402ApiRequest<PriceFeedResponse>('/api/price-feed', {}, config);

        const { core, top_movers } = data.data;

        // Format a readable summary
        const coreLines = core
          .map(c => {
            const sign = (c.change_24h_pct ?? 0) >= 0 ? '📈' : '📉';
            const change = c.change_24h_pct != null ? `${sign} ${c.change_24h_pct > 0 ? '+' : ''}${c.change_24h_pct}%` : '';
            const price = c.price_usd != null ? `$${c.price_usd.toLocaleString()}` : 'N/A';
            return `• **${c.id.toUpperCase()}**: ${price} ${change}`;
          })
          .join('\n');

        const gainersLine = top_movers.gainers
          .slice(0, 3)
          .map(c => `${c.id.toUpperCase()} +${c.change_24h_pct}%`)
          .join(', ');

        const losersLine = top_movers.losers
          .slice(0, 3)
          .map(c => `${c.id.toUpperCase()} ${c.change_24h_pct}%`)
          .join(', ');

        const text =
          `## 💰 Crypto Prices\n\n${coreLines}\n\n` +
          `**Top Gainers (24h):** ${gainersLine}\n` +
          `**Top Losers (24h):** ${losersLine}\n\n` +
          `*Source: ${data.source} • Updated: ${data.timestamp}${data.cached ? ' (cached)' : ''}*`;

        if (callback) {
          await callback({ text, source: message.content.source });
        }

        return { success: true, text, data: data.data as unknown as Record<string, unknown> };
      } catch (error) {
        const errMsg = `Failed to fetch crypto prices: ${(error as Error).message}`;
        if (callback) await callback({ text: errMsg });
        return { success: false, text: errMsg };
      }
    },

    examples: [
      [
        { name: '{{user}}', content: { text: 'What are the current crypto prices?' } },
        { name: '{{agent}}', content: { text: '## 💰 Crypto Prices\n\n• **BITCOIN**: $98,000 📈 +2.1%\n• **ETHEREUM**: $2,750 📉 -0.8%\n• **SOLANA**: $185 📈 +4.2%\n\n**Top Gainers:** SUI +8.2%, SOL +4.2%, BTC +2.1%', actions: ['GET_CRYPTO_PRICES'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'Check the price feed' } },
        { name: '{{agent}}', content: { text: 'Fetching live crypto prices...', actions: ['GET_CRYPTO_PRICES'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'How is the market doing?' } },
        { name: '{{agent}}', content: { text: '## 💰 Crypto Prices\n\nFetching latest market data via x402...', actions: ['GET_CRYPTO_PRICES'] } },
      ],
    ],
  };
}
