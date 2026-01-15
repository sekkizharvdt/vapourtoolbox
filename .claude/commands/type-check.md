# Type Check

Run TypeScript type checking across all packages.

## Steps

1. Check types in the web app:

   ```bash
   pnpm --filter @vapour/web type-check
   ```

2. Check types in the types package:

   ```bash
   pnpm --filter @vapour/types type-check
   ```

3. Check types in constants:

   ```bash
   pnpm --filter @vapour/constants type-check
   ```

4. For any type errors:
   - Read the file with the error
   - Fix the type issue
   - Common fixes:
     - Add proper type annotations
     - Use type guards for narrowing
     - Add null checks for optional values
     - Update interfaces if schema changed

5. Re-run until all packages pass.
