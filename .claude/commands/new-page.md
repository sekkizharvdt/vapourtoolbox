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
