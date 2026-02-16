"use client"

import {
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  ShieldCheck,
  Wallet,
} from "lucide-react"
import { AnimatedList } from "~/components/ui/animated-list"
import { cn } from "~/lib/utils"

interface TransactionItem {
  icon: React.ReactNode
  label: string
  detail: string
  accent?: boolean
}

const TRANSACTIONS: TransactionItem[] = [
  {
    icon: <CircleDollarSign className="size-4" />,
    label: "Agent purchased API credits",
    detail: "$12.50",
  },
  {
    icon: <ShieldCheck className="size-4" />,
    label: "Spending limit check passed",
    detail: "OK",
    accent: true,
  },
  {
    icon: <ArrowUpRight className="size-4" />,
    label: "Transaction settled on Base",
    detail: "$25.00",
  },
  {
    icon: <Wallet className="size-4" />,
    label: "Daily limit remaining",
    detail: "$47.50 / $100",
  },
  {
    icon: <CheckCircle2 className="size-4" />,
    label: "Agent purchased cloud compute",
    detail: "$8.20",
  },
  {
    icon: <ShieldCheck className="size-4" />,
    label: "Per-transaction limit check",
    detail: "OK",
    accent: true,
  },
  {
    icon: <CircleDollarSign className="size-4" />,
    label: "Agent paid for SaaS license",
    detail: "$19.99",
  },
  {
    icon: <ArrowUpRight className="size-4" />,
    label: "Transaction settled on Base",
    detail: "$19.99",
  },
]

function TransactionNotification({ icon, label, detail, accent }: TransactionItem) {
  return (
    <div className="flex items-center gap-3 border border-border bg-background px-4 py-2.5">
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center border",
          accent ? "border-accent text-accent" : "border-border text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <div className="flex-1 truncate font-mono text-xs text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "shrink-0 font-mono text-xs font-semibold",
          accent ? "text-accent" : "text-foreground",
        )}
      >
        {detail}
      </div>
    </div>
  )
}

export function TransactionFeed({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <AnimatedList delay={2000}>
        {TRANSACTIONS.map((tx, i) => (
          <TransactionNotification key={i} {...tx} />
        ))}
      </AnimatedList>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
    </div>
  )
}
