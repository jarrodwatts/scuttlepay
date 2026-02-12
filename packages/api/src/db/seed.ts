import "dotenv/config";
import { eq } from "drizzle-orm";
import { createDb } from "./index.js";
import { users, apiKeys, wallets, spendingPolicies } from "./schema.js";
import { generateApiKey } from "../lib/api-key.js";

const DEMO_EMAIL = "demo@scuttlepay.com";

async function ensureUser(db: ReturnType<typeof createDb>) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  if (existing[0]) {
    console.log(`User exists: ${existing[0].id}`);
    return existing[0];
  }

  const [user] = await db
    .insert(users)
    .values({ name: "Demo User", email: DEMO_EMAIL })
    .returning();

  if (!user) throw new Error("Failed to create user");
  console.log(`Created user: ${user.id}`);
  return user;
}

async function ensureApiKey(
  db: ReturnType<typeof createDb>,
  userId: string,
) {
  const existing = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .limit(1);

  if (existing[0]) {
    console.log(`API key exists: ${existing[0].keyPrefix}...`);
    return;
  }

  const { raw, hash, prefix } = generateApiKey();

  const [key] = await db
    .insert(apiKeys)
    .values({
      userId,
      keyHash: hash,
      keyPrefix: prefix,
      name: "demo-agent",
    })
    .returning();

  if (!key) throw new Error("Failed to create API key");
  console.log(`Created API key: ${key.id}`);
  console.log(`\n  API Key (save this — shown once): ${raw}\n`);
}

async function ensureWallet(
  db: ReturnType<typeof createDb>,
  userId: string,
) {
  const existing = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);

  if (existing[0]) {
    console.log(`Wallet exists: ${existing[0].id} (${existing[0].address})`);
    return existing[0];
  }

  const address =
    process.env["THIRDWEB_WALLET_ADDRESS"] ?? "0x_placeholder_update_later";
  const thirdwebId = process.env["THIRDWEB_WALLET_ID"] ?? "placeholder";
  const chainId = process.env["CHAIN_ENV"] === "mainnet" ? 8453 : 84532;

  const [wallet] = await db
    .insert(wallets)
    .values({ userId, address, chainId, label: "default", thirdwebId })
    .returning();

  if (!wallet) throw new Error("Failed to create wallet");
  console.log(`Created wallet: ${wallet.id} (${address})`);
  return wallet;
}

async function ensureSpendingPolicy(
  db: ReturnType<typeof createDb>,
  walletId: string,
) {
  const existing = await db
    .select()
    .from(spendingPolicies)
    .where(eq(spendingPolicies.walletId, walletId))
    .limit(1);

  if (existing[0]) {
    console.log(
      `Spending policy exists: max $${existing[0].maxPerTx}/tx, $${existing[0].dailyLimit}/day`,
    );
    return;
  }

  const maxPerTx = process.env["DEFAULT_MAX_PER_TX"] ?? "10";
  const dailyLimit = process.env["DEFAULT_DAILY_LIMIT"] ?? "50";

  const [policy] = await db
    .insert(spendingPolicies)
    .values({ walletId, maxPerTx, dailyLimit })
    .returning();

  if (!policy) throw new Error("Failed to create spending policy");
  console.log(`Created spending policy: max $${maxPerTx}/tx, $${dailyLimit}/day`);
}

async function seed() {
  const db = createDb();

  const user = await ensureUser(db);
  await ensureApiKey(db, user.id);
  const wallet = await ensureWallet(db, user.id);
  await ensureSpendingPolicy(db, wallet.id);

  console.log("\nSeed complete.");
}

seed().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
