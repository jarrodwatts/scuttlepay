"use client";

import { TRPCReactProvider } from "~/trpc/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <TRPCReactProvider>{children}</TRPCReactProvider>;
}
