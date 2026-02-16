import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { getAuthUser } from "~/server/auth";
import { ThirdwebWrapper } from "~/components/thirdweb-wrapper";
import { GridCross } from "~/components/ui/grid-cross";
import { SidebarNav } from "./_components/sidebar-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground md:block">
        <GridCross position="top-right" />
        <div className="flex h-14 items-center border-b px-6">
          <Link href="/">
            <Image
              src="/scuttlepay-text.png"
              alt="ScuttlePay"
              width={750}
              height={200}
              className="h-6 w-auto"
              priority
            />
          </Link>
        </div>
        <SidebarNav />
      </aside>
      <main className="flex-1 overflow-y-auto">
        <ThirdwebWrapper>
          <div className="mx-auto max-w-5xl border-x border-border p-6 lg:p-8">
            {children}
          </div>
        </ThirdwebWrapper>
      </main>
    </div>
  );
}
