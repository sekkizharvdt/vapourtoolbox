# Test Utilities

Comprehensive testing utilities for the VDT Unified application.

## Contents

- **`index.tsx`** - Main exports, custom render with MUI theme
- **`auth-wrapper.tsx`** - AuthContext test wrappers for role-based testing
- **`factories.ts`** - Test data factories for users, entities, projects, etc.
- **`firebase-mocks.ts`** - Firebase service mocks (Auth, Firestore, Storage)

## Quick Start

### Basic Component Testing

```tsx
import { render, screen } from '@/test-utils';

test('renders component', () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

### Role-Based Testing

```tsx
import { renderAs } from '@/test-utils';

test('super admin can see admin panel', () => {
  renderAs.superAdmin(<DashboardPage />);
  expect(screen.getByText('Admin Panel')).toBeInTheDocument();
});

test('team member cannot see admin panel', () => {
  renderAs.teamMember(<DashboardPage />);
  expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
});
```

### Testing With Custom Permissions

```tsx
import { renderWithAuth, createMockCustomClaims } from '@/test-utils';
import { PermissionFlag } from '@vapour/types';

test('user with CREATE_PR permission can create purchase request', () => {
  const customClaims = createMockCustomClaims('TEAM_MEMBER', {
    permissions: PermissionFlag.CREATE_PR,
  });

  renderWithAuth(<ProcurementPage />, { claims: customClaims });
  expect(screen.getByRole('button', { name: /create request/i })).toBeEnabled();
});
```

### Testing Unauthenticated State

```tsx
import { renderAs } from '@/test-utils';

test('unauthenticated user sees login page', () => {
  renderAs.unauthenticated(<App />);
  expect(screen.getByText('Sign In')).toBeInTheDocument();
});
```

### Testing Loading State

```tsx
import { renderAs } from '@/test-utils';

test('shows loading spinner while authenticating', () => {
  renderAs.loading(<App />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});
```

### Testing Pending Approval State

```tsx
import { renderAs } from '@/test-utils';

test('pending user sees approval message', () => {
  renderAs.pending(<DashboardPage />);
  expect(screen.getByText(/awaiting approval/i)).toBeInTheDocument();
});
```

## Test Data Factories

### User Factories

```tsx
import { UserRoles, createMockUser } from '@/test-utils';

// Predefined roles
const superAdmin = UserRoles.superAdmin();
const projectManager = UserRoles.projectManager();
const accountant = UserRoles.accountant();

// Custom user
const customUser = createMockUser('ENGINEER', {
  uid: 'custom-id',
  email: 'custom@vapourdesal.com',
  department: 'ENGINEERING',
});
```

### Entity Factories

```tsx
import { createMockVendor, createMockCustomer } from '@/test-utils';

const vendor = createMockVendor({
  name: 'Custom Vendor Ltd',
  taxDetails: {
    gstNumber: '27AABCU9603R1ZM',
  },
});

const customer = createMockCustomer();
```

### Project Factories

```tsx
import { createMockProject } from '@/test-utils';

const project = createMockProject({
  name: 'Test Project',
  status: 'ACTIVE',
  customerId: 'customer-123',
});
```

### Transaction Factories

```tsx
import { createMockAccountingTransaction, createMockBankTransaction } from '@/test-utils';

const payment = createMockAccountingTransaction({
  type: 'VENDOR_PAYMENT',
  amount: 10000,
});

const bankTxn = createMockBankTransaction({
  credit: 10000,
  description: 'Payment received',
});
```

### Procurement Factories

```tsx
import { createMockPurchaseRequest, createMockRFQ, createMockPurchaseOrder } from '@/test-utils';

const pr = createMockPurchaseRequest();
const rfq = createMockRFQ();
const po = createMockPurchaseOrder();
```

## Firebase Mocks

### Mocking Firestore

```tsx
import { mockFirestore, createMockQuerySnapshot, createMockBatch } from '@/test-utils';

// Mock collection query
mockFirestore.getDocs.mockResolvedValue(
  createMockQuerySnapshot([
    { id: 'doc1', data: { name: 'Item 1' } },
    { id: 'doc2', data: { name: 'Item 2' } },
  ])
);

// Mock batch write
const batch = createMockBatch();
mockFirestore.writeBatch = jest.fn(() => batch);
```

### Mocking Real-time Listeners

```tsx
import { createMockOnSnapshot } from '@/test-utils';

const { onSnapshot, triggerSnapshot } = createMockOnSnapshot();

// Setup component with onSnapshot
const MyComponent = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot((snapshot) => {
      setData(snapshot.docs.map((doc) => doc.data()));
    });
    return unsubscribe;
  }, []);

  return <div>{data.length} items</div>;
};

// In test
render(<MyComponent />);
triggerSnapshot([{ name: 'Item 1' }, { name: 'Item 2' }]);
expect(screen.getByText('2 items')).toBeInTheDocument();
```

### Mocking Firebase Errors

```tsx
import { createFirebaseError, FirebaseErrorCodes } from '@/test-utils';

test('handles permission denied error', async () => {
  const error = createFirebaseError(FirebaseErrorCodes.PERMISSION_DENIED);
  mockFirestore.getDocs.mockRejectedValue(error);

  render(<MyComponent />);
  await waitFor(() => {
    expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
  });
});
```

## Available Roles

The `renderAs` helper supports all application roles:

- **`superAdmin`** - Full access to all features
- **`director`** - Approval and oversight permissions
- **`projectManager`** - Project creation and management
- **`procurementManager`** - Procurement workflow management
- **`accountant`** - Transaction creation and reports
- **`financeManager`** - Transaction approval and reports
- **`engineeringHead`** - Project oversight and leave approval
- **`engineer`** - Estimation creation
- **`siteEngineer`** - Purchase request creation
- **`teamMember`** - Minimal permissions
- **`clientPM`** - External view-only procurement access
- **`unauthenticated`** - No user logged in
- **`pending`** - User authenticated but awaiting approval
- **`loading`** - Authentication in progress

## Permission Flags

All permission flags from `@vapour/types` are available:

```tsx
import { PermissionFlag } from '@vapour/types';

// User Management
PermissionFlag.MANAGE_USERS;
PermissionFlag.ASSIGN_ROLES;

// Project Management
PermissionFlag.CREATE_PROJECTS;
PermissionFlag.VIEW_ALL_PROJECTS;
PermissionFlag.ASSIGN_PROJECTS;

// Entity Management
PermissionFlag.MANAGE_ENTITIES;

// Accounting
PermissionFlag.CREATE_TRANSACTIONS;
PermissionFlag.APPROVE_TRANSACTIONS;
PermissionFlag.VIEW_REPORTS;

// Procurement
PermissionFlag.CREATE_PR;
PermissionFlag.APPROVE_PR;
PermissionFlag.CREATE_RFQ;
PermissionFlag.CREATE_PO;
PermissionFlag.APPROVE_PO;

// View-only (for external users)
PermissionFlag.VIEW_PROCUREMENT;
PermissionFlag.VIEW_PROJECT_STATUS;
PermissionFlag.VIEW_PAYMENT_STATUS;
```

## Best Practices

### 1. Use Role-Based Helpers When Possible

```tsx
// ✅ Good
renderAs.superAdmin(<Component />);

// ❌ Avoid unless you need custom permissions
renderWithAuth(<Component />, {
  user: createMockAuthenticatedUser('SUPER_ADMIN'),
});
```

### 2. Reset Mocks Between Tests

```tsx
import { resetFirebaseMocks } from '@/test-utils';

beforeEach(() => {
  resetFirebaseMocks();
});
```

### 3. Use Factories for Consistency

```tsx
// ✅ Good - uses factory defaults
const vendor = createMockVendor();

// ❌ Avoid - manual object creation
const vendor = {
  id: 'vendor-123',
  name: 'Test Vendor',
  // ... 20 more fields
};
```

### 4. Test Permission Boundaries

```tsx
describe('PurchaseRequestPage', () => {
  it('allows site engineer to create PR', () => {
    renderAs.siteEngineer(<PurchaseRequestPage />);
    expect(screen.getByRole('button', { name: /create/i })).toBeEnabled();
  });

  it('prevents team member from creating PR', () => {
    renderAs.teamMember(<PurchaseRequestPage />);
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument();
  });
});
```

### 5. Use Async Utilities for Firebase

```tsx
import { waitFor, flushPromises } from '@/test-utils';

test('loads data from Firestore', async () => {
  mockFirestore.getDocs.mockResolvedValue(createMockQuerySnapshot([...]));

  render(<MyComponent />);

  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });
});
```

## Example Test Suite

```tsx
import { renderAs, createMockPurchaseRequest, waitFor } from '@/test-utils';

describe('PurchaseRequestList', () => {
  it('displays purchase requests for project manager', async () => {
    const pr = createMockPurchaseRequest();

    renderAs.projectManager(<PurchaseRequestList />);

    await waitFor(() => {
      expect(screen.getByText(pr.requestNumber)).toBeInTheDocument();
    });
  });

  it('allows procurement manager to approve', async () => {
    const pr = createMockPurchaseRequest({ status: 'PENDING' });

    renderAs.procurementManager(<PurchaseRequestDetail id={pr.id} />);

    const approveButton = screen.getByRole('button', { name: /approve/i });
    expect(approveButton).toBeEnabled();
  });

  it('does not allow team member to approve', () => {
    const pr = createMockPurchaseRequest({ status: 'PENDING' });

    renderAs.teamMember(<PurchaseRequestDetail id={pr.id} />);

    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });
});
```

## TypeScript Support

All utilities are fully typed with TypeScript. Your IDE will provide autocomplete and type checking:

```tsx
import { renderAs, UserRoles, createMockUser } from '@/test-utils';

// TypeScript will autocomplete all available roles
renderAs.superAdmin(<Component />);
renderAs.projectManager(<Component />);

// Type-safe factories
const user = createMockUser('SUPER_ADMIN', {
  // TypeScript will show available User fields
  displayName: 'Test User',
});
```
