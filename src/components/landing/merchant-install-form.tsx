"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export function MerchantInstallForm() {
  const [shop, setShop] = useState("");
  const [loading, setLoading] = useState(false);

  const trimmed = shop.trim();
  const isValid = trimmed.length > 0;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid || loading) return;

    setLoading(true);
    const domain = trimmed.toLowerCase();
    const normalized = domain.endsWith(".myshopify.com")
      ? domain
      : `${domain}.myshopify.com`;

    window.location.href = `/api/shopify/auth?shop=${encodeURIComponent(normalized)}`;
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md gap-3">
      <Input
        placeholder="your-store.myshopify.com"
        value={shop}
        onChange={(e) => setShop(e.target.value)}
        disabled={loading}
        className="flex-1"
      />
      <Button
        type="submit"
        variant="accent"
        size="default"
        disabled={!isValid || loading}
      >
        {loading ? (
          <>
            Redirecting
            <Loader2 className="size-4 animate-spin" />
          </>
        ) : (
          <>
            Install on Shopify
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  );
}
