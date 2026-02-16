import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";

interface PageProps {
  searchParams: Promise<{ shop?: string }>;
}

export default async function MerchantInstalledPage({ searchParams }: PageProps) {
  const { shop } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-6 flex size-16 items-center justify-center border border-accent/30 bg-accent/10">
        <CheckCircle2 className="size-8 text-accent" />
      </div>

      <h1 className="mb-4 text-3xl font-black uppercase tracking-tight">
        You&rsquo;re live
      </h1>

      <p className="mb-2 text-lg text-muted-foreground">
        ScuttlePay is now installed on{" "}
        {shop ? (
          <span className="font-mono text-foreground">{shop}</span>
        ) : (
          "your store"
        )}
        .
      </p>

      <p className="mb-8 text-muted-foreground">
        AI agents can now discover and purchase products from your store.
        Orders will appear in your Shopify admin with transaction details.
      </p>

      <div className="flex gap-4">
        <Button asChild variant="accent" size="lg">
          <Link href="/">
            Back to ScuttlePay
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}
