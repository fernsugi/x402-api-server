/**
 * x402 Payment Middleware — Production
 *
 * Implements HTTP 402 Payment Required protocol:
 *   1. No X-PAYMENT header → 402 with payment instructions
 *   2. X-PAYMENT present → verify (real or mock depending on NODE_ENV) → serve or reject
 *
 * Usage:
 *   const { requirePayment } = require('./middleware/x402');
 *   router.get('/endpoint', requirePayment({ resource, description, maxAmountRequired }), handler);
 */

'use strict';

const { verifyPayment } = require('../services/verifier');
const { BAZAAR_SCHEMAS } = require('../bazaar-schemas');
const {
  FACILITATOR_URL,
  getSettlementMode,
  getSupportedPaymentProofs,
  getExperimentalPaymentProofs,
} = require('../payment-config');

const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS || '0x60264c480b67adb557efEd22Cf0e7ceA792DefB7';
const SETTLEMENT_MODE = getSettlementMode();
const SUPPORTED_PAYMENT_PROOFS = Object.freeze(getSupportedPaymentProofs());
const EXPERIMENTAL_PAYMENT_PROOFS = Object.freeze(getExperimentalPaymentProofs());

/**
 * Factory: Express middleware enforcing x402 payment.
 *
 * @param {object} config
 * @param {string} config.resource          - Endpoint path (e.g. "/api/price-feed")
 * @param {string} config.description       - Human-readable description
 * @param {number} config.maxAmountRequired - Price in USDC micro-units (0.001 USDC = 1000)
 */
function requirePayment(config) {
  const {
    resource,
    description,
    maxAmountRequired,
    scheme = 'exact',
    network = 'base',
    maxTimeoutSeconds = 60,
    asset = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
  } = config;

  if (!resource || !description || maxAmountRequired === undefined) {
    throw new Error('x402 middleware: resource, description, and maxAmountRequired are required');
  }

  return async function x402Middleware(req, res, next) {
    const paymentHeader = req.headers['x-payment'];

    // ── No payment → 402 ────────────────────────────────────────────────
    if (!paymentHeader) {
      // Look up Bazaar discovery schema for this endpoint
      const bazaarExtension = BAZAAR_SCHEMAS[resource] || null;

      return res.status(402).json({
        x402Version: 1,
        error: 'Payment Required',
        accepts: [
          {
            scheme,
            network,
            asset,
            payTo: PAY_TO_ADDRESS,
            maxAmountRequired: String(maxAmountRequired),
            maxTimeoutSeconds,
            resource: `${req.protocol}://${req.get('host')}${resource}`,
            description,
            mimeType: 'application/json',
            // v1 output schema field (deprecated but readable by older clients)
            outputSchema: bazaarExtension?.bazaar?.info?.output || null,
            extra: {
              name: 'USD Coin',
              version: '2',
              chainId: 8453,
              supportedProofs: SUPPORTED_PAYMENT_PROOFS,
              experimentalProofs: EXPERIMENTAL_PAYMENT_PROOFS,
              settlementMode: SETTLEMENT_MODE,
              ...(FACILITATOR_URL ? { facilitatorUrl: FACILITATOR_URL } : {}),
            },
          },
        ],
        // v2-compatible Bazaar discovery extension — agents read this directly
        // Indexed by Coinbase facilitator when mainnet support is added
        extensions: bazaarExtension ? { bazaar: bazaarExtension.bazaar } : {},
      });
    }

    // ── Verify payment ──────────────────────────────────────────────────
    try {
      const result = await verifyPayment(paymentHeader, {
        payTo: PAY_TO_ADDRESS,
        maxAmountRequired,
        asset,
        network,
      });

      if (!result.valid) {
        return res.status(402).json({
          x402Version: 1,
          error: 'Payment verification failed',
          reason: result.reason,
        });
      }

      // Defense-in-depth: even if verifier returns valid, refuse unsettled payments.
      // This guards against future code paths where valid:true could slip through
      // without settlement (e.g. dev mock mode reaching this middleware in prod).
      if (!result.settled && !result.mock) {
        return res.status(402).json({
          x402Version: 1,
          error: 'Payment authorization verified but settlement failed or is not configured.',
          reason: result.settlementNote || result.reason || 'Funds have not moved. Configure direct settlement or a custom facilitator.',
        });
      }

      // Attach to request for downstream handlers
      req.x402 = {
        verified: true,
        mock: result.mock || false,
        txHash: result.txHash,
        payer: result.payer,
        amount: result.amount,
      };

      res.setHeader('X-Payment-Response', JSON.stringify({
        success: true,
        txHash: result.txHash,
        payer: result.payer,
        mock: result.mock || false,
      }));

      next();
    } catch (err) {
      console.error('[x402] Verification error:', err);
      res.status(500).json({
        error: 'Payment verification error',
        message: err.message,
      });
    }
  };
}

module.exports = {
  requirePayment,
  PAY_TO_ADDRESS,
  SUPPORTED_PAYMENT_PROOFS,
  EXPERIMENTAL_PAYMENT_PROOFS,
};
