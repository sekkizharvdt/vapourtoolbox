# Git Hooks Setup

## Overview

This project uses **Husky** to automatically run pre-deployment checks before every git commit. This ensures code quality and catches issues early in the development workflow.

## What Gets Checked

Every time you commit, the following checks run automatically:

### 1. Environment Configuration
- ✅ `firebase.json` exists
- ✅ `firestore.rules` exists
- ✅ `firestore.indexes.json` exists
- ✅ Environment files exist

### 2. Firestore Indexes
- ✅ `firestore.indexes.json` is valid JSON
- ✅ Common composite indexes are defined
- ✅ Entity and project indexes are present

### 3. Code Quality
- ⚠️ Console.log usage (warning only)
- ℹ️ TODO comments count (informational)

### 4. Recent Query Changes
- 🔍 Detects Firestore query modifications
- 📋 Reminds to check schema compatibility
- 🗂️ Reminds to verify indexes exist

**Note**: Build and schema checks are **skipped** in pre-commit hooks for speed. These are run during the full pre-deployment check.

## How It Works

```bash
# When you commit:
git add .
git commit -m "Your commit message"

# Husky automatically runs:
🔍 Running pre-commit checks...

═══════════════════════════════════════════════════════════════════
  PRE-DEPLOYMENT CHECKS
  Project: Vapour Toolbox
═══════════════════════════════════════════════════════════════════

✅ Environment Configuration
✅ Firestore Indexes
✅ Code Quality
✅ Recent Query Changes

✅ Pre-commit checks passed!

# If checks pass → Commit succeeds ✅
# If checks fail → Commit is blocked ❌
```

## Bypassing the Hook

**Not recommended**, but you can skip the check if absolutely necessary:

```bash
git commit -m "Your message" --no-verify
```

⚠️ **Warning**: Only use `--no-verify` if you know what you're doing. The checks are there to protect you from common mistakes.

## Files Created

### 1. `.husky/pre-commit`
The git hook script that runs before every commit.

### 2. `package.json` (modified)
Added `"prepare": "husky"` script to initialize Husky when dependencies are installed.

### 3. `.git/hooks/` (auto-managed by Husky)
Husky installs the actual git hooks here automatically.

## Installation (for new developers)

When a new developer clones the repository, Husky is automatically set up:

```bash
# Clone the repo
git clone <repo-url>
cd VDT-Unified

# Install dependencies (this runs "prepare" script which initializes Husky)
pnpm install

# Husky is now active! Pre-commit hooks will run automatically.
```

No manual setup required!

## Troubleshooting

### Issue: "Husky not found"

```bash
# Reinstall Husky
pnpm install

# Or manually initialize
pnpm exec husky init
```

### Issue: Hook not running

```bash
# Check if git hooks are enabled
git config core.hooksPath

# Should output: .husky

# If not, run:
git config core.hooksPath .husky
```

### Issue: Permission denied on pre-commit hook

```bash
# On Linux/Mac, make the hook executable:
chmod +x .husky/pre-commit
```

### Issue: Checks fail but I need to commit

1. **First, try to fix the issues** - The checks are there for a reason
2. **If truly urgent**, bypass with `--no-verify` (not recommended)
3. **Better approach**: Stage and commit files separately

```bash
# Commit configuration files separately
git add .husky package.json
git commit -m "chore: Update Husky configuration"

# Then fix and commit code
git add src/
# Fix issues found by checks
git commit -m "feat: Your feature"
```

## Customizing the Hook

To modify what checks run during commit:

### 1. Edit `.husky/pre-commit`

```bash
# Current configuration (fast checks only):
node scripts/preflight/pre-deployment-check.js --skip-build --skip-schema

# To include build checks (slower):
node scripts/preflight/pre-deployment-check.js --skip-schema

# To run all checks (slowest, most thorough):
node scripts/preflight/pre-deployment-check.js
```

### 2. Add Additional Hooks

```bash
# Create a pre-push hook (runs before git push)
echo '#!/bin/sh
node scripts/preflight/pre-deployment-check.js
' > .husky/pre-push

# Make it executable (Linux/Mac)
chmod +x .husky/pre-push
```

## Pre-commit vs Pre-deployment

**Pre-commit Hook** (runs on `git commit`):
- Fast checks only (skips build and schema)
- Catches common mistakes early
- Runs locally on developer machine
- Can be bypassed with `--no-verify`

**Pre-deployment Check** (run manually before deploying):
- All checks including build and schema validation
- More thorough and slower
- Should always run before production deployment
- Cannot be bypassed

```bash
# Before deploying to production, ALWAYS run:
node scripts/preflight/pre-deployment-check.js

# Then deploy:
firebase deploy
```

## Benefits

✅ **Catches issues early** - Before they reach the codebase
✅ **Enforces standards** - Consistent code quality
✅ **Prevents broken commits** - Configuration errors caught immediately
✅ **Saves time** - No need to manually run checks
✅ **Team consistency** - Everyone runs the same checks
✅ **Git history stays clean** - Fewer "fix typo" commits

## Best Practices

1. **Don't bypass the hook** - Fix the issues instead
2. **Run full checks before deployment** - The pre-commit hook is not sufficient
3. **Keep the hook fast** - Avoid adding slow checks to pre-commit
4. **Use pre-push for expensive checks** - Long-running tests, builds, etc.
5. **Document custom hooks** - If you add new hooks, document them

## Related Documentation

- [Database Management System](./DATABASE_MANAGEMENT.md) - Full database workflow
- [Pre-deployment Checks](../scripts/preflight/pre-deployment-check.js) - What checks are run
- [Husky Documentation](https://typicode.github.io/husky/) - Official Husky docs

## FAQ

**Q: Can I disable Husky completely?**

A: Yes, but not recommended. Remove `"prepare": "husky"` from package.json and delete `.husky/` directory.

**Q: Why are build and schema checks skipped?**

A: They're too slow for pre-commit. Run the full check before deploying:
```bash
node scripts/preflight/pre-deployment-check.js
```

**Q: What if I'm working offline?**

A: Pre-commit checks work offline. They only check local files and configuration.

**Q: Can I add custom checks?**

A: Yes! Edit `.husky/pre-commit` to add your own scripts. Keep them fast (< 5 seconds).

**Q: Will this slow down my commits?**

A: No. The pre-commit checks are optimized to run in 1-3 seconds. Full validation is done before deployment, not before every commit.

## Summary

Husky pre-commit hooks are now active! Every commit will automatically:
- ✅ Verify configuration files exist
- ✅ Check Firestore indexes are valid
- ✅ Report code quality warnings
- ✅ Detect risky query changes

This protects the codebase from common mistakes and ensures consistent quality across the team.
