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
| Auth | NextAuth (Discord) for dashboard. API key for MCP. | Additional OAuth providers, user self-service |
| Users | Single seeded user row in DB | Multi-user with NextAuth identity |
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
| Framework | T3 Stack (`create-t3-app` v7.40.0) | Next.js + tRPC + Drizzle + NextAuth. Type-safe full-stack in one app. |
| MCP Server | `@modelcontextprotocol/sdk` + TypeScript | Agent-facing product. Claude-native. Separate workspace package (`packages/mcp`). |
| API Layer | tRPC v11 + TanStack Query | End-to-end type-safe API. Server-side RSC support. Shared types without codegen. |
| Wallet + x402 | thirdweb SDK | Managed wallets, x402 facilitator, KMS support. Eliminates custom crypto code. |
| Shopify Integration | Shopify Storefront API (GraphQL) | Product browsing, cart. Public API with storefront access token. |
| Order Creation | Shopify Admin API | Create orders after x402 payment settles. |
| Database | PostgreSQL (Neon) + Drizzle ORM | Transaction logs, wallet metadata, order records. ACID for financial data. `postgres.js` driver. |
| Dashboard | Next.js 15 App Router + shadcn/ui + Tailwind v4 | Wallet view + transaction table + setup instructions. Same app as API (T3 monolith). |
| Hosting | Vercel Pro ($20/month) | Dashboard + tRPC API co-hosted. Preview deployments for PRs. |
| Blockchain | Base Sepolia (testnet) → Base mainnet | USDC, 2s finality, ~$0.001 fees. |
| Validation | zod | Shared schemas across MCP + tRPC. Single source of truth for domain types. tRPC uses zod natively for input validation. |
| Auth (dashboard) | NextAuth v5 (Auth.js) | Discord OAuth for dashboard. Session-based. Drizzle adapter for DB persistence. |
| Auth (MCP/programmatic) | API key middleware (Route Handlers) | Bearer token auth for MCP server and external clients. SHA-256 hashed, stored in DB. Shared validation utility used by Route Handlers and tRPC. |
| Env Validation | `@t3-oss/env-nextjs` | Zod-validated env vars. Fails fast on missing config. Type-safe `env` object. |
| Shared Types | `@scuttlepay/shared` workspace package | Domain types, zod schemas, error classes, constants. Used by both main app and MCP package. |

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
│  Thin orchestration layer — calls Route Handlers         │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  Product      │  │  Payment     │  │  Wallet       │ │
│  │  Tools        │  │  Tools       │  │  Tools        │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
└─────────┼─────────────────┼───────────────────┼─────────┘
          │                 │                   │
          └─────────────────┼───────────────────┘
                            │ (HTTP + API key → Next.js Route Handlers)
┌───────────────────────────▼─────────────────────────────┐
│         ScuttlePay Next.js App (root)                    │
│         T3 Stack: Next.js + tRPC + Drizzle + NextAuth    │
│                                                         │
│  ┌─ Dashboard (App Router) ──────────────────────────┐  │
│  │  NextAuth sessions — protectedProcedure            │  │
│  │  Pages: wallet, transactions, setup, landing       │  │
│  │  Uses tRPC React Query hooks                       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ API Layer ─────────────────────────────────────────┐  │
│  │  tRPC Routers (src/server/api/routers/)            │  │
│  │    wallet.router  product.router  purchase.router  │  │
│  │  Route Handlers (src/app/api/mcp/)                 │  │
│  │    /api/mcp/wallet  /products  /purchase  /txns    │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
│  ┌─ Service Layer (src/server/services/) ────────────┐  │
│  │  wallet.service    payment.service                 │  │
│  │  shopify.service   spending.service                │  │
│  │  purchase.service  (orchestrator)                  │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │           Neon PostgreSQL (Drizzle ORM)            │  │
│  │  scuttlepay_* tables (pgTableCreator prefix)       │  │
│  │  users, accounts, sessions (NextAuth)              │  │
│  │  api_keys, wallets, spending_policies,             │  │
│  │  transactions, orders (domain)                     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────┬─────────────────┬─────────────────────────────┘
           │                  │
           ▼                  ▼
    ┌──────────┐     ┌──────────────┐
    │ Shopify  │     │  thirdweb    │
    │ Store    │     │  Facilitator │
    │ (GQL)    │     │  (x402)      │
    └──────────┘     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │  USDC on     │
                     │  Base        │
                     └──────────────┘
```

### Key Architectural Boundaries

**1. T3 monolith for dashboard + API**: The Next.js app hosts both the dashboard UI and tRPC API. The dashboard calls tRPC procedures directly (type-safe, no HTTP overhead in RSC). External clients (MCP server) call Next.js Route Handlers at `/api/mcp/*` (REST endpoints with API key auth) which invoke the same service layer.

**2. MCP is a thin client**: The MCP server is a **transport adapter**, not a business logic host. It translates MCP tool calls into HTTP requests to Next.js Route Handlers at `/api/mcp/*`. This means:
- All business logic (spending checks, payment orchestration, order creation) lives in the service layer
- The dashboard uses tRPC hooks directly; the MCP server uses Route Handlers (REST + API key)
- Both resolve to the same service layer — identical business logic regardless of caller
- Testing the payment flow doesn't require spinning up an MCP server
- Post-hackathon, other interfaces (CLI, SDK, webhooks) call the same service layer via Route Handlers or tRPC

**3. Dual auth**: NextAuth handles dashboard sessions (Discord OAuth). API keys handle MCP/programmatic access. Both resolve to a user context that the service layer consumes.

### Payment Flow (what happens when agent calls `buy()`)

1. MCP `buy` tool receives `(productId, variantId?, quantity?)` from agent
2. MCP calls the `/api/mcp/purchase` Route Handler via HTTP (with API key in header)
3. Route Handler middleware validates API key, resolves user + wallet context
4. `purchase.service` fetches product from Shopify Storefront API (price, variant)
5. `purchase.service` checks: wallet balance >= product price (via thirdweb/on-chain query)
6. `spending.service` evaluates spending policies (per-tx max, daily cap, queried from DB)
7. If checks pass: constructs x402 payment payload (USDC amount, payTo = merchant wallet)
8. Signs EIP-712 `TransferWithAuthorization` via thirdweb server wallet
9. Submits to thirdweb x402 facilitator → settles on Base (~2-5s)
10. On settlement (tx hash received): creates order via Shopify Admin API
11. Logs transaction in PostgreSQL (amount, txHash, orderId, productId, status, timestamps)
12. Returns purchase result to MCP → MCP formats and returns to agent

**Error states at each step** (not exhaustive, but the important ones):
- Step 5: `INSUFFICIENT_BALANCE` — wallet doesn't have enough USDC
- Step 6: `SPENDING_LIMIT_EXCEEDED` — per-tx or daily cap hit
- Step 7-9: `PAYMENT_FAILED` — x402 signing or settlement failure (network, facilitator down)
- Step 10: `ORDER_CREATION_FAILED` — Shopify Admin API error (non-fatal: payment succeeded, order logged in our DB)

---

## Data Model

Designed for multi-user and multi-wallet from day 1. Hackathon seeds one user + one wallet. All domain tables use `scuttlepay_` prefix (via Drizzle `pgTableCreator`). NextAuth tables coexist in the same database.

**Table prefix**: All ScuttlePay domain tables are prefixed with `scuttlepay_` to namespace alongside NextAuth tables. In code, we reference them without the prefix (e.g., `users`, `wallets`), but the DB columns are `scuttlepay_users`, `scuttlepay_wallets`, etc. The `drizzle.config.ts` uses `tablesFilter: ["scuttlepay_*"]` for migrations.

### NextAuth Tables (managed by Drizzle adapter)

```
users
├── id              varchar(255) PK
├── name            varchar(255)
├── email           varchar(255) NOT NULL
├── emailVerified   timestamptz
└── image           varchar(255)

accounts              (OAuth provider linking)
├── userId           varchar(255) FK → users.id
├── type             varchar(255)
├── provider         varchar(255)
├── providerAccountId varchar(255)
├── refresh_token    text
├── access_token     text
├── expires_at       integer
├── token_type       varchar(255)
├── scope            varchar(255)
├── id_token         text
└── session_state    varchar(255)

sessions
├── sessionToken     varchar(255) PK
├── userId           varchar(255) FK → users.id
└── expires          timestamptz

verificationTokens
├── identifier       varchar(255)
├── token            varchar(255)
└── expires          timestamptz
```

### ScuttlePay Domain Tables

```
scuttlepay_api_keys
├── id              varchar(255) PK (crypto.randomUUID())
├── userId          varchar(255) FK → users.id
├── keyHash         text NOT NULL (SHA-256 hash)
├── keyPrefix       varchar(20) NOT NULL (first 8 chars, for display: "sk_test_abc1...")
├── name            varchar(255) DEFAULT 'default'
├── isActive        boolean DEFAULT true
├── lastUsedAt      timestamptz
├── createdAt       timestamptz DEFAULT now()
└── expiresAt       timestamptz (nullable)

scuttlepay_wallets
├── id              varchar(255) PK (crypto.randomUUID())
├── userId          varchar(255) FK → users.id
├── address         varchar(255) (on-chain wallet address)
├── chainId         integer DEFAULT 84532 (84532 = Base Sepolia)
├── label           varchar(255) DEFAULT 'default'
├── thirdwebId      varchar(255) (thirdweb server wallet identifier)
├── isActive        boolean DEFAULT true
├── createdAt       timestamptz DEFAULT now()
└── updatedAt       timestamptz

scuttlepay_spending_policies
├── id              varchar(255) PK (crypto.randomUUID())
├── walletId        varchar(255) FK → wallets.id
├── maxPerTx        numeric(20,6) (USDC, 6 decimals)
├── dailyLimit      numeric(20,6)
├── monthlyLimit    numeric(20,6) (nullable — post-hackathon)
├── allowedMerchants text[] (nullable — post-hackathon allowlist)
├── isActive        boolean DEFAULT true
├── createdAt       timestamptz DEFAULT now()
└── updatedAt       timestamptz

scuttlepay_transactions
├── id              varchar(255) PK (crypto.randomUUID())
├── walletId        varchar(255) FK → wallets.id
├── type            varchar(50) ('purchase' | 'fund' | 'refund')
├── status          varchar(50) ('pending' | 'settling' | 'settled' | 'failed')
├── amountUsdc      numeric(20,6)
├── txHash          varchar(255) (nullable — null until settlement)
├── merchantAddress varchar(255) (payTo address)
├── productId       varchar(255) (Shopify product GID)
├── productName     varchar(255) (denormalized for display)
├── storeUrl        varchar(255)
├── errorMessage    text (nullable)
├── metadata        jsonb (flexible: variant info, facilitator response, etc.)
├── initiatedAt     timestamptz
├── settledAt       timestamptz (nullable)
└── createdAt       timestamptz DEFAULT now()

scuttlepay_orders
├── id              varchar(255) PK (crypto.randomUUID())
├── transactionId   varchar(255) FK → transactions.id
├── walletId        varchar(255) FK → wallets.id
├── shopifyOrderId  varchar(255) (nullable)
├── shopifyOrderNumber varchar(255) (nullable — human-readable "#1001")
├── status          varchar(50) ('created' | 'confirmed' | 'failed')
├── productId       varchar(255)
├── productName     varchar(255)
├── variantId       varchar(255) (nullable)
├── quantity        integer DEFAULT 1
├── unitPriceUsdc   numeric(20,6)
├── totalUsdc       numeric(20,6)
├── storeUrl        varchar(255)
├── errorMessage    text (nullable)
├── createdAt       timestamptz DEFAULT now()
└── updatedAt       timestamptz
```

**Design notes**:
- `transactions` and `orders` are separate: a transaction can exist without an order (funding), and an order creation can fail after a successful transaction (Shopify API down)
- `spending_policies` is its own table (not columns on `wallets`) for extensibility: allowlists, time-based policies, per-merchant limits
- `numeric(20,6)` for USDC amounts: 6 decimal places matches USDC on-chain precision, 20 total digits handles any realistic amount
- `metadata jsonb` on transactions: escape hatch for data we don't want to model yet (facilitator response, gas info, etc.)
- All timestamps are `timestamptz` — financial data needs timezone-aware timestamps
- Column naming uses camelCase in Drizzle code (maps to snake_case in DB via Drizzle conventions)
- IDs use `crypto.randomUUID()` via `$defaultFn(() => crypto.randomUUID())` — standard UUID v4, no external dependency
- `users` table is shared between NextAuth and ScuttlePay domain — NextAuth manages the base user row, ScuttlePay links to it via foreign keys

---

## Service Layer Architecture

All business logic lives in the Next.js server layer (`src/server/`), organized as services. tRPC routers are thin — they validate input, call services, and return results.

### Service Boundaries

```
src/server/
├── api/
│   ├── root.ts                # App-level tRPC router (merges all routers)
│   ├── trpc.ts                # tRPC context, middleware, procedure definitions
│   └── routers/
│       ├── wallet.ts          # Wallet balance/address queries
│       ├── product.ts         # Product search/details (Shopify)
│       └── purchase.ts        # Execute purchase, list transactions
├── services/
│   ├── wallet.service.ts      # Wallet CRUD, balance queries (wraps thirdweb)
│   ├── payment.service.ts     # x402 signing, settlement orchestration
│   ├── shopify.service.ts     # Storefront API queries, Admin API order creation
│   ├── spending.service.ts    # Policy evaluation, daily totals, limit checks
│   └── purchase.service.ts    # Orchestrates the full buy flow (calls other services)
├── lib/
│   ├── thirdweb.ts            # thirdweb SDK client init
│   ├── shopify.ts             # Shopify API client init
│   └── api-key.ts             # API key generation, hashing, verification
├── auth/
│   ├── config.ts              # NextAuth configuration (Discord, Drizzle adapter)
│   └── index.ts               # NextAuth instance (auth, signIn, signOut)
└── db/
    ├── schema/                # Drizzle schema (split by domain)
    │   ├── index.ts           # Barrel exports + table creator
    │   ├── table-creator.ts   # pgTableCreator with scuttlepay_ prefix
    │   ├── auth.ts            # NextAuth tables (users, accounts, sessions, verificationTokens)
    │   ├── api-key.ts         # API key table
    │   ├── wallet.ts          # Wallet + spending policy tables
    │   ├── transaction.ts     # Transaction + order tables
    │   └── relations.ts       # All table relations
    ├── index.ts               # DB client + connection (postgres.js driver)
    └── seed.ts                # Seed script (demo user, wallet, API key)
```

### tRPC Router ↔ Service Layer Relationship

tRPC routers are **transport adapters** (just like MCP). They handle:
- Input validation (via zod schemas)
- Auth context (session or API key)
- Calling the appropriate service method
- Returning the result

Services handle:
- Business logic
- External API calls (Shopify, thirdweb)
- Database operations
- Error handling with typed errors

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

### Auth Strategy (Dual Auth)

Two auth modes serve different callers:

1. **Session auth** (dashboard): NextAuth session cookie → resolves to user. Used by tRPC `protectedProcedure`.
2. **API key auth** (MCP/programmatic): `Authorization: Bearer sk_test_...` → SHA-256 hash → lookup in `api_keys` table → resolves to user. Used by Route Handler middleware at `/api/mcp/*`.

Both produce the same context: `{ userId, walletId }`. Services are auth-agnostic — they receive a wallet ID and operate on it.

### Error Handling Strategy

Domain errors use `ScuttlePayError` class from `@scuttlepay/shared`:
```typescript
class ScuttlePayError extends Error {
  code: ErrorCode;
  statusCode: number;
  retriable: boolean;
  metadata?: Record<string, unknown>;
}
```

Error codes: `INSUFFICIENT_BALANCE`, `SPENDING_LIMIT_EXCEEDED`, `PAYMENT_FAILED`, `PRODUCT_NOT_FOUND`, `ORDER_CREATION_FAILED`, `UNAUTHORIZED`, `WALLET_NOT_FOUND`, `INVALID_API_KEY`, `POLICY_VIOLATION`, `SHOPIFY_ERROR`, `THIRDWEB_ERROR`, `INTERNAL_ERROR`.

tRPC error formatting in `src/server/api/trpc.ts` catches `ScuttlePayError` and maps to appropriate tRPC error codes for the dashboard. Route Handlers at `/api/mcp/*` catch `ScuttlePayError` and return JSON error responses. The MCP server translates these into human-readable messages for the agent via `toAgentMessage()`. The dashboard displays them as appropriate UI states.

External service failures (thirdweb down, Shopify rate-limited) are wrapped in `ScuttlePayError` with `retriable: boolean` so callers know whether to retry.

---

## Build Plan — Epics & Tasks

Each task is designed to be **individually executable, testable, and verifiable**. A future agent session should be able to pick up any task, read its spec, implement it, and prove it works — without reading the entire document.

**Dependency notation**: `→` means "must be completed before". Tasks within an epic are ordered, but tasks without explicit dependencies can be parallelized.

**What's already done**: The T3 scaffold (Task 1.1), shared types package (Task 1.2), DB schema (Task 1.3), seed script (Task 1.4), and tRPC skeleton (Task 1.5) are **already implemented**. Epic 1 is complete. Implementation starts at Epic 2.

### Task Summary & Critical Path

```
Epic 1: Foundation (DONE)    Epic 2: Wallet       Epic 3: Shopify
  ✅ 1.1 T3 Scaffold          2.1 thirdweb SDK     3.1 Storefront client
  ✅ 1.2 Shared types          ↓                    ↓
  ✅ 1.3 DB schema             2.2 Wallet service   3.2 Product tRPC router
  ✅ 1.4 Seed script           ↓
  ✅ 1.5 tRPC skeleton         2.3 Wallet tRPC router
  ✅ 1.6 Auth (NextAuth +             ↓                    ↓
         API key middleware)   ┌──────┴────────────────────┘
                               │
                          Epic 4: Payment Engine
                           4.1 Spending service
                           4.2 x402 signing
                           4.3 Order creation (Shopify Admin)
                           4.4 Purchase orchestrator (composes 4.1-4.3)
                           4.5 Purchase + transaction tRPC routers
                                     │
                    ┌────────────────┼──────────────┐
                    ↓                ↓              ↓
              Epic 5: MCP     Epic 6: Dashboard  Epic 7: Demo
              5.1 Scaffold    6.1 Wallet page    7.1 Demo store
              5.2 Products    6.2 Transactions   7.2 Funded wallet
              5.3 Buy         6.3 Setup page     7.3 E2E test
              5.4 Balance     6.4 Landing page   7.4 Demo script
              5.5 Packaging                      7.5 Backup recording
```

**Critical path**: ✅1.1-1.6 → 2.1 → 2.2 → 4.2 → 4.4 → 4.5 → 5.3 (agent can buy)

**Total hackathon tasks**: 27 tasks across 7 epics (6 done in Epic 1)
**Post-hackathon tasks**: 8 tasks across 3 epics

---

## Epic 1: Project Foundation ✅ COMPLETE

**Goal**: T3 scaffold with shared types, tRPC API, database, and auth. Establishes every pattern that subsequent code follows.

**Status**: All tasks complete. The T3 app is scaffolded with:
- Next.js 15 App Router + tRPC v11 + Drizzle ORM + NextAuth v5
- `packages/shared` with domain types, zod schemas, error classes, constants
- `packages/mcp` placeholder with workspace dependency on shared
- Full DB schema in `src/server/db/schema/` (all 6 domain tables + NextAuth tables, split by domain)
- Seed script in `src/server/db/seed.ts`
- tRPC skeleton with `publicProcedure` and `protectedProcedure`
- NextAuth with Discord provider + Drizzle adapter
- API key utilities in `src/server/lib/api-key.ts` (generate, hash, verify with environment-aware prefix: `sk_live_` / `sk_test_`)
- T3 env validation via `@t3-oss/env-nextjs`
- shadcn/ui components (button, card, table, badge)

---

### Task 1.1: T3 Scaffold ✅

**What**: `create-t3-app` v7.40.0 with pnpm workspace for `packages/shared` and `packages/mcp`.

**Completed deliverables**:
- T3 Next.js app at root with tRPC, Drizzle, NextAuth, Tailwind v4
- `pnpm-workspace.yaml` with `packages/*`
- `packages/shared` and `packages/mcp` as workspace packages
- TypeScript strict mode, ESLint flat config, Prettier with Tailwind plugin
- `@t3-oss/env-nextjs` for env validation
- Path alias `~/*` → `./src/*`
- `.env.example` documenting all env vars

---

### Task 1.2: Shared Package — Domain Types & Constants ✅

**What**: `@scuttlepay/shared` package with types, schemas, errors, constants.

**Completed deliverables** (`packages/shared/src/`):
- `constants.ts`: Chain IDs, USDC addresses, facilitator URLs, API routes
- `enums.ts`: `TransactionType`, `TransactionStatus`, `OrderStatus`
- `types.ts`: Domain types (User, Wallet, ApiKey, SpendingPolicy, Transaction, Order)
- `schemas.ts`: Zod schemas for all API contracts (`purchaseRequestSchema`, `productSearchParamsSchema`, etc.)
- `errors.ts`: `ScuttlePayError` class with 13 error codes, `isScuttlePayError()`, `toAgentMessage()`, `toApiResponse()`
- `index.ts`: Barrel exports

---

### Task 1.3: Database Schema ✅

**What**: Drizzle ORM schema with all domain tables + NextAuth tables.

**Completed deliverables**:
- `src/server/db/schema/`: All 6 ScuttlePay tables + 4 NextAuth tables with `scuttlepay_` prefix via `pgTableCreator`, split by domain (auth, api-key, wallet, transaction, relations)
- `src/server/db/index.ts`: Drizzle instance with `postgres.js` driver, global connection caching in dev
- `drizzle.config.ts`: Points to `./src/server/db/schema` directory, `tablesFilter: ["scuttlepay_*"]`
- Relations defined for all tables

---

### Task 1.4: Database Seed Script ✅

**What**: Idempotent seed script for development/demo data.

**Completed deliverables**:
- `src/server/db/seed.ts`: Creates demo user, API key (SHA-256 hashed), wallet, spending policy
- `src/server/lib/api-key.ts`: `generateApiKey()`, `hashApiKey()`, `verifyApiKey()` (timing-safe comparison)
- `pnpm db:seed` script in `package.json`

---

### Task 1.5: tRPC API Skeleton ✅

**What**: tRPC server with context, middleware, and procedure types.

**Completed deliverables**:
- `src/server/api/trpc.ts`: Context (db, session, headers), SuperJSON transformer, ZodError formatting
- `src/server/api/root.ts`: App router with `createCaller` factory, health check query
- `src/app/api/trpc/[trpc]/route.ts`: tRPC HTTP handler
- `src/trpc/react.tsx`: TRPCReactProvider with TanStack Query + httpBatchStreamLink
- `src/trpc/server.ts`: Server-side RSC helpers with `createHydrationHelpers`
- `publicProcedure` (timing middleware) and `protectedProcedure` (session required)

---

### Task 1.6: Auth Setup ✅

**What**: NextAuth v5 with Discord + API key utilities for MCP auth.

**Completed deliverables**:
- `src/server/auth/config.ts`: NextAuth with Discord provider, Drizzle adapter, session callback with user.id
- `src/server/auth/index.ts`: Cached `auth()`, `signIn`, `signOut` exports
- `src/app/api/auth/[...nextauth]/route.ts`: NextAuth route handler
- API key generation and hashing utilities (SHA-256, timing-safe verify)
- `protectedProcedure` in tRPC that checks NextAuth session

**Remaining work** (Epic 2+): Add `apiKeyProcedure` tRPC middleware that validates API keys for MCP/programmatic access.

---

### Epic 1 — Done Criteria ✅

All verified:
- `pnpm install` completes ✅
- `pnpm build` succeeds ✅
- `pnpm typecheck` passes ✅
- `pnpm lint` passes ✅
- `pnpm db:push` applies clean schema ✅
- `pnpm db:seed` creates test data ✅
- tRPC API starts with `pnpm dev` ✅
- NextAuth Discord login works ✅
- Shared package importable from main app and MCP package ✅

---

## Epic 2: Wallet Integration

**Goal**: Connect thirdweb managed wallets. Query on-chain USDC balance. Expose wallet tRPC procedures.

**Why before payment/shopping**: The wallet is the core primitive. You can't build payments without a wallet that has a balance. This epic gives us a funded wallet and the ability to check its balance through the API.

**Prerequisite**: Add API key validation middleware (validates API keys for MCP/programmatic access). This is needed for MCP Route Handlers and any future programmatic callers.

---

### Task 2.0: API Key Auth Middleware

**What**: Shared API key validation for Route Handlers (MCP) and tRPC (future programmatic callers), complementing NextAuth session auth.

**Deliverables**:

Create `src/server/lib/validate-api-key.ts`:
- `validateApiKey(authHeader: string)` → `{ userId, walletId }` or throws
  - Reads `Authorization: Bearer sk_...` from header
  - SHA-256 hashes the key, looks up in `api_keys` table (active, not expired)
  - Resolves `userId` and default `walletId`
  - Updates `lastUsedAt` on the API key row (fire-and-forget)
  - Throws if invalid/missing/expired

Create `src/app/api/mcp/` Route Handlers:
- Shared middleware wrapper that calls `validateApiKey()` and injects user context
- Route Handlers: `purchase/route.ts`, `products/route.ts`, `wallet/route.ts`, `transactions/route.ts`
- Each handler delegates to the service layer (same services tRPC routers use)

Update `src/server/api/trpc.ts`:
- Add `authedProcedure` — accepts EITHER NextAuth session OR API key (via `validateApiKey`)
  - Checks session first (cheaper, no DB call if cookie present)
  - Falls back to API key check
  - Sets `userId` and `walletId` in context regardless of auth method

Update `src/env.js`:
- Add thirdweb env vars: `THIRDWEB_SECRET_KEY`, `THIRDWEB_CLIENT_ID`, `THIRDWEB_WALLET_ID`
- Add Shopify env vars: `SHOPIFY_STORE_URL`, `SHOPIFY_STOREFRONT_TOKEN`, `SHOPIFY_ADMIN_TOKEN`
- Add chain env vars: `CHAIN_ENV`, `DEFAULT_MAX_PER_TX`, `DEFAULT_DAILY_LIMIT`

**Verification**:
- [ ] Route Handler `GET /api/mcp/wallet` with valid API key from seed → returns wallet data
- [ ] Route Handler with invalid/missing API key → `401 UNAUTHORIZED` JSON error
- [ ] `authedProcedure` tRPC works with NextAuth session (browser)
- [ ] `authedProcedure` tRPC works with API key (curl)
- [ ] `lastUsedAt` updates after valid API key request
- [ ] `pnpm typecheck` passes

**Dependencies**: Task 1.6 (seed script creates API key, auth utilities exist)
**Files**: `src/server/lib/validate-api-key.ts`, `src/app/api/mcp/*/route.ts`, `src/server/api/trpc.ts`, `src/env.js`

---

### Task 2.1: thirdweb SDK Client Setup

**What**: Initialize thirdweb SDK, configure for Base Sepolia, set up server wallet reference.

**Deliverables**:

`src/server/lib/thirdweb.ts`:
- thirdweb SDK client initialization with `THIRDWEB_SECRET_KEY` and `THIRDWEB_CLIENT_ID`
- Server wallet reference using `THIRDWEB_WALLET_ID` (pre-created via thirdweb dashboard)
- Chain configuration for Base Sepolia (chain ID 84532)
- Export: `thirdwebClient`, `serverWallet`, `baseSepoliaChain`

Update `src/server/db/seed.ts`:
- Fetch the real wallet address from thirdweb using the wallet ID
- Update the wallet row with the real on-chain address

**Verification**:
- [ ] thirdweb client initializes without errors on server start
- [ ] Server wallet address can be retrieved programmatically
- [ ] Seed script now populates the correct on-chain address in the wallet row
- [ ] `pnpm build` succeeds

**Dependencies**: Task 2.0 (env vars added), Task 1.4 (seed script)
**External setup required**: Create server wallet in thirdweb dashboard, get `THIRDWEB_SECRET_KEY`, `THIRDWEB_CLIENT_ID`, `THIRDWEB_WALLET_ID`
**Files**: `src/server/lib/thirdweb.ts`, update `src/server/db/seed.ts`

---

### Task 2.2: Wallet Service

**What**: Service layer for wallet operations — balance queries, address lookup.

**Deliverables**:

`src/server/services/wallet.service.ts`:
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
**Files**: `src/server/services/wallet.service.ts`

**External action**: Fund the test wallet with testnet USDC (small amount, e.g., 10 USDC from Base Sepolia faucet)

---

### Task 2.3: Wallet tRPC Router

**What**: tRPC procedures for wallet balance and address. First real feature procedures.

**Deliverables**:

`src/server/api/routers/wallet.ts`:
- `wallet.getBalance` (query, `authedProcedure`) → returns `{ balance: "10.000000", currency: "USDC", chain: "base-sepolia" }`
  - Uses `walletId` from auth context
  - Calls `walletService.getBalance()`
  - Output validated against `walletBalanceSchema` from shared package
- `wallet.getAddress` (query, `authedProcedure`) → returns `{ address: "0x...", chain: "base-sepolia" }`

Register in `src/server/api/root.ts`.

**Verification**:
- [ ] Dashboard: `api.wallet.getBalance.useQuery()` renders balance
- [ ] HTTP: `POST /api/trpc/wallet.getBalance` with API key header → returns balance JSON
- [ ] Balance matches what's on-chain (check on Basescan)
- [ ] No auth → `UNAUTHORIZED` error
- [ ] `wallet.getAddress` returns the correct wallet address
- [ ] `pnpm typecheck` passes

**Dependencies**: Task 2.2 (wallet service), Task 2.0 (auth middleware)
**Files**: `src/server/api/routers/wallet.ts`, update `src/server/api/root.ts`

---

### Epic 2 — Done Criteria

- Wallet has a real on-chain address from thirdweb
- Balance procedure returns correct USDC balance from Base Sepolia
- Wallet is funded with testnet USDC (manual step)
- Both procedures work via dashboard (session auth) and HTTP (API key auth)

---

## Epic 3: Shopify Integration

**Goal**: Browse and search products from a real Shopify store via tRPC API.

---

### Task 3.1: Shopify Storefront API Client

**What**: GraphQL client for Shopify's Storefront API. Product search and detail queries.

**Deliverables**:

`src/server/lib/shopify.ts`:
- Storefront API client using `fetch` with GraphQL queries
- Configured with `SHOPIFY_STORE_URL` and `SHOPIFY_STOREFRONT_TOKEN` from env
- Typed query/response helpers using zod for response parsing

`src/server/services/shopify.service.ts`:
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

**Dependencies**: Task 1.2 (shared types), Task 2.0 (env vars configured)
**External setup required**: Shopify test store with products, Storefront API access token
**Files**: `src/server/lib/shopify.ts`, `src/server/services/shopify.service.ts`

---

### Task 3.2: Product tRPC Router

**What**: tRPC procedures for product search and details.

**Deliverables**:

`src/server/api/routers/product.ts`:
- `product.search` (query, `authedProcedure`) → search products
  - Input: `{ q: string, limit?: number }` validated by `productSearchParamsSchema`
  - `limit` defaults to 10, max 50
  - Returns array of products with IDs, names, prices, image URLs
  - Output validated against `productSearchResultSchema`
- `product.getById` (query, `authedProcedure`) → product details
  - Input: `{ productId: string }` (Shopify product GID)
  - Returns full product details with variants
  - Output validated against `productDetailSchema`

Register in `src/server/api/root.ts`.

**Verification**:
- [ ] Dashboard: `api.product.search.useQuery({ q: "shoes" })` renders products
- [ ] HTTP: `POST /api/trpc/product.search` with API key → products returned
- [ ] Product IDs in response can be used with `product.getById`
- [ ] Empty query → zod validation error
- [ ] Non-existent product ID → `PRODUCT_NOT_FOUND`
- [ ] Prices in response are USDC strings with proper precision

**Dependencies**: Task 3.1 (shopify service), Task 2.0 (auth middleware)
**Files**: `src/server/api/routers/product.ts`, update `src/server/api/root.ts`

---

### Epic 3 — Done Criteria

- Can search products from Shopify via tRPC
- Can get product details by ID
- Prices parsed correctly as USDC
- All procedures authenticated (session and API key)

---

## Epic 4: Payment Engine

**Goal**: The complete purchase flow — spending checks, x402 payment, settlement, order creation. This is the core product.

**Why this ordering**: Spending checks (4.1) → x402 signing (4.2) → order creation (4.3) → purchase orchestrator (4.4) → tRPC routers (4.5). Each builds on the previous.

---

### Task 4.1: Spending Policy Service

**What**: Evaluate spending limits before any payment attempt.

**Deliverables**:

`src/server/services/spending.service.ts`:
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
**Files**: `src/server/services/spending.service.ts`

---

### Task 4.2: x402 Payment Signing & Settlement

**What**: Sign EIP-712 payment authorization and settle via thirdweb facilitator.

**Deliverables**:

`src/server/services/payment.service.ts`:
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
**Files**: `src/server/services/payment.service.ts`

---

### Task 4.3: Order Creation (Shopify Admin API)

**What**: Create an order in Shopify after payment settlement. Non-fatal — if this fails, the payment still succeeded.

**Deliverables**:

Extend `src/server/services/shopify.service.ts`:
- `createOrder(params: { product, variant?, quantity, txHash, walletAddress })` → `{ shopifyOrderId, orderNumber }`
  - Uses Shopify Admin REST API (`POST /admin/api/2024-01/draft_orders.json`)
  - Creates draft order with: line items, note (tx hash, "Paid via ScuttlePay x402"), customer email (optional)
  - Returns Shopify order ID and human-readable order number
- Error handling:
  - Admin API failure → `ORDER_CREATION_FAILED { txHash }` (non-fatal)
  - Rate limit → retry once after 2s
  - Log full error for debugging

Update `src/server/lib/shopify.ts`:
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
**Files**: `src/server/services/shopify.service.ts`, `src/server/lib/shopify.ts`

---

### Task 4.4: Purchase Orchestrator Service

**What**: The central service that composes all other services into the full buy flow. This is the heart of ScuttlePay.

**Deliverables**:

`src/server/services/purchase.service.ts`:
- `purchase(params: { walletId, productId, variantId?, quantity? })` → `PurchaseResult`
- Flow:
  1. `shopifyService.getProduct(productId)` → get price and details
  2. `walletService.getBalance(walletId)` → check sufficient funds
  3. `spendingService.evaluate(walletId, totalUsdc)` → check spending limits
  4. Insert transaction row: `status: 'pending'`, `amountUsdc`, `productId`, `merchantAddress`
  5. `paymentService.signAndSettle(walletId, totalUsdc, merchantAddress)` → get tx hash
  6. Update transaction row: `status: 'settled'`, `txHash`, `settledAt`
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
**Files**: `src/server/services/purchase.service.ts`

---

### Task 4.5: Purchase & Transaction tRPC Routers

**What**: tRPC procedures for making purchases and viewing transaction history.

**Deliverables**:

`src/server/api/routers/purchase.ts`:
- `purchase.execute` (mutation, `authedProcedure`) → execute a purchase
  - Input: `{ productId: string, variantId?: string, quantity?: number }` validated by `purchaseRequestSchema`
  - Calls `purchaseService.purchase()` with `walletId` from auth context
  - Returns `PurchaseResult` on success
  - Throws `TRPCError` with appropriate code on failure (maps `ScuttlePayError` to tRPC error codes)

`src/server/api/routers/transaction.ts`:
- `transaction.list` (query, `authedProcedure`) → list transactions for authenticated wallet
  - Input: `{ limit?: number, cursor?: string }` validated by `transactionListParamsSchema`
  - Returns transactions ordered by `createdAt DESC`
  - Each transaction includes: id, type, status, amount, txHash, productName, storeUrl, timestamps
- `transaction.getById` (query, `authedProcedure`) → single transaction detail
  - Input: `{ id: string }`
  - Includes full metadata and linked order (if exists)

Register in `src/server/api/root.ts`.

**Verification**:
- [ ] Dashboard: `api.purchase.execute.useMutation()` → triggers purchase, returns PurchaseResult with txHash
- [ ] HTTP: `POST /api/trpc/purchase.execute` with API key + valid product → 200, PurchaseResult
- [ ] Insufficient balance → `INSUFFICIENT_BALANCE` error
- [ ] Amount exceeding per-tx limit → `SPENDING_LIMIT_EXCEEDED`
- [ ] `api.transaction.list.useQuery()` returns the purchase
- [ ] `api.transaction.getById.useQuery({ id })` returns full detail with metadata
- [ ] Pagination works: `limit=1` returns 1 result with cursor
- [ ] All responses match their zod schemas (tRPC enforces output schemas)

**Dependencies**: Task 4.4 (purchase service), Task 2.0 (auth middleware)
**Files**: `src/server/api/routers/purchase.ts`, `src/server/api/routers/transaction.ts`, update `src/server/api/root.ts`

---

### Epic 4 — Done Criteria

The full payment loop works end-to-end via tRPC:
1. `product.search({ q: "..." })` → find a product
2. `wallet.getBalance()` → confirm sufficient funds
3. `purchase.execute({ productId })` → payment settles on Base Sepolia
4. `wallet.getBalance()` → balance decreased
5. `transaction.list()` → purchase appears with tx hash
6. tx hash verifiable on Basescan

---

## Epic 5: MCP Server

**Goal**: MCP server that calls Route Handlers at `/api/mcp/*`. Agent says "buy me shoes" and it works.

---

### Task 5.1: MCP Server Scaffold + HTTP Client

**What**: MCP server setup with HTTP client calling Next.js Route Handlers at `/api/mcp/*`.

**Deliverables**:

`packages/mcp/src/config.ts`:
- Parse env vars: `SCUTTLEPAY_API_URL` (required, e.g., `http://localhost:3000`), `SCUTTLEPAY_API_KEY` (required)
- Validate on startup, fail fast with clear error if missing

`packages/mcp/src/api-client.ts`:
- HTTP client for the ScuttlePay Route Handlers at `/api/mcp/*`
- Sets `Authorization: Bearer <key>` on all requests
- Calls Route Handlers via REST:
  - `GET /api/mcp/products?q=...` — product search
  - `GET /api/mcp/products/:id` — product details
  - `POST /api/mcp/purchase` — execute purchase
  - `GET /api/mcp/wallet` — balance and address
  - `GET /api/mcp/transactions` — transaction history
- JSON request/response (no SuperJSON — Route Handlers use plain JSON)
- Error handling: parses error responses, extracts `ScuttlePayError` from error data
- Typed methods: `searchProducts()`, `getProduct()`, `purchase()`, `getBalance()`, `getTransactions()`

`packages/mcp/src/index.ts`:
- `@modelcontextprotocol/sdk` server with `StdioServerTransport`
- Server name: `scuttlepay`, version from package.json
- Registers tools (implemented in next tasks)

**Verification**:
- [ ] MCP server starts without errors when env vars are set
- [ ] MCP server fails fast with clear message when env vars are missing
- [ ] API client can call `GET /api/mcp/wallet` via HTTP and get a response
- [ ] API client correctly sets auth header
- [ ] `pnpm build` succeeds for `packages/mcp`

**Dependencies**: Epic 1 (shared types, error types), Epic 2-4 (tRPC API running)
**Files**: `packages/mcp/src/*`

---

### Task 5.2: MCP Tools — Product Search & Details

**What**: `search_products` and `get_product` tools.

**Deliverables**:

`packages/mcp/src/tools/search.ts`:
- Tool name: `search_products`
- Description: "Search for products available for purchase. Returns product names, prices in USDC, and IDs. Use a product ID from the results to get details or buy."
- Input schema: `{ query: string }` (zod from shared)
- Calls `apiClient.searchProducts(query)` (→ `GET /api/mcp/products?q=...`)
- Returns formatted list: each product as `"[name] — $[price] USDC (ID: [id])"`

`packages/mcp/src/tools/product.ts`:
- Tool name: `get_product`
- Description: "Get detailed information about a specific product including all variants, descriptions, images, and exact pricing."
- Input schema: `{ productId: string }` (zod from shared)
- Calls `apiClient.getProduct(productId)` (→ `GET /api/mcp/products/:id`)
- Returns formatted product details with all variants and prices

**Verification**:
- [ ] In Claude Code with MCP connected: "Search for products" → agent gets formatted product list
- [ ] "Tell me about [product ID from search]" → agent gets full details
- [ ] Invalid product ID → agent gets readable error message (not stack trace)
- [ ] `pnpm typecheck` passes

**Dependencies**: Task 5.1, Task 3.2 (product tRPC router)
**Files**: `packages/mcp/src/tools/search.ts`, `packages/mcp/src/tools/product.ts`

---

### Task 5.3: MCP Tools — Buy

**What**: The `buy` tool. Agent says "buy this" and money moves.

**Deliverables**:

`packages/mcp/src/tools/buy.ts`:
- Tool name: `buy`
- Description: "Purchase a product using your ScuttlePay wallet. Pays with USDC via x402 protocol. Returns order confirmation with blockchain transaction hash."
- Input schema: `{ productId: string, variantId?: string, quantity?: number }` (zod from shared)
- Calls `apiClient.purchase({ productId, variantId, quantity })` (→ `POST /api/mcp/purchase`)
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

**Dependencies**: Task 5.1, Task 4.5 (purchase tRPC router)
**Files**: `packages/mcp/src/tools/buy.ts`

---

### Task 5.4: MCP Tools — Balance & Transactions

**What**: `get_balance` and `get_transactions` tools.

**Deliverables**:

`packages/mcp/src/tools/balance.ts`:
- Tool name: `get_balance`
- Description: "Check your current ScuttlePay wallet balance in USDC."
- No input params
- Calls `apiClient.getBalance()` (→ `GET /api/mcp/wallet`)
- Returns: "Your ScuttlePay balance is $[amount] USDC"

`packages/mcp/src/tools/transactions.ts`:
- Tool name: `get_transactions`
- Description: "View recent purchase history including amounts, products, status, and blockchain transaction hashes."
- Input schema: `{ limit?: number }` (default 10)
- Calls `apiClient.getTransactions(limit)` (→ `GET /api/mcp/transactions?limit=...`)
- Returns formatted list: each as `"[date] — [product] — $[amount] USDC — [status] — tx: [hash]"`
- If no transactions: "No transactions yet."

Register all 5 tools in `packages/mcp/src/server.ts`.

**Verification**:
- [ ] In Claude Code: "What's my balance?" → returns balance
- [ ] "Show my recent transactions" → returns transaction list
- [ ] After a purchase: balance reflects decrease, transaction appears in history
- [ ] `pnpm typecheck` passes

**Dependencies**: Task 5.1, Task 2.3 (wallet tRPC router), Task 4.5 (transaction tRPC router)
**Files**: `packages/mcp/src/tools/balance.ts`, `packages/mcp/src/tools/transactions.ts`, update `packages/mcp/src/server.ts`

---

### Task 5.5: npm Packaging & Config

**What**: Make the MCP server installable via `npx scuttlepay`.

**Deliverables**:

Update `packages/mcp/package.json`:
- `name`: `scuttlepay` (or `@scuttlepay/mcp`)
- `bin`: `{ "scuttlepay": "./dist/index.js" }` with hashbang (already configured)
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
        "SCUTTLEPAY_API_URL": "https://scuttlepay.vercel.app",
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

**Goal**: Web UI for wallet owners to monitor their agent's spending. The dashboard IS the root Next.js app (T3) — no separate package needed.

**Note**: The T3 scaffold already provides: Next.js App Router, Tailwind v4, shadcn/ui, TanStack Query (via tRPC), root layout with TRPCReactProvider, and NextAuth integration. This epic adds the feature pages.

---

### Task 6.1: Wallet Overview Page

**What**: Main dashboard page showing balance, wallet address, recent transactions.

**Deliverables**:

`src/app/dashboard/layout.tsx`:
- Dashboard layout with sidebar nav: links to wallet overview, transactions, setup
- Protected by NextAuth session (redirect to sign-in if not authenticated)

`src/app/dashboard/page.tsx`:
- Large balance display: "$10.00 USDC" (formatted to 2 decimal places for display)
  - Uses `api.wallet.getBalance.useQuery()` with tRPC — no custom API client needed
  - `refetchInterval: 2000` for real-time polling
- Wallet address with copy-to-clipboard button
  - Uses `api.wallet.getAddress.useQuery()`
- QR code for wallet address (use `qrcode.react` or similar)
- "How to fund your wallet" collapsible section: step-by-step for sending testnet USDC
- Recent transactions: last 5, compact card format (product name, amount, status badge, time ago)
  - Uses `api.transaction.list.useQuery({ limit: 5 })` with `refetchInterval: 2000`
- Loading states: skeleton UI while data fetches (using shadcn Skeleton component)

**Verification**:
- [ ] Page renders with correct balance from tRPC
- [ ] Copy button copies wallet address to clipboard
- [ ] QR code encodes the correct wallet address
- [ ] Recent transactions show correctly
- [ ] After agent makes a purchase: balance updates within 5s, new transaction appears
- [ ] Loading skeleton shows briefly on first load
- [ ] Unauthenticated users redirected to sign-in

**Dependencies**: Epic 2-4 (tRPC procedures exist), Task 1.6 (NextAuth)
**Files**: `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx`

---

### Task 6.2: Transactions Page

**What**: Full transaction history with details.

**Deliverables**:

`src/app/dashboard/transactions/page.tsx`:
- Table (using shadcn Table component): time (relative + absolute), product name, store, amount (USDC), status badge, tx hash link
- Status badges (using shadcn Badge component): pending (yellow/amber), settling (blue), settled (green), failed (red)
- tx hash: truncated display, links to `https://sepolia.basescan.org/tx/[hash]`
- Empty state: "No transactions yet. Set up your agent to get started."
- Pagination: "Load more" button (cursor-based via `transaction.list` tRPC query)
- Auto-refresh: `refetchInterval: 2000`

**Verification**:
- [ ] Transactions table renders with correct data
- [ ] Status badges show correct colors per status
- [ ] tx hash links open correct Basescan page
- [ ] Empty state shows when no transactions
- [ ] Pagination works (create >20 transactions to test)
- [ ] New transactions appear within 5s of agent purchase

**Dependencies**: Task 6.1 (dashboard layout), Task 4.5 (transaction tRPC router)
**Files**: `src/app/dashboard/transactions/page.tsx`

---

### Task 6.3: Agent Setup Page

**What**: Instructions for connecting an agent to ScuttlePay.

**Deliverables**:

`src/app/dashboard/setup/page.tsx`:
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

**Dependencies**: Task 6.1 (dashboard layout)
**Files**: `src/app/dashboard/setup/page.tsx`

---

### Task 6.4: Landing Page

**What**: Public-facing page explaining ScuttlePay. Replaces the T3 default home page.

**Deliverables**:

Update `src/app/page.tsx`:
- Hero: "A bank account for AI agents" + subtitle explaining the value prop
- Problem → Solution section (3 steps or comparison table)
- "How it works" section: simple diagram (agent → ScuttlePay → merchant)
- CTA button: "Get started" → `/dashboard` (or sign-in flow if not authenticated)
- Simple, clean design. Not a full marketing site — just enough for demo/judges.

**Verification**:
- [ ] Page renders at `/`
- [ ] CTA navigates to `/dashboard` (or sign-in)
- [ ] Page is responsive (looks good on large screen for demo)
- [ ] No broken images or layout issues

**Dependencies**: Task 1.1 (T3 scaffold — already has page.tsx)
**Files**: `src/app/page.tsx`

---

### Epic 6 — Done Criteria

- Dashboard shows correct balance and transactions via tRPC hooks
- Real-time: agent purchases appear in dashboard within 5s (2s polling)
- Setup page has copyable MCP config
- Landing page looks presentable for demo
- NextAuth protects dashboard routes

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
- [ ] `product.search({ q: "headphones" })` tRPC query returns relevant products
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
- [ ] `wallet.getBalance` tRPC query returns ~100 USDC
- [ ] Can make multiple purchases without hitting daily limit for demo
- [ ] Backup wallet can be swapped by changing env var

**Dependencies**: Task 2.2 (wallet service)

---

### Task 7.3: E2E Test Script

**What**: Automated script that validates the entire flow. Run before every demo rehearsal.

**Deliverables**:

`scripts/e2e-test.ts`:
- Uses tRPC `createCaller` (server-side) or HTTP API client to run: search → get product → check balance → buy → verify balance decreased → verify transaction exists
- Asserts: balance before - product price = balance after (within USDC precision)
- Asserts: transaction has valid tx hash
- Asserts: tx hash exists on Base Sepolia (via Basescan API or thirdweb)
- Prints clear PASS/FAIL with details
- Can be run via `pnpm e2e`

**Verification**:
- [ ] `pnpm e2e` passes end-to-end
- [ ] Fails appropriately if API is down, wallet is unfunded, etc.
- [ ] Takes <30s to complete (Base Sepolia settlement is 2-5s)

**Dependencies**: Epics 1-4 (full tRPC API working)

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

## Epic 8: Multi-User & Onboarding (Post-Hackathon)

**Goal**: Multi-user support with proper onboarding. NextAuth is already in place (Discord OAuth + Drizzle adapter). This epic adds automatic provisioning and management UI.

---

### Task 8.1: Additional OAuth Providers

**Deliverables**:
- Add Google OAuth provider to NextAuth config (alongside Discord)
- Next.js middleware: protect `/dashboard/*` routes (redirect to sign-in)
- Ensure dual auth still works: NextAuth session for dashboard, API key for MCP

**Verification**:
- [ ] Sign up with Google → redirected to dashboard
- [ ] Sign up with Discord → redirected to dashboard
- [ ] Dashboard shows correct user's wallet
- [ ] MCP still works with API key (API key auth not broken)

**Dependencies**: Epics 1-6

---

### Task 8.2: User Onboarding Flow

**Deliverables**:
- NextAuth `events.createUser` callback: on new user → create thirdweb wallet → insert wallet row → create API key → insert spending policy
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
- Dashboard page (`src/app/dashboard/keys/page.tsx`): list API keys (name, prefix `sk_..abc`, last used, created date)
- tRPC procedures: `apiKey.list`, `apiKey.create`, `apiKey.revoke`
- Create new key: name it, see full key once, copy button
- Revoke key: confirmation dialog, soft delete (`isActive = false`)
- Multiple keys per user

**Verification**:
- [ ] Create key → appears in list
- [ ] Revoke key → MCP calls with that key return 401
- [ ] `lastUsedAt` updates when key is used

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

**Why T3 Stack (create-t3-app)?**
- Batteries-included: Next.js + tRPC + Drizzle + NextAuth in one scaffold
- End-to-end type safety with zero codegen — tRPC infers types from server to client
- Single deployment: dashboard + API in one Vercel project (no CORS, no multi-service coordination)
- Community-proven patterns for auth, DB, and API layers
- `create-t3-app` v7.40.0 gives us Tailwind v4, Next.js 15, tRPC v11 out of the box

**Why tRPC over Hono (changed from original spec)?**
- **End-to-end type safety**: Dashboard imports router types directly — no manual API client, no schema drift
- **Server Components**: tRPC's RSC support (via `createHydrationHelpers`) enables server-side data fetching with type safety
- **Single deployment**: tRPC runs inside Next.js API routes — no separate Hono server to deploy/manage
- **MCP still works**: Next.js Route Handlers at `/api/mcp/*` provide REST endpoints for the MCP server, calling the same service layer as tRPC routers
- **Less code**: No custom middleware stack, no request ID generation, no error handler — tRPC handles it
- Trade-off: Two API surfaces (tRPC for dashboard, Route Handlers for MCP). Both call the same service layer, so business logic is never duplicated.

**Why NextAuth over API-key-only auth (changed from original spec)?**
- Dashboard auth is built-in from day 1 (Discord OAuth, expandable to Google)
- Drizzle adapter means auth state lives in the same DB
- API keys still work for MCP/programmatic access (dual auth: session OR API key)
- No need for Clerk post-hackathon — NextAuth covers both hackathon and production needs
- Trade-off: Slightly more setup for hackathon, but eliminates a future migration

**Why thirdweb over custom viem?**
- Managed wallet creation + KMS support out of the box
- x402 facilitator built-in (no custom settlement code)
- Can migrate to custom implementation later if needed
- Abstracts wallet key management (critical for production security)

**Why MCP is a thin client (not a business logic host)?**
- Business logic in tRPC means the dashboard and MCP share the same behavior
- Testing doesn't require MCP transport layer
- Other future interfaces (CLI, SDK, webhooks) reuse the same tRPC API
- MCP is a transport adapter: it translates tool calls → HTTP calls to Route Handlers at `/api/mcp/*`. That's it.

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

**Why PostgreSQL (Neon) + Drizzle?**
- Relational data model (transactions, orders, wallets) with foreign keys
- ACID guarantees for financial data (no eventual consistency on money)
- Drizzle ORM: type-safe queries, schema-as-code, zero runtime overhead
- `postgres.js` driver: fast, pure JavaScript, works in serverless
- `scuttlepay_` table prefix via `pgTableCreator` — namespaces alongside NextAuth tables
- Real-time updates via polling (2s) is fine for MVP. WebSocket post-hackathon.

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
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── layout.tsx                    # Root layout (TRPCReactProvider, fonts)
│   │   ├── page.tsx                      # Landing page
│   │   ├── _components/                  # App-level components
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/
│   │   │   │   └── route.ts             # NextAuth route handler
│   │   │   ├── trpc/[trpc]/
│   │   │   │   └── route.ts             # tRPC HTTP handler (dashboard calls this)
│   │   │   └── mcp/                     # MCP-facing Route Handlers (API key auth)
│   │   │       ├── purchase/route.ts    # POST /api/mcp/purchase
│   │   │       ├── products/route.ts    # GET /api/mcp/products
│   │   │       ├── wallet/route.ts      # GET /api/mcp/wallet
│   │   │       └── transactions/route.ts # GET /api/mcp/transactions
│   │   └── dashboard/
│   │       ├── layout.tsx                # Dashboard layout (sidebar/nav, session guard)
│   │       ├── page.tsx                  # Wallet overview
│   │       ├── transactions/
│   │       │   └── page.tsx              # Transaction list
│   │       └── setup/
│   │           └── page.tsx              # MCP config instructions
│   │
│   ├── server/                           # Server-only code
│   │   ├── api/
│   │   │   ├── trpc.ts                   # tRPC context, middleware (session + API key auth)
│   │   │   ├── root.ts                   # App-level tRPC router (merges all routers)
│   │   │   └── routers/
│   │   │       ├── wallet.ts             # wallet.getBalance, wallet.getAddress
│   │   │       ├── product.ts            # product.search, product.getById
│   │   │       ├── purchase.ts           # purchase.execute
│   │   │       └── transaction.ts        # transaction.list, transaction.getById
│   │   ├── services/
│   │   │   ├── wallet.service.ts         # Balance queries, address lookup (wraps thirdweb)
│   │   │   ├── payment.service.ts        # x402 signing, settlement orchestration
│   │   │   ├── shopify.service.ts        # Storefront API queries, Admin API order creation
│   │   │   ├── spending.service.ts       # Policy evaluation, daily totals, limit checks
│   │   │   └── purchase.service.ts       # Orchestrates the full buy flow
│   │   ├── lib/
│   │   │   ├── thirdweb.ts               # thirdweb SDK client init
│   │   │   ├── shopify.ts                # Shopify API client init (Storefront + Admin)
│   │   │   ├── api-key.ts               # API key generation, hashing, verification
│   │   │   └── validate-api-key.ts      # API key validation middleware (shared by Route Handlers + tRPC)
│   │   ├── auth/
│   │   │   ├── config.ts                 # NextAuth configuration (Discord, Drizzle adapter)
│   │   │   └── index.ts                  # Cached auth(), signIn, signOut exports
│   │   └── db/
│   │       ├── schema/                   # Drizzle schema (split by domain)
│   │       │   ├── index.ts             # Barrel exports + table creator
│   │       │   ├── table-creator.ts     # pgTableCreator (scuttlepay_ prefix)
│   │       │   ├── auth.ts             # NextAuth tables
│   │       │   ├── api-key.ts          # API key table
│   │       │   ├── wallet.ts           # Wallet + spending policy tables
│   │       │   ├── transaction.ts      # Transaction + order tables
│   │       │   └── relations.ts        # All table relations
│   │       ├── index.ts                  # DB client + connection (postgres.js)
│   │       └── seed.ts                   # Seed script (demo user, wallet, API key)
│   │
│   ├── trpc/                             # tRPC client setup
│   │   ├── react.tsx                     # TRPCReactProvider (client-side)
│   │   ├── server.ts                     # RSC helpers (server-side)
│   │   └── query-client.ts              # QueryClient factory (SuperJSON, staleTime)
│   │
│   ├── components/                       # UI components
│   │   └── ui/                           # shadcn/ui (button, card, table, badge, etc.)
│   │
│   ├── lib/
│   │   └── utils.ts                      # cn() helper (clsx + tailwind-merge)
│   │
│   ├── styles/
│   │   └── globals.css                   # Tailwind v4 + theme (oklch colors)
│   │
│   └── env.js                            # @t3-oss/env-nextjs validation
│
├── packages/
│   ├── mcp/                              # MCP Server (agent-facing transport)
│   │   ├── src/
│   │   │   ├── index.ts                  # Entry point, StdioServerTransport
│   │   │   ├── server.ts                 # MCP server registration (tools)
│   │   │   ├── tools/
│   │   │   │   ├── search.ts             # search_products tool
│   │   │   │   ├── product.ts            # get_product tool
│   │   │   │   ├── buy.ts               # buy tool
│   │   │   │   ├── balance.ts            # get_balance tool
│   │   │   │   └── transactions.ts       # get_transactions tool
│   │   │   ├── api-client.ts             # HTTP client for Route Handlers (/api/mcp/*)
│   │   │   └── config.ts                 # Env var parsing (API URL, key)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                           # Shared types, schemas, constants
│       ├── src/
│       │   ├── index.ts                  # Barrel exports
│       │   ├── types.ts                  # Domain types (User, Wallet, Transaction, etc.)
│       │   ├── enums.ts                  # TransactionType, TransactionStatus, OrderStatus
│       │   ├── schemas.ts               # Zod schemas (API request/response validation)
│       │   ├── errors.ts                # ScuttlePayError class, error codes, formatters
│       │   └── constants.ts              # Chain IDs, USDC addresses, facilitator URLs
│       ├── package.json
│       └── tsconfig.json
│
├── drizzle.config.ts                     # Drizzle Kit config (tablesFilter: scuttlepay_*)
├── components.json                       # shadcn/ui config
├── eslint.config.js                      # ESLint flat config (TypeScript + Drizzle rules)
├── next.config.js                        # Next.js config (imports env.js)
├── postcss.config.js                     # PostCSS with @tailwindcss/postcss
├── prettier.config.js                    # Prettier with tailwindcss plugin
├── tsconfig.json                         # TypeScript strict (path alias ~/* → ./src/*)
├── pnpm-workspace.yaml                   # Workspace: packages/*
├── package.json                          # Root: scripts, dependencies, ct3aMetadata
├── .env.example                          # All env vars documented
└── .gitignore
```

---

## Testing Strategy

### Hackathon (minimum viable testing)
- **Integration tests for payment flow**: Sign → settle → verify. Runs against Base Sepolia testnet.
- **E2E test script**: The demo rehearsal script IS the E2E test. search → buy → verify balance → verify transaction. Uses tRPC `createCaller` for server-side testing or HTTP calls for full-stack.
- **Type safety**: `pnpm typecheck` — zero `as any`. tRPC enforces type safety across client/server boundary.
- **tRPC procedure testing**: Use `createCaller` to test routers without HTTP layer.

### Post-Hackathon (production testing)
- **Unit tests**: Service layer (spending policy evaluation, price parsing, error handling)
- **Integration tests**: tRPC routers with test DB (Neon branch per test suite) using `createCaller`
- **MCP tests**: Tool registration, param validation, error message formatting
- **Contract tests**: Verify x402 signing against facilitator `/verify` (catches EIP-712 regressions)

---

## Configuration & Environment

All env vars are validated at startup via `@t3-oss/env-nextjs` in `src/env.js`. Missing required vars cause immediate failure with clear error messages. Set `SKIP_ENV_VALIDATION=1` for Docker builds.

```env
# Database (PostgreSQL via Neon or Vercel Postgres)
DATABASE_URL=postgresql://...@ep-xxx.us-east-2.aws.neon.tech/scuttlepay

# NextAuth
AUTH_SECRET=...               # Required in production (openssl rand -base64 32)
AUTH_DISCORD_ID=...           # Discord OAuth app client ID
AUTH_DISCORD_SECRET=...       # Discord OAuth app client secret

# thirdweb
THIRDWEB_SECRET_KEY=...       # Added in Task 2.0
THIRDWEB_CLIENT_ID=...        # Added in Task 2.0
THIRDWEB_WALLET_ID=...        # Pre-created server wallet ID (in env.js now)
THIRDWEB_WALLET_ADDRESS=...   # Server wallet on-chain address (in env.js now)

# Shopify
SHOPIFY_STORE_URL=https://your-store.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=...  # Public storefront access token
SHOPIFY_ADMIN_TOKEN=...       # Admin API access token

# Chain
CHAIN_ENV=testnet             # testnet | mainnet

# Spending defaults (used by seed script)
DEFAULT_MAX_PER_TX=10
DEFAULT_DAILY_LIMIT=50
```

**MCP Server env** (separate from Next.js app, set in MCP config):
```env
SCUTTLEPAY_API_URL=http://localhost:3000  # Next.js app URL (Route Handlers at /api/mcp/*)
SCUTTLEPAY_API_KEY=sk_test_...            # API key from seed script
```

---

## Verification Plan

| What | How to verify |
|------|--------------|
| App builds | `pnpm build` — zero errors (Next.js + shared + mcp packages) |
| Type safety | `pnpm typecheck` — zero errors, zero `as any` |
| Lint | `pnpm lint` — zero warnings |
| DB schema | `pnpm db:push` — applies cleanly. `pnpm db:seed` creates test data. |
| Wallet created | `wallet.getBalance` tRPC query returns USDC balance from Base Sepolia |
| Session auth | Discord login → dashboard renders with user context |
| API key auth | Valid API key in header → tRPC procedure succeeds. No/invalid key → `UNAUTHORIZED`. |
| Product search | `product.search({ q: "shoes" })` → Shopify products returned |
| Purchase flow | `purchase.execute({ productId })` → tx settles on Base Sepolia → tx hash on Basescan |
| Spending limits | Buy above max_per_tx → `SPENDING_LIMIT_EXCEEDED` error |
| MCP works | Claude Code: "search for products" → products returned via MCP (calls `/api/mcp/products`) |
| MCP buy | Claude Code: "buy the [product]" → purchase completes via MCP (calls `/api/mcp/purchase`), balance decreases |
| Dashboard realtime | Agent buys → transaction appears in dashboard within 5s (2s polling) |
| E2E demo | 3-minute script runs cleanly 3 times in a row |
