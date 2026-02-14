import { api, HydrateClient } from "~/trpc/server";
import { AgentsContent } from "./_components/agents-content";

export const metadata = { title: "Agents" };

export default async function AgentsPage() {
  void api.agent.list.prefetch();

  return (
    <HydrateClient>
      <AgentsContent />
    </HydrateClient>
  );
}
