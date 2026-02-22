import type { Action, IAgentRuntime, Memory, State, HandlerCallback, HandlerOptions, ActionResult } from '@elizaos/core';
import { x402ApiRequest, type X402ClientConfig } from '../client.js';
import type { ArbOpportunity } from '../types.js';

interface FundingRatesResponse {
  timestamp: string;
  source: string;
  protocols: string[];
  assets_covered: string[];
  funding_interval_hours: number;
  data: Record<string, Record<string, {
    funding_rate: number;
    annualized_pct: number;
    open_interest_usd: number;
    next_funding_in_ms: number;
  }>>;
  arb_opportunities: ArbOpportunity[];
  query: Record<string, unknown>;
}

const SIGNAL_EMOJIS = { STRONG: '🚀', MODERATE: '📈', WEAK: '💤' } as const;

export function createFundingRatesAction(config: X402ClientConfig): Action {
  return {
    name: 'GET_FUNDING_RATES',
    similes: [
      'FUNDING_RATES',
      'PERP_FUNDING',
      'PERPETUAL_RATES',
      'FUNDING_ARBITRAGE',
      'PERP_RATES',
      'FUNDING_ANALYSIS',
      'HYPERLIQUID_FUNDING',
      'DYDX_FUNDING',
    ],
    description:
      'Get perpetual futures funding rates across Hyperliquid, dYdX v4, Aevo, GMX, Drift, and Vertex. ' +
      'Identifies funding rate arbitrage opportunities (long/short spread capture). ' +
      'Costs $0.008 USDC via x402.',

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

        // Extract asset and min spread from message
        const assetMatch = text.match(/\b(BTC|ETH|SOL|SUI|AVAX|ARB|OP|DOGE|LINK|UNI)\b/i);
        const spreadMatch = text.match(/(?:spread|bps|basis points)[:\s]+(\d+)/i);

        const asset = ((options as unknown as Record<string, unknown>)?.asset as string) || assetMatch?.[1]?.toUpperCase();
        const minSpread = ((options as unknown as Record<string, unknown>)?.min_spread as number) || (spreadMatch ? parseInt(spreadMatch[1]) : 0);

        const params: Record<string, string | number | undefined> = {};
        if (asset) params.asset = asset;
        if (minSpread > 0) params.min_spread = minSpread;

        const data = await x402ApiRequest<FundingRatesResponse>('/api/funding-rates', params, config);

        // Show top arb opportunities
        const arbs = data.arb_opportunities.slice(0, 5);
        const arbLines = arbs.length > 0
          ? arbs.map(arb => {
              const signal = SIGNAL_EMOJIS[arb.signal];
              return (
                `${signal} **${arb.asset}**: ${arb.spread_bps} bps spread — ` +
                `Long ${arb.long_venue}, Short ${arb.short_venue} → **${arb.annualized_arb_pct}% APR**`
              );
            }).join('\n')
          : '  No significant arb opportunities found';

        // Show rates for specific asset if requested
        let assetSection = '';
        if (asset && data.data[asset]) {
          const rates = Object.entries(data.data[asset])
            .sort((a, b) => a[1].funding_rate - b[1].funding_rate)
            .map(([protocol, r]) => {
              const sign = r.funding_rate >= 0 ? '+' : '';
              return `  • ${protocol}: ${sign}${(r.funding_rate * 100).toFixed(4)}% (${sign}${r.annualized_pct}% APR)`;
            })
            .join('\n');
          assetSection = `\n\n### ${asset} Funding Rates\n${rates}`;
        }

        const response =
          `## 📊 Funding Rates — ${asset || 'All Assets'}\n\n` +
          `### Top Arbitrage Opportunities\n${arbLines}` +
          assetSection +
          `\n\n*Funding interval: ${data.funding_interval_hours}h | Protocols: ${data.protocols.join(', ')} | ${data.timestamp}*`;

        if (callback) {
          await callback({ text: response, source: message.content.source });
        }

        return { success: true, text: response, data: { rates: data.data, arb: data.arb_opportunities } };
      } catch (error) {
        const errMsg = `Failed to get funding rates: ${(error as Error).message}`;
        if (callback) await callback({ text: errMsg });
        return { success: false, text: errMsg };
      }
    },

    examples: [
      [
        { name: '{{user}}', content: { text: 'What are the current perp funding rates?' } },
        { name: '{{agent}}', content: { text: '## 📊 Funding Rates\n\n### Top Arb Opportunities\n🚀 BTC: 12 bps spread — Long dYdX, Short Drift → 24.5% APR\n📈 ETH: 8 bps — Long GMX, Short Aevo → 14.2% APR', actions: ['GET_FUNDING_RATES'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'Is there a funding rate arb for ETH?' } },
        { name: '{{agent}}', content: { text: 'Checking ETH funding rates across all perp venues...', actions: ['GET_FUNDING_RATES'] } },
      ],
    ],
  };
}
