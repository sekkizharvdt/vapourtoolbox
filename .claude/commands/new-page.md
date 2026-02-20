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

   ```typescript
   'use client';

   import { useParams } from 'next/navigation';
   // ... other imports

   export default function ModuleDetailClient() {
     const params = useParams();
     const id = params.id as string;
     // ... component logic
   }
   ```

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
   - Deploy indexes **before** deploying the app: `firebase deploy --only firestore:indexes`.

9. **Soft delete awareness** — If the page lists transactions, include `where('isDeleted', '!=', true)` in the query to exclude trashed items. Only the Trash page uses `where('isDeleted', '==', true)`.
