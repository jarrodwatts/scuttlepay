"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
} from "lucide-react";
import { TransactionStatus, TransactionType } from "@scuttlepay/shared";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type Transaction = RouterOutputs["transaction"]["list"]["items"][number];

const statusVariant: Record<
  TransactionStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  [TransactionStatus.PENDING]: "outline",
  [TransactionStatus.SETTLING]: "secondary",
  [TransactionStatus.SETTLED]: "default",
  [TransactionStatus.FAILED]: "destructive",
};

const typeIcon: Record<TransactionType, typeof ArrowUpRight> = {
  [TransactionType.PURCHASE]: ArrowUpRight,
  [TransactionType.FUND]: ArrowDownRight,
  [TransactionType.REFUND]: RotateCcw,
};

function BalanceCard() {
  const { data, isLoading } = api.wallet.getBalance.useQuery(undefined, {
    refetchInterval: 2000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Available Balance</CardDescription>
          <Skeleton className="h-10 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  const formatted = data
    ? Number(data.balance).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";

  return (
    <Card>
      <CardHeader>
        <CardDescription>Available Balance</CardDescription>
        <CardTitle className="text-4xl font-bold tracking-tight">
          ${formatted} <span className="text-lg font-normal text-muted-foreground">USDC</span>
        </CardTitle>
      </CardHeader>
      {data && (
        <CardContent>
          <p className="text-sm text-muted-foreground">on {data.chain}</p>
        </CardContent>
      )}
    </Card>
  );
}

function WalletAddressCard() {
  const { data, isLoading } = api.wallet.getAddress.useQuery();
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    if (!data?.address) return;
    await navigator.clipboard.writeText(data.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Wallet Address</CardDescription>
          <Skeleton className="h-6 w-full max-w-md" />
        </CardHeader>
        <CardContent className="flex justify-center">
          <Skeleton className="size-40" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>Wallet Address</CardDescription>
        <div className="flex items-center gap-2">
          <code className="text-sm break-all">{data?.address}</code>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={copyAddress}
            aria-label="Copy wallet address"
          >
            {copied ? (
              <Check className="size-3.5 text-green-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>
      {data?.address && (
        <CardContent className="flex justify-center">
          <QRCodeSVG value={data.address} size={160} />
        </CardContent>
      )}
    </Card>
  );
}

function FundingGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between text-left"
        >
          <CardTitle className="text-base">How to fund your wallet</CardTitle>
          {open ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>
      {open && (
        <CardContent>
          <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
            <li>Copy your wallet address above</li>
            <li>
              Go to a Base Sepolia USDC faucet (e.g. Circle&apos;s testnet
              faucet)
            </li>
            <li>Paste your wallet address and request testnet USDC</li>
            <li>Wait for the transaction to confirm (~10 seconds)</li>
            <li>Your balance will update automatically</li>
          </ol>
        </CardContent>
      )}
    </Card>
  );
}

function TransactionCard({ tx }: { tx: Transaction }) {
  const Icon = typeIcon[tx.type] ?? ArrowUpRight;
  const variant = statusVariant[tx.status] ?? "outline";

  return (
    <div className="flex items-center gap-4 rounded-lg border p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{tx.productName}</p>
        <p className="text-xs text-muted-foreground">
          {formatTimeAgo(tx.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {tx.type === TransactionType.FUND ? "+" : "-"}${Number(tx.amountUsdc).toFixed(2)}
        </span>
        <Badge variant={variant} className="text-[10px]">
          {tx.status}
        </Badge>
      </div>
    </div>
  );
}

function RecentTransactions() {
  const { data, isLoading } = api.transaction.list.useQuery(
    { limit: 5 },
    { refetchInterval: 2000 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        {data?.items.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No transactions yet
          </p>
        )}
        {data?.items.map((tx) => <TransactionCard key={tx.id} tx={tx} />)}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Wallet Overview</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <BalanceCard />
        <WalletAddressCard />
      </div>
      <FundingGuide />
      <RecentTransactions />
    </div>
  );
}
