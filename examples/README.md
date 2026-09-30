# Runnable agent workflows

Requires Node 22+. Start with no wallet and no payment:

```sh
git clone https://github.com/fernsugi/x402-api-server
cd x402-api-server
npm ci
node examples/demo.mjs token-check
node examples/demo.mjs funding-compare
node examples/demo.mjs swap-cost
```

| Workflow | Requests | Total USDC |
|---|---|---:|
| token-check | PEPE security + sampled holders | 0.008 |
| funding-compare | ETH Hyperliquid/dYdX hourly rates | 0.008 |
| swap-cost | 1 ETH → USDC ParaSwap quote + gas | 0.003 |

The default run only fetches HTTP 402 requirements. It signs nothing and spends nothing. The browser demos show recorded public-provider output; their capture time and development payment bypass are explicitly labelled.

## Buy live data explicitly

Use a dedicated client wallet funded with USDC on Base. Add its private key locally to ignored `.env.local` as `X402_TEST_CLIENT_PRIVATE_KEY`; do not share it or use the API operator's settlement key. Then:

```sh
X402_DEMO_MAX_USDC=0.008 node examples/demo.mjs token-check --pay
```

The total cap defaults to the workflow's listed cost (maximum configurable cap 0.10 USDC). The client checks Base, canonical USDC, the official recipient, EIP-3009 support, and each exact price before signing. A changed price aborts. Each request may charge again. Ambiguous network failures never trigger an automatic payment retry. The API operator sponsors transaction gas in direct settlement mode.

`node examples/demo.mjs all-endpoints` inspects all eight routes with valid queries. `--pay` spends at most 0.033 USDC at unchanged prices and labels requests `test`, separate from customer attribution.

## Coverage

- Token workflow: GoPlus flags and a top-holder sample; not an audit, Gini, or transfer monitoring.
- Funding: hourly current and predicted observations; indicative spread, no fees or basis risk.
- Swap: one ParaSwap aggregate route, estimates only; no independent venue comparison or trade execution.

[Browser demos](https://x402-api.fly.dev/demos/?utm_source=github) · [MCP client](https://github.com/fernsugi/x402-api-mcp-server)
