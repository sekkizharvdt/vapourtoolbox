const path = require('path');

module.exports = {
  // Lint and format TypeScript files in our actual project (exclude inputs/ and e2e/)
  'apps/web/**/*.{ts,tsx}': (filenames) => {
    // Filter out test files - they're handled separately
    const nonTestFiles = filenames.filter((f) => !f.includes('.test.'));
    const commands = ['pnpm exec prettier --write ' + filenames.join(' ')];

    // Run ESLint scoped to the STAGED files only. The whole-app
    // `next lint` needs several GB of heap and gets OOM-killed on the
    // codespace when many files are staged (CI still lints the whole app
    // on every push, so nothing escapes).
    if (filenames.length > 0) {
      const fileArgs = filenames
        .map((f) => `--file ${path.relative(path.join(__dirname, 'apps/web'), f)}`)
        .join(' ');
      commands.push(`pnpm --filter @vapour/web exec next lint --max-warnings=0 ${fileArgs}`);
    }

    // Run related tests for non-test source files. NOTE: lint-staged does not
    // run commands through a shell, so `|| true` would be passed to jest as
    // two positional args — and jest treats positionals as regex patterns,
    // where `||` matches EVERYTHING (whole suite on every commit). Rely on
    // --passWithNoTests instead.
    if (nonTestFiles.length > 0) {
      commands.push(
        `pnpm --filter @vapour/web exec jest --passWithNoTests --bail --findRelatedTests ${nonTestFiles.join(' ')}`
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
  'apps/web/**/*.test.{ts,tsx}': (filenames) => {
    // Integration and Firestore-rules tests need Firebase emulators and are
    // excluded from the unit jest config (testPathIgnorePatterns:
    // '/__integration__/', '/__rules__/'). Running them here always finds 0
    // tests and fails the hook, so skip them. --runTestsByPath makes jest
    // treat the args as file paths, NOT regex patterns (without it, and with
    // the old non-shell `|| true` suffix, `||` was a match-all regex that ran
    // the entire suite on every commit). --passWithNoTests absorbs the
    // no-tests case.
    const unitTests = filenames.filter(
      (f) => !f.includes('/__integration__/') && !f.includes('/__rules__/')
    );
    if (unitTests.length === 0) return [];
    return [
      `pnpm --filter @vapour/web exec jest --passWithNoTests --bail --runTestsByPath ${unitTests.join(' ')}`,
    ];
  },
  // Package tests run through each package's own jest config
  'packages/**/*.test.{ts,tsx}': (filenames) => {
    const byPkg = {};
    filenames.forEach((f) => {
      const m = f.match(/packages\/([^/]+)\//);
      if (m) {
        if (!byPkg[m[1]]) byPkg[m[1]] = [];
        byPkg[m[1]].push(f);
      }
    });
    return Object.entries(byPkg).map(
      ([pkg, files]) =>
        `pnpm --filter @vapour/${pkg} exec jest --passWithNoTests --bail ${files.join(' ')}`
    );
  },

  // Format E2E tests (no eslint, just prettier)
  'apps/**/e2e/**/*.{ts,tsx}': ['pnpm exec prettier --write'],

  // Format JSON, Markdown, YAML (exclude inputs/)
  '{apps,packages,functions,scripts,docs}/**/*.{json,md,yml,yaml}': ['pnpm exec prettier --write'],
  '*.{json,md,yml,yaml}': ['pnpm exec prettier --write'],

  // Format CSS
  'apps/**/*.css': ['pnpm exec prettier --write'],
};
