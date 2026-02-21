# x402 API Server

> **Pay-per-call crypto/DeFi data API using the HTTP 402 Payment Required protocol.**  
> No API keys. No subscriptions. Agents pay USDC on Base, per request.

```
  ██╗  ██╗██╗  ██╗ ██████╗ ██████╗
   ╚██╗██╔╝██║  ██║██╔═══██╗╚════██╗
    ╚███╔╝ ███████║██║   ██║ █████╔╝
    ██╔██╗ ╚════██║██║   ██║██╔═══╝
   ██╔╝ ██╗     ██║╚██████╔╝███████╗
   ╚═╝  ╚═╝     ╚═╝ ╚═════╝ ╚══════╝
```

Port `4020` — because x402 → 4020. 

---

## What is x402?

HTTP status code **402 ("Payment Required")** has existed since 1996 but was never widely used. The x402 protocol formalizes it as a standard for HTTP-native micropayments:

1. **Agent hits endpoint** — no auth header required
2. **Server returns `402`** with payment details (asset, amount, payTo address on Base)
3. **Agent sends USDC on Base** — gets a transaction hash
4. **Agent re-sends request** with `X-PAYMENT: <encoded-tx-proof>` header
5. **Server verifies on-chain** → returns data (or rejects if invalid)

**No API keys. No OAuth. No Stripe. Just HTTP + USDC + ~200ms.**

This is especially powerful for **AI agents** — they can autonomously discover and pay for data without human intervention. The entire payment lifecycle is machine-readable.

---

## Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/price-feed` | **0.001 USDC** | BTC/ETH/SOL prices + top 24h movers (live CoinGecko) |
| `GET /api/whale-tracker` | **0.005 USDC** | Token holder concentration, Gini coefficient, whale alerts |
| `GET /api/funding-rates` | **0.008 USDC** | Perp funding rates across Hyperliquid/dYdX/Aevo/GMX/Drift/Vertex + arb ranking |
| `GET /api/endpoints` | **Free** | Machine-readable endpoint catalog (for AI agent discovery) |
| `GET /health` | **Free** | Server health check |
| `GET /` | **Free** | Landing page |

---

## Quick Start

### Prerequisites
- Node.js v18+ (v22 recommended)
- npm

### Install & Run

```bash
git clone <repo>
cd x402-api-server
npm install
npm start
```

Server starts at **http://localhost:4020**

For development with auto-reload:
```bash
npm run dev
```

### Environment Variables

```bash
PORT=4020                        # Default: 4020
PAY_TO_ADDRESS=0xYourWallet...   # Your USDC receiving address on Base
```

---

## Testing the Protocol

### Step 1 — Hit an endpoint without payment (→ 402)

```bash
curl -i http://localhost:4020/api/price-feed
```

Response:
```
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "error": "Payment Required",
  "accepts": [{
    "scheme": "exact",
    "network": "base",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    "maxAmountRequired": "1000",
    "resource": "http://localhost:4020/api/price-feed",
    "description": "Aggregated crypto price feed...",
    "extra": { "chainId": 8453 }
  }]
}
```

### Step 2 — Re-send with X-PAYMENT header (→ 200)

```bash
# In MOCK MODE: any non-empty header value is accepted
curl http://localhost:4020/api/price-feed \
  -H "X-Payment: any-test-value"
```

Response:
```json
{
  "timestamp": "2026-02-21T08:00:00.000Z",
  "source": "CoinGecko",
  "cached": false,
  "payment": {
    "verified": true,
    "mock": true,
    "txHash": "0xMOCK_TX_HASH_NOT_REAL"
  },
  "data": {
    "core": [
      { "id": "bitcoin", "price_usd": 98000, "change_24h_pct": 2.1 },
      { "id": "ethereum", "price_usd": 2750, "change_24h_pct": -0.8 },
      { "id": "solana", "price_usd": 185, "change_24h_pct": 4.2 }
    ],
    "top_movers": {
      "gainers": [...],
      "losers": [...]
    }
  }
}
```

### Whale Tracker with query params

```bash
curl "http://localhost:4020/api/whale-tracker?token=BTC&chain=ethereum" \
  -H "X-Payment: test"
```

### Funding Rates — filter for strong arb only

```bash
curl "http://localhost:4020/api/funding-rates?min_spread=2" \
  -H "X-Payment: test"
```

---

## Architecture

```
x402-api-server/
├── src/
│   ├── index.js                 # Express server (port 4020)
│   ├── middleware/
│   │   └── x402.js              # x402 payment gate middleware
│   ├── routes/
│   │   ├── priceFeed.js         # /api/price-feed (CoinGecko, 60s cache)
│   │   ├── whaleTracker.js      # /api/whale-tracker (mock, wire Moralis)
│   │   └── fundingRates.js      # /api/funding-rates (mock, wire protocol APIs)
│   ├── services/
│   │   └── mockVerifier.js      # ⚠️ Mock verifier — replace with real Base chain check
│   └── views/
│       └── index.html           # Dark-theme landing page
├── package.json
└── README.md
```

### The x402 Middleware (`src/middleware/x402.js`)

```js
const { requirePayment } = require('./middleware/x402');

router.get('/api/my-endpoint',
  requirePayment({
    resource: '/api/my-endpoint',
    description: 'What this endpoint does',
    maxAmountRequired: 1000, // 0.001 USDC (6 decimal places)
  }),
  myHandler
);
```

That's it. The middleware handles the full 402 flow.

---

## ⚠️ Mock Mode — Making It Real

> **Current state:** `src/services/mockVerifier.js` accepts any non-empty `X-PAYMENT` header.  
> This is fine for development but **DO NOT run in production without real verification.**

### To wire up real Base chain verification:

```js
// src/services/mockVerifier.js — replace verifyPayment() with:

const { ethers } = require('ethers');

const USDC_ABI = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base mainnet
const BASE_RPC = 'https://mainnet.base.org';

async function verifyPayment(paymentHeader, { payTo, maxAmountRequired }) {
  const { txHash, payer } = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());

  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt || receipt.status !== 1) return { valid: false, reason: 'Tx failed or not found' };

  const iface = new ethers.Interface(USDC_ABI);
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) continue;
    const parsed = iface.parseLog(log);
    if (
      parsed.name === 'Transfer' &&
      parsed.args.to.toLowerCase() === payTo.toLowerCase() &&
      parsed.args.value >= BigInt(maxAmountRequired)
    ) {
      // TODO: check txHash not already used (replay protection)
      return { valid: true, txHash, payer, amount: parsed.args.value.toString() };
    }
  }

  return { valid: false, reason: 'No valid USDC transfer found in tx' };
}
```

### Production checklist:
- [ ] Replace mock verifier with real ethers.js call above
- [ ] Add Redis for replay attack protection (store used txHashes)
- [ ] Set `PAY_TO_ADDRESS` env var to your real wallet
- [ ] Wire up Moralis/Alchemy for real whale tracker data
- [ ] Call real protocol REST APIs for funding rates
- [ ] Add rate limiting per payer address
- [ ] Register as ERC-8004 agent on Base for discovery
- [ ] List on [Apiosk](https://apiosk.com) for AI agent discoverability

---

## x402 Payment Header Format

The real x402 wire format uses Base64-encoded JSON:

```js
// Client builds this after paying on-chain:
const payload = {
  txHash: '0xabc123...',
  payer: '0xYourAddress',
  amount: '1000',        // USDC micro-units
  timestamp: Date.now(),
};
const headerValue = Buffer.from(JSON.stringify(payload)).toString('base64');

// Then sends:
headers: { 'X-Payment': headerValue }
```

The server decodes this, fetches the tx from Base, and verifies the USDC transfer.

---

## Links

- **x402 Spec:** https://github.com/coinbase/x402
- **Base Chain:** https://base.org (chain ID: 8453)
- **USDC on Base:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Apiosk (x402 marketplace):** https://apiosk.com
- **ERC-8004 (Agent Identity Standard):** on-chain agent registry on Base

---

## License

MIT
