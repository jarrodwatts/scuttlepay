import { USDC_DECIMALS } from "@scuttlepay/shared";

const SCALE = BigInt(10 ** USDC_DECIMALS);

export function parseUsdc(amount: string): bigint {
  const parts = amount.split(".");
  const whole = parts[0] ?? "0";
  const frac = (parts[1] ?? "").padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
  return BigInt(whole) * SCALE + BigInt(frac);
}

export function formatUsdc(raw: bigint): string {
  const whole = raw / SCALE;
  const frac = raw % SCALE;
  const fracStr = frac.toString().padStart(USDC_DECIMALS, "0");
  return `${whole.toString()}.${fracStr}`;
}

export function multiplyUsdc(unitPrice: string, quantity: number): string {
  const totalRaw = parseUsdc(unitPrice) * BigInt(quantity);
  return formatUsdc(totalRaw);
}

export function compareUsdc(a: string, b: string): number {
  const diff = parseUsdc(a) - parseUsdc(b);
  if (diff < 0n) return -1;
  if (diff > 0n) return 1;
  return 0;
}

export function addUsdc(a: string, b: string): string {
  return formatUsdc(parseUsdc(a) + parseUsdc(b));
}

export function isPositiveUsdc(amount: string): boolean {
  return parseUsdc(amount) > 0n;
}
