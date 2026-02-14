"use client";

import { ThirdwebProvider } from "thirdweb/react";

export function ThirdwebWrapper({ children }: { children: React.ReactNode }) {
  return <ThirdwebProvider>{children}</ThirdwebProvider>;
}
