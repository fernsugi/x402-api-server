#!/usr/bin/env node

import { config as loadEnv } from 'dotenv';
import { wrapFetchWithPayment } from 'x402-fetch';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

loadEnv({ path: '.env.local', override: false, quiet: true });
loadEnv({ override: false, quiet: true });

const targetUrl = process.env.X402_TEST_URL || 'https://x402-api.fly.dev/api/price-feed';
const privateKey = process.env.X402_TEST_CLIENT_PRIVATE_KEY;
const rpcUrl = process.env.X402_TEST_RPC_URL;

if (!privateKey) {
  console.error('Missing X402_TEST_CLIENT_PRIVATE_KEY');
  console.error('Example: export X402_TEST_CLIENT_PRIVATE_KEY=0x...');
  process.exit(1);
}

if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  console.error('X402_TEST_CLIENT_PRIVATE_KEY must be 0x + 64 hex chars');
  process.exit(1);
}

const account = privateKeyToAccount(privateKey);
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(rpcUrl),
});

const fetchWithPayment = wrapFetchWithPayment(fetch, walletClient);

console.log(`[x402 test] target: ${targetUrl}`);
console.log(`[x402 test] payer: ${account.address}`);

try {
  const response = await fetchWithPayment(targetUrl);
  const bodyText = await response.text();
  const paymentResponse = response.headers.get('x-payment-response');

  console.log(`[x402 test] status: ${response.status}`);

  if (paymentResponse) {
    console.log(`[x402 test] x-payment-response: ${paymentResponse}`);
    try {
      const parsed = JSON.parse(paymentResponse);
      if (parsed.txHash) {
        console.log(`[x402 test] settlement tx hash: ${parsed.txHash}`);
      }
    } catch {
      // Leave the raw header output above; it is still useful.
    }
  }

  try {
    const parsedBody = JSON.parse(bodyText);
    console.log(JSON.stringify(parsedBody, null, 2));
  } catch {
    console.log(bodyText);
  }

  if (!response.ok) {
    process.exit(1);
  }
} catch (err) {
  console.error('[x402 test] request failed:', err?.message || err);
  process.exit(1);
}
