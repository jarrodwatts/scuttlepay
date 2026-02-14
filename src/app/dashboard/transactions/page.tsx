import { HydrateClient } from "~/trpc/server";
import { TransactionsContent } from "./_components/transactions-content";

export const metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return (
    <HydrateClient>
      <TransactionsContent />
    </HydrateClient>
  );
}
