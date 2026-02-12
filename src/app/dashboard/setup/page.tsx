"use client";

import { useState } from "react";
import { Copy, Check, Eye, EyeOff, RotateCcw } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

function useCopy() {
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return { copied, copy };
}

function maskKey(prefix: string) {
  return `${prefix}${"•".repeat(36)}`;
}

function ApiKeyCard() {
  const utils = api.useUtils();
  const { data, isLoading } = api.apiKey.get.useQuery();
  const createKey = api.apiKey.create.useMutation({
    onSuccess: (result) => {
      setRevealedKey(result.raw);
      void utils.apiKey.get.invalidate();
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

  const hasKey = !!data;
  const displayKey = revealedKey
    ? revealed
      ? revealedKey
      : maskKey(revealedKey.slice(0, 12))
    : data
      ? maskKey(data.keyPrefix)
      : null;

  function handleGenerate() {
    setRevealedKey(null);
    setRevealed(false);
    createKey.mutate();
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
            <code className="rounded bg-muted px-3 py-2 text-sm break-all">
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
                    <Check className="size-3.5 text-green-600" />
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
            disabled={createKey.isPending}
          >
            <RotateCcw className="mr-2 size-3.5" />
            {hasKey ? "Rotate Key" : "Generate Key"}
          </Button>
          {hasKey && !revealedKey && (
            <p className="mt-2 text-xs text-muted-foreground">
              Rotating will invalidate your current key.
            </p>
          )}
          {revealedKey && (
            <p className="mt-2 text-xs text-amber-600">
              Copy this key now — it won&apos;t be shown again.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function McpConfigCard() {
  const { data } = api.apiKey.get.useQuery();
  const configCopy = useCopy();

  const apiUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/trpc`
      : "https://your-app.vercel.app/api/trpc";

  const config = JSON.stringify(
    {
      mcpServers: {
        scuttlepay: {
          command: "npx",
          args: ["-y", "@scuttlepay/mcp"],
          env: {
            SCUTTLEPAY_API_KEY: data?.keyPrefix
              ? `${data.keyPrefix}...`
              : "sk_test_YOUR_KEY_HERE",
            SCUTTLEPAY_API_URL: apiUrl,
          },
        },
      },
    },
    null,
    2,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP Configuration</CardTitle>
        <CardDescription>
          Add this to your Claude Code MCP config to connect your agent.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <pre className="overflow-x-auto rounded bg-muted p-4 text-xs leading-relaxed">
            {config}
          </pre>
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-2 right-2"
            onClick={() => configCopy.copy(config)}
            aria-label="Copy MCP config"
          >
            {configCopy.copied ? (
              <Check className="size-3.5 text-green-600" />
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
    title: "Add MCP config to Claude Code",
    description:
      "Copy the config snippet above and add it to your Claude Code MCP settings.",
  },
  {
    step: 3,
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
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
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

function SystemPromptCard() {
  const promptCopy = useCopy();

  const prompt =
    "You have access to ScuttlePay tools for shopping. Use search_products to browse, get_balance to check funds, and buy to make purchases.";

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Prompt Suggestion</CardTitle>
        <CardDescription>
          Add this to your agent&apos;s system prompt so it knows about
          ScuttlePay.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <blockquote className="rounded bg-muted p-4 text-sm italic leading-relaxed">
            {prompt}
          </blockquote>
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-2 right-2"
            onClick={() => promptCopy.copy(prompt)}
            aria-label="Copy system prompt"
          >
            {promptCopy.copied ? (
              <Check className="size-3.5 text-green-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NpmPackageLink() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>npm Package</CardTitle>
        <CardDescription>
          The MCP server is available as an npm package.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <a
          href="https://www.npmjs.com/package/@scuttlepay/mcp"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
        >
          @scuttlepay/mcp on npm
        </a>
      </CardContent>
    </Card>
  );
}

export default function SetupPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Agent Setup</h1>
      <ApiKeyCard />
      <McpConfigCard />
      <QuickStartCard />
      <SystemPromptCard />
      <NpmPackageLink />
    </div>
  );
}
