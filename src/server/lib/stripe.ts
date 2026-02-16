import Stripe from "stripe";
import { env } from "~/env";

let _stripe: Stripe | undefined;

export function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  _stripe ??= new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-01-28.clover",
  });
  return _stripe;
}
