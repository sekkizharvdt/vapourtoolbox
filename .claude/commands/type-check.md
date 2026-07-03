---
description: Type-check all packages, showing only the error lines, and fix them.
---

# Type Check

Run TypeScript type checking across all packages. Show only `error TS` lines — a clean check is one line of report.

## Steps

1. Check types in the web app (covers most errors — do this first):

   ```bash
   pnpm --filter @vapour/web type-check 2>&1 | grep -E "error TS" | head -40
   ```

   No output = pass.

2. Check the shared packages in one pass:

   ```bash
   pnpm --filter "@vapour/*" --filter "!@vapour/web" type-check 2>&1 | grep -E "error TS|Error" | head -20
   ```

3. For any type errors:
   - Read the file with the error
   - Fix the type issue
   - Common fixes:
     - Add proper type annotations
     - Use type guards for narrowing
     - Add null checks for optional values
     - Update interfaces if schema changed

4. Re-run until all packages pass. If errors exceed ~20, fix them in file batches and re-run per batch rather than after every single fix.

5. Report "type check passes across packages" in one line plus a short list of fixes — never paste the full compiler output.
