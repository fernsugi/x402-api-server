import type { Action, IAgentRuntime, Memory, State, HandlerCallback, HandlerOptions, ActionResult } from '@elizaos/core';
import { x402ApiRequest, type X402ClientConfig } from '../client.js';
import type { ApiResponse, TokenScanData } from '../types.js';

const RISK_EMOJIS = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🔴', CRITICAL: '💀' } as const;

export function createTokenScannerAction(config: X402ClientConfig): Action {
  return {
    name: 'SCAN_TOKEN',
    similes: [
      'TOKEN_SCANNER',
      'CHECK_TOKEN',
      'TOKEN_SECURITY',
      'TOKEN_AUDIT',
      'RUG_CHECK',
      'HONEYPOT_CHECK',
      'TOKEN_SAFETY',
      'ANALYZE_TOKEN',
      'TOKEN_RISK',
    ],
    description:
      'Scan a token for security risks: contract verification, mint function, proxy, liquidity lock, ' +
      'honeypot detection, buy/sell tax, holder count, market cap. ' +
      'Detects potential rug-pulls. Query with token symbol or address. Costs $0.003 USDC via x402.',

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

        // Extract token from message
        const addressMatch = text.match(/0x[0-9a-fA-F]{40}/);
        const symbolMatch = text.match(/\b([A-Z]{2,8})\b/);

        const token = ((options as unknown as Record<string, unknown>)?.token as string) ||
          addressMatch?.[0] ||
          symbolMatch?.[1] ||
          'PEPE';

        const chainMatch = text.match(/\b(ethereum|base|arbitrum|polygon)\b/i);
        const chain = ((options as unknown as Record<string, unknown>)?.chain as string) || chainMatch?.[1]?.toLowerCase() || 'ethereum';

        const data = await x402ApiRequest<ApiResponse<TokenScanData>>(
          '/api/token-scanner',
          { token, chain },
          config
        );

        const t = data.data;
        const riskEmoji = RISK_EMOJIS[t.risk_level];

        const flags = t.risk_flags;
        const flagLines = [
          `${flags.is_verified ? '✅' : '❌'} Contract verified`,
          `${!flags.has_proxy ? '✅' : '⚠️'} ${flags.has_proxy ? 'Has proxy (upgradeable)' : 'No proxy'}`,
          `${!flags.has_mint_function ? '✅' : '⚠️'} ${flags.has_mint_function ? 'Has mint function' : 'No mint function'}`,
          `${flags.liquidity_locked ? '✅' : '❌'} Liquidity ${flags.liquidity_locked ? 'locked' : 'NOT locked'}`,
          `${!flags.honeypot_risk ? '✅' : '💀'} ${flags.honeypot_risk ? 'HONEYPOT DETECTED' : 'No honeypot'}`,
          `${!flags.high_buy_tax ? '✅' : '⚠️'} Buy tax: ${t.buy_tax}%`,
          `${!flags.high_sell_tax ? '✅' : '⚠️'} Sell tax: ${t.sell_tax}%`,
        ].join('\n');

        const response =
          `## 🔍 Token Scanner: ${t.symbol} (${t.name})\n\n` +
          `${riskEmoji} **Risk: ${t.risk_level}** (score: ${t.risk_score}/100)\n\n` +
          `**Contract:** \`${t.address}\` on ${t.chain}\n` +
          `**Price:** $${t.price_usd} | **Market Cap:** $${t.market_cap_usd?.toLocaleString()}\n` +
          `**Liquidity:** $${t.liquidity_usd?.toLocaleString()} | **Holders:** ${t.holder_count?.toLocaleString()}\n` +
          `**Age:** ${t.age_days} days\n\n` +
          `### Security Checks\n${flagLines}`;

        if (callback) {
          await callback({ text: response, source: message.content.source });
        }

        return { success: true, text: response, data: data.data as unknown as Record<string, unknown> };
      } catch (error) {
        const errMsg = `Failed to scan token: ${(error as Error).message}`;
        if (callback) await callback({ text: errMsg });
        return { success: false, text: errMsg };
      }
    },

    examples: [
      [
        { name: '{{user}}', content: { text: 'Is PEPE safe to buy? Check for rug' } },
        { name: '{{agent}}', content: { text: '## 🔍 Token Scanner: PEPE\n\n🟢 **Risk: LOW** (score: 15/100)\n\n✅ Contract verified\n✅ No proxy\n✅ Liquidity locked\n✅ No honeypot', actions: ['SCAN_TOKEN'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'Scan this token: 0x6982508145454Ce325dDbE47a25d4ec3d2311933' } },
        { name: '{{agent}}', content: { text: 'Scanning token security for 0x698...', actions: ['SCAN_TOKEN'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'Check if this is a honeypot' } },
        { name: '{{agent}}', content: { text: 'Running security scan...', actions: ['SCAN_TOKEN'] } },
      ],
    ],
  };
}
