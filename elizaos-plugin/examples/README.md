# x402-api ElizaOS Plugin Examples

This directory contains practical examples showing how to use the x402-api plugin with ElizaOS agents.

## 📁 Examples Overview

### 1. [basic-usage.ts](./basic-usage.ts)
**Complexity:** ⭐ Beginner
**Topics:** Plugin installation, configuration, simple price checks

Perfect starting point for new users. Shows minimal setup to get crypto prices via x402 micropayments.

**What you'll learn:**
- How to add x402DeFiPlugin to your character
- Environment variable configuration
- Understanding x402 payment flow
- Cost breakdown ($0.001 per query)

**Use case:** Build a simple price bot in under 5 minutes

---

### 2. [defi-portfolio.ts](./defi-portfolio.ts)
**Complexity:** ⭐⭐ Intermediate
**Topics:** Multi-endpoint usage, wallet analysis, yield tracking, cost optimization

Comprehensive portfolio tracking agent using multiple x402 endpoints.

**What you'll learn:**
- Using multiple actions (prices, gas, wallet profiler, yields)
- Custom plugin composition (select only endpoints you need)
- Cost optimization strategies
- Combining x402-api with other ElizaOS plugins

**Use case:** Daily portfolio tracker with $0.45/month operating cost

---

### 3. [price-monitoring.ts](./price-monitoring.ts)
**Complexity:** ⭐⭐⭐ Advanced
**Topics:** Background services, alerts, DEX aggregation, token security

Real-time monitoring system with automated alerts and multi-endpoint workflows.

**What you'll learn:**
- Setting up background price/gas monitoring
- Alert system implementation
- DEX quote comparison
- Token security scanning
- Multi-step optimization workflows

**Use case:** Automated trading assistant that monitors markets 24/7

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install @x402-api/elizaos-plugin x402-fetch viem
```

### 2. Configure your wallet

Create a `.env` file:

```bash
# Required: Your wallet's private key (hex format)
X402_WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Optional: For logging only
X402_WALLET_ADDRESS=0xYourAddress...

# Optional: Override API endpoint
X402_API_BASE_URL=https://x402-api.fly.dev
```

**⚠️ Security:** Never commit your `.env` file! Add it to `.gitignore`.

### 3. Fund your wallet

Your wallet needs:
- **USDC on Base** — for paying x402 API calls
- **ETH on Base** — for gas fees

Get USDC:
- [Coinbase](https://coinbase.com) → withdraw to Base
- [Uniswap on Base](https://app.uniswap.org) → swap ETH for USDC
- [bridge.base.org](https://bridge.base.org) → bridge from Ethereum

**Budget:** $1 USDC = 125-1000 queries depending on endpoint

### 4. Run an example

```bash
# Copy an example to your project
cp examples/basic-usage.ts src/character.ts

# Start your agent
npm run dev
```

---

## 💰 Cost Reference

| Action | Endpoint | Cost | Example Use |
|--------|----------|------|-------------|
| `GET_CRYPTO_PRICES` | `/api/price-feed` | $0.001 | "What are crypto prices?" |
| `GET_GAS_PRICES` | `/api/gas-tracker` | $0.001 | "Check gas fees" |
| `GET_DEX_QUOTES` | `/api/dex-quotes` | $0.002 | "Best swap rate ETH→USDC?" |
| `SCAN_TOKEN` | `/api/token-scanner` | $0.003 | "Is this token safe?" |
| `TRACK_WHALES` | `/api/whale-tracker` | $0.005 | "Whale activity for PEPE?" |
| `SCAN_YIELDS` | `/api/yield-scanner` | $0.005 | "Best USDC yields?" |
| `GET_FUNDING_RATES` | `/api/funding-rates` | $0.008 | "Perp funding rates?" |
| `PROFILE_WALLET` | `/api/wallet-profiler` | $0.008 | "Analyze wallet 0x..." |

**Total with $1 USDC:**
- 1,000 price checks
- 500 DEX quotes
- 125 wallet profiles

---

## 🎯 Use Case Matrix

| Want to build... | Start with | Key actions | Daily cost |
|-----------------|------------|-------------|------------|
| **Price bot** | basic-usage.ts | GET_CRYPTO_PRICES | $0.03 |
| **Gas optimizer** | basic-usage.ts | GET_GAS_PRICES | $0.02 |
| **Portfolio tracker** | defi-portfolio.ts | PROFILE_WALLET, SCAN_YIELDS | $0.45 |
| **DEX aggregator** | price-monitoring.ts | GET_DEX_QUOTES | $0.10 |
| **Security scanner** | price-monitoring.ts | SCAN_TOKEN | On-demand |
| **Whale watcher** | price-monitoring.ts | TRACK_WHALES | $0.15 |
| **Yield farmer** | defi-portfolio.ts | SCAN_YIELDS | $0.05 |
| **Trading bot** | price-monitoring.ts | All endpoints | $1-2 |

---

## 📚 Common Patterns

### Pattern 1: Price Check + Action

```typescript
// Check price, then execute based on result
const prices = await runtime.executeAction('GET_CRYPTO_PRICES', {});
if (prices.data.core.find(c => c.id === 'eth').price_usd < 2000) {
  // Alert user or execute trade
}
```

### Pattern 2: Gas Optimization

```typescript
// Wait for optimal gas before transaction
const gas = await runtime.executeAction('GET_GAS_PRICES', {});
if (gas.data.ethereum.fast.gwei < 30) {
  // Execute transaction now
} else {
  // Wait and check again in 5 minutes
}
```

### Pattern 3: Multi-Step Workflow

```typescript
// 1. Check if token is safe
const scan = await runtime.executeAction('SCAN_TOKEN', {
  token: '0x...',
  chain: 'ethereum'
});

if (scan.data.risk_score < 0.3) {
  // 2. Get best DEX quote
  const quotes = await runtime.executeAction('GET_DEX_QUOTES', {
    from: 'ETH',
    to: '0x...',
    amount: 1.0,
    chain: 'ethereum'
  });

  // 3. Check gas fees
  const gas = await runtime.executeAction('GET_GAS_PRICES', {});

  // 4. Decide whether to execute
  // Total cost: $0.001 + $0.002 + $0.003 + $0.001 = $0.007
}
```

### Pattern 4: Background Monitoring

```typescript
// Poll every 5 minutes, alert on changes
class PriceMonitor extends Service {
  async start() {
    setInterval(async () => {
      const prices = await this.runtime.executeAction('GET_CRYPTO_PRICES', {});

      // Compare with previous check
      const btc = prices.data.core.find(c => c.id === 'btc');
      if (Math.abs(btc.change_24h_pct) > 5) {
        await this.runtime.notify(`🚨 BTC moved ${btc.change_24h_pct}% today!`);
      }
    }, 300_000); // 5 minutes
  }
}
```

---

## 🔧 Troubleshooting

### Error: "x402-fetch not installed"

```bash
npm install x402-fetch viem
```

The plugin requires `x402-fetch` for automatic payments.

---

### Error: "No wallet configured"

Add `X402_WALLET_PRIVATE_KEY` to your `.env` file:

```bash
X402_WALLET_PRIVATE_KEY=0x1234567890abcdef...
```

**Get your private key:**
- MetaMask: Settings → Security & Privacy → Reveal Private Key
- Hardware wallet: Export from your wallet software

---

### Error: "Insufficient USDC balance"

Your wallet needs USDC on Base to pay for API calls.

**Fund via:**
1. [Coinbase](https://coinbase.com) — withdraw USDC to Base
2. [Uniswap](https://app.uniswap.org) — swap ETH for USDC on Base
3. [bridge.base.org](https://bridge.base.org) — bridge from Ethereum

Check balance: [BaseScan](https://basescan.org)

---

### Error: "Payment validation failed"

Your wallet needs **both** USDC (for payment) and ETH (for gas).

**Gas requirements:**
- ~$0.01-0.05 worth of ETH per transaction
- Get ETH on Base from [Uniswap](https://app.uniswap.org)

---

### Calls work once then fail

You might be hitting rate limits. The x402-api has:
- 100 requests/hour per IP
- 1000 requests/day per wallet

**Solutions:**
- Implement caching (see defi-portfolio.ts example)
- Reduce polling frequency
- Deploy your own x402-api instance

---

## 🌐 Additional Resources

- **Plugin docs:** [README.md](../README.md)
- **API docs:** https://x402-api.fly.dev/docs
- **x402 protocol:** https://x402.org
- **ElizaOS docs:** https://docs.elizaos.ai
- **GitHub:** https://github.com/sugi/x402-api-server

---

## 🤝 Contributing

Have an example you'd like to add? PRs welcome!

**Good example ideas:**
- NFT floor price tracker
- MEV bot (frontrun detection)
- Cross-chain arbitrage
- Liquidation monitor
- Staking rewards calculator

**Example template:**
1. Clear use case description
2. Full working code with comments
3. Cost breakdown
4. Expected output samples
5. Troubleshooting tips

---

## 📄 License

MIT © Sugi

All examples in this directory are MIT licensed and free to use in your projects.
