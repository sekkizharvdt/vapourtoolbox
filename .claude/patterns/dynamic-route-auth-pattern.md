# Dynamic Route with Auth Pattern

## Overview

This pattern documents how to correctly implement dynamic route pages (`[id]/page.tsx`) that require authentication and permissions, especially with Next.js static export.

## The Problem

When implementing dynamic routes with static export:

1. **Static Export Issue**: `generateStaticParams()` returns placeholder IDs like `'placeholder'`
2. **Auth Race Condition**: Components render before auth context is ready
3. **Premature Permission Check**: Components check `hasPermission` when `claims` is still null
4. **Infinite Loading**: Firestore queries fail silently or component gets stuck

### Symptoms

- Page shows app-level loading spinner (not component spinner) indefinitely
- Console shows: `[Firebase] initializeFirebase called` but no errors
- Works on some pages but not others

## The Solution

### 1. Server Component (page.tsx)

```typescript
import DetailClient from './DetailClient';
import { use } from 'react';

// Required for static export - provide placeholder path
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Use id as key to force remount when navigating
  return <DetailClient key={id} />;
}
```

### 2. Client Component (DetailClient.tsx)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewResource } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function DetailClient() {
  const params = useParams();
  const router = useRouter();

  // CRITICAL: Get authLoading from useAuth
  const { user, claims, loading: authLoading } = useAuth();

  const rawId = params?.id as string;

  // CRITICAL: Handle placeholder ID from static export
  const entityId = rawId && rawId !== 'placeholder' ? rawId : null;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Permission check - will be false while auth is loading
  const hasAccess = claims?.permissions
    ? canViewResource(claims.permissions)
    : false;

  // CRITICAL: Wait for auth before fetching data
  useEffect(() => {
    // Don't do anything while auth is still loading
    if (authLoading) {
      return;
    }

    // After auth is ready, check for valid ID
    if (!entityId) {
      setError('Invalid ID');
      setLoading(false);
      return;
    }

    // Now safe to fetch data - user is authenticated
    const { db } = getFirebase();
    const docRef = doc(db, 'collection', entityId);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setData({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError('Not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching:', err);
        setError('Failed to load');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [entityId, authLoading]); // CRITICAL: Include authLoading in deps

  // CRITICAL: Render order matters!

  // 1. FIRST: Show loading while auth OR data is loading
  if (authLoading || loading) {
    return <LoadingSpinner message="Loading..." />;
  }

  // 2. THEN: Check permissions (only after auth is complete)
  if (!hasAccess) {
    return <PermissionError message="You don't have access" />;
  }

  // 3. THEN: Check for errors or missing data
  if (error || !data) {
    return <ErrorDisplay error={error} />;
  }

  // 4. FINALLY: Render content
  return <ContentComponent data={data} />;
}
```

## Key Points

### 1. Handle Placeholder ID

```typescript
// BAD - will try to fetch document with ID 'placeholder'
const entityId = params?.id as string;

// GOOD - treats placeholder as null
const entityId = rawId && rawId !== 'placeholder' ? rawId : null;
```

### 2. Wait for Auth Before Data Fetch

```typescript
useEffect(() => {
  // BAD - starts fetching before auth is ready
  if (!entityId) return;

  // GOOD - waits for auth first
  if (authLoading) return;
  if (!entityId) {
    setLoading(false);
    return;
  }

  // Now safe to fetch...
}, [entityId, authLoading]);
```

### 3. Correct Render Order

```typescript
// BAD - checks permission before auth is ready (shows error flash)
if (!hasAccess) return <PermissionError />;
if (loading) return <Loading />;

// GOOD - waits for auth, then checks permission
if (authLoading || loading) return <Loading />;
if (!hasAccess) return <PermissionError />;
```

### 4. Include authLoading in Dependencies

```typescript
// BAD - effect doesn't re-run when auth completes
}, [entityId]);

// GOOD - effect re-runs after auth completes
}, [entityId, authLoading]);
```

## Common Mistakes

### Mistake 1: Using pathname.split() Without Placeholder Check

```typescript
// BAD
const id = pathname?.split('/').pop() || '';

// GOOD
const rawId = pathname?.split('/').pop() || '';
const id = rawId && rawId !== 'placeholder' ? rawId : '';
```

### Mistake 2: Early Return Without Setting Loading

```typescript
// BAD - leaves component in loading state forever
if (!hasAccess) {
  return; // Component still shows loading spinner
}

// GOOD - explicitly set loading to false
if (!hasAccess) {
  setLoading(false);
  return;
}
```

### Mistake 3: Permission Check Based on Undefined Claims

```typescript
// BAD - returns false when claims is null (auth still loading)
const hasAccess = claims?.permissions ? check(claims.permissions) : false;
if (!hasAccess) return <Error />; // Shows error before auth completes

// GOOD - wait for auth first
if (authLoading) return <Loading />;
if (!hasAccess) return <Error />; // Now claims is definitely loaded
```

## Files Following This Pattern

Good examples in the codebase:

- `apps/web/src/app/documents/[id]/DocumentDetailClient.tsx`
- `apps/web/src/app/proposals/[id]/ProposalDetailClient.tsx`
- `apps/web/src/app/procurement/pos/[id]/PODetailClient.tsx`

## Related Issues

- Firebase permission denied errors (silent in onSnapshot)
- "Vapour Toolbox - Loading..." stuck screen
- Flash of permission error before content loads
