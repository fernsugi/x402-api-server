# @x402-api/mcp-server

> MCP server that gives Claude, ChatGPT, and any MCP-compatible AI agent access to pay-per-call crypto/DeFi data via the [x402 protocol](https://github.com/coinbase/x402).

**8 tools. No API keys. AI agents pay USDC micropayments on Base, per request.**

```
  ██╗  ██╗██╗  ██╗ ██████╗ ██████╗
   ╚██╗██╔╝██║  ██║██╔═══██╗╚════██╗
    ╚███╔╝ ███████║██║   ██║ █████╔╝
    ██╔██╗ ╚════██║██║   ██║██╔═══╝
   ██╔╝ ██╗     ██║╚██████╔╝███████╗
   ╚═╝  ╚═╝     ╚═╝ ╚═════╝ ╚══════╝
```

## Tools

| Tool | API Endpoint | Cost | Description |
|------|-------------|------|-------------|
| `get_crypto_prices` | `GET /api/price-feed` | 0.001 USDC | BTC/ETH/SOL + top 24h movers |
| `get_gas_prices` | `GET /api/gas-tracker` | 0.001 USDC | Multi-chain gas (ETH, Base, Polygon, Arbitrum) |
| `get_dex_quotes` | `GET /api/dex-quotes` | 0.002 USDC | Swap quotes: Uniswap, SushiSwap, 1inch |
| `scan_token` | `GET /api/token-scanner` | 0.003 USDC | Token security scan + rug-pull detection |
| `track_whales` | `GET /api/whale-tracker` | 0.005 USDC | Holder concentration + whale alerts |
| `scan_yields` | `GET /api/yield-scanner` | 0.005 USDC | DeFi yields: Aave, Compound, Morpho, Lido, Pendle |
| `get_funding_rates` | `GET /api/funding-rates` | 0.008 USDC | Perp funding rates across 6 venues |
| `profile_wallet` | `GET /api/wallet-profiler` | 0.008 USDC | Full wallet portfolio + risk profile |

---

## Quick Start

### Option A: Inspect mode (no payment needed)

Just run it — any 402 responses will return human-readable payment instructions:

```bash
npx @x402-api/mcp-server
```

Claude will tell you what's needed when a tool requires payment.

### Option B: Auto-pay mode (fully autonomous)

Install optional payment deps and set your wallet key:

```bash
npm install -g @x402-api/mcp-server
npm install -g x402-fetch viem
export X402_WALLET_PRIVATE_KEY=0x<your_private_key>
x402-api-mcp
```

The server will auto-pay 402 responses using USDC on Base. **Make sure your wallet has USDC on Base mainnet.**

---

## Claude Desktop Integration

Add to your `claude_desktop_config.json`:

### Without auto-pay (inspect mode)

```json
{
  "mcpServers": {
    "x402-api": {
      "command": "npx",
      "args": ["@x402-api/mcp-server"]
    }
  }
}
```

### With auto-pay

```json
{
  "mcpServers": {
    "x402-api": {
      "command": "npx",
      "args": ["@x402-api/mcp-server"],
      "env": {
        "X402_WALLET_PRIVATE_KEY": "0x<your_private_key>"
      }
    }
  }
}
```

**Config file location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `X402_WALLET_PRIVATE_KEY` | Optional | Private key for auto-pay (e.g. `0x...`). If set, x402-fetch handles payments automatically. |
| `X402_API_BASE_URL` | Optional | Override API URL (default: `https://x402-api.fly.dev`) |

---

## How x402 Payments Work

This API uses the [x402 protocol](https://github.com/coinbase/x402) — HTTP 402 Payment Required:

1. **Agent calls tool** → MCP server makes API request
2. **Server returns 402** with payment details (amount, USDC address, Base network)
3. **Auto-pay mode:** x402-fetch signs and submits payment, retries request automatically
4. **Manual mode:** MCP returns 402 details so user/agent can arrange payment

**Payment details:**
- Token: USDC on Base mainnet
- Address: `0x60264c480b67adb557efEd22Cf0e7ceA792DefB7`
- Chain: Base (chain ID 8453)
- Amount: 0.001–0.008 USDC per call (< 1 cent USD)

---

## Tool Reference

### `get_crypto_prices`
No parameters. Returns current prices for BTC, ETH, SOL + top 24h movers.

```
Cost: 0.001 USDC
```

### `get_gas_prices`
No parameters. Returns gas prices for Ethereum, Base, Polygon, Arbitrum — slow/standard/fast tiers.

```
Cost: 0.001 USDC
```

### `get_dex_quotes`
Compare swap quotes across DEXes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | ✅ | Input token (e.g. `"ETH"`, `"0x..."`) |
| `to` | string | ✅ | Output token (e.g. `"USDC"`) |
| `amount` | string | ✅ | Amount to swap (e.g. `"1.5"`) |

```
Cost: 0.002 USDC
```

### `scan_token`
Token security scan — detects rug-pull flags, honeypot patterns, mint authority, etc.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | ✅ | Contract address or symbol (e.g. `"PEPE"`) |

```
Cost: 0.003 USDC
```

### `track_whales`
Whale tracking — holder concentration, Gini coefficient, recent large moves.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | ✅ | Contract address or symbol |

```
Cost: 0.005 USDC
```

### `scan_yields`
Top DeFi yield opportunities across Aave, Compound, Morpho, Lido, Pendle, etc.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chain` | string | ❌ | Filter by chain: `"ethereum"`, `"base"`, `"arbitrum"`, `"polygon"` |
| `min_tvl` | number | ❌ | Minimum TVL in USD (e.g. `1000000`) |

```
Cost: 0.005 USDC
```

### `get_funding_rates`
Perpetual funding rates across Binance, OKX, Bybit, dYdX, GMX, Hyperliquid.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `asset` | string | ❌ | Asset symbol (e.g. `"BTC"`, `"ETH"`). All assets if omitted. |

```
Cost: 0.008 USDC
```

### `profile_wallet`
Full wallet portfolio analysis — holdings, DeFi positions, activity, PnL, risk score.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | ✅ | Ethereum/Base wallet address (`0x...`) |

```
Cost: 0.008 USDC
```

---

## Development

```bash
git clone https://github.com/sugi/x402-api-server
cd x402-api-server/mcp-server

npm install
npm run build
npm start
```

To test without a payment wallet, simply run and see the 402 responses:

```bash
node dist/index.js
```

---

## Links

- [x402 API Landing Page](https://x402-api.fly.dev)
- [x402 Protocol](https://github.com/coinbase/x402)
- [Base Chain](https://base.org)
- [ERC-8004 Agent Identity](https://eips.ethereum.org/EIPS/eip-8004)
- [Agent #18763 on BaseScan](https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)

---

## License

MIT
