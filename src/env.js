import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_DISCORD_ID: z.string().optional(),
    AUTH_DISCORD_SECRET: z.string().optional(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    CHAIN_ENV: z.enum(["mainnet", "testnet"]).default("testnet"),
    THIRDWEB_SECRET_KEY: z.string().optional(),
    THIRDWEB_CLIENT_ID: z.string().optional(),
    THIRDWEB_WALLET_ADDRESS: z.string().optional(),
    THIRDWEB_WALLET_ID: z.string().optional(),
    SHOPIFY_STORE_URL: z.string().optional(),
    SHOPIFY_STOREFRONT_TOKEN: z.string().optional(),
    SHOPIFY_ADMIN_TOKEN: z.string().optional(),
    DEFAULT_MAX_PER_TX: z.string().default("10"),
    DEFAULT_DAILY_LIMIT: z.string().default("50"),
  },

  client: {},

  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
    AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    CHAIN_ENV: process.env.CHAIN_ENV,
    THIRDWEB_SECRET_KEY: process.env.THIRDWEB_SECRET_KEY,
    THIRDWEB_CLIENT_ID: process.env.THIRDWEB_CLIENT_ID,
    THIRDWEB_WALLET_ADDRESS: process.env.THIRDWEB_WALLET_ADDRESS,
    THIRDWEB_WALLET_ID: process.env.THIRDWEB_WALLET_ID,
    SHOPIFY_STORE_URL: process.env.SHOPIFY_STORE_URL,
    SHOPIFY_STOREFRONT_TOKEN: process.env.SHOPIFY_STOREFRONT_TOKEN,
    SHOPIFY_ADMIN_TOKEN: process.env.SHOPIFY_ADMIN_TOKEN,
    DEFAULT_MAX_PER_TX: process.env.DEFAULT_MAX_PER_TX,
    DEFAULT_DAILY_LIMIT: process.env.DEFAULT_DAILY_LIMIT,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
