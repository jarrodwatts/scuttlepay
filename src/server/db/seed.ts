import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, apiKeys, wallets, spendingPolicies } from "./schema/index";
import { generateApiKey } from "../lib/api-key";
import { env } from "~/env";
import { BASE_MAINNET, BASE_SEPOLIA } from "@scuttlepay/shared";
import { getServerWalletAddress } from "../lib/thirdweb";

const DEMO_EMAIL = "demo@scuttlepay.com";

type Db = typeof db;

async function ensureUser(database: Db) {
  const existing = await database
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  if (existing[0]) {
    console.log(`User exists: ${existing[0].id}`);
    return existing[0];
  }

  const [user] = await database
    .insert(users)
    .values({ name: "Demo User", email: DEMO_EMAIL })
    .returning();

  if (!user) throw new Error("Failed to create user");
  console.log(`Created user: ${user.id}`);
  return user;
}

async function ensureApiKey(database: Db, userId: string) {
  const existing = await database
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .limit(1);

  if (existing[0]) {
    console.log(`API key exists: ${existing[0].keyPrefix}...`);
    return;
  }

  const { raw, hash, prefix } = generateApiKey();

  const [key] = await database
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

async function resolveWalletAddress(): Promise<string> {
  if (env.THIRDWEB_WALLET_ADDRESS) {
    return env.THIRDWEB_WALLET_ADDRESS;
  }

  if (env.THIRDWEB_SECRET_KEY && env.THIRDWEB_WALLET_ID) {
    console.log("Fetching wallet address from thirdweb...");
    return getServerWalletAddress();
  }

  return "0x_placeholder_update_later";
}

async function ensureWallet(database: Db, userId: string) {
  const existing = await database
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);

  if (existing[0]) {
    console.log(`Wallet exists: ${existing[0].id} (${existing[0].address})`);
    return existing[0];
  }

  const address = await resolveWalletAddress();
  const thirdwebId = env.THIRDWEB_WALLET_ID ?? "placeholder";
  const chainId = env.CHAIN_ENV === "mainnet" ? BASE_MAINNET : BASE_SEPOLIA;

  const [wallet] = await database
    .insert(wallets)
    .values({ userId, address, chainId, label: "default", thirdwebId })
    .returning();

  if (!wallet) throw new Error("Failed to create wallet");
  console.log(`Created wallet: ${wallet.id} (${address})`);
  return wallet;
}

async function ensureSpendingPolicy(database: Db, walletId: string) {
  const existing = await database
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

  const maxPerTx = env.DEFAULT_MAX_PER_TX;
  const dailyLimit = env.DEFAULT_DAILY_LIMIT;

  const [policy] = await database
    .insert(spendingPolicies)
    .values({ walletId, maxPerTx, dailyLimit })
    .returning();

  if (!policy) throw new Error("Failed to create spending policy");
  console.log(
    `Created spending policy: max $${maxPerTx}/tx, $${dailyLimit}/day`,
  );
}

async function seed() {
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
