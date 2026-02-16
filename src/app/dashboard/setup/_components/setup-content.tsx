"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Eye, EyeOff, Plus } from "lucide-react";

import { api } from "~/trpc/react";
import { useCopy } from "~/hooks/use-copy";
import { maskKey } from "~/lib/format";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

function AgentKeyCard() {
  const utils = api.useUtils();
  const { data: agents, isLoading } = api.agent.list.useQuery();
  const createAgent = api.agent.create.useMutation({
    onSuccess: (result) => {
      setRevealedKey(result.raw);
      void utils.agent.list.invalidate();
    },
  });

  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const keyCopy = useCopy();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>API Key</CardDescription>
          <Skeleton className="h-6 w-full max-w-md" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-48" />
        </CardContent>
      </Card>
    );
  }

  const latestAgent = agents?.[0];
  const hasKey = !!latestAgent;
  const displayKey = revealedKey
    ? revealed
      ? revealedKey
      : maskKey(revealedKey.slice(0, 12))
    : latestAgent
      ? maskKey(latestAgent.keyPrefix)
      : null;

  function handleGenerate() {
    setRevealedKey(null);
    setRevealed(false);
    createAgent.mutate({
      name: "default-agent",
      maxPerTx: "10",
      dailyLimit: "50",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Key</CardTitle>
        <CardDescription>
          {hasKey
            ? "Your key is shown below. The full key is only visible immediately after creation."
            : "Generate an API key to connect your agent."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {displayKey && (
          <div className="flex items-center gap-2">
            <code className="border border-border bg-muted px-3 py-2 font-mono text-sm break-all">
              {displayKey}
            </code>
            {revealedKey && (
              <>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setRevealed(!revealed)}
                  aria-label={revealed ? "Hide API key" : "Reveal API key"}
                >
                  {revealed ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => keyCopy.copy(revealedKey)}
                  aria-label="Copy API key"
                >
                  {keyCopy.copied ? (
                    <Check className="size-3.5 text-accent" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </>
            )}
          </div>
        )}
        <div>
          <Button
            variant={hasKey ? "outline" : "default"}
            size="sm"
            onClick={handleGenerate}
            disabled={createAgent.isPending}
          >
            <Plus className="mr-2 size-3.5" />
            {hasKey ? "Create Another Agent" : "Create Agent"}
          </Button>
          {revealedKey && (
            <p className="mt-2 text-xs text-accent">
              Copy this key now — it won&apos;t be shown again.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ApiConfigCard() {
  const { data: agents } = api.agent.list.useQuery();
  const envCopy = useCopy();
  const latestAgent = agents?.[0];

  const [apiUrl, setApiUrl] = useState("https://your-app.vercel.app");
  useEffect(() => {
    setApiUrl(window.location.origin);
  }, []);

  const keyPlaceholder = latestAgent?.keyPrefix
    ? `${latestAgent.keyPrefix}...`
    : "sk_YOUR_KEY_HERE";

  const envBlock = `SCUTTLEPAY_API_KEY=${keyPlaceholder}\nSCUTTLEPAY_API_URL=${apiUrl}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Environment Variables</CardTitle>
        <CardDescription>
          Set these in your agent&apos;s environment. All API requests require
          the key as a Bearer token.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <pre className="overflow-x-auto border border-border bg-muted p-4 font-mono text-xs leading-relaxed">
            {envBlock}
          </pre>
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-2 right-2"
            onClick={() => envCopy.copy(envBlock)}
            aria-label="Copy environment variables"
          >
            {envCopy.copied ? (
              <Check className="size-3.5 text-accent" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/mcp/wallet",
    description: "Check balance and wallet info",
  },
  {
    method: "GET",
    path: "/api/mcp/merchants",
    description: "List available merchants",
  },
  {
    method: "GET",
    path: "/api/mcp/products",
    description: "Search products (use ?merchantId=...&q=...)",
  },
  {
    method: "POST",
    path: "/api/mcp/purchase",
    description: "Buy a product with USDC",
  },
  {
    method: "GET",
    path: "/api/mcp/transactions",
    description: "View transaction history",
  },
] as const;

function ApiEndpointsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>REST API</CardTitle>
        <CardDescription>
          Your agent calls these endpoints with the API key as a Bearer token.
          Works with any HTTP client.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {API_ENDPOINTS.map(({ method, path, description }) => (
            <div key={path} className="flex items-baseline gap-3">
              <code className="shrink-0 border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                {method}
              </code>
              <code className="shrink-0 font-mono text-xs text-accent">
                {path}
              </code>
              <span className="text-xs text-muted-foreground">
                {description}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SystemPromptCard() {
  const promptCopy = useCopy();

  const [apiUrl, setApiUrl] = useState("https://your-app.vercel.app");
  useEffect(() => {
    setApiUrl(window.location.origin);
  }, []);

  const prompt = `You have access to a ScuttlePay wallet for making USDC purchases on behalf of the user.

API base URL: ${apiUrl}
Auth: pass the SCUTTLEPAY_API_KEY environment variable as a Bearer token on every request.

Available endpoints:
- GET /api/mcp/wallet — check your balance
- GET /api/mcp/merchants — list available stores
- GET /api/mcp/products?merchantId=<id>&q=<query> — search products
- GET /api/mcp/products?merchantId=<id>&id=<productId> — get product details and variants
- POST /api/mcp/purchase — buy a product (body: { merchantId, productId, variantId?, quantity? })
- GET /api/mcp/transactions — view transaction history

All USDC amounts are strings (e.g. "25.00"). Always confirm with the user before making a purchase.`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Prompt</CardTitle>
        <CardDescription>
          Add this to your agent&apos;s system prompt so it knows how to use the
          ScuttlePay API.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <pre className="overflow-x-auto border border-border bg-muted p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {prompt}
          </pre>
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-2 right-2"
            onClick={() => promptCopy.copy(prompt)}
            aria-label="Copy system prompt"
          >
            {promptCopy.copied ? (
              <Check className="size-3.5 text-accent" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const QUICK_START_STEPS = [
  {
    step: 1,
    title: "Generate & copy your API key",
    description: "Use the card above to create a key, then copy it.",
  },
  {
    step: 2,
    title: "Add the system prompt to your agent",
    description:
      "Copy the system prompt below and add it to your agent's instructions.",
  },
  {
    step: 3,
    title: "Set environment variables",
    description:
      "Set SCUTTLEPAY_API_KEY and SCUTTLEPAY_API_URL in your agent's environment.",
  },
  {
    step: 4,
    title: "Ask your agent to buy something",
    description:
      'Try: "Search for headphones under $50 and buy the best one."',
  },
] as const;

function QuickStartCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Start</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-4">
          {QUICK_START_STEPS.map(({ step, title, description }) => (
            <li key={step} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center border border-border font-mono text-xs">
                {step}
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function SetupContent() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-black uppercase tracking-tight">
        Agent Setup
      </h1>
      <AgentKeyCard />
      <QuickStartCard />
      <ApiConfigCard />
      <SystemPromptCard />
      <ApiEndpointsCard />
    </div>
  );
}
