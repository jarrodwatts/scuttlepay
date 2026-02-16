---
name: ScuttlePay API
description: >-
  This skill should be used when the user needs to interact with the ScuttlePay API
  to manage an AI agent's USDC wallet. Typical triggers: "check my ScuttlePay balance",
  "search products on ScuttlePay", "buy a product with USDC",
  "view my transaction history", "get my wallet address", "list merchants",
  or any request to call ScuttlePay endpoints
  (/wallet, /merchants, /products, /purchase, /transactions).
version: 0.1.0
---

# ScuttlePay API

Wallet-as-a-service for AI agents. Agents hold USDC wallets, search Shopify storefronts, and execute on-chain purchases on Base.

## Configuration

Two environment variables are required:

- `SCUTTLEPAY_API_KEY` — API key starting with `sk_`
- `SCUTTLEPAY_API_URL` — Base URL of the ScuttlePay instance (e.g. `https://scuttlepay.com`)

Read these from the environment before making requests. If either is missing, stop and tell the user:
`SCUTTLEPAY_API_KEY not set. Run: export SCUTTLEPAY_API_KEY=sk_... (get your key from the ScuttlePay dashboard)`

## Authentication

Include on every request:

```
Authorization: Bearer <SCUTTLEPAY_API_KEY>
Content-Type: application/json
```

## Making Requests

Use WebFetch for all API calls. Construct the full URL by joining `SCUTTLEPAY_API_URL` with the endpoint path (e.g. `https://scuttlepay.com` + `/api/mcp/wallet`).

## Endpoints

### GET /api/mcp/wallet

Get wallet balance and info.

**Response:**
```json
{
  "data": {
    "id": "string",
    "address": "0x...",
    "chainId": 8453,
    "label": "string",
    "balance": "150.50"
  }
}
```

`balance` is a USDC string with up to 6 decimal places.

---

### GET /api/mcp/merchants

List available merchants (Shopify stores).

**Response:**
```json
{
  "data": [
    { "id": "string", "shopDomain": "store.myshopify.com" }
  ]
}
```

---

### GET /api/mcp/products

Search or fetch product details.

**Query parameters:**
- `merchantId` (required) — merchant ID from `/merchants`
- `q` — search query (for searching)
- `id` — product ID (for fetching a specific product)
- `limit` — max results, default 10, max 50

Provide either `q` or `id`, not both.

**Search response:**
```json
{
  "data": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "priceUsdc": "25.00",
      "imageUrl": "string | null"
    }
  ]
}
```

**Product detail response** (when using `id`):
```json
{
  "data": {
    "id": "string",
    "title": "string",
    "description": "string",
    "priceUsdc": "25.00",
    "images": ["url"],
    "variants": [
      { "id": "string", "title": "Size M", "priceUsdc": "25.00" }
    ]
  }
}
```

---

### POST /api/mcp/purchase

Execute a purchase. Sends USDC on-chain and creates a Shopify order.

**Request body:**
```json
{
  "merchantId": "string (required)",
  "productId": "string (required)",
  "variantId": "string (optional — required if product has multiple variants)",
  "quantity": 1,
  "shippingAddress": {
    "address1": "string",
    "city": "string",
    "provinceCode": "CA",
    "countryCode": "US",
    "zip": "90210"
  }
}
```

**Response:**
```json
{
  "data": {
    "transactionId": "string",
    "txHash": "0x...",
    "orderNumber": "string | null",
    "product": { "id": "string", "name": "string" },
    "amount": "25.00",
    "status": "SETTLED"
  }
}
```

Always confirm the purchase amount and product with the user before calling this endpoint.

---

### GET /api/mcp/transactions

View transaction history.

**Query parameters:**
- `limit` — results per page, default 20, max 100
- `cursor` — ISO-8601 timestamp for pagination (from `nextCursor` in previous response)

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "type": "PURCHASE | DEPOSIT | WITHDRAWAL",
      "status": "PENDING | SETTLED | FAILED",
      "amountUsdc": "25.00",
      "txHash": "0x... | null",
      "productName": "string | null",
      "storeUrl": "string | null",
      "initiatedAt": "2025-01-15T10:30:00Z",
      "settledAt": "2025-01-15T10:30:05Z | null"
    }
  ],
  "nextCursor": "2025-01-15T10:30:00Z | null"
}
```

## Error Handling

All errors follow this shape:

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Wallet balance too low for this purchase",
    "retriable": false
  }
}
```

**Error codes:** `INSUFFICIENT_BALANCE`, `SPENDING_LIMIT_EXCEEDED`, `PAYMENT_FAILED`, `PRODUCT_NOT_FOUND`, `WALLET_NOT_FOUND`, `UNAUTHORIZED`, `VALIDATION_ERROR`, `RATE_LIMITED`

If `retriable` is `true`, wait briefly and retry. Otherwise, surface the error message to the user.

## Typical Workflow

1. Check balance via `/wallet`
2. List merchants via `/merchants`
3. Search products via `/products?merchantId=...&q=...`
4. Get product details via `/products?merchantId=...&id=...`
5. Confirm with user, then purchase via `/purchase`
6. Verify transaction via `/transactions`

## Important Notes

- USDC amounts are always strings with up to 6 decimal places — never use floating point arithmetic
- Always confirm purchases with the user before executing
- The `txHash` can be viewed on Base block explorer: `https://basescan.org/tx/<txHash>`
- For testnet (Base Sepolia): `https://sepolia.basescan.org/tx/<txHash>`
