import { cn } from "~/lib/utils";

const PATTERNS = {
  dots: "\u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7 \u00b7",
  crosshatch:
    "+ \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 + \u00b7 +",
  dither:
    "\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592\u2591\u2591\u2592\u2592",
  binary:
    "01 10 01 11 00 10 01 10 11 00 01 10 01 11 00 10 01 10 11 00 01 10 01 11 00 10 01 10 11 00 01 10 01 11 00 10 01 10 11 00 01 10 01 11 00 10 01 10 11 00 01 10 01 11 00 10 01 10 11 00",
} as const;

function AsciiBand({
  pattern = "dots",
  className,
}: {
  pattern?: keyof typeof PATTERNS;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "overflow-hidden whitespace-nowrap border-y border-border py-1.5 font-mono text-[10px] leading-none text-muted-foreground/30 select-none",
        className,
      )}
    >
      {PATTERNS[pattern]}
    </div>
  );
}

export { AsciiBand };
