import { cn } from "~/lib/utils";

const PATTERNS = {
  dots: "· ",
  crosshatch: "+ · ",
  dither: "░░▒▒",
  binary: "01 10 01 11 00 10 01 10 11 00 ",
} as const;

const REPEAT_COUNT = 200;

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
      {PATTERNS[pattern].repeat(REPEAT_COUNT)}
    </div>
  );
}

export { AsciiBand };
