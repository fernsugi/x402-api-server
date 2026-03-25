'use strict';

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || null;
const FACILITATOR_API_KEY = process.env.X402_FACILITATOR_API_KEY || null;
const SETTLEMENT_PRIVATE_KEY = process.env.X402_SETTLEMENT_PRIVATE_KEY || process.env.PRIVATE_KEY || null;
const RAW_SETTLEMENT_MODE = String(process.env.X402_SETTLEMENT_MODE || 'auto').toLowerCase();

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
  return isEip3009SettlementConfigured()
    ? ['txHash', 'eip3009_transferWithAuthorization']
    : ['txHash'];
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
  getSettlementMode,
  isEip3009SettlementConfigured,
  getSupportedPaymentProofs,
  getExperimentalPaymentProofs,
};
