# CI Status

Check the status of CI workflows and fix any failures.

## Steps

1. List recent workflow runs:

   ```bash
   gh run list --limit 5
   ```

2. If there's a failing run, get details:

   ```bash
   gh run view {run-id}
   ```

3. For specific job logs:

   ```bash
   gh run view {run-id} --log-failed
   ```

4. Common CI failures and fixes:

   **Lint errors:**
   - Run `/lint` skill to fix

   **Type errors:**
   - Run `/type-check` skill to fix

   **Build errors:**
   - Run `/build` skill to fix

   **Missing generateStaticParams:**
   - Dynamic routes need `generateStaticParams()` function
   - See `/new-page` skill for pattern

   **Missing Firebase rewrite:**
   - Add rewrite to `firebase.json` for dynamic routes
   - Run pre-deployment check: `node scripts/validate-firebase-rewrites.js`

5. After fixing, commit and push to re-trigger CI.
