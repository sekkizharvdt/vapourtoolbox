# Layout Conventions

This document describes the standardized patterns for handling layouts in the Next.js App Router.

## Core Principle

**Page components NEVER wrap themselves in layout components.** All layout wrapping is handled by `layout.tsx` files in the route hierarchy.

## Pattern

### layout.tsx (Route Layout)

```tsx
// app/[module]/layout.tsx
import { AuthenticatedLayout } from '@/components/layouts/AuthenticatedLayout';

export default function ModuleLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedLayout requiredModule="MODULE_NAME">{children}</AuthenticatedLayout>;
}
```

### page.tsx (Page Component)

```tsx
// app/[module]/page.tsx
export default function ModulePage() {
  // NO layout wrapper here - layout.tsx handles it
  return <ModulePageContent />;
}
```

### Dynamic Routes

```tsx
// app/[module]/[id]/page.tsx
export default function DetailPage({ params }: { params: { id: string } }) {
  // Inherits layout from parent layout.tsx
  return <DetailPageContent id={params.id} />;
}
```

## Why This Matters

1. **Prevents Double-Wrapping**: Wrapping in both layout.tsx and page.tsx causes auth checks to run twice
2. **Consistent Loading States**: Layout handles loading, not individual pages
3. **Predictable Behavior**: Auth state is resolved once at the layout level
4. **Easier Refactoring**: Change layout in one place, affects all pages

## Anti-Patterns (Don't Do This)

### ❌ Page Wrapping Itself

```tsx
// BAD - page.tsx with layout wrapper
export default function ProjectDetailPage() {
  return (
    <AuthenticatedLayout requiredModule="PROJECTS">
      {' '}
      // WRONG!
      <ProjectDetail />
    </AuthenticatedLayout>
  );
}
```

### ❌ Conditional Layout in Page

```tsx
// BAD - conditional layout in page
export default function SomePage() {
  const { user } = useAuth();
  if (!user) return <Redirect to="/login" />; // WRONG!
  return <PageContent />;
}
```

## Correct Structure

```
app/
├── layout.tsx              # Root layout (ThemeProvider, etc.)
├── (auth)/
│   └── layout.tsx          # Public routes layout
├── accounting/
│   ├── layout.tsx          # AuthenticatedLayout for accounting module
│   ├── page.tsx            # List page (no wrapper)
│   └── [id]/
│       └── page.tsx        # Detail page (inherits from parent layout)
├── projects/
│   ├── layout.tsx          # AuthenticatedLayout for projects module
│   ├── page.tsx            # List page (no wrapper)
│   └── [id]/
│       ├── page.tsx        # Detail page (inherits)
│       └── charter/
│           └── page.tsx    # Nested page (inherits)
```

## Checklist for New Pages

- [ ] Parent route has a `layout.tsx` with `AuthenticatedLayout`
- [ ] Page component does NOT import `AuthenticatedLayout`
- [ ] Page component does NOT check auth status
- [ ] Loading state is handled by layout or loading.tsx

## Migration

If you find a page that wraps itself:

1. Remove the `AuthenticatedLayout` wrapper from the page
2. Ensure the parent `layout.tsx` has the wrapper
3. Test that auth still works correctly
4. Verify loading states work

## Related Bugs

- Infinite loading on detail pages (caused by double auth checks)
- Flash of unauthenticated content (caused by page-level auth)
- Layout shift on navigation (caused by inconsistent wrapping)
