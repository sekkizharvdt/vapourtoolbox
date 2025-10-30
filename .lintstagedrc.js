module.exports = {
  // Only lint TypeScript files in our actual project (exclude inputs/)
  'apps/**/*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  'packages/**/*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  'functions/**/*.{ts,tsx}': ['prettier --write'],
  'scripts/**/*.js': ['prettier --write'],

  // Format JSON, Markdown, YAML (exclude inputs/)
  '{apps,packages,functions,scripts,docs}/**/*.{json,md,yml,yaml}': ['prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],

  // Format CSS
  'apps/**/*.css': ['prettier --write'],
};
