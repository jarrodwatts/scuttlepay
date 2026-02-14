"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  RotateCcw,
} from "lucide-react";
import dynamic from "next/dynamic";
import { TransactionType } from "@scuttlepay/shared";

import { api, type RouterOutputs } from "~/trpc/react";
import { thirdwebBrowserClient } from "~/lib/thirdweb-client";
import { activeChain, USDC_TOKEN_ADDRESS } from "~/lib/chain-config";
import { formatTimeAgo } from "~/lib/format";
import { statusVariant } from "~/lib/transaction-ui";
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

const BuyWidget = dynamic(
  () => import("thirdweb/react").then((m) => ({ default: m.BuyWidget })),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
);

type Transaction = RouterOutputs["transaction"]["list"]["items"][number];

const typeIcon: Record<TransactionType, typeof ArrowUpRight> = {
  [TransactionType.PURCHASE]: ArrowUpRight,
  [TransactionType.FUND]: ArrowDownRight,
  [TransactionType.REFUND]: RotateCcw,
};

function BalanceCard() {
  const { data, isLoading, isError } = api.wallet.getBalance.useQuery(
    undefined,
    { refetchInterval: 30_000 },
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Available Balance</CardDescription>
          <Skeleton className="h-10 w-48" />
        </CardHeader>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Available Balance</CardDescription>
          <div className="text-lg text-destructive">
            Failed to load balance
          </div>
        </CardHeader>
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
        <div className="font-mono text-4xl font-bold tracking-tight">
          ${formatted}
        </div>
      </CardHeader>
    </Card>
  );
}

function AddFundsCard() {
  const { data: wallet } = api.wallet.getAddress.useQuery();
  const [showWidget, setShowWidget] = useState(false);
  const utils = api.useUtils();

  if (!wallet?.address) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Funds</CardTitle>
        <CardDescription>
          Deposit funds via credit card or crypto transfer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!showWidget ? (
          <Button onClick={() => setShowWidget(true)}>
            <Plus className="mr-2 size-3.5" />
            Add Funds
          </Button>
        ) : (
          <div className="flex flex-col gap-4">
            <BuyWidget
              client={thirdwebBrowserClient}
              chain={activeChain}
              tokenAddress={USDC_TOKEN_ADDRESS}
              receiverAddress={wallet.address}
              title="Add Funds"
              showThirdwebBranding={false}
              presetOptions={[10, 25, 50]}
              theme="dark"
              onSuccess={() => {
                void utils.wallet.getBalance.invalidate();
                setShowWidget(false);
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setShowWidget(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TransactionCard({ tx }: { tx: Transaction }) {
  const Icon = typeIcon[tx.type] ?? ArrowUpRight;
  const variant = statusVariant[tx.status] ?? "outline";

  return (
    <div className="flex items-center gap-4 border-b border-border p-3 last:border-b-0">
      <div className="flex size-9 shrink-0 items-center justify-center border border-border bg-muted">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {tx.productName ?? "Transaction"}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatTimeAgo(tx.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-medium">
          {tx.type === TransactionType.FUND ? "+" : "-"}$
          {Number(tx.amountUsdc).toFixed(2)}
        </span>
        <Badge variant={variant} className="text-[10px]">
          {tx.status}
        </Badge>
      </div>
    </div>
  );
}

function RecentTransactions() {
  const { data, isLoading } = api.transaction.list.useQuery({ limit: 5 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
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

export function DashboardContent() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-black uppercase tracking-tight">
        Dashboard
      </h1>
      <div className="grid gap-0 divide-x md:grid-cols-2">
        <BalanceCard />
        <AddFundsCard />
      </div>
      <RecentTransactions />
    </div>
  );
}
