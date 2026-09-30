'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { extractDiscoveryInfoV1 } = require('@x402/extensions/bazaar');

async function unusedPort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function startServer(env) {
  const port = await unusedPort();
  const child = spawn(process.execPath, [path.join(__dirname, '../src/index.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), ...env },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`API exited: ${child.exitCode}`);
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return { child, base };
    } catch { /* startup pending */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  child.kill();
  throw new Error('API did not start');
}

async function stopServer(child) {
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
}

test('provider failure never asks for payment, valid live data does', async () => {
  let upstreamStatus = 503;
  let requests = 0;
  const upstream = http.createServer((_req, res) => {
    requests++;
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = upstreamStatus;
    res.end(upstreamStatus === 200 ? JSON.stringify({
      bitcoin: { usd: 100000 }, ethereum: { usd: 2000 }, solana: { usd: 100 },
    }) : JSON.stringify({ error: 'upstream down' }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const api = await startServer({
    COINGECKO_API_BASE: `http://127.0.0.1:${upstream.address().port}`,
    COINLORE_API_BASE: `http://127.0.0.1:${upstream.address().port}`,
  });
  try {
    const failed = await fetch(`${api.base}/api/price-feed`, { headers: { 'X-Payment': 'mock' } });
    assert.equal(failed.status, 503);
    assert.equal((await failed.json()).error, 'Live data unavailable');
    assert.equal(failed.headers.get('X-Payment-Response'), null);

    upstreamStatus = 200;
    const challenge = await fetch(`${api.base}/api/price-feed`);
    assert.equal(challenge.status, 402);
    const requirements = (await challenge.json()).accepts[0];
    assert.equal(requirements.maxAmountRequired, '1000');
    const discovery = extractDiscoveryInfoV1(requirements);
    assert.equal(discovery.input.method, 'GET');
    assert.equal(discovery.output.example.source, 'CoinGecko');
    const paid = await fetch(`${api.base}/api/price-feed`, { headers: { 'X-Payment': 'mock' } });
    assert.equal(paid.status, 200);
    assert.equal((await paid.json()).data.core.length, 3);
    assert.equal(requests, 3, 'both failed providers are checked, then success is cached');
  } finally {
    await stopServer(api.child);
    await new Promise(resolve => upstream.close(resolve));
  }
});

test('agent manifest and OpenAPI describe the eight paid routes', async () => {
  const api = await startServer();
  try {
    const manifestResponse = await fetch(`${api.base}/.well-known/x402`);
    assert.equal(manifestResponse.status, 200);
    const manifest = await manifestResponse.json();
    assert.equal(manifest.endpoints.length, 8);
    assert.equal(manifest.mcp.registryName, 'io.github.fernsugi/x402-api');

    const specResponse = await fetch(`${api.base}/openapi.json`);
    assert.equal(specResponse.status, 200);
    const spec = await specResponse.json();
    assert.equal(spec.openapi, '3.1.0');
    assert.equal(Object.keys(spec.paths).length, 8);
    assert.equal(spec.paths['/api/wallet-profiler'].get.parameters[0].required, true);
    assert.ok(spec.paths['/api/price-feed'].get.responses['402']);
  } finally {
    await stopServer(api.child);
  }
});

test('invalid input is rejected before the payment gate', async () => {
  const api = await startServer();
  try {
    const response = await fetch(`${api.base}/api/wallet-profiler?address=invalid`, {
      headers: { 'X-Payment': 'mock' },
    });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('X-Payment-Response'), null);
  } finally {
    await stopServer(api.child);
  }
});

test('production rejects a legacy transaction hash without durable opt-in', async () => {
  const upstream = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ bitcoin: { usd: 100000 }, ethereum: { usd: 2000 }, solana: { usd: 100 } }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const api = await startServer({
    NODE_ENV: 'production',
    X402_SETTLEMENT_MODE: 'disabled',
    X402_ENABLE_TXHASH: 'false',
    X402_DATA_DIR: '',
    X402_SETTLEMENT_PRIVATE_KEY: '',
    COINGECKO_API_BASE: `http://127.0.0.1:${upstream.address().port}`,
  });
  try {
    const payment = Buffer.from(JSON.stringify({
      txHash: `0x${'11'.repeat(32)}`,
      payer: '0x0000000000000000000000000000000000000001',
    })).toString('base64');
    const response = await fetch(`${api.base}/api/price-feed`, { headers: { 'X-Payment': payment } });
    assert.equal(response.status, 402);
    assert.match((await response.json()).reason, /disabled/);
  } finally {
    await stopServer(api.child);
    await new Promise(resolve => upstream.close(resolve));
  }
});

test('wallet route reports a limited RPC fallback when Blockscout fails', async () => {
  const upstream = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/blockscout/')) {
      res.statusCode = 500;
      res.end('{}');
      return;
    }
    if (req.url.startsWith('/tickers/')) {
      res.end(JSON.stringify({ data: [
        { symbol: 'ETH', price_usd: '2000' }, { symbol: 'USDC', price_usd: '1' },
      ] }));
      return;
    }
    if (req.url === '/rpc') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { method } = JSON.parse(body);
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1,
        result: method === 'eth_getBalance' ? '0xde0b6b3a7640000' : '0x989680' }));
      return;
    }
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const source = `http://127.0.0.1:${upstream.address().port}`;
  const api = await startServer({
    BASE_BLOCKSCOUT_URL: `${source}/blockscout`,
    BASE_RPC_URL: `${source}/rpc`,
    COINLORE_API_BASE: source,
  });
  try {
    const response = await fetch(`${api.base}/api/wallet-profiler?chain=base&address=0x60264c480b67adb557efEd22Cf0e7ceA792DefB7`, {
      headers: { 'X-Payment': 'mock' },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.total_value_usd, 2010);
    assert.equal(body.data.coverage.balance_sources.base, 'public RPC (native and USDC only)');
    assert.equal(body.data.coverage.valuation_is_partial, true);
  } finally {
    await stopServer(api.child);
    await new Promise(resolve => upstream.close(resolve));
  }
});

test('slow wallet sources are cancelled while available balances remain usable', async () => {
  let baseAvailable = true;
  const upstream = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/blockscout/base/')) {
      res.statusCode = 503;
      res.end('{}');
      return;
    }
    if (req.url.startsWith('/blockscout/')) return; // Deliberately never responds.
    if (req.url.startsWith('/tickers/')) {
      res.end(JSON.stringify({ data: [{ symbol: 'ETH', price_usd: '2000' }, { symbol: 'USDC', price_usd: '1' }] }));
      return;
    }
    if (req.url === '/rpc/base' && baseAvailable) {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { method } = JSON.parse(body);
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1,
        result: method === 'eth_getBalance' ? '0xde0b6b3a7640000' : '0x989680' }));
      return;
    }
    // Unavailable RPCs also hang, exercising the total budget after retries.
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const source = `http://127.0.0.1:${upstream.address().port}`;
  const env = { COINLORE_API_BASE: source };
  for (const chain of ['ethereum', 'base', 'arbitrum', 'polygon']) {
    env[`${chain.toUpperCase()}_BLOCKSCOUT_URL`] = `${source}/blockscout/${chain}`;
    env[`${chain.toUpperCase()}_RPC_URL`] = `${source}/rpc/${chain}`;
  }
  const api = await startServer(env);
  try {
    const started = performance.now();
    const response = await fetch(`${api.base}/api/wallet-profiler?address=0x0000000000000000000000000000000000000001`, {
      headers: { 'X-Payment': 'mock' }, signal: AbortSignal.timeout(9_000),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(performance.now() - started < 8_000, 'cold lookup finishes below external 10-second probe limit');
    assert.deepEqual(body.data.coverage.available_chains, ['base']);
    assert.deepEqual(body.data.coverage.unavailable_chains, ['ethereum', 'arbitrum', 'polygon']);
    assert.equal(body.data.coverage.provider_budget_ms, 6_000);
    assert.equal(body.data.coverage.balance_sources.base, 'public RPC (native and USDC only)');
    assert.equal(body.data.total_value_usd, 2010);

    baseAvailable = false;
    const failed = await fetch(`${api.base}/api/wallet-profiler?address=0x0000000000000000000000000000000000000002`, {
      headers: { 'X-Payment': 'mock' }, signal: AbortSignal.timeout(9_000),
    });
    assert.equal(failed.status, 503, 'all unavailable providers fail before payment');
    assert.equal(failed.headers.get('X-Payment-Response'), null);
  } finally {
    await stopServer(api.child);
    upstream.closeAllConnections();
    await new Promise(resolve => upstream.close(resolve));
  }
});
