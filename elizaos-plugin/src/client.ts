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
 * ### Option A: Automatic EIP-3009 payment
 * Install viem and configure your wallet private key.
 * The client signs the API's Base USDC 402 challenge, within a per-call cap.
 *
 * ### Option B: Pre-authorized fetch
 * If you have a pre-authorized session token from the x402 facilitator.
 *
 * ### Option C: Manual (for testing)
 * Just make the request — you'll get the 402 details to handle manually.
 */

import { randomBytes } from 'node:crypto';

export const X402_API_BASE_URL = 'https://x402-api.fly.dev';
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export interface X402ClientConfig {
  /**
   * Base URL for the x402 API.
   * @default 'https://x402-api.fly.dev'
   */
  baseUrl?: string;

  /**
   * Wallet private key for automatic x402 payment handling.
   * Required for autonomous payment. Keep this in your .env file!
   * Used with viem to sign EIP-3009 authorizations for Base USDC.
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
  /** Upper bound for one automatic API payment. Defaults to 0.01 USDC. */
  maxPerCallUsd?: number;
}

export type FetchWithX402 = (url: string | URL, init?: RequestInit) => Promise<Response>;

// A single process can host multiple agents with different wallets. Cache per
// config object so one agent cannot accidentally reuse another agent's signer.
const fetchCache = new WeakMap<X402ClientConfig, { walletPrivateKey: string; fetch: FetchWithX402 }>();

/**
 * Get a fetch function that handles x402 payments.
 *
 * If viem is installed and a wallet private key is provided,
 * returns an auto-paying fetch. Otherwise returns standard fetch.
 */
async function getX402Fetch(config: X402ClientConfig): Promise<FetchWithX402> {
  const cached = fetchCache.get(config);
  if (cached && cached.walletPrivateKey === config.walletPrivateKey) return cached.fetch;
  if (!config.walletPrivateKey) return fetch as FetchWithX402;

  try {
    const dynamicImport = new Function('m', 'return import(m)') as
      (mod: string) => Promise<Record<string, unknown>>;
    const accounts = await dynamicImport('viem/accounts');
    const privateKeyToAccount = accounts['privateKeyToAccount'] as
      (key: `0x${string}`) => {
        address: string;
        signTypedData: (data: unknown) => Promise<string>;
      };
    const account = privateKeyToAccount(config.walletPrivateKey as `0x${string}`);
    const cap = config.maxPerCallUsd ?? 0.01;
    if (!Number.isFinite(cap) || cap <= 0) throw new Error('Invalid maxPerCallUsd');

    const payingFetch: FetchWithX402 = async (url, init) => {
      const first = await fetch(url, init);
      if (first.status !== 402) return first;
      const challenge = await first.clone().json() as {
        accepts?: Array<{ network: string; asset: string; payTo: string;
          maxAmountRequired: string; extra?: { supportedProofs?: string[] } }>;
      };
      const offer = challenge.accepts?.find(item => item.network === 'base' &&
        item.asset?.toLowerCase() === BASE_USDC.toLowerCase());
      if (!offer?.extra?.supportedProofs?.includes('eip3009_transferWithAuthorization')) return first;
      if (!/^0x[0-9a-fA-F]{40}$/.test(offer.payTo)) throw new Error('Invalid payment recipient');
      const value = BigInt(offer.maxAmountRequired);
      if (value <= 0n || value > BigInt(Math.floor(cap * 1_000_000))) {
        throw new Error(`Payment exceeds per-call cap of ${cap} USDC`);
      }
      const now = Math.floor(Date.now() / 1000);
      const authorization = {
        from: account.address,
        to: offer.payTo,
        value,
        validAfter: 0n,
        validBefore: BigInt(now + 60),
        nonce: `0x${randomBytes(32).toString('hex')}`,
      };
      const signature = await account.signTypedData({
        domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: BASE_USDC },
        types: { TransferWithAuthorization: [
          { name: 'from', type: 'address' }, { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
        ] },
        primaryType: 'TransferWithAuthorization',
        message: authorization,
      });
      const payment = Buffer.from(JSON.stringify({ signature, payload: { authorization: {
        ...authorization,
        value: value.toString(),
        validAfter: authorization.validAfter.toString(),
        validBefore: authorization.validBefore.toString(),
      } } })).toString('base64');
      const headers = new Headers(init?.headers);
      headers.set('X-Payment', payment);
      return fetch(url, { ...init, headers });
    };
    fetchCache.set(config, { walletPrivateKey: config.walletPrivateKey, fetch: payingFetch });
    return payingFetch;
  } catch (error) {
    throw new Error(`Automatic payment setup failed: ${(error as Error).message}. Install viem and check the wallet key.`);
  }
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
      // Payment required — the payment helper should have handled this automatically
      // If we reach here, it means EIP-3009 settlement is not configured or a wallet key is missing
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
        `1. Install viem: npm install viem\n` +
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
