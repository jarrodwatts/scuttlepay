"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { inAppWallet } from "thirdweb/wallets";

import { thirdwebBrowserClient } from "~/lib/thirdweb-client";
import { ThirdwebWrapper } from "~/components/thirdweb-wrapper";
import { AsciiBand } from "~/components/ui/ascii-band";
import { GridCross } from "~/components/ui/grid-cross";
import {
  generatePayload,
  login,
  isLoggedIn,
  logout,
} from "~/server/auth/actions";

const SCUTTLEPAY_THEME = {
  type: "dark" as const,
  colors: {
    modalBg: "hsl(0 0% 4%)",
    primaryText: "hsl(0 0% 96%)",
    secondaryText: "hsl(0 0% 45%)",
    accentText: "hsl(142 71% 45%)",
    accentButtonBg: "hsl(142 71% 45%)",
    accentButtonText: "hsl(0 0% 0%)",
    primaryButtonBg: "hsl(0 0% 96%)",
    primaryButtonText: "hsl(0 0% 0%)",
    secondaryButtonBg: "hsl(0 0% 9%)",
    secondaryButtonText: "hsl(0 0% 96%)",
    secondaryButtonHoverBg: "hsl(0 0% 12%)",
    borderColor: "hsl(0 0% 15%)",
    separatorLine: "hsl(0 0% 15%)",
    secondaryIconColor: "hsl(0 0% 45%)",
    secondaryIconHoverBg: "hsl(0 0% 12%)",
    secondaryIconHoverColor: "hsl(0 0% 96%)",
    success: "hsl(142 71% 45%)",
    danger: "hsl(0 72% 55%)",
    modalOverlayBg: "rgba(0, 0, 0, 0.8)",
    inputAutofillBg: "hsl(0 0% 9%)",
    scrollbarBg: "hsl(0 0% 12%)",
    tertiaryBg: "hsl(0 0% 9%)",
    tooltipBg: "hsl(0 0% 12%)",
    tooltipText: "hsl(0 0% 96%)",
    skeletonBg: "hsl(0 0% 12%)",
    selectedTextBg: "hsl(142 71% 45%)",
    selectedTextColor: "hsl(0 0% 0%)",
    connectedButtonBg: "hsl(0 0% 4%)",
    connectedButtonBgHover: "hsl(0 0% 11%)",
  },
  fontFamily: "inherit",
};

const ConnectEmbed = dynamic(
  () => import("thirdweb/react").then((m) => ({ default: m.ConnectEmbed })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[570px] w-full max-w-[730px] items-center justify-center border border-border">
        <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    ),
  },
);

function WelcomeScreen() {
  return (
    <div className="flex h-full flex-col justify-between p-8">
      <Image
        src="/scuttlepay-text.png"
        alt="ScuttlePay"
        width={750}
        height={200}
        className="h-6 w-auto"
      />
      <div>
        <h1 className="text-2xl font-black uppercase leading-tight tracking-tight">
          A bank account
          <br />
          for AI&nbsp;agents
        </h1>
        <p className="mt-3 text-sm text-[hsl(0_0%_45%)]">
          Give your AI agent a wallet, set spending limits, and let it pay for
          services autonomously.
        </p>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-[hsl(0_0%_45%)]">
        ScuttlePay / 2026
      </p>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  return (
    <ThirdwebWrapper>
      <div className="flex min-h-screen flex-col">
        <div className="pointer-events-none fixed inset-0 -z-1 bg-[radial-gradient(ellipse_60%_40%_at_50%_60%,rgba(34,197,94,0.06),transparent)]" />

        <AsciiBand pattern="crosshatch" />

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
          <header
            className="mb-10 flex flex-col items-center gap-3 opacity-0"
            style={{ animation: "login-fade-in 0.6s ease forwards" }}
          >
            <Link href="/">
              <Image
                src="/scuttlepay-text.png"
                alt="ScuttlePay"
                width={750}
                height={200}
                className="h-8 w-auto"
                priority
              />
            </Link>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Sign in to continue
            </p>
          </header>

          <div
            className="relative opacity-0"
            style={{ animation: "login-fade-in 0.6s ease forwards 0.15s" }}
          >
            <GridCross position="top-left" />
            <GridCross position="top-right" />
            <GridCross position="bottom-left" />
            <GridCross position="bottom-right" />

            <ConnectEmbed
              client={thirdwebBrowserClient}
              theme={SCUTTLEPAY_THEME}
              modalSize="wide"
              welcomeScreen={() => <WelcomeScreen />}
              wallets={[
                inAppWallet({
                  auth: {
                    options: [
                      "google",
                      "apple",
                      "discord",
                      "email",
                      "phone",
                      "passkey",
                    ],
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
              showThirdwebBranding={false}
            />
          </div>
        </div>

        <AsciiBand pattern="binary" />

        <footer
          className="px-6 py-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-0"
          style={{ animation: "login-fade-in 0.6s ease forwards 0.4s" }}
        >
          ScuttlePay / 2026
        </footer>
      </div>

      <style jsx global>{`
        @keyframes login-fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </ThirdwebWrapper>
  );
}
