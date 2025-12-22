# E2E Testing Guide

This guide documents how to set up and run end-to-end tests for the Vapour Toolbox application using Playwright.

## Prerequisites

1. **Firebase Emulators** - Required for authentication tests
2. **Dev Server** - The Next.js development server
3. **Playwright** - Already installed in the project

## Quick Start

```bash
# Terminal 1: Start Firebase Emulators
firebase emulators:start --only auth,firestore

# Terminal 2: Start Dev Server with Emulator Mode
cd apps/web
NEXT_PUBLIC_USE_EMULATOR=true pnpm dev --port 3001

# Terminal 3: Run E2E Tests
cd apps/web
NEXT_PUBLIC_USE_EMULATOR=true pnpm exec playwright test --reporter=list
```

## CI/CD Integration

### GitHub Actions Workflow

E2E tests run **on-demand only** via GitHub Actions to save CI resources. They are not run on every push.

**To run E2E tests:**

1. Go to **Actions** tab in GitHub
2. Select **E2E Tests** workflow
3. Click **Run workflow**
4. Choose browser (chromium, firefox, webkit, or all)

The workflow is defined in `.github/workflows/e2e.yml` and:

- Starts Firebase emulators automatically
- Builds necessary packages
- Runs Playwright tests with proper environment variables
- Uploads test reports and screenshots as artifacts

### Required Environment Variables for CI

When running E2E tests in CI, these environment variables must be set:

```yaml
# Firebase client config
NEXT_PUBLIC_USE_EMULATOR: 'true'
NEXT_PUBLIC_FIREBASE_API_KEY: <your-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: <your-auth-domain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID: <your-project-id>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: <your-storage-bucket>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: <your-sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID: <your-app-id>

# Emulator URLs for the web app to connect to
NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_URL: http://127.0.0.1:9099
NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_URL: 127.0.0.1:8080

# Emulator host configuration (for firebase-admin SDK)
FIREBASE_AUTH_EMULATOR_HOST: 127.0.0.1:9099
FIRESTORE_EMULATOR_HOST: 127.0.0.1:8080
```

## Architecture Overview

### Authentication Flow

Firebase Auth stores state in **IndexedDB**, which is NOT captured by Playwright's `storageState`. This means:

1. The `auth.setup.ts` runs first to create a test user in the emulator
2. Each test must re-authenticate using the `signInForTest()` helper
3. Auth status is communicated between setup and tests via a JSON file (`e2e/.auth/status.json`)

### How Test User Creation Works

The test setup (`auth.setup.ts`):

1. **Deletes any existing test user** to ensure fresh credentials
2. **Creates a new user** with known email/password via `firebase-admin`
3. **Sets custom claims** (permissions, domain, department)
4. **Creates a Firestore user document** with active status
5. **Signs in via the app** using `signInWithEmailAndPassword`
6. **Writes status file** for test coordination

This approach ensures the password always matches what we're trying to sign in with (the emulator may have stale users from previous runs).

### Key Files

```
apps/web/e2e/
├── auth.setup.ts       # Creates test user and seeds test data in Firebase emulator
├── auth.helpers.ts     # Shared auth helpers (signInForTest, isTestUserReady)
├── critical-path.spec.ts # Basic app functionality tests
├── entities.spec.ts    # Entities module tests (31 tests - full coverage)
├── feedback.spec.ts    # Feedback module tests (44 tests)
└── .auth/
    ├── user.json       # Playwright storage state (cookies/localStorage)
    └── status.json     # Auth status for test coordination
```

## Writing New E2E Tests

### 1. Create the Test File

```typescript
// e2e/your-module.spec.ts
import { test, expect, Page } from '@playwright/test';
import { signInForTest, isTestUserReady } from './auth.helpers';

// Helper to navigate with authentication
async function navigateToYourPage(page: Page): Promise<boolean> {
  // Try navigating directly first
  await page.goto('/your-page');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000); // React hydration time

  // Check if authenticated
  const isOnPage = await page
    .getByText(/Your Page Title/i)
    .isVisible()
    .catch(() => false);
  if (isOnPage) return true;

  // Not authenticated - try signing in
  const testUserReady = await isTestUserReady();
  if (!testUserReady) return false;

  const signedIn = await signInForTest(page);
  if (!signedIn) return false;

  // Navigate after sign in
  await page.goto('/your-page');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  return await page
    .getByText(/Your Page Title/i)
    .isVisible()
    .catch(() => false);
}

test.describe('Your Module', () => {
  test('should load the page', async ({ page }) => {
    const isAuthenticated = await navigateToYourPage(page);

    if (!isAuthenticated) {
      test.skip(true, 'Requires authentication');
      return;
    }

    await expect(page.getByText(/Your Page Title/i)).toBeVisible();
  });
});
```

### 2. MUI Component Selectors

MUI components require specific selector strategies:

#### TextFields (Input Fields)

```typescript
// DON'T use getByLabel for MUI TextFields (floating labels don't work)
await page.getByLabel(/Title/i); // ❌ Won't work reliably

// DO use getByPlaceholder
await page.getByPlaceholder(/Enter title/i); // ✅ Works

// Or find by the label text and then the input
const titleField = page.locator('label:has-text("Title")').locator('..').locator('input');
```

#### Select Dropdowns

```typescript
// MUI Select with InputLabel
await page.getByLabel(/Module/i).click();
await page.getByRole('option', { name: /Accounting/i }).click();

// MUI Select without label (use combobox role)
await page.getByRole('combobox').first().click();
await page.getByRole('option', { name: /Option/i }).click();
```

#### Buttons

```typescript
// Standard buttons
await page.getByRole('button', { name: /Submit/i }).click();

// Icon buttons (use aria-label)
await page.getByRole('button', { name: /View details/i }).click();

// Toggle buttons (check pressed state)
const toggleBtn = page.getByRole('button', { name: /Bugs/i });
await toggleBtn.click();
await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
```

#### Dialogs

```typescript
// Wait for dialog to open
await expect(page.getByRole('dialog')).toBeVisible();

// Close dialog
await page.getByRole('button', { name: /Close/i }).click();
await expect(page.getByRole('dialog')).not.toBeVisible();
```

### 3. Handling Elements Below the Fold

```typescript
// Scroll to element before interacting
const submitButton = page.getByRole('button', { name: /Submit/i });
await submitButton.scrollIntoViewIfNeeded();
await submitButton.click();

// Or scroll to a section header first
const detailsSection = page.getByText('Details', { exact: true });
await detailsSection.scrollIntoViewIfNeeded();
```

### 4. Avoiding Strict Mode Violations

When multiple elements match a selector:

```typescript
// DON'T use getByText when text appears multiple times
await page.getByText(/Bug Report/i).click(); // ❌ May match multiple elements

// DO use more specific selectors
await page.getByRole('button', { name: /Bug Report/i }).click(); // ✅ Specific

// Or use .first() / .nth() when needed
await page.getByRole('button', { name: /View/i }).first().click();
```

**Important:** When testing login page buttons, be specific to avoid matching both "Sign in with Google" and "Send sign-in link" buttons:

```typescript
// DON'T use generic "sign in" selector
await page.getByRole('button', { name: /sign in/i }); // ❌ Matches 2 buttons

// DO use specific button text
await page.getByRole('button', { name: /sign in with google/i }); // ✅ Specific
```

### 5. Wait Strategies

```typescript
// DON'T use networkidle (can timeout with SSR/websockets)
await page.waitForLoadState('networkidle'); // ❌ May timeout

// DO use domcontentloaded + timeout
await page.waitForLoadState('domcontentloaded'); // ✅
await page.waitForTimeout(1000); // For React hydration

// Or wait for specific elements
await expect(page.getByText(/Page Title/i)).toBeVisible({ timeout: 15000 });
```

### 6. Form Validation Testing

```typescript
// Browser native validation may intercept before custom validation
// Test that form doesn't submit rather than specific error messages
await submitButton.click();
await expect(page.getByText(/Page Title/i)).toBeVisible(); // Still on page = didn't submit
```

## Test User Configuration

The test user is created in `auth.setup.ts`:

```typescript
const TEST_USER = {
  email: 'e2e-test@vapourdesal.com',
  password: 'testpassword123',
  displayName: 'E2E Test User',
};

const TEST_USER_CLAIMS = {
  permissions: 0x783fffff, // Full permissions (getAllPermissions())
  domain: 'internal',
  department: 'Engineering',
};
```

To test with different permission levels, modify the claims in `auth.setup.ts` or create additional test users.

## Playwright Configuration

Key settings in `playwright.config.ts` for WSL/low-memory environments:

```typescript
{
  workers: 1,              // Single worker to prevent memory issues
  fullyParallel: false,    // Sequential test execution
  video: 'off',            // Disable video recording
  reuseExistingServer: true, // Don't spawn new dev servers
}
```

## Running Tests

```bash
# Run all e2e tests
NEXT_PUBLIC_USE_EMULATOR=true pnpm exec playwright test

# Run specific test file
NEXT_PUBLIC_USE_EMULATOR=true pnpm exec playwright test e2e/feedback.spec.ts

# Run with specific test name
NEXT_PUBLIC_USE_EMULATOR=true pnpm exec playwright test --grep "should load"

# Run in headed mode (see browser)
NEXT_PUBLIC_USE_EMULATOR=true pnpm exec playwright test --headed

# Run in debug mode
NEXT_PUBLIC_USE_EMULATOR=true pnpm exec playwright test --debug

# Generate test report
NEXT_PUBLIC_USE_EMULATOR=true pnpm exec playwright test --reporter=html
```

## Debugging Failed Tests

1. **Check screenshots** in `test-results/` directory
2. **Run in headed mode** to see what's happening
3. **Use Playwright Inspector**: `pnpm exec playwright test --debug`
4. **Check the error context** files in test-results
5. **Download CI artifacts** from GitHub Actions for playwright-report and screenshots

## Common Issues

### Tests timeout on `waitForLoadState('networkidle')`

Use `domcontentloaded` instead:

```typescript
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1000);
```

### `getByLabel` doesn't find MUI TextField

MUI uses floating labels. Use `getByPlaceholder` instead:

```typescript
await page.getByPlaceholder(/Enter value/i);
```

### Strict mode violation (multiple elements)

Use more specific selectors or `.first()`:

```typescript
await page.getByRole('button', { name: /Submit/i }).first();
```

### Firebase emulator not running

Start it with:

```bash
firebase emulators:start --only auth,firestore
```

### WSL disconnects during tests

Reduce resource usage in `playwright.config.ts`:

```typescript
workers: 1,
fullyParallel: false,
video: 'off',
```

### auth/invalid-credential error

This happens when the test user exists in the emulator with a different password from a previous run. The fix (already implemented in `auth.setup.ts`) is to always delete and recreate the user:

```typescript
// Always delete and recreate to ensure password is correct
try {
  const existingUser = await auth.getUserByEmail(TEST_USER.email);
  await auth.deleteUser(existingUser.uid);
} catch {
  // User doesn't exist, that's fine
}

// Create fresh user with known password
userRecord = await auth.createUser({
  email: TEST_USER.email,
  password: TEST_USER.password,
  ...
});
```

### E2E sign-in method not available

This error means `NEXT_PUBLIC_USE_EMULATOR=true` is not set. The `__e2eSignIn` method is only exposed when running in emulator mode.

### Web app not connecting to emulators

Ensure these environment variables are set:

```bash
NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_URL=http://127.0.0.1:9099
NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_URL=127.0.0.1:8080
```

These are required for the web app (client-side) to connect to the emulators. The `FIREBASE_AUTH_EMULATOR_HOST` and `FIRESTORE_EMULATOR_HOST` variables are only for the firebase-admin SDK (server-side/test setup).

## Module Test Checklist

When creating tests for a new module:

- [ ] Create navigation helper with auth handling
- [ ] Test page loads correctly
- [ ] Test form submissions (if applicable)
- [ ] Test validation errors
- [ ] Test different user flows
- [ ] Test responsive design (mobile/tablet viewports)
- [ ] Test keyboard navigation (accessibility)
- [ ] Handle elements below the fold with `scrollIntoViewIfNeeded()`
- [ ] Use correct MUI selectors
- [ ] Gracefully skip tests when auth unavailable
- [ ] Use specific selectors (e.g., `/sign in with google/i` not `/sign in/i`)

## Advanced Patterns (Learned from Entities Module)

### 1. Shared Authentication Session

For faster tests, sign in once and reuse the session across tests:

```typescript
let sharedContext: BrowserContext | null = null;
let sharedPage: Page | null = null;
let isAuthenticated = false;

test.describe('Your Module', () => {
  test.beforeAll(async ({ browser }) => {
    const testUserReady = await isTestUserReady();
    if (!testUserReady) return;

    sharedContext = await browser.newContext();
    sharedPage = await sharedContext.newPage();
    isAuthenticated = await signInForTest(sharedPage);
  });

  test.afterAll(async () => {
    if (sharedPage) await sharedPage.close();
    if (sharedContext) await sharedContext.close();
    sharedPage = null;
    sharedContext = null;
    isAuthenticated = false;
  });

  // Tests use getAuthenticatedPage() instead of creating new pages
});
```

**Performance Impact**: Reduced test suite time from ~30 minutes to ~4 minutes.

### 2. Seeding Test Data

When tests need data (entities, documents, etc.), seed them in `auth.setup.ts`:

```typescript
const TEST_ENTITIES = [
  {
    id: 'e2e-entity-active-vendor',
    code: 'ENT-E2E-001',
    name: 'E2E Test Vendor',
    isActive: true,
    isArchived: false,
  },
  // More entities...
];

async function seedTestEntities(): Promise<boolean> {
  const firestore = admin.firestore();
  const now = new Date();
  const batch = firestore.batch();

  for (const [i, entity] of TEST_ENTITIES.entries()) {
    const docRef = firestore.collection('entities').doc(entity.id);
    // Use different timestamps for predictable sort order
    const entityTime = new Date(now.getTime() - (entity.isArchived ? 10000 : i * 1000));
    batch.set(docRef, {
      ...entity,
      createdAt: admin.firestore.Timestamp.fromDate(entityTime),
      updatedAt: admin.firestore.Timestamp.fromDate(entityTime),
    });
  }
  await batch.commit();
  return true;
}
```

**Important**: Use different timestamps if your query sorts by `createdAt` to ensure predictable ordering.

### 3. Force Token Refresh After Admin SDK Claims

When `auth.setup.ts` sets custom claims via Admin SDK, the client doesn't automatically get them:

```typescript
// In AuthContext.tsx - expose method for E2E tests
if (process.env.NEXT_PUBLIC_USE_EMULATOR === 'true') {
  extWin.__e2eForceTokenRefresh = async () => {
    const { auth } = getFirebase();
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true); // Force refresh
      await auth.currentUser.getIdTokenResult(true);
    }
  };
}

// In auth.setup.ts - call after sign in
await page.evaluate(async () => {
  const win = window as Window & { __e2eForceTokenRefresh?: () => Promise<void> };
  if (win.__e2eForceTokenRefresh) {
    await win.__e2eForceTokenRefresh();
  }
});
```

### 4. Wait for Data to Load

After navigation, wait for actual data (not just the page shell):

```typescript
async function getAuthenticatedPage(): Promise<Page | null> {
  if (!isAuthenticated || !sharedPage) return null;

  await sharedPage.goto('/entities');
  await sharedPage.waitForLoadState('domcontentloaded');

  // Wait for page subtitle (confirms auth worked)
  const pageReady = await sharedPage
    .getByText(/Manage vendors, customers, and business partners/i)
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (!pageReady) return null;

  // Wait for table data to load from Firestore
  await sharedPage
    .locator('table')
    .or(sharedPage.getByText(/No entities yet/i))
    .or(sharedPage.getByText(/E2E Test/i))
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => console.log('Timeout waiting for table'));

  return sharedPage;
}
```

### 5. MUI Select Dropdowns

MUI Select components don't use standard `<label>` association. Use text content:

```typescript
// DON'T use getByLabel for MUI Select
await page.getByLabel(/Status/i); // ❌ Won't find it

// DO use getByText with .first() (label appears twice in MUI Select)
await page
  .getByText(/All Status/i)
  .first()
  .click();
await page.getByRole('option', { name: /Active/i }).click();
```

### 6. Handle Duplicate Text (Sidebar + Page Title)

Text often appears in both sidebar navigation and page header:

```typescript
// DON'T rely on text that appears in sidebar
await page.getByText(/Entity Management/i); // ❌ Matches 2 elements

// DO use unique page subtitles
await page.getByText(/Manage vendors, customers, and business partners/i); // ✅ Unique

// OR use .first() when appropriate
await page.getByText(/Entity Management/i).first();
```

### 7. Responsive Test Considerations

On mobile/tablet, the sidebar may be collapsed:

```typescript
test('should work on mobile viewport', async () => {
  const page = await getAuthenticatedPage();
  await page.setViewportSize({ width: 375, height: 667 });
  await page.reload();

  // DON'T check for sidebar text
  await page.getByText(/Entity Management/i); // ❌ Sidebar hidden

  // DO check for main content area
  await page.getByText(/Manage vendors, customers, and business partners/i); // ✅
});
```

### 8. Graceful Empty State Handling

Tests should handle both data-present and empty states:

```typescript
test('should display table headers or empty state', async () => {
  const page = await getAuthenticatedPage();

  const hasTable = await page
    .locator('table')
    .isVisible()
    .catch(() => false);
  const hasEmptyState = await page
    .getByText(/No entities yet/i)
    .isVisible()
    .catch(() => false);

  if (hasEmptyState) {
    await expect(page.getByText(/No entities yet/i)).toBeVisible();
    return; // Test passes - empty state is valid
  }

  if (hasTable) {
    await expect(page.getByText(/Entity Name/i).first()).toBeVisible();
  }
});
```

## Exposed Window Globals for E2E

The app exposes these globals on `window` when `NEXT_PUBLIC_USE_EMULATOR=true`:

```typescript
interface Window {
  __authLoading?: boolean; // True while auth is loading
  __authUser?: boolean; // True if user is signed in
  __authClaims?: boolean; // True if claims are loaded
  __e2eSignIn?: (email: string, password: string) => Promise<void>;
  __e2eSignInWithToken?: (token: string) => Promise<void>;
  __e2eForceTokenRefresh?: () => Promise<void>;
}
```

Use these to wait for full auth state:

```typescript
await page.waitForFunction(
  () => {
    const win = window as Window & {
      __authLoading?: boolean;
      __authUser?: boolean;
      __authClaims?: boolean;
    };
    return win.__authLoading === false && win.__authUser === true && win.__authClaims === true;
  },
  { timeout: 15000 }
);
```
