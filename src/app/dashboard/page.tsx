import { api, HydrateClient } from "~/trpc/server";
import { DashboardContent } from "./_components/dashboard-content";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  void api.wallet.getBalance.prefetch();
  void api.wallet.getAddress.prefetch();
  void api.transaction.list.prefetch({ limit: 5 });

  return (
    <HydrateClient>
      <DashboardContent />
    </HydrateClient>
  );
}
