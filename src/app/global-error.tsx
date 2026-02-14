"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#000", color: "#f5f5f5" }}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-xl font-bold uppercase tracking-tight">
            Something went wrong
          </h2>
          <p className="text-sm" style={{ color: "#737373" }}>
            An unexpected error occurred.
          </p>
          <button
            onClick={reset}
            className="border px-4 py-2 text-sm font-medium hover:bg-white/10"
            style={{ borderColor: "#262626" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
