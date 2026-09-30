#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const workflows = JSON.parse(readFileSync(new URL('../src/workflows.json', import.meta.url)));
const examples = JSON.parse(readFileSync(new URL('../src/endpoint-examples.json', import.meta.url)));
const PAYEE = '0x60264c480b67adb557efEd22Cf0e7ceA792DefB7';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export function validateOffer(body, remaining, expected = PAYEE) {
  if (body.x402Version !== 1) throw new Error('Expected x402 v1 challenge.');
  const offer = body.accepts?.find(x => x.scheme === 'exact' && x.network === 'base' && x.asset?.toLowerCase() === USDC.toLowerCase() && x.payTo?.toLowerCase() === expected.toLowerCase() && x.extra?.supportedProofs?.includes('eip3009_transferWithAuthorization'));
  if (!offer || !/^\d+$/.test(offer.maxAmountRequired)) throw new Error('No supported Base USDC offer for the expected recipient.');
  const amount = BigInt(offer.maxAmountRequired);
  if (amount <= 0n || amount > remaining) throw new Error('Offer exceeds remaining total budget.');
  return { offer, amount };
}

export async function runWorkflow(workflow, { base = 'https://x402-api.fly.dev', pay = false, cap, account, fetchFn = fetch, source = 'github', log = console.log } = {}) {
  const origin = new URL(base);
  if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname)) throw new Error('Remote base URL must use HTTPS.');
  let remaining = BigInt(cap ?? workflow.price_micro);
  if (remaining < BigInt(workflow.price_micro) || remaining > 100000n) throw new Error('Total cap must cover the workflow and stay at or below 0.10 USDC.');
  if (pay && !account) throw new Error('Pay mode requires a dedicated client wallet.');
  log(`${workflow.title} | ${pay ? 'PAY' : 'INSPECT: no signing or spending'} | cap ${Number(remaining) / 1e6} USDC`);
  const results = [];
  for (const step of workflow.steps) {
    const url = new URL(step.url, origin);
    if (url.origin !== origin.origin) throw new Error('Cross-origin workflow step refused.');
    const headers = { 'Accept': 'application/json', 'X-X402-Source': source, 'User-Agent': 'x402-workflow-demo/1.0' };
    const request = extra => fetchFn(url, { headers: { ...headers, ...extra }, signal: AbortSignal.timeout(60000), redirect: 'error' });
    const challenge = await request({});
    if (challenge.status !== 402) throw new Error(`${step.name}: expected HTTP 402, got ${challenge.status}. No payment sent.`);
    const { offer, amount } = validateOffer(await challenge.json(), remaining);
    if (amount !== BigInt(step.price_micro)) throw new Error('Advertised price changed; refusing payment.');
    log(`${step.name}: ${Number(amount) / 1e6} USDC, Base, ${offer.extra.settlementMode || 'EIP-3009'}`);
    if (!pay) { results.push({ step: step.name, status: 402, price_micro: amount.toString() }); continue; }
    const auth = { from: account.address, to: offer.payTo, value: amount, validAfter: 0n, validBefore: BigInt(Math.floor(Date.now() / 1000) + 60), nonce: `0x${randomBytes(32).toString('hex')}` };
    const signature = await account.signTypedData({ domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: USDC }, types: { TransferWithAuthorization: [{name:'from',type:'address'},{name:'to',type:'address'},{name:'value',type:'uint256'},{name:'validAfter',type:'uint256'},{name:'validBefore',type:'uint256'},{name:'nonce',type:'bytes32'}] }, primaryType: 'TransferWithAuthorization', message: auth });
    const payment = Buffer.from(JSON.stringify({ signature, payload: { authorization: { ...auth, value: amount.toString(), validAfter: '0', validBefore: auth.validBefore.toString() } } })).toString('base64');
    remaining -= amount; // Reserve before network I/O; ambiguous timeouts never retry spending.
    const response = await request({ 'X-Payment': payment });
    const body = await response.json();
    if (!response.ok) throw new Error(`${step.name}: paid request HTTP ${response.status}; stop and inspect settlement. No automatic retry.`);
    const settlement = response.headers.get('x-payment-response');
    log(JSON.stringify({ step: step.name, status: response.status, settlement: settlement ? JSON.parse(settlement) : null, data: body }, null, 2));
    results.push({ step: step.name, status: response.status, data: body });
  }
  log(workflow.limits);
  return results;
}

async function main() {
  const id = process.argv[2] || 'token-check';
  const workflow = id === 'all-endpoints' ? { id, title: 'Verify all eight endpoints', price_micro: 33000, steps: Object.entries(examples).map(([route,url]) => ({ name:route, url, price_micro: ({'/api/price-feed':1000,'/api/gas-tracker':1000,'/api/dex-quotes':2000,'/api/token-scanner':3000,'/api/whale-tracker':5000,'/api/funding-rates':8000,'/api/yield-scanner':5000,'/api/wallet-profiler':8000})[route] })), limits:'Provider coverage varies. This run is operator testing, not customer revenue.' } : workflows.find(x => x.id === id);
  if (!workflow) throw new Error(`Choose ${workflows.map(x => x.id).join(', ')} or all-endpoints.`);
  const pay = process.argv.includes('--pay');
  let account;
  if (pay) {
    const { config } = await import('dotenv'); config({ path: '.env.local', quiet: true });
    const key = process.env.X402_TEST_CLIENT_PRIVATE_KEY;
    if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('Set X402_TEST_CLIENT_PRIVATE_KEY locally to a dedicated Base USDC wallet; do not use the operator settlement key.');
    const { privateKeyToAccount } = await import('viem/accounts'); account = privateKeyToAccount(key);
  }
  const capUsdc = process.env.X402_DEMO_MAX_USDC;
  const cap = capUsdc === undefined ? undefined : /^\d+(\.\d{1,6})?$/.test(capUsdc) ? BigInt(Math.round(Number(capUsdc) * 1e6)) : -1n;
  await runWorkflow(workflow, { base: process.env.X402_API_BASE_URL, pay, cap, account, source: id === 'all-endpoints' ? 'test' : 'github' });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(err => { console.error(err.message); process.exitCode = 1; });
