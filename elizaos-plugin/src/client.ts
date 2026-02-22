/**
 * x402 API Client
 *
 * Handles HTTP requests to the x402 DeFi API with x402 payment support.
 *
 * ## Payment Flow
 *
 * The x402 API uses the HTTP 402 Payment Required protocol:
 * 1. Agent makes a request
 * 2. Server returns 402 with payment details (amount, token, payTo address)
 * 3. Agent pays via USDC on Base
 * 4. Agent retries with payment proof header (X-PAYMENT)
 * 5. Server validates payment and returns data
 *
 * ## Setup Options
 *
 * ### Option A: x402-fetch (Recommended for autonomous agents)
 * Install x402-fetch and configure your wallet private key.
 * The client will auto-handle the 402 flow transparently.
 *
 * ### Option B: Pre-authorized fetch
 * If you have a pre-authorized session token from the x402 facilitator.
 *
 * ### Option C: Manual (for testing)
 * Just make the request — you'll get the 402 details to handle manually.
 */

export const X402_API_BASE_URL = 'https://x402-api.fly.dev';

export interface X402ClientConfig {
  /**
   * Base URL for the x402 API.
   * @default 'https://x402-api.fly.dev'
   */
  baseUrl?: string;

  /**
   * Wallet private key for automatic x402 payment handling.
   * Required for autonomous payment. Keep this in your .env file!
   * Used with x402-fetch to auto-pay 402 responses.
   */
  walletPrivateKey?: string;

  /**
   * Your wallet address (for display/logging purposes).
   */
  walletAddress?: string;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeoutMs?: number;
}

export type FetchWithX402 = (url: string | URL, init?: RequestInit) => Promise<Response>;

let cachedFetch: FetchWithX402 | null = null;

/**
 * Get a fetch function that handles x402 payments.
 *
 * If x402-fetch is installed and a wallet private key is provided,
 * returns an auto-paying fetch. Otherwise returns standard fetch.
 */
async function getX402Fetch(config: X402ClientConfig): Promise<FetchWithX402> {
  if (cachedFetch) return cachedFetch;

  if (config.walletPrivateKey) {
    try {
      // Try to load x402-fetch for automatic payment handling.
      // Using dynamic require via Function to avoid TypeScript's static analysis
      // of optional peer dependencies (x402-fetch, viem) which may not be installed.
      const requireDynamic = new Function('m', 'return import(m)') as
        (mod: string) => Promise<Record<string, unknown>>;

      const x402Module = await requireDynamic('x402-fetch').catch(() => null);
      if (x402Module?.wrapFetchWithPayment) {
        const viemModule = await requireDynamic('viem');
        const viemAccounts = await requireDynamic('viem/accounts');
        const viemChains = await requireDynamic('viem/chains');

        const privateKeyToAccount = viemAccounts['privateKeyToAccount'] as
          (key: `0x${string}`) => { address: string };
        const createWalletClient = viemModule['createWalletClient'] as
          (opts: unknown) => unknown;
        const http = viemModule['http'] as () => unknown;
        const base = viemChains['base'];

        const account = privateKeyToAccount(config.walletPrivateKey as `0x${string}`);
        const walletClient = createWalletClient({ account, chain: base, transport: http() });

        const wrapFetch = x402Module['wrapFetchWithPayment'] as
          (fetchFn: typeof fetch, signer: unknown) => FetchWithX402;
        cachedFetch = wrapFetch(fetch, walletClient);
        console.log('[x402-plugin] Using x402-fetch with wallet:', account.address);
        return cachedFetch!;
      }
    } catch {
      // x402-fetch or viem not installed, fall through to standard fetch
    }
  }

  // Standard fetch — will return 402 if payment not configured
  cachedFetch = fetch as FetchWithX402;
  return cachedFetch;
}

/**
 * Make a request to the x402 API.
 *
 * @param endpoint - API endpoint path (e.g. '/api/price-feed')
 * @param params - Query parameters
 * @param config - Client configuration
 * @returns Parsed JSON response
 * @throws Error with helpful message on 402 (payment required) or other errors
 */
export async function x402ApiRequest<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  config: X402ClientConfig = {}
): Promise<T> {
  const baseUrl = config.baseUrl || X402_API_BASE_URL;

  // Build URL with query params
  const url = new URL(`${baseUrl}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const fetchFn = await getX402Fetch(config);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 30_000);

  try {
    const response = await fetchFn(url.toString(), {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ElizaOS-x402-plugin/1.0',
      },
    });

    if (response.status === 402) {
      // Payment required — x402-fetch should have handled this automatically
      // If we reach here, it means x402-fetch is not configured
      let paymentDetails = '';
      try {
        const body = await response.json();
        paymentDetails = JSON.stringify(body, null, 2);
      } catch {
        paymentDetails = await response.text();
      }

      throw new Error(
        `x402 Payment Required for ${endpoint}\n\n` +
        `To enable automatic payments:\n` +
        `1. Install x402-fetch: npm install x402-fetch viem\n` +
        `2. Set X402_WALLET_PRIVATE_KEY in your .env file\n` +
        `3. Add walletPrivateKey to plugin config\n\n` +
        `Payment details:\n${paymentDetails}`
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extract key information from a message for API parameters.
 * Parses natural language to extract token symbols, addresses, chains, etc.
 */
export function extractParams(text: string): Record<string, string> {
  const params: Record<string, string> = {};

  // Extract Ethereum address
  const addressMatch = text.match(/0x[0-9a-fA-F]{40}/);
  if (addressMatch) params.address = addressMatch[0];

  // Extract chain name
  const chainMatch = text.match(/\b(ethereum|base|arbitrum|polygon|solana|optimism)\b/i);
  if (chainMatch) params.chain = chainMatch[1].toLowerCase();

  // Extract token symbols (2-6 uppercase letters, common patterns)
  const tokenMatch = text.match(/\b([A-Z]{2,6})\b/);
  if (tokenMatch && !['GET', 'THE', 'FOR', 'AND', 'ETH', 'BTC', 'SOL'].includes(tokenMatch[1])) {
    // Prefer specific DeFi tokens
    const defiTokenMatch = text.match(/\b(BTC|ETH|SOL|USDC|USDT|DAI|LINK|UNI|AAVE|ARB|OP|PEPE|SHIB|DOGE|stETH|rETH|sUSDe|sDAI)\b/i);
    if (defiTokenMatch) params.token = defiTokenMatch[1].toUpperCase();
  }

  // Extract amounts
  const amountMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:eth|btc|sol|usdc|token)?/i);
  if (amountMatch) params.amount = amountMatch[1];

  return params;
}
