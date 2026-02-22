import type { Action, IAgentRuntime, Memory, State, HandlerCallback, HandlerOptions, ActionResult } from '@elizaos/core';
import { x402ApiRequest, type X402ClientConfig } from '../client.js';
import type { ApiResponse, WhaleTrackerData } from '../types.js';

export function createWhaleTrackerAction(config: X402ClientConfig): Action {
  return {
    name: 'TRACK_WHALES',
    similes: [
      'WHALE_TRACKER',
      'WHALE_ACTIVITY',
      'CHECK_WHALES',
      'TOP_HOLDERS',
      'HOLDER_ANALYSIS',
      'CONCENTRATION_ANALYSIS',
      'WHALE_MOVEMENTS',
      'LARGE_HOLDERS',
    ],
    description:
      'Analyze whale concentration and top holder distribution for any token. ' +
      'Returns top holders, Gini coefficient, distribution buckets, and recent large transfers. ' +
      'Costs $0.005 USDC via x402.',

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

        const symbolMatch = text.match(/\b(BTC|ETH|SOL|PEPE|SHIB|DOGE|LINK|UNI|AAVE|ARB|OP|SUI|AVAX)\b/i);
        const chainMatch = text.match(/\b(ethereum|base|solana|arbitrum|optimism)\b/i);

        const token = ((options as unknown as Record<string, unknown>)?.token as string) || symbolMatch?.[1]?.toUpperCase() || 'ETH';
        const chain = ((options as unknown as Record<string, unknown>)?.chain as string) || chainMatch?.[1]?.toLowerCase() || 'ethereum';

        const data = await x402ApiRequest<ApiResponse<WhaleTrackerData>>(
          '/api/whale-tracker',
          { token, chain },
          config
        );

        const w = data.data;
        const cm = w.concentration_metrics;

        // Concentration health indicator
        const giniRisk = cm.gini_coefficient > 0.8 ? '🔴 Very concentrated'
          : cm.gini_coefficient > 0.65 ? '🟡 Moderately concentrated'
          : '🟢 Well distributed';

        const topHolderLines = w.top_holders.slice(0, 5)
          .map(h => `  ${h.rank}. ${h.label} (${h.wallet_type}): **${h.percentage}%**`)
          .join('\n');

        const recentTx = w.recent_large_transfers
          .map(tx => `  • $${tx.usd_value.toLocaleString()} ${tx.transfer_type} — ${new Date(tx.timestamp).toLocaleDateString()}`)
          .join('\n');

        const response =
          `## 🐋 Whale Tracker: ${w.token} on ${w.chain}\n\n` +
          `**Distribution:** ${giniRisk}\n` +
          `**Gini coefficient:** ${cm.gini_coefficient} | **Top 10 hold:** ${cm.top_10_pct}%\n` +
          `**Total holders:** ${w.holder_count?.toLocaleString()}\n\n` +
          `### Top 5 Holders\n${topHolderLines}\n\n` +
          `### Recent Large Transfers\n${recentTx || '  No recent large transfers'}`;

        if (callback) {
          await callback({ text: response, source: message.content.source });
        }

        return { success: true, text: response, data: data.data as unknown as Record<string, unknown> };
      } catch (error) {
        const errMsg = `Failed to track whales: ${(error as Error).message}`;
        if (callback) await callback({ text: errMsg });
        return { success: false, text: errMsg };
      }
    },

    examples: [
      [
        { name: '{{user}}', content: { text: 'Are whales accumulating ETH?' } },
        { name: '{{agent}}', content: { text: '## 🐋 Whale Tracker: ETH\n\nTop 10 holders own 42% of supply. Gini: 0.72\n\nRecent large transfers detected...', actions: ['TRACK_WHALES'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'Show me whale activity for PEPE' } },
        { name: '{{agent}}', content: { text: 'Fetching PEPE whale distribution and recent transfers...', actions: ['TRACK_WHALES'] } },
      ],
    ],
  };
}
