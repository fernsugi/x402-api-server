import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { recoverTypedDataAddress } from 'viem';
import { x402ApiRequest } from '../dist/client.js';

const TEST_KEY = `0x${'22'.repeat(32)}`;
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PAY_TO = '0x60264c480b67adb557efEd22Cf0e7ceA792DefB7';

async function fakeApi(amount) {
  let proof;
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (!req.headers['x-payment']) {
      res.statusCode = 402;
      res.end(JSON.stringify({ accepts: [{ network: 'base', asset: USDC, payTo: PAY_TO,
        maxAmountRequired: amount, extra: { supportedProofs: ['eip3009_transferWithAuthorization'] } }] }));
    } else {
      proof = JSON.parse(Buffer.from(req.headers['x-payment'], 'base64').toString());
      res.end(JSON.stringify({ data: { ok: true } }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}`, proof: () => proof };
}

test('plugin signs the Base USDC challenge and enforces its cap', async () => {
  const api = await fakeApi('3000');
  try {
    const config = { baseUrl: api.baseUrl, walletPrivateKey: TEST_KEY };
    assert.deepEqual(await x402ApiRequest('/api/token-scanner', {}, config), { data: { ok: true } });
    const { signature, payload: { authorization: auth } } = api.proof();
    assert.equal(auth.value, '3000');
    const recovered = await recoverTypedDataAddress({
      domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: USDC },
      types: { TransferWithAuthorization: [
        { name: 'from', type: 'address' }, { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
      ] },
      primaryType: 'TransferWithAuthorization',
      message: { ...auth, value: BigInt(auth.value), validAfter: BigInt(auth.validAfter),
        validBefore: BigInt(auth.validBefore) },
      signature,
    });
    assert.equal(recovered.toLowerCase(), auth.from.toLowerCase());
  } finally {
    await new Promise(resolve => api.server.close(resolve));
  }

  const expensive = await fakeApi('10001');
  try {
    await assert.rejects(x402ApiRequest('/api/token-scanner', {},
      { baseUrl: expensive.baseUrl, walletPrivateKey: TEST_KEY }), /per-call cap/);
    assert.equal(expensive.proof(), undefined);
  } finally {
    await new Promise(resolve => expensive.server.close(resolve));
  }
});
