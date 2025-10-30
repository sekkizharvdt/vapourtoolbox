# E2E Testing Guide - Firebase Emulator Setup

## Overview

This project uses Playwright for E2E testing with Firebase Emulator for local testing.

## Current Status

### ✅ Working Tests
- Homepage/landing page tests
- Login page UI tests
- Protected route redirect tests
- Navigation tests
- Responsive design tests

### ⏳ Pending (Requires Auth Setup)
- Google OAuth sign-in flow
- Dashboard access tests
- Entity CRUD operations
- Project management tests
- User management tests

## Quick Start

### Option 1: Test Public Pages Only (Recommended for now)

```bash
# Run E2E tests (skips auth-required tests)
cd apps/web
pnpm test:e2e
```

### Option 2: Full Testing with Firebase Emulator

**Note:** Google OAuth testing with emulator requires additional setup.

```bash
# Terminal 1: Start Firebase Emulator
pnpm emulator

# Terminal 2: Seed test data
pnpm emulator:seed

# Terminal 3: Run E2E tests
pnpm test:e2e
```

## Firebase Emulator Configuration

### Ports
- **Auth Emulator**: 9099
- **Firestore Emulator**: 8080
- **Functions Emulator**: 5001
- **Hosting Emulator**: 5000
- **Emulator UI**: 4000

### Test Users (Created by seed script)
- **Admin**: test-admin@vapourtoolbox.com
- **User**: test-user@vapourtoolbox.com
- **Pending**: test-pending@vapourtoolbox.com

## Google OAuth Testing Challenge

**Why authenticated tests are skipped:**

The application uses **Google Sign-In only** (no email/password forms). Testing Google OAuth requires:

1. **Firebase Emulator Limitations**
   - Emulator doesn't fully simulate Google OAuth popup
   - `signInWithPopup()` requires browser interaction
   - Cannot automate real Google OAuth in tests

2. **Possible Solutions** (Choose one):

   ### A. Mock Google OAuth (Recommended for E2E)
   ```typescript
   // Inject mock auth state in browser context
   await page.evaluate(() => {
     // Mock Firebase auth state
     localStorage.setItem('firebase:authUser', JSON.stringify({
       uid: 'test-user-001',
       email: 'test@example.com',
       emailVerified: true,
     }));
   });
   ```

   ### B. Use Firebase Admin SDK in Tests
   ```typescript
   // Create custom token and use it in browser
   const customToken = await admin.auth().createCustomToken('test-user-001');
   await page.evaluate((token) => {
     firebase.auth().signInWithCustomToken(token);
   }, customToken);
   ```

   ### C. Use Test Email/Password Provider
   - Add email/password auth to Firebase (for testing only)
   - Create test login flow separate from production
   - Switch based on environment

   ### D. Manual Testing
   - Keep authenticated tests as manual test cases
   - Use emulator for development/debugging only

## Implementation Roadmap

### Phase 1: Public Pages (✅ Complete)
- [x] Homepage tests
- [x] Login page UI tests
- [x] Protected route redirects
- [x] Navigation tests
- [x] Playwright configuration
- [x] Firebase Emulator setup

### Phase 2: Authentication (🔄 In Progress)
- [x] Firebase Emulator configuration
- [x] Test user seed scripts
- [ ] Mock Google OAuth in tests
- [ ] Authentication helper functions
- [ ] Login flow tests

### Phase 3: Authenticated Features (⏳ Pending)
- [ ] Dashboard tests
- [ ] Entity CRUD tests
- [ ] Project management tests
- [ ] User management tests
- [ ] Permission-based access tests

## Test Structure

```
apps/web/e2e/
├── helpers/
│   └── auth.ts              # Auth helpers (needs OAuth mocking)
├── 01-homepage.spec.ts      # ✅ Working
├── 02-authentication.spec.ts # ⚠️  Partially working
├── 03-navigation.spec.ts    # ✅ Working
├── 04-dashboard.spec.ts     # ⏭️  Skipped (needs auth)
├── 05-entities.spec.ts      # ⏭️  Skipped (needs auth)
└── README.md
```

## Running Tests

```bash
# All tests (chromium only, fast)
pnpm test:e2e --project=chromium

# All browsers
pnpm test:e2e

# Interactive UI mode
pnpm test:e2e:ui

# Debug mode
pnpm test:e2e:debug

# Specific test file
pnpm test:e2e e2e/01-homepage.spec.ts
```

## CI/CD Integration

Tests run automatically in GitHub Actions on every PR. Only public page tests run in CI until OAuth mocking is implemented.

## Next Steps

To enable full E2E testing with authentication:

1. **Choose authentication testing approach** (see options above)
2. **Implement chosen solution** in `e2e/helpers/auth.ts`
3. **Un-skip authenticated tests** in spec files
4. **Update CI/CD** to run full test suite
5. **Add test data cleanup** between test runs

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Testing Firebase Auth](https://firebase.google.com/docs/emulator-suite/connect_auth)

## Current Test Results

**Last Run:**
- ✅ 6 tests passed
- ⏭️  15 tests skipped (auth required)
- 🏃 Total: 21 tests

**Test Coverage:**
- Public pages: 100%
- Authenticated pages: 0% (pending OAuth mock)
