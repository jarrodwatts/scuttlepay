import { createThirdwebClient, Engine } from "thirdweb";
import { baseSepolia, base } from "thirdweb/chains";
import { BASE_MAINNET, BASE_SEPOLIA, type SupportedChainId } from "@scuttlepay/shared";
import { env } from "~/env";

const isMainnet = env.NEXT_PUBLIC_CHAIN_ENV === "mainnet";
export const activeChain = isMainnet ? base : baseSepolia;
export const chainId: SupportedChainId = isMainnet ? BASE_MAINNET : BASE_SEPOLIA;

let _client: ReturnType<typeof createThirdwebClient> | undefined;

export function getThirdwebClient() {
  if (!_client) {
    const secretKey = env.THIRDWEB_SECRET_KEY;
    if (!secretKey) {
      throw new Error("THIRDWEB_SECRET_KEY is not configured");
    }
    _client = createThirdwebClient({ secretKey });
  }
  return _client;
}

export function getServerWallet(address: string) {
  return Engine.serverWallet({
    client: getThirdwebClient(),
    address,
    chain: activeChain,
  });
}

export async function createUserServerWallet(
  label: string,
): Promise<{ address: string }> {
  const result = await Engine.createServerWallet({
    client: getThirdwebClient(),
    label,
  });
  return { address: result.address };
}

export async function getServerWalletAddress(): Promise<string> {
  const walletId = env.THIRDWEB_WALLET_ID;
  if (!walletId) {
    throw new Error("THIRDWEB_WALLET_ID is not configured");
  }

  const result = await Engine.getServerWallets({
    client: getThirdwebClient(),
  });

  const match = result.accounts.find(
    (w) =>
      w.address === walletId ||
      w.smartAccountAddress === walletId ||
      w.label === walletId,
  );

  if (match) {
    return match.smartAccountAddress ?? match.address;
  }

  throw new Error(`Server wallet not found for ID: ${walletId}`);
}
