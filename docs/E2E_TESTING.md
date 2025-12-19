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
NEXT_PUBLIC_USE_EMULATOR=true pnpm exec playwright test e2e/feedback.spec.ts --reporter=list
```

## Architecture Overview

### Authentication Flow

Firebase Auth stores state in **IndexedDB**, which is NOT captured by Playwright's `storageState`. This means:

1. The `auth.setup.ts` runs first to create a test user in the emulator
2. Each test must re-authenticate using the `signInForTest()` helper
3. Auth status is communicated between setup and tests via a JSON file (`e2e/.auth/status.json`)

### Key Files

```
apps/web/e2e/
├── auth.setup.ts       # Creates test user in Firebase emulator
├── auth.helpers.ts     # Shared auth helpers (signInForTest, isTestUserReady)
├── feedback.spec.ts    # Example test file
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
