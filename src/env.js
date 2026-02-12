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
    THIRDWEB_WALLET_ADDRESS: z.string().optional(),
    THIRDWEB_WALLET_ID: z.string().optional(),
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
    THIRDWEB_WALLET_ADDRESS: process.env.THIRDWEB_WALLET_ADDRESS,
    THIRDWEB_WALLET_ID: process.env.THIRDWEB_WALLET_ID,
    DEFAULT_MAX_PER_TX: process.env.DEFAULT_MAX_PER_TX,
    DEFAULT_DAILY_LIMIT: process.env.DEFAULT_DAILY_LIMIT,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
