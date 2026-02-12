"use client";

import { ExternalLink } from "lucide-react";
import { TransactionStatus, TransactionType } from "@scuttlepay/shared";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

type Transaction = RouterOutputs["transaction"]["list"]["items"][number];

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

function formatAbsoluteTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const statusVariant: Record<
  TransactionStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  [TransactionStatus.PENDING]: "outline",
  [TransactionStatus.SETTLING]: "secondary",
  [TransactionStatus.SETTLED]: "default",
  [TransactionStatus.FAILED]: "destructive",
};

const statusClassName: Record<TransactionStatus, string> = {
  [TransactionStatus.PENDING]: "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400",
  [TransactionStatus.SETTLING]: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  [TransactionStatus.SETTLED]: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  [TransactionStatus.FAILED]: "",
};

function truncateTxHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function extractStoreName(storeUrl: string): string {
  try {
    const hostname = new URL(storeUrl).hostname;
    return hostname.replace(/^www\./, "").replace(/\.myshopify\.com$/, "");
  } catch {
    return storeUrl;
  }
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  return (
    <Badge
      variant={statusVariant[status]}
      className={statusClassName[status]}
    >
      {status}
    </Badge>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const sign = tx.type === TransactionType.FUND ? "+" : "-";

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm">{formatTimeAgo(tx.createdAt)}</span>
          <span className="text-xs text-muted-foreground">
            {formatAbsoluteTime(tx.createdAt)}
          </span>
        </div>
      </TableCell>
      <TableCell className="font-medium">{tx.productName}</TableCell>
      <TableCell className="text-muted-foreground">
        {extractStoreName(tx.storeUrl)}
      </TableCell>
      <TableCell className="font-mono">
        {sign}${Number(tx.amountUsdc).toFixed(2)}
      </TableCell>
      <TableCell>
        <StatusBadge status={tx.status} />
      </TableCell>
      <TableCell>
        {tx.txHash ? (
          <a
            href={`https://sepolia.basescan.org/tx/${tx.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            {truncateTxHash(tx.txHash)}
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 6 }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export default function TransactionsPage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.transaction.list.useInfiniteQuery(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        refetchInterval: 2000,
      },
    );

  const transactions = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Store</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tx Hash</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton />}
          {!isLoading && transactions.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center">
                <p className="text-muted-foreground">
                  No transactions yet. Set up your agent to get started.
                </p>
              </TableCell>
            </TableRow>
          )}
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </TableBody>
      </Table>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
