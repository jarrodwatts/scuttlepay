import type { Address } from "thirdweb";
import { base, baseSepolia } from "thirdweb/chains";
import { USDC_ADDRESSES } from "@scuttlepay/shared";
import { env } from "~/env";

const isMainnet = env.NEXT_PUBLIC_CHAIN_ENV === "mainnet";

export const activeChain = isMainnet ? base : baseSepolia;

export const USDC_TOKEN_ADDRESS: Address = isMainnet
  ? USDC_ADDRESSES[8453]
  : USDC_ADDRESSES[84532];

export const BLOCK_EXPLORER_URL = isMainnet
  ? "https://basescan.org"
  : "https://sepolia.basescan.org";
