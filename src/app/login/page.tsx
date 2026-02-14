"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { inAppWallet } from "thirdweb/wallets";

import { thirdwebBrowserClient } from "~/lib/thirdweb-client";
import { ThirdwebWrapper } from "~/components/thirdweb-wrapper";
import { Skeleton } from "~/components/ui/skeleton";
import { GridCross } from "~/components/ui/grid-cross";
import {
  generatePayload,
  login,
  isLoggedIn,
  logout,
} from "~/server/auth/actions";

const ConnectButton = dynamic(
  () => import("thirdweb/react").then((m) => ({ default: m.ConnectButton })),
  { ssr: false, loading: () => <Skeleton className="h-10 w-48" /> },
);

export default function LoginPage() {
  const router = useRouter();

  return (
    <ThirdwebWrapper>
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="relative border border-border p-12">
          <GridCross position="top-left" />
          <GridCross position="top-right" />
          <GridCross position="bottom-left" />
          <GridCross position="bottom-right" />
          <div className="flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-2xl font-black uppercase tracking-tight">
                ScuttlePay
              </h1>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Sign in to continue
              </p>
            </div>
            <ConnectButton
              client={thirdwebBrowserClient}
              wallets={[
                inAppWallet({
                  auth: {
                    options: ["email", "google", "apple"],
                  },
                }),
              ]}
              auth={{
                getLoginPayload: async ({ address }) =>
                  generatePayload({ address }),
                doLogin: async (params) => {
                  await login(params);
                  router.push("/dashboard");
                },
                isLoggedIn: async () => isLoggedIn(),
                doLogout: async () => {
                  await logout();
                  router.push("/");
                },
              }}
            />
          </div>
        </div>
      </div>
    </ThirdwebWrapper>
  );
}
