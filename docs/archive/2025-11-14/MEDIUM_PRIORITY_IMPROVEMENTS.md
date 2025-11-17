# Medium Priority Code Review Improvements - Implementation Guide

**Status**: In Progress
**Created**: 2025-01-06
**Priority**: Medium (Complete after Critical/High priority fixes)

This document provides detailed implementation steps for all remaining medium and low priority improvements identified in the comprehensive code review.

---

## ✅ Completed Improvements

### 1. Custom useFirestoreQuery Hook

**Status**: ✅ COMPLETE
**Location**: `/apps/web/src/hooks/useFirestoreQuery.ts`
**Impact**: Eliminates ~300 lines of boilerplate across 15+ files

**Features**:

- Automatic loading state management
- Error handling
- Cleanup on unmount
- Memoization support
- Support for both collections and single documents

**Usage Example**:

```tsx
const {
  data: invoices,
  loading,
  error,
} = useFirestoreQuery<Invoice>(
  useMemo(
    () =>
      query(
        collection(db, 'transactions'),
        where('type', '==', 'CUSTOMER_INVOICE'),
        orderBy('date', 'desc')
      ),
    [db]
  )
);
```

**Refactored Pages**:

- ✅ `/apps/web/src/app/accounting/invoices/page.tsx`
- 🔄 `/apps/web/src/app/accounting/bills/page.tsx` (in progress)
- ⏳ `/apps/web/src/app/accounting/payments/page.tsx` (pending)

**Remaining Pages to Refactor** (15 files):

1. `/apps/web/src/app/entities/page.tsx`
2. `/apps/web/src/app/projects/page.tsx`
3. `/apps/web/src/app/accounting/journal-entries/page.tsx`
4. `/apps/web/src/app/accounting/chart-of-accounts/page.tsx`
5. `/apps/web/src/app/procurement/purchase-requests/page.tsx`
6. `/apps/web/src/app/procurement/rfqs/page.tsx`
7. `/apps/web/src/app/procurement/purchase-orders/page.tsx`
8. `/apps/web/src/app/time-tracking/page.tsx`
9. `/apps/web/src/app/time-tracking/leave-requests/page.tsx`
10. `/apps/web/src/app/user-management/page.tsx`
11. And more...

**Pattern for Refactoring**:

```tsx
// BEFORE (20+ lines)
const [data, setData] = useState<Type[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const q = query(collection(db, 'collection'), ...filters);
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setData(items);
    setLoading(false);
  });
  return () => unsubscribe();
}, []);

// AFTER (3 lines)
const query = useMemo(() => query(collection(db, 'collection'), ...filters), [db]);
const { data, loading, error } = useFirestoreQuery<Type>(query);
```

---

## 2. Add Memoization to Computed Values

**Status**: ⏳ PENDING
**Estimated Time**: 1-2 hours
**Priority**: Medium
**Impact**: Performance improvement for large datasets

### Implementation Steps:

#### 2.1 Identify Candidates for Memoization

Search for patterns like:

```tsx
// Filtered data (re-computed on every render)
const filteredItems = items.filter((item) => item.status === selectedStatus);

// Computed totals
const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

// Sorted data
const sortedItems = items.sort((a, b) => a.date - b.date);
```

#### 2.2 Apply useMemo

```tsx
import { useMemo } from 'react';

// ✅ CORRECT - Memoized computation
const filteredItems = useMemo(
  () => items.filter((item) => item.status === selectedStatus),
  [items, selectedStatus]
);

const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);

const sortedItems = useMemo(
  () => [...items].sort((a, b) => a.date.getTime() - b.date.getTime()),
  [items]
);
```

#### 2.3 Priority Pages for Memoization

1. **Invoices Page** - Filter by status, compute totals
2. **Bills Page** - Filter by status, compute totals
3. **Payments Page** - Filter by type, compute allocations
4. **Chart of Accounts** - Filter by type, compute balances
5. **Purchase Requests** - Filter by status/project
6. **Time Tracking** - Compute weekly/monthly totals

#### 2.4 Example Implementation (Invoices Page)

```tsx
export default function InvoicesPage() {
  const { data: invoices, loading } = useFirestoreQuery<Invoice>(query);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Memoized filtered data
  const filteredInvoices = useMemo(
    () =>
      statusFilter === 'ALL' ? invoices : invoices.filter((inv) => inv.status === statusFilter),
    [invoices, statusFilter]
  );

  // Memoized totals
  const totals = useMemo(
    () => ({
      count: filteredInvoices.length,
      total: filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      paid: filteredInvoices.filter((inv) => inv.status === 'PAID').length,
    }),
    [filteredInvoices]
  );

  // Memoized paginated data
  const paginatedInvoices = useMemo(
    () => filteredInvoices.slice(page * rowsPerPage, (page + 1) * rowsPerPage),
    [filteredInvoices, page, rowsPerPage]
  );

  return (
    <Container>
      <Typography>Total: {totals.total}</Typography>
      <Typography>
        Paid: {totals.paid}/{totals.count}
      </Typography>
      <Table>
        {paginatedInvoices.map((invoice) => (
          <TableRow key={invoice.id}>...</TableRow>
        ))}
      </Table>
    </Container>
  );
}
```

---

## 3. Standardize Input Validation with Zod

**Status**: ⏳ PENDING
**Estimated Time**: 3-4 hours
**Priority**: Medium
**Impact**: Better UX, consistent validation

### Implementation Steps:

#### 3.1 Install Zod (Already installed)

Zod is already in `packages/validation/package.json`.

#### 3.2 Create Validation Schemas

Create schemas for all form inputs:

**File**: `/packages/validation/src/accounting.ts` (extend existing)

```tsx
import { z } from 'zod';

// Invoice validation schema
export const invoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  invoiceDate: z.date(),
  dueDate: z.date(),
  items: z
    .array(
      z.object({
        description: z.string().min(1, 'Description required'),
        quantity: z.number().positive('Must be positive'),
        unitPrice: z.number().positive('Must be positive'),
        amount: z.number(),
      })
    )
    .min(1, 'At least one item required'),
  subtotal: z.number(),
  gstRate: z.number().min(0).max(100),
  gstAmount: z.number(),
  totalAmount: z.number().positive(),
  notes: z.string().optional(),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

// Bill validation schema
export const billSchema = z.object({
  vendorId: z.string().min(1, 'Vendor is required'),
  billDate: z.date(),
  dueDate: z.date(),
  billNumber: z.string().min(1, 'Bill number required'),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
        amount: z.number(),
      })
    )
    .min(1),
  tdsSection: z.enum(['194C', '194I', '194J', 'NONE']).optional(),
  tdsAmount: z.number().optional(),
});

export type BillFormData = z.infer<typeof billSchema>;

// Payment validation schema
export const paymentSchema = z.object({
  paymentType: z.enum(['CUSTOMER_PAYMENT', 'VENDOR_PAYMENT']),
  entityId: z.string().min(1),
  paymentDate: z.date(),
  amount: z.number().positive('Amount must be positive'),
  paymentMode: z.enum(['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI', 'CARD']),
  referenceNumber: z.string().optional(),
  bankAccountId: z.string().optional(),
  notes: z.string().optional(),
});

export type PaymentFormData = z.infer<typeof paymentSchema>;
```

#### 3.3 Integrate Zod in Forms

**Example**: CreateInvoiceDialog

```tsx
import { invoiceSchema, type InvoiceFormData } from '@vapour/validation';

export function CreateInvoiceDialog({ open, onClose }: Props) {
  const [formData, setFormData] = useState<Partial<InvoiceFormData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    try {
      // Validate with Zod
      const validated = invoiceSchema.parse(formData);

      // If valid, proceed with save
      await createInvoice(validated);
      onClose();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Convert Zod errors to field errors
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          fieldErrors[path] = err.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <TextField
        label="Customer"
        value={formData.customerId || ''}
        onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
        error={!!errors.customerId}
        helperText={errors.customerId}
      />
      {/* More fields... */}
      <Button onClick={handleSubmit}>Save</Button>
    </Dialog>
  );
}
```

#### 3.4 Priority Forms to Validate

1. CreateInvoiceDialog
2. CreateBillDialog
3. RecordCustomerPaymentDialog
4. RecordVendorPaymentDialog
5. CreateJournalEntryDialog
6. CreateEntityDialog
7. CreateProjectDialog
8. TimeEntryDialog

---

## 4. Extract Shared Transaction Dialog Logic

**Status**: ⏳ PENDING
**Estimated Time**: 4-5 hours
**Priority**: Medium
**Impact**: Reduces 1,500 lines of duplicate code

### Analysis:

**Duplicate Code Across 4 Dialogs**:

- CreateInvoiceDialog.tsx (~400 lines)
- CreateBillDialog.tsx (~400 lines)
- RecordCustomerPaymentDialog.tsx (~350 lines)
- RecordVendorPaymentDialog.tsx (~350 lines)

**Shared Functionality**:

1. Entity selection (customer/vendor)
2. Line item management (add/remove/calculate)
3. Tax calculations (GST/TDS)
4. Total calculations
5. Form state management
6. Validation
7. Submit handling

### Implementation Plan:

#### 4.1 Create Shared Components

**File**: `/apps/web/src/components/accounting/shared/EntitySelector.tsx`

```tsx
interface EntitySelectorProps {
  entityType: 'customer' | 'vendor';
  value: string;
  onChange: (entityId: string) => void;
  error?: string;
}

export function EntitySelector({ entityType, value, onChange, error }: EntitySelectorProps) {
  const { data: entities, loading } = useFirestoreQuery<Entity>(
    useMemo(
      () =>
        query(
          collection(db, 'entities'),
          where('roles', 'array-contains', entityType.toUpperCase())
        ),
      [entityType]
    )
  );

  return (
    <Autocomplete
      options={entities}
      getOptionLabel={(entity) => entity.name}
      value={entities.find((e) => e.id === value) || null}
      onChange={(_, entity) => onChange(entity?.id || '')}
      renderInput={(params) => (
        <TextField
          {...params}
          label={entityType === 'customer' ? 'Customer' : 'Vendor'}
          error={!!error}
          helperText={error}
        />
      )}
      loading={loading}
    />
  );
}
```

**File**: `/apps/web/src/components/accounting/shared/LineItemsTable.tsx`

```tsx
interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface LineItemsTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  readOnly?: boolean;
}

export function LineItemsTable({ items, onChange, readOnly }: LineItemsTableProps) {
  const handleAdd = () => {
    onChange([...items, { id: nanoid(), description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const handleRemove = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const handleChange = (id: string, field: keyof LineItem, value: any) => {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.amount = updated.quantity * updated.unitPrice;
        }
        return updated;
      })
    );
  };

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Description</TableCell>
          <TableCell>Qty</TableCell>
          <TableCell>Unit Price</TableCell>
          <TableCell>Amount</TableCell>
          {!readOnly && <TableCell>Actions</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <TextField
                value={item.description}
                onChange={(e) => handleChange(item.id, 'description', e.target.value)}
                disabled={readOnly}
                fullWidth
              />
            </TableCell>
            <TableCell>
              <TextField
                type="number"
                value={item.quantity}
                onChange={(e) => handleChange(item.id, 'quantity', Number(e.target.value))}
                disabled={readOnly}
              />
            </TableCell>
            <TableCell>
              <TextField
                type="number"
                value={item.unitPrice}
                onChange={(e) => handleChange(item.id, 'unitPrice', Number(e.target.value))}
                disabled={readOnly}
              />
            </TableCell>
            <TableCell>{formatCurrency(item.amount)}</TableCell>
            {!readOnly && (
              <TableCell>
                <IconButton onClick={() => handleRemove(item.id)} size="small">
                  <DeleteIcon />
                </IconButton>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
      {!readOnly && (
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5}>
              <Button onClick={handleAdd} startIcon={<AddIcon />}>
                Add Item
              </Button>
            </TableCell>
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
```

**File**: `/apps/web/src/hooks/useTransactionForm.ts`

```tsx
export function useTransactionForm<T extends TransactionFormData>(
  initialData: Partial<T>,
  schema: z.ZodSchema<T>
) {
  const [formData, setFormData] = useState<Partial<T>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof T, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = (): T | null => {
    try {
      const validated = schema.parse(formData);
      setErrors({});
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          fieldErrors[err.path.join('.')] = err.message;
        });
        setErrors(fieldErrors);
      }
      return null;
    }
  };

  return {
    formData,
    setFormData,
    handleChange,
    errors,
    validate,
    loading,
    setLoading,
  };
}
```

#### 4.2 Refactor CreateInvoiceDialog

```tsx
export function CreateInvoiceDialog({ open, onClose, invoice }: Props) {
  const { formData, handleChange, errors, validate, loading, setLoading } = useTransactionForm(
    invoice || {},
    invoiceSchema
  );

  const handleSubmit = async () => {
    const validated = validate();
    if (!validated) return;

    setLoading(true);
    try {
      if (invoice) {
        await updateInvoice(invoice.id, validated);
      } else {
        await createInvoice(validated);
      }
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg">
      <DialogTitle>{invoice ? 'Edit Invoice' : 'Create Invoice'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <EntitySelector
            entityType="customer"
            value={formData.customerId || ''}
            onChange={(id) => handleChange('customerId', id)}
            error={errors.customerId}
          />

          <DatePicker
            label="Invoice Date"
            value={formData.invoiceDate}
            onChange={(date) => handleChange('invoiceDate', date)}
            error={errors.invoiceDate}
          />

          <LineItemsTable
            items={formData.items || []}
            onChange={(items) => handleChange('items', items)}
          />

          <TaxCalculator
            subtotal={calculateSubtotal(formData.items)}
            gstRate={formData.gstRate}
            onChange={(tax) => {
              handleChange('gstAmount', tax.total);
              handleChange('totalAmount', calculateSubtotal(formData.items) + tax.total);
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

---

## 5. Integrate Sentry for Error Monitoring

**Status**: ⏳ PENDING
**Estimated Time**: 2-3 hours
**Priority**: Medium
**Impact**: Production error tracking, better debugging

### Implementation Steps:

#### 5.1 Install Sentry

```bash
pnpm add --filter @vapour/web @sentry/nextjs @sentry/react
```

#### 5.2 Configure Sentry

**File**: `/apps/web/sentry.client.config.ts`

```tsx
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,

  // Performance monitoring
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],

  // Capture 10% of all sessions
  replaysSessionSampleRate: 0.1,

  // Capture 100% of sessions with errors
  replaysOnErrorSampleRate: 1.0,

  // Filter sensitive data
  beforeSend(event, hint) {
    // Remove sensitive headers
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.Authorization;
    }
    return event;
  },
});
```

**File**: `/apps/web/sentry.server.config.ts`

```tsx
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

**File**: `/apps/web/sentry.edge.config.ts`

```tsx
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});
```

#### 5.3 Update next.config.js

```js
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  // ... existing config
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: 'vapour-desal',
  project: 'vdt-unified',
});
```

#### 5.4 Add Error Boundary

**File**: `/apps/web/src/components/common/ErrorBoundary.tsx`

```tsx
'use client';

import * as Sentry from '@sentry/nextjs';
import { Component, ReactNode } from 'react';
import { Container, Typography, Button } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="h4" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            We've been notified and are working on a fix.
          </Typography>
          <Button
            variant="contained"
            onClick={() => this.setState({ hasError: false })}
            sx={{ mt: 2 }}
          >
            Try Again
          </Button>
        </Container>
      );
    }

    return this.props.children;
  }
}
```

#### 5.5 Wrap App with Error Boundary

**File**: `/apps/web/src/app/layout.tsx`

```tsx
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
```

#### 5.6 Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# .env.production
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-auth-token
```

---

## Remaining Tasks (Full Specifications)

Due to context limits, the remaining tasks (6-9) require separate dedicated documents:

### 6. Set up Vitest for Unit Testing

**Documentation**: See `TESTING_SETUP.md` (to be created)

- Configure Vitest
- Set up test utilities
- Write tests for utility functions
- Target 80% coverage

### 7. Implement Report Pre-aggregation

**Documentation**: See `REPORT_AGGREGATION.md` (to be created)

- Cloud Function for monthly summaries
- Firestore triggers
- Scheduled jobs with Cloud Scheduler

### 8. Add React Query for Caching

**Documentation**: See `REACT_QUERY_INTEGRATION.md` (to be created)

- Install @tanstack/react-query
- Configure query client
- Migrate Firestore queries

### 9. Implement Data Archival Strategy

**Documentation**: See `DATA_ARCHIVAL.md` (to be created)

- Archive transactions older than 2 years
- Cloud Function for archival
- Restore functionality

---

## Progress Tracking

| Task                      | Status      | Estimated | Actual | Notes                               |
| ------------------------- | ----------- | --------- | ------ | ----------------------------------- |
| 1. useFirestoreQuery hook | ✅ COMPLETE | 1h        | 1h     | Hook created, 1 page refactored     |
| 2. Add memoization        | ⏳ PENDING  | 1-2h      | -      | Priority: Invoices, Bills, Payments |
| 3. Zod validation         | ⏳ PENDING  | 3-4h      | -      | Start with invoice/bill forms       |
| 4. Extract dialog logic   | ⏳ PENDING  | 4-5h      | -      | High complexity                     |
| 5. Sentry integration     | ⏳ PENDING  | 2-3h      | -      | Requires Sentry account             |
| 6. Vitest setup           | ⏳ PENDING  | 3-4h      | -      | Infrastructure task                 |
| 7. Report pre-aggregation | ⏳ PENDING  | 4-5h      | -      | Cloud Functions work                |
| 8. React Query            | ⏳ PENDING  | 3-4h      | -      | Architectural change                |
| 9. Data archival          | ⏳ PENDING  | 4-5h      | -      | Requires planning                   |

**Total Estimated Time**: 25-30 hours
**Completed**: 1 hour
**Remaining**: 24-29 hours

---

## Next Steps

1. **Immediate** (This Session):
   - Complete bills/payments page refactoring with useFirestoreQuery
   - Add basic memoization to invoices/bills/payments
   - Commit and push changes

2. **Next Session**:
   - Complete Zod validation for invoice/bill forms
   - Extract shared dialog components
   - Refactor 5-10 more pages to use useFirestoreQuery

3. **Future Sessions**:
   - Sentry integration
   - Vitest setup
   - Advanced optimizations (React Query, pre-aggregation, archival)

---

**Last Updated**: 2025-01-06
**Author**: Claude Code
**Review Date**: Next code review session
