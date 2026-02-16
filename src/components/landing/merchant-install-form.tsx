"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export function MerchantInstallForm() {
  const [shop, setShop] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const domain = shop.trim().toLowerCase();
    if (!domain) return;

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
        className="flex-1"
      />
      <Button type="submit" variant="accent" size="default">
        Install on Shopify
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
