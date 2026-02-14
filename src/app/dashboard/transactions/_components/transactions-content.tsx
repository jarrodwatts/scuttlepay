"use client";

import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { TransactionType } from "@scuttlepay/shared";
import type { TransactionStatus } from "@scuttlepay/shared";

import { BLOCK_EXPLORER_URL } from "~/lib/chain-config";

import { api, type RouterOutputs } from "~/trpc/react";
import { formatTimeAgo, formatAbsoluteTime, truncateTxHash } from "~/lib/format";
import { statusVariant, statusClassName } from "~/lib/transaction-ui";
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
      <TableCell className="text-muted-foreground">
        {tx.agentName ?? "\u2014"}
      </TableCell>
      <TableCell className="font-medium">{tx.productName ?? "\u2014"}</TableCell>
      <TableCell className="text-muted-foreground">
        {tx.storeUrl ? extractStoreName(tx.storeUrl) : "\u2014"}
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
            href={`${BLOCK_EXPLORER_URL}/tx/${tx.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            {truncateTxHash(tx.txHash)}
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
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
          {Array.from({ length: 7 }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function TransactionsContent() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.transaction.list.useInfiniteQuery(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    );

  const transactions = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data?.pages],
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-black uppercase tracking-tight">Transactions</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Agent</TableHead>
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
              <TableCell colSpan={7} className="h-32 text-center">
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
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
