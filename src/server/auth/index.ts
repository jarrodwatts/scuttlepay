import { createAuth } from "thirdweb/auth";
import { privateKeyToAccount } from "thirdweb/wallets";
import { cookies } from "next/headers";
import { cache } from "react";
import { eq } from "drizzle-orm";

import { getThirdwebClient } from "~/server/lib/thirdweb";
import { env } from "~/env";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

export interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
  walletAddress: string;
}

let _thirdwebAuth: ReturnType<typeof createAuth> | null = null;

export function getThirdwebAuth() {
  _thirdwebAuth ??= createAuth({
    domain: env.NEXT_PUBLIC_THIRDWEB_AUTH_DOMAIN,
    adminAccount: privateKeyToAccount({
      client: getThirdwebClient(),
      privateKey: env.THIRDWEB_AUTH_PRIVATE_KEY,
    }),
    client: getThirdwebClient(),
  });
  return _thirdwebAuth;
}

async function _getAuthUser(): Promise<AuthUser | null> {
  const c = await cookies();
  const jwt = c.get("jwt");
  if (!jwt?.value) return null;

  const result = await getThirdwebAuth().verifyJWT({ jwt: jwt.value });
  if (!result.valid) return null;

  const walletAddress = result.parsedJWT.sub;
  if (!walletAddress) return null;

  const user = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.thirdwebUserId, walletAddress))
    .limit(1)
    .then((rows) => rows[0]);

  if (!user) return null;

  return { ...user, walletAddress };
}

export const getAuthUser = cache(_getAuthUser);
