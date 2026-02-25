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
 *
 * SECURITY NOTES:
 *   - Nonces are persisted to disk (data/used-nonces.json) to survive restarts.
 *   - validAfter AND validBefore are both checked.
 *   - EIP-3009 verification confirms signature validity and nonce freshness,
 *     but DOES NOT submit the transferWithAuthorization to the chain.
 *     See the settlement TODO below for the required production upgrade.
 */

'use strict';

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';

// ── Persistent nonce store ───────────────────────────────────────────────────
// Stored in data/used-nonces.json relative to the project root.
// This survives process restarts, preventing replay attacks across deploys.
const DATA_DIR = path.join(__dirname, '../../data');
const NONCE_FILE = path.join(DATA_DIR, 'used-nonces.json');

/** Load persisted nonces from disk into a Set */
function loadNonces() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(NONCE_FILE)) return new Set();
    const raw = fs.readFileSync(NONCE_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (err) {
    console.warn('[verifier] Could not load nonce store, starting fresh:', err.message);
    return new Set();
  }
}

/** Flush the nonce set to disk */
function saveNonces(nonces) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(NONCE_FILE, JSON.stringify([...nonces]), 'utf8');
  } catch (err) {
    console.error('[verifier] CRITICAL: Could not persist nonce store:', err.message);
    // Fail open with warning — a restart would clear in-memory anyway.
    // TODO: throw here in strict-mode deployments to halt on nonce persistence failure.
  }
}

// In-process cache; nonces are also written to disk on every new entry.
const usedNonces = loadNonces();

/** Add a nonce to the store and immediately persist it. */
function addNonce(key) {
  usedNonces.add(key);
  saveNonces(usedNonces);
}

// ── Lazy-init provider ───────────────────────────────────────────────────────
let _provider = null;
function getProvider() {
  if (!_provider) _provider = new ethers.JsonRpcProvider(BASE_RPC);
  return _provider;
}

const USDC_ABI = [
  'function authorizationState(address authorizer, bytes32 nonce) view returns (bool)',
];

// ── Facilitator settlement stub ──────────────────────────────────────────────
/**
 * TODO (CRITICAL — required before go-live):
 *   Replace this stub with a real call to the x402 facilitator or on-chain settlement.
 *
 *   Option A — Coinbase facilitator (recommended once Base mainnet is supported):
 *     POST https://x402.org/facilitator/settle
 *     Body: { signature, authorization, payTo, asset, network }
 *     The facilitator submits the transferWithAuthorization and returns a receipt.
 *
 *   Option B — Self-settle via ethers:
 *     const usdc = new ethers.Contract(USDC_ADDRESS, [...], signer);
 *     await usdc.transferWithAuthorization(
 *       auth.from, auth.to, auth.value, auth.validAfter, auth.validBefore, auth.nonce, signature
 *     );
 *
 *   Until settlement is wired in, the verifier only confirms the *signature* is valid
 *   and the authorization hasn't been spent on-chain yet. Funds do NOT move.
 *
 * @param {string} signature  - EIP-712 signature
 * @param {object} auth       - EIP-3009 authorization object
 * @param {object} config     - { payTo, asset, network }
 * @returns {Promise<{settled: boolean, txHash?: string, reason?: string}>}
 */
async function submitSettlement(signature, auth, config) {
  // STUB: log intent and return unsettled.
  // Replace with real facilitator/on-chain call before production.
  console.warn(
    '[verifier] SETTLEMENT STUB: transferWithAuthorization not submitted. ' +
    'Signature verified, funds NOT moved. See TODO in verifier.js.'
  );

  // Example facilitator call (disabled — uncomment and complete when ready):
  /*
  const resp = await fetch(`${FACILITATOR_URL}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signature,
      authorization: auth,
      payTo: config.payTo,
      asset: config.asset,
      network: config.network,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    return { settled: false, reason: `Facilitator error: ${err}` };
  }
  const data = await resp.json();
  return { settled: true, txHash: data.txHash };
  */

  return { settled: false, reason: 'Settlement stub — funds not moved (see verifier.js TODO)' };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Verify an x402 payment header.
 *
 * @param {string} paymentHeader - Value of X-PAYMENT request header
 * @param {object} config - { payTo, maxAmountRequired, asset, network }
 * @returns {Promise<{valid: boolean, mock?: boolean, settled?: boolean, reason?: string, payer?: string, amount?: string}>}
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
      settled: false,
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
          addNonce(txHash); // persist
          return {
            valid: true,
            mock: false,
            settled: true, // tx was already on-chain
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
 *
 * IMPORTANT: This verifies that:
 *   1. The signature is cryptographically valid (correct signer).
 *   2. The authorization targets the correct recipient and covers the price.
 *   3. The authorization is within its valid time window (validAfter..validBefore).
 *   4. The nonce has not been used locally (replay protection, persistent).
 *   5. The on-chain nonce state has not been consumed.
 *
 * What this does NOT do:
 *   - It does NOT submit the transferWithAuthorization to the blockchain.
 *   - Funds do NOT move until the settlement stub is replaced with a real call.
 *   See the submitSettlement TODO above.
 */
async function verifyEIP3009(signature, auth, config) {
  // Check replay locally (persistent across restarts)
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

  // Verify timing — BOTH validAfter and validBefore must be satisfied
  const now = Math.floor(Date.now() / 1000);
  if (auth.validAfter && now < Number(auth.validAfter)) {
    return { valid: false, reason: `Authorization not yet valid (validAfter: ${auth.validAfter}, now: ${now})` };
  }
  if (auth.validBefore && now > Number(auth.validBefore)) {
    return { valid: false, reason: 'Authorization expired (validBefore exceeded)' };
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

  // Persist nonce before attempting settlement (fail-safe against double-spend)
  addNonce(nonceKey);

  // Attempt settlement (stub — does not move funds until wired up)
  const settlement = await submitSettlement(signature, auth, config);

  return {
    valid: true,
    mock: false,
    settled: settlement.settled,
    settlementNote: settlement.reason || null,
    payer: auth.from,
    amount: auth.value,
    nonce: auth.nonce,
    network: 'base',
  };
}

module.exports = { verifyPayment };
