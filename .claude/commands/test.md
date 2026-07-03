---
description: Run tests scoped to what changed, showing failures only, and fix them.
argument-hint: [test file or pattern]
---

# Test

Run tests and fix any failures. Two token rules: (a) scope the run to the files you changed when possible, (b) show failures only — a green run is one line.

## Arguments

- `$ARGUMENTS` - Optional: specific test file or pattern to run

## Steps

1. Run tests:
   - If arguments provided: `pnpm --filter @vapour/web test $ARGUMENTS 2>&1 | tee /tmp/test.log | grep -E "FAIL|✕|failed|Tests:" | head -30`
   - If no arguments but you changed specific modules this session, pass their paths as the pattern instead of running the whole suite.
   - Full suite (last resort): `pnpm --filter @vapour/web test 2>&1 | tee /tmp/test.log | grep -E "FAIL|✕|failed|Tests:" | head -30`

2. For UI package tests: `pnpm --filter @vapour/ui test 2>&1 | grep -E "FAIL|✕|failed|Tests:" | head -20`

3. If tests fail:
   - Get the failure detail from `/tmp/test.log` (grep around the failing test name) — don't re-run just to see output
   - Read the failing test file, fix the implementation or test as appropriate
   - Re-run ONLY the failing file, not the whole suite

4. For coverage report: `pnpm --filter @vapour/web test:coverage` (only when explicitly asked)

5. Report the summary line ("Tests: N passed") plus what was fixed — never paste passing test output.
