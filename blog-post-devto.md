---
title: I Built a DeFi Data API Where AI Agents Pay Per Call — Here's How
published: false
description: No API keys. No subscriptions. AI agents pay USDC micropayments on Base, per request, using the x402 HTTP protocol. Here's what I built and what I learned.
tags: x402, defi, ai, webdev
cover_image:
canonical_url:
---

Last week I deployed something I've wanted to build for a while: a crypto/DeFi data API where **the client pays per call in USDC, with no API keys, no accounts, and no subscriptions**. The payment happens as part of the HTTP request itself.

It's live at [https://x402-api.fly.dev](https://x402-api.fly.dev) and it already has an on-chain identity: **Agent #18763** on Base via ERC-8004. Here's what it does, how the payment flow works, and what surprised me along the way.

---

## Why x402?

If you haven't heard of [x402](https://github.com/coinbase/x402), the short version: it's a protocol built on top of the long-forgotten `HTTP 402 Payment Required` status code. The idea is simple — a server responds with a 402 and tells the client exactly how much to pay and where. The client sends the payment as a header on the next (or retried) request. The server verifies it and responds with the actual data.

No OAuth dance. No rate-limit tiers. No billing portal. Just: "this costs 0.003 USDC, pay here, get data."

Why does this matter for AI agents specifically? Because agents are increasingly autonomous. An agent running a trading strategy or doing research doesn't have a human reaching for a credit card — it needs to be able to buy services on its own. x402 + USDC on Base makes that possible with sub-cent micropayments that settle in seconds.

---

## What the API Does

I built 8 paid endpoints, all DeFi/crypto data:

| Endpoint | Price | What it returns |
|---|---|---|
| `GET /api/price-feed` | 0.001 USDC | BTC/ETH/SOL prices + top 24h movers (live CoinGecko) |
| `GET /api/gas-tracker` | 0.001 USDC | Multi-chain gas across ETH, Base, Polygon, Arbitrum |
| `GET /api/dex-quotes` | 0.002 USDC | Swap quote comparison: Uniswap, SushiSwap, 1inch |
| `GET /api/token-scanner` | 0.003 USDC | Token security analysis + rug-pull risk flags |
| `GET /api/whale-tracker` | 0.005 USDC | Holder concentration, Gini coefficient, whale alerts |
| `GET /api/yield-scanner` | 0.005 USDC | Top DeFi yields: Aave, Compound, Morpho, Lido, Pendle |
| `GET /api/funding-rates` | 0.008 USDC | Perp funding rates across 6 venues + arb ranking |
| `GET /api/wallet-profiler` | 0.008 USDC | Wallet portfolio, holdings, activity, risk profile |

Plus `/api/endpoints` (free, machine-readable catalog) and `/health` (free).

Pricing is intentionally micro — the most expensive call is less than a cent. The goal isn't to make money off any single call but to prove the payment model works end-to-end.

---

## How the Payment Flow Works

Here's the exact HTTP exchange:

**Step 1 — Client hits the endpoint without payment:**
```
GET /api/price-feed HTTP/1.1
Host: x402-api.fly.dev
```

**Step 2 — Server responds 402:**
```
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "error": "Payment required",
  "accepts": [{
    "scheme": "exact",
    "network": "base-mainnet",
    "maxAmountRequired": "1000",
    "resource": "https://x402-api.fly.dev/api/price-feed",
    "description": "Aggregated crypto prices",
    "mimeType": "application/json",
    "payTo": "0x60264c480b67adb557efEd22Cf0e7ceA792DefB7",
    "maxTimeoutSeconds": 60,
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "extra": { "name": "USDC", "version": "2" }
  }]
}
```

(Amounts are in USDC's 6-decimal units: `1000` = 0.001 USDC.)

**Step 3 — Client signs a `transferWithAuthorization` EIP-712 payload and retries:**
```
GET /api/price-feed HTTP/1.1
Host: x402-api.fly.dev
X-Payment: <base64-encoded payment payload>
```

**Step 4 — Server verifies the signature and returns data.**

The verification checks: valid EIP-3009 signature, correct recipient address, sufficient amount, valid time window, and nonce hasn't been used (replay protection).

---

## Using It With `x402-fetch`

If you're building an AI agent or just want to test this, Coinbase's `x402-fetch` package handles the 402 → pay → retry cycle automatically:

```typescript
import { wrapFetchWithPayment } from 'x402-fetch';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Set up a wallet with some USDC on Base
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

// Wrap fetch — payment happens automatically on 402
const fetchWithPayment = wrapFetchWithPayment(fetch, walletClient);

// Now just call the API like any other API
const response = await fetchWithPayment('https://x402-api.fly.dev/api/price-feed');
const data = await response.json();

console.log(data);
// {
//   "timestamp": "2026-02-22T13:00:00Z",
//   "prices": {
//     "BTC": { "usd": 94250, "change_24h": 2.3 },
//     "ETH": { "usd": 3180, "change_24h": 1.8 },
//     "SOL": { "usd": 172, "change_24h": -0.9 }
//   },
//   "top_movers": [ ... ]
// }
```

That's it. The agent doesn't know or care about API keys. It just needs USDC in its wallet. The payment is 0.001 USDC — less than a tenth of a cent.

---

## ERC-8004: Giving the Agent an On-Chain Identity

One thing I didn't expect to care about but ended up finding really cool: [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004), a proposed standard for on-chain agent identity registration.

The idea is that AI agents (or services acting on their behalf) can register themselves in a smart contract registry on-chain. Anyone can look up the agent, see what it does, what x402 endpoints it exposes, and whether it's active.

I registered this API as **Agent #18763** on the Base mainnet registry:
- Registry contract: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Chain: Base (EIP-155 chain ID 8453)
- x402 endpoint: `https://x402-api.fly.dev/`

The registration lives in `agent-registration.json` in the repo:

```json
{
  "name": "x402-api",
  "description": "Pay-per-call DeFi & crypto data API. 8 endpoints: price feeds, whale tracking, gas tracker, DEX quotes, token scanner, yield scanner, funding rates, wallet profiler. Powered by x402 protocol — USDC micropayments on Base, no API keys needed.",
  "x402Support": true,
  "active": true,
  "registrations": [{
    "agentId": 18763,
    "agentRegistry": "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
  }]
}
```

The longer-term vision here is that AI agents could autonomously discover other agents or services through on-chain registries like this — no centralized directory needed. An agent looking for DeFi data would query the registry, find Agent #18763, read its endpoint catalog, and start paying for calls. All without human intervention.

That's a future I want to build toward.

---

## What I Learned Building This

**Payment verification is the hard part.** The 402 response format is fairly straightforward — it's just JSON. Verifying the payment client-side is also handled by `x402-fetch`. But server-side verification of EIP-3009 `transferWithAuthorization` signatures is fiddly. I ended up implementing both signature verification (check the EIP-712 payload) and tx hash verification (confirm the transaction actually landed on-chain). In dev mode I just accept any non-empty `X-Payment` header, which makes testing much faster.

**Replay protection matters immediately.** Without it, a malicious client could reuse one payment authorization for unlimited calls. I'm tracking used nonces in-memory for now — works fine for a single instance but would need Redis for multi-replica deployments.

**The 402 response structure is critical.** The `maxAmountRequired` field, the `asset` address, the `payTo` address — if any of these are wrong or misformatted, `x402-fetch` fails silently or the payment gets rejected. I spent more time debugging the response JSON than anything else.

**Fly.io + Node.js was a great combo for this.** Cold starts are fast, the free tier handles the load, and the `fly.toml` config is dead simple. Deployed with a single `fly deploy`.

**Mock data is fine to start.** Most of my endpoints currently return realistic-but-mocked data. The price feed and gas tracker hit real APIs; everything else is canned. That's intentional — I wanted the payment flow to work correctly before worrying about data quality. Real data integrations are next.

---

## What's Next

- Swap mock data for real API integrations (DeFiLlama, The Graph, Etherscan)
- Add Redis for distributed replay protection
- Migrate to the official `x402-server-express` SDK when it lands on npm
- Try listing on [Apiosk](https://apiosk.com) to see if agents organically discover it

---

## Try It / Give Me Feedback

The API is live now: **[https://x402-api.fly.dev](https://x402-api.fly.dev)**

Hit the landing page to see the endpoint catalog, or curl it directly:

```bash
# See the 402 response (no payment needed to see the payment instructions)
curl -i https://x402-api.fly.dev/api/price-feed
```

If you're building with x402, I'd love to hear what you're working on. If something is broken or the price points feel wrong, tell me. This is a first draft of an idea — feedback is the whole point.

GitHub + deploy instructions in the repo. DMs open.

---

---

## Show HN Draft

---

**Title:**
> Show HN: A DeFi data API where AI agents pay per call in USDC (no API keys)

**Description:**
> I built a pay-per-call crypto/DeFi data API using the x402 protocol (HTTP 402 Payment Required). 8 endpoints — price feeds, whale tracking, DEX quotes, gas tracker, yield scanner, funding rates, token scanner, wallet profiler — ranging from 0.001 to 0.008 USDC per call. No accounts, no API keys: clients (or AI agents) pay with USDC on Base, the server verifies the EIP-3009 signature, and returns data. Uses `x402-fetch` on the client side for the 402→pay→retry loop. Also registered as Agent #18763 on the ERC-8004 on-chain agent registry on Base. Live at https://x402-api.fly.dev — curious what people think of the payment model and whether anyone's actually building autonomous agents that need to pay for external data.
