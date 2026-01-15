# Test

Run tests and fix any failures.

## Arguments

- `$ARGUMENTS` - Optional: specific test file or pattern to run

## Steps

1. Run tests:
   - If arguments provided: `pnpm --filter @vapour/web test $ARGUMENTS`
   - If no arguments: `pnpm --filter @vapour/web test`

2. For UI package tests: `pnpm --filter @vapour/ui test`

3. If tests fail:
   - Read the failing test file
   - Understand what it's testing
   - Fix the implementation or test as appropriate
   - Re-run to verify

4. For coverage report: `pnpm --filter @vapour/web test:coverage`
