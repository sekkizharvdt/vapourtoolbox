# Lint

Run linting and fix issues.

## Steps

1. Run lint check:

   ```bash
   pnpm --filter @vapour/web run lint
   ```

2. If there are auto-fixable issues, run:

   ```bash
   pnpm --filter @vapour/web run lint:fix
   ```

3. For remaining issues that can't be auto-fixed:
   - Read the file with the error
   - Fix the issue manually following the ESLint rule
   - Common rules in this codebase:
     - `@typescript-eslint/consistent-type-assertions` - Use `docToTyped` helper instead of `as Type`
     - `@typescript-eslint/no-unused-vars` - Remove or use the variable
     - `react-hooks/exhaustive-deps` - Add missing dependencies to useEffect

4. Re-run lint until all issues are resolved.
