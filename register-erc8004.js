#!/usr/bin/env node
/**
 * ERC-8004 Agent Registration Script
 * Registers x402-api on Base mainnet Identity Registry
 * 
 * Usage:
 *   PRIVATE_KEY=0x... node register-erc8004.js
 * 
 * Requirements:
 *   - ETH on Base for gas (~$0.01)
 *   - Your wallet's private key
 */

const { ethers } = require("ethers");
const fs = require("fs");

// ── Config ──────────────────────────────────────────────────────────────
const BASE_RPC = "https://mainnet.base.org";
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const WALLET_ADDRESS = "0x60264c480b67adb557efEd22Cf0e7ceA792DefB7";

// ── Agent Registration File (ERC-8004 spec) ─────────────────────────────
const agentRegistration = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "x402-api",
  description:
    "Pay-per-call DeFi & crypto data API. 8 endpoints: price feeds, whale tracking, gas tracker, DEX quotes, token scanner, yield scanner, funding rates, wallet profiler. Powered by x402 protocol — USDC micropayments on Base, no API keys needed.",
  image: "", // can add later
  services: [
    {
      name: "web",
      endpoint: "https://x402-api.fly.dev/",
    },
    {
      name: "x402",
      endpoint: "https://x402-api.fly.dev/",
      version: "1",
    },
  ],
  x402Support: true,
  active: true,
  registrations: [],  // will be filled after registration with agentId
  supportedTrust: ["reputation"],
};

// ── Minimal Identity Registry ABI ───────────────────────────────────────
const REGISTRY_ABI = [
  "function register(string memory agentURI) external returns (uint256)",
  "function register(string memory agentURI, tuple(string key, string value)[] memory metadata) external returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function agentURI(uint256 agentId) view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ Set PRIVATE_KEY environment variable");
    console.error("   PRIVATE_KEY=0x... node register-erc8004.js");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("\n🪪  ERC-8004 Agent Registration");
  console.log("─".repeat(50));
  console.log(`Wallet:   ${wallet.address}`);
  console.log(`Registry: ${IDENTITY_REGISTRY}`);
  console.log(`Chain:    Base Mainnet (8453)\n`);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  const ethBalance = ethers.formatEther(balance);
  console.log(`Balance:  ${ethBalance} ETH`);

  if (balance === 0n) {
    console.error("\n❌ No ETH on Base. You need ~0.00001 ETH for gas.");
    console.error("   Bridge ETH to Base via https://bridge.base.org");
    process.exit(1);
  }

  // Check if already registered
  const registry = new ethers.Contract(IDENTITY_REGISTRY, REGISTRY_ABI, wallet);
  const existingTokens = await registry.balanceOf(wallet.address);
  if (existingTokens > 0n) {
    const agentId = await registry.tokenOfOwnerByIndex(wallet.address, 0);
    console.log(`\n⚠️  Already registered! Agent ID: ${agentId}`);
    const uri = await registry.agentURI(agentId);
    console.log(`   URI: ${uri}`);
    process.exit(0);
  }

  // Encode registration as base64 data URI (fully on-chain)
  const jsonStr = JSON.stringify(agentRegistration, null, 2);
  const b64 = Buffer.from(jsonStr).toString("base64");
  const dataUri = `data:application/json;base64,${b64}`;

  console.log(`\nAgent name: ${agentRegistration.name}`);
  console.log(`Endpoints: ${agentRegistration.services.length}`);
  console.log(`x402:      ✅`);
  console.log(`URI size:  ${dataUri.length} bytes\n`);

  // Register
  console.log("📝 Sending registration transaction...");
  const tx = await registry["register(string)"](dataUri);
  console.log(`   TX: ${tx.hash}`);
  console.log(`   Waiting for confirmation...`);

  const receipt = await tx.wait();
  
  // Extract agentId from Transfer event
  const transferLog = receipt.logs.find(
    (log) => log.topics[0] === ethers.id("Transfer(address,address,uint256)")
  );
  const agentId = transferLog
    ? ethers.toBigInt(transferLog.topics[3])
    : "unknown";

  console.log(`\n✅ REGISTERED!`);
  console.log(`─`.repeat(50));
  console.log(`Agent ID:  ${agentId}`);
  console.log(`Registry:  eip155:8453:${IDENTITY_REGISTRY}`);
  console.log(`TX:        https://basescan.org/tx/${tx.hash}`);
  console.log(`Profile:   https://basescan.org/nft/${IDENTITY_REGISTRY}/${agentId}`);
  console.log(`\n🎉 Your x402 API is now discoverable by 34,000+ AI agents!`);

  // Update registration file with agentId
  agentRegistration.registrations = [
    {
      agentId: Number(agentId),
      agentRegistry: `eip155:8453:${IDENTITY_REGISTRY}`,
    },
  ];

  // Save updated registration file
  fs.writeFileSync(
    "agent-registration.json",
    JSON.stringify(agentRegistration, null, 2)
  );
  console.log(`\n📄 Saved agent-registration.json with agentId`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
