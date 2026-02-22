import type { Action, IAgentRuntime, Memory, State, HandlerCallback, HandlerOptions, ActionResult } from '@elizaos/core';
import { x402ApiRequest, type X402ClientConfig } from '../client.js';
import type { GasTrackerResponse } from '../types.js';

export function createGasTrackerAction(config: X402ClientConfig): Action {
  return {
    name: 'GET_GAS_PRICES',
    similes: [
      'GAS_TRACKER',
      'GAS_PRICES',
      'CHECK_GAS',
      'CURRENT_GAS',
      'TRANSACTION_FEES',
      'GAS_FEES',
      'NETWORK_FEES',
      'ETH_GAS',
    ],
    description:
      'Fetch current gas prices across Ethereum, Base, Polygon, and Arbitrum. ' +
      'Returns slow/normal/fast tiers with USD cost estimates for transfers, swaps, and NFT mints. ' +
      'Costs $0.001 USDC via x402.',

    validate: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
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
        const data = await x402ApiRequest<GasTrackerResponse>('/api/gas-tracker', {}, config);

        const chains = data.data;

        const chainLines = Object.entries(chains)
          .map(([key, chain]) => {
            const gwei = chain.gas_price_gwei;
            const cost = chain.estimated_cost_usd;
            return (
              `### ${chain.chain} (Chain ID: ${chain.chain_id})\n` +
              `Gas: slow ${gwei.slow} / normal ${gwei.normal} / fast ${gwei.fast} gwei\n` +
              `Transfer: $${cost.transfer.normal} | Swap: $${cost.swap.normal} | NFT mint: $${cost.nft_mint.normal}`
            );
          })
          .join('\n\n');

        const text =
          `## ⛽ Gas Tracker\n\n${chainLines}\n\n` +
          `*Source: ${data.source} • Updated: ${data.timestamp}*`;

        if (callback) {
          await callback({ text, source: message.content.source });
        }

        return { success: true, text, data: data.data as unknown as Record<string, unknown> };
      } catch (error) {
        const errMsg = `Failed to fetch gas prices: ${(error as Error).message}`;
        if (callback) await callback({ text: errMsg });
        return { success: false, text: errMsg };
      }
    },

    examples: [
      [
        { name: '{{user}}', content: { text: 'What are the current gas prices?' } },
        { name: '{{agent}}', content: { text: '## ⛽ Gas Tracker\n\n### Ethereum\nGas: slow 20 / normal 28 / fast 39 gwei\nTransfer: $1.62 | Swap: $11.55 | NFT mint: $6.54', actions: ['GET_GAS_PRICES'] } },
      ],
      [
        { name: '{{user}}', content: { text: 'How much does an ETH transfer cost right now?' } },
        { name: '{{agent}}', content: { text: 'Checking gas prices across all chains...', actions: ['GET_GAS_PRICES'] } },
      ],
    ],
  };
}
