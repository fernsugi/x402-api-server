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
      'Get one live ParaSwap aggregate route for a supported token pair. ' +
      'Reports expected output and route components; no independent venue comparison. ' +
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
        if (!best) throw new Error('No route returned');

        const response =
          `## 🔄 ParaSwap quote: ${amount} ${from} → ${to} on ${chain}\n\n` +
          `**Expected output:** ${best.output_amount} ${to}\n` +
          `**Route components:** ${best.route.join(', ') || 'not reported'}\n` +
          `**Estimated gas:** ${best.estimated_gas_usd === null ? 'not reported' : `$${best.estimated_gas_usd}`}\n\n` +
          `*${q.recommendation.reason} Quote can change before execution. ${data.timestamp}*`;

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
        { name: '{{agent}}', content: { text: 'Fetching a live ParaSwap route for ETH → USDC.', actions: ['GET_DEX_QUOTES'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'Compare DEX rates for ETH/USDC on Base' } },
        { name: '{{agent}}', content: { text: 'Getting a ParaSwap aggregate quote on Base...', actions: ['GET_DEX_QUOTES'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'How much USDC do I get for 0.5 BTC?' } },
        { name: '{{agent}}', content: { text: 'Fetching DEX quotes for 0.5 BTC → USDC...', actions: ['GET_DEX_QUOTES'] } },
      ],
    ],
  };
}
