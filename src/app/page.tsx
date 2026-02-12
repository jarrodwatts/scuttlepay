import Link from "next/link";
import { ArrowRight, Bot, CreditCard, ShieldCheck, Zap } from "lucide-react";

import { auth } from "~/server/auth";
import { Button } from "~/components/ui/button";

export default async function Home() {
  const session = await auth();
  const ctaHref = session ? "/dashboard" : "/api/auth/signin";

  return (
    <main className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between border-b px-6 py-4 lg:px-12">
        <span className="text-lg font-semibold tracking-tight">ScuttlePay</span>
        <Button asChild variant="ghost" size="sm">
          <Link href={ctaHref}>{session ? "Dashboard" : "Sign in"}</Link>
        </Button>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center lg:py-32">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
          <Bot className="size-4" />
          Built for autonomous AI agents
        </div>
        <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
          A bank account for AI&nbsp;agents
        </h1>
        <p className="max-w-lg text-lg text-muted-foreground">
          Give your AI agent a wallet, set spending limits, and let it pay for
          services autonomously — on-chain, with full visibility.
        </p>
        <div className="flex gap-3">
          <Button asChild size="lg">
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

      {/* Problem → Solution */}
      <section className="border-t bg-muted/40 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Why ScuttlePay?
          </h2>
          <p className="mb-12 text-center text-muted-foreground">
            AI agents need to spend money, but they can&rsquo;t have credit cards.
          </p>
          <div className="grid gap-8 sm:grid-cols-3">
            <FeatureCard
              icon={<CreditCard className="size-5" />}
              title="Agent-native wallet"
              description="Each agent gets a USDC wallet on Base — no bank account or KYC required."
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
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center text-2xl font-bold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <div className="flex flex-col gap-0">
            <Step
              number="1"
              title="Create a wallet"
              description="Sign up and your agent gets a USDC wallet on Base Sepolia."
            />
            <StepConnector />
            <Step
              number="2"
              title="Configure your agent"
              description="Connect ScuttlePay to your AI agent using the MCP server."
            />
            <StepConnector />
            <Step
              number="3"
              title="Agent pays autonomously"
              description="Your agent checks its balance, makes purchases, and you see every transaction."
            />
          </div>
          <div className="mt-12 flex justify-center">
            <Button asChild size="lg">
              <Link href={ctaHref}>
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground lg:px-12">
        ScuttlePay &mdash; ETH Global Hackathon 2025
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
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-6">
      <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
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
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
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
