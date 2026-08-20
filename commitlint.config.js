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

/**
 * A Firestore feedback document id: exactly 20 chars, letters and digits.
 * The deploy workflow reads these out of the shipped commit range to resolve
 * the items automatically, so a truncated id ("feedback MesC9vYA") is not a
 * cosmetic problem — it cannot be looked up, and the item silently stays open
 * even though the work shipped. Catch it here, where it is one keystroke to fix.
 */
const FEEDBACK_ID = /^[A-Za-z0-9]{20}$/;

module.exports = {
  extends: ['@commitlint/config-conventional'],

  plugins: [
    {
      rules: {
        'feedback-trailer-full-id': ({ raw }) => {
          const trailers = String(raw ?? '')
            .split('\n')
            .map((line) => line.match(/^Feedback:\s*(.*)$/i))
            .filter(Boolean)
            .map((m) => m[1].trim());

          if (trailers.length === 0) return [true];

          const bad = trailers.filter((id) => !FEEDBACK_ID.test(id));
          return [
            bad.length === 0,
            `Feedback trailer needs the full 20-character feedback id, not ${bad
              .map((b) => `"${b}"`)
              .join(', ')}. ` +
              'Copy it from the feedback URL (/feedback/<id>) or the admin list. ' +
              'The deploy uses it to resolve the item automatically.',
          ];
        },
      },
    },
  ],

  rules: {
    // Feedback: <20-char id>, one per line, repeatable. Optional — but wrong
    // when present is worse than absent, because the deploy silently skips it.
    'feedback-trailer-full-id': [2, 'always'],

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
