import type { Action, IAgentRuntime, Memory, State, HandlerCallback, HandlerOptions, ActionResult } from '@elizaos/core';
import { x402ApiRequest, type X402ClientConfig } from '../client.js';
import type { ApiResponse, WalletProfileData } from '../types.js';

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
      'Read priced public EVM wallet balances from Blockscout or a limited public RPC fallback. ' +
      'Coverage can be partial; DeFi positions, PnL, and risk rating are unavailable. ' +
      'Query with ?address=0x... Costs $0.008 USDC via x402.',

    validate: async (_runtime: IAgentRuntime, message: Memory, _state?: State) => {
      const text = message.content.text || '';
      const hasAddress = /0x[0-9a-fA-F]{40}/.test(text);
      return hasAddress;
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
        const address = ((options as unknown as Record<string, unknown>)?.address as string) || addressMatch?.[0];
        if (!address) throw new Error('Wallet address required');

        const chainMatch = text.match(/\b(ethereum|base|arbitrum|polygon|all)\b/i);
        const chain = ((options as unknown as Record<string, unknown>)?.chain as string) || chainMatch?.[1]?.toLowerCase() || 'all';

        const data = await x402ApiRequest<ApiResponse<WalletProfileData>>(
          '/api/wallet-profiler',
          { address, chain },
          config
        );

        const w = data.data;
        // Format total value
        const totalFormatted = w.total_value_usd >= 1e6
          ? `$${(w.total_value_usd / 1e6).toFixed(2)}M`
          : `$${w.total_value_usd.toLocaleString()}`;

        // Top holdings
        const holdingsLines = w.portfolio.top_holdings.slice(0, 5)
          .map(h => `  • ${h.token} (${h.chain}): $${h.value_usd.toLocaleString()} (${h.portfolio_pct ?? 'unknown'}%)`)
          .join('\n');

        const alloc = w.portfolio.allocation;
        const activity = w.activity;

        const response =
          `## 👛 Wallet Profile\n\n` +
          `**Address:** \`${w.address}\`${w.label ? ` (${w.label})` : ''}\n` +
          `**Chains with priced balances:** ${w.chains_active.join(', ') || 'none'}\n` +
          `**Observed priced balances:** ${totalFormatted}\n\n` +
          `### Portfolio Allocation\n` +
          `  Native: ${alloc.native_tokens_pct ?? 'unknown'}% | Stablecoins: ${alloc.stablecoins_pct ?? 'unknown'}%\n\n` +
          `### Top Holdings\n${holdingsLines || 'No priced holdings found'}\n\n` +
          `### Activity\n` +
          `  ${activity.total_transactions?.toLocaleString() ?? 'Unknown'} transactions\n\n` +
          `*${w.coverage.note} Unavailable chains: ${w.coverage.unavailable_chains.join(', ') || 'none'}.*`;

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
        { name: '{{agent}}', content: { text: 'Checking public Blockscout balances and available activity. Coverage may be partial.', actions: ['PROFILE_WALLET'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'What\'s in this wallet? 0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8' } },
        { name: '{{agent}}', content: { text: 'Profiling wallet 0xBE0e...', actions: ['PROFILE_WALLET'] } },
      ],
    ],
  };
}
