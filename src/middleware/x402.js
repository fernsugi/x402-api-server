/**
 * x402 Payment Middleware
 *
 * Implements the HTTP 402 Payment Required protocol:
 *
 *   Request (no payment)
 *     ↓
 *   402 + { x402Version, accepts: [{ scheme, network, asset, payTo, maxAmountRequired, ... }] }
 *     ↓
 *   Client pays on-chain & re-sends with X-PAYMENT header
 *     ↓
 *   Middleware verifies payment → next() (serve data) or 402/400 (reject)
 *
 * Usage:
 *   const { requirePayment } = require('./middleware/x402');
 *   router.get('/my-endpoint', requirePayment(config), handler);
 */

'use strict';

const { verifyPayment } = require('../services/mockVerifier');

// Our receiving wallet on Base (replace with real wallet in production)
const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

/**
 * Factory: returns Express middleware that enforces x402 payment for an endpoint.
 *
 * @param {object} config
 * @param {string}  config.resource           - Canonical URL of the endpoint (e.g. "/api/price-feed")
 * @param {string}  config.description        - Human-readable description
 * @param {number}  config.maxAmountRequired  - Price in USDC micro-units (1 USDC = 1_000_000)
 *                                              e.g. 0.001 USDC → 1000
 * @param {string}  [config.scheme="exact"]   - Payment scheme ("exact" | "upto")
 * @param {string}  [config.network="base"]   - Chain network identifier
 * @param {string}  [config.asset]            - USDC contract address on Base
 */
function requirePayment(config) {
  const {
    resource,
    description,
    maxAmountRequired,
    scheme = 'exact',
    network = 'base',
    asset = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base mainnet
  } = config;

  if (!resource || !description || maxAmountRequired === undefined) {
    throw new Error('x402 middleware: resource, description, and maxAmountRequired are required');
  }

  return function x402Middleware(req, res, next) {
    const paymentHeader = req.headers['x-payment'];

    // ── No payment header → return 402 with payment instructions ────────────
    if (!paymentHeader) {
      const paymentRequired = {
        x402Version: 1,
        error: 'Payment Required',
        accepts: [
          {
            scheme,
            network,
            asset,
            payTo: PAY_TO_ADDRESS,
            maxAmountRequired: String(maxAmountRequired), // In USDC micro-units (6 decimals)
            resource: `${req.protocol}://${req.get('host')}${resource}`,
            description,
            mimeType: 'application/json',
            outputSchema: null, // Optional: JSON Schema of the response
            extra: {
              // Hint for AI agents building the payment tx
              name: 'USD Coin',
              version: '2',
              chainId: 8453, // Base mainnet
              // ⚠️ MOCK: In production the facilitator URL validates proofs
              facilitatorUrl: 'https://x402.org/facilitator', // Placeholder
            },
          },
        ],
      };

      return res.status(402).json(paymentRequired);
    }

    // ── Payment header present → verify it ──────────────────────────────────
    const result = verifyPayment(paymentHeader, {
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

    // Attach verification result to request for downstream handlers
    req.x402 = {
      verified: true,
      mock: result.mock, // True until real verification is wired up
      txHash: result.txHash,
      payer: result.payer,
      amount: result.amount,
    };

    // Pass the X-Payment-Response header back so agents can confirm receipt
    res.setHeader('X-Payment-Response', JSON.stringify({
      success: true,
      txHash: result.txHash,
      payer: result.payer,
      mock: result.mock,
    }));

    next();
  };
}

module.exports = { requirePayment, PAY_TO_ADDRESS };
