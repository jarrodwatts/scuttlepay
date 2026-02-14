"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import type {
  GenerateLoginPayloadParams,
  VerifyLoginPayloadParams,
} from "thirdweb/auth";

import { getThirdwebAuth } from "./index";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { createWalletForUser } from "~/server/services/wallet.service";

export async function generatePayload(params: GenerateLoginPayloadParams) {
  return getThirdwebAuth().generatePayload(params);
}

export async function login(params: VerifyLoginPayloadParams) {
  const verifiedPayload = await getThirdwebAuth().verifyPayload(params);
  if (!verifiedPayload.valid) {
    throw new Error("Invalid login payload");
  }

  const walletAddress = verifiedPayload.payload.address;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.thirdwebUserId, walletAddress))
    .limit(1)
    .then((rows) => rows[0]);

  let userId: string;

  if (existing) {
    userId = existing.id;
  } else {
    const [newUser] = await db
      .insert(users)
      .values({ thirdwebUserId: walletAddress })
      .returning({ id: users.id });
    if (!newUser) throw new Error("Failed to create user");
    userId = newUser.id;
  }

  await createWalletForUser(userId);

  const jwt = await getThirdwebAuth().generateJWT({
    payload: verifiedPayload.payload,
  });

  const c = await cookies();
  c.set("jwt", jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function isLoggedIn() {
  const c = await cookies();
  const jwt = c.get("jwt");
  if (!jwt?.value) return false;

  const result = await getThirdwebAuth().verifyJWT({ jwt: jwt.value });
  return result.valid;
}

export async function logout() {
  const c = await cookies();
  c.delete("jwt");
}
