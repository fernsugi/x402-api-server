/**
 * ⚠️  MOCK PAYMENT VERIFIER — NOT FOR PRODUCTION USE ⚠️
 *
 * This module stubs out real Base chain verification.
 * In production, replace verifyPayment() with actual on-chain tx verification:
 *
 *   1. Decode the X-PAYMENT header (Base64 JSON with txHash + signature)
 *   2. Call Base RPC to fetch the tx: provider.getTransaction(txHash)
 *   3. Verify the tx is a USDC transfer to our payTo address
 *   4. Verify amount >= maxAmountRequired for the endpoint
 *   5. Verify tx is confirmed (≥1 block finality)
 *   6. Store txHash in Redis/DB to prevent replay attacks
 *   7. Return { valid: true, txHash, amount, payer }
 *
 * Real implementation would use:
 *   - ethers.js / viem for Base RPC calls
 *   - USDC contract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (Base mainnet)
 *   - Coinbase x402 Facilitator SDK (when available)
 *   - A Redis store for replay protection
 */

'use strict';

/**
 * MOCK: Accepts any non-empty X-PAYMENT header value.
 * Decodes the header if it looks like Base64 JSON, otherwise treats as raw.
 *
 * @param {string} paymentHeader  - Value of the X-PAYMENT request header
 * @param {object} endpointConfig - { payTo, maxAmountRequired, asset, network }
 * @returns {{ valid: boolean, reason?: string, decoded?: object }}
 */
function verifyPayment(paymentHeader, endpointConfig) {
  // Guard: header must be non-empty
  if (!paymentHeader || paymentHeader.trim() === '') {
    return { valid: false, reason: 'Empty payment header' };
  }

  // Attempt to decode Base64 JSON (the real x402 wire format)
  let decoded = null;
  try {
    const raw = Buffer.from(paymentHeader, 'base64').toString('utf8');
    decoded = JSON.parse(raw);
  } catch {
    // Not Base64 JSON — could be a raw test value, that's fine for mock
    decoded = { raw: paymentHeader };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🚨 MOCK LOGIC: Always returns valid for any non-empty header.
  //    Replace everything below with real on-chain verification.
  // ─────────────────────────────────────────────────────────────────────────
  const MOCK_RESPONSE = {
    valid: true,
    mock: true, // Flag so callers know this is not real verification
    txHash: decoded?.txHash || '0xMOCK_TX_HASH_NOT_REAL',
    payer: decoded?.payer || '0xMOCK_PAYER_ADDRESS',
    amount: decoded?.amount || endpointConfig.maxAmountRequired,
    network: endpointConfig.network,
    asset: endpointConfig.asset,
    decoded,
  };

  return MOCK_RESPONSE;
}

/**
 * MOCK: Builds a sample X-PAYMENT header value for testing.
 * In production, the client (AI agent) would build this from a real signed tx.
 *
 * @param {string} txHash - On-chain transaction hash
 * @param {string} payer  - Payer wallet address
 * @param {number} amount - Amount paid in USDC (micro-units)
 */
function buildSamplePaymentHeader(txHash, payer, amount) {
  const payload = { txHash, payer, amount, timestamp: Date.now() };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

module.exports = { verifyPayment, buildSamplePaymentHeader };
