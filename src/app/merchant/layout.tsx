import { AppBridgeProvider } from "~/components/merchant/app-bridge-provider";

export default function MerchantLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppBridgeProvider>{children}</AppBridgeProvider>;
}
