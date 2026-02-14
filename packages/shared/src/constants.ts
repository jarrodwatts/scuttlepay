export const BASE_MAINNET = 8453;
export const BASE_SEPOLIA = 84532;

export const USDC_ADDRESSES = {
  [BASE_MAINNET]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [BASE_SEPOLIA]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
} as const;

export const CHAIN_NAMES = {
  [BASE_MAINNET]: "base",
  [BASE_SEPOLIA]: "base-sepolia",
} as const;

export type SupportedChainId = typeof BASE_MAINNET | typeof BASE_SEPOLIA;

export const USDC_DECIMALS = 6;
