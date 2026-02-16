import Script from "next/script";
import { AppBridgeProvider } from "~/components/merchant/app-bridge-provider";
import { env } from "~/env";

const APP_BRIDGE_CDN = "https://cdn.shopify.com/shopifycloud/app-bridge.js";

export default function MerchantLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const scriptUrl = `${APP_BRIDGE_CDN}?apiKey=${env.NEXT_PUBLIC_SHOPIFY_APP_API_KEY ?? ""}`;

  return (
    <>
      <Script src={scriptUrl} strategy="beforeInteractive" />
      <AppBridgeProvider>{children}</AppBridgeProvider>
    </>
  );
}
