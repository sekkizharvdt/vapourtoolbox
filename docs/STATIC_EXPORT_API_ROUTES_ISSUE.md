# Static Export API Routes Issue - Root Cause Analysis

**Date:** 2025-11-18
**Status:** 🔴 CRITICAL - Production Issue
**Affected Modules:** Materials Module, Shape Database (FIXED)

---

## Executive Summary

The application is experiencing **404 errors on all API routes** in production because Next.js is configured with **static export** (`output: 'export'`), which **completely disables server-side functionality including API routes**.

### Impact

- ❌ Materials loading fails in Shape Calculator
- ❌ Material list API returns 404 in production
- ✅ Shape Database (fixed in commit `7b83f93`)

---

## Root Cause

### Technical Details

**File:** `apps/web/next.config.ts` (Line 5)

```typescript
const nextConfig: NextConfig = {
  output: 'export', // ← THIS IS THE ROOT CAUSE
  reactStrictMode: true,
  // ...
};
```

### What `output: 'export'` Does

1. **Builds static HTML/CSS/JS only** - no Node.js server
2. **Disables all server features:**
   - ❌ API Routes (`/app/api/*`)
   - ❌ Server Components with data fetching
   - ❌ Server Actions
   - ❌ Middleware
   - ❌ Rewrites/Redirects (dynamic)
   - ❌ Image Optimization API

3. **Production deployment is pure static files** served via CDN

### Why API Routes Return 404

When Next.js builds with `output: 'export'`:

```
API Route File:     apps/web/src/app/api/materials/list/route.ts
Build Output:       (SKIPPED - not included in build)
Production Request: GET /api/materials/list?category=PLATES_CARBON_STEEL
Result:             404 Not Found
```

**The API route code exists in source but is NEVER deployed to production.**

---

## Current Console Errors (Production)

```
/api/materials/list?category=PLATES_DUPLEX_STEEL&limit=10:1
  Failed to load resource: the server responded with a status of 404 ()

/api/materials/list?category=PLATES_ALLOY_STEEL&limit=10:1
  Failed to load resource: the server responded with a status of 404 ()

/api/materials/list?category=PLATES_CARBON_STEEL&limit=10:1
  Failed to load resource: the server responded with a status of 404 ()

/api/materials/list?category=PLATES_STAINLESS_STEEL&limit=10:1
  Failed to load resource: the server responded with a status of 404 ()
```

### Why This Works in Development

```
Development:  next dev  → Runs full Next.js server → API routes work ✅
Production:   Static export → No server → API routes 404 ❌
```

**This creates a false sense of security during local testing.**

---

## Affected Code

### 1. API Route (Returns 404)

**File:** `apps/web/src/app/api/materials/list/route.ts`

```typescript
export const dynamic = 'force-static'; // ← DOES NOT WORK with static export!
export const revalidate = false;

export async function GET(request: NextRequest) {
  // This code NEVER runs in production
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  // Query Firestore for materials
  const materials = await materialService.queryMaterials({
    category: category as MaterialCategory,
    limit: parseInt(limit || '10'),
    isActive: true,
  });

  return NextResponse.json({ materials });
}
```

**Lines of Code:** 46 lines
**Status:** Dead code in production
**Action Required:** Delete or convert to client-side function

### 2. Component Making API Calls

**File:** `apps/web/src/components/shapes/MaterialSelector.tsx` (Line 43)

```typescript
const loadMaterials = async () => {
  setLoading(true);
  setError(null);
  try {
    // ❌ This fetch() returns 404 in production
    const response = await fetch(`/api/materials/list?category=${category}&limit=10`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load materials');
    }

    setMaterials(data.materials || []);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load materials');
  } finally {
    setLoading(false);
  }
};
```

**Used In:** Shape Calculator (`/dashboard/shapes/calculator`)
**User Impact:** Cannot select materials for shape calculations
**Lines to Change:** ~15 lines

---

## Why Shapes Work Now (Reference Solution)

**Commit:** `7b83f93` - "refactor: convert Shape Database to client-side only"

### What Was Fixed

1. **Deleted API Routes:**
   - `/api/shapes/list`
   - `/api/shapes/calculate`
   - `/api/shapes/evaluate-formula`
   - `/api/shapes/extract-variables`

2. **Created Client-Side Data Service:**

**File:** `apps/web/src/lib/shapes/shapeData.ts`

```typescript
import { allShapes } from '@/data/shapes';
import { Timestamp } from 'firebase/firestore';

export function getShapesByCategory(categoryId: string): Shape[] {
  const allowedCategories = categoryMap[categoryId];
  return allShapes
    .filter((shape) => allowedCategories.includes(shape.category))
    .map((shape, index) => addShapeMetadata(shape, index, categoryId));
}
```

3. **Updated Components:**

**File:** `apps/web/src/components/shapes/ShapeSelector.tsx`

```typescript
// OLD (API call):
const response = await fetch(`/api/shapes/list?category=${category}`);

// NEW (Direct call):
import { getShapesByCategory } from '@/lib/shapes/shapeData';
const categoryShapes = getShapesByCategory(category);
```

### Result

- ✅ No network requests
- ✅ Instant loading
- ✅ Works in static export
- ✅ All 20 shapes bundled at build time

---

## Materials Module Challenge

### Key Difference from Shapes

| Aspect               | Shapes Module               | Materials Module                |
| -------------------- | --------------------------- | ------------------------------- |
| **Data Size**        | 20 pre-defined shapes       | Hundreds/thousands of materials |
| **Data Source**      | Bundled TypeScript files    | Firestore database              |
| **Data Location**    | `apps/web/src/data/shapes/` | Cloud Firestore                 |
| **User Creation**    | No (admin only)             | Yes (dynamic creation)          |
| **Build-Time Known** | Yes (static)                | No (dynamic)                    |

### The Problem

**Cannot bundle all materials at build time because:**

1. Materials are created dynamically by users
2. Materials database is large and growing
3. Would need to export Firestore → JSON before every build
4. Build times would increase significantly

---

## Solution Options

### Option A: Client-Side Firestore Queries (Recommended)

**Approach:**

- Keep existing `materialService.queryMaterials()` logic
- Call it directly from components (not via API route)
- Firebase SDK works perfectly on client-side

**Pros:**

- ✅ No API routes needed
- ✅ Works with static export
- ✅ All existing Firestore logic reusable
- ✅ Authentication already configured
- ✅ Real-time data (not stale)
- ✅ Firebase CDN is globally optimized

**Cons:**

- ⚠️ Slightly larger bundle (Firebase SDK)
- ⚠️ Firestore rules must allow client reads

**Code Changes:**

```typescript
// BEFORE (API route):
const response = await fetch('/api/materials/list?category=PLATES_CARBON_STEEL');
const data = await response.json();

// AFTER (Direct Firestore):
import { materialService } from '@/lib/materials/materialService';
const materials = await materialService.queryMaterials({
  category: 'PLATES_CARBON_STEEL',
  limit: 10,
  isActive: true,
});
```

**Files to Change:**

1. `MaterialSelector.tsx` - Replace fetch with direct service call (~15 lines)
2. Delete `apps/web/src/app/api/materials/list/route.ts` (~46 lines)

**Estimated Time:** 30 minutes

---

### Option B: Hybrid with Fallback Data

**Approach:**

- Bundle top 50-100 most common materials
- Try API route first (works in dev)
- Fallback to bundled data if 404

**Pros:**

- ✅ Works in both dev and prod
- ✅ Graceful degradation
- ✅ Common materials load instantly

**Cons:**

- ⚠️ More complex code
- ⚠️ Maintenance overhead (keeping bundle updated)
- ⚠️ API route still doesn't work in prod

**Not Recommended** - adds complexity without solving root issue

---

### Option C: Pre-Build Material Export

**Approach:**

- Add build script to export Firestore materials to JSON
- Bundle materials at build time
- Load from static JSON files

**Pros:**

- ✅ All materials available offline
- ✅ No Firestore queries needed

**Cons:**

- ❌ Materials stale after build
- ❌ Build time increases
- ❌ Requires Firebase credentials at build time
- ❌ Large bundle size
- ❌ Can't show new materials without rebuild

**Not Recommended** - defeats purpose of dynamic database

---

## Recommended Implementation Plan

### Phase 1: Fix Materials Loading (Option A)

**Step 1:** Update MaterialSelector Component

```typescript
// apps/web/src/components/shapes/MaterialSelector.tsx

import { materialService } from '@/lib/materials/materialService';
import { db } from '@/lib/firebase/client';

const loadMaterials = async () => {
  setLoading(true);
  setError(null);
  try {
    // Direct Firestore query (no API route)
    const materials = await materialService.queryMaterials({
      db,
      category: category as MaterialCategory,
      limit: 10,
      isActive: true,
      sortBy: { field: 'name', direction: 'asc' },
    });

    setMaterials(materials.materials);
    setHasMore(materials.hasMore);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load materials');
  } finally {
    setLoading(false);
  }
};
```

**Step 2:** Delete API Route

```bash
rm apps/web/src/app/api/materials/list/route.ts
```

**Step 3:** Verify Firestore Rules Allow Client Reads

```javascript
// firestore.rules
match /materials/{materialId} {
  allow read: if request.auth != null;  // ← Ensure this exists
}
```

**Step 4:** Test in Production Build

```bash
pnpm --filter @vapour/web build
pnpm --filter @vapour/web preview
```

### Phase 2: Audit Other API Routes

**Search for other API routes:**

```bash
find apps/web/src/app/api -name "route.ts" -o -name "route.tsx"
```

**Check each one:**

- Is it called from client components?
- Can it be converted to client-side operation?
- Is it dead code?

---

## Testing Checklist

Before deploying fix:

- [ ] Local build succeeds (`pnpm --filter @vapour/web build`)
- [ ] Type check passes (`pnpm --filter @vapour/web type-check`)
- [ ] Lint passes (`pnpm --filter @vapour/web lint`)
- [ ] MaterialSelector loads materials in dev
- [ ] MaterialSelector loads materials in preview (static export simulation)
- [ ] Shape calculator can select materials
- [ ] No console errors in browser
- [ ] No 404s in network tab
- [ ] Firestore rules allow authenticated reads
- [ ] Performance acceptable (no lag loading materials)

---

## Long-Term Architectural Decision

### Should We Keep Static Export?

**Reasons to Keep:**

- ✅ Cheaper hosting (static CDN vs server)
- ✅ Better performance (no cold starts)
- ✅ Simpler deployment
- ✅ Auto-scaling (CDN handles traffic)
- ✅ Better security (no server to hack)

**Reasons to Remove:**

- ⚠️ API routes would work
- ⚠️ Server components would work
- ⚠️ Image optimization would work
- ⚠️ ISR (Incremental Static Regeneration) would work

**Recommendation:** **KEEP static export** and convert all API routes to client-side operations. The benefits outweigh the limitations for this application.

### Why This Works

Firebase is **designed for client-side operation:**

- Firebase Auth handles authentication on client
- Firestore SDK can run in browser
- Security rules protect data server-side
- Firebase CDN optimized globally
- Real-time updates work client-side

**This is the standard Firebase architecture pattern.**

---

## Related Files Reference

### Configuration

- `apps/web/next.config.ts` - Static export config
- `firestore.rules` - Firestore security rules
- `apps/web/src/lib/firebase/client.ts` - Firebase client initialization

### Materials Module

- `apps/web/src/lib/materials/materialService.ts` - Firestore query logic (400+ lines)
- `apps/web/src/components/shapes/MaterialSelector.tsx` - Component with API call
- `apps/web/src/app/api/materials/list/route.ts` - API route (TO DELETE)
- `packages/types/src/material.ts` - Material type definitions

### Reference (Shapes Fix)

- `apps/web/src/lib/shapes/shapeData.ts` - Client-side data service (NEW)
- `apps/web/src/components/shapes/ShapeSelector.tsx` - Updated component
- `apps/web/src/data/shapes/` - Bundled shape definitions

### Similar Issues to Check

```bash
# Find all API routes
find apps/web/src/app/api -type f -name "*.ts"

# Find all fetch calls to /api
grep -r "fetch.*['\"]\/api\/" apps/web/src --include="*.tsx" --include="*.ts"
```

---

## Prevention

### Pre-Deployment Checklist

Add to CI/CD pipeline:

```bash
# Check for API route usage with static export
if grep -q "output: 'export'" apps/web/next.config.ts; then
  api_routes=$(find apps/web/src/app/api -name "route.ts" | wc -l)
  if [ $api_routes -gt 0 ]; then
    echo "❌ ERROR: Static export enabled but $api_routes API routes found"
    exit 1
  fi
fi
```

### Developer Documentation

Update `.claude/claude.md` with:

```markdown
## Static Export Architecture

This app uses Next.js static export (`output: 'export'`).

**DO NOT:**

- ❌ Create API routes in `/app/api/*`
- ❌ Use Server Components with data fetching
- ❌ Use Server Actions
- ❌ Use `getServerSideProps`

**DO:**

- ✅ Use client-side Firebase SDK directly
- ✅ Query Firestore from components
- ✅ Use SWR/React Query for caching
- ✅ Bundle static data when appropriate
```

---

## Immediate Action Required

1. **Fix Materials Module** (30 min)
   - Update MaterialSelector to use client-side queries
   - Delete API route
   - Test thoroughly

2. **Audit All API Routes** (15 min)
   - Find all remaining API routes
   - Document or delete each one

3. **Update Documentation** (10 min)
   - Add static export note to README
   - Update .claude/claude.md

4. **Deploy Fix** (5 min)
   - Commit changes
   - Push to main
   - Verify in production

**Total Time:** ~1 hour

---

## Questions?

- Why do shapes work now? → Fixed in commit `7b83f93`, bundled static data
- Why use static export? → Cheaper, faster, simpler than server deployment
- Can we use API routes? → No, not with `output: 'export'`
- Will Firebase work client-side? → Yes, designed for it
- Security concerns? → Firestore rules protect data server-side
- Performance impact? → Minimal, Firebase CDN optimized

---

**Document Owner:** Claude
**Last Updated:** 2025-11-18
**Next Review:** After materials fix deployed
