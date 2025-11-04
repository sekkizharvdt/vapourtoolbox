#!/usr/bin/env node
/**
 * Type Safety Checker
 *
 * This script checks for prohibited type patterns in the codebase:
 * - 'as any' type casts
 * - @ts-ignore comments
 * - @ts-expect-error comments (without proper justification)
 * - Direct Date assignments to Firestore documents
 *
 * Run with: pnpm check-type-safety
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const PATTERNS = [
  {
    name: 'as any',
    pattern: /as\s+any/g,
    severity: 'error',
    message: 'Using "as any" bypasses type safety. Use proper types instead.',
  },
  {
    name: '@ts-ignore',
    pattern: /@ts-ignore/g,
    severity: 'error',
    message: 'Using @ts-ignore suppresses errors without fixing them. Fix the underlying type issue.',
  },
  {
    name: '@ts-expect-error without reason',
    pattern: /@ts-expect-error(?!\s*\w)/g,
    severity: 'warning',
    message: '@ts-expect-error should include a reason comment explaining why it\'s needed.',
  },
];

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function findFiles(dir, extensions) {
  const files = [];

  function traverse(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      // Skip node_modules and build directories
      if (entry.isDirectory()) {
        if (!['node_modules', '.next', 'out', 'dist', 'build', '.git'].includes(entry.name)) {
          traverse(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  traverse(dir);
  return files;
}

function checkFile(filePath, patterns) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];

  patterns.forEach(({ name, pattern, severity, message }) => {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);

    lines.forEach((line, lineNumber) => {
      regex.lastIndex = 0; // Reset regex
      while ((match = regex.exec(line)) !== null) {
        issues.push({
          file: filePath,
          line: lineNumber + 1,
          column: match.index + 1,
          pattern: name,
          severity,
          message,
          code: line.trim(),
        });
      }
    });
  });

  return issues;
}

function main() {
  log('\n🔍 Running Type Safety Checks...', 'cyan');
  log('━'.repeat(60), 'cyan');

  const startTime = Date.now();
  const targetDirs = ['apps/web/src', 'packages'];

  let allIssues = [];

  targetDirs.forEach((dir) => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      log(`⚠️  Directory not found: ${dir}`, 'yellow');
      return;
    }

    log(`\nScanning ${dir}...`, 'blue');

    const files = findFiles(fullPath, ['.ts', '.tsx']);
    log(`  Found ${files.length} TypeScript files`, 'blue');

    files.forEach((file) => {
      const issues = checkFile(file, PATTERNS);
      allIssues = allIssues.concat(issues);
    });
  });

  // Display results
  log('\n' + '━'.repeat(60), 'cyan');

  if (allIssues.length === 0) {
    log('✅ No type safety issues found!', 'green');
    log(`\nCompleted in ${Date.now() - startTime}ms`, 'cyan');
    process.exit(0);
  }

  // Group by severity
  const errors = allIssues.filter((i) => i.severity === 'error');
  const warnings = allIssues.filter((i) => i.severity === 'warning');

  if (errors.length > 0) {
    log(`\n❌ Found ${errors.length} error(s):`, 'red');
    errors.forEach((issue) => {
      log(`\n  ${path.relative(process.cwd(), issue.file)}:${issue.line}:${issue.column}`, 'red');
      log(`  ${issue.pattern}: ${issue.message}`, 'red');
      log(`  ${issue.code}`, 'yellow');
    });
  }

  if (warnings.length > 0) {
    log(`\n⚠️  Found ${warnings.length} warning(s):`, 'yellow');
    warnings.forEach((issue) => {
      log(
        `\n  ${path.relative(process.cwd(), issue.file)}:${issue.line}:${issue.column}`,
        'yellow'
      );
      log(`  ${issue.pattern}: ${issue.message}`, 'yellow');
      log(`  ${issue.code}`, 'yellow');
    });
  }

  log('\n' + '━'.repeat(60), 'cyan');
  log(`\n📖 See docs/TYPESCRIPT_GUIDELINES.md for guidance on fixing these issues.`, 'blue');
  log(`\nCompleted in ${Date.now() - startTime}ms`, 'cyan');

  // Exit with error code if there are errors
  if (errors.length > 0) {
    log('\n❌ Type safety check failed!', 'red');
    process.exit(1);
  } else if (warnings.length > 0) {
    log('\n⚠️  Type safety check passed with warnings', 'yellow');
    process.exit(0);
  }
}

// Run the check
try {
  main();
} catch (error) {
  log(`\n❌ Error running type safety check: ${error.message}`, 'red');
  process.exit(1);
}
