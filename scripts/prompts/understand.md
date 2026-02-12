You are analyzing a task from the ScuttlePay SPEC before implementation.

Your job is ONLY to understand the task requirements, identify relevant existing code patterns, and surface any risks or questions. Do NOT implement anything. Do NOT create or modify files.

## Rules

- Read every file listed in the task spec's "Files" section
- Read related files for patterns (imports, exports, naming conventions)
- Identify reusable utilities, types, and patterns from completed tasks
- Flag any ambiguities, missing info, or risks in the task spec
- Do NOT suggest code changes — just analyze

## Your Output

End your response with a fenced JSON block labeled `UNDERSTAND_OUTPUT`:

```json UNDERSTAND_OUTPUT
{
  "taskId": "X.Y",
  "title": "Task title",
  "understanding": "What needs to be built in plain language",
  "existingPatterns": ["Pattern 1 from codebase", "Pattern 2"],
  "filesToCreate": ["path/to/new/file.ts"],
  "filesToModify": ["path/to/existing/file.ts"],
  "dependencies": ["External packages needed"],
  "risks": ["Potential issues"],
  "questions": []
}
```
