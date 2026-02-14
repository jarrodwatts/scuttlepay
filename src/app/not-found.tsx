import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-8xl font-black uppercase">404</h1>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Page not found
      </p>
      <Link
        href="/"
        className="font-mono text-sm text-accent underline underline-offset-4 hover:text-accent/80"
      >
        Go home
      </Link>
    </div>
  );
}
