import type { Action, IAgentRuntime, Memory, State, HandlerCallback, HandlerOptions, ActionResult } from '@elizaos/core';
import { x402ApiRequest, type X402ClientConfig } from '../client.js';
import type { ApiResponse, TokenScanData } from '../types.js';

const RISK_EMOJIS = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🔴', CRITICAL: '💀', UNKNOWN: '⚪' } as const;
const status = (value: boolean | null, yes: string, no: string) =>
  value === null ? '❔ Not reported' : value ? `⚠️ ${yes}` : `✅ ${no}`;
const reported = (value: number | null, suffix = '') => value === null ? 'not reported' : `${value.toLocaleString()}${suffix}`;

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
      'Read GoPlus ERC-20 security signals and a disclosed risk heuristic. Some fields may be unavailable. ' +
      'Query with contract address or supported symbol. Costs $0.003 USDC via x402.',

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
          `Open source: ${flags.is_verified === null ? 'not reported' : flags.is_verified ? 'yes' : 'no'}`,
          status(flags.has_proxy, 'Upgradeable proxy', 'No proxy flag'),
          status(flags.has_mint_function, 'Mintable', 'No mint flag'),
          status(flags.honeypot_risk, 'Honeypot flag', 'No honeypot flag'),
          status(flags.cannot_buy, 'Cannot buy flag', 'No buy restriction flag'),
          `Buy tax: ${reported(t.buy_tax, '%')} | Sell tax: ${reported(t.sell_tax, '%')}`,
        ].join('\n');

        const response =
          `## 🔍 Token Scanner: ${t.symbol} (${t.name})\n\n` +
          `${riskEmoji} **Heuristic risk: ${t.risk_level}** (score: ${t.risk_score ?? 'unavailable'}/100)\n\n` +
          `**Contract:** \`${t.address}\` on ${t.chain}\n` +
          `**Holders:** ${reported(t.holder_count)}\n\n` +
          `### Security Checks\n${flagLines}\n\n` +
          `*${t.risk_score_basis}*`;

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
        { name: '{{agent}}', content: { text: 'Checking live GoPlus security signals for PEPE. Missing checks will show as not reported.', actions: ['SCAN_TOKEN'] } },
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
