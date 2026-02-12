import { createThirdwebClient, Engine } from "thirdweb";
import { baseSepolia, base } from "thirdweb/chains";
import { env } from "~/env";

export const activeChain = env.CHAIN_ENV === "mainnet" ? base : baseSepolia;

export { baseSepolia as baseSepoliaChain };

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
