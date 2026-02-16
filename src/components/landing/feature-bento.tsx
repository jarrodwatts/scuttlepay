"use client"

import { CreditCard, ShieldCheck, Zap, Activity } from "lucide-react"
import { BentoCard, BentoGrid } from "~/components/ui/bento-grid"
import { TransactionFeed } from "~/components/landing/transaction-feed"

const CODE_SNIPPET = `import { ScuttlePay } from "@scuttlepay/mcp"

const agent = new ScuttlePay({
  apiKey: process.env.SCUTTLEPAY_KEY,
})

await agent.buy({
  product: "api-credits",
  amount: 12.50,
})`

function CodeBackground() {
  return (
    <div className="p-4 font-mono text-[11px] leading-relaxed text-accent/60">
      <pre className="whitespace-pre-wrap">{CODE_SNIPPET}</pre>
    </div>
  )
}

function CardVisual() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="relative w-64">
        <div className="border border-border bg-background p-5">
          <div className="mb-6 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              ScuttlePay
            </span>
            <div className="size-6 border border-accent bg-accent/10" />
          </div>
          <div className="mb-2 font-mono text-xs text-muted-foreground">
            **** **** **** 4242
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">
              AGENT-01
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              12/27
            </span>
          </div>
        </div>
        <div className="absolute -right-2 -bottom-2 border border-accent/30 bg-accent/5 px-3 py-1 font-mono text-[10px] text-accent">
          USD
        </div>
      </div>
    </div>
  )
}

function LimitBars() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <div>
        <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Per-transaction</span>
          <span>$50 max</span>
        </div>
        <div className="h-1.5 w-full bg-border">
          <div className="h-full w-3/5 bg-accent" />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Daily limit</span>
          <span>$100 max</span>
        </div>
        <div className="h-1.5 w-full bg-border">
          <div className="h-full w-2/5 bg-accent" />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Monthly budget</span>
          <span>$1,000 max</span>
        </div>
        <div className="h-1.5 w-full bg-border">
          <div className="h-full w-1/4 bg-accent/70" />
        </div>
      </div>
    </div>
  )
}

const FEATURES = [
  {
    Icon: CreditCard,
    name: "Fund with a credit card",
    description:
      "Add funds instantly. Your agent spends dollars — no crypto knowledge needed.",
    href: "#",
    cta: "Learn more",
    background: <CardVisual />,
    className: "col-span-3 lg:col-span-2",
  },
  {
    Icon: ShieldCheck,
    name: "Spending policies",
    description:
      "Set per-transaction and daily limits. Your agent can only spend what you allow.",
    href: "#",
    cta: "Learn more",
    background: <LimitBars />,
    className: "col-span-3 lg:col-span-1",
  },
  {
    Icon: Zap,
    name: "MCP-ready",
    description:
      "Integrate with any AI framework via the Model Context Protocol in minutes.",
    href: "#",
    cta: "Learn more",
    background: <CodeBackground />,
    className: "col-span-3 lg:col-span-1",
  },
  {
    Icon: Activity,
    name: "Real-time visibility",
    description:
      "See every transaction as it happens. Full audit trail, zero surprises.",
    href: "#",
    cta: "Learn more",
    background: <TransactionFeed className="max-h-48" />,
    className: "col-span-3 lg:col-span-2",
  },
]

export function FeatureBento() {
  return (
    <BentoGrid className="auto-rows-[24rem] gap-4 lg:grid-cols-3">
      {FEATURES.map((feature) => (
        <BentoCard key={feature.name} {...feature} />
      ))}
    </BentoGrid>
  )
}
