"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, ArrowLeftRight, Bot, Settings } from "lucide-react";

import { cn } from "~/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Wallet", icon: Wallet },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/dashboard/setup", label: "Setup", icon: Settings },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col divide-y divide-sidebar-border">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-6 py-3 font-mono text-xs uppercase tracking-wider transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive &&
                "border-l-2 border-accent bg-sidebar-accent text-sidebar-accent-foreground",
              !isActive && "text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
