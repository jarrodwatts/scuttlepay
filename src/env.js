import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    THIRDWEB_SECRET_KEY: z.string(),
    THIRDWEB_CLIENT_ID: z.string().optional(),
    THIRDWEB_AUTH_PRIVATE_KEY: z.string(),
    THIRDWEB_WALLET_ADDRESS: z.string().optional(),
    THIRDWEB_WALLET_ID: z.string().optional(),
    SHOPIFY_STORE_URL: z.string().optional(),
    SHOPIFY_ADMIN_TOKEN: z.string().optional(),
    SHOPIFY_STOREFRONT_PUBLIC_TOKEN: z.string().optional(),
    DEFAULT_MAX_PER_TX: z.string().default("10"),
    DEFAULT_DAILY_LIMIT: z.string().default("50"),
    SHOPIFY_APP_API_KEY: z.string().optional(),
    SHOPIFY_APP_API_SECRET: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
    SETTLEMENT_MODE: z
      .enum(["stripe", "direct"])
      .default("stripe"),
    SETTLEMENT_ADDRESS: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID: z.string(),
    NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN: z.string().default("localhost:3000"),
    NEXT_PUBLIC_CHAIN_ENV: z.enum(["mainnet", "testnet"]).default("testnet"),
    NEXT_PUBLIC_SHOPIFY_APP_API_KEY: z.string().optional(),
  },

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    THIRDWEB_SECRET_KEY: process.env.THIRDWEB_SECRET_KEY,
    THIRDWEB_CLIENT_ID: process.env.THIRDWEB_CLIENT_ID,
    THIRDWEB_AUTH_PRIVATE_KEY: process.env.THIRDWEB_AUTH_PRIVATE_KEY,
    THIRDWEB_WALLET_ADDRESS: process.env.THIRDWEB_WALLET_ADDRESS,
    THIRDWEB_WALLET_ID: process.env.THIRDWEB_WALLET_ID,
    SHOPIFY_STORE_URL: process.env.SHOPIFY_STORE_URL,
    SHOPIFY_ADMIN_TOKEN: process.env.SHOPIFY_ADMIN_TOKEN,
    SHOPIFY_STOREFRONT_PUBLIC_TOKEN: process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
    DEFAULT_MAX_PER_TX: process.env.DEFAULT_MAX_PER_TX,
    DEFAULT_DAILY_LIMIT: process.env.DEFAULT_DAILY_LIMIT,
    SHOPIFY_APP_API_KEY: process.env.SHOPIFY_APP_API_KEY,
    SHOPIFY_APP_API_SECRET: process.env.SHOPIFY_APP_API_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_CONNECT_CLIENT_ID: process.env.STRIPE_CONNECT_CLIENT_ID,
    SETTLEMENT_MODE: process.env.SETTLEMENT_MODE,
    SETTLEMENT_ADDRESS: process.env.SETTLEMENT_ADDRESS,
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
    NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN: process.env.NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN,
    NEXT_PUBLIC_CHAIN_ENV: process.env.NEXT_PUBLIC_CHAIN_ENV,
    NEXT_PUBLIC_SHOPIFY_APP_API_KEY: process.env.NEXT_PUBLIC_SHOPIFY_APP_API_KEY,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
