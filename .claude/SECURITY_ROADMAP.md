# Security & Code Quality Roadmap

This roadmap tracks implementation of security recommendations from the external code review conducted on 2025-11-06.

**Review Quality:** ⭐⭐⭐⭐⭐ Excellent, production-grade security review

---

## 📊 Status Overview

| Priority    | Total  | Completed | In Progress | Pending |
| ----------- | ------ | --------- | ----------- | ------- |
| 🔴 CRITICAL | 5      | 5         | 0           | 0       |
| 🟠 HIGH     | 4      | 0         | 0           | 4       |
| 🟡 MEDIUM   | 5      | 0         | 0           | 5       |
| 🟢 LOW      | 3      | 0         | 0           | 3       |
| **TOTAL**   | **17** | **5**     | **0**       | **12**  |

---

## 🔴 CRITICAL PRIORITY (Complete This Week)

### ✅ 1. Service Account Security Verification

**Status:** ✅ COMPLETED (2025-11-06) - ACCEPTABLE with improvements needed
**Assigned:** User + Claude Code
**Completed:** 2025-11-06 (Analysis done)

**Audit Results:**

- ✅ `serviceAccountKey.json` is properly gitignored
- ✅ Never committed to git history
- ✅ GitHub Actions uses `FIREBASE_SERVICE_ACCOUNT` secret
- ✅ Service account: `firebase-adminsdk-fbsvc@vapour-toolbox.iam.gserviceaccount.com`

**Current Permissions (Audited 2025-11-06):**

- ✅ Firebase Admin (broad but Firebase-specific)
- ✅ Firebase Admin SDK Administrator Service Agent
- ⚠️ Service Account Token Creator (privilege escalation risk)
- ⚠️ Service Account User (privilege escalation risk)

**Security Assessment:**

- ✅ **GOOD**: NOT Owner or Editor (would be catastrophic)
- ✅ **GOOD**: Firebase-scoped (can't access billing, VMs, etc.)
- ⚠️ **CONCERN**: "Firebase Admin" is broader than needed for CI/CD
- ⚠️ **CONCERN**: Token Creator + User roles create privilege escalation risk

**ADDITIONAL SECURITY IMPROVEMENT (Completed 2025-11-06):**

- ✅ `697891123609-compute@developer.gserviceaccount.com` - **Editor role REMOVED** (was dangerous!)
- ✅ `vapour-toolbox@appspot.gserviceaccount.com` - **Editor role REMOVED** (was dangerous!)
- Verified these accounts are not in use (no Compute Engine VMs, no App Engine apps, no keys)
- Accounts still exist but have zero permissions (safe state)
- **Impact:** Eliminated 2 critical security vulnerabilities outside the original roadmap

**Recommendation:**

- ✅ Current account is ACCEPTABLE for production use (not perfect, but safe enough)
- 📋 Plan migration to least-privilege account in Month 1 (Task #6a below)
- 🚨 Address Editor-level accounts ASAP (separate from roadmap)

**Action Items:**

- [✅] Verify current service account permissions in GCP Console (DONE)
- [📋] Create new least-privilege service account with only:
  - `roles/firebase.hostingAdmin` (Hosting deployment)
  - `roles/cloudfunctions.developer` (Functions deployment)
  - `roles/datastore.indexAdmin` (Firestore Indexes)
  - `roles/firebaserules.system` (Firestore Rules)
  - Remove: Service Account Token Creator, Service Account User
- [📋] Rotate to new service account (Month 1)
- [📋] Document service account permissions in `docs/SECURITY.md` (Q2)

**Files:**

- GCP Console: https://console.cloud.google.com/iam-admin/serviceaccounts
- GitHub Secrets: https://github.com/sekkizharvdt/vapourtoolbox/settings/secrets/actions

**Estimated Effort:** 1 hour

---

### ✅ 2. Add Content-Security-Policy (CSP) Header

**Status:** ✅ COMPLETED (2025-11-06)
**Assigned:** Claude Code
**Completed:** Commit 3795d5f

**Current State:**

- ❌ No CSP header configured
- Risk: Vulnerable to XSS attacks, inline script injection

**Action Items:**

- [ ] Add CSP header to `firebase.json`
- [ ] Test CSP doesn't break Firebase SDK, MUI, or Next.js
- [ ] Adjust policy based on browser console CSP violations
- [ ] Document CSP policy rationale

**Implementation:**

```json
// firebase.json - Add to headers array
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; frame-src 'none'; object-src 'none'; base-uri 'self';"
}
```

**Testing:**

```bash
# After deployment, verify CSP header
curl -I https://vapour-toolbox.web.app | grep -i content-security-policy

# Check browser console for CSP violations
# Visit app and look for: "Content Security Policy: ..."
```

**Files:**

- `firebase.json` (lines 26-50)

**Estimated Effort:** 2 hours (including testing)

---

### ✅ 3. Add Strict-Transport-Security (HSTS) Header

**Status:** ✅ COMPLETED (2025-11-06)
**Assigned:** Claude Code
**Completed:** Commit 3795d5f

**Current State:**

- ❌ No HSTS header configured
- Risk: Vulnerable to protocol downgrade attacks

**Action Items:**

- [ ] Add HSTS header to `firebase.json`
- [ ] Deploy and verify header present
- [ ] Consider HSTS preload submission (optional, after 6 months)

**Implementation:**

```json
// firebase.json - Add to headers array
{
  "key": "Strict-Transport-Security",
  "value": "max-age=31536000; includeSubDomains; preload"
}
```

**Files:**

- `firebase.json` (lines 26-50)

**Estimated Effort:** 15 minutes

---

### ✅ 4. Remove Deprecated X-XSS-Protection Header

**Status:** ✅ COMPLETED (2025-11-06)
**Assigned:** Claude Code
**Completed:** Commit 3795d5f

**Current State:**

- ⚠️ Using deprecated `X-XSS-Protection` header (line 47-49)
- Modern browsers ignore this header

**Action Items:**

- [ ] Remove `X-XSS-Protection` header from `firebase.json`
- [ ] Replace with CSP (handled in item #2)

**Implementation:**

```json
// firebase.json - REMOVE these lines (47-49):
{
  "key": "X-XSS-Protection",
  "value": "1; mode=block"
}
```

**Files:**

- `firebase.json` (lines 47-49)

**Estimated Effort:** 5 minutes

---

### ✅ 5. Remove continue-on-error from Security Audit

**Status:** ✅ COMPLETED (2025-11-06)
**Assigned:** Claude Code
**Completed:** Commit 3795d5f

**Current State:**

- ⚠️ Security audit failures don't block CI (ci.yml:178)
- ⚠️ Pre-deployment checks don't block (ci.yml:134, deploy.yml:56)

**Action Items:**

- [ ] Remove `continue-on-error: true` from security audit job
- [ ] Remove `continue-on-error: true` from pre-deployment checks
- [ ] Fix any existing vulnerabilities before removing
- [ ] Test CI fails properly on security issues

**Implementation:**

```yaml
# .github/workflows/ci.yml - Line 178
- name: Run security audit
  run: pnpm audit --production --audit-level=high
  # REMOVE: continue-on-error: true

# .github/workflows/ci.yml - Line 134
- name: Run pre-deployment checks
  run: node scripts/preflight/pre-deployment-check.js --skip-build --skip-schema
  # REMOVE: continue-on-error: true

# .github/workflows/deploy.yml - Line 56
- name: Run full pre-deployment checks
  run: node scripts/preflight/pre-deployment-check.js --skip-build
  # REMOVE: continue-on-error: true
```

**Files:**

- `.github/workflows/ci.yml` (lines 134, 178)
- `.github/workflows/deploy.yml` (line 56)

**Estimated Effort:** 30 minutes

---

## 🟠 HIGH PRIORITY (Complete This Month)

### ✅ 6. Migrate to OIDC (Workload Identity Federation)

**Status:** ⏳ PENDING
**Assigned:** -
**Due:** 2025-12-06

**Current State:**

- ⚠️ Using long-lived service account JSON in GitHub Secrets
- Better: Use short-lived OIDC tokens (no stored credentials)

**Action Items:**

- [ ] Verify GCP project owner access
- [ ] Create Workload Identity Pool in GCP
- [ ] Create Workload Identity Provider for GitHub
- [ ] Configure attribute mapping (repository, ref, etc.)
- [ ] Update `.github/workflows/deploy.yml` to use `google-github-actions/auth@v2`
- [ ] Test deployment with OIDC
- [ ] Delete `FIREBASE_SERVICE_ACCOUNT` secret
- [ ] Document OIDC setup in `docs/GITHUB_SETUP.md`

**Implementation:**

```yaml
# .github/workflows/deploy.yml - Replace service account setup
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: 'projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider'
    service_account: 'github-actions@vapour-toolbox.iam.gserviceaccount.com'
# Remove this step:
# - name: Setup Firebase Service Account
#   run: echo '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}' > firebase-service-account.json

# Remove GOOGLE_APPLICATION_CREDENTIALS from all deploy steps
```

**Reference:**

- https://github.com/google-github-actions/auth#workload-identity-federation-through-a-service-account
- https://cloud.google.com/blog/products/identity-security/enabling-keyless-authentication-from-github-actions

**Files:**

- `.github/workflows/deploy.yml`
- `docs/GITHUB_SETUP.md` (update documentation)

**Estimated Effort:** 3 hours

**Blockers:**

- Requires GCP project owner permissions
- Need to verify GitHub Actions is allowed in GCP org policy

---

### ✅ 7. Add Full Security Audit (Dev Dependencies)

**Status:** ⏳ PENDING
**Assigned:** -
**Due:** 2025-12-06

**Current State:**

- ⚠️ Only auditing production dependencies (`--production`)
- Dev dependencies can have vulnerabilities affecting build/CI

**Action Items:**

- [ ] Add nightly scheduled workflow for full audit
- [ ] Run `pnpm audit` without `--production` flag
- [ ] Configure alerts for high/critical vulnerabilities
- [ ] Document vulnerability response process

**Implementation:**

```yaml
# .github/workflows/security-audit-nightly.yml (NEW FILE)
name: Security Audit - Nightly

on:
  schedule:
    - cron: '0 2 * * *' # 2 AM UTC daily
  workflow_dispatch:

jobs:
  full-security-audit:
    name: Full Security Audit (Production + Dev)
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.19.0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run full security audit
        run: pnpm audit --audit-level=high
        # No continue-on-error - let it fail!

      - name: Create issue on failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🚨 Security vulnerabilities detected in dependencies',
              body: 'The nightly security audit found high-severity vulnerabilities. Please review the workflow run and update dependencies.',
              labels: ['security', 'dependencies']
            })
```

**Files:**

- `.github/workflows/security-audit-nightly.yml` (new file)

**Estimated Effort:** 1 hour

---

### ✅ 8. Add Firestore Security Rules Tests

**Status:** ⏳ PENDING
**Assigned:** -
**Due:** 2025-12-06

**Current State:**

- ❌ No automated testing of Firestore security rules
- Risk: Rule changes could accidentally expose data

**Action Items:**

- [ ] Install `@firebase/rules-unit-testing`
- [ ] Create `tests/firestore.rules.test.ts`
- [ ] Write tests for critical rules (users, entities, transactions)
- [ ] Add test job to CI workflow
- [ ] Run tests against emulator before deployment
- [ ] Make failing tests block deployment

**Implementation:**

```bash
# Install testing library
pnpm add -D @firebase/rules-unit-testing vitest

# Create test file
mkdir -p tests
cat > tests/firestore.rules.test.ts << 'EOF'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { describe, it, beforeEach, afterEach } from 'vitest';

describe('Firestore Security Rules', () => {
  let testEnv;

  beforeEach(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'vapour-toolbox-test',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Users collection', () => {
    it('should allow users to read their own document', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertSucceeds(alice.firestore().collection('users').doc('alice').get());
    });

    it('should deny users from reading other user documents', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertFails(alice.firestore().collection('users').doc('bob').get());
    });

    it('should deny unauthenticated reads', async () => {
      const unauthed = testEnv.unauthenticatedContext();
      await assertFails(unauthed.firestore().collection('users').doc('alice').get());
    });
  });

  describe('Entities collection', () => {
    it('should allow authenticated users to read entities', async () => {
      const alice = testEnv.authenticatedContext('alice');
      await assertSucceeds(alice.firestore().collection('entities').doc('entity1').get());
    });
  });

  // Add more tests for transactions, projects, etc.
});
EOF

# Add to package.json
"scripts": {
  "test:rules": "vitest run tests/firestore.rules.test.ts"
}
```

```yaml
# .github/workflows/ci.yml - Add new job
firestore-rules-test:
  name: Firestore Rules Tests
  runs-on: ubuntu-latest
  timeout-minutes: 5

  steps:
    - uses: actions/checkout@v4

    - name: Setup pnpm
      uses: pnpm/action-setup@v4
      with:
        version: 10.19.0

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Run Firestore rules tests
      run: pnpm test:rules

# Update ci-success job to depend on this:
ci-success:
  needs: [lint-and-typecheck, build, pre-deployment-checks, security-audit, firestore-rules-test]
```

**Files:**

- `package.json` (add `@firebase/rules-unit-testing`, `vitest`)
- `tests/firestore.rules.test.ts` (new file)
- `.github/workflows/ci.yml` (add new job)

**Estimated Effort:** 4 hours

---

### ✅ 9. Enable Dependabot for Dependency Updates

**Status:** ⏳ PENDING
**Assigned:** -
**Due:** 2025-12-06

**Current State:**

- ❌ No automated dependency updates
- Risk: Outdated dependencies with known vulnerabilities

**Action Items:**

- [ ] Create `.github/dependabot.yml` configuration
- [ ] Enable Dependabot security updates in repo settings
- [ ] Configure auto-merge for patch updates (optional)
- [ ] Set up weekly dependency update PRs

**Implementation:**

```yaml
# .github/dependabot.yml (NEW FILE)
version: 2
updates:
  # Root workspace
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '09:00'
    open-pull-requests-limit: 10
    reviewers:
      - 'sekkizharvdt'
    labels:
      - 'dependencies'
      - 'automated'
    commit-message:
      prefix: 'chore'
      include: 'scope'

  # Web app
  - package-ecosystem: 'npm'
    directory: '/apps/web'
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '09:00'
    open-pull-requests-limit: 5

  # Functions
  - package-ecosystem: 'npm'
    directory: '/functions'
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '09:00'
    open-pull-requests-limit: 5

  # GitHub Actions
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '09:00'
    open-pull-requests-limit: 5
```

**Files:**

- `.github/dependabot.yml` (new file)
- Repository settings: Enable "Dependency graph" and "Dependabot security updates"

**Estimated Effort:** 30 minutes

---

## 🟡 MEDIUM PRIORITY (Complete This Quarter)

### ✅ 10. Fix TypeScript Config Inconsistency

**Status:** ⏳ PENDING
**Assigned:** -
**Due:** 2025-12-31

**Current State:**

- ⚠️ Root `tsconfig.json` has both `declaration: true` and `noEmit: true`
- This is contradictory (noEmit prevents declarations from being written)

**Action Items:**

- [ ] Create `tsconfig.base.json` for shared strict settings
- [ ] Update root `tsconfig.json` to be reference-only
- [ ] Update package-level configs to extend base
- [ ] Consider TypeScript project references for monorepo

**Implementation:**

```json
// tsconfig.base.json (NEW FILE)
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "jsx": "preserve",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "isolatedModules": true
  }
}

// tsconfig.json (UPDATED)
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
    // REMOVE: "declaration": true
    // REMOVE: "declarationMap": true
    // REMOVE: "sourceMap": true
    // REMOVE: "outDir": "./dist"
  },
  "exclude": ["node_modules", "dist", ".next", ".turbo"]
}

// packages/*/tsconfig.json (EXAMPLE)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "noEmit": false
  }
}
```

**Files:**

- `tsconfig.base.json` (new file)
- `tsconfig.json` (update)
- `packages/*/tsconfig.json` (update all package configs)

**Estimated Effort:** 2 hours

---

### ✅ 11. Add CodeQL Security Scanning

**Status:** ⏳ PENDING
**Assigned:** -
**Due:** 2025-12-31

**Current State:**

- ❌ No static application security testing (SAST)
- GitHub CodeQL can detect security vulnerabilities in code

**Action Items:**

- [ ] Enable CodeQL in repository settings
- [ ] Create `.github/workflows/codeql.yml`
- [ ] Configure JavaScript/TypeScript analysis
- [ ] Review and fix initial findings
- [ ] Set up automated scanning on PRs

**Implementation:**

```yaml
# .github/workflows/codeql.yml (NEW FILE)
name: 'CodeQL Security Scan'

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 6 * * 1' # Weekly on Monday at 6 AM UTC

jobs:
  analyze:
    name: Analyze Code
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      actions: read
      contents: read
      security-events: write

    strategy:
      fail-fast: false
      matrix:
        language: ['javascript']

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: +security-and-quality

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: '/language:${{ matrix.language }}'
```

**Files:**

- `.github/workflows/codeql.yml` (new file)
- Repository settings: Enable "Code scanning alerts"

**Estimated Effort:** 1 hour

---

### ✅ 12. Add Unit Tests to CI

**Status:** ⏳ PENDING
**Assigned:** -
**Due:** 2025-12-31

**Current State:**

- ❌ No unit tests in CI pipeline
- CI only runs lint/typecheck/build

**Action Items:**

- [ ] Choose test framework (Vitest recommended for monorepo)
- [ ] Add sample unit tests for utility functions
- [ ] Add unit test job to CI workflow
- [ ] Set up code coverage reporting
- [ ] Optionally enforce minimum coverage threshold

**Implementation:**

```bash
# Install Vitest
pnpm add -D vitest @vitest/ui

# Add to package.json
"scripts": {
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage"
}
```

```yaml
# .github/workflows/ci.yml - Add new job
unit-tests:
  name: Unit Tests
  runs-on: ubuntu-latest
  timeout-minutes: 10

  steps:
    - uses: actions/checkout@v4

    - name: Setup pnpm
      uses: pnpm/action-setup@v4
      with:
        version: 10.19.0

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Run unit tests
      run: pnpm test --run

    - name: Upload coverage reports
      uses: codecov/codecov-action@v4
      if: always()
# Update ci-success to depend on unit-tests
```

**Files:**

- `package.json` (add vitest)
- `vitest.config.ts` (new file)
- `.github/workflows/ci.yml` (add job)

**Estimated Effort:** 3 hours (initial setup + sample tests)

---

### ✅ 13. Add E2E Tests to CI (Scheduled)

**Status:** ⏳ PENDING
**Assigned:** -
**Due:** 2025-12-31

**Current State:**

- ✅ Playwright infrastructure exists
- ❌ Not running in CI (expensive to run on every commit)

**Action Items:**

- [ ] Create scheduled workflow for nightly E2E tests
- [ ] Configure Playwright to run against production/staging
- [ ] Set up test artifacts upload on failure
- [ ] Configure notifications for E2E failures
- [ ] Optionally run E2E on PRs to main (manual trigger)

**Implementation:**

```yaml
# .github/workflows/e2e-scheduled.yml (NEW FILE)
name: E2E Tests - Scheduled

on:
  schedule:
    - cron: '0 3 * * *' # 3 AM UTC daily
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to test'
        required: true
        default: 'production'
        type: choice
        options:
          - production
          - staging

jobs:
  e2e-tests:
    name: Playwright E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.19.0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          BASE_URL: https://vapour-toolbox.web.app

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 7

      - name: Create issue on failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🚨 E2E tests failed in production',
              body: 'The nightly E2E test run failed. Please review the Playwright report in the workflow artifacts.',
              labels: ['e2e', 'bug']
            })
```

**Files:**

- `.github/workflows/e2e-scheduled.yml` (new file)

**Estimated Effort:** 2 hours

---

### ✅ 14. Add Health Check Endpoint

**Status:** ⏳ PENDING
**Assigned:** -
**Due:** 2025-12-31

**Current State:**

- ⚠️ Post-deployment health check is a placeholder (deploy.yml:102-107)
- No actual endpoint to verify app is working

**Action Items:**

- [ ] Create `/api/health` endpoint in Next.js
- [ ] Return app version, build timestamp, Firebase status
- [ ] Add health check to post-deployment workflow
- [ ] Consider adding to monitoring/uptime checks

**Implementation:**

```typescript
// apps/web/src/app/api/health/route.ts (NEW FILE)
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    environment: process.env.NODE_ENV,
  });
}
```

```yaml
# .github/workflows/deploy.yml - Update health check (lines 102-107)
- name: Post-deployment Health Check
  run: |
    echo "🔍 Running post-deployment health check..."

    # Wait for deployment to propagate
    sleep 10

    # Check health endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://vapour-toolbox.web.app/api/health)
    if [ $HTTP_CODE -eq 200 ]; then
      echo "✅ Health check passed! (HTTP $HTTP_CODE)"
    else
      echo "❌ Health check failed! (HTTP $HTTP_CODE)"
      exit 1
    fi

    # Check actual page loads
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://vapour-toolbox.web.app)
    if [ $HTTP_CODE -eq 200 ]; then
      echo "✅ Homepage loads successfully! (HTTP $HTTP_CODE)"
    else
      echo "❌ Homepage failed to load! (HTTP $HTTP_CODE)"
      exit 1
    fi
```

**Note:** Next.js API routes may not work with static export (`output: 'export'`). Alternative: Create a static `health.json` file generated at build time.

**Files:**

- `apps/web/public/health.json` (generated at build)
- `.github/workflows/deploy.yml` (update health check)

**Estimated Effort:** 1 hour

---

## 🟢 LOW PRIORITY (Nice-to-Have)

### ✅ 15. Create Security Documentation

**Status:** ⏳ PENDING
**Assigned:** -
**Due:** 2026-01-31

**Action Items:**

- [ ] Create `docs/SECURITY.md` with security policies
- [ ] Document principle of least privilege for service accounts
- [ ] Document incident response process
- [ ] Document vulnerability disclosure policy
- [ ] Add security contact email

**Implementation:**

```markdown
# docs/SECURITY.md (NEW FILE)

## Security Policy

### Supported Versions

Currently supporting security updates for the latest version on `main` branch.

### Reporting a Vulnerability

Email security concerns to: security@vapourdesal.com

Do not create public GitHub issues for security vulnerabilities.

### Security Measures

1. **Authentication:** Firebase Authentication with custom claims
2. **Authorization:** Firestore security rules + backend validation
3. **Data Encryption:** TLS 1.3 in transit, AES-256 at rest (Firebase default)
4. **Service Accounts:** Least-privilege access, OIDC authentication
5. **Headers:** CSP, HSTS, X-Frame-Options, X-Content-Type-Options

### Service Account Permissions

- `github-actions@vapour-toolbox.iam.gserviceaccount.com`:
  - `roles/firebase.admin` - Hosting deployment
  - `roles/cloudfunctions.developer` - Functions deployment
  - `roles/datastore.indexAdmin` - Firestore indexes
  - `roles/firebaserules.system` - Firestore rules

### Security Checklist for Deployments

- [ ] All CI checks pass
- [ ] Security audit shows no high-severity vulnerabilities
- [ ] Firestore rules tests pass
- [ ] No secrets in code or environment variables
- [ ] CSP violations reviewed and resolved
```

**Files:**

- `docs/SECURITY.md` (new file)
- `README.md` (add security policy link)

**Estimated Effort:** 2 hours

---

### ✅ 16. Add Secret Scanning Pre-commit Hook

**Status:** ⏳ PENDING
**Assigned:** -
**Due:** 2026-01-31

**Action Items:**

- [ ] Install `git-secrets` or `gitleaks`
- [ ] Configure patterns for Firebase keys, GCP service accounts
- [ ] Add to Husky pre-commit hook
- [ ] Test with dummy secrets

**Implementation:**

```bash
# Install gitleaks
brew install gitleaks  # macOS
# or
curl -sSfL https://raw.githubusercontent.com/gitleaks/gitleaks/master/scripts/install.sh | sh -s -- -b /usr/local/bin

# Add to .husky/pre-commit
npx gitleaks protect --staged --verbose
```

```yaml
# .gitleaks.toml (NEW FILE)
[extend]
useDefault = true

[[rules]]
description = "Firebase Service Account JSON"
regex = '''(?i)(service.*account.*key|serviceAccountKey)\.json'''
path = '''.*'''

[[rules]]
description = "Google Cloud API Key"
regex = '''AIza[0-9A-Za-z\-_]{35}'''

[[rules]]
description = "Firebase API Key (public - allowed in code)"
regex = '''AIzaSyCxzqzAUTT3Ouiv-szpfO1Au4LwEMnP-4w'''
allowlist.regexes = ['''AIzaSyCxzqzAUTT3Ouiv-szpfO1Au4LwEMnP-4w''']
```

**Files:**

- `.gitleaks.toml` (new file)
- `.husky/pre-commit` (add gitleaks check)

**Estimated Effort:** 1 hour

---

### ✅ 17. Optimize Cache Headers & Performance

**Status:** ⏳ PENDING
**Assigned:** -
**Due:** 2026-01-31

**Action Items:**

- [ ] Review current cache headers (31536000 = 1 year)
- [ ] Add cache-busting for HTML files
- [ ] Configure different cache durations for asset types
- [ ] Test with Lighthouse/PageSpeed Insights

**Implementation:**

```json
// firebase.json - Optimize headers (lines 52-60)
{
  "source": "**/*.@(html|json)",
  "headers": [
    {
      "key": "Cache-Control",
      "value": "public, max-age=0, must-revalidate"
    }
  ]
},
{
  "source": "**/*.@(js|css)",
  "headers": [
    {
      "key": "Cache-Control",
      "value": "public, max-age=31536000, immutable"
    }
  ]
},
{
  "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|woff|woff2)",
  "headers": [
    {
      "key": "Cache-Control",
      "value": "public, max-age=31536000, immutable"
    }
  ]
}
```

**Files:**

- `firebase.json` (update cache headers)

**Estimated Effort:** 1 hour

---

## 📋 Implementation Tracking

### Week 1 (Nov 6-13, 2025) - CRITICAL ✅ **ALL COMPLETE**

- [✅] #1: Verify service account permissions (COMPLETED - Audit 2025-11-06)
- [✅] #2: Add CSP header (COMPLETED - Commit 3795d5f)
- [✅] #3: Add HSTS header (COMPLETED - Commit 3795d5f)
- [✅] #4: Remove X-XSS-Protection (COMPLETED - Commit 3795d5f)
- [✅] #5: Remove continue-on-error flags (COMPLETED - Commit 3795d5f)

**Estimated Total:** 4 hours
**Actual Time:** ~2 hours (All tasks completed 2025-11-06)
**Status:** ✅ **100% COMPLETE** - All Week 1 CRITICAL tasks finished!

### Month 1 (Nov 13 - Dec 6, 2025) - HIGH

- [ ] #6: Migrate to OIDC
- [ ] #7: Add dev dependency audit
- [ ] #8: Add Firestore rules tests
- [ ] #9: Enable Dependabot

**Estimated Total:** 9 hours

### Quarter 1 (Dec 6 - Dec 31, 2025) - MEDIUM

- [ ] #10: Fix TypeScript config
- [ ] #11: Add CodeQL scanning
- [ ] #12: Add unit tests to CI
- [ ] #13: Add E2E tests (scheduled)
- [ ] #14: Add health check endpoint

**Estimated Total:** 9 hours

### Quarter 2 (Jan 1 - Jan 31, 2026) - LOW

- [ ] #15: Create security documentation
- [ ] #16: Add secret scanning hook
- [ ] #17: Optimize cache headers

**Estimated Total:** 4 hours

---

## 📞 Contact & Questions

**For OIDC migration (requires GCP owner):**

- Need: GCP Project Owner access
- Contact: Project admin for permissions

**For security policy questions:**

- Contact: security@vapourdesal.com

**For implementation help:**

- See individual task "Implementation" sections above
- Reference external review in SESSION_LOG.md

---

---

## 🛡️ Vulnerability Decisions

### CVE-2025-59472: Next.js PPR Memory Exhaustion

**Status:** ✅ NOT AFFECTED (Documented 2026-01-29)
**CVE:** CVE-2025-59472
**GHSA:** GHSA-5f7q-jpqc-wp7h
**Severity:** Moderate (CVSS 5.9)

**Vulnerability Summary:**
Denial of service via unbounded memory consumption in Next.js with Partial Prerendering (PPR) enabled in minimal mode. Allows V8 out-of-memory errors through unbounded request buffering or zipbomb decompression.

**Affected Versions:**

- Next.js ≥ 15.0.0-canary.0, < 15.6.0-canary.61
- Requires: `experimental.ppr: true` OR `cacheComponents: true` with `NEXT_PRIVATE_MINIMAL_MODE=1`

**Our Configuration (next.config.ts):**

- `experimental.ppr`: **NOT ENABLED** ❌
- `output: 'export'`: Static export mode (no Node.js server) ✅
- `NEXT_PRIVATE_MINIMAL_MODE`: **NOT SET** ❌

**Decision:** Accept vulnerability as **NOT APPLICABLE**

- App uses static export (`output: 'export'`)
- Served via Firebase Hosting (static files, no Node.js runtime)
- PPR feature not enabled and not needed for current architecture
- No server-side Node.js process to attack

**Future Action Required:**

- If migrating to server-side rendering with PPR, upgrade to Next.js ≥ 15.6.0 first
- Monitor for related CVEs if architecture changes

---

**Last Updated:** 2026-01-29
**Review Date:** External security review on 2025-11-06
**Next Review:** 2026-02-01 (after Q1 tasks complete)
