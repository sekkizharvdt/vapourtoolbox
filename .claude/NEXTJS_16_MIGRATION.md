# Next.js 16 Migration Plan

**Created:** 2026-01-29
**Target Version:** Next.js 16.x (when stable)
**Current Version:** Next.js 15.5.11

---

## Overview

Next.js 16 introduces breaking changes that require careful migration planning. This document outlines the steps needed to upgrade from Next.js 15 to 16.

---

## Breaking Changes in Next.js 16

### 1. `next lint` Deprecation (CRITICAL)

**Issue:** `next lint` command has been removed in Next.js 16.

**Current Usage:**

- `apps/web/package.json`: `"lint": "next lint --max-warnings=100"`
- `.lintstagedrc.js`: Uses `pnpm --filter @vapour/web run lint`

**Migration Steps:**

1. Install ESLint CLI: `pnpm add -D eslint`
2. Run codemod: `npx @next/codemod@canary next-lint-to-eslint-cli .`
3. Update lint script: `"lint": "eslint . --max-warnings=100"`
4. Convert to ESLint flat config (eslint.config.js)

**Codemod Command:**

```bash
npx @next/codemod@canary next-lint-to-eslint-cli apps/web
```

### 2. ESLint Flat Config Migration

**Issue:** ESLint 9+ uses flat config by default. Legacy `.eslintrc.json` is deprecated.

**Current Files to Migrate:**

- `apps/web/.eslintrc.json` → `apps/web/eslint.config.js`

**Migration Steps:**

1. Install `@eslint/migrate-config`: `pnpm add -D @eslint/migrate-config`
2. Run migration: `npx @eslint/migrate-config .eslintrc.json`
3. Update imports to use flat config format
4. Test with `eslint .`

**Example Flat Config:**

```javascript
// eslint.config.js
import js from '@eslint/js';
import next from '@next/eslint-plugin-next';
import typescript from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...typescript.configs.recommended,
  {
    plugins: {
      '@next/next': next,
    },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
    },
  },
];
```

### 3. NextConfig Type Changes

**Issue:** Some config options removed or changed.

**Current `next.config.ts` Review:**

```typescript
const nextConfig: NextConfig = {
  output: 'export',           // ✅ Still supported
  reactStrictMode: true,      // ✅ Still supported
  transpilePackages: [...],   // ✅ Still supported
  eslint: { ... },            // ⚠️ May change
  typescript: { ... },        // ⚠️ May change
};
```

**Action:** Review Next.js 16 release notes for config changes.

### 4. React 19 Compatibility

**Current:** React 19.2.1 (already compatible)

**Note:** Next.js 16 requires React 19. We're already on React 19, so no action needed.

---

## Pre-Migration Checklist

- [ ] All tests passing on Next.js 15
- [ ] No TypeScript errors
- [ ] ESLint passing with current config
- [ ] Build succeeds (`pnpm build`)
- [ ] E2E tests passing
- [ ] Backup current lock file

---

## Migration Steps

### Phase 1: Preparation (Before Upgrade)

1. **Audit current ESLint config:**

   ```bash
   cat apps/web/.eslintrc.json
   ```

2. **Check for deprecated features:**

   ```bash
   npx @next/codemod@canary --list
   ```

3. **Run available codemods:**
   ```bash
   npx @next/codemod@canary next-lint-to-eslint-cli apps/web
   ```

### Phase 2: Upgrade (Feature Branch)

1. **Create feature branch:**

   ```bash
   git checkout -b feat/nextjs-16-upgrade
   ```

2. **Update Next.js:**

   ```bash
   pnpm --filter @vapour/web add next@16 @next/eslint-plugin-next@16
   ```

3. **Update related packages:**

   ```bash
   pnpm --filter @vapour/web add eslint-config-next@16
   ```

4. **Fix breaking changes:**
   - Update lint script in package.json
   - Convert .eslintrc.json to eslint.config.js
   - Fix any config type errors

5. **Test:**
   ```bash
   pnpm lint
   pnpm type-check
   pnpm build
   pnpm test
   ```

### Phase 3: Validation

1. **Run full test suite:**

   ```bash
   pnpm test:coverage
   pnpm test:e2e
   ```

2. **Manual testing:**
   - Test all major routes
   - Verify static export works
   - Check Firebase Hosting deployment

3. **Performance comparison:**
   - Compare build times
   - Compare bundle sizes

### Phase 4: Deployment

1. **Deploy to staging first**
2. **Run E2E tests against staging**
3. **Deploy to production**
4. **Monitor for errors**

---

## Rollback Plan

If issues occur after deployment:

1. **Revert to previous commit:**

   ```bash
   git revert HEAD
   ```

2. **Or pin to previous version:**
   ```bash
   pnpm --filter @vapour/web add next@15.5.11
   ```

---

## Timeline

| Phase       | Duration | Target Date            |
| ----------- | -------- | ---------------------- |
| Preparation | 1 day    | When Next.js 16 stable |
| Upgrade     | 2-3 days | +1 week                |
| Validation  | 1-2 days | +2 weeks               |
| Production  | 1 day    | +2 weeks               |

---

## Dependencies to Update

| Package                  | Current                  | Target |
| ------------------------ | ------------------------ | ------ |
| next                     | 15.5.11                  | 16.x   |
| eslint-config-next       | 15.5.11                  | 16.x   |
| @next/eslint-plugin-next | (via eslint-config-next) | 16.x   |

---

## References

- [Next.js 16 Release Notes](https://nextjs.org/blog) (check when released)
- [ESLint Flat Config Migration](https://eslint.org/docs/latest/use/configure/migration-guide)
- [@next/codemod Documentation](https://nextjs.org/docs/app/building-your-application/upgrading/codemods)
