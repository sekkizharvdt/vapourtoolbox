# Build

Build the project and fix any errors.

## Steps

1. First build the shared packages in dependency order:

   ```bash
   pnpm --filter "@vapour/*" --filter "!@vapour/web" build
   ```

2. Then build the web app:

   ```bash
   pnpm --filter @vapour/web build
   ```

3. If there are type errors, fix them one by one.

4. If there are lint errors, run:

   ```bash
   pnpm --filter @vapour/web run lint:fix
   ```

5. Re-run the build until it passes.
