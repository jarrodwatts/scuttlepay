# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is ScuttlePay

Wallet-as-a-service for autonomous AI agents. Agents get API keys with spending policies, execute USDC purchases against Shopify storefronts, and settle payments on-chain via the x402 protocol (EIP-712/EIP-3009 `TransferWithAuthorization`).

## Commands

```bash
pnpm dev              # Next.js dev server (Turbopack)
pnpm build            # Production build
pnpm check            # Lint + typecheck in one shot
pnpm lint             # ESLint only
pnpm typecheck        # tsc --noEmit only
pnpm format:check     # Prettier check
pnpm format:write     # Prettier fix

# Database (Drizzle + PostgreSQL)
pnpm db:generate      # Generate migration from schema changes
pnpm db:migrate       # Run pending migrations
pnpm db:push          # Push schema directly (dev only)
pnpm db:seed          # Seed database (reads .env.local)
pnpm db:studio        # Drizzle Studio GUI

# E2E
pnpm e2e              # Run e2e tests (reads .env)
```

## Architecture

**Monorepo** (pnpm workspaces): root Next.js app + `packages/shared` + `packages/mcp`.

### Stack

- Next.js 15 (App Router) + React 19, Tailwind 4, shadcn/ui (Radix)
- tRPC 11 + TanStack Query 5 for data fetching
- Drizzle ORM + PostgreSQL (Vercel Postgres / Neon)
- thirdweb SDK v5 for wallet management and auth (JWT from wallet signatures)
- Zod for all input validation (shared schemas in `packages/shared`)

### Path alias

`~/*` → `./src/*`

### Layered backend

```
src/server/api/routers/   → tRPC routers (thin: validate input, call service, map errors)
src/server/services/      → Domain logic (purchase flow, spending evaluation, payment signing)
src/server/lib/           → Infrastructure (thirdweb client, Shopify GraphQL, API key validation, USDC math)
src/server/db/schema/     → Drizzle table definitions (all prefixed scuttlepay_*)
src/server/auth/          → thirdweb Auth setup + cached user resolution
```

### tRPC procedure types

- `publicProcedure` — no auth
- `protectedProcedure` — requires JWT (thirdweb wallet auth)
- `authedProcedure` — JWT **or** API key (`Authorization: Bearer sk_*`); context includes `userId`, `walletId`, `apiKeyId`

### Router shape

`AppRouter` at `src/server/api/root.ts`: `health`, `agent`, `product`, `purchase`, `transaction`, `wallet`.

### Purchase flow (the core business logic)

`src/server/services/purchase.service.ts`:
1. Fetch product from Shopify Storefront API
2. Validate price (base or variant)
3. Serializable DB transaction: check balance → evaluate spending limits → create pending tx
4. Sign EIP-712 `TransferWithAuthorization` → send to x402 facilitator → get tx hash
5. Update tx to settled, create Shopify order (non-fatal)

### Shared package (`@scuttlepay/shared`)

Enums (`TransactionType`, `TransactionStatus`, `OrderStatus`), Zod schemas, `ScuttlePayError` class with HTTP status mapping, USDC constants and chain config.

### MCP package (`@scuttlepay/mcp`)

stdio-based MCP server for AI agents. Tools: `search-products`, `get-product`, `buy`, `get-balance`, `get-transactions`. Connects to remote ScuttlePay API via HTTP.

### Key patterns

- USDC amounts stored as `numeric(20, 6)` in DB; use `src/server/lib/usdc-math.ts` for decimal math — never floating point
- Spending policy evaluation is per-transaction and daily (UTC window), checked inside a serializable transaction
- API key hashes stored (never plaintext); `lastUsedAt` updated fire-and-forget
- `React.cache()` deduplicates auth user resolution per request
- DB connection uses singleton pattern with HMR guard in dev
- All DB tables prefixed `scuttlepay_*` (enforced by drizzle config filter)

### Chain support

Base Mainnet and Base Sepolia (testnet). Controlled by `NEXT_PUBLIC_CHAIN_ENV`.

## Conventions

- Strict TypeScript — no `any`, `@ts-ignore`, or `@ts-expect-error`
- ESLint flat config with typescript-eslint strict rules + drizzle plugin (enforces WHERE on DELETE/UPDATE)
- Prettier with tailwindcss plugin for class sorting
- Service layer throws `ScuttlePayError`; routers map to tRPC errors
- Environment validated at startup via `@t3-oss/env-nextjs` in `src/env.js`
