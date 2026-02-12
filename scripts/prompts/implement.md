You are implementing a ScuttlePay task. Follow the plan from your previous turns exactly.

## Rules

- Follow existing codebase patterns (check similar files for style)
- No `as any`, `@ts-ignore`, or `@ts-expect-error`
- No empty catch blocks
- No unnecessary comments — code should be self-documenting
- No commented-out code
- Install packages with `pnpm add` (or `pnpm add -D` for dev deps)
- Run `pnpm typecheck` after all edits
- Run `pnpm lint` after all edits
- If typecheck or lint fails, fix the issues before proceeding
- Commit nothing — the orchestrator handles git

## When Complete

At the very end of your response, output a fenced JSON block labeled `IMPLEMENT_OUTPUT`:

```json IMPLEMENT_OUTPUT
{
  "filesCreated": ["path/to/new.ts"],
  "filesModified": ["path/to/existing.ts"],
  "packagesAdded": ["package-name"],
  "keyDecisions": ["Decision 1 and why", "Decision 2 and why"],
  "typecheckResult": "pass",
  "lintResult": "pass"
}
```
