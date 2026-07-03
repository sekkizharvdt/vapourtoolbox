---
description: Lint (scoped to changed files when possible — whole-app next lint can OOM), auto-fix, show remaining issues only.
---

# Lint

Run linting and fix issues. Two constraints: whole-app `next lint` has OOM'd before — prefer scoping to changed files; and show only problems, not passing output.

## Steps

1. Preferred — lint only the files changed this session:

   ```bash
   pnpm --filter @vapour/web exec eslint <changed files, repo-relative> 2>&1 | head -40
   ```

   Get the file list from `git diff --name-only HEAD -- 'apps/web/**/*.ts' 'apps/web/**/*.tsx'`.

2. Whole-app run (only when needed, e.g. after a config change):

   ```bash
   pnpm --filter @vapour/web run lint 2>&1 | grep -vE "^$|✔|warning  .*(deprecated)" | head -50
   ```

   If this OOMs, fall back to step 1 in directory batches.

3. If there are auto-fixable issues, run:

   ```bash
   pnpm --filter @vapour/web run lint:fix 2>&1 | tail -10
   ```

4. For remaining issues that can't be auto-fixed:
   - Read the file with the error
   - Fix the issue manually following the ESLint rule
   - Common rules in this codebase:
     - `@typescript-eslint/consistent-type-assertions` - Use `docToTyped` helper instead of `as Type`
     - `@typescript-eslint/no-unused-vars` - Remove or use the variable
     - `react-hooks/exhaustive-deps` - Add missing dependencies to useEffect

5. Re-run (scoped) until clean. Report "lint clean" in one line plus what was fixed.
