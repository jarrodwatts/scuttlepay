import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, apiKeys, wallets, spendingPolicies } from "./schema/index";
import { generateApiKey } from "../lib/api-key";
import { env } from "~/env";
import { BASE_MAINNET, BASE_SEPOLIA } from "@scuttlepay/shared";
import { getServerWalletAddress } from "../lib/thirdweb";

const DEMO_THIRDWEB_ID = "0xDEMO0000000000000000000000000000000SEED";

type Db = typeof db;

async function ensureUser(database: Db) {
  const existing = await database
    .select()
    .from(users)
    .where(eq(users.thirdwebUserId, DEMO_THIRDWEB_ID))
    .limit(1);

  if (existing[0]) {
    console.log(`User exists: ${existing[0].id}`);
    return existing[0];
  }

  const [user] = await database
    .insert(users)
    .values({
      thirdwebUserId: DEMO_THIRDWEB_ID,
      name: "Demo User",
      email: "demo@scuttlepay.com",
    })
    .returning();

  if (!user) throw new Error("Failed to create user");
  console.log(`Created user: ${user.id}`);
  return user;
}

async function ensureAgent(database: Db, userId: string, walletId: string) {
  const existing = await database
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .limit(1);

  if (existing[0]) {
    console.log(`Agent exists: ${existing[0].keyPrefix}...`);
    return existing[0].id;
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

  if (!key) throw new Error("Failed to create agent");

  const maxPerTx = env.DEFAULT_MAX_PER_TX;
  const dailyLimit = env.DEFAULT_DAILY_LIMIT;

  await database.insert(spendingPolicies).values({
    walletId,
    apiKeyId: key.id,
    name: "demo-agent",
    maxPerTx,
    dailyLimit,
  });

  console.log(`Created agent: ${key.id}`);
  console.log(`  Spending: max $${maxPerTx}/tx, $${dailyLimit}/day`);
  console.log(`\n  API Key (save this — shown once): ${raw}\n`);
  return key.id;
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
  const chainId = env.NEXT_PUBLIC_CHAIN_ENV === "mainnet" ? BASE_MAINNET : BASE_SEPOLIA;

  const [wallet] = await database
    .insert(wallets)
    .values({ userId, address, chainId, label: "default", thirdwebId })
    .returning();

  if (!wallet) throw new Error("Failed to create wallet");
  console.log(`Created wallet: ${wallet.id} (${address})`);
  return wallet;
}

async function seed() {
  const user = await ensureUser(db);
  const wallet = await ensureWallet(db, user.id);
  await ensureAgent(db, user.id, wallet.id);

  console.log("\nSeed complete.");
}

seed().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
