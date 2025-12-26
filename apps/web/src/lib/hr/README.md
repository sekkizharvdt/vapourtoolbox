# HR Module

Human Resources management for the Vapour Toolbox application.

## Overview

The HR module provides:

1. **Leave Management** - Leave applications, approvals, and balance tracking
2. **Travel Expenses** - Expense reports with receipt uploads and approval workflow

## Directory Structure

```
hr/
├── index.ts                      # Main barrel export
│
├── leaves/                       # Leave management
│   ├── displayHelpers.ts        # Status colors, labels
│   ├── displayHelpers.test.ts
│   ├── hooks/                   # React Query hooks
│   │   └── useLeaves.ts
│   ├── index.ts
│   ├── leaveApprovalService.ts  # Approval workflow
│   ├── leaveBalanceService.ts   # Balance calculations
│   ├── leaveBalanceService.test.ts
│   ├── leaveRequestService.ts   # Leave CRUD
│   └── leaveTypeService.ts      # Leave type config
│
└── travelExpenses/              # Travel expense management
    ├── displayHelpers.ts        # Status colors, labels
    ├── hooks/
    │   └── useTravelExpenses.ts
    ├── index.ts
    ├── pdfReportService.ts      # PDF report generation
    ├── travelExpenseApprovalService.ts
    └── travelExpenseService.ts
```

## Leave Types

- **SICK** - Sick leave
- **CASUAL** - Casual/personal leave
- **EARNED** - Earned/annual leave
- **UNPAID** - Unpaid leave
- **MATERNITY** - Maternity leave
- **PATERNITY** - Paternity leave

## Leave Workflow

```
DRAFT → PENDING → APPROVED / REJECTED
              ↓
          CANCELLED (by user)
```

## Travel Expense Workflow

```
DRAFT → SUBMITTED → APPROVED → REIMBURSED
              ↓           ↓
         RETURNED    REJECTED
```

## Key Services

### Leave Management

```typescript
import {
  createLeaveRequest,
  submitLeaveRequest,
  approveLeaveRequest,
  getLeaveBalance,
} from '@/lib/hr/leaves';
```

### Travel Expenses

```typescript
import {
  createTravelExpenseReport,
  submitTravelExpenseReport,
  approveTravelExpenseReport,
  downloadTravelExpenseReportPDF,
} from '@/lib/hr/travelExpenses';
```

## Leave Balance Tracking

- **Entitled** - Annual entitlement per leave type
- **Used** - Approved leaves taken
- **Pending** - Leaves awaiting approval
- **Available** - Entitled - Used - Pending
- **Carry Forward** - Previous year balance

## Travel Expense Categories

- Accommodation
- Meals
- Transportation
- Fuel
- Airfare
- Other

## PDF Report Generation

Travel expense reports can be exported as professional PDF documents:

```typescript
import { downloadTravelExpenseReportPDF } from '@/lib/hr/travelExpenses';

await downloadTravelExpenseReportPDF(report, {
  includeReceipts: true,
  companyName: 'Vapour Desal',
});
```

## Testing

```bash
pnpm --filter @vapour/web test src/lib/hr
```

## Related Modules

- `@/lib/accounting` - Expense reimbursement accounting
- `@/lib/tasks` - Approval notifications
- `@/components/pdf` - PDF templates
