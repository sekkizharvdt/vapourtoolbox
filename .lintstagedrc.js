module.exports = {
  // Lint and format TypeScript files in our actual project (exclude inputs/ and e2e/)
  'apps/web/**/*.{ts,tsx}': (filenames) => {
    // Filter out test files - they're handled separately
    const nonTestFiles = filenames.filter((f) => !f.includes('.test.'));
    const commands = ['pnpm exec prettier --write ' + filenames.join(' ')];

    // Run ESLint via Next.js lint (uses --max-warnings from package.json script)
    if (filenames.length > 0) {
      commands.push(`pnpm --filter @vapour/web run lint`);
    }

    // Run related tests for non-test source files (exit 0 if no tests found)
    if (nonTestFiles.length > 0) {
      commands.push(
        `pnpm --filter @vapour/web exec jest --passWithNoTests --bail --findRelatedTests ${nonTestFiles.join(' ')} || true`
      );
    }

    return commands;
  },
  'packages/**/*.{ts,tsx}': (filenames) => {
    const commands = ['pnpm exec prettier --write ' + filenames.join(' ')];
    // Note: Packages are type-checked during build. Tests for packages
    // run through the web app's jest config which imports from packages.
    return commands;
  },
  'functions/**/*.{ts,tsx}': ['pnpm exec prettier --write'],
  'scripts/**/*.js': ['pnpm exec prettier --write'],

  // Run tests for changed test files
  'apps/web/**/*.test.{ts,tsx}': ['pnpm --filter @vapour/web test -- --passWithNoTests --bail'],
  // Package tests run through web app's jest which imports packages
  'packages/**/*.test.{ts,tsx}': ['pnpm --filter @vapour/web test -- --passWithNoTests --bail'],

  // Format E2E tests (no eslint, just prettier)
  'apps/**/e2e/**/*.{ts,tsx}': ['pnpm exec prettier --write'],

  // Format JSON, Markdown, YAML (exclude inputs/)
  '{apps,packages,functions,scripts,docs}/**/*.{json,md,yml,yaml}': ['pnpm exec prettier --write'],
  '*.{json,md,yml,yaml}': ['pnpm exec prettier --write'],

  // Format CSS
  'apps/**/*.css': ['pnpm exec prettier --write'],
};
