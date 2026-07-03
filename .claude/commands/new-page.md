# New Page

Create a new page following the codebase patterns.

## Arguments

- `$ARGUMENTS` - Required: path for the new page (e.g., "accounting/reports/trial-balance")

## Steps

1. Determine if this is a dynamic route (contains [id] or similar):
   - Static route: `/app/module/page.tsx`
   - Dynamic route: `/app/module/[id]/page.tsx` + `ModuleDetailClient.tsx`

2. For STATIC routes, create a single page file:

   ```typescript
   'use client';

   import { useState, useEffect } from 'react';
   // ... imports

   export default function PageName() {
     // component logic
   }
   ```

3. For DYNAMIC routes, create TWO files:

   **page.tsx** (server component):

   ```typescript
   import { use } from 'react';
   import ModuleDetailClient from './ModuleDetailClient';

   export function generateStaticParams() {
     return [{ id: 'placeholder' }];
   }

   interface PageProps {
     params: Promise<{ id: string }>;
   }

   export default function ModulePage({ params }: PageProps) {
     const { id } = use(params);
     return <ModuleDetailClient key={id} />;
   }
   ```

   **ModuleDetailClient.tsx** (client component):

   `output: 'export'` pre-generates dynamic routes against a `'placeholder'` param, so
   `useParams()` returns `'placeholder'` at runtime and every lookup silently 404s (rule 30).
   Extract the real id from `usePathname()` instead:

   ```typescript
   'use client';

   import { useEffect, useState } from 'react';
   import { usePathname } from 'next/navigation';
   // ... other imports

   export default function ModuleDetailClient() {
     const pathname = usePathname();
     const [docId, setDocId] = useState<string | null>(null);

     useEffect(() => {
       if (!pathname) return;
       const match = pathname.match(/\/module\/([^/]+)(?:\/|$)/);
       const extracted = match?.[1];
       if (extracted && extracted !== 'placeholder') setDocId(extracted);
     }, [pathname]);

     useEffect(() => {
       if (!docId) return;
       // ... load data for docId
     }, [docId]);

     // ... guard every handler with `if (!docId) return;` too
   }
   ```

   Canonical exemplar: `apps/web/src/app/estimation/[id]/BOMEditorClient.tsx`.

4. For dynamic routes, add Firebase rewrite to `firebase.json`:

   ```json
   {
     "source": "/module/*",
     "destination": "/module/placeholder.html"
   }
   ```

   Note: Place specific routes BEFORE wildcard routes.

5. Add appropriate breadcrumbs and navigation.

6. **Permission gate** — Every page that reads or writes data must check permissions:

   ```typescript
   import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';

   const hasViewAccess = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.VIEW_ACCOUNTING);
   const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);
   ```

   - Wrap the entire page in a permission check or show a "no access" message.
   - Gate action buttons (create, edit, delete) behind `canManage`.
   - Use the correct module flag (`VIEW_ACCOUNTING`, `VIEW_PROCUREMENT`, etc.).

7. **Firestore rules** — If the page accesses a collection, verify `firestore.rules` allows the operation:
   - `read` requires `hasPermission(<VIEW flag>)`.
   - `create`/`update` requires `hasPermission(<MANAGE flag>)`.
   - `delete` requires `hasPermission(<MANAGE flag>)` or `isSuperAdmin()`.
   - If you add a **new collection**, add a dedicated rules block for it.

8. **Firestore composite indexes** — Every `query()` call that combines a `where()` filter with an `orderBy()`, or uses multiple `where()` clauses on different fields, needs a composite index in `firestore.indexes.json`:

   ```json
   {
     "collectionGroup": "transactions",
     "queryScope": "COLLECTION",
     "fields": [
       { "fieldPath": "type", "order": "ASCENDING" },
       { "fieldPath": "isDeleted", "order": "ASCENDING" },
       { "fieldPath": "date", "order": "DESCENDING" }
     ]
   }
   ```

   - Add one index entry per unique `query()` shape.
   - The `!=` operator requires the filtered field to appear in the index.
   - Never run `firebase deploy` locally — indexes ship through the "Deploy - Production" CI
     workflow, which auto-selects targets from changed paths (rule 33). Just commit the updated
     `firestore.indexes.json`.

9. **Soft delete awareness** — Never query with `where('isDeleted', '!=', true)` — Firestore
   excludes documents that are missing the field entirely, silently dropping valid rows (rule 3).
   Fetch normally and filter client-side: `docs.filter((d) => !d.isDeleted)`. Only the Trash page
   queries `where('isDeleted', '==', true)`. This applies to Cloud Function triggers too.
