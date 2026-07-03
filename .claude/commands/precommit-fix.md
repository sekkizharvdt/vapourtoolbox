---
description: Run the pre-commit hook's checks individually with filtered output and fix findings BEFORE attempting a commit — avoids bounced commits dumping full hook output into context.
---

# Pre-commit Fix

The `.husky/pre-commit` hook runs ~10 checks. A bounced commit floods context with the full hook output, then costs a fix cycle and a second attempt. Instead, run the checks deliberately, filtered to failures only, and fix as you go. Then commit once, clean.

## Steps

Run in this order (cheap → expensive). After each failure, fix it before moving on. Filter output — only failures should enter context.

1. **Type check** (most common failure):

   ```bash
   pnpm exec tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -E "error TS" | head -30
   ```

   No output = pass.

2. **`as any` ban** (hook greps the whole tree, not just staged files):

   ```bash
   grep -rn "as any" apps/web/src --include="*.ts" --include="*.tsx" | head
   ```

3. **Lint-staged equivalent** — lint only files you touched (whole-app `next lint` can OOM):

   ```bash
   pnpm lint-staged 2>&1 | tail -20
   ```

   (Requires files to be staged; stage first with `git add`.)

4. **Repo safety scripts** (each prints its own findings; show only failures):

   ```bash
   node scripts/validate-firebase-rewrites.js > /dev/null || node scripts/validate-firebase-rewrites.js
   node scripts/check-tenant-id-safety.js > /dev/null || node scripts/check-tenant-id-safety.js
   node scripts/check-breadcrumb-duplication.js > /dev/null || node scripts/check-breadcrumb-duplication.js
   node scripts/preflight/pre-deployment-check.js --skip-build --skip-schema 2>&1 | grep -iE "fail|error|❌" | head -20
   ```

5. **CLAUDE.md rule audit** (enforced rules block; others advisory — see `scripts/audit/enforced-rules.json`):

   ```bash
   node scripts/audit/check-rules.js --quiet 2>&1 | tail -30
   ```

   Fix regressions on enforced rules; note (don't chase) advisory ones unless they're in code you just wrote.

6. **Conditional checks** — only if the diff touches them:
   - `functions/package.json` changed → `(cd functions && npm ci --dry-run --no-audit --no-fund) > /dev/null 2>&1 && echo sync-ok || echo "LOCKFILE OUT OF SYNC — run: (cd functions && npm install)"`
   - Dependencies changed → `pnpm audit --production --audit-level=high --ignore-registry-errors 2>&1 | tail -15`

7. When everything passes, commit normally (the hook will re-run and should pass first try). NEVER use `--no-verify` without explicit user approval.

## Rules

- Do not paste passing-check output; report "N checks passed" in one line and detail only failures + fixes.
- If a check fails for a pre-existing reason unrelated to your diff, say so and ask before fixing unrelated code.
