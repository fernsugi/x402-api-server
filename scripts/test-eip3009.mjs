#!/usr/bin/env node

// Controlled mainnet smoke test for this API's JSON x402 v1 challenge.
// This script spends real Base USDC only when explicitly invoked with a key.
import { randomBytes } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { privateKeyToAccount } from 'viem/accounts';

loadEnv({ path: '.env.local', override: false, quiet: true });
loadEnv({ override: false, quiet: true });

const targetUrl = process.env.X402_TEST_URL || 'https://x402-api.fly.dev/api/price-feed';
const privateKey = process.env.X402_TEST_CLIENT_PRIVATE_KEY;
const expectedPayTo = (process.env.PAY_TO_ADDRESS || '0x60264c480b67adb557efEd22Cf0e7ceA792DefB7').toLowerCase();
const baseUsdc = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const maxUsdc = Number(process.env.X402_TEST_MAX_USDC || '0.01');

if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  console.error('Set X402_TEST_CLIENT_PRIVATE_KEY to a dedicated 0x-prefixed Base wallet key.');
  process.exit(1);
}
if (!Number.isFinite(maxUsdc) || maxUsdc <= 0 || maxUsdc > 0.01) {
  console.error('X402_TEST_MAX_USDC must be greater than zero and no more than 0.01.');
  process.exit(1);
}
const url = new URL(targetUrl);
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
  console.error('Remote test URL must use HTTPS.');
  process.exit(1);
}

const account = privateKeyToAccount(privateKey);
console.log(`[x402 test] target: ${url}`);
console.log(`[x402 test] payer: ${account.address}`);

try {
  const challengeResponse = await fetch(url);
  if (challengeResponse.status !== 402) {
    throw new Error(`Expected a 402 payment challenge; got HTTP ${challengeResponse.status}`);
  }
  const challenge = await challengeResponse.json();
  const offer = challenge.accepts?.find(item =>
    item.network === 'base' &&
    item.asset?.toLowerCase() === baseUsdc.toLowerCase() &&
    item.payTo?.toLowerCase() === expectedPayTo &&
    item.extra?.supportedProofs?.includes('eip3009_transferWithAuthorization')
  );
  if (!offer) throw new Error('No compatible Base USDC EIP-3009 offer for the expected recipient.');

  const value = BigInt(offer.maxAmountRequired);
  if (value <= 0n || value > BigInt(Math.floor(maxUsdc * 1_000_000))) {
    throw new Error(`Challenge exceeds test payment cap of ${maxUsdc} USDC.`);
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
    domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: baseUsdc },
    types: { TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ] },
    primaryType: 'TransferWithAuthorization',
    message: authorization,
  });
  const payment = Buffer.from(JSON.stringify({
    signature,
    payload: { authorization: {
      ...authorization,
      value: value.toString(),
      validAfter: authorization.validAfter.toString(),
      validBefore: authorization.validBefore.toString(),
    } },
  })).toString('base64');
  const response = await fetch(url, { headers: { 'X-Payment': payment } });
  console.log(`[x402 test] status: ${response.status}`);
  const settlement = response.headers.get('x-payment-response');
  if (settlement) console.log(`[x402 test] settlement: ${settlement}`);
  const bodyText = await response.text();
  try { console.log(JSON.stringify(JSON.parse(bodyText), null, 2)); }
  catch { console.log(bodyText); }
  if (!response.ok) process.exitCode = 1;
} catch (err) {
  console.error('[x402 test] request failed:', err?.message || err);
  process.exitCode = 1;
}
