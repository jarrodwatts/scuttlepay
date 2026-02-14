import { TransactionStatus } from "@scuttlepay/shared";

export const statusVariant: Record<
  TransactionStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  [TransactionStatus.PENDING]: "outline",
  [TransactionStatus.SETTLING]: "secondary",
  [TransactionStatus.SETTLED]: "default",
  [TransactionStatus.FAILED]: "destructive",
};

export const statusClassName: Record<TransactionStatus, string> = {
  [TransactionStatus.PENDING]: "text-muted-foreground border-border",
  [TransactionStatus.SETTLING]: "text-foreground border-foreground/20",
  [TransactionStatus.SETTLED]: "bg-accent/10 text-accent border-accent/30",
  [TransactionStatus.FAILED]: "",
};
