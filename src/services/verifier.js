/**
 * x402 Payment Verifier — Production-Ready (Hardened)
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
 *   - Nonce state machine: pending → settled/failed (prevents double-settlement, allows retries).
 *   - validAfter AND validBefore are both checked.
 *   - Rate limiting: max 10 payment attempts per source address per minute.
 *   - Tx-hash validation: format check + confirmation count + recipient match.
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

// ── Nonce state machine ──────────────────────────────────────────────────────
// States:
//   'pending'  — settlement in progress; block duplicate submissions
//   'settled'  — confirmed; permanent replay protection
//   'failed'   — settlement failed; allow client to retry (NOT persisted to disk)
//
// On restart, any 'pending' entries loaded from disk are demoted to 'failed'
// (the settlement was interrupted; client may retry safely).

const DATA_DIR = path.join(__dirname, '../../data');
const NONCE_FILE = path.join(DATA_DIR, 'used-nonces.json');

/** Load persisted nonces from disk into a Map<key, {state, timestamp}> */
function loadNonces() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(NONCE_FILE)) return new Map();
    const raw = fs.readFileSync(NONCE_FILE, 'utf8');
    const stored = JSON.parse(raw);
    const m = new Map();
    if (Array.isArray(stored)) {
      for (const item of stored) {
        if (typeof item === 'string') {
          // Legacy format: plain string = settled
          m.set(item, { state: 'settled', timestamp: 0 });
        } else if (Array.isArray(item) && item.length === 2) {
          const [key, val] = item;
          // On restart, treat 'pending' as 'failed' (settlement was interrupted)
          const state = val.state === 'pending' ? 'failed' : val.state;
          m.set(key, { state, timestamp: val.timestamp || 0 });
        }
      }
    }
    return m;
  } catch (err) {
    console.warn('[verifier] Could not load nonce store, starting fresh:', err.message);
    return new Map();
  }
}

/** Evict transient nonce entries older than 24 h from the in-memory map.
 *  'settled' entries are kept indefinitely for replay protection.
 *  'pending' and 'failed' entries older than 24 h are safe to remove.
 */
function evictStaleNonces(nonces) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
  for (const [key, val] of nonces.entries()) {
    if (val.state !== 'settled' && val.timestamp < cutoff) {
      nonces.delete(key);
    }
  }
}

/** Flush pending + settled nonces to disk (failed states are NOT persisted — they allow retry). */
function saveNonces(nonces) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  // Evict stale transient entries before persisting to prevent unbounded growth
  evictStaleNonces(nonces);
  // Only persist 'pending' and 'settled' — 'failed' allows retry, no need to persist
  const toSave = [...nonces.entries()].filter(([, v]) => v.state !== 'failed');
  // Atomic write: write to temp file then rename to prevent partial-write corruption
  const tempPath = NONCE_FILE + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(toSave), 'utf8');
  fs.renameSync(tempPath, NONCE_FILE);
}

// In-process nonce cache (Map) — also written to disk on every state change.
const usedNonces = loadNonces();

/**
 * Set nonce state and persist if needed.
 * @param {string} key
 * @param {'pending'|'settled'|'failed'} state
 */
function setNonceState(key, state) {
  usedNonces.set(key, { state, timestamp: Date.now() });
  // Only persist pending/settled — failed states can be retried
  if (state !== 'failed') {
    saveNonces(usedNonces);
  }
}

/**
 * Get the current state of a nonce.
 * @param {string} key
 * @returns {'pending'|'settled'|'failed'|null}
 */
function getNonceState(key) {
  return usedNonces.get(key)?.state ?? null;
}

// ── Rate Limiting ────────────────────────────────────────────────────────────
// In-memory: max 10 payment attempts per source address per 60-second window.
// (Resets on restart; for production use Redis or a persistent store.)

const rateLimitStore = new Map(); // address → { count: number, windowStart: number }
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

/**
 * Check and increment the rate limit for a payer address.
 * @param {string} address - Normalised (lowercase) payer address.
 * @returns {boolean} true if allowed, false if limit exceeded.
 */
function checkRateLimit(address) {
  if (!address) return true; // no address, no limit
  const now = Date.now();
  const key = address.toLowerCase();
  const entry = rateLimitStore.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
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
 *
 * Hardened:
 *   - TX hash format validated (0x + 64 hex chars).
 *   - Minimum 1 block confirmation required.
 *   - Transfer recipient validated against config.payTo.
 *   - Rate limiting applied on decoded.payer if present.
 */
async function verifyByTxHash(decoded, config) {
  const { txHash, payer } = decoded;

  // ── Format validation ────────────────────────────────────────────────
  if (!txHash) {
    return { valid: false, reason: 'Missing transaction hash' };
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { valid: false, reason: 'Invalid transaction hash format (expected 0x + 64 hex chars)' };
  }

  // ── Payer is REQUIRED — prevents frontrunning ────────────────────────
  // Without a payer, anyone who sees the tx hash (e.g. via mempool/explorer)
  // could replay it to claim the payment for their own request.
  if (!payer || !/^0x[0-9a-fA-F]{40}$/.test(payer)) {
    return { valid: false, reason: 'Missing or invalid payer address (required for tx-hash verification)' };
  }

  // ── Rate limit by payer address ──────────────────────────────────────
  if (!checkRateLimit(payer)) {
    return { valid: false, reason: `Rate limit exceeded for address ${payer} — max ${RATE_LIMIT_MAX} attempts/minute` };
  }

  // ── Replay check ────────────────────────────────────────────────────
  const txState = getNonceState(txHash);
  if (txState === 'settled') {
    return { valid: false, reason: 'Transaction already used (replay protection)' };
  }
  if (txState === 'pending') {
    return { valid: false, reason: 'Transaction verification already in progress (duplicate submission)' };
  }

  // Mark as pending while we verify on-chain
  setNonceState(txHash, 'pending');

  try {
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt || receipt.status !== 1) {
      setNonceState(txHash, 'failed');
      return { valid: false, reason: 'Transaction failed or not found on Base' };
    }

    // ── Confirmation count check (require at least 1 block) ─────────────
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;
    if (confirmations < 1) {
      setNonceState(txHash, 'failed');
      return { valid: false, reason: `Transaction not yet confirmed (0 confirmations, needs >= 1)` };
    }

    // ── Validate Transfer event + recipient ─────────────────────────────
    const iface = new ethers.Interface([
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]);

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) continue;
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (parsed.name !== 'Transfer') continue;

        // Validate recipient matches expected payment address
        if (parsed.args.to.toLowerCase() !== config.payTo.toLowerCase()) {
          continue; // wrong recipient in this log, check next
        }

        // ── Validate payer matches on-chain sender (prevents frontrunning) ──
        // Only the actual sender of the tx can claim the payment.
        const onChainSender = parsed.args.from;
        if (decoded.payer.toLowerCase() !== onChainSender.toLowerCase()) {
          setNonceState(txHash, 'failed');
          return { valid: false, reason: 'Payer address does not match on-chain transfer sender' };
        }

        if (parsed.args.value >= BigInt(config.maxAmountRequired)) {
          setNonceState(txHash, 'settled');
          return {
            valid: true,
            mock: false,
            settled: true, // tx was already on-chain
            txHash,
            payer: onChainSender,
            amount: parsed.args.value.toString(),
            network: 'base',
            confirmations,
          };
        }
      } catch { /* not a matching event */ }
    }

    setNonceState(txHash, 'failed');
    return { valid: false, reason: 'No valid USDC transfer to our address found in transaction' };
  } catch (err) {
    setNonceState(txHash, 'failed');
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
 * Nonce ordering (FIXED):
 *   Nonce is marked 'pending' BEFORE settlement (prevents double-settlement),
 *   then promoted to 'settled' on success or 'failed' on failure (allows retry).
 *
 * What this does NOT do:
 *   - It does NOT submit the transferWithAuthorization to the blockchain.
 *   - Funds do NOT move until the settlement stub is replaced with a real call.
 *   See the submitSettlement TODO above.
 */
async function verifyEIP3009(signature, auth, config) {
  try {
  // ── Required-field validation ────────────────────────────────────────
  // Malformed payloads must return 402 (invalid), not crash with 500.
  const REQUIRED_FIELDS = ['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce'];
  for (const field of REQUIRED_FIELDS) {
    if (auth[field] === undefined || auth[field] === null || auth[field] === '') {
      return { valid: false, reason: `Missing required authorization field: ${field}` };
    }
  }

  // ── Rate limit ───────────────────────────────────────────────────────
  if (auth.from && !checkRateLimit(auth.from)) {
    return {
      valid: false,
      reason: `Rate limit exceeded for address ${auth.from} — max ${RATE_LIMIT_MAX} attempts/minute`,
    };
  }

  // ── Replay check (nonce state machine) ──────────────────────────────
  const nonceKey = `${auth.from}:${auth.nonce}`;
  const nonceState = getNonceState(nonceKey);

  if (nonceState === 'settled') {
    return { valid: false, reason: 'Nonce already used (replay protection)' };
  }
  if (nonceState === 'pending') {
    return { valid: false, reason: 'Payment already in progress — duplicate submission rejected' };
  }
  // nonceState === 'failed' or null → proceed with verification

  // ── Verify recipient ──────────────────────────────────────────────────
  if (auth.to.toLowerCase() !== config.payTo.toLowerCase()) {
    return { valid: false, reason: 'Payment recipient mismatch' };
  }

  // ── Verify amount ────────────────────────────────────────────────────
  if (BigInt(auth.value) < BigInt(config.maxAmountRequired)) {
    return { valid: false, reason: `Insufficient: got ${auth.value}, need ${config.maxAmountRequired}` };
  }

  // ── Verify timing — BOTH validAfter and validBefore must be satisfied ──
  const now = Math.floor(Date.now() / 1000);
  if (auth.validAfter && now < Number(auth.validAfter)) {
    return { valid: false, reason: `Authorization not yet valid (validAfter: ${auth.validAfter}, now: ${now})` };
  }
  if (auth.validBefore && now > Number(auth.validBefore)) {
    return { valid: false, reason: 'Authorization expired (validBefore exceeded)' };
  }

  // ── Verify EIP-712 signature ─────────────────────────────────────────
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

  // ── Check on-chain nonce state ────────────────────────────────────────
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

  // ── Mark nonce as 'pending' BEFORE settlement ─────────────────────────
  // This prevents double-settlement if two concurrent requests arrive with
  // the same nonce before either completes.
  setNonceState(nonceKey, 'pending');

  // ── Attempt settlement (stub — does not move funds until wired up) ────
  const settlement = await submitSettlement(signature, auth, config);

  // ── Post-settlement nonce state update ────────────────────────────────
  if (settlement.settled) {
    // Promote to 'settled' — permanently blocks replay
    setNonceState(nonceKey, 'settled');
    return {
      valid: true,
      mock: false,
      settled: true,
      payer: auth.from,
      amount: auth.value,
      nonce: auth.nonce,
      network: 'base',
    };
  }

  // Settlement failed — mark 'failed' so client can retry with same nonce
  setNonceState(nonceKey, 'failed');

  // SECURITY: A valid signature alone is NOT sufficient — funds must actually move.
  // Until the facilitator is wired up, settlement.settled will be false.
  // Return valid: false so the middleware rejects the request rather than serving
  // paid content for free.
  return {
    valid: false,
    mock: false,
    settled: false,
    reason: settlement.reason || 'Payment authorization verified but settlement pending — facilitator not yet configured.',
    payer: auth.from,
    amount: auth.value,
    nonce: auth.nonce,
    network: 'base',
  };
  } catch (err) {
    // Catch-all: any unexpected error in EIP-3009 verification returns a clean
    // invalid response instead of propagating as a 500.
    // Reset nonce to 'failed' so it doesn't get stuck in 'pending' forever.
    if (nonceKey) setNonceState(nonceKey, 'failed');
    console.error('[verifier] Unexpected error in verifyEIP3009:', err.message);
    return { valid: false, reason: `Payment verification error: ${err.message}` };
  }
}

module.exports = { verifyPayment };
