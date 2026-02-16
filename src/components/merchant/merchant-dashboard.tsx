"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Package, ShoppingCart, DollarSign, ExternalLink } from "lucide-react";

import { useAppBridge } from "~/components/merchant/app-bridge-provider";
import { BLOCK_EXPLORER_URL } from "~/lib/chain-config";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";

interface Stats {
  totalOrders: number;
  totalRevenue: string;
  productCount: number;
}

interface Product {
  id: string;
  title: string;
  description: string;
  priceUsdc: string;
  imageUrl: string | null;
}

interface Order {
  id: string;
  productName: string;
  quantity: number;
  totalUsdc: string;
  status: string;
  shopifyOrderNumber: string | null;
  createdAt: string;
  txHash: string | null;
}

function useMerchantFetch<T>(path: string) {
  const { sessionToken, ready } = useAppBridge();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch(path, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) return;
      const json = (await res.json()) as { data: T };
      setData(json.data);
    } catch (err) {
      console.error(`[MerchantDashboard] Failed to fetch ${path}`, err);
    } finally {
      setLoading(false);
    }
  }, [sessionToken, path]);

  useEffect(() => {
    if (ready) void fetchData();
  }, [ready, fetchData]);

  return { data, loading };
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className="flex size-10 items-center justify-center border border-accent/30 bg-accent/10">
          <Icon className="size-5 text-accent" />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-black tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsRow({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent>
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Products live"
        value={String(stats?.productCount ?? 0)}
        icon={Package}
      />
      <StatCard
        label="AI agent orders"
        value={String(stats?.totalOrders ?? 0)}
        icon={ShoppingCart}
      />
      <StatCard
        label="Revenue (USDC)"
        value={`$${Number(stats?.totalRevenue ?? 0).toFixed(2)}`}
        icon={DollarSign}
      />
    </div>
  );
}

function ProductGrid({
  products,
  loading,
}: {
  products: Product[] | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!products?.length) {
    return (
      <p className="py-8 text-center font-mono text-sm text-muted-foreground">
        No products found. Products from your Shopify store will appear here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <div
          key={product.id}
          className="flex items-start gap-3 border border-border bg-card p-4"
        >
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt=""
              width={48}
              height={48}
              className="size-12 shrink-0 border border-border object-cover"
            />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center border border-border bg-muted">
              <Package className="size-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{product.title}</p>
            <p className="font-mono text-xs text-accent">
              ${Number(product.priceUsdc).toFixed(2)} USDC
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function statusVariant(status: string) {
  switch (status) {
    case "confirmed":
    case "completed":
      return "default" as const;
    case "pending":
      return "secondary" as const;
    case "failed":
    case "cancelled":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function OrdersTable({
  orders,
  loading,
}: {
  orders: Order[] | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!orders?.length) {
    return (
      <p className="py-8 text-center font-mono text-sm text-muted-foreground">
        No orders yet. AI agent purchases will appear here.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Order #</TableHead>
          <TableHead>Tx</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="max-w-[200px] truncate font-medium">
              {order.productName}
            </TableCell>
            <TableCell>{order.quantity}</TableCell>
            <TableCell className="font-mono">
              ${Number(order.totalUsdc).toFixed(2)}
            </TableCell>
            <TableCell>
              <Badge variant={statusVariant(order.status)}>
                {order.status}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">
              {order.shopifyOrderNumber ?? "-"}
            </TableCell>
            <TableCell>
              {order.txHash ? (
                <a
                  href={`${BLOCK_EXPLORER_URL}/tx/${order.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline"
                >
                  {order.txHash.slice(0, 8)}...
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {new Date(order.createdAt).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function MerchantDashboard() {
  const { shop, ready } = useAppBridge();
  const { data: stats, loading: statsLoading } = useMerchantFetch<Stats>("/api/merchant/stats");
  const {
    data: productsData,
    loading: productsLoading,
  } = useMerchantFetch<Product[]>("/api/merchant/products");
  const { data: ordersData, loading: ordersLoading } = useMerchantFetch<Order[]>("/api/merchant/orders");

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground animate-pulse">
          Connecting to Shopify...
        </p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight">
            ScuttlePay
          </h1>
          {shop && (
            <p className="font-mono text-xs text-muted-foreground">{shop}</p>
          )}
        </div>
        <Badge variant="outline" className="border-accent/30 text-accent">
          Active
        </Badge>
      </header>

      <StatsRow stats={stats} loading={statsLoading} />

      <Card>
        <CardHeader>
          <CardTitle>Products available to AI agents</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductGrid products={productsData} loading={productsLoading} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent AI agent orders</CardTitle>
        </CardHeader>
        <CardContent>
          <OrdersTable orders={ordersData} loading={ordersLoading} />
        </CardContent>
      </Card>
    </main>
  );
}
