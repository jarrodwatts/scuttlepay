import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getAuthUser } from "~/server/auth";
import { Button } from "~/components/ui/button";
import { GridCross } from "~/components/ui/grid-cross";
import { AsciiBand } from "~/components/ui/ascii-band";
import { FeatureBento } from "~/components/landing/feature-bento";
import { ProductDemo } from "~/components/landing/product-demo";
import { MerchantInstallForm } from "~/components/landing/merchant-install-form";

export default async function Home() {
  const user = await getAuthUser();
  const ctaHref = user ? "/dashboard" : "/login";

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col border-x border-border">
      {/* Nav */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur-md lg:px-12">
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
        <nav className="hidden items-center gap-8 sm:flex">
          <a
            href="#features"
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </a>
        </nav>
        <Button asChild variant="accent" size="sm">
          <Link href={ctaHref}>{user ? "Dashboard" : "Get started"}</Link>
        </Button>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center gap-6 overflow-hidden border-b px-6 pt-12 pb-12 text-center lg:px-12 lg:pt-16 lg:pb-16">
        <div className="pointer-events-none absolute inset-x-[-20%] bottom-[-10%] top-[40%] -z-1 bg-radial-[at_50%_100%] from-[#2CFF6E]/40 via-[#0A4A1F]/8 to-transparent blur-[60px]" />

        <h1 className="relative max-w-2xl text-4xl font-black uppercase tracking-tight sm:text-5xl lg:text-6xl">
          A bank account for AI&nbsp;agents
        </h1>

        <p className="relative max-w-lg text-lg text-muted-foreground">
          Give your AI agent a wallet, set spending limits, and let it pay for
          services autonomously — on-chain, with full visibility.
        </p>

        <div className="relative flex flex-wrap items-center justify-center gap-4">
          <Button asChild variant="accent" size="lg">
            <Link href={ctaHref}>
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="#merchants">
              I&rsquo;m a merchant
            </a>
          </Button>
        </div>

        <div className="relative mt-4 w-full max-w-2xl">
          <ProductDemo />
        </div>
      </section>

      <AsciiBand pattern="crosshatch" />

      {/* Features */}
      <section id="features" className="relative border-b px-6 py-20 lg:px-12">
        <GridCross position="top-left" />
        <GridCross position="bottom-right" />
        <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          [01] Why ScuttlePay
        </div>
        <h2 className="mb-4 text-2xl font-black uppercase tracking-tight sm:text-3xl">
          Why ScuttlePay?
        </h2>
        <p className="mb-12 text-muted-foreground">
          AI agents need to spend money, but they can&rsquo;t have credit cards.
        </p>
        <FeatureBento />
      </section>

      <AsciiBand pattern="dots" />

      {/* How it works */}
      <section
        id="how-it-works"
        className="relative border-b px-6 py-20 lg:px-12"
      >
        <GridCross position="top-left" />
        <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          [02] How it works
        </div>
        <h2 className="mb-12 text-2xl font-black uppercase tracking-tight sm:text-3xl">
          How it works
        </h2>
        <div className="flex flex-col gap-0">
          <Step
            number="01"
            title="Sign up and add funds"
            description="Create an account and deposit dollars with a credit card."
          />
          <StepConnector />
          <Step
            number="02"
            title="Create an agent"
            description="Set spending limits and get an API key for your AI agent."
          />
          <StepConnector />
          <Step
            number="03"
            title="Agent spends autonomously"
            description="Your agent makes purchases within its limits. You see every transaction in real time."
          />
        </div>
        <div className="mt-12">
          <Button asChild variant="accent" size="lg">
            <Link href={ctaHref}>
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <AsciiBand pattern="dither" />

      {/* Merchants */}
      <section id="merchants" className="relative border-b px-6 py-20 lg:px-12">
        <GridCross position="top-left" />
        <GridCross position="bottom-right" />
        <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          [03] For merchants
        </div>
        <h2 className="mb-4 text-2xl font-black uppercase tracking-tight sm:text-3xl">
          Accept AI agent payments
        </h2>
        <p className="mb-8 max-w-lg text-muted-foreground">
          Install ScuttlePay on your Shopify store. Your products become
          instantly purchasable by AI agents — orders appear right in your
          Shopify admin.
        </p>
        <MerchantInstallForm />
      </section>

      <AsciiBand pattern="binary" />

      {/* Bottom CTA */}
      <section className="relative flex flex-col items-center gap-6 border-b px-6 py-24 text-center lg:px-12">
        <GridCross position="top-left" />
        <GridCross position="bottom-right" />
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          [04] Get started
        </div>
        <h2 className="max-w-xl text-2xl font-black uppercase tracking-tight sm:text-4xl">
          Ready to give your AI agent a&nbsp;wallet?
        </h2>
        <p className="max-w-md text-muted-foreground">
          Set up in minutes. Your agent can start spending autonomously today.
        </p>
        <Button asChild variant="accent" size="lg">
          <Link href={ctaHref}>
            Get started
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      <AsciiBand pattern="binary" />

      {/* Footer */}
      <footer className="border-t px-6 py-6 font-mono text-xs uppercase tracking-widest text-muted-foreground lg:px-12">
        ScuttlePay / 2026
      </footer>
    </main>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex size-8 shrink-0 items-center justify-center border border-border font-mono text-sm">
        {number}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function StepConnector() {
  return <div className="ml-[15px] h-8 w-px bg-border" />;
}
