import Link from "next/link";

import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  const session = await auth();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight">
            ScuttlePay
          </h1>
          <p className="text-xl text-gray-600">
            A bank account for AI agents
          </p>

          <div className="flex flex-col items-center gap-4">
            <p className="text-lg">
              {session ? (
                <span>Signed in as {session.user?.name}</span>
              ) : (
                <span>Not signed in</span>
              )}
            </p>
            <Link
              href={session ? "/api/auth/signout" : "/api/auth/signin"}
              className="rounded-full bg-black px-10 py-3 font-semibold text-white no-underline transition hover:bg-gray-800"
            >
              {session ? "Sign out" : "Sign in"}
            </Link>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
