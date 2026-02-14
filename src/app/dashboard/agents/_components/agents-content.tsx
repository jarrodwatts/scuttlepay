"use client";

import { useState } from "react";
import { Copy, Check, Eye, EyeOff, Plus, Trash2, RotateCcw } from "lucide-react";

import { api } from "~/trpc/react";
import { useCopy } from "~/hooks/use-copy";
import { maskKey } from "~/lib/format";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

function CreateAgentForm({ onCreated }: { onCreated: (raw: string) => void }) {
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [maxPerTx, setMaxPerTx] = useState("10");
  const [dailyLimit, setDailyLimit] = useState("50");

  const createAgent = api.agent.create.useMutation({
    onSuccess: (result) => {
      onCreated(result.raw);
      setName("");
      void utils.agent.list.invalidate();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        createAgent.mutate({ name: name.trim(), maxPerTx, dailyLimit });
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agent-name">Agent Name</Label>
          <Input
            id="agent-name"
            placeholder="e.g. shopping-bot"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="max-per-tx">Max per Transaction ($)</Label>
          <Input
            id="max-per-tx"
            type="number"
            step="0.01"
            min="0.01"
            value={maxPerTx}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxPerTx(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="daily-limit">Daily Limit ($)</Label>
          <Input
            id="daily-limit"
            type="number"
            step="0.01"
            min="0.01"
            value={dailyLimit}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDailyLimit(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Button type="submit" size="sm" disabled={createAgent.isPending}>
          <Plus className="mr-2 size-3.5" />
          Create Agent
        </Button>
      </div>
    </form>
  );
}

function RevealedKeyBanner({
  raw,
  onDismiss,
}: {
  raw: string;
  onDismiss: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const keyCopy = useCopy();

  return (
    <Card className="border-accent bg-accent/5">
      <CardContent className="flex flex-col gap-2 pt-4">
        <p className="text-sm font-medium text-accent">
          Copy this API key now — it won&apos;t be shown again.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 border border-border bg-muted px-3 py-2 font-mono text-sm break-all">
            {revealed ? raw : maskKey(raw.slice(0, 12))}
          </code>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setRevealed(!revealed)}
            aria-label={revealed ? "Hide" : "Reveal"}
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
            onClick={() => keyCopy.copy(raw)}
            aria-label="Copy"
          >
            {keyCopy.copied ? (
              <Check className="size-3.5 text-accent" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={onDismiss}
        >
          Dismiss
        </Button>
      </CardContent>
    </Card>
  );
}

function AgentRow({
  agent,
}: {
  agent: {
    id: string;
    name: string;
    keyPrefix: string;
    lastUsedAt: string | null;
    createdAt: string;
    spendingPolicy: { maxPerTx: string; dailyLimit: string } | null;
  };
}) {
  const utils = api.useUtils();
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);
  const [rotatedRevealed, setRotatedRevealed] = useState(false);
  const keyCopy = useCopy();

  const revokeAgent = api.agent.revoke.useMutation({
    onSuccess: () => void utils.agent.list.invalidate(),
  });

  const rotateKey = api.agent.rotateKey.useMutation({
    onSuccess: (result) => {
      setRotatedKey(result.raw);
      void utils.agent.list.invalidate();
    },
  });

  return (
    <div className="flex flex-col gap-3 border-b border-border p-4 last:border-b-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{agent.name}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {agent.keyPrefix}{"\u2022".repeat(12)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => rotateKey.mutate({ agentId: agent.id })}
            disabled={rotateKey.isPending}
            aria-label="Rotate key"
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => revokeAgent.mutate({ agentId: agent.id })}
            disabled={revokeAgent.isPending}
            aria-label="Revoke agent"
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {rotatedKey && (
        <div className="flex items-center gap-2 border border-accent/30 bg-accent/5 p-2">
          <code className="flex-1 font-mono text-xs break-all">
            {rotatedRevealed ? rotatedKey : maskKey(rotatedKey.slice(0, 12))}
          </code>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setRotatedRevealed(!rotatedRevealed)}
            aria-label={rotatedRevealed ? "Hide key" : "Reveal key"}
          >
            {rotatedRevealed ? (
              <EyeOff className="size-3" />
            ) : (
              <Eye className="size-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => keyCopy.copy(rotatedKey)}
            aria-label="Copy key"
          >
            {keyCopy.copied ? (
              <Check className="size-3 text-accent" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
        </div>
      )}

      <div className="flex gap-6 font-mono text-xs text-muted-foreground">
        {agent.spendingPolicy && (
          <>
            <span>${agent.spendingPolicy.maxPerTx}/tx</span>
            <span>${agent.spendingPolicy.dailyLimit}/day</span>
          </>
        )}
        <span>
          Created {new Date(agent.createdAt).toLocaleDateString()}
        </span>
        {agent.lastUsedAt && (
          <span>
            Last used {new Date(agent.lastUsedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

export function AgentsContent() {
  const { data: agents, isLoading } = api.agent.list.useQuery();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-black uppercase tracking-tight">Agents</h1>

      {revealedKey && (
        <RevealedKeyBanner
          raw={revealedKey}
          onDismiss={() => setRevealedKey(null)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create Agent</CardTitle>
          <CardDescription>
            Each agent gets an API key and its own spending limits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateAgentForm onCreated={setRevealedKey} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Agents</CardTitle>
          <CardDescription>
            {agents?.length
              ? `${agents.length} active agent${agents.length > 1 ? "s" : ""}`
              : "No agents yet"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : agents?.length ? (
            agents.map((agent) => <AgentRow key={agent.id} agent={agent} />)
          ) : (
            <p className="text-sm text-muted-foreground">
              Create your first agent above to get started.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
