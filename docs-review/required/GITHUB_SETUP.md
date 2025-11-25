# GitHub Repository Setup Guide

## Overview

This guide walks you through setting up the GitHub repository with all required secrets and configurations for CI/CD automation.

**Repository**: https://github.com/sekkizharvdt/vapourtoolbox

---

## Table of Contents

1. [Initial Repository Setup](#initial-repository-setup)
2. [Configure GitHub Secrets](#configure-github-secrets)
3. [Set Up Branch Protection](#set-up-branch-protection)
4. [Enable GitHub Actions](#enable-github-actions)
5. [Push Code to GitHub](#push-code-to-github)
6. [Verify CI/CD Pipeline](#verify-cicd-pipeline)
7. [Troubleshooting](#troubleshooting)

---

## 1. Initial Repository Setup

Your repository is already created at: https://github.com/sekkizharvdt/vapourtoolbox

### Connect Local Repository to GitHub

```bash
# Navigate to your project
cd C:\Users\sekki\VDT-Unified

# Add remote origin (if not already added)
git remote add origin https://github.com/sekkizharvdt/vapourtoolbox.git

# Or if remote exists, update it
git remote set-url origin https://github.com/sekkizharvdt/vapourtoolbox.git

# Verify remote
git remote -v
```

---

## 2. Configure GitHub Secrets

GitHub Secrets store sensitive information securely and make it available to GitHub Actions without exposing it in code.

### Step-by-Step: Adding Secrets

1. **Go to your repository**: https://github.com/sekkizharvdt/vapourtoolbox
2. Click **Settings** (top right)
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**

### Required Secrets

#### A. Firebase Configuration (Public - but still use secrets for consistency)

Add each of these from your `apps/web/.env.production` or Firebase Console:

| Secret Name                                | Description                  | Where to Find                                            |
| ------------------------------------------ | ---------------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | Firebase API Key             | Firebase Console → Project Settings → General → Web apps |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | Firebase Auth Domain         | Usually `your-project.firebaseapp.com`                   |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | Firebase Project ID          | Firebase Console → Project Settings → General            |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | Firebase Storage Bucket      | Usually `your-project.appspot.com`                       |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | Firebase Console → Project Settings → Cloud Messaging    |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | Firebase App ID              | Firebase Console → Project Settings → General → Web apps |

**To find these**:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `vapour-toolbox`
3. Click ⚙️ Settings → Project Settings
4. Scroll to "Your apps" → Web app
5. Copy each value

#### B. Firebase Deployment Token (CRITICAL - NEVER COMMIT THIS)

| Secret Name           | Description                       | How to Generate  |
| --------------------- | --------------------------------- | ---------------- |
| `FIREBASE_TOKEN`      | Firebase CI token for deployments | See below        |
| `FIREBASE_PROJECT_ID` | Your Firebase project ID          | `vapour-toolbox` |

**Generating Firebase Token**:

```bash
# Install Firebase CLI globally (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login:ci

# This will:
# 1. Open a browser for authentication
# 2. Generate a CI token
# 3. Display the token in the terminal

# Copy the token and add it as FIREBASE_TOKEN secret in GitHub
```

**⚠️ IMPORTANT**: The Firebase token is **HIGHLY SENSITIVE**. Never commit it or share it publicly.

---

## 3. Set Up Branch Protection

Protect your `main` branch from direct commits and require CI checks to pass before merging.

### Step-by-Step:

1. Go to **Settings** → **Branches**
2. Click **Add branch protection rule**
3. Branch name pattern: `main`
4. Enable:
   - ✅ **Require a pull request before merging**
     - ✅ Require approvals: 1
   - ✅ **Require status checks to pass before merging**
     - ✅ Require branches to be up to date before merging
     - Add required checks:
       - `Lint & Type Check`
       - `Build Application`
       - `Pre-deployment Checks`
       - `Security Audit`
   - ✅ **Require conversation resolution before merging**
   - ✅ **Do not allow bypassing the above settings**
5. Click **Create**

**Result**: Now all changes to `main` must go through pull requests and pass CI checks.

---

## 4. Enable GitHub Actions

GitHub Actions should be enabled by default, but verify:

1. Go to **Settings** → **Actions** → **General**
2. Under "Actions permissions", select:
   - ✅ **Allow all actions and reusable workflows**
3. Under "Workflow permissions", select:
   - ✅ **Read and write permissions**
   - ✅ **Allow GitHub Actions to create and approve pull requests**
4. Click **Save**

---

## 5. Push Code to GitHub

Now push your code to GitHub to trigger the CI/CD pipeline.

```bash
# Stage all changes
git add .

# Commit with conventional commit format
git commit -m "chore: Initial project setup with CI/CD"

# Push to GitHub
git push -u origin main
```

**What happens next**:

1. Husky pre-commit hook runs locally
2. Lint-staged formats and lints your code
3. Commitlint validates your commit message
4. Pre-deployment checks run
5. Code is pushed to GitHub
6. GitHub Actions CI workflow starts automatically

---

## 6. Verify CI/CD Pipeline

### Watch the CI Run

1. Go to your repository: https://github.com/sekkizharvdt/vapourtoolbox
2. Click the **Actions** tab
3. You should see your workflow running

### CI Workflow (runs on every push/PR)

The CI workflow includes:

- ✅ **Lint & Type Check** - ESLint and TypeScript validation
- ✅ **Build** - Builds the web application
- ✅ **Pre-deployment Checks** - Database schema and config validation
- ✅ **Security Audit** - Checks for vulnerabilities

### Deploy Workflow (runs only on main branch)

The deployment workflow:

1. Runs all CI checks
2. Deploys Firestore Rules
3. Deploys Firestore Indexes
4. Deploys Cloud Functions
5. Deploys to Firebase Hosting

**View deployment status**:

- Go to **Actions** tab
- Click on the "Deploy - Production" workflow
- Watch each step execute

---

## 7. Security Best Practices

### ✅ What's Protected

The following files are **NEVER committed** (already in `.gitignore`):

```gitignore
# Environment variables
.env
.env*.local
apps/web/.env.local

# Firebase service account keys
serviceAccountKey.json
*-firebase-adminsdk-*.json

# Firebase cache
.firebase/
```

### ⚠️ What to Watch Out For

**NEVER commit**:

- ❌ `.env` files
- ❌ Service account JSON files
- ❌ Firebase tokens
- ❌ API keys (use GitHub Secrets instead)
- ❌ Database credentials
- ❌ Private keys

**If you accidentally commit secrets**:

1. **Rotate the secret immediately** (generate new Firebase token, etc.)
2. Remove from git history:
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/secret/file" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. Force push (⚠️ dangerous):
   ```bash
   git push origin --force --all
   ```

---

## 8. Workflow Examples

### Create a Feature Branch

```bash
# Create and switch to new branch
git checkout -b feat/add-user-management

# Make changes
# ...

# Stage and commit
git add .
git commit -m "feat: Add user management module"

# Push to GitHub
git push -u origin feat/add-user-management
```

**What happens**:

1. Pre-commit hooks run locally
2. Code is pushed to GitHub
3. CI workflow runs automatically
4. You see status checks on your PR

### Create a Pull Request

1. Go to your repository
2. Click **Pull requests** → **New pull request**
3. Base: `main`, Compare: `feat/add-user-management`
4. Click **Create pull request**
5. Fill in description
6. Wait for CI checks to pass ✅
7. Request review
8. Merge when approved

**Result**: After merge to `main`, deployment workflow runs automatically!

---

## 9. Troubleshooting

### Issue: "FIREBASE_TOKEN secret not found"

**Solution**:

```bash
# Generate a new token
firebase login:ci

# Copy the token
# Add it to GitHub Secrets as FIREBASE_TOKEN
```

### Issue: "Permission denied" during Firebase deployment

**Solution**:

1. Verify `FIREBASE_TOKEN` is correct
2. Check Firebase project permissions
3. Regenerate token:
   ```bash
   firebase logout
   firebase login:ci
   ```

### Issue: CI workflow failing on lint

**Solution**:

```bash
# Run lint locally to see errors
pnpm lint

# Auto-fix issues
pnpm lint --fix

# Commit fixes
git add .
git commit -m "fix: Resolve linting issues"
git push
```

### Issue: Build failing with environment variable errors

**Solution**:

1. Verify all `NEXT_PUBLIC_*` secrets are set in GitHub
2. Check values match your Firebase config
3. Re-add secrets if needed

### Issue: "Pre-commit hook failed"

**Solution**:

```bash
# Check what failed
git commit -m "your message"  # Will show the error

# Common fixes:

# If lint-staged failed:
pnpm lint --fix
pnpm format

# If commitlint failed:
# Use conventional commit format:
git commit -m "feat: Your feature description"
# or
git commit -m "fix: Your bug fix description"

# If pre-deployment check failed:
node scripts/preflight/pre-deployment-check.js
# Fix reported issues

# To bypass (not recommended):
git commit -m "your message" --no-verify
```

### Issue: Deploy workflow not running

**Solution**:

1. Check GitHub Actions are enabled in Settings
2. Verify `deploy.yml` exists in `.github/workflows/`
3. Check branch is `main` (deploy only runs on main)
4. Verify all required secrets are set

---

## 10. GitHub Actions Status Badges

Add status badges to your README.md:

```markdown
# Vapour Toolbox

[![CI](https://github.com/sekkizharvdt/vapourtoolbox/actions/workflows/ci.yml/badge.svg)](https://github.com/sekkizharvdt/vapourtoolbox/actions/workflows/ci.yml)
[![Deploy](https://github.com/sekkizharvdt/vapourtoolbox/actions/workflows/deploy.yml/badge.svg)](https://github.com/sekkizharvdt/vapourtoolbox/actions/workflows/deploy.yml)

Unified Business Management Platform
```

---

## 11. Quick Reference

### Common Commands

```bash
# Check current branch
git branch

# Create feature branch
git checkout -b feat/feature-name

# Stage changes
git add .

# Commit (conventional format)
git commit -m "feat: Description"
git commit -m "fix: Description"
git commit -m "docs: Description"

# Push to GitHub
git push

# Pull latest changes
git pull origin main

# View remote URL
git remote -v
```

### Conventional Commit Types

| Type       | Description      | Example                             |
| ---------- | ---------------- | ----------------------------------- |
| `feat`     | New feature      | `feat: Add user authentication`     |
| `fix`      | Bug fix          | `fix: Resolve entity loading issue` |
| `docs`     | Documentation    | `docs: Update README`               |
| `style`    | Code style       | `style: Format code`                |
| `refactor` | Code refactoring | `refactor: Simplify query logic`    |
| `perf`     | Performance      | `perf: Optimize database queries`   |
| `test`     | Tests            | `test: Add entity tests`            |
| `build`    | Build system     | `build: Update dependencies`        |
| `ci`       | CI/CD            | `ci: Add workflow`                  |
| `chore`    | Maintenance      | `chore: Update .gitignore`          |

---

## 12. Next Steps

✅ **Completed**:

- Repository created
- CI/CD workflows configured
- Pre-commit hooks active
- Lint-staged configured
- Commitlint configured

🔄 **To Do**:

1. Add Firebase secrets to GitHub
2. Push code to GitHub
3. Verify CI pipeline runs
4. Test deployment workflow
5. Add status badges to README
6. Configure branch protection rules

---

## Summary

Your repository is now set up with:

- ✅ Automated CI/CD with GitHub Actions
- ✅ Pre-commit hooks for code quality
- ✅ Conventional commit enforcement
- ✅ Automated formatting and linting
- ✅ Pre-deployment validation
- ✅ Security audits
- ✅ Automated Firebase deployments

**Next**: Add secrets to GitHub, push code, and watch the automation work! 🚀
