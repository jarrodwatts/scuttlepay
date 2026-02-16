import { eq, and } from "drizzle-orm";
import { db } from "~/server/db";
import { merchants } from "~/server/db/schema/merchant";

export interface Merchant {
  id: string;
  shopDomain: string;
  accessToken: string;
  storefrontToken: string | null;
  scopes: string;
  isActive: boolean;
}

export async function getMerchantByShopDomain(
  domain: string,
): Promise<Merchant | undefined> {
  const row = await db
    .select()
    .from(merchants)
    .where(eq(merchants.shopDomain, domain))
    .limit(1)
    .then((rows) => rows[0]);

  return row ?? undefined;
}

export async function getMerchantById(
  id: string,
): Promise<Merchant | undefined> {
  const row = await db
    .select()
    .from(merchants)
    .where(eq(merchants.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  return row ?? undefined;
}

export async function getActiveMerchantById(
  id: string,
): Promise<Merchant | undefined> {
  const row = await db
    .select()
    .from(merchants)
    .where(and(eq(merchants.id, id), eq(merchants.isActive, true)))
    .limit(1)
    .then((rows) => rows[0]);

  return row ?? undefined;
}

export async function getAllActiveMerchants(): Promise<
  Array<{ id: string; shopDomain: string }>
> {
  return db
    .select({ id: merchants.id, shopDomain: merchants.shopDomain })
    .from(merchants)
    .where(eq(merchants.isActive, true));
}

export async function upsertMerchant(
  shopDomain: string,
  accessToken: string,
  storefrontToken: string | null,
  scopes: string,
): Promise<Merchant> {
  const existing = await getMerchantByShopDomain(shopDomain);

  if (existing) {
    const [updated] = await db
      .update(merchants)
      .set({
        accessToken,
        storefrontToken,
        scopes,
        isActive: true,
        installedAt: new Date(),
        uninstalledAt: null,
      })
      .where(eq(merchants.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error(`Failed to update merchant ${shopDomain}`);
    }
    return updated;
  }

  const [created] = await db
    .insert(merchants)
    .values({
      shopDomain,
      accessToken,
      storefrontToken,
      scopes,
    })
    .returning();

  if (!created) {
    throw new Error(`Failed to create merchant ${shopDomain}`);
  }
  return created;
}
