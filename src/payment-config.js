'use strict';

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || null;
const FACILITATOR_API_KEY = process.env.X402_FACILITATOR_API_KEY || null;
const SETTLEMENT_PRIVATE_KEY = process.env.X402_SETTLEMENT_PRIVATE_KEY || null;
const RAW_SETTLEMENT_MODE = String(process.env.X402_SETTLEMENT_MODE || 'auto').toLowerCase();
// A transaction hash can be replayed after an ephemeral disk is replaced. Keep
// this legacy proof disabled unless the operator explicitly opts in and mounts
// a durable nonce directory shared by every server instance.
const TXHASH_ENABLED = process.env.X402_ENABLE_TXHASH === 'true' && Boolean(process.env.X402_DATA_DIR);

function getSettlementMode() {
  switch (RAW_SETTLEMENT_MODE) {
    case 'direct':
      return SETTLEMENT_PRIVATE_KEY ? 'direct' : 'disabled';
    case 'facilitator':
      return FACILITATOR_URL ? 'facilitator' : 'disabled';
    case 'disabled':
      return 'disabled';
    case 'auto':
    default:
      if (SETTLEMENT_PRIVATE_KEY) return 'direct';
      if (FACILITATOR_URL) return 'facilitator';
      return 'disabled';
  }
}

function isEip3009SettlementConfigured() {
  return getSettlementMode() !== 'disabled';
}

function getSupportedPaymentProofs() {
  return [
    ...(TXHASH_ENABLED ? ['txHash'] : []),
    ...(isEip3009SettlementConfigured() ? ['eip3009_transferWithAuthorization'] : []),
  ];
}

function getExperimentalPaymentProofs() {
  return isEip3009SettlementConfigured()
    ? []
    : ['eip3009_transferWithAuthorization'];
}

module.exports = {
  FACILITATOR_URL,
  FACILITATOR_API_KEY,
  SETTLEMENT_PRIVATE_KEY,
  TXHASH_ENABLED,
  getSettlementMode,
  isEip3009SettlementConfigured,
  getSupportedPaymentProofs,
  getExperimentalPaymentProofs,
};
