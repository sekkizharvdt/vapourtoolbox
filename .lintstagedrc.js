module.exports = {
  // Only lint TypeScript files in our actual project (exclude inputs/ and e2e/)
  'apps/**/!(e2e)/**/*.{ts,tsx}': ['pnpm exec eslint --fix', 'pnpm exec prettier --write'],
  'apps/**/!(e2e)/*.{ts,tsx}': ['pnpm exec eslint --fix', 'pnpm exec prettier --write'],
  'packages/**/*.{ts,tsx}': ['pnpm exec eslint --fix', 'pnpm exec prettier --write'],
  'functions/**/*.{ts,tsx}': ['pnpm exec prettier --write'],
  'scripts/**/*.js': ['pnpm exec prettier --write'],

  // Format E2E tests (no eslint, just prettier)
  'apps/**/e2e/**/*.{ts,tsx}': ['pnpm exec prettier --write'],

  // Format JSON, Markdown, YAML (exclude inputs/)
  '{apps,packages,functions,scripts,docs}/**/*.{json,md,yml,yaml}': ['pnpm exec prettier --write'],
  '*.{json,md,yml,yaml}': ['pnpm exec prettier --write'],

  // Format CSS
  'apps/**/*.css': ['pnpm exec prettier --write'],
};
