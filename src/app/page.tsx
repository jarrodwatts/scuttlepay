import Link from "next/link";
import { ArrowRight, CreditCard, ShieldCheck, Zap } from "lucide-react";

import { getAuthUser } from "~/server/auth";
import { Button } from "~/components/ui/button";
import { GridCross } from "~/components/ui/grid-cross";
import { AsciiBand } from "~/components/ui/ascii-band";

export default async function Home() {
  const user = await getAuthUser();
  const ctaHref = user ? "/dashboard" : "/login";

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col border-x border-border">
      {/* Nav */}
      <header className="flex items-center justify-between border-b px-6 py-4 lg:px-12">
        <span className="font-mono text-sm font-semibold uppercase tracking-widest">
          ScuttlePay
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link href={ctaHref}>{user ? "Dashboard" : "Sign in"}</Link>
        </Button>
      </header>

      {/* Hero */}
      <section className="relative flex flex-1 flex-col items-start justify-center gap-6 border-b px-6 py-24 lg:px-12 lg:py-32">
        <GridCross position="top-left" />
        <GridCross position="bottom-right" />
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <span className="inline-block size-1.5 rounded-full bg-accent" />
          Built for autonomous AI agents
        </div>
        <h1 className="max-w-3xl text-5xl font-black uppercase tracking-tight sm:text-7xl lg:text-8xl">
          A bank account for AI&nbsp;agents
        </h1>
        <p className="max-w-lg text-lg text-muted-foreground">
          Give your AI agent a wallet, set spending limits, and let it pay for
          services autonomously — on-chain, with full visibility.
        </p>
        <div className="flex gap-3">
          <Button asChild variant="accent" size="lg">
            <Link href={ctaHref}>
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="#how-it-works">Learn more</Link>
          </Button>
        </div>
      </section>

      <AsciiBand pattern="crosshatch" />

      {/* Features */}
      <section className="relative border-b px-6 py-20 lg:px-12">
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
        <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <FeatureCard
            icon={<CreditCard className="size-5" />}
            title="Fund with a credit card"
            description="Add funds instantly. Your agent spends dollars — no crypto knowledge needed."
          />
          <FeatureCard
            icon={<ShieldCheck className="size-5" />}
            title="Spending policies"
            description="Set per-transaction and daily limits. Your agent can only spend what you allow."
          />
          <FeatureCard
            icon={<Zap className="size-5" />}
            title="MCP-ready"
            description="Integrate with any AI framework via the Model Context Protocol in minutes."
          />
        </div>
      </section>

      <AsciiBand pattern="dots" />

      {/* How it works */}
      <section id="how-it-works" className="relative border-b px-6 py-20 lg:px-12">
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

      {/* Footer */}
      <footer className="border-t px-6 py-6 font-mono text-xs uppercase tracking-widest text-muted-foreground lg:px-12">
        ScuttlePay / 2026
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3 p-6">
      <div className="flex size-10 items-center justify-center border border-border">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
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
