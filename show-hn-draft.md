# Show HN Draft

## Title

Show HN: A DeFi data API where AI agents pay per call via HTTP 402 micropayments

## Body

HTTP 402 Payment Required has been in the spec since 1997, "reserved for future use." Turns out the future is AI agents that need to pay for API calls without signing up for anything.

I built a DeFi/crypto data API that uses the x402 protocol (by Coinbase) to handle payment natively in the HTTP layer. No API keys, no subscriptions, no accounts. An agent sends a request, gets back a 402 with payment details, pays in USDC on Base, and retries — all in one flow.

**How it works:**

1. Client calls an endpoint
2. Server returns `402` with a payment challenge in the headers
3. Client signs a USDC payment (0.001–0.008 USDC per call) and retries with a payment proof header
4. Server verifies payment on-chain and returns the data

The x402 facilitator (middleware) handles verification, so the server just defines prices and serves data.

**8 endpoints currently live:**

- Token prices (multi-source aggregated)
- Gas tracker (across chains)
- DEX swap quotes
- Token security scanner (honeypot detection, tax analysis)
- Whale transaction tracker
- DeFi yield scanner
- Funding rates (perps)
- Wallet profiler

Each call costs fractions of a cent. An agent doing 1,000 lookups/day spends ~$1–5.

Built with Express.js. The server is registered as ERC-8004 Agent #18763 on Base mainnet. The whole thing is ~500 lines of code — most of the complexity lives in the x402 facilitator library.

I think this pattern — HTTP-native micropayments for machine-to-machine APIs — is underexplored. The protocol fits surprisingly well for agentic workflows where you want fine-grained, permissionless access without onboarding friction.

Live: https://x402-api.fly.dev
Code: https://github.com/fernsugi/x402-api-server
Writeup: https://dev.to/fernsugi/i-built-a-defi-data-api-where-ai-agents-pay-per-call-heres-how-oeg
