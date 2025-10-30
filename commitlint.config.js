/**
 * Commitlint Configuration
 *
 * Enforces conventional commit format:
 *
 * <type>(<scope>): <subject>
 *
 * Types:
 * - feat: A new feature
 * - fix: A bug fix
 * - docs: Documentation only changes
 * - style: Changes that don't affect the meaning of the code
 * - refactor: A code change that neither fixes a bug nor adds a feature
 * - perf: A code change that improves performance
 * - test: Adding missing tests or correcting existing tests
 * - build: Changes that affect the build system or external dependencies
 * - ci: Changes to our CI configuration files and scripts
 * - chore: Other changes that don't modify src or test files
 * - revert: Reverts a previous commit
 *
 * Examples:
 * - feat: Add user authentication
 * - fix: Resolve entity loading issue
 * - feat(entities): Add contacts array support
 * - docs: Update database management guide
 * - chore: Update dependencies
 */

module.exports = {
  extends: ['@commitlint/config-conventional'],

  rules: {
    // Ensure type is always lowercase
    'type-case': [2, 'always', 'lower-case'],

    // Ensure type is one of the allowed values
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Code style (formatting, missing semi-colons, etc)
        'refactor', // Code refactoring
        'perf',     // Performance improvements
        'test',     // Adding tests
        'build',    // Build system changes
        'ci',       // CI configuration changes
        'chore',    // Maintenance tasks
        'revert',   // Revert a commit
      ],
    ],

    // Subject should not end with a period
    'subject-full-stop': [2, 'never', '.'],

    // Subject should not be empty
    'subject-empty': [2, 'never'],

    // Subject should be sentence-case, start-case, pascal-case, upper-case
    'subject-case': [
      2,
      'never',
      ['sentence-case', 'start-case', 'pascal-case', 'upper-case'],
    ],

    // Header max length (type + scope + subject)
    'header-max-length': [2, 'always', 100],

    // Body should have a blank line before it
    'body-leading-blank': [1, 'always'],

    // Footer should have a blank line before it
    'footer-leading-blank': [1, 'always'],
  },
};
