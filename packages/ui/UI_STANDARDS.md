# UI Standardization Guide

This document outlines the standardized UI components and patterns to ensure consistency across the VDT-Unified application.

## Core Principles

1. **Consistency**: Use standardized components for common UI patterns
2. **Reusability**: Build once, use everywhere
3. **Type Safety**: Fully typed components with TypeScript
4. **Accessibility**: ARIA labels and semantic HTML
5. **Responsive**: Mobile-first design with Material-UI breakpoints

## Standardized Components

### 1. PageHeader

Use for all page title headers with optional actions.

```tsx
import { PageHeader } from '@vapour/ui';
import { Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

<PageHeader
  title="Page Title"
  subtitle="Optional description text"
  action={
    <Button variant="contained" startIcon={<AddIcon />}>
      New Item
    </Button>
  }
/>;
```

**Props:**

- `title` (required): Main page heading
- `subtitle` (optional): Secondary description
- `action` (optional): Action button or component
- `sx` (optional): Custom styling

**Replaces:**

- Various header patterns with Box/Typography combinations
- Inconsistent spacing and alignment

---

### 2. EmptyState

Use for "no data" states in tables, cards, and pages.

```tsx
import { EmptyState } from '@vapour/ui';
import { Button } from '@mui/material';

// In a table
<EmptyState
  message="No items found"
  variant="table"
  colSpan={8}
/>

// In a card or paper
<EmptyState
  message="No projects yet"
  variant="paper"
  action={
    <Button variant="contained">
      Create First Project
    </Button>
  }
/>

// Inline in a page
<EmptyState
  message="No results match your search"
  variant="inline"
/>
```

**Props:**

- `message` (required): Message to display
- `variant` (optional): 'table' | 'card' | 'paper' | 'inline' (default: 'inline')
- `action` (optional): Action button or component
- `colSpan` (optional): Number of columns to span (table variant only)
- `sx` (optional): Custom styling

---

### 3. LoadingState

Use for loading indicators with consistent styling.

```tsx
import { LoadingState } from '@vapour/ui';

// In a table
<LoadingState
  message="Loading items..."
  variant="table"
  colSpan={8}
/>

// Full page loading
<LoadingState
  message="Loading..."
  variant="page"
  size={60}
/>

// Inline loading
<LoadingState variant="inline" />
```

**Props:**

- `message` (optional): Loading message (default: "Loading...")
- `variant` (optional): 'table' | 'inline' | 'page' (default: 'inline')
- `colSpan` (optional): Number of columns to span (table variant only)
- `size` (optional): Spinner size in pixels (default: 40)
- `sx` (optional): Custom styling

---

### 4. TableActionCell

Use for action buttons in table rows with consistent styling.

```tsx
import { TableActionCell } from '@vapour/ui';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';

<TableCell align="right">
  <TableActionCell
    actions={[
      {
        icon: <ViewIcon fontSize="small" />,
        label: 'View Details',
        onClick: () => handleView(row.id),
      },
      {
        icon: <EditIcon fontSize="small" />,
        label: 'Edit',
        onClick: () => handleEdit(row.id),
        show: hasEditPermission, // Conditional rendering
      },
      {
        icon: <DeleteIcon fontSize="small" />,
        label: 'Delete',
        onClick: () => handleDelete(row.id),
        color: 'error',
        show: hasDeletePermission,
      },
    ]}
  />
</TableCell>;
```

**Props:**

- `actions` (required): Array of action objects
  - `icon`: Icon element
  - `label`: Tooltip text
  - `onClick`: Click handler
  - `show` (optional): Whether to show (default: true)
  - `disabled` (optional): Whether disabled (default: false)
  - `color` (optional): Button color variant
- `size` (optional): 'small' | 'medium' | 'large' (default: 'small')

---

## Utility Functions

### Status Color Utilities

Provides consistent color mappings for status chips across the application.

```tsx
import { getStatusColor, getPriorityColor, getRoleColor } from '@vapour/ui';
import { Chip } from '@mui/material';

// Status chips
<Chip
  label={project.status}
  color={getStatusColor(project.status, 'project')}
  size="small"
/>

<Chip
  label={invoice.status}
  color={getStatusColor(invoice.status, 'invoice')}
  size="small"
/>

// Priority chips
<Chip
  label={task.priority}
  color={getPriorityColor(task.priority)}
  size="small"
/>

// Role chips
<Chip
  label={entity.role}
  color={getRoleColor(entity.role)}
  size="small"
  variant="outlined"
/>
```

**Functions:**

1. **`getStatusColor(status: string, context?: string)`**
   - Contexts: 'project' | 'invoice' | 'bill' | 'user' | 'bom' | 'document'
   - Returns: MUI Chip color prop value

2. **`getPriorityColor(priority: string)`**
   - Priority levels: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
   - Returns: MUI Chip color prop value

3. **`getRoleColor(role: string)`**
   - Roles: 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE' | 'CONTRACTOR'
   - Returns: MUI Chip color prop value

**Standard Mappings:**

- **Success (green)**: ACTIVE, APPROVED, POSTED, COMPLETED, RELEASED
- **Warning (orange)**: PENDING, ON_HOLD, IN_PROGRESS, UNDER_REVIEW
- **Error (red)**: INACTIVE, REJECTED, VOID, CANCELLED, ARCHIVED
- **Primary (blue)**: PROPOSAL
- **Default (gray)**: DRAFT

---

## Layout Standards

### Container Widths

Use consistent container widths based on page type:

```tsx
// List/Table pages - Maximum width
<Container maxWidth="xl">
  {content}
</Container>

// Detail/Edit pages - Large width
<Container maxWidth="lg">
  {content}
</Container>

// Create/New pages - Medium width
<Container maxWidth="md">
  {content}
</Container>
```

### Main Content Padding

Always use a consistent padding pattern:

```tsx
<Container maxWidth="xl">
  <Box sx={{ mb: 4 }}>
    <PageHeader title="..." />
    {/* Rest of content */}
  </Box>
</Container>
```

### Filter Sections

Standardize filter sections with Paper:

```tsx
<Paper sx={{ p: 2, mb: 2 }}>
  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
    <TextField
      placeholder="Search..."
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon />
          </InputAdornment>
        ),
      }}
      sx={{ flexGrow: 1, minWidth: 300 }}
    />
    <FormControl sx={{ minWidth: 150 }}>
      <InputLabel>Filter</InputLabel>
      <Select>...</Select>
    </FormControl>
  </Box>
</Paper>
```

---

## Migration Checklist

When updating a page to use standardized components:

- [ ] Replace custom header with `<PageHeader>`
- [ ] Replace loading indicators with `<LoadingState>`
- [ ] Replace empty states with `<EmptyState>`
- [ ] Replace table action cells with `<TableActionCell>`
- [ ] Replace status color functions with `getStatusColor()`
- [ ] Use consistent container widths
- [ ] Use `Paper sx={{ p: 2, mb: 2 }}` for filters
- [ ] Ensure proper spacing with `Box sx={{ mb: 4 }}`
- [ ] Remove unused imports

---

## Examples

### Complete Page Example

```tsx
'use client';

import { useState } from 'react';
import {
  Container,
  Box,
  Paper,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { PageHeader, LoadingState, EmptyState, TableActionCell, getStatusColor } from '@vapour/ui';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <PageHeader
          title="Items"
          subtitle="Manage your items"
          action={
            <Button variant="contained" startIcon={<AddIcon />}>
              New Item
            </Button>
          }
        />

        <Paper sx={{ p: 2, mb: 2 }}>
          <TextField
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            fullWidth
          />
        </Paper>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingState variant="table" colSpan={3} />
              ) : items.length === 0 ? (
                <EmptyState message="No items found" variant="table" colSpan={3} />
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      <Chip label={item.status} size="small" color={getStatusColor(item.status)} />
                    </TableCell>
                    <TableCell align="right">
                      <TableActionCell
                        actions={[
                          {
                            icon: <EditIcon fontSize="small" />,
                            label: 'Edit',
                            onClick: () => handleEdit(item.id),
                          },
                          {
                            icon: <DeleteIcon fontSize="small" />,
                            label: 'Delete',
                            onClick: () => handleDelete(item.id),
                            color: 'error',
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Container>
  );
}
```

---

## Benefits

1. **Consistency**: All pages follow the same patterns
2. **Maintainability**: Update once, apply everywhere
3. **Developer Experience**: Less code to write, clearer intent
4. **Performance**: Optimized components with proper memoization
5. **Accessibility**: Built-in ARIA labels and semantic HTML
6. **Type Safety**: Full TypeScript support with prop validation

---

## Next Steps

Continue migrating existing pages to use these standardized components:

### High Priority Pages

- [x] Projects page
- [x] Bought-out page
- [ ] Entities page
- [ ] Users page
- [ ] Accounting pages (invoices, bills, etc.)

### Medium Priority

- [ ] Materials pages
- [ ] Estimation pages
- [ ] Procurement pages

### Component Enhancements (Future)

- FilterBar component (standardized filter section)
- StatCard component (for dashboard stats)
- FormField wrappers (standardized form field patterns)
- SearchBar component (reusable search with debounce)
