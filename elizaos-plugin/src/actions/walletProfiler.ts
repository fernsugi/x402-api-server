import type { Action, IAgentRuntime, Memory, State, HandlerCallback, HandlerOptions, ActionResult } from '@elizaos/core';
import { x402ApiRequest, type X402ClientConfig } from '../client.js';
import type { ApiResponse, WalletProfileData } from '../types.js';

const RISK_EMOJIS = { conservative: '🟢', moderate: '🟡', aggressive: '🔴' } as const;

export function createWalletProfilerAction(config: X402ClientConfig): Action {
  return {
    name: 'PROFILE_WALLET',
    similes: [
      'WALLET_PROFILER',
      'WALLET_ANALYSIS',
      'ANALYZE_WALLET',
      'CHECK_WALLET',
      'WALLET_PORTFOLIO',
      'WALLET_HOLDINGS',
      'ADDRESS_ANALYSIS',
      'WALLET_INTEL',
      'WALLET_INFO',
    ],
    description:
      'Profile an Ethereum wallet: portfolio holdings, DeFi positions, activity metrics, ' +
      'risk classification, and chain distribution. ' +
      'Query with ?address=0x... Costs $0.008 USDC via x402.',

    validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State) => {
      const text = message.content.text || '';
      // Valid if there's a wallet address in the message, or we'll use a default
      const hasAddress = /0x[0-9a-fA-F]{40}/.test(text);
      const hasWalletKeywords = /wallet|address|portfolio|holdings|profile/i.test(text);
      return hasAddress || hasWalletKeywords;
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

        // Extract wallet address
        const addressMatch = text.match(/0x[0-9a-fA-F]{40}/);
        const address = ((options as unknown as Record<string, unknown>)?.address as string) ||
          addressMatch?.[0] ||
          '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik default

        const chainMatch = text.match(/\b(ethereum|base|arbitrum|polygon|all)\b/i);
        const chain = ((options as unknown as Record<string, unknown>)?.chain as string) || chainMatch?.[1]?.toLowerCase() || 'all';

        const data = await x402ApiRequest<ApiResponse<WalletProfileData>>(
          '/api/wallet-profiler',
          { address, chain },
          config
        );

        const w = data.data;
        const riskEmoji = RISK_EMOJIS[w.risk_profile.classification];

        // Format total value
        const totalFormatted = w.total_value_usd >= 1e6
          ? `$${(w.total_value_usd / 1e6).toFixed(2)}M`
          : `$${w.total_value_usd.toLocaleString()}`;

        // Top holdings
        const holdingsLines = w.portfolio.top_holdings.slice(0, 5)
          .map(h => `  • ${h.token} (${h.chain}): $${h.value_usd.toLocaleString()} (${h.portfolio_pct}%)`)
          .join('\n');

        // DeFi positions
        const defiLines = w.defi_positions.length > 0
          ? w.defi_positions
              .map(p => `  • ${p.protocol} ${p.type}: ${p.asset} — $${p.value_usd.toLocaleString()} @ ${p.apy}% APY`)
              .join('\n')
          : '  No active DeFi positions';

        const alloc = w.portfolio.allocation;
        const activity = w.activity;

        const response =
          `## 👛 Wallet Profile\n\n` +
          `**Address:** \`${w.address}\`${w.label ? ` (${w.label})` : ''}\n` +
          `**Type:** ${w.wallet_type} | **Chains:** ${w.chains_active.join(', ')}\n` +
          `**Total Value:** ${totalFormatted} | **DeFi:** $${w.defi_value_usd.toLocaleString()}\n\n` +
          `### Portfolio Allocation\n` +
          `  Native: ${alloc.native_tokens_pct}% | Stablecoins: ${alloc.stablecoins_pct}% | DeFi tokens: ${alloc.defi_tokens_pct}%\n\n` +
          `### Top Holdings\n${holdingsLines}\n\n` +
          `### DeFi Positions\n${defiLines}\n\n` +
          `### Activity\n` +
          `  ${activity.total_transactions.toLocaleString()} txns | ${activity.age_days} days old | Last active: ${new Date(activity.last_active).toLocaleDateString()}\n\n` +
          `### Risk Profile\n` +
          `  ${riskEmoji} **${w.risk_profile.classification.toUpperCase()}** | Diversification: ${w.risk_profile.diversification_score}/10 | DeFi exposure: ${w.risk_profile.defi_exposure_pct}%`;

        if (callback) {
          await callback({ text: response, source: message.content.source });
        }

        return { success: true, text: response, data: data.data as unknown as Record<string, unknown> };
      } catch (error) {
        const errMsg = `Failed to profile wallet: ${(error as Error).message}`;
        if (callback) await callback({ text: errMsg });
        return { success: false, text: errMsg };
      }
    },

    examples: [
      [
        { name: '{{user}}', content: { text: 'Analyze wallet 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' } },
        { name: '{{agent}}', content: { text: '## 👛 Wallet Profile\n\n**Address:** `0xd8dA...` (vitalik.eth)\n**Total Value:** $4.82M | **DeFi:** $820K', actions: ['PROFILE_WALLET'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'What\'s in this wallet? 0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8' } },
        { name: '{{agent}}', content: { text: 'Profiling wallet 0xBE0e...', actions: ['PROFILE_WALLET'] } },
      ],
    ],
  };
}
