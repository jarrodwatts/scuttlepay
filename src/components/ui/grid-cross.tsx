import { cn } from "~/lib/utils";

type GridCrossPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

const positionClasses: Record<GridCrossPosition, string> = {
  "top-left": "-top-px -left-px -translate-x-1/2 -translate-y-1/2",
  "top-right": "-top-px -right-px translate-x-1/2 -translate-y-1/2",
  "bottom-left": "-bottom-px -left-px -translate-x-1/2 translate-y-1/2",
  "bottom-right": "-bottom-px -right-px translate-x-1/2 translate-y-1/2",
};

function GridCross({
  position = "top-left",
  className,
}: {
  position?: GridCrossPosition;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute select-none font-mono text-xs leading-none text-muted-foreground/50",
        positionClasses[position],
        className,
      )}
    >
      +
    </span>
  );
}

export { GridCross };
export type { GridCrossPosition };
