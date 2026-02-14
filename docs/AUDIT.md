# ScuttlePay Codebase Audit Report

Consolidated findings from 4 parallel audits: Architecture, Next.js/React, Type Safety, Backend/Security.

---

## CRITICAL (Must Fix)

### 1. Purchase flow lacks database transaction — race condition risk
**Source**: Backend C1
**Files**: `src/server/services/purchase.service.ts:73-229`

The `purchase()` function performs 9 sequential steps (balance check, spending eval, insert pending tx, sign+settle payment, update tx status, create Shopify order, insert order row) with NO wrapping database transaction. If the process crashes between payment settlement and DB update, the transaction row stays PENDING while money has left the wallet. No reconciliation mechanism exists.

### 2. Spending policy enforcement is bypassable via race condition
**Source**: Backend C2
**Files**: `src/server/services/spending.service.ts:84-128`, `src/server/services/purchase.service.ts:95-108`

`evaluate()` reads the daily spend total, then the purchase proceeds. No lock or serializable isolation. Two concurrent requests can both read the same `dailySpent` value, both pass the check, and both proceed — exceeding the daily limit. This is a financial control bypass.

### 3. MCP REST routes are stubs — search and purchase broken
**Source**: Backend C5, Arch C2
**Files**: `src/app/api/mcp/products/route.ts:19`, `src/app/api/mcp/purchase/route.ts:18-22`

- Products route returns hardcoded `{ data: [] }` — never calls Shopify service
- Purchase route returns 501 "not yet connected"
- The MCP npm package (`packages/mcp/`) calls these routes — it is non-functional for search and purchase
- Meanwhile, tRPC routes for the same operations are fully implemented

### 4. Dual chain config — client and server can target different chains
**Source**: Arch C1
**Files**: `src/lib/chain-config.ts:6-8`, `src/server/lib/thirdweb.ts:5`

- Client uses `NEXT_PUBLIC_CHAIN_ID` (numeric) to determine chain
- Server uses `CHAIN_ENV` (string "mainnet"/"testnet") independently
- If these diverge, the UI shows one chain while payments process on another

### 5. All dashboard pages are client components — unused RSC infrastructure
**Source**: Nextjs C1, Arch #9
**Files**: `src/app/dashboard/page.tsx:1`, `src/app/dashboard/transactions/page.tsx:1`, `src/app/dashboard/agents/page.tsx:1`

Every dashboard page is `"use client"`, shipping all code to the browser. The tRPC RSC integration (`src/trpc/server.ts` with `HydrateClient`) is set up but never used. This is the single biggest perf win available.

### 6. No error boundaries anywhere
**Source**: Nextjs C3
**Missing**: `global-error.tsx`, `not-found.tsx`, `dashboard/error.tsx`, `dashboard/loading.tsx`

Unhandled errors show the default Next.js error page in production.

### 7. JWT cookie missing security attributes
**Source**: Backend R11
**File**: `src/server/auth/actions.ts:54`

`c.set("jwt", jwt)` — no `HttpOnly`, `Secure`, or `SameSite` flags. Any XSS can exfiltrate the JWT via `document.cookie`.

### 8. Aggressive polling — 3 queries every 2 seconds
**Source**: Nextjs C2
**Files**: `src/app/dashboard/page.tsx:60,179`, `src/app/dashboard/transactions/page.tsx:152`

Three separate `refetchInterval: 2000` queries run simultaneously on the dashboard. Excessive for a payments dashboard where transactions are infrequent.

---

## RECOMMENDED (Should Fix)

### 9. Dual API surface with divergent implementations
**Source**: Arch C3, Backend R12-R14
**Files**: `src/server/api/routers/` vs `src/app/api/mcp/`

tRPC routes go through the services layer with proper error handling. MCP REST routes bypass services entirely (raw DB queries, no agent name joins, inconsistent error shapes). Same business logic in two places with different behavior.

**Fix**: MCP routes should call into the same service layer as tRPC routes.

### 10. Agent creation/revocation lack database transactions
**Source**: Backend R2, R4
**Files**: `src/server/api/routers/agent.ts:64-111,162-196`

- `create`: inserts API key then spending policy as separate ops — orphaned key if policy insert fails
- `revoke`: two separate UPDATEs for key and policy — partial deactivation possible

### 11. Floating-point money math
**Source**: Backend R9
**Files**: `src/server/services/purchase.service.ts:69-70,86`

`Number()` conversion for USDC multiplication introduces IEEE 754 imprecision. The codebase already has `parseUsdc()` with BigInt in `payment.service.ts` — use it consistently.

### 12. Missing database index on `keyHash`
**Source**: Backend R10
**File**: `src/server/db/schema/api-key.ts`

Every MCP API call looks up by `keyHash`, but there's no index on it — sequential scan on every request.

### 13. Duplicated utility code across pages
**Source**: Nextjs R2, Arch #6
**Files**: Multiple dashboard pages

| Utility | Duplicated In |
|---------|--------------|
| `formatTimeAgo()` | `dashboard/page.tsx`, `transactions/page.tsx` |
| `useCopy()` hook | `agents/page.tsx`, `setup/page.tsx` |
| `maskKey()` | `agents/page.tsx`, `setup/page.tsx` |
| `statusVariant` map | `dashboard/page.tsx`, `transactions/page.tsx` |
| `requireWalletId()` | `transaction.ts` router, `wallet.ts` router |
| `mapServiceError()` | `product.ts`, `purchase.ts`, `wallet.ts` routers |

### 14. MCP TransactionRow type diverges from server schema
**Source**: Type C4
**File**: `packages/mcp/src/api-client.ts:28-44`

`merchantAddress`, `productId`, `productName`, `storeUrl` are non-nullable in MCP client but nullable in server schema. Missing `agentName` field entirely.

### 15. `authedProcedure` widens non-nullable API key context
**Source**: Type C3
**File**: `src/server/api/trpc.ts:91-103`

API key validation returns `walletId: string` and `apiKeyId: string` (guaranteed non-null), but the context casts them to `string | null`, forcing unnecessary null checks downstream.

### 16. Hardcoded Sepolia block explorer URL
**Source**: Nextjs R7, Arch #14
**File**: `src/app/dashboard/transactions/page.tsx:114`

`https://sepolia.basescan.org/tx/` is hardcoded. Will link to wrong explorer on mainnet.

### 17. Shopify storefront API has no timeout
**Source**: Backend R7
**File**: `src/server/lib/shopify.ts:32-39`

`fetch()` without `AbortSignal.timeout()`. Admin API correctly uses 15s timeout — storefront API doesn't.

### 18. In-memory cache has no size bound or eviction
**Source**: Backend R8, Arch #15
**File**: `src/server/services/shopify.service.ts:21`

`Map` grows unbounded. Stale entries are never removed (only checked on read). Memory leak in long-running deployments.

### 19. ThirdwebProvider wraps entire app unnecessarily
**Source**: Nextjs R5
**File**: `src/app/providers.tsx`

Only used by login page and dashboard `AddFundsCard`. Wrapping the root layout ships the thirdweb bundle to the landing page too.

### 20. Dead exports and unused code
**Source**: Arch #4-5, Backend C3
**Files**: Multiple

| Dead Code | Location |
|-----------|----------|
| `API_ROUTES` constant | `packages/shared/src/constants.ts:21-28` |
| `FACILITATOR_URLS` constant | `packages/shared/src/constants.ts:9-12` |
| DB row types (`User`, `Wallet`, etc.) | `packages/shared/src/types.ts:18-102` |
| `verifyPayment()` (also broken) | `src/server/services/payment.service.ts:267-295` |
| `getWallet()` | `src/server/services/wallet.service.ts:71-73` |
| `getWalletByUserId()` | `src/server/services/wallet.service.ts:75-91` |
| `verifyApiKey()` | `src/server/lib/api-key.ts:26-32` |
| `baseSepoliaChain` re-export | `src/server/lib/thirdweb.ts:7` |
| `HydrateClient` export | `src/trpc/server.ts:23` |
| `RouterInputs` export | `src/trpc/react.tsx:24` |
| `qrcode.react` npm dep | `package.json` |
| `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` | `src/env.js:19` |

### 21. Non-null assertions on leftJoin results
**Source**: Type C2
**File**: `src/server/api/routers/agent.ts:59`

`r.maxPerTx!` and `r.dailyLimit!` after a `leftJoin` — drizzle types these as nullable. Runtime crash unlikely due to DB NOT NULL constraint, but types are lying.

### 22. Repeated `as keyof typeof` casts for chain lookups
**Source**: Type R3
**Files**: `payment.service.ts:58,69`, `wallet.service.ts:16`, `wallet.ts:32`

`activeChain.id as keyof typeof USDC_ADDRESSES` repeated 4 times. Create a typed helper that narrows the chain ID.

### 23. `SpendingEvaluation` should be a discriminated union
**Source**: Type R7
**File**: `src/server/services/spending.service.ts:17-19`

Currently `{ allowed: boolean; denial?: SpendingDenial }`. Should be `{ allowed: true } | { allowed: false; denial: SpendingDenial }` to eliminate optional chaining when `allowed === false`.

### 24. External API responses cast without validation
**Source**: Type R5
**Files**: `payment.service.ts:148`, `shopify.ts:47,132`, `mcp/api-client.ts:139,158`

All external API responses use `as T` casts without runtime validation. Most common source of runtime type errors in TypeScript.

### 25. `Record<string, string>` too loose for policy updates
**Source**: Type R4
**File**: `src/server/api/routers/agent.ts:144`

Should be `Partial<Pick<typeof spendingPolicies.$inferInsert, 'maxPerTx' | 'dailyLimit'>>`.

### 26. No Next.js middleware for auth protection
**Source**: Nextjs R1

Auth checked in dashboard layout via DB query. A middleware would protect routes before any rendering.

### 27. `staleTime: 30s` conflicts with `refetchInterval: 2s`
**Source**: Nextjs R6
**Files**: `src/trpc/query-client.ts:13`, dashboard pages

Contradictory caching strategy. The staleTime is meaningless when refetchInterval overrides it.

### 28. Metadata is minimal — missing SEO essentials
**Source**: Nextjs R3
**File**: `src/app/layout.tsx:8-12`

Missing: `title.template`, `metadataBase`, `openGraph`, `robots.ts`, `sitemap.ts`.

---

## MINOR (Nice to Have)

### 29. Timing middleware logs to console unconditionally
**File**: `src/server/api/trpc.ts:53` — `console.log` runs in production. Gate behind `isDev`.

### 30. Setup page duplicates agents page
`src/app/dashboard/setup/page.tsx` is a simplified agent creation flow that overlaps with `agents/page.tsx`.

### 31. `env.js` should be `env.ts`
Uses TypeScript patterns but has `.js` extension.

### 32. Hydration mismatch risk in setup page
`src/app/dashboard/setup/page.tsx:153-156` — `typeof window !== "undefined"` in render path.

### 33. `transactionDetailOutputSchema` uses `z.string()` instead of `z.nativeEnum(OrderStatus)` for `order.status`
**File**: `src/server/api/routers/transaction.ts:56`

### 34. No `Suspense` boundaries
No streaming or progressive rendering. Relevant after RSC refactor.

### 35. `Transaction` type alias duplicated
`src/app/dashboard/page.tsx:27` and `transactions/page.tsx:19` both define the same type alias.

### 36. No named export for serialized transaction type
`transactionSchema` inferred type is never exported as a named type from shared package.

### 37. `as const` repetition in MCP tools
All `packages/mcp/src/tools/*.ts` repeat `type: "text" as const`. Extract to a helper.

### 38. Missing explicit return types on several exported functions
See Type R1 for full list.

### 39. Duplicate CSS directives in `globals.css`
`src/styles/globals.css:124-130` — copy-paste of `@apply` rules.

### 40. Seed script logs raw API key
`src/server/db/seed.ts:78` — acceptable for local dev, risk in CI with log collection.

### 41. `apiKey.expiresAt` defined but never set
Schema column exists, validation code handles it, but agent creation never sets it. Dead feature.

---

## Priority Action Plan

| Priority | Items | Theme |
|----------|-------|-------|
| **P0 — Security** | #2, #7 | Spending bypass, JWT cookie |
| **P1 — Data Integrity** | #1, #10, #11, #12 | Purchase atomicity, agent ops, money math, index |
| **P2 — Functionality** | #3, #9, #14 | MCP routes broken, dual API surface |
| **P3 — Architecture** | #4, #5, #13, #20 | Chain config, RSC, dedup, dead code |
| **P4 — Performance** | #8, #17, #18, #19, #27 | Polling, timeouts, cache, bundle |
| **P5 — Type Safety** | #15, #21-25 | Context widening, casts, unions |
| **P6 — Polish** | #6, #16, #26, #28-41 | Error boundaries, metadata, minor |
