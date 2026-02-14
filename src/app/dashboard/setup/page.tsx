import { api, HydrateClient } from "~/trpc/server";
import { SetupContent } from "./_components/setup-content";

export const metadata = { title: "Setup" };

export default async function SetupPage() {
  void api.agent.list.prefetch();

  return (
    <HydrateClient>
      <SetupContent />
    </HydrateClient>
  );
}
