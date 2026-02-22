import type { Action, IAgentRuntime, Memory, State, HandlerCallback, HandlerOptions, ActionResult } from '@elizaos/core';
import { x402ApiRequest, extractParams, type X402ClientConfig } from '../client.js';
import type { ApiResponse, DexQuotesData } from '../types.js';

export function createDexQuotesAction(config: X402ClientConfig): Action {
  return {
    name: 'GET_DEX_QUOTES',
    similes: [
      'DEX_QUOTES',
      'SWAP_QUOTES',
      'GET_SWAP_RATE',
      'COMPARE_DEXS',
      'UNISWAP_QUOTE',
      'SWAP_PRICE',
      'BEST_SWAP',
      'TOKEN_SWAP_QUOTE',
      'DEX_COMPARISON',
    ],
    description:
      'Get DEX swap quotes for any token pair across Uniswap V3, SushiSwap, and 1inch. ' +
      'Compares rates, price impact, fees, and gas costs. ' +
      'Query with from/to tokens, amount, and chain. Costs $0.002 USDC via x402.',

    validate: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
      return true;
    },

    handler: async (
      _runtime: IAgentRuntime,
      message: Memory,
      _state?: State,
      options?: HandlerOptions,
      callback?: HandlerCallback
    ) => {
      try {
        const text = message.content.text || '';

        // Extract swap parameters from message
        // Patterns: "swap 1 ETH to USDC", "ETH/USDC quote", "0.5 BTC for USDT on base"
        const fromMatch = text.match(/\b(from|swap|sell|exchange)\s+[\d.]+\s+([A-Z]{2,6})/i) ||
                         text.match(/\b([\d.]+)\s+([A-Z]{2,6})\s+(?:to|for|→)/i);
        const toMatch = text.match(/\b(?:to|for|into)\s+([A-Z]{2,6})\b/i);
        const amountMatch = text.match(/\b([\d.]+(?:\.\d+)?)\b/);
        const chainMatch = text.match(/\b(ethereum|base|arbitrum|polygon)\b/i);

        const from = ((options as unknown as Record<string, unknown>)?.from as string) || fromMatch?.[2]?.toUpperCase() || 'ETH';
        const to = ((options as unknown as Record<string, unknown>)?.to as string) || toMatch?.[1]?.toUpperCase() || 'USDC';
        const amount = ((options as unknown as Record<string, unknown>)?.amount as number) || parseFloat(amountMatch?.[1] || '1') || 1;
        const chain = ((options as unknown as Record<string, unknown>)?.chain as string) || chainMatch?.[1]?.toLowerCase() || 'ethereum';

        const data = await x402ApiRequest<ApiResponse<DexQuotesData>>(
          '/api/dex-quotes',
          { from, to, amount: amount.toString(), chain },
          config
        );

        const q = data.data;
        const best = q.quotes[0];

        const quoteLines = q.quotes
          .map((quote, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
            return (
              `${medal} **${quote.dex_name}**: ${quote.output_amount} ${to} ` +
              `(impact: ${quote.price_impact_pct}%, gas: $${quote.estimated_gas_usd})`
            );
          })
          .join('\n');

        const response =
          `## 🔄 DEX Quotes: ${amount} ${from} → ${to} on ${chain}\n\n` +
          `${quoteLines}\n\n` +
          `**Best:** ${q.recommendation.dex} — ${q.recommendation.reason}\n` +
          `**Output:** ${best.output_amount} ${to} ($${(best.output_amount * (q.input_value_usd / amount)).toFixed(2)})\n` +
          `**Total cost:** $${q.recommendation.total_cost_usd} (fees + gas)\n\n` +
          `*Quotes valid for ${best.expires_in_seconds}s • ${data.timestamp}*`;

        if (callback) {
          await callback({ text: response, source: message.content.source });
        }

        return { success: true, text: response, data: data.data as unknown as Record<string, unknown> };
      } catch (error) {
        const errMsg = `Failed to get DEX quotes: ${(error as Error).message}`;
        if (callback) await callback({ text: errMsg });
        return { success: false, text: errMsg };
      }
    },

    examples: [
      [
        { name: '{{user}}', content: { text: 'What\'s the best rate to swap 1 ETH to USDC?' } },
        { name: '{{agent}}', content: { text: '## 🔄 DEX Quotes: 1 ETH → USDC on ethereum\n\n🥇 1inch Aggregator: 2749.5 USDC\n🥈 Uniswap V3: 2747.2 USDC\n🥉 SushiSwap: 2744.8 USDC', actions: ['GET_DEX_QUOTES'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'Compare DEX rates for ETH/USDC on Base' } },
        { name: '{{agent}}', content: { text: 'Getting swap quotes across Uniswap, SushiSwap, and 1inch on Base...', actions: ['GET_DEX_QUOTES'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'How much USDC do I get for 0.5 BTC?' } },
        { name: '{{agent}}', content: { text: 'Fetching DEX quotes for 0.5 BTC → USDC...', actions: ['GET_DEX_QUOTES'] } },
      ],
    ],
  };
}
