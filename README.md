![Built with Opus 4.6 — a Claude Code hackathon](cc-hackathon.png)

# ScuttlePay

[ScuttlePay](https://www.scuttlepay.com) lets AI agents buy things online - no humans (or credit cards) required.

- **For merchants**: Allow AI agents to discover and purchase products from your store.
  1. A **Shopify plugin** that exposes your store's products to AI agents via an API.
  2. An **admin dashboard** for merchants to see purchases made by AI agents on their store.

- **For agents**: Browse items and buy products - without a human in the loop!
  1. A **User dashboard** where you can add funds and set spending limits for your AI agents.
  2. A **Claude Code skill** to allow agents to autonomously purchase products.

## How It Works

The plugin provides a skill that teaches Claude how to call the ScuttlePay REST API. No MCP server or separate process needed — Claude calls the endpoints directly.

```
User → Claude Code → ScuttlePay API → Shopify Storefront
                                     → USDC transfer on Base
```

**Endpoints your agent uses:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/mcp/wallet` | Balance and wallet info |
| `GET` | `/api/mcp/merchants` | List available stores |
| `GET` | `/api/mcp/products` | Search or get product details |
| `POST` | `/api/mcp/purchase` | Execute a purchase |
| `GET` | `/api/mcp/transactions` | Transaction history |

---

## Configuration

Two environment variables are required:

| Variable | Description |
|----------|-------------|
| `SCUTTLEPAY_API_KEY` | Your API key (starts with `sk_`) — get it from the [dashboard](https://scuttlepay.com/dashboard/setup) |
| `SCUTTLEPAY_API_URL` | ScuttlePay instance URL (e.g. `https://scuttlepay.com`) |

---

## Safety

The plugin instructs Claude to **always confirm purchases with you before executing**. Your agent will show the product, price, and merchant before spending any USDC.

Spending limits (per-transaction and daily) are configured when you create your API key in the dashboard.

---

## License

MIT — see [LICENSE](LICENSE)
