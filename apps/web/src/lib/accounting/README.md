# Accounting Module

Financial management and accounting operations for the Vapour Toolbox application.

## Overview

The accounting module provides:

1. **Chart of Accounts** - Account structure and hierarchy
2. **Transactions** - Journal entries and ledger management
3. **Cost Centres** - Department/project cost tracking
4. **Fiscal Years** - Period management and closing
5. **Bank Reconciliation** - Statement matching and reconciliation
6. **Forex** - Currency exchange and gain/loss tracking
7. **Bill Management** - Vendor bill processing and approval
8. **Invoice Management** - Customer invoice processing

## Directory Structure

```
accounting/
├── index.ts                      # Main barrel export
│
├── bankReconciliation/           # Bank statement reconciliation
│   ├── autoMatching.ts          # Auto-matching algorithms
│   ├── crud.ts                  # Statement CRUD operations
│   ├── matching.ts              # Manual matching logic
│   ├── reporting.ts             # Reconciliation reports
│   └── types.ts
│
├── reports/                      # Financial reports
│   ├── balanceSheet.ts
│   └── profitLoss.ts
│
├── hooks/                        # React Query hooks
│   └── ...
│
├── billApprovalService.ts        # Bill approval workflow
├── billVoidService.ts            # Bill voiding operations
├── costCentreService.ts          # Cost centre management
├── fiscalYearService.ts          # Fiscal year operations
├── glEntryGenerator.ts           # GL entry creation
├── invoiceApprovalService.ts     # Invoice approval workflow
├── paymentHelpers.ts             # Payment utilities
├── transactionHelpers.ts         # Transaction utilities
├── transactionService.ts         # Transaction CRUD
└── vendorBillIntegrationService.ts
```

## Key Services

### Transaction Service

```typescript
import { createTransaction, getTransactionById } from '@/lib/accounting';
```

### GL Entry Generator

```typescript
import { generateGLEntries } from '@/lib/accounting';
```

### Bank Reconciliation

```typescript
import {
  createBankStatement,
  runAutoMatching,
  matchTransactions,
} from '@/lib/accounting/bankReconciliation';
```

## Account Types

- **ASSET** - Assets (Cash, Inventory, Equipment)
- **LIABILITY** - Liabilities (Payables, Loans)
- **EQUITY** - Owner's equity
- **REVENUE** - Income accounts
- **EXPENSE** - Expense accounts

## Fiscal Year Workflow

1. Create fiscal year with periods
2. Open periods for transactions
3. Close periods after review
4. Year-end closing entries
5. Carry forward balances

## Bank Reconciliation Flow

1. Import bank statement (CSV/manual)
2. Auto-match transactions (configurable thresholds)
3. Manual matching for unmatched items
4. Generate adjustment entries
5. Complete reconciliation report

## Integration Points

- **Procurement** - Bills from POs, GR accounting
- **Projects** - Cost centre allocation
- **HR** - Expense reimbursements
- **Documents** - Bill/invoice attachments

## Testing

```bash
pnpm --filter @vapour/web test src/lib/accounting
```

## Configuration

- System accounts configured in Firebase
- Exchange rates updated via admin panel
- Tolerance settings for 3-way matching
