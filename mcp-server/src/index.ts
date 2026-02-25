#!/usr/bin/env node
/**
 * @x402-api/mcp-server
 *
 * MCP (Model Context Protocol) server that wraps Sugi's x402 DeFi API.
 * Gives Claude, ChatGPT, and any MCP-compatible AI agent access to
 * pay-per-call crypto/DeFi data endpoints.
 *
 * ## x402 Payment Protocol
 *
 * Every endpoint costs a small USDC micropayment (0.001–0.008 USDC).
 * Two modes:
 *
 * 1. **Auto-pay mode** — Set X402_WALLET_PRIVATE_KEY env var.
 *    x402-fetch handles the payment automatically. The agent just calls
 *    the tool and gets data.
 *
 * 2. **Manual mode** — No private key set. The tool returns 402 payment
 *    instructions so you (or the agent) can see what's needed.
 *
 * ## Setup
 *
 *   export X402_WALLET_PRIVATE_KEY=0x...your_private_key...
 *   npx @x402-api/mcp-server
 *
 * Or in your Claude Desktop config:
 *   { "command": "npx", "args": ["@x402-api/mcp-server"] }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.X402_API_BASE_URL || 'https://x402-api.fly.dev';
const WALLET_PRIVATE_KEY = process.env.X402_WALLET_PRIVATE_KEY;
const SERVER_VERSION = '1.0.0';

// ─── x402-aware fetch ─────────────────────────────────────────────────────────

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

let _fetchFn: FetchFn | null = null;

/**
 * Returns a fetch function that auto-handles x402 payments if a wallet
 * private key is configured. Falls back to standard fetch otherwise.
 */
async function getX402Fetch(): Promise<FetchFn> {
  if (_fetchFn) return _fetchFn;

  if (WALLET_PRIVATE_KEY) {
    try {
      // Dynamic imports for optional dependencies (x402-fetch, viem)
      const dynImport = new Function('m', 'return import(m)') as
        (m: string) => Promise<Record<string, unknown>>;

      const x402Module = await dynImport('x402-fetch').catch(() => null);

      if (x402Module?.wrapFetchWithPayment) {
        const viemModule = await dynImport('viem');
        const viemAccounts = await dynImport('viem/accounts');
        const viemChains = await dynImport('viem/chains');

        const privateKeyToAccount = viemAccounts['privateKeyToAccount'] as
          (key: `0x${string}`) => { address: string };
        const createWalletClient = viemModule['createWalletClient'] as
          (opts: unknown) => unknown;
        const http = viemModule['http'] as () => unknown;
        const base = viemChains['base'];

        const account = privateKeyToAccount(WALLET_PRIVATE_KEY as `0x${string}`);
        const walletClient = createWalletClient({
          account,
          chain: base,
          transport: http(),
        });

        const wrapFetch = x402Module['wrapFetchWithPayment'] as
          (fetchFn: typeof fetch, signer: unknown) => FetchFn;
        _fetchFn = wrapFetch(fetch, walletClient);
        process.stderr.write(`[x402-mcp] Auto-pay enabled. Wallet: ${account.address}\n`);
        return _fetchFn!;
      }
    } catch (err) {
      process.stderr.write(
        `[x402-mcp] Warning: X402_WALLET_PRIVATE_KEY is set but x402-fetch/viem ` +
        `are not installed. Falling back to manual mode.\n` +
        `  Run: npm install x402-fetch viem\n`
      );
    }
  }

  // Standard fetch — 402s will surface as payment instruction responses
  _fetchFn = fetch as unknown as FetchFn;
  return _fetchFn;
}

// ─── API Request Helper ───────────────────────────────────────────────────────

interface ApiResponse {
  status: number;
  data: unknown;
  paymentRequired?: boolean;
  paymentDetails?: unknown;
}

async function callApi(
  endpoint: string,
  params: Record<string, string | number | undefined> = {}
): Promise<ApiResponse> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const fetchFn = await getX402Fetch();

  let response: Response;
  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), 30_000);
  try {
    response = await fetchFn(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': `x402-api-mcp/${SERVER_VERSION}`,
      },
      signal: controller.signal,
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    throw new McpError(
      ErrorCode.InternalError,
      isTimeout
        ? `Request to ${endpoint} timed out after 30 seconds`
        : `Network error calling ${endpoint}: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(fetchTimeout);
  }

  if (response.status === 402) {
    // Clone before reading so we can fall back to text() if JSON parsing fails.
    // Without the clone, calling response.json() consumes the body; a subsequent
    // response.text() call then throws "body already used".
    const cloned = response.clone();
    let paymentDetails: unknown;
    try {
      paymentDetails = await response.json();
    } catch {
      paymentDetails = await cloned.text();
    }
    return { status: 402, data: null, paymentRequired: true, paymentDetails };
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 400 || response.status === 422) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid request to ${endpoint}: ${errorText}`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      `API error ${response.status} from ${endpoint}: ${errorText}`
    );
  }

  const data = await response.json();
  return { status: response.status, data };
}

/**
 * Format a successful API response or payment instructions.
 */
function formatResult(result: ApiResponse, toolName: string): string {
  if (result.paymentRequired) {
    const details = result.paymentDetails as Record<string, unknown> | null;
    const accepts = details?.accepts as Array<Record<string, unknown>> | undefined;
    const first = accepts?.[0];

    let message = `## Payment Required — ${toolName}\n\n`;
    message += `This endpoint requires a USDC micropayment on Base network.\n\n`;

    if (first) {
      const amountRaw = Number(first.maxAmountRequired ?? 0);
      const amountUsdc = (amountRaw / 1_000_000).toFixed(6);
      message += `**Cost:** ${amountUsdc} USDC\n`;
      message += `**Pay to:** \`${first.payTo}\`\n`;
      message += `**Network:** Base mainnet (chain ID 8453)\n`;
      message += `**Asset:** USDC (\`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`)\n\n`;
    }

    message += `### To enable automatic payments:\n\n`;
    message += `1. Install dependencies:\n`;
    message += `   \`\`\`bash\n   npm install x402-fetch viem\n   \`\`\`\n\n`;
    message += `2. Set your wallet private key:\n`;
    message += `   \`\`\`bash\n   export X402_WALLET_PRIVATE_KEY=0x...\n   \`\`\`\n\n`;
    message += `3. Restart the MCP server.\n\n`;
    message += `### To pay manually:\n\n`;
    message += `1. Send USDC to the address above on Base (chain ID 8453).\n`;
    message += `2. Encode the payment as Base64 JSON and send it as the \`X-Payment\` header:\n\n`;
    message += `   \`\`\`js\n`;
    message += `   // After sending the transaction on-chain:\n`;
    message += `   const payment = Buffer.from(JSON.stringify({ txHash: "0x<your_tx_hash>", payer: "0x<your_wallet_address>" })).toString("base64");\n`;
    message += `   // Then set the header: X-Payment: <payment>\n`;
    message += `   \`\`\`\n\n`;
    message += `   Or for EIP-3009 transferWithAuthorization (advanced):\n\n`;
    message += `   \`\`\`js\n`;
    message += `   const payment = Buffer.from(JSON.stringify({\n`;
    message += `     signature: "0x...",\n`;
    message += `     payload: {\n`;
    message += `       authorization: {\n`;
    message += `         from: "0x<your_wallet>",\n`;
    message += `         to: "0x<payTo_address>",\n`;
    message += `         value: "<amount_in_micro_usdc>",\n`;
    message += `         validAfter: "0",\n`;
    message += `         validBefore: "<unix_timestamp>",\n`;
    message += `         nonce: "0x<random_32_bytes>"\n`;
    message += `       }\n`;
    message += `     }\n`;
    message += `   })).toString("base64");\n`;
    message += `   \`\`\`\n\n`;
    message += `   **Note:** The \`X-Payment\` header must be Base64-encoded JSON — raw transaction hashes are not accepted.\n\n`;
    message += `---\n**Raw 402 response:**\n\`\`\`json\n`;
    message += JSON.stringify(result.paymentDetails, null, 2);
    message += `\n\`\`\``;

    return message;
  }

  return JSON.stringify(result.data, null, 2);
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_crypto_prices',
    description:
      'Get live cryptocurrency prices and top 24h movers. Returns BTC, ETH, SOL prices plus top gainers/losers. ' +
      'Costs 0.001 USDC per call (x402 micropayment on Base). ' +
      'Data sourced live from CoinGecko.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_gas_prices',
    description:
      'Get current gas prices across multiple chains: Ethereum, Base, Polygon, and Arbitrum. ' +
      'Returns slow/standard/fast tiers in gwei and estimated USD cost. ' +
      'Costs 0.001 USDC per call (x402 micropayment on Base).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_dex_quotes',
    description:
      'Compare swap quotes across DEXes: Uniswap, SushiSwap, and 1inch. ' +
      'Returns best price, price impact, liquidity, and estimated fees for each venue. ' +
      'Costs 0.002 USDC per call (x402 micropayment on Base).',
    inputSchema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Input token symbol or address (e.g. "ETH", "USDC", "0x...")',
        },
        to: {
          type: 'string',
          description: 'Output token symbol or address (e.g. "USDC", "DAI", "0x...")',
        },
        amount: {
          type: 'string',
          description: 'Amount to swap (e.g. "1.5" for 1.5 ETH)',
        },
        chain: {
          type: 'string',
          description: 'Chain to query (e.g. "ethereum", "base", "arbitrum"). Defaults to "ethereum".',
        },
      },
      required: ['from', 'to', 'amount'],
    },
  },
  {
    name: 'scan_token',
    description:
      'Perform a security scan on a token contract. Detects rug-pull risks, honeypot patterns, ' +
      'ownership concentration, mint authority, and other red flags. ' +
      'Costs 0.003 USDC per call (x402 micropayment on Base).',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Token contract address (0x...) or symbol (e.g. "PEPE", "UNI")',
        },
        chain: {
          type: 'string',
          description: 'Chain to scan on (e.g. "ethereum", "base", "arbitrum", "polygon"). Defaults to "ethereum".',
        },
      },
      required: ['token'],
    },
  },
  {
    name: 'track_whales',
    description:
      'Analyze whale activity and holder concentration for a token. Returns top holders, ' +
      'Gini coefficient, whale alerts (large recent buys/sells), and distribution breakdown. ' +
      'Costs 0.005 USDC per call (x402 micropayment on Base).',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Token contract address (0x...) or symbol (e.g. "ETH", "PEPE")',
        },
        chain: {
          type: 'string',
          description: 'Chain to query (e.g. "ethereum", "base", "solana", "arbitrum"). Defaults to "ethereum".',
        },
      },
      required: ['token'],
    },
  },
  {
    name: 'scan_yields',
    description:
      'Scan top DeFi yield opportunities across protocols: Aave, Compound, Morpho, Lido, Pendle, and more. ' +
      'Filter by chain, asset, and minimum TVL. Returns APY, TVL, risk score, and protocol details. ' +
      'Costs 0.005 USDC per call (x402 micropayment on Base).',
    inputSchema: {
      type: 'object',
      properties: {
        chain: {
          type: 'string',
          description:
            'Blockchain to filter by (e.g. "ethereum", "base", "arbitrum", "polygon"). ' +
            'Omit for all chains.',
        },
        asset: {
          type: 'string',
          description: 'Filter by asset symbol (e.g. "ETH", "USDC", "stETH"). Omit for all assets.',
        },
        min_tvl: {
          type: 'number',
          description: 'Minimum TVL in USD (e.g. 1000000 for $1M). Omit for no minimum.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (1–50). Defaults to 20.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_funding_rates',
    description:
      'Get perpetual futures funding rates across 6 venues: Hyperliquid, dYdX v4, Aevo, GMX, Drift, and Vertex. ' +
      'Returns per-8h funding rate, annualized APR, predicted rate, open interest, and next funding time for each venue. ' +
      'Also returns ranked arbitrage opportunities (long low-rate venue, short high-rate venue) with spread in bps and annualized carry. ' +
      'Costs 0.008 USDC per call (x402 micropayment on Base).',
    inputSchema: {
      type: 'object',
      properties: {
        asset: {
          type: 'string',
          description: 'Asset symbol (e.g. "BTC", "ETH", "SOL"). Returns all assets if omitted.',
        },
        min_spread: {
          type: 'number',
          description: 'Filter for arbitrage spreads >= N basis points (e.g. 0.5). Omit for no filter.',
        },
      },
      required: [],
    },
  },
  {
    name: 'profile_wallet',
    description:
      'Generate a full portfolio profile for an Ethereum/Base wallet address. ' +
      'Returns token holdings, NFTs, DeFi positions, transaction history summary, ' +
      'PnL estimate, and risk profile score. ' +
      'Costs 0.008 USDC per call (x402 micropayment on Base).',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Ethereum or Base wallet address (0x...)',
        },
        chain: {
          type: 'string',
          description: 'Filter by chain (e.g. "ethereum", "base", "arbitrum", "polygon"). Defaults to "all".',
        },
      },
      required: ['address'],
    },
  },
];

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'x402-api-mcp',
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const params = (args ?? {}) as Record<string, string | number | undefined>;

  let result: ApiResponse;

  switch (name) {
    case 'get_crypto_prices':
      result = await callApi('/api/price-feed');
      break;

    case 'get_gas_prices':
      result = await callApi('/api/gas-tracker');
      break;

    case 'get_dex_quotes':
      if (!params.from || !params.to || !params.amount) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'get_dex_quotes requires: from, to, amount'
        );
      }
      result = await callApi('/api/dex-quotes', {
        from: params.from,
        to: params.to,
        amount: params.amount,
        chain: params.chain,
      });
      break;

    case 'scan_token':
      if (!params.token) {
        throw new McpError(ErrorCode.InvalidParams, 'scan_token requires: token');
      }
      result = await callApi('/api/token-scanner', {
        token: params.token,
        chain: params.chain,
      });
      break;

    case 'track_whales':
      if (!params.token) {
        throw new McpError(ErrorCode.InvalidParams, 'track_whales requires: token');
      }
      result = await callApi('/api/whale-tracker', {
        token: params.token,
        chain: params.chain,
      });
      break;

    case 'scan_yields':
      result = await callApi('/api/yield-scanner', {
        chain: params.chain,
        asset: params.asset,
        min_tvl: params.min_tvl,
        limit: params.limit,
      });
      break;

    case 'get_funding_rates':
      result = await callApi('/api/funding-rates', {
        asset: params.asset,
        min_spread: params.min_spread,
      });
      break;

    case 'profile_wallet':
      if (!params.address) {
        throw new McpError(ErrorCode.InvalidParams, 'profile_wallet requires: address');
      }
      result = await callApi('/api/wallet-profiler', {
        address: params.address,
        chain: params.chain,
      });
      break;

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }

  const text = formatResult(result, name);

  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
    isError: false,
  };
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const payMode = WALLET_PRIVATE_KEY
    ? 'AUTO-PAY (x402-fetch)'
    : 'MANUAL (returns 402 payment instructions)';

  process.stderr.write(
    `[x402-mcp] Server started\n` +
    `[x402-mcp] API: ${API_BASE_URL}\n` +
    `[x402-mcp] Payment mode: ${payMode}\n` +
    `[x402-mcp] Tools: ${TOOLS.map((t) => t.name).join(', ')}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[x402-mcp] Fatal error: ${err}\n`);
  process.exit(1);
});
