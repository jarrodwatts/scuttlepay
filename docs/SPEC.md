# ScuttlePay — A Bank Account for AI Agents

## Context

**Problem**: AI agents can browse, research, and decide — but the moment they need to buy something, a human must step in with a credit card. Even with Shopify's new UCP/MCP agent tools, payment still requires either a pre-vaulted credit card (Shop Pay) or human UI interaction. Giving your agent your credit card is risky — no spending limits, no kill switch, full card exposure.

**Solution**: ScuttlePay gives AI agents their own bank account. Users fund a wallet, set spending limits, and agents can autonomously shop and pay without a human credit card ever entering the picture.

**How it works**:
- Agents use Shopify's MCP tools for product discovery (already exists)
- ScuttlePay handles **payment** via x402 protocol (USDC on Base)
- Under the hood: thirdweb managed wallets + x402 facilitator
- Merchants receive money via existing payment rails
- Users fund wallets, set budgets, monitor spending

**Positioning in the ecosystem**:
```
Shopify UCP / Catalog MCP  ← product discovery, cart (EXISTS)
  ↓
ScuttlePay                   ← wallet, payment, spending controls (WE BUILD THIS)
  ↓
x402 / thirdweb              ← settlement, USDC on Base (EXISTS)
```

We don't rebuild what Shopify built. We fill the payment gap.

**Key differentiator vs Shop Pay**:
| | Shop Pay | ScuttlePay |
|--|---|---|
| What the agent gets | Access to your credit card | Its own wallet with a budget |
| Max risk if compromised | Your card limit ($5k-50k+) | Wallet balance only |
| Spending controls | None | Per-tx limit, daily cap |
| Credit card required | Yes | No — fund with USDC or card |
| Works beyond Shopify | No | Yes — any x402 merchant/API |

---

## Hackathon Strategy

**Judging criteria alignment**:
- **Impact (25%)**: Real-world problem — agent autonomy is blocked by payment. This is the last mile.
- **Opus 4.6 Use (25%)**: Entire product built with Claude Code. MCP server = Claude-native integration.
- **Depth & Execution (20%)**: Real crypto payments on real blockchain. Not a mock. Production architecture.
- **Demo (30%)**: Agent autonomously shops a real Shopify store. Split screen: agent buying + wallet dashboard updating live.

**Phasing strategy** — build the right architecture from day 1, phase the feature surface:

| What | Hackathon | Post-Hackathon |
|------|-----------|----------------|
| Auth | API key on Hono routes. MCP uses key from env. | Clerk OAuth, per-user keys, session management |
| Users | Single seeded user row in DB | Multi-user with Clerk identity |
| Wallets | One wallet per user, schema supports N | Multi-wallet, per-agent budgets |
| Spending controls | Enforced in service layer (config-driven) | Dashboard UI for managing policies |
| Merchant integration | Shopify Storefront API, Admin API for orders | Shopify Payments App, UCP PSP |
| Landing page | Simple hero + "set up your agent" | Full marketing site |
| Funding | Manual USDC transfer to wallet address | thirdweb Pay / Coinbase Onramp fiat on-ramp |

The difference from "scope cut": every row above has the **same architecture**. The hackathon version is just the minimal surface. No rewrites needed to go from column 2 to column 3.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| MCP Server | `@modelcontextprotocol/sdk` + TypeScript | Agent-facing product. Claude-native. |
| Wallet + x402 | thirdweb SDK | Managed wallets, x402 facilitator, KMS support. Eliminates custom crypto code. |
| Shopify Integration | Shopify Storefront API (GraphQL) | Product browsing, cart. Public API with storefront access token. |
| Order Creation | Shopify Admin API | Create orders after x402 payment settles. |
| API Server | Hono on Vercel Functions | Lightweight TS server. Hono has a Vercel adapter (`@hono/vercel`). Hosted alongside dashboard. |
| Database | Vercel Postgres (Neon) + Drizzle | Transaction logs, wallet metadata, order records. ACID for financial data. Managed via Vercel dashboard. |
| Dashboard | Next.js + shadcn/ui + Tailwind | Wallet view + transaction table + setup instructions. Deployed on Vercel. |
| Hosting | Vercel Pro ($20/month) | Dashboard + API co-hosted. Vercel Postgres included. Preview deployments for PRs. |
| Blockchain | Base Sepolia (testnet) → Base mainnet | USDC, 2s finality, ~$0.001 fees. |
| Validation | zod | Shared schemas across MCP + API. Single source of truth for domain types. |
| Auth (hackathon) | API key middleware (Hono) | Simple bearer token auth. One key per user, stored hashed in DB. |
| Auth (post-hackathon) | Clerk | OAuth, session management, user dashboard identity. |

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    AI Agent (Claude, etc.)               │
│                                                         │
│  Uses ScuttlePay MCP Server:                           │
│   - search_products("red shoes under $50")             │
│   - get_product_details(productId)                     │
│   - buy(productId, quantity)                           │
│   - get_balance()                                      │
│   - get_transactions()                                 │
└─────────────────┬───────────────────────────────────────┘
                  │ (stdio transport)
┌─────────────────▼───────────────────────────────────────┐
│              ScuttlePay MCP Server (packages/mcp)        │
│  Thin orchestration layer — delegates to API server      │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  Product      │  │  Payment     │  │  Wallet       │ │
│  │  Tools        │  │  Tools       │  │  Tools        │ │
│  │              │  │              │  │               │ │
│  │  Calls API   │  │  Calls API   │  │  Calls API    │ │
│  │  server      │  │  server      │  │  server       │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
└─────────┼─────────────────┼───────────────────┼─────────┘
          │                 │                   │
          └─────────────────┼───────────────────┘
                            │ (HTTP + API key)
┌───────────────────────────▼─────────────────────────────┐
│              ScuttlePay API Server (packages/api)        │
│              Hono — all business logic lives here        │
│                                                         │
│  Middleware: auth (API key) → rate limit → request ID    │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  Shopify      │  │  Payment     │  │  Wallet       │ │
│  │  Service      │  │  Service     │  │  Service      │ │
│  │              │  │              │  │               │ │
│  │  Storefront  │  │  x402 sign   │  │  Balance      │ │
│  │  API client  │  │  + settle    │  │  Spending     │ │
│  │  + Admin API │  │  via thirdweb│  │  Policies     │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
│         │                 │                   │         │
│  ┌──────▼─────────────────▼───────────────────▼───────┐ │
│  │                 PostgreSQL (Drizzle)                │ │
│  │  users, wallets, transactions, orders, api_keys,   │ │
│  │  spending_policies                                 │ │
│  └────────────────────────────────────────────────────┘ │
└─────────┬─────────────────┬─────────────────────────────┘
          │                 │
          ▼                 ▼
   ┌──────────┐    ┌──────────────┐
   │ Shopify  │    │  thirdweb    │
   │ Store    │    │  Facilitator │
   │ (GQL)    │    │  (x402)      │
   └──────────┘    └──────┬───────┘
                          │
                   ┌──────▼───────┐
                   │  USDC on     │
                   │  Base        │
                   └──────────────┘

┌─────────────────────────────────────────────────────────┐
│              Dashboard (packages/web)                     │
│              Next.js — user-facing UI                    │
│                                                         │
│  Calls same API server (HTTP + API key or session)      │
│  Pages: wallet overview, transactions, agent setup      │
└─────────────────────────────────────────────────────────┘
```

### Key Architectural Boundary: MCP is a thin client

The MCP server is a **transport adapter**, not a business logic host. It translates MCP tool calls into HTTP requests to the API server. This means:
- All business logic (spending checks, payment orchestration, order creation) lives in the API server
- The dashboard and the MCP server are both clients of the same API
- Testing the payment flow doesn't require spinning up an MCP server
- Post-hackathon, other interfaces (CLI, SDK, webhooks) call the same API

### Payment Flow (what happens when agent calls `buy()`)

1. MCP `buy` tool receives `(productId, variantId?, quantity?)` from agent
2. MCP calls `POST /api/purchases` on the API server (with API key)
3. API server fetches product from Shopify Storefront API (price, variant)
4. API server checks: wallet balance >= product price (via thirdweb/on-chain query)
5. API server evaluates spending policies (per-tx max, daily cap, queried from DB)
6. If checks pass: constructs x402 payment payload (USDC amount, payTo = merchant wallet)
7. Signs EIP-712 `TransferWithAuthorization` via thirdweb server wallet
8. Submits to thirdweb x402 facilitator → settles on Base (~2-5s)
9. On settlement (tx hash received): creates order via Shopify Admin API
10. Logs transaction in PostgreSQL (amount, txHash, orderId, productId, status, timestamps)
11. Returns purchase result to MCP → MCP formats and returns to agent

**Error states at each step** (not exhaustive, but the important ones):
- Step 4: `INSUFFICIENT_BALANCE` — wallet doesn't have enough USDC
- Step 5: `SPENDING_LIMIT_EXCEEDED` — per-tx or daily cap hit
- Step 6-8: `PAYMENT_FAILED` — x402 signing or settlement failure (network, facilitator down)
- Step 9: `ORDER_CREATION_FAILED` — Shopify Admin API error (non-fatal: payment succeeded, order logged in our DB)

---

## Data Model

Designed for multi-user and multi-wallet from day 1. Hackathon seeds one user + one wallet.

```
users
├── id              uuid PK
├── email           text UNIQUE (nullable for hackathon — no auth yet)
├── name            text
├── created_at      timestamptz
└── updated_at      timestamptz

api_keys
├── id              uuid PK
├── user_id         uuid FK → users.id
├── key_hash        text (bcrypt hash of the API key)
├── key_prefix      text (first 8 chars, for display: "sk_live_abc1...")
├── name            text (user-given label: "my-claude-agent")
├── is_active       boolean DEFAULT true
├── last_used_at    timestamptz
├── created_at      timestamptz
└── expires_at      timestamptz (nullable)

wallets
├── id              uuid PK
├── user_id         uuid FK → users.id
├── address         text UNIQUE (on-chain wallet address)
├── chain_id        integer (8453 = Base mainnet, 84532 = Base Sepolia)
├── label           text DEFAULT 'default' (user-given name)
├── thirdweb_id     text (thirdweb server wallet identifier)
├── is_active       boolean DEFAULT true
├── created_at      timestamptz
└── updated_at      timestamptz

spending_policies
├── id              uuid PK
├── wallet_id       uuid FK → wallets.id
├── max_per_tx      numeric(20,6) (USDC, 6 decimals)
├── daily_limit     numeric(20,6)
├── monthly_limit   numeric(20,6) (nullable — post-hackathon)
├── allowed_merchants text[] (nullable — post-hackathon allowlist)
├── is_active       boolean DEFAULT true
├── created_at      timestamptz
└── updated_at      timestamptz

transactions
├── id              uuid PK
├── wallet_id       uuid FK → wallets.id
├── type            text ('purchase' | 'fund' | 'refund')
├── status          text ('pending' | 'settling' | 'settled' | 'failed')
├── amount_usdc     numeric(20,6)
├── tx_hash         text (nullable — null until settlement)
├── merchant_address text (payTo address)
├── product_id      text (Shopify product GID)
├── product_name    text (denormalized for display)
├── store_url       text
├── error_message   text (nullable)
├── metadata        jsonb (flexible: variant info, facilitator response, etc.)
├── initiated_at    timestamptz
├── settled_at      timestamptz (nullable)
└── created_at      timestamptz

orders
├── id              uuid PK
├── transaction_id  uuid FK → transactions.id UNIQUE
├── wallet_id       uuid FK → wallets.id
├── shopify_order_id text (nullable — null if Shopify order creation fails)
├── shopify_order_number text (nullable — human-readable "#1001")
├── status          text ('created' | 'confirmed' | 'failed')
├── product_id      text
├── product_name    text
├── variant_id      text (nullable)
├── quantity        integer DEFAULT 1
├── unit_price_usdc numeric(20,6)
├── total_usdc      numeric(20,6)
├── store_url       text
├── error_message   text (nullable)
├── created_at      timestamptz
└── updated_at      timestamptz
```

**Design notes**:
- `transactions` and `orders` are separate: a transaction can exist without an order (funding), and an order creation can fail after a successful transaction (Shopify API down)
- `spending_policies` is its own table (not columns on `wallets`) for extensibility: allowlists, time-based policies, per-merchant limits
- `numeric(20,6)` for USDC amounts: 6 decimal places matches USDC on-chain precision, 20 total digits handles any realistic amount
- `metadata jsonb` on transactions: escape hatch for data we don't want to model yet (facilitator response, gas info, etc.)
- All timestamps are `timestamptz` — financial data needs timezone-aware timestamps

---

## Service Layer Architecture

All business logic lives in the API server (`packages/api`), organized as services.

### Service Boundaries

```
packages/api/src/services/
├── wallet.service.ts      # Wallet CRUD, balance queries (wraps thirdweb)
├── payment.service.ts     # x402 signing, settlement orchestration
├── shopify.service.ts     # Storefront API queries, Admin API order creation
├── spending.service.ts    # Policy evaluation, daily totals, limit checks
└── purchase.service.ts    # Orchestrates the full buy flow (calls other services)
```

**`purchase.service.ts`** is the orchestrator for `buy()`. It composes the other services:
```
purchase(walletId, productId, variantId?, quantity?) → PurchaseResult
  1. shopify.getProduct(productId) → product with price
  2. wallet.getBalance(walletId) → current USDC balance
  3. spending.evaluate(walletId, amount) → pass/fail + reason
  4. payment.signAndSettle(walletId, amount, merchantAddress) → txHash
  5. shopify.createOrder(product, quantity, txHash) → orderId
  6. db.logTransaction(...) + db.createOrder(...)
  7. return { orderId, txHash, amount, product }
```

Each service owns its own domain logic and external API calls. No service calls another service's database tables directly — they go through the service interface.

### Error Handling Strategy

Domain errors are typed, not stringly-typed:
```typescript
type PaymentError =
  | { code: 'INSUFFICIENT_BALANCE'; available: string; required: string }
  | { code: 'SPENDING_LIMIT_EXCEEDED'; limit: string; spent: string; period: string }
  | { code: 'PAYMENT_FAILED'; reason: string; retriable: boolean }
  | { code: 'PRODUCT_NOT_FOUND'; productId: string }
  | { code: 'ORDER_CREATION_FAILED'; txHash: string; reason: string }
```

The MCP server translates these into human-readable messages for the agent. The dashboard displays them as appropriate UI states.

External service failures (thirdweb down, Shopify rate-limited) are wrapped in a consistent error envelope with `retriable: boolean` so callers know whether to retry.

---

## Build Plan — Epics & Tasks

Each task is designed to be **individually executable, testable, and verifiable**. A future agent session should be able to pick up any task, read its spec, implement it, and prove it works — without reading the entire document.

**Dependency notation**: `→` means "must be completed before". Tasks within an epic are ordered, but tasks without explicit dependencies can be parallelized.

### Task Summary & Critical Path

```
Epic 1: Foundation          Epic 2: Wallet       Epic 3: Shopify
  1.1 Scaffold                2.1 thirdweb SDK     3.1 Storefront client
   ↓                           ↓                    ↓
  1.2 Shared types             2.2 Wallet service   3.2 Product routes
   ↓                           ↓
  1.3 DB schema               2.3 Wallet routes
   ↓
  1.4 Seed script                    ↓                    ↓
   ↓                          ┌──────┴────────────────────┘
  1.5 API skeleton            │
   ↓                     Epic 4: Payment Engine
  1.6 Auth middleware      4.1 Spending service
                            4.2 x402 signing
                            4.3 Order creation (Shopify Admin)
                            4.4 Purchase orchestrator (composes 4.1-4.3)
                            4.5 Purchase + transaction routes
                                     │
                    ┌────────────────┼──────────────┐
                    ↓                ↓              ↓
              Epic 5: MCP     Epic 6: Dashboard  Epic 7: Demo
              5.1 Scaffold    6.1 Next.js setup  7.1 Demo store
              5.2 Products    6.2 Wallet page    7.2 Funded wallet
              5.3 Buy         6.3 Transactions   7.3 E2E test
              5.4 Balance     6.4 Setup page     7.4 Demo script
              5.5 Packaging   6.5 Landing page   7.5 Backup recording
```

**Critical path**: 1.1 → 1.2 → 1.3 → 1.5 → 1.6 → 2.1 → 2.2 → 4.2 → 4.4 → 4.5 → 5.3 (agent can buy)

**Total hackathon tasks**: 30 tasks across 7 epics
**Post-hackathon tasks**: 8 tasks across 3 epics

---

## Epic 1: Project Foundation

**Goal**: Monorepo scaffold with shared types, tooling, and build pipeline. This epic produces zero features but establishes every pattern that subsequent code follows. **Get this wrong and everything built on top inherits the damage.**

**Why this is critical**: The shared package, TypeScript config, and project structure are copied/imported by every other package. The error types defined here are used across MCP, API, and dashboard. The zod schemas defined here are the single source of truth for API contracts.

---

### Task 1.1: Monorepo Scaffold

**What**: Initialize pnpm workspace with 4 packages, TypeScript strict, Turbo pipelines.

**Deliverables**:
- `pnpm-workspace.yaml` defining `packages/*`
- `package.json` at root with workspace scripts
- `tsconfig.base.json` with strict settings (all packages extend this)
- `turbo.json` with pipelines: `build`, `dev`, `lint`, `typecheck`
- 4 packages initialized: `packages/shared`, `packages/api`, `packages/mcp`, `packages/web`
- Each package has: `package.json`, `tsconfig.json` (extends base), `src/index.ts` (placeholder export)
- Shared ESLint config (flat config, TypeScript parser)
- `.env.example` at root documenting all env vars (can be empty values, just the keys + comments)
- `.gitignore` (node_modules, dist, .env, drizzle/*.sql, .turbo)

**Verification**:
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` succeeds (all 4 packages compile to `dist/`)
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes
- [ ] Importing from `@scuttlepay/shared` works in `packages/api` (TypeScript resolves)
- [ ] `turbo run build --graph` shows correct dependency order

**Dependencies**: None
**Files**: Root configs, all `package.json` and `tsconfig.json` files

---

### Task 1.2: Shared Package — Domain Types & Constants

**What**: Define the core domain types, zod schemas, typed errors, and constants that every package imports. This is the single source of truth for the project's type system.

**Deliverables**:

`packages/shared/src/constants.ts`:
- Chain IDs: `BASE_MAINNET = 8453`, `BASE_SEPOLIA = 84532`
- USDC contract addresses per chain
- Facilitator URLs (thirdweb, Coinbase fallback)
- API route paths as typed constants (prevents typos across packages)

`packages/shared/src/types.ts`:
- Domain types matching the data model: `User`, `Wallet`, `ApiKey`, `SpendingPolicy`, `Transaction`, `Order`
- Enums: `TransactionType`, `TransactionStatus`, `OrderStatus`
- Response types: `PurchaseResult`, `ProductSearchResult`, `ProductDetail`, `WalletBalance`

`packages/shared/src/schemas.ts`:
- Zod schemas for every API request and response body
- `purchaseRequestSchema`, `productSearchParamsSchema`, `transactionListParamsSchema`
- Response schemas: `walletBalanceSchema`, `transactionSchema`, `productSchema`
- Reusable validators: `usdcAmountSchema` (string → valid numeric, 6 decimal max), `ethereumAddressSchema`

`packages/shared/src/errors.ts`:
- `PaymentError` discriminated union (as specified in Error Handling Strategy)
- `ScuttlePayError` base class with `code`, `message`, `retriable`, `metadata`
- Error code enum: `INSUFFICIENT_BALANCE`, `SPENDING_LIMIT_EXCEEDED`, `PAYMENT_FAILED`, `PRODUCT_NOT_FOUND`, `ORDER_CREATION_FAILED`, `UNAUTHORIZED`, `INTERNAL_ERROR`
- `isScuttlePayError()` type guard
- `toAgentMessage(error)` — formats any error into an LLM-friendly string
- `toApiResponse(error)` — formats any error into a structured JSON response

`packages/shared/src/index.ts`:
- Re-exports everything from types, schemas, errors, constants

**Verification**:
- [ ] `pnpm build` succeeds for `packages/shared`
- [ ] `pnpm typecheck` passes
- [ ] All zod schemas can `.parse()` valid data and `.safeParse()` rejects invalid data (verify manually or with a quick test)
- [ ] `isScuttlePayError()` correctly narrows types
- [ ] `toAgentMessage()` produces readable strings for each error code
- [ ] Other packages can `import { Transaction, purchaseRequestSchema } from '@scuttlepay/shared'`

**Dependencies**: Task 1.1
**Files**: `packages/shared/src/*`

---

### Task 1.3: Database Schema & Migrations

**What**: Drizzle ORM schema matching the data model. Migrations. Neon connection.

**Deliverables**:

`packages/api/src/db/schema.ts`:
- All 6 tables from the Data Model section: `users`, `apiKeys`, `wallets`, `spendingPolicies`, `transactions`, `orders`
- Proper foreign keys, indexes (user_id on wallets, wallet_id on transactions, etc.)
- `numeric(20,6)` for USDC amounts
- `timestamptz` for all timestamp columns
- Drizzle `relations()` for type-safe joins

`packages/api/src/db/index.ts`:
- Vercel Postgres driver (`@vercel/postgres` + `drizzle-orm/vercel-postgres`) or Neon serverless driver
- Drizzle instance export
- Connection URL from `POSTGRES_URL` env var (Vercel Postgres auto-injects this)

`packages/api/drizzle.config.ts`:
- Drizzle Kit config pointing to schema file
- `dialect: 'postgresql'`, `dbCredentials` from env

**Verification**:
- [ ] `pnpm drizzle-kit push` applies schema to a Neon database without errors
- [ ] All 6 tables created with correct columns, types, constraints
- [ ] Foreign keys are enforced (try inserting a wallet with non-existent user_id → fails)
- [ ] `numeric(20,6)` stores and retrieves precise USDC amounts (e.g., `1.234567`)
- [ ] `pnpm drizzle-kit studio` opens and shows all tables

**Dependencies**: Task 1.1 (monorepo), Task 1.2 (types imported by schema)
**Files**: `packages/api/src/db/*`, `packages/api/drizzle.config.ts`

**External setup required**: Create Vercel Postgres database via Vercel dashboard (included with Pro plan), link to project

---

### Task 1.4: Database Seed Script

**What**: Script that creates test data for local development and demo. Idempotent (can run multiple times safely).

**Deliverables**:

`packages/api/src/db/seed.ts`:
- Creates one test user: `{ name: 'Demo User', email: 'demo@scuttlepay.com' }`
- Creates one API key: generates `sk_test_<random>`, stores bcrypt hash, returns plaintext key to console
- Creates one wallet row: `{ user_id, address: '<placeholder>', chain_id: 84532, label: 'default' }`
  - Address is placeholder until wallet integration (Task 2.1) — update script then
- Creates one spending policy: `{ wallet_id, max_per_tx: env.DEFAULT_MAX_PER_TX, daily_limit: env.DEFAULT_DAILY_LIMIT }`
- Idempotent: uses `ON CONFLICT DO NOTHING` or checks existence before insert
- Prints: user ID, API key (plaintext, once), wallet ID to stdout

Add `pnpm db:seed` script to `packages/api/package.json`.

**Verification**:
- [ ] `pnpm db:seed` runs without errors on empty database
- [ ] `pnpm db:seed` runs without errors on already-seeded database (idempotent)
- [ ] All 4 rows created (user, api_key, wallet, spending_policy) — check via Drizzle Studio
- [ ] API key plaintext output starts with `sk_test_`
- [ ] Bcrypt hash in `api_keys` table can verify against plaintext key

**Dependencies**: Task 1.3
**Files**: `packages/api/src/db/seed.ts`

---

### Task 1.5: API Server Skeleton

**What**: Hono server with middleware stack, health check, structured error handling. No feature routes yet — just the plumbing.

**Deliverables**:

`packages/api/src/index.ts`:
- Hono app creation with Vercel adapter (`@hono/vercel`)
- Middleware registration order: request-id → logger → auth → error handler
- Export default for Vercel Functions (+ optional standalone `serve()` for local dev)
- Local dev: `vercel dev` or standalone on `API_PORT` (default 3001)

`packages/api/src/middleware/request-id.ts`:
- Generates `X-Request-ID` header (UUID) on every request
- Adds to response headers
- Makes request ID available in context for logging

`packages/api/src/middleware/error-handler.ts`:
- Catches all errors thrown by routes
- If `ScuttlePayError`: returns structured JSON `{ error: { code, message, retriable } }` with appropriate HTTP status
- If unknown error: returns 500 with `INTERNAL_ERROR` code, logs full stack
- Always includes `requestId` in error response

`packages/api/src/routes/health.ts`:
- `GET /health` — checks DB connectivity (simple query), returns `{ status: 'ok', db: 'connected', timestamp }`
- If DB fails: returns `{ status: 'degraded', db: 'disconnected' }` with 503

**Verification**:
- [ ] `pnpm dev` in `packages/api` starts server on port 3001
- [ ] `GET /health` returns 200 with `{ status: 'ok', db: 'connected' }`
- [ ] Every response has `X-Request-ID` header
- [ ] Hitting a non-existent route returns structured 404 error (not Hono default)
- [ ] `pnpm build` succeeds for `packages/api`

**Dependencies**: Task 1.3 (DB connection needed for health check)
**Files**: `packages/api/src/index.ts`, `packages/api/src/middleware/*`, `packages/api/src/routes/health.ts`

---

### Task 1.6: API Key Auth Middleware

**What**: Bearer token authentication for all `/api/*` routes. This is how both the MCP server and dashboard authenticate.

**Deliverables**:

`packages/api/src/middleware/auth.ts`:
- Reads `Authorization: Bearer sk_...` header
- Hashes the key (bcrypt compare against `api_keys.key_hash`)
- Looks up active key in DB (`is_active = true`, not expired)
- Sets `userId` and `walletId` (default wallet) in Hono context
- Updates `last_used_at` on the API key row (fire-and-forget, don't block request)
- Returns 401 with `UNAUTHORIZED` error if: no header, invalid format, key not found, key inactive/expired
- `/health` route is exempt from auth

**Verification**:
- [ ] `GET /health` works without auth header (exempt)
- [ ] `GET /api/wallet/balance` (or any `/api/*`) without auth → 401 `UNAUTHORIZED`
- [ ] `GET /api/wallet/balance` with invalid key → 401 `UNAUTHORIZED`
- [ ] `GET /api/wallet/balance` with valid seeded key → passes auth (route may 404, that's fine — auth passed)
- [ ] `last_used_at` updates on the `api_keys` row after a valid request
- [ ] Deactivated key (set `is_active = false` in DB) → 401

**Dependencies**: Task 1.4 (seed script creates the API key), Task 1.5 (API server)
**Files**: `packages/api/src/middleware/auth.ts`

---

### Epic 1 — Done Criteria

All of the following must be true:
- `pnpm install && pnpm build && pnpm typecheck && pnpm lint` — all pass
- `pnpm db:push` applies clean schema
- `pnpm db:seed` creates test data
- API server starts, `/health` returns 200
- Auth middleware blocks unauthenticated requests, passes valid ones
- Shared package exports are importable from all other packages

---

## Epic 2: Wallet Integration

**Goal**: Connect thirdweb managed wallets. Query on-chain USDC balance. Expose wallet endpoints.

**Why before payment/shopping**: The wallet is the core primitive. You can't build payments without a wallet that has a balance. This epic gives us a funded wallet and the ability to check its balance through the API.

---

### Task 2.1: thirdweb SDK Client Setup

**What**: Initialize thirdweb SDK, configure for Base Sepolia, set up server wallet reference.

**Deliverables**:

`packages/api/src/lib/thirdweb.ts`:
- thirdweb SDK client initialization with `THIRDWEB_SECRET_KEY` and `THIRDWEB_CLIENT_ID`
- Server wallet reference using `THIRDWEB_WALLET_ID` (pre-created via thirdweb dashboard)
- Chain configuration for Base Sepolia (chain ID 84532)
- Export: `thirdwebClient`, `serverWallet`, `baseSepoliaChain`

Update `packages/api/src/db/seed.ts`:
- Fetch the real wallet address from thirdweb using the wallet ID
- Update the wallet row with the real on-chain address

**Verification**:
- [ ] thirdweb client initializes without errors on server start
- [ ] Server wallet address can be retrieved programmatically
- [ ] Seed script now populates the correct on-chain address in the wallet row
- [ ] `pnpm build` succeeds

**Dependencies**: Task 1.5 (API server), Task 1.4 (seed script)
**External setup required**: Create server wallet in thirdweb dashboard, get `THIRDWEB_SECRET_KEY`, `THIRDWEB_CLIENT_ID`, `THIRDWEB_WALLET_ID`
**Files**: `packages/api/src/lib/thirdweb.ts`, update `packages/api/src/db/seed.ts`

---

### Task 2.2: Wallet Service

**What**: Service layer for wallet operations — balance queries, address lookup.

**Deliverables**:

`packages/api/src/services/wallet.service.ts`:
- `getBalance(walletId: string)` → queries USDC balance on-chain via thirdweb SDK / viem `readContract`
  - Reads USDC contract `balanceOf(walletAddress)` on Base Sepolia
  - Returns formatted balance as string with 6 decimal places
  - Handles: wallet not found in DB → `WALLET_NOT_FOUND` error
- `getWallet(walletId: string)` → returns wallet metadata from DB
- `getWalletByUserId(userId: string)` → returns user's default wallet
- `getAddress(walletId: string)` → returns on-chain address for funding

**Verification**:
- [ ] `getBalance()` returns `"0.000000"` for a new, unfunded wallet
- [ ] After manually sending testnet USDC to the wallet address, `getBalance()` returns the correct amount
- [ ] `getWallet()` with non-existent ID throws appropriate error
- [ ] Balance is returned with exactly 6 decimal places
- [ ] `pnpm typecheck` passes

**Dependencies**: Task 2.1 (thirdweb client)
**Files**: `packages/api/src/services/wallet.service.ts`

**External action**: Fund the test wallet with testnet USDC (small amount, e.g., 10 USDC from Base Sepolia faucet)

---

### Task 2.3: Wallet API Routes

**What**: HTTP endpoints for wallet balance and address. First real feature routes.

**Deliverables**:

`packages/api/src/routes/wallet.ts`:
- `GET /api/wallet/balance` → returns `{ balance: "10.000000", currency: "USDC", chain: "base-sepolia" }`
  - Uses `walletId` from auth context (set by auth middleware)
  - Calls `walletService.getBalance()`
  - Response validated against `walletBalanceSchema` from shared package
- `GET /api/wallet/address` → returns `{ address: "0x...", chain: "base-sepolia", qrUrl: "..." }`
  - QR URL: `https://chart.googleapis.com/chart?...` or generate locally

Register routes in `packages/api/src/index.ts`.

**Verification**:
- [ ] `curl -H "Authorization: Bearer sk_test_..." http://localhost:3001/api/wallet/balance` → returns balance JSON
- [ ] Balance matches what's on-chain (check on Basescan)
- [ ] `curl http://localhost:3001/api/wallet/balance` (no auth) → 401
- [ ] `GET /api/wallet/address` returns the correct wallet address
- [ ] Response bodies match their zod schemas (manually validate)

**Dependencies**: Task 2.2 (wallet service), Task 1.6 (auth middleware)
**Files**: `packages/api/src/routes/wallet.ts`, update `packages/api/src/index.ts`

---

### Epic 2 — Done Criteria

- Wallet has a real on-chain address from thirdweb
- Balance endpoint returns correct USDC balance from Base Sepolia
- Wallet is funded with testnet USDC (manual step)
- Both routes authenticated and returning structured responses

---

## Epic 3: Shopify Integration

**Goal**: Browse and search products from a real Shopify store via API.

---

### Task 3.1: Shopify Storefront API Client

**What**: GraphQL client for Shopify's Storefront API. Product search and detail queries.

**Deliverables**:

`packages/api/src/lib/shopify.ts`:
- Storefront API client using `fetch` with GraphQL queries
- Configured with `SHOPIFY_STORE_URL` and `SHOPIFY_STOREFRONT_TOKEN`
- Typed query/response helpers using zod for response parsing

`packages/api/src/services/shopify.service.ts`:
- `searchProducts(query: string, first?: number)` → searches products via Storefront API
  - GraphQL query: `products(first: $first, query: $query)` with edges/nodes
  - Returns: array of `{ id, title, description, priceUsdc, imageUrl, variants }`
  - Price parsing: Shopify returns `Money` type (amount string + currencyCode) → parse to USDC string (1:1 for hackathon)
- `getProduct(productId: string)` → full product details
  - GraphQL query by product ID (GID format: `gid://shopify/Product/12345`)
  - Returns: `{ id, title, description, priceUsdc, images, variants: [{ id, title, priceUsdc }] }`
- Simple in-memory cache (60s TTL) to avoid hitting Storefront API rate limits
  - Cache keyed by query string / product ID
  - Stale results returned if API fails (graceful degradation)

**Verification**:
- [ ] `searchProducts("shoes")` returns products from the Shopify test store
- [ ] `getProduct(productId)` returns full details for a known product
- [ ] Prices are correctly parsed from Shopify's Money type to USDC strings
- [ ] Cache hit: second call within 60s doesn't hit Shopify API (check via logging or mock)
- [ ] Non-existent product ID → `PRODUCT_NOT_FOUND` error
- [ ] `pnpm typecheck` passes

**Dependencies**: Task 1.2 (shared types), Task 1.5 (API server for env config)
**External setup required**: Shopify test store with products, Storefront API access token
**Files**: `packages/api/src/lib/shopify.ts`, `packages/api/src/services/shopify.service.ts`

---

### Task 3.2: Product API Routes

**What**: HTTP endpoints for product search and details.

**Deliverables**:

`packages/api/src/routes/products.ts`:
- `GET /api/products?q=<query>&limit=<n>` → search products
  - Query param `q` is required
  - `limit` defaults to 10, max 50
  - Returns array of products with IDs, names, prices, image URLs
  - Response validated against `productSearchResultSchema`
- `GET /api/products/:id` → product details
  - `:id` is the Shopify product GID
  - Returns full product details with variants
  - Response validated against `productDetailSchema`

Register routes in `packages/api/src/index.ts`.

**Verification**:
- [ ] `curl -H "Authorization: Bearer sk_test_..." "http://localhost:3001/api/products?q=shoes"` → products returned
- [ ] Product IDs in response can be used with `GET /api/products/:id`
- [ ] `GET /api/products?q=` (empty query) → 400 validation error
- [ ] `GET /api/products/nonexistent` → 404 `PRODUCT_NOT_FOUND`
- [ ] Prices in response are USDC strings with proper precision

**Dependencies**: Task 3.1 (shopify service), Task 1.6 (auth)
**Files**: `packages/api/src/routes/products.ts`, update `packages/api/src/index.ts`

---

### Epic 3 — Done Criteria

- Can search products from Shopify via API
- Can get product details by ID
- Prices parsed correctly as USDC
- All routes authenticated

---

## Epic 4: Payment Engine

**Goal**: The complete purchase flow — spending checks, x402 payment, settlement, order creation. This is the core product.

**Why this ordering**: Spending checks (4.1) → x402 signing (4.2) → purchase orchestrator (4.3) → order creation (4.4). Each builds on the previous.

---

### Task 4.1: Spending Policy Service

**What**: Evaluate spending limits before any payment attempt.

**Deliverables**:

`packages/api/src/services/spending.service.ts`:
- `evaluate(walletId: string, amountUsdc: string)` → `{ allowed: boolean; denial?: SpendingDenial }`
  - `SpendingDenial`: `{ code: 'PER_TX_EXCEEDED' | 'DAILY_LIMIT_EXCEEDED'; limit: string; current: string; requested: string }`
- Per-transaction check: `amount <= spending_policies.max_per_tx`
- Daily total check: sum of today's settled transactions + requested amount <= `spending_policies.daily_limit`
  - "Today" is UTC day (midnight to midnight)
  - Only counts `status = 'settled'` transactions (not pending/failed)
- `getPolicy(walletId: string)` → returns current spending policy
- `getDailySpent(walletId: string)` → returns total USDC spent today

**Verification**:
- [ ] Wallet with no transactions today → `evaluate($5)` with $10 max_per_tx and $50 daily → `allowed: true`
- [ ] `evaluate($15)` with $10 max_per_tx → `allowed: false, code: PER_TX_EXCEEDED`
- [ ] After recording $45 in transactions today, `evaluate($10)` with $50 daily → `allowed: false, code: DAILY_LIMIT_EXCEEDED`
- [ ] Daily total only counts settled transactions (pending ones don't count toward limit)
- [ ] `getPolicy()` for non-existent wallet → appropriate error
- [ ] `pnpm typecheck` passes

**Dependencies**: Task 1.3 (DB schema), Task 1.4 (seeded spending policy)
**Files**: `packages/api/src/services/spending.service.ts`

---

### Task 4.2: x402 Payment Signing & Settlement

**What**: Sign EIP-712 payment authorization and settle via thirdweb facilitator.

**Deliverables**:

`packages/api/src/services/payment.service.ts`:
- `signAndSettle(walletId: string, amountUsdc: string, payToAddress: string)` → `{ txHash: string; settledAt: Date }`
  - Constructs x402 payment payload: `{ amount, token: USDC_CONTRACT, payTo, validAfter, validBefore, nonce }`
  - Signs EIP-712 `TransferWithAuthorization` using thirdweb server wallet
  - Submits signed auth to thirdweb facilitator `/settle` endpoint
  - Waits for settlement confirmation (tx hash)
  - Returns tx hash and settlement timestamp
- `verifyPayment(txHash: string)` → confirms transaction on-chain (optional, for extra verification)
- Error handling:
  - Facilitator timeout → retry once after 3s, then `PAYMENT_FAILED { retriable: true }`
  - Invalid signature → `PAYMENT_FAILED { retriable: false }` (bug in our signing code)
  - Facilitator returns error → wrap in `PAYMENT_FAILED` with facilitator message
- Facilitator URL configurable via env (thirdweb primary, Coinbase fallback)

**Verification**:
- [ ] `signAndSettle()` with valid params → returns tx hash
- [ ] tx hash is verifiable on Base Sepolia Basescan (real on-chain transaction)
- [ ] Wallet USDC balance decreases by the payment amount
- [ ] Invalid payTo address → appropriate error
- [ ] Payment for more than wallet balance → fails (on-chain rejection)
- [ ] `pnpm typecheck` passes

**Dependencies**: Task 2.1 (thirdweb client), Task 2.2 (wallet service for address lookup)
**External verification**: Check tx hash on https://sepolia.basescan.org
**Files**: `packages/api/src/services/payment.service.ts`

---

### Task 4.3: Order Creation (Shopify Admin API)

**What**: Create an order in Shopify after payment settlement. Non-fatal — if this fails, the payment still succeeded.

**Deliverables**:

Extend `packages/api/src/services/shopify.service.ts`:
- `createOrder(params: { product, variant?, quantity, txHash, walletAddress })` → `{ shopifyOrderId, orderNumber }`
  - Uses Shopify Admin REST API (`POST /admin/api/2024-01/draft_orders.json`)
  - Creates draft order with: line items, note (tx hash, "Paid via ScuttlePay x402"), customer email (optional)
  - Returns Shopify order ID and human-readable order number
- Error handling:
  - Admin API failure → `ORDER_CREATION_FAILED { txHash }` (non-fatal)
  - Rate limit → retry once after 2s
  - Log full error for debugging

`packages/api/src/lib/shopify.ts`:
- Add Admin API client configuration using `SHOPIFY_ADMIN_TOKEN`
- Separate from Storefront API client (different base URL, different auth)

**Verification**:
- [ ] `createOrder()` with valid product → Shopify draft order created (visible in Shopify admin)
- [ ] Returns `shopifyOrderId` and `orderNumber` (e.g., "#1001")
- [ ] Order note contains tx hash
- [ ] Invalid product → appropriate error (but doesn't crash)
- [ ] If Admin API is unreachable → returns `ORDER_CREATION_FAILED` (not an unhandled exception)

**Dependencies**: Task 3.1 (shopify client base)
**External setup required**: Shopify Admin API access token with `write_draft_orders` scope
**Files**: `packages/api/src/services/shopify.service.ts`, `packages/api/src/lib/shopify.ts`

---

### Task 4.4: Purchase Orchestrator Service

**What**: The central service that composes all other services into the full buy flow. This is the heart of ScuttlePay.

**Deliverables**:

`packages/api/src/services/purchase.service.ts`:
- `purchase(params: { walletId, productId, variantId?, quantity? })` → `PurchaseResult`
- Flow:
  1. `shopifyService.getProduct(productId)` → get price and details
  2. `walletService.getBalance(walletId)` → check sufficient funds
  3. `spendingService.evaluate(walletId, totalUsdc)` → check spending limits
  4. Insert transaction row: `status: 'pending'`, `amount_usdc`, `product_id`, `merchant_address`
  5. `paymentService.signAndSettle(walletId, totalUsdc, merchantAddress)` → get tx hash
  6. Update transaction row: `status: 'settled'`, `tx_hash`, `settled_at`
  7. `shopifyService.createOrder(...)` → create Shopify order (non-fatal if fails)
  8. Insert order row with Shopify order ID (or `status: 'failed'` if step 7 failed)
  9. Return `PurchaseResult: { transactionId, txHash, orderId?, orderNumber?, product, amount, status }`
- Error handling at each step:
  - Step 2 fail: `INSUFFICIENT_BALANCE` → return error, no transaction row created
  - Step 3 fail: `SPENDING_LIMIT_EXCEEDED` → return error, no transaction row created
  - Step 5 fail: `PAYMENT_FAILED` → update transaction to `status: 'failed'`, return error
  - Step 7 fail: `ORDER_CREATION_FAILED` → transaction still `settled`, order row `failed`, return partial success

**Verification**:
- [ ] Happy path: product found → balance sufficient → limits pass → payment settles → order created → returns full `PurchaseResult`
- [ ] Insufficient balance: returns `INSUFFICIENT_BALANCE` with available and required amounts
- [ ] Spending limit exceeded: returns `SPENDING_LIMIT_EXCEEDED` with limit details
- [ ] Payment failure: transaction row exists with `status: 'failed'` and error message
- [ ] Order creation failure: transaction is `settled` (money moved), order is `failed` (non-fatal)
- [ ] Transaction row created with all expected fields
- [ ] `pnpm typecheck` passes

**Dependencies**: Task 4.1 (spending), Task 4.2 (payment), Task 4.3 (orders), Task 3.1 (shopify)
**Files**: `packages/api/src/services/purchase.service.ts`

---

### Task 4.5: Purchase & Transaction API Routes

**What**: HTTP endpoints for making purchases and viewing transaction history.

**Deliverables**:

`packages/api/src/routes/purchases.ts`:
- `POST /api/purchases` → execute a purchase
  - Body: `{ productId: string, variantId?: string, quantity?: number }` (validated by shared zod schema)
  - Calls `purchaseService.purchase()` with `walletId` from auth context
  - Returns `PurchaseResult` on success
  - Returns structured error on failure (spending limit, insufficient balance, payment failed)

`packages/api/src/routes/transactions.ts`:
- `GET /api/transactions` → list transactions for authenticated wallet
  - Query params: `limit` (default 20, max 100), `cursor` (for pagination)
  - Returns transactions ordered by `created_at DESC`
  - Each transaction includes: id, type, status, amount, txHash, productName, storeUrl, timestamps
- `GET /api/transactions/:id` → single transaction detail
  - Includes full metadata and linked order (if exists)

Register routes in `packages/api/src/index.ts`.

**Verification**:
- [ ] `POST /api/purchases` with valid product → 200, returns PurchaseResult with txHash
- [ ] `POST /api/purchases` with insufficient balance → 400, `INSUFFICIENT_BALANCE` error
- [ ] `POST /api/purchases` with amount exceeding per-tx limit → 400, `SPENDING_LIMIT_EXCEEDED`
- [ ] `GET /api/transactions` returns the purchase from above
- [ ] `GET /api/transactions/:id` returns full detail with metadata
- [ ] Pagination works: `limit=1` returns 1 result with cursor
- [ ] All responses match their zod schemas

**Dependencies**: Task 4.4 (purchase service), Task 1.6 (auth)
**Files**: `packages/api/src/routes/purchases.ts`, `packages/api/src/routes/transactions.ts`, update `packages/api/src/index.ts`

---

### Epic 4 — Done Criteria

The full payment loop works end-to-end via HTTP:
1. `GET /api/products?q=...` → find a product
2. `GET /api/wallet/balance` → confirm sufficient funds
3. `POST /api/purchases { productId }` → payment settles on Base Sepolia
4. `GET /api/wallet/balance` → balance decreased
5. `GET /api/transactions` → purchase appears with tx hash
6. tx hash verifiable on Basescan

---

## Epic 5: MCP Server

**Goal**: MCP server that wraps the API. Agent says "buy me shoes" and it works.

---

### Task 5.1: MCP Server Scaffold + API Client

**What**: MCP server setup with HTTP client pointing at the API server.

**Deliverables**:

`packages/mcp/src/config.ts`:
- Parse env vars: `SCUTTLEPAY_API_URL` (required), `SCUTTLEPAY_API_KEY` (required)
- Validate on startup, fail fast with clear error if missing

`packages/mcp/src/api-client.ts`:
- HTTP client for the ScuttlePay API
- Sets `Authorization: Bearer <key>` on all requests
- Methods: `get(path, params?)`, `post(path, body)`
- Error handling: parses structured error responses, converts to `ScuttlePayError`
- Typed methods matching API routes: `searchProducts()`, `getProduct()`, `purchase()`, `getBalance()`, `getTransactions()`

`packages/mcp/src/index.ts`:
- `@modelcontextprotocol/sdk` server with `StdioServerTransport`
- Server name: `scuttlepay`, version from package.json
- Registers tools (implemented in next tasks)

**Verification**:
- [ ] MCP server starts without errors when env vars are set
- [ ] MCP server fails fast with clear message when env vars are missing
- [ ] API client can call `GET /health` and get 200
- [ ] API client correctly sets auth header
- [ ] `pnpm build` succeeds for `packages/mcp`

**Dependencies**: Epic 1 (shared types, error types), Epic 2-4 (API running)
**Files**: `packages/mcp/src/*`

---

### Task 5.2: MCP Tools — Product Search & Details

**What**: `search_products` and `get_product` tools.

**Deliverables**:

`packages/mcp/src/tools/search.ts`:
- Tool name: `search_products`
- Description: "Search for products available for purchase. Returns product names, prices in USDC, and IDs. Use a product ID from the results to get details or buy."
- Input schema: `{ query: string }` (zod from shared)
- Calls `apiClient.searchProducts(query)`
- Returns formatted list: each product as `"[name] — $[price] USDC (ID: [id])"`

`packages/mcp/src/tools/product.ts`:
- Tool name: `get_product`
- Description: "Get detailed information about a specific product including all variants, descriptions, images, and exact pricing."
- Input schema: `{ productId: string }` (zod from shared)
- Calls `apiClient.getProduct(productId)`
- Returns formatted product details with all variants and prices

**Verification**:
- [ ] In Claude Code with MCP connected: "Search for products" → agent gets formatted product list
- [ ] "Tell me about [product ID from search]" → agent gets full details
- [ ] Invalid product ID → agent gets readable error message (not stack trace)
- [ ] `pnpm typecheck` passes

**Dependencies**: Task 5.1, Task 3.2 (product API routes)
**Files**: `packages/mcp/src/tools/search.ts`, `packages/mcp/src/tools/product.ts`

---

### Task 5.3: MCP Tools — Buy

**What**: The `buy` tool. Agent says "buy this" and money moves.

**Deliverables**:

`packages/mcp/src/tools/buy.ts`:
- Tool name: `buy`
- Description: "Purchase a product using your ScuttlePay wallet. Pays with USDC via x402 protocol. Returns order confirmation with blockchain transaction hash."
- Input schema: `{ productId: string, variantId?: string, quantity?: number }` (zod from shared)
- Calls `apiClient.purchase({ productId, variantId, quantity })`
- On success: returns formatted confirmation — "Purchased [product] for $[amount] USDC. Order #[number]. Transaction: [txHash] (verify on Basescan: [link])"
- On error: translates each error code to agent-friendly message using `toAgentMessage()`:
  - `INSUFFICIENT_BALANCE` → "Insufficient balance: you have $X but this costs $Y"
  - `SPENDING_LIMIT_EXCEEDED` → "Spending limit exceeded: $X per-transaction maximum, you tried $Y"
  - `PAYMENT_FAILED` → "Payment failed: [reason]. [Retry suggested if retriable]"

**Verification**:
- [ ] In Claude Code: "Buy the [product]" → purchase completes, agent sees tx hash
- [ ] tx hash from response is valid on Basescan
- [ ] Balance decreased by product price
- [ ] "Buy the [product]" with insufficient funds → agent gets readable error
- [ ] "Buy the [product]" exceeding per-tx limit → agent gets readable error

**Dependencies**: Task 5.1, Task 4.5 (purchase route)
**Files**: `packages/mcp/src/tools/buy.ts`

---

### Task 5.4: MCP Tools — Balance & Transactions

**What**: `get_balance` and `get_transactions` tools.

**Deliverables**:

`packages/mcp/src/tools/balance.ts`:
- Tool name: `get_balance`
- Description: "Check your current ScuttlePay wallet balance in USDC."
- No input params
- Calls `apiClient.getBalance()`
- Returns: "Your ScuttlePay balance is $[amount] USDC"

`packages/mcp/src/tools/transactions.ts`:
- Tool name: `get_transactions`
- Description: "View recent purchase history including amounts, products, status, and blockchain transaction hashes."
- Input schema: `{ limit?: number }` (default 10)
- Calls `apiClient.getTransactions(limit)`
- Returns formatted list: each as `"[date] — [product] — $[amount] USDC — [status] — tx: [hash]"`
- If no transactions: "No transactions yet."

Register all 5 tools in `packages/mcp/src/server.ts`.

**Verification**:
- [ ] In Claude Code: "What's my balance?" → returns balance
- [ ] "Show my recent transactions" → returns transaction list
- [ ] After a purchase: balance reflects decrease, transaction appears in history
- [ ] `pnpm typecheck` passes

**Dependencies**: Task 5.1, Task 2.3 (wallet routes), Task 4.5 (transaction routes)
**Files**: `packages/mcp/src/tools/balance.ts`, `packages/mcp/src/tools/transactions.ts`, update `packages/mcp/src/server.ts`

---

### Task 5.5: npm Packaging & Config

**What**: Make the MCP server installable via `npx scuttlepay`.

**Deliverables**:

Update `packages/mcp/package.json`:
- `name`: `scuttlepay` (or `@scuttlepay/mcp`)
- `bin`: `{ "scuttlepay": "./dist/index.js" }` with hashbang
- `files`: `["dist"]`
- Version: `0.1.0`

Create MCP config snippet for documentation:
```json
{
  "mcpServers": {
    "scuttlepay": {
      "command": "npx",
      "args": ["-y", "scuttlepay"],
      "env": {
        "SCUTTLEPAY_API_URL": "https://api.scuttlepay.com",
        "SCUTTLEPAY_API_KEY": "sk_..."
      }
    }
  }
}
```

**Verification**:
- [ ] `pnpm build` in `packages/mcp` → produces `dist/index.js` with hashbang
- [ ] `node packages/mcp/dist/index.js` starts MCP server (with env vars set)
- [ ] Config snippet works in Claude Code's MCP settings (when pointing at local build)

**Dependencies**: Task 5.2, 5.3, 5.4 (all tools implemented)
**Files**: `packages/mcp/package.json`, `packages/mcp/src/index.ts` (hashbang)

---

### Epic 5 — Done Criteria

Full agent experience works:
1. Agent: "What products are available?" → product list from Shopify
2. Agent: "What's my balance?" → USDC balance
3. Agent: "Buy the [product]" → on-chain payment, order confirmation
4. Agent: "Show my transactions" → purchase history with tx hashes
5. Agent: "What's my balance now?" → decreased balance

---

## Epic 6: Dashboard

**Goal**: Web UI for wallet owners to monitor their agent's spending.

---

### Task 6.1: Next.js Scaffold + API Client

**What**: Next.js app with shadcn/ui, TanStack Query, API client.

**Deliverables**:

`packages/web/`:
- Next.js 14+ App Router
- Tailwind CSS + shadcn/ui initialized (`npx shadcn-ui@latest init`)
- TanStack Query provider in root layout
- API client in `lib/api-client.ts` (same pattern as MCP's, calls Hono API with API key from env)
- TanStack Query hooks in `lib/queries.ts`: `useBalance()`, `useTransactions()`, `useProducts()`
  - Balance + transactions: refetch every 2s (polling for real-time feel)
- Dashboard layout (`app/dashboard/layout.tsx`): sidebar nav with links to wallet, transactions, setup
- For hackathon: API key from `NEXT_PUBLIC_SCUTTLEPAY_API_KEY` env var (no login)

**Verification**:
- [ ] `pnpm dev` in `packages/web` starts Next.js on port 3000
- [ ] Dashboard layout renders with sidebar navigation
- [ ] TanStack Query hooks successfully fetch from API (visible in React Query devtools)
- [ ] `pnpm build` succeeds
- [ ] `pnpm typecheck` passes

**Dependencies**: Epic 2-4 (API endpoints exist)
**Files**: `packages/web/*`

---

### Task 6.2: Wallet Overview Page

**What**: Main dashboard page showing balance, wallet address, recent transactions.

**Deliverables**:

`packages/web/app/dashboard/page.tsx`:
- Large balance display: "$10.00 USDC" (formatted to 2 decimal places for display)
- Wallet address with copy-to-clipboard button
- QR code for wallet address (use `qrcode.react` or similar)
- "How to fund your wallet" collapsible section: step-by-step for sending testnet USDC
- Recent transactions: last 5, compact card format (product name, amount, status badge, time ago)
- Loading states: skeleton UI while data fetches
- Auto-refresh: balance and transactions update every 2s

**Verification**:
- [ ] Page renders with correct balance from API
- [ ] Copy button copies wallet address to clipboard
- [ ] QR code encodes the correct wallet address
- [ ] Recent transactions show correctly
- [ ] After agent makes a purchase: balance updates within 5s, new transaction appears
- [ ] Loading skeleton shows briefly on first load

**Dependencies**: Task 6.1
**Files**: `packages/web/app/dashboard/page.tsx`

---

### Task 6.3: Transactions Page

**What**: Full transaction history with details.

**Deliverables**:

`packages/web/app/dashboard/transactions/page.tsx`:
- Table: time (relative + absolute), product name, store, amount (USDC), status badge, tx hash link
- Status badges: pending (yellow/amber), settling (blue), settled (green), failed (red)
- tx hash: truncated display, links to `https://sepolia.basescan.org/tx/[hash]`
- Empty state: "No transactions yet. Set up your agent to get started."
- Pagination: "Load more" button (cursor-based)
- Auto-refresh: polls every 2s

**Verification**:
- [ ] Transactions table renders with correct data
- [ ] Status badges show correct colors per status
- [ ] tx hash links open correct Basescan page
- [ ] Empty state shows when no transactions
- [ ] Pagination works (create >20 transactions to test)
- [ ] New transactions appear within 5s of agent purchase

**Dependencies**: Task 6.1
**Files**: `packages/web/app/dashboard/transactions/page.tsx`

---

### Task 6.4: Agent Setup Page

**What**: Instructions for connecting an agent to ScuttlePay.

**Deliverables**:

`packages/web/app/dashboard/setup/page.tsx`:
- API key display (masked by default, reveal on click, copy button)
- MCP config JSON snippet: pre-filled with API URL and key, copy button
- "Quick start" steps: 1) Copy config → 2) Add to Claude Code → 3) Ask agent to buy something
- System prompt suggestion: "You have access to ScuttlePay tools for shopping. Use search_products to browse, get_balance to check funds, and buy to make purchases."
- Link to npm package

**Verification**:
- [ ] Page renders with correct API key (masked)
- [ ] Reveal button shows full key
- [ ] Copy buttons work for both key and config snippet
- [ ] Config snippet is valid JSON with correct API URL

**Dependencies**: Task 6.1
**Files**: `packages/web/app/dashboard/setup/page.tsx`

---

### Task 6.5: Landing Page

**What**: Public-facing page explaining ScuttlePay.

**Deliverables**:

`packages/web/app/page.tsx`:
- Hero: "A bank account for AI agents" + subtitle explaining the value prop
- Problem → Solution section (3 steps or comparison table)
- "How it works" section: simple diagram (agent → ScuttlePay → merchant)
- CTA button: "Get started" → `/dashboard`
- Simple, clean design. Not a full marketing site — just enough for demo/judges.

**Verification**:
- [ ] Page renders at `/`
- [ ] CTA navigates to `/dashboard`
- [ ] Page is responsive (looks good on large screen for demo)
- [ ] No broken images or layout issues

**Dependencies**: Task 6.1
**Files**: `packages/web/app/page.tsx`

---

### Epic 6 — Done Criteria

- Dashboard shows correct balance and transactions
- Real-time: agent purchases appear in dashboard within 5s
- Setup page has copyable MCP config
- Landing page looks presentable for demo

---

## Epic 7: Demo & Polish

**Goal**: Flawless 3-minute demo. 30% of judging criteria.

---

### Task 7.1: Demo Shopify Store

**What**: Populate test store with demo-ready products.

**Deliverables**:
- 5-8 products in Shopify test store: digital goods with varied prices ($0.50-$5.00)
- Good product images and descriptions (something an agent would plausibly buy)
- Categories that make for good search queries ("headphones", "ebook", "software license")
- Storefront API token and Admin API token configured in `.env`

**Verification**:
- [ ] `GET /api/products?q=headphones` returns relevant products
- [ ] All products have images and descriptions
- [ ] Prices are within demo range ($0.50-$5.00)

**Dependencies**: Task 3.1 (Shopify integration works)

---

### Task 7.2: Pre-funded Wallet & Spending Config

**What**: Wallet ready for demo with appropriate funding and limits.

**Deliverables**:
- Primary wallet funded with ~100 testnet USDC on Base Sepolia
- Spending policy: $10/transaction, $50/day
- Backup wallet (second thirdweb server wallet) with ~50 USDC
- Documented: how to switch to backup wallet, how to refund from faucet

**Verification**:
- [ ] `GET /api/wallet/balance` returns ~100 USDC
- [ ] Can make multiple purchases without hitting daily limit for demo
- [ ] Backup wallet can be swapped by changing env var

**Dependencies**: Task 2.2 (wallet service)

---

### Task 7.3: E2E Test Script

**What**: Automated script that validates the entire flow. Run before every demo rehearsal.

**Deliverables**:

`scripts/e2e-test.ts` (or `packages/api/scripts/e2e-test.ts`):
- Uses API client to run: search → get product → check balance → buy → verify balance decreased → verify transaction exists
- Asserts: balance before - product price = balance after (within USDC precision)
- Asserts: transaction has valid tx hash
- Asserts: tx hash exists on Base Sepolia (via Basescan API or thirdweb)
- Prints clear PASS/FAIL with details
- Can be run via `pnpm e2e`

**Verification**:
- [ ] `pnpm e2e` passes end-to-end
- [ ] Fails appropriately if API is down, wallet is unfunded, etc.
- [ ] Takes <30s to complete (Base Sepolia settlement is 2-5s)

**Dependencies**: Epics 1-4 (full API working)

---

### Task 7.4: Demo Script

**What**: The 3-minute presentation script. Rehearsed, with talking points.

**Deliverables**:
- Written demo script (timing, prompts, talking points) — documented in `docs/demo-script.md`
- Claude Code prompts to use during demo (tested to produce good responses)
- Split-screen setup instructions (Claude Code left, dashboard right)
- Pre-demo checklist: wallet funded? API running? Shopify store accessible? MCP connected?

```
0:00-0:30  PROBLEM
  "AI agents can browse, research, decide — but can't pay.
   Shopify just launched agent commerce tools. Agents can shop.
   But payment still requires a human with a credit card.
   What if we could give agents their own bank account?"

0:30-1:00  SETUP (pre-recorded or fast-forward)
  Show: scuttlepay.com → wallet dashboard → address displayed
  Show: wallet funded with testnet USDC
  Show: MCP config copied into Claude Code

1:00-1:30  AGENT SHOPPING (live)
  Split screen: Claude Code (left) + Dashboard (right)
  Agent: "Search for headphones under $5"
  → Products appear from real Shopify store
  Agent: "Tell me more about [product]"
  → Product details with price

1:30-2:30  AGENT PURCHASES (live)
  Agent: "Buy the [product]"
  → x402 payment initiated
  → Dashboard shows transaction appearing (right side, real-time)
  → Balance decreases
  → "Purchase complete! Order #12345, tx: 0xabc..."
  Show: tx hash on Basescan (real blockchain settlement)

2:30-3:00  VISION
  "ScuttlePay: a bank account for AI agents.
   Today: Shopify stores via x402.
   Tomorrow: any UCP merchant, any API, any x402 endpoint.
   Agents get their own money. Humans stay in control."
```

**Verification**:
- [ ] Demo script rehearsed 3+ times successfully
- [ ] Each Claude Code prompt tested to produce expected output
- [ ] Timing fits within 3 minutes

**Dependencies**: Epics 1-6

---

### Task 7.5: Backup Recording + Error Resilience

**What**: Screen recording of successful demo. Error handling for live demo.

**Deliverables**:
- Screen recording of full demo flow (backup if live demo fails)
- Error handling polish across all layers:
  - Insufficient balance → readable agent message + dashboard notification
  - Network timeout on x402 → retry once, then readable error
  - Shopify API error → graceful fallback message
  - All errors include request ID for debugging
- Pre-demo validation script: checks all dependencies before starting

**Verification**:
- [ ] Backup recording exists and covers full demo flow
- [ ] Each error scenario produces a readable message (not stack trace)
- [ ] Pre-demo validation script reports all systems go (or clearly identifies what's down)

**Dependencies**: Task 7.4 (demo script written and rehearsed)

---

### Epic 7 — Done Criteria

- E2E test passes consistently
- Demo script rehearsed 3+ times
- Backup recording ready
- All error states handled gracefully

---

## Epic 8: Auth & Multi-User (Post-Hackathon)

**Goal**: Real auth system. Multiple users, each with their own wallet and API keys.

---

### Task 8.1: Clerk Integration

**Deliverables**:
- Clerk project with Google OAuth
- Next.js middleware: protect `/dashboard/*` routes
- Hono middleware: validate Clerk session token OR API key (dual auth: session for dashboard, API key for MCP/programmatic)
- Clerk webhook: on user creation → create user row in DB, create wallet, create first API key

**Verification**:
- [ ] Sign up with Google → redirected to dashboard
- [ ] Dashboard shows correct user's wallet
- [ ] MCP still works with API key (API key auth not broken)

**Dependencies**: Epics 1-6

---

### Task 8.2: User Onboarding Flow

**Deliverables**:
- First-time user experience: sign up → wallet created → API key displayed once → setup instructions
- "Welcome" state on dashboard: balance $0, prominent setup instructions
- API key shown once in modal (like Stripe) with copy button + warning "you won't see this again"

**Verification**:
- [ ] New user sign up → wallet created in thirdweb → wallet row in DB → API key generated
- [ ] API key works immediately in MCP config
- [ ] Dashboard shows setup instructions for new users

**Dependencies**: Task 8.1

---

### Task 8.3: API Key Management Dashboard

**Deliverables**:
- Dashboard page: list API keys (name, prefix `sk_..abc`, last used, created date)
- Create new key: name it, see full key once, copy button
- Revoke key: confirmation dialog, soft delete
- Multiple keys per user

**Verification**:
- [ ] Create key → appears in list
- [ ] Revoke key → MCP calls with that key return 401
- [ ] `last_used_at` updates when key is used

**Dependencies**: Task 8.1

---

## Epic 9: Spending Controls UI (Post-Hackathon)

**Goal**: User-facing spending policy management.

---

### Task 9.1: Policy Management Page

- View/edit per-wallet policies: per-tx max, daily limit, monthly limit
- Validation: limits must be > 0, daily >= per-tx
- Audit log of policy changes

### Task 9.2: Alerts (Future)

- Email/webhook on purchases, limit approach, limit exceeded
- Dashboard notification center

**Dependencies**: Epic 8

---

## Epic 10: Fiat On-Ramp & Mainnet (Post-Hackathon)

**Goal**: Real money. Fund wallets with credit cards.

---

### Task 10.1: Fiat On-Ramp

- thirdweb Pay or Coinbase Onramp widget in dashboard
- "Fund wallet" button → opens on-ramp → USDC deposited

### Task 10.2: Mainnet Migration

- Environment-based chain selection (`CHAIN_ENV=testnet|mainnet`)
- Constants swap: USDC contract address, Basescan URL, facilitator URL
- Full flow test on Base mainnet with small amounts

### Task 10.3: Transaction Fees

- Fee calculation in `purchase.service.ts` (configurable %, default 1.5%)
- `fee_usdc` column on transactions table
- Revenue tracking (admin dashboard, post-hackathon)

**Dependencies**: Epic 8

---

## Post-Hackathon Roadmap (Beyond Epics 8-10)

| Priority | Item | Notes |
|----------|------|-------|
| P1 | Shopify Payments App certification | Proper payment gateway, not Admin API workaround |
| P1 | AP2 compatibility | Mandate-based auth, cryptographic proof of intent |
| P2 | Multi-agent wallets | Per-agent wallets with separate budgets |
| P2 | Merchant onboarding | Self-serve for Shopify merchants |
| P2 | UCP PSP integration | Become a Payment Service Provider |
| P3 | Cross-platform | WooCommerce, custom stores |
| P3 | OpenClaw skill | Marketplace distribution |
| P3 | Analytics | Spending patterns, budget optimization |

---

## Key Technical Decisions & Reasoning

**Why thirdweb over custom viem?**
- Managed wallet creation + KMS support out of the box
- x402 facilitator built-in (no custom settlement code)
- Can migrate to custom implementation later if needed
- Abstracts wallet key management (critical for production security)

**Why MCP is a thin client (not a business logic host)?**
- Business logic in the API means the dashboard and MCP share the same behavior
- Testing doesn't require MCP transport layer
- Other future interfaces (CLI, SDK, webhooks) reuse the same API
- MCP is a transport adapter: it translates tool calls → HTTP. That's it.

**Why combined MCP (not modular)?**
- One config entry for the agent (simpler setup)
- We control the full shopping + payment flow
- Cleaner demo narrative ("add ScuttlePay, agent can shop")
- Can factor into modular post-hackathon

**Why Shopify Storefront API (not their MCP server)?**
- Storefront API is stable, documented, GraphQL
- Shopify's Checkout MCP is in partner preview (may not have access)
- We wrap Storefront API in our own MCP tools (same end result for the agent)
- Post-hackathon: upgrade to Shopify MCP when we get partner access

**Why Vercel Postgres (Neon) over Convex?**
- Relational data model (transactions, orders, wallets) with foreign keys
- ACID guarantees for financial data (no eventual consistency on money)
- Vercel Postgres IS Neon under the hood — same driver, same Drizzle setup
- Managed through Vercel dashboard (one fewer account/service to manage)
- Included with Vercel Pro plan (already paying for it)
- Real-time updates via polling (2s) is fine for MVP. WebSocket post-hackathon.

**Why Hono on Vercel Functions (not standalone Node server)?**
- Hono has a first-class Vercel adapter (`@hono/vercel`)
- API and dashboard co-hosted = one deploy, one domain, simpler CORS
- Vercel Pro gives generous function execution (1M invocations/month)
- Can eject to standalone Node/Bun later if needed (Hono is runtime-agnostic)
- For hackathon: `vercel dev` runs everything locally

**Why x402 over AP2 for hackathon?**
- x402 has TypeScript SDK (AP2's A2A extension is Python-only)
- x402 is the settlement layer AP2 uses anyway
- We're AP2-compatible in architecture, can add mandate support later
- Simpler for hackathon, aligns with long-term direction

**Why not virtual cards?**
- Adds complexity (card issuing partnership, compliance)
- Doesn't align with "no credit card needed" pitch
- x402/crypto settlement is more interesting technically and as a demo
- Virtual cards are a commodity; x402 agent payments are novel

**Why separate transactions and orders tables?**
- A transaction can exist without an order (wallet funding)
- An order can fail after a successful transaction (Shopify API down)
- Different lifecycle: transaction is our record, order is the merchant's record
- Clean audit trail: "money moved" is a different fact from "merchant fulfilled"

---

## Revenue Model

**Transaction fee**: ScuttlePay takes a % of each transaction (e.g., 1.5%).
- Deducted from what the merchant receives (merchant absorbs, like Stripe)
- For hackathon: no fee (free). Fee calculation in code but set to 0%.
- Post-hackathon: enable fees, offer volume discounts
- Fee column in `transactions` table from day 1 (just always $0 for now)

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| thirdweb x402 facilitator issues | HIGH | Fallback to Coinbase facilitator (`x402.org/facilitator`). Both use same protocol. Facilitator URL is configurable. |
| Base Sepolia testnet down | HIGH | Pre-fund multiple wallets. Backup demo recording. Test 1hr before. |
| thirdweb server wallet creation fails | HIGH | Pre-create wallet before demo day. Store wallet ID in env, not created at runtime. |
| Shopify Storefront API rate limits | MED | Cache product data (60s TTL). Don't hammer API during demo. |
| x402 signing produces invalid signatures | MED | Test against facilitator `/verify` early. Follow exact EIP-712 domain params. Integration test in CI. |
| Demo latency (x402 settlement takes >10s) | MED | Rehearse. If slow, explain "settling on blockchain" during demo. Base is usually 2-5s. |
| Shopify Admin API order creation fails | LOW | Non-fatal: payment succeeded, order logged in our DB. Show transaction, not Shopify order. |
| API key leaked in demo | LOW | Use testnet. Revoke + rotate keys after demo. Never show full key on screen. |

---

## File Structure

```
scuttlepay/
├── packages/
│   ├── mcp/                          # MCP Server (agent-facing transport)
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point, StdioServerTransport
│   │   │   ├── server.ts             # MCP server registration (tools)
│   │   │   ├── tools/
│   │   │   │   ├── search.ts         # search_products tool
│   │   │   │   ├── product.ts        # get_product tool
│   │   │   │   ├── buy.ts            # buy tool
│   │   │   │   ├── balance.ts        # get_balance tool
│   │   │   │   └── transactions.ts   # get_transactions tool
│   │   │   ├── api-client.ts         # HTTP client for ScuttlePay API
│   │   │   └── config.ts             # Env var parsing (API URL, key)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/                          # API Server (all business logic)
│   │   ├── src/
│   │   │   ├── index.ts              # Hono server entry + middleware stack
│   │   │   ├── routes/
│   │   │   │   ├── wallet.ts         # /api/wallet/* routes
│   │   │   │   ├── products.ts       # /api/products/* routes
│   │   │   │   ├── purchases.ts      # /api/purchases routes
│   │   │   │   ├── transactions.ts   # /api/transactions/* routes
│   │   │   │   └── health.ts         # /health route
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # API key validation
│   │   │   │   ├── request-id.ts     # X-Request-ID generation
│   │   │   │   └── error-handler.ts  # Structured error responses
│   │   │   ├── services/
│   │   │   │   ├── wallet.service.ts
│   │   │   │   ├── payment.service.ts
│   │   │   │   ├── shopify.service.ts
│   │   │   │   ├── spending.service.ts
│   │   │   │   └── purchase.service.ts
│   │   │   ├── db/
│   │   │   │   ├── schema.ts         # Drizzle schema (all tables)
│   │   │   │   ├── index.ts          # DB client + connection
│   │   │   │   ├── migrate.ts        # Migration runner
│   │   │   │   └── seed.ts           # Seed script (test user, wallet, key)
│   │   │   └── lib/
│   │   │       ├── thirdweb.ts       # thirdweb SDK client init
│   │   │       └── shopify.ts        # Shopify API client init
│   │   ├── drizzle/                  # Generated migrations
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                          # Dashboard (Next.js)
│   │   ├── app/
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── layout.tsx            # Root layout
│   │   │   ├── dashboard/
│   │   │   │   ├── layout.tsx        # Dashboard layout (sidebar/nav)
│   │   │   │   ├── page.tsx          # Wallet overview
│   │   │   │   ├── transactions/
│   │   │   │   │   └── page.tsx      # Transaction list
│   │   │   │   └── setup/
│   │   │   │       └── page.tsx      # MCP config instructions
│   │   │   └── globals.css
│   │   ├── lib/
│   │   │   ├── api-client.ts         # HTTP client for ScuttlePay API
│   │   │   └── queries.ts            # TanStack Query hooks
│   │   ├── components/               # shadcn/ui + custom components
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                       # Shared types, schemas, constants
│       ├── src/
│       │   ├── index.ts              # Public exports
│       │   ├── types.ts              # Domain types (User, Wallet, Transaction, etc.)
│       │   ├── schemas.ts            # Zod schemas (API request/response validation)
│       │   ├── errors.ts             # Typed error definitions (PaymentError, etc.)
│       │   └── constants.ts          # Chain IDs, USDC addresses, facilitator URLs
│       ├── package.json
│       └── tsconfig.json
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .env.example
└── README.md
```

---

## Testing Strategy

### Hackathon (minimum viable testing)
- **Integration tests for payment flow**: Sign → settle → verify. Runs against Base Sepolia testnet.
- **E2E test script**: The demo rehearsal script IS the E2E test. search → buy → verify balance → verify transaction.
- **Type safety**: `pnpm typecheck` in CI/turbo. Zero `as any`.

### Post-Hackathon (production testing)
- **Unit tests**: Service layer (spending policy evaluation, price parsing, error handling)
- **Integration tests**: API routes with test DB (Neon branch per test suite)
- **MCP tests**: Tool registration, param validation, error message formatting
- **Contract tests**: Verify x402 signing against facilitator `/verify` (catches EIP-712 regressions)

---

## Configuration & Environment

```env
# Database (Vercel Postgres — connection string from Vercel dashboard)
POSTGRES_URL=postgresql://...  # Vercel Postgres connection string
# Or if using Neon directly:
# DATABASE_URL=postgresql://...@ep-xxx.us-east-2.aws.neon.tech/scuttlepay

# thirdweb
THIRDWEB_SECRET_KEY=...
THIRDWEB_CLIENT_ID=...
THIRDWEB_WALLET_ID=...  # Pre-created server wallet ID

# Shopify
SHOPIFY_STORE_URL=https://your-store.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=...  # Public storefront access token
SHOPIFY_ADMIN_TOKEN=...       # Admin API access token

# Chain
CHAIN_ENV=testnet  # testnet | mainnet
USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e  # Base Sepolia

# API
API_PORT=3001
API_URL=http://localhost:3001  # Used by MCP + web

# Spending defaults
DEFAULT_MAX_PER_TX=10
DEFAULT_DAILY_LIMIT=50

# Auth (hackathon: single key, post-hackathon: Clerk)
SEED_API_KEY=sk_test_...  # Only used by seed script
# CLERK_SECRET_KEY=...    # Post-hackathon
```

---

## Verification Plan

| What | How to verify |
|------|--------------|
| Monorepo builds | `pnpm build` — zero errors across all packages |
| Type safety | `pnpm typecheck` — zero errors, zero `as any` |
| DB schema | `pnpm db:push` — applies cleanly. Seed script creates test data. |
| Wallet created | `GET /api/wallet/balance` returns USDC balance from Base Sepolia |
| Auth works | Valid API key → 200. No key → 401. Invalid key → 401. |
| Product search | `GET /api/products?q=shoes` → Shopify products returned |
| Purchase flow | `POST /api/purchases` → tx settles on Base Sepolia → tx hash on Basescan |
| Spending limits | Buy above max_per_tx → `SPENDING_LIMIT_EXCEEDED` error |
| MCP works | Claude Code: "search for products" → products returned via MCP |
| MCP buy | Claude Code: "buy the [product]" → purchase completes, balance decreases |
| Dashboard | Agent buys → transaction appears in dashboard within 5s |
| E2E demo | 3-minute script runs cleanly 3 times in a row |
