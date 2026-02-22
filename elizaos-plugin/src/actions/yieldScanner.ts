import type { Action, IAgentRuntime, Memory, State, HandlerCallback, HandlerOptions, ActionResult } from '@elizaos/core';
import { x402ApiRequest, type X402ClientConfig } from '../client.js';
import type { YieldPool } from '../types.js';

interface YieldScannerResponse {
  timestamp: string;
  source: string;
  total_results: number;
  data: YieldPool[];
  query: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

const RISK_EMOJIS = { low: '🟢', medium: '🟡', high: '🔴' } as const;

export function createYieldScannerAction(config: X402ClientConfig): Action {
  return {
    name: 'SCAN_YIELDS',
    similes: [
      'YIELD_SCANNER',
      'FIND_YIELDS',
      'BEST_APY',
      'DEFI_YIELDS',
      'YIELD_OPPORTUNITIES',
      'HIGH_YIELD',
      'STAKING_RATES',
      'LENDING_RATES',
      'PASSIVE_INCOME',
      'DEFI_APY',
    ],
    description:
      'Find the best DeFi yield opportunities across Aave, Compound, Morpho, Lido, Pendle, Ethena, ' +
      'Yearn, Convex, and more. Filter by chain, asset, TVL, and risk tier. ' +
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

        const chainMatch = text.match(/\b(ethereum|base|arbitrum|polygon|all)\b/i);
        const assetMatch = text.match(/\b(ETH|USDC|USDT|DAI|stETH|rETH|sUSDe|sDAI|WBTC)\b/i);
        const minTvlMatch = text.match(/(?:min\s+tvl|tvl\s+above|minimum\s+tvl)[:\s]+\$?([\d,kmb]+)/i);

        const chain = ((options as unknown as Record<string, unknown>)?.chain as string) || chainMatch?.[1]?.toLowerCase() || 'all';
        const asset = ((options as unknown as Record<string, unknown>)?.asset as string) || assetMatch?.[1]?.toUpperCase();
        const limit = ((options as unknown as Record<string, unknown>)?.limit as number) || 10;

        // Parse min_tvl (supports "1m", "500k", etc.)
        let minTvl = ((options as unknown as Record<string, unknown>)?.min_tvl as number) || 0;
        if (minTvlMatch) {
          const tvlStr = minTvlMatch[1].toLowerCase().replace(',', '');
          if (tvlStr.endsWith('b')) minTvl = parseFloat(tvlStr) * 1e9;
          else if (tvlStr.endsWith('m')) minTvl = parseFloat(tvlStr) * 1e6;
          else if (tvlStr.endsWith('k')) minTvl = parseFloat(tvlStr) * 1e3;
          else minTvl = parseFloat(tvlStr);
        }

        const params: Record<string, string | number | undefined> = { chain, limit };
        if (asset) params.asset = asset;
        if (minTvl > 0) params.min_tvl = minTvl;

        const data = await x402ApiRequest<YieldScannerResponse>('/api/yield-scanner', params, config);

        const pools = data.data.slice(0, limit);

        const poolLines = pools
          .map((p, i) => {
            const riskEmoji = RISK_EMOJIS[p.risk_tier];
            const tvlFormatted = p.tvl >= 1e9 ? `$${(p.tvl / 1e9).toFixed(1)}B`
              : p.tvl >= 1e6 ? `$${(p.tvl / 1e6).toFixed(0)}M`
              : `$${(p.tvl / 1e3).toFixed(0)}K`;
            return `${i + 1}. ${riskEmoji} **${p.protocol}** — ${p.asset} on ${p.chain}: **${p.apy}% APY** (TVL: ${tvlFormatted}, ${p.type})`;
          })
          .join('\n');

        const response =
          `## 🌾 Yield Scanner${asset ? ` — ${asset}` : ''}${chain !== 'all' ? ` on ${chain}` : ''}\n\n` +
          `${poolLines}\n\n` +
          `*🟢 low risk  🟡 medium  🔴 high | ${data.total_results} results • ${data.timestamp}*`;

        if (callback) {
          await callback({ text: response, source: message.content.source });
        }

        return { success: true, text: response, data: data.data as unknown as Record<string, unknown> };
      } catch (error) {
        const errMsg = `Failed to scan yields: ${(error as Error).message}`;
        if (callback) await callback({ text: errMsg });
        return { success: false, text: errMsg };
      }
    },

    examples: [
      [
        { name: '{{user}}', content: { text: 'What are the best DeFi yields right now?' } },
        { name: '{{agent}}', content: { text: '## 🌾 Yield Scanner\n\n1. 🔴 Camelot — GRAIL/ETH on arbitrum: 28.3% APY\n2. 🔴 Aerodrome — USDC/ETH on base: 22.1% APY\n3. 🔴 Ethena — sUSDe on ethereum: 18.5% APY', actions: ['SCAN_YIELDS'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'Find safe USDC yields on Base' } },
        { name: '{{agent}}', content: { text: 'Scanning USDC yield opportunities on Base...', actions: ['SCAN_YIELDS'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'Best staking rates for ETH?' } },
        { name: '{{agent}}', content: { text: 'Finding ETH yield opportunities across all chains...', actions: ['SCAN_YIELDS'] } },
      ],
    ],
  };
}
