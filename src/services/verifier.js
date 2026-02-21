/**
 * x402 Payment Verifier — Production-Ready
 *
 * Dual-mode verification:
 *   - development: accepts any non-empty X-PAYMENT header (mock mode)
 *   - production: verifies EIP-3009 transferWithAuthorization signature + on-chain state
 *
 * UPGRADE PATH: When `x402-server-express` becomes available on npm, replace this
 * entire module with the official Coinbase facilitator SDK:
 *
 *   const { paymentMiddleware } = require('x402-server-express');
 *   // See go-live guide Section 1 for exact usage
 *
 * For now, we verify the EIP-712 signature locally and check on-chain nonce state.
 * Settlement (actually moving the USDC) is handled by the facilitator or self-settled.
 */

'use strict';

const { ethers } = require('ethers');

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';

// Lazy-init provider (only created when needed in production mode)
let _provider = null;
function getProvider() {
  if (!_provider) _provider = new ethers.JsonRpcProvider(BASE_RPC);
  return _provider;
}

// In-memory replay protection (use Redis in multi-instance production)
const usedNonces = new Set();

const USDC_ABI = [
  'function authorizationState(address authorizer, bytes32 nonce) view returns (bool)',
];

/**
 * Verify an x402 payment header.
 *
 * @param {string} paymentHeader - Value of X-PAYMENT request header
 * @param {object} config - { payTo, maxAmountRequired, asset, network }
 * @returns {Promise<{valid: boolean, mock?: boolean, reason?: string, payer?: string, amount?: string}>}
 */
async function verifyPayment(paymentHeader, config) {
  if (!paymentHeader || paymentHeader.trim() === '') {
    return { valid: false, reason: 'Empty payment header' };
  }

  const isDev = process.env.NODE_ENV !== 'production';

  // ── Development mode: accept anything ─────────────────────────────────
  if (isDev) {
    let decoded = {};
    try {
      const raw = Buffer.from(paymentHeader, 'base64').toString('utf8');
      decoded = JSON.parse(raw);
    } catch {
      decoded = { raw: paymentHeader };
    }

    return {
      valid: true,
      mock: true,
      txHash: decoded.txHash || '0xMOCK_DEV_MODE',
      payer: decoded.payer || '0xMOCK_PAYER',
      amount: decoded.amount || String(config.maxAmountRequired),
      network: config.network,
    };
  }

  // ── Production mode: real verification ────────────────────────────────
  let decoded;
  try {
    const raw = Buffer.from(paymentHeader, 'base64').toString('utf8');
    decoded = JSON.parse(raw);
  } catch {
    return { valid: false, reason: 'Invalid payment header format (expected Base64 JSON)' };
  }

  const { signature, payload } = decoded;

  // Support both facilitator-style (signature + payload.authorization) and
  // simple tx-hash style (txHash field) for flexibility
  if (decoded.txHash) {
    return await verifyByTxHash(decoded, config);
  }

  if (!signature || !payload?.authorization) {
    return { valid: false, reason: 'Missing signature or authorization in payment payload' };
  }

  return await verifyEIP3009(signature, payload.authorization, config);
}

/**
 * Verify by checking an on-chain transaction hash.
 * Simpler approach: agent already submitted the tx, we just confirm it.
 */
async function verifyByTxHash(decoded, config) {
  const { txHash, payer } = decoded;
  if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
    return { valid: false, reason: 'Invalid transaction hash format' };
  }

  // Check replay
  if (usedNonces.has(txHash)) {
    return { valid: false, reason: 'Transaction already used (replay protection)' };
  }

  try {
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt || receipt.status !== 1) {
      return { valid: false, reason: 'Transaction failed or not found on Base' };
    }

    // Check for USDC Transfer event to our address
    const iface = new ethers.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]);

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) continue;
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (
          parsed.name === 'Transfer' &&
          parsed.args.to.toLowerCase() === config.payTo.toLowerCase() &&
          parsed.args.value >= BigInt(config.maxAmountRequired)
        ) {
          usedNonces.add(txHash);
          return {
            valid: true,
            mock: false,
            txHash,
            payer: parsed.args.from,
            amount: parsed.args.value.toString(),
            network: 'base',
          };
        }
      } catch { /* not a matching event */ }
    }

    return { valid: false, reason: 'No valid USDC transfer to our address found in transaction' };
  } catch (err) {
    console.error('[verifier] RPC error:', err.message);
    return { valid: false, reason: `Verification RPC error: ${err.message}` };
  }
}

/**
 * Verify EIP-3009 transferWithAuthorization signature (x402 standard).
 * This checks the signature is valid and the nonce hasn't been used.
 * Settlement happens via the facilitator or self-settlement.
 */
async function verifyEIP3009(signature, auth, config) {
  // Check replay locally
  const nonceKey = `${auth.from}:${auth.nonce}`;
  if (usedNonces.has(nonceKey)) {
    return { valid: false, reason: 'Nonce already used (replay protection)' };
  }

  // Verify recipient
  if (auth.to.toLowerCase() !== config.payTo.toLowerCase()) {
    return { valid: false, reason: 'Payment recipient mismatch' };
  }

  // Verify amount
  if (BigInt(auth.value) < BigInt(config.maxAmountRequired)) {
    return { valid: false, reason: `Insufficient: got ${auth.value}, need ${config.maxAmountRequired}` };
  }

  // Verify timing
  const now = Math.floor(Date.now() / 1000);
  if (auth.validBefore && now > Number(auth.validBefore)) {
    return { valid: false, reason: 'Authorization expired' };
  }

  // Verify EIP-712 signature
  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: 8453,
    verifyingContract: USDC_ADDRESS,
  };

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  };

  try {
    const recovered = ethers.verifyTypedData(domain, types, auth, signature);
    if (recovered.toLowerCase() !== auth.from.toLowerCase()) {
      return { valid: false, reason: 'Signature does not match sender' };
    }
  } catch (err) {
    return { valid: false, reason: `Signature verification failed: ${err.message}` };
  }

  // Check on-chain nonce state
  try {
    const provider = getProvider();
    const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    const onChainUsed = await usdc.authorizationState(auth.from, auth.nonce);
    if (onChainUsed) {
      return { valid: false, reason: 'Authorization already consumed on-chain' };
    }
  } catch (err) {
    console.warn('[verifier] On-chain nonce check failed:', err.message);
    // Continue — settlement will catch double-spend
  }

  usedNonces.add(nonceKey);

  return {
    valid: true,
    mock: false,
    payer: auth.from,
    amount: auth.value,
    nonce: auth.nonce,
    network: 'base',
  };
}

module.exports = { verifyPayment };
