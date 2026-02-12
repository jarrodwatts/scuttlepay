export const BASE_MAINNET = 8453;
export const BASE_SEPOLIA = 84532;

export const USDC_ADDRESSES = {
  [BASE_MAINNET]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [BASE_SEPOLIA]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
} as const;

export const FACILITATOR_URLS = {
  thirdweb: "https://x402.org/facilitator",
  coinbase: "https://x402.org/facilitator",
} as const;

export const CHAIN_NAMES = {
  [BASE_MAINNET]: "base",
  [BASE_SEPOLIA]: "base-sepolia",
} as const;

export const USDC_DECIMALS = 6;

export const API_ROUTES = {
  HEALTH: "/health",
  WALLET_BALANCE: "/api/wallet/balance",
  WALLET_ADDRESS: "/api/wallet/address",
  PRODUCTS: "/api/products",
  PURCHASES: "/api/purchases",
  TRANSACTIONS: "/api/transactions",
} as const;
