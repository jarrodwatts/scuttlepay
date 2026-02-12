import superjson, { type SuperJSONResult } from "superjson";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API_KEY = process.env.E2E_API_KEY ?? "";
const TRPC_URL = `${BASE_URL}/api/trpc`;

const BASESCAN_API =
  process.env.CHAIN_ENV === "mainnet"
    ? "https://api.basescan.org/api"
    : "https://api-sepolia.basescan.org/api";

interface StepResult {
  name: string;
  passed: boolean;
  detail: string;
  durationMs: number;
}

const results: StepResult[] = [];

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function trpc<T>(
  path: string,
  input?: Record<string, unknown>,
  method: "GET" | "POST" = "GET",
): Promise<T> {
  let url: string;
  let init: RequestInit;

  if (method === "GET") {
    const encoded = input
      ? `?input=${encodeURIComponent(superjson.stringify(input))}`
      : "";
    url = `${TRPC_URL}/${path}${encoded}`;
    init = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    };
  } else {
    url = `${TRPC_URL}/${path}`;
    init = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: superjson.stringify(input ?? {}),
    };
  }

  const res = await fetch(url, init);

  const body = (await res.json()) as {
    result?: { data: SuperJSONResult };
    error?: { message: string };
  };

  if (!res.ok || body.error) {
    const msg = body.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`tRPC ${path} failed: ${msg}`);
  }

  if (!body.result?.data) {
    throw new Error(`tRPC ${path}: unexpected response shape`);
  }

  return superjson.deserialize<T>(body.result.data);
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    results.push({
      name,
      passed: true,
      detail: "OK",
      durationMs: Date.now() - start,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({
      name,
      passed: false,
      detail: message,
      durationMs: Date.now() - start,
    });
    throw err;
  }
}

async function verifyTxOnChain(txHash: string): Promise<boolean> {
  const url = `${BASESCAN_API}?module=transaction&action=gettxreceiptstatus&txhash=${txHash}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    status: string;
    result: { status: string };
  };

  return json.status === "1" && json.result.status === "1";
}

interface SearchResult {
  id: string;
  title: string;
  priceUsdc: string;
}

interface ProductDetail {
  id: string;
  title: string;
  priceUsdc: string;
  variants: Array<{ id: string; title: string; priceUsdc: string }>;
}

interface WalletBalance {
  balance: string;
  currency: string;
  chain: string;
}

interface PurchaseResult {
  transactionId: string;
  txHash: string;
  orderId: string | null;
  orderNumber: string | null;
  product: { id: string; name: string; variantId: string | null };
  amount: string;
  status: string;
}

interface TransactionList {
  items: Array<{
    id: string;
    txHash: string | null;
    amountUsdc: string;
    status: string;
  }>;
  nextCursor: string | null;
}

async function run() {
  console.log("\n=== ScuttlePay E2E Test ===\n");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Chain:  ${process.env.CHAIN_ENV ?? "testnet"}\n`);

  if (!API_KEY) {
    console.error("E2E_API_KEY is required. Set it in .env or pass via environment.");
    process.exit(1);
  }

  // 1. Search products
  const products = await step("Search products", async () => {
    const res = await trpc<SearchResult[]>("product.search", { q: "gift", limit: 5 });
    assert(res.length > 0, "No products found");
    console.log(`  Found ${res.length} products`);
    return res;
  });

  const firstProduct = products[0]!;
  console.log(`  Using: "${firstProduct.title}" ($${firstProduct.priceUsdc})\n`);

  // 2. Get product detail
  const product = await step("Get product detail", async () => {
    const res = await trpc<ProductDetail>("product.getById", {
      productId: firstProduct.id,
    });
    assert(res.id === firstProduct.id, "Product ID mismatch");
    console.log(`  Variants: ${res.variants.length}`);
    return res;
  });

  // 3. Check balance (before purchase)
  const balanceBefore = await step("Check balance (before)", async () => {
    const res = await trpc<WalletBalance>("wallet.getBalance");
    assert(res.currency === "USDC", `Expected USDC, got ${res.currency}`);
    console.log(`  Balance: $${res.balance} ${res.currency} on ${res.chain}`);
    return res;
  });

  const balanceBeforeNum = parseFloat(balanceBefore.balance);
  const priceNum = parseFloat(product.priceUsdc);

  assert(
    balanceBeforeNum >= priceNum,
    `Insufficient balance: $${balanceBefore.balance} < $${product.priceUsdc}`,
  );

  // 4. Execute purchase
  const purchaseResult = await step("Execute purchase", async () => {
    const res = await trpc<PurchaseResult>(
      "purchase.execute",
      { productId: product.id, quantity: 1 },
      "POST",
    );
    assert(res.txHash.length > 0, "Missing tx hash");
    assert(res.transactionId.length > 0, "Missing transaction ID");
    console.log(`  TX Hash:  ${res.txHash}`);
    console.log(`  Amount:   $${res.amount}`);
    console.log(`  Status:   ${res.status}`);
    return res;
  });

  // 5. Verify balance decreased correctly
  await step("Verify balance decreased", async () => {
    const res = await trpc<WalletBalance>("wallet.getBalance");
    const balanceAfterNum = parseFloat(res.balance);
    const expected = balanceBeforeNum - priceNum;

    const diff = Math.abs(balanceAfterNum - expected);
    const tolerance = 0.000001; // 1 wei of USDC (6 decimals)

    console.log(`  Before:   $${balanceBefore.balance}`);
    console.log(`  After:    $${res.balance}`);
    console.log(`  Price:    $${product.priceUsdc}`);
    console.log(`  Expected: $${expected.toFixed(6)}`);

    assert(
      diff <= tolerance,
      `Balance mismatch: expected $${expected.toFixed(6)}, got $${res.balance} (diff: $${diff.toFixed(6)})`,
    );
  });

  // 6. Verify transaction exists
  await step("Verify transaction exists", async () => {
    const res = await trpc<TransactionList>("transaction.list", { limit: 5 });
    const tx = res.items.find((t) => t.id === purchaseResult.transactionId);
    assert(tx !== undefined, `Transaction ${purchaseResult.transactionId} not found`);
    assert(tx.txHash === purchaseResult.txHash, "TX hash mismatch in transaction record");
    console.log(`  Transaction ${tx.id} found with status: ${tx.status}`);
  });

  // 7. Verify tx on Base Sepolia via Basescan
  await step("Verify tx on-chain (Basescan)", async () => {
    const confirmed = await verifyTxOnChain(purchaseResult.txHash);
    if (confirmed) {
      console.log(`  TX confirmed on-chain`);
    } else {
      console.log(`  TX not yet confirmed (may still be settling)`);
      console.log(`  Check: https://sepolia.basescan.org/tx/${purchaseResult.txHash}`);
    }
    assert(
      confirmed,
      `TX ${purchaseResult.txHash} not confirmed on-chain`,
    );
  });
}

function printResults(abortError?: unknown) {
  console.log("\n=== Results ===\n");
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  for (const r of results) {
    const icon = r.passed ? "PASS" : "FAIL";
    console.log(`  [${icon}] ${r.name} (${r.durationMs}ms)`);
    if (!r.passed) console.log(`         ${r.detail}`);
  }
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n  ${passed}/${results.length} passed in ${totalMs}ms`);
  if (abortError) {
    console.log(`\n  Aborted: ${abortError instanceof Error ? abortError.message : String(abortError)}\n`);
  } else {
    console.log();
  }
  if (passed < results.length) process.exit(1);
}

run()
  .then(() => printResults())
  .catch((err: unknown) => {
    printResults(err);
    process.exit(1);
  });
