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
    MERCHANT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    FACILITATOR_URL: z
      .string()
      .url()
      .default("https://x402.org/facilitator"),
  },

  client: {
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID: z.string(),
    NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN: z.string().default("localhost:3000"),
    NEXT_PUBLIC_CHAIN_ENV: z.enum(["mainnet", "testnet"]).default("testnet"),
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
    MERCHANT_ADDRESS: process.env.MERCHANT_ADDRESS,
    FACILITATOR_URL: process.env.FACILITATOR_URL,
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
    NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN: process.env.NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN,
    NEXT_PUBLIC_CHAIN_ENV: process.env.NEXT_PUBLIC_CHAIN_ENV,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
