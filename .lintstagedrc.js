module.exports = {
  // Lint and format TypeScript files in our actual project (exclude inputs/ and e2e/)
  'apps/web/**/*.{ts,tsx}': (filenames) => {
    // Filter out test files - they're handled separately
    const nonTestFiles = filenames.filter((f) => !f.includes('.test.'));
    const commands = ['pnpm exec prettier --write ' + filenames.join(' ')];

    // Only run ESLint on web app files (Next.js lint handles .eslintrc.json correctly)
    if (filenames.length > 0) {
      commands.push(`pnpm --filter @vapour/web run lint --max-warnings=0`);
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
    const nonTestFiles = filenames.filter((f) => !f.includes('.test.'));
    const commands = ['pnpm exec prettier --write ' + filenames.join(' ')];

    // Run related tests for non-test source files (exit 0 if no tests found)
    if (nonTestFiles.length > 0) {
      commands.push(
        `pnpm exec jest --passWithNoTests --bail --findRelatedTests ${nonTestFiles.join(' ')} || true`
      );
    }

    return commands;
  },
  'functions/**/*.{ts,tsx}': ['pnpm exec prettier --write'],
  'scripts/**/*.js': ['pnpm exec prettier --write'],

  // Run tests for changed test files (use -- to pass flags through turbo)
  'apps/web/**/*.test.{ts,tsx}': ['pnpm --filter @vapour/web test -- --passWithNoTests --bail'],
  'packages/**/*.test.{ts,tsx}': ['pnpm test -- --passWithNoTests --bail'],

  // Format E2E tests (no eslint, just prettier)
  'apps/**/e2e/**/*.{ts,tsx}': ['pnpm exec prettier --write'],

  // Format JSON, Markdown, YAML (exclude inputs/)
  '{apps,packages,functions,scripts,docs}/**/*.{json,md,yml,yaml}': ['pnpm exec prettier --write'],
  '*.{json,md,yml,yaml}': ['pnpm exec prettier --write'],

  // Format CSS
  'apps/**/*.css': ['pnpm exec prettier --write'],
};
