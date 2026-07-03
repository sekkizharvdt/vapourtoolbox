---
description: Build shared packages then the web app, showing only errors, and fix failures.
---

# Build

Build the project and fix any errors. Filter output — a passing build log is thousands of wasted tokens; only failures should enter context.

## Steps

1. First build the shared packages in dependency order:

   ```bash
   pnpm --filter "@vapour/*" --filter "!@vapour/web" build 2>&1 | grep -iE "error|failed|ELIFECYCLE" | head -30
   ```

   No output = pass. Report "packages built" in one line.

2. Then build the web app:

   ```bash
   pnpm --filter @vapour/web build 2>&1 | tee /tmp/build.log | grep -iE "error|failed|Type error|ELIFECYCLE" -A 3 | head -60
   ```

   No output = pass. If the grep output is ambiguous, read the tail of `/tmp/build.log` — do NOT re-run the full build just to see more output.

3. If there are type errors, fix them one by one, then re-run step 2 only.

4. If there are lint errors, run:

   ```bash
   pnpm --filter @vapour/web run lint:fix 2>&1 | tail -15
   ```

5. Re-run until it passes. Report the final result in one line ("build passes") plus a short list of what was fixed — never paste the full log.
