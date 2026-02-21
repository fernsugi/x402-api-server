# x402 API Server

> **Pay-per-call crypto/DeFi data API using HTTP 402 Payment Required.**  
> No API keys. No subscriptions. AI agents pay USDC on Base, per request.

```
  ██╗  ██╗██╗  ██╗ ██████╗ ██████╗
   ╚██╗██╔╝██║  ██║██╔═══██╗╚════██╗
    ╚███╔╝ ███████║██║   ██║ █████╔╝
    ██╔██╗ ╚════██║██║   ██║██╔═══╝
   ██╔╝ ██╗     ██║╚██████╔╝███████╗
   ╚═╝  ╚═╝     ╚═╝ ╚═════╝ ╚══════╝
```

**Receiving wallet:** `0x60264c480b67adb557efEd22Cf0e7ceA792DefB7`  
**Network:** Base mainnet (chain ID 8453)  
**Asset:** USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)

---

## Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/price-feed` | **0.001 USDC** | BTC/ETH/SOL prices + top 24h movers (live CoinGecko) |
| `GET /api/whale-tracker` | **0.005 USDC** | Token holder concentration, Gini coefficient, whale alerts |
| `GET /api/funding-rates` | **0.008 USDC** | Perp funding rates across 6 venues + arb ranking |
| `GET /api/gas-tracker` | **0.001 USDC** | Multi-chain gas prices (ETH, Base, Polygon, Arbitrum) with speed tiers |
| `GET /api/token-scanner` | **0.003 USDC** | Token security & risk analysis — rug-pull detection flags |
| `GET /api/dex-quotes` | **0.002 USDC** | Compare swap quotes across Uniswap, SushiSwap, 1inch |
| `GET /api/yield-scanner` | **0.005 USDC** | Top DeFi yields across Aave, Compound, Morpho, Lido, Pendle + more |
| `GET /api/wallet-profiler` | **0.008 USDC** | Wallet portfolio analysis, holdings, activity, risk profile |
| `GET /api/endpoints` | **Free** | Machine-readable endpoint catalog |
| `GET /health` | **Free** | Health check |

---

## Quick Start (Development)

```bash
cp .env.example .env  # defaults to development mode
npm install
npm run dev           # auto-reload on changes
```

In development mode (`NODE_ENV=development`), any non-empty `X-PAYMENT` header is accepted for testing.

```bash
# Get a 402 response with payment instructions
curl -i http://localhost:4020/api/price-feed

# Pay with mock header (dev only)
curl http://localhost:4020/api/price-feed -H "X-Payment: test"
```

---

## Production Deployment

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PAY_TO_ADDRESS` | `0x60264c...DefB7` | Your USDC receiving wallet on Base |
| `PORT` | `4020` | Server port |
| `NODE_ENV` | `development` | Set to `production` for real verification |
| `BASE_RPC_URL` | `https://mainnet.base.org` | Base RPC (use Alchemy/QuickNode in prod) |

### Deploy to Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh
fly auth login

# First-time setup
./deploy.sh init

# Subsequent deploys
./deploy.sh
```

### Deploy with Docker

```bash
docker compose up -d
```

### Production Verification

In production mode (`NODE_ENV=production`), the server verifies payments two ways:

1. **EIP-3009 signature verification** — validates the `transferWithAuthorization` EIP-712 signature, checks amounts, recipient, timing, and on-chain nonce state
2. **Transaction hash verification** — confirms a submitted Base transaction contains a USDC transfer to our address with sufficient amount

Both include replay protection (in-memory; use Redis for multi-instance).

### Upgrade to Official SDK

When `x402-server-express` becomes available on npm:

```bash
npm install x402-server-express
```

Then replace `src/services/verifier.js` with the facilitator-based approach — see comments in that file or the go-live guide.

---

## Architecture

```
src/
├── index.js                 # Express server + graceful shutdown
├── middleware/
│   └── x402.js              # x402 payment gate middleware
├── routes/
│   ├── priceFeed.js         # /api/price-feed (live CoinGecko data)
│   ├── whaleTracker.js      # /api/whale-tracker (mock data)
│   ├── fundingRates.js      # /api/funding-rates (mock data)
│   ├── gasTracker.js        # /api/gas-tracker (real RPC + mock fallback)
│   ├── tokenScanner.js      # /api/token-scanner (mock data)
│   ├── dexQuotes.js         # /api/dex-quotes (mock data)
│   ├── yieldScanner.js      # /api/yield-scanner (mock data)
│   └── walletProfiler.js    # /api/wallet-profiler (mock data)
├── services/
│   ├── verifier.js          # Production payment verifier (EIP-3009 + tx hash)
│   └── mockVerifier.js      # Legacy mock (kept for reference)
└── views/
    └── index.html           # Landing page
```

---

## Links

- [x402 Protocol](https://github.com/coinbase/x402)
- [Base Chain](https://base.org)
- [Apiosk Marketplace](https://apiosk.com)
- [ERC-8004 Agent Identity](https://eips.ethereum.org/EIPS/eip-8004)

## License

MIT
