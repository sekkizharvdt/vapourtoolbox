# Module Layout Template

## Overview

This document provides a standardized template for creating new application modules with consistent UI, navigation, and permission handling.

## The Problem

**Issue Identified (October 31, 2025):**

When the Accounting module was created, it had no `layout.tsx` file. This resulted in:

- No sidebar navigation on Accounting pages
- No AppBar with theme toggle
- No way to navigate back to dashboard
- Inconsistent user experience across modules

**User Feedback:**

> "From the account page, there is no way to change the theme or go to the dashboard or to any other pages. UI is not uniformly being implemented. Why? Do we have templates that must be followed during coding?"

This documentation addresses that concern by establishing a standardized template for all modules.

---

## Architecture

### Layout Hierarchy

```
apps/web/src/app/
├── layout.tsx                    ← Root layout (theme provider, auth provider)
├── dashboard/
│   └── layout.tsx               ← Dashboard layout (Sidebar + AppBar)
├── users/
│   └── layout.tsx               ← Users module layout (Sidebar + AppBar + permission check)
├── accounting/
│   └── layout.tsx               ← Accounting module layout (Sidebar + AppBar + permission check)
└── [your-module]/
    └── layout.tsx               ← YOUR module layout (use ModuleLayout component)
```

### Key Components

1. **ModuleLayout** (`components/layouts/ModuleLayout.tsx`)
   - Reusable layout component for all modules
   - Handles Sidebar + AppBar + permission checks
   - Provides consistent navigation and theme toggle

2. **Sidebar** (`components/dashboard/Sidebar.tsx`)
   - Navigation menu with collapsible functionality
   - Role-based menu item visibility
   - Persists collapsed state in localStorage

3. **DashboardAppBar** (`components/dashboard/AppBar.tsx`)
   - Top navigation bar
   - Theme toggle (light/dark mode)
   - User menu and logout

---

## Creating a New Module

### Step 1: Create Module Directory

```bash
mkdir -p apps/web/src/app/[module-name]
```

### Step 2: Create layout.tsx

Create `apps/web/src/app/[module-name]/layout.tsx` with the following template:

```tsx
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canView[ModuleName] } from '@vapour/constants'; // Import your permission helper

export default function [ModuleName]Layout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout
      permissionCheck={canView[ModuleName]}
      moduleName="[Module Display Name]"
    >
      {children}
    </ModuleLayout>
  );
}
```

**Example - Accounting Module:**

```tsx
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewAccounting } from '@vapour/constants';

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canViewAccounting} moduleName="Accounting">
      {children}
    </ModuleLayout>
  );
}
```

**That's it!** Your module now has:

- ✅ Sidebar navigation
- ✅ AppBar with theme toggle
- ✅ Permission-based access control
- ✅ Consistent layout with all other modules

### Step 3: Create Module Landing Page (Optional)

Create `apps/web/src/app/[module-name]/page.tsx`:

```tsx
'use client';

import { Container, Typography, Box, Grid, Card, CardContent, CardActions, Button } from '@mui/material';
import { useRouter } from 'next/navigation';

export default function [ModuleName]Page() {
  const router = useRouter();

  const subModules = [
    {
      title: 'Sub Module 1',
      description: 'Description of what this sub-module does',
      path: '/[module-name]/sub-module-1',
      icon: <YourIconHere />,
    },
    // Add more sub-modules...
  ];

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          [Module Display Name]
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Module description and overview
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {subModules.map((module) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={module.path}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {module.icon}
                  <Typography variant="h6" sx={{ ml: 2 }}>
                    {module.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {module.description}
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => router.push(module.path)}>
                  Open Module
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
```

---

## Permission Checking

### Permission Helper Pattern

All permission checks should use helper functions from `@vapour/constants`:

```typescript
// packages/constants/src/permissions.ts

export function canView[ModuleName](permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.VIEW_[MODULE_NAME]);
}

export function canManage[ModuleName](permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_[MODULE_NAME]);
}
```

**Example - Accounting Permissions:**

```typescript
// View access: Requires VIEW_ACCOUNTING or MANAGE_ACCOUNTING
export function canViewAccounting(permissions: number): boolean {
  return (
    hasPermission(permissions, PERMISSION_FLAGS.VIEW_ACCOUNTING) ||
    hasPermission(permissions, PERMISSION_FLAGS.MANAGE_ACCOUNTING)
  );
}

// Manage access: Requires MANAGE_ACCOUNTING
export function canManageAccounting(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_ACCOUNTING);
}
```

### Page-Level Permission Checks

For finer-grained permissions within a module, add checks in individual pages:

```tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { canManageAccounting } from '@vapour/constants';

export default function SubModulePage() {
  const { claims } = useAuth();
  const permissions = claims?.permissions || 0;

  const canManage = canManageAccounting(permissions);

  return (
    <Container maxWidth="xl">
      {/* Show different UI based on permissions */}
      {canManage && <Button>Create New Item</Button>}
    </Container>
  );
}
```

---

## File Structure

### Recommended Module Structure

```
apps/web/src/app/[module-name]/
├── layout.tsx                    ← Module layout (REQUIRED)
├── page.tsx                      ← Module landing page (optional)
├── [sub-module-1]/
│   ├── page.tsx                 ← Sub-module page
│   └── [id]/
│       └── page.tsx             ← Detail page
└── [sub-module-2]/
    └── page.tsx
```

**Example - Accounting Module:**

```
apps/web/src/app/accounting/
├── layout.tsx                    ← Accounting layout
├── page.tsx                      ← Accounting landing page
├── chart-of-accounts/
│   └── page.tsx                 ← Chart of Accounts page
├── transactions/
│   ├── page.tsx                 ← Transactions list
│   └── [id]/
│       └── page.tsx             ← Transaction detail
└── reports/
    └── page.tsx                 ← Financial reports
```

---

## Naming Conventions

### Module Names

- **Directory:** lowercase with hyphens (`chart-of-accounts`)
- **Component:** PascalCase (`ChartOfAccountsPage`)
- **Layout:** PascalCase with "Layout" suffix (`AccountingLayout`)

### Permission Helpers

- **View Access:** `canView[ModuleName]` (`canViewAccounting`)
- **Manage Access:** `canManage[ModuleName]` (`canManageAccounting`)
- **Specific Actions:** `can[Action][ModuleName]` (`canApproveTransactions`)

---

## Common Patterns

### Pattern 1: Simple Module (Single Page)

```tsx
// apps/web/src/app/my-module/layout.tsx
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewMyModule } from '@vapour/constants';

export default function MyModuleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canViewMyModule} moduleName="My Module">
      {children}
    </ModuleLayout>
  );
}

// apps/web/src/app/my-module/page.tsx
export default function MyModulePage() {
  return <Container maxWidth="xl">{/* Your page content */}</Container>;
}
```

### Pattern 2: Complex Module (Multiple Sub-Modules)

```tsx
// apps/web/src/app/my-module/layout.tsx
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewMyModule } from '@vapour/constants';

export default function MyModuleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canViewMyModule} moduleName="My Module">
      {children}
    </ModuleLayout>
  );
}

// apps/web/src/app/my-module/page.tsx
// Landing page with sub-module cards (see "Step 3" above)

// apps/web/src/app/my-module/sub-module-1/page.tsx
export default function SubModule1Page() {
  return <Container maxWidth="xl">{/* Sub-module 1 content */}</Container>;
}

// apps/web/src/app/my-module/sub-module-2/page.tsx
export default function SubModule2Page() {
  return <Container maxWidth="xl">{/* Sub-module 2 content */}</Container>;
}
```

### Pattern 3: Module with Custom Permission Logic

If you need complex permission logic, create a custom permission check function:

```tsx
// apps/web/src/app/my-module/layout.tsx
import { ModuleLayout } from '@/components/layouts/ModuleLayout';

// Custom permission check function
function canAccessMyModule(permissions: number): boolean {
  // Complex logic: require VIEW_ANALYTICS AND EXPORT_DATA
  const hasViewAnalytics = hasPermission(permissions, PERMISSION_FLAGS.VIEW_ANALYTICS);
  const hasExportData = hasPermission(permissions, PERMISSION_FLAGS.EXPORT_DATA);
  return hasViewAnalytics && hasExportData;
}

export default function MyModuleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canAccessMyModule} moduleName="My Module">
      {children}
    </ModuleLayout>
  );
}
```

---

## Adding Menu Items to Sidebar

After creating your module, add it to the Sidebar menu:

1. Open `apps/web/src/components/dashboard/Sidebar.tsx`
2. Add your module to the appropriate menu section:

```tsx
{
  canView[ModuleName](userPermissions) && (
    <ListItemButton
      component={Link}
      href="/[module-name]"
      selected={pathname.startsWith('/[module-name]')}
    >
      <ListItemIcon>
        <YourIcon />
      </ListItemIcon>
      <ListItemText primary="[Module Display Name]" />
    </ListItemButton>
  );
}
```

**Example - Accounting Module:**

```tsx
{
  canViewAccounting(userPermissions) && (
    <ListItemButton
      component={Link}
      href="/accounting"
      selected={pathname.startsWith('/accounting')}
    >
      <ListItemIcon>
        <AccountBalanceIcon />
      </ListItemIcon>
      <ListItemText primary="Accounting" />
    </ListItemButton>
  );
}
```

---

## Migration Guide

### Converting Existing Module to Use ModuleLayout

If you have an existing module with custom layout code, here's how to migrate:

**Before (125 lines):**

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Box, Toolbar, Typography, Container } from '@mui/material';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { DashboardAppBar } from '@/components/dashboard/AppBar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { canViewMyModule } from '@vapour/constants';

export default function MyModuleLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      return saved === 'true';
    }
    return false;
  });
  // ... 100+ more lines of boilerplate
}
```

**After (10 lines):**

```tsx
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewMyModule } from '@vapour/constants';

export default function MyModuleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canViewMyModule} moduleName="My Module">
      {children}
    </ModuleLayout>
  );
}
```

**Benefits:**

- ✅ 92% less code
- ✅ No duplication
- ✅ Consistent behavior
- ✅ Easier to maintain

---

## Troubleshooting

### Issue: "Access Denied" message appears

**Cause:** User doesn't have the required permission.

**Fix:**

1. Check the permission helper function is correct
2. Verify the user has the required permission in Firestore
3. Check that permission bits are properly defined in `packages/constants/src/permissions.ts`
4. Run the permission audit script: `node scripts/audit-permissions.js`

### Issue: Sidebar not showing

**Cause:** Missing `layout.tsx` file in module directory.

**Fix:** Create `layout.tsx` using the template above.

### Issue: Theme toggle not working

**Cause:** Module page is not wrapped in ModuleLayout.

**Fix:** Ensure your module has a `layout.tsx` file that uses `ModuleLayout`.

### Issue: Navigation breadcrumbs not working

**Cause:** Next.js requires proper route hierarchy.

**Fix:** Ensure your module follows the recommended file structure.

---

## Best Practices

### ✅ DO

- **Always use ModuleLayout** for module-level layouts
- **Use permission helpers** from `@vapour/constants`
- **Follow naming conventions** for consistency
- **Add sidebar menu items** for discoverability
- **Test with different permission levels** to ensure access control works

### ❌ DON'T

- **Don't duplicate layout code** - use ModuleLayout instead
- **Don't hardcode permission checks** - use helper functions
- **Don't skip the layout.tsx file** - it's required for navigation
- **Don't create custom navigation components** - use Sidebar/AppBar
- **Don't forget to add permission definitions** when creating new modules

---

## Examples

### Example 1: Accounting Module

**File:** `apps/web/src/app/accounting/layout.tsx`

```tsx
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { canViewAccounting } from '@vapour/constants';

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canViewAccounting} moduleName="Accounting">
      {children}
    </ModuleLayout>
  );
}
```

### Example 2: Users Module

**File:** `apps/web/src/app/users/layout.tsx`

```tsx
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { PERMISSION_FLAGS, hasPermission } from '@vapour/constants';

// Custom permission check: require MANAGE_USERS OR VIEW_USERS
function canAccessUsers(permissions: number): boolean {
  return (
    hasPermission(permissions, PERMISSION_FLAGS.MANAGE_USERS) ||
    hasPermission(permissions, PERMISSION_FLAGS.VIEW_USERS)
  );
}

export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canAccessUsers} moduleName="User Management">
      {children}
    </ModuleLayout>
  );
}
```

### Example 3: Projects Module

**File:** `apps/web/src/app/projects/layout.tsx`

```tsx
import { ModuleLayout } from '@/components/layouts/ModuleLayout';
import { PERMISSION_FLAGS, hasPermission } from '@vapour/constants';

function canAccessProjects(permissions: number): boolean {
  return (
    hasPermission(permissions, PERMISSION_FLAGS.MANAGE_PROJECTS) ||
    hasPermission(permissions, PERMISSION_FLAGS.VIEW_PROJECTS)
  );
}

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout permissionCheck={canAccessProjects} moduleName="Projects">
      {children}
    </ModuleLayout>
  );
}
```

---

## Summary

### Quick Checklist for New Modules

- [ ] Create module directory: `apps/web/src/app/[module-name]/`
- [ ] Create `layout.tsx` using `ModuleLayout` component
- [ ] Create `page.tsx` for module landing page
- [ ] Define permission helpers in `@vapour/constants`
- [ ] Add menu item to Sidebar component
- [ ] Test with different user roles and permissions
- [ ] Verify navigation, theme toggle, and access control work

---

**Last Updated:** October 31, 2025
**Author:** Claude Code (System Maintenance)
**Version:** 1.0
