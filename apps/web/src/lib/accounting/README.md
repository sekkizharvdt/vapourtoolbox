# Accounting Module

Financial management and accounting operations for the Vapour Toolbox application.

## Overview

The accounting module provides:

1. **Chart of Accounts** - Account structure and hierarchy
2. **Transactions** - Journal entries and ledger management
3. **Cost Centres** - Department/project cost tracking
4. **Fiscal Years** - Period management and closing
5. **Forex** - Currency exchange and gain/loss tracking
6. **Bill Management** - Vendor bill processing and approval
7. **Invoice Management** - Customer invoice processing

## Directory Structure

```
accounting/
├── index.ts                      # Main barrel export
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
