# E2E Testing with Playwright

End-to-end tests for Vapour Toolbox using Playwright.

## Running Tests

```bash
# Run all tests (all browsers)
pnpm test:e2e

# Run tests in a specific browser
pnpm test:e2e --project=chromium
pnpm test:e2e --project=firefox
pnpm test:e2e --project=webkit

# Run tests in UI mode (interactive)
pnpm test:e2e:ui

# Run tests in debug mode
pnpm test:e2e:debug

# Run tests in headed mode (see browser)
pnpm test:e2e:headed

# View test report
pnpm test:e2e:report
```

## Test Structure

### 01-homepage.spec.ts
- Basic homepage/landing page tests
- Page title and responsiveness

### 02-authentication.spec.ts
- Login page tests
- Signup page tests
- Protected route redirects

### 03-navigation.spec.ts
- Navigation between pages
- Unauthorized/pending approval pages
- SEO meta tags

### 04-dashboard.spec.ts
- Dashboard access (requires authentication)
- Navigation menu
- **Currently skipped** - Requires authentication helpers

### 05-entities.spec.ts
- Entity management tests (requires authentication)
- CRUD operations
- **Currently skipped** - Requires authentication helpers

## Authentication Testing

For authenticated tests, you'll need to implement authentication helpers:

```typescript
// Example helper function
async function authenticateUser(page, email, password) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}
```

Then use it in tests:

```typescript
test('should access dashboard after login', async ({ page }) => {
  await authenticateUser(page, 'test@example.com', 'password');
  await page.goto('/dashboard');
  // ... assertions
});
```

## Configuration

Configuration is in `playwright.config.ts`:
- Base URL: `http://localhost:3001`
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- Automatic dev server startup
- Screenshots on failure
- Video recording on failure
- Trace on first retry

## Test Data

For comprehensive E2E testing, you'll need:
1. Test Firebase users
2. Test entities/projects
3. Test data cleanup between runs

Consider using Firebase Emulator for testing:

```bash
# Start Firebase emulators
firebase emulators:start

# Update playwright.config.ts to use emulator URLs
# NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost:9099
```

## CI/CD Integration

These tests can run in GitHub Actions. See `.github/workflows/playwright.yml` (when added) for CI configuration.

## Best Practices

1. **Use data-testid attributes** for stable selectors
2. **Test user flows**, not implementation details
3. **Keep tests independent** - Each test should work in isolation
4. **Clean up test data** after tests complete
5. **Use page objects** for complex pages
6. **Mock external APIs** where appropriate

## Troubleshooting

### Tests failing locally
- Ensure dev server is running on port 3001
- Check that all dependencies are installed
- Clear browser cache: `pnpm exec playwright install`

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check network conditions
- Look for slow page loads

### Elements not found
- Check if selectors match actual page elements
- Use `pnpm test:e2e:debug` to step through tests
- View screenshots in `test-results/` directory

## TODO

- [ ] Implement authentication helpers
- [ ] Add tests for project management
- [ ] Add tests for user management
- [ ] Implement test data factories
- [ ] Add visual regression testing
- [ ] Set up Firebase Emulator integration
- [ ] Add performance testing
- [ ] Add accessibility testing (a11y)
