import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { createDb } from "./index.js";
import { users, apiKeys, wallets, spendingPolicies } from "./schema.js";

const DEMO_EMAIL = "demo@scuttlepay.com";
const SALT_ROUNDS = 10;

async function seed() {
  const db = createDb();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    console.log("Seed data already exists. Skipping.");
    console.log(`  User ID: ${existing[0]!.id}`);

    const existingWallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, existing[0]!.id))
      .limit(1);

    if (existingWallet.length > 0) {
      console.log(`  Wallet ID: ${existingWallet[0]!.id}`);
    }
    return;
  }

  const [user] = await db
    .insert(users)
    .values({ name: "Demo User", email: DEMO_EMAIL })
    .returning();

  if (!user) throw new Error("Failed to create user");
  console.log(`Created user: ${user.id}`);

  const rawKey = `sk_test_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = await bcrypt.hash(rawKey, SALT_ROUNDS);

  const [key] = await db
    .insert(apiKeys)
    .values({
      userId: user.id,
      keyHash,
      keyPrefix: rawKey.slice(0, 12),
      name: "demo-agent",
    })
    .returning();

  if (!key) throw new Error("Failed to create API key");
  console.log(`Created API key: ${key.id}`);
  console.log(`\n  API Key (save this — shown once): ${rawKey}\n`);

  const walletAddress =
    process.env["THIRDWEB_WALLET_ADDRESS"] ?? "0x_placeholder_update_later";
  const thirdwebId = process.env["THIRDWEB_WALLET_ID"] ?? "placeholder";
  const chainId = process.env["CHAIN_ENV"] === "mainnet" ? 8453 : 84532;

  const [wallet] = await db
    .insert(wallets)
    .values({
      userId: user.id,
      address: walletAddress,
      chainId,
      label: "default",
      thirdwebId,
    })
    .returning();

  if (!wallet) throw new Error("Failed to create wallet");
  console.log(`Created wallet: ${wallet.id} (${walletAddress})`);

  const maxPerTx = process.env["DEFAULT_MAX_PER_TX"] ?? "10";
  const dailyLimit = process.env["DEFAULT_DAILY_LIMIT"] ?? "50";

  const [policy] = await db
    .insert(spendingPolicies)
    .values({
      walletId: wallet.id,
      maxPerTx: maxPerTx,
      dailyLimit: dailyLimit,
    })
    .returning();

  if (!policy) throw new Error("Failed to create spending policy");
  console.log(
    `Created spending policy: max $${maxPerTx}/tx, $${dailyLimit}/day`,
  );

  console.log("\nSeed complete.");
}

seed().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
