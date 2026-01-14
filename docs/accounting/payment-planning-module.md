# Payment Planning Module

## Overview

A new sub-module for the Accounting team to plan future payments based on expected receipts. This module provides cash flow forecasting by analyzing outstanding invoices (expected receipts) and unpaid bills (planned payments).

---

## Business Requirements

### Primary Use Cases

1. **Cash Flow Forecasting**
   - View projected cash inflows (from customer invoices due)
   - View projected cash outflows (vendor bills due)
   - **Include recurring transactions** (salaries, subscriptions, rent, etc.)
   - Net cash position forecast over time

2. **Payment Prioritization**
   - Identify which bills to pay based on available cash
   - Flag overdue or at-risk payments
   - Schedule payments to optimize cash flow

3. **Collection Planning**
   - Track overdue customer invoices
   - Identify customers with poor payment history
   - Plan follow-up actions for collections

4. **Scenario Planning**
   - "What-if" analysis for payment timing
   - Impact of delayed receipts on cash position

5. **Recurring Transaction Management** ⚠️ **NEW REQUIREMENT**
   - Monthly salary provisioning (from employee data)
   - Recurring vendor bills (software subscriptions, rent, utilities)
   - Recurring customer invoices (retainer contracts, maintenance)
   - Scheduled journal entries (depreciation, amortization)

---

## Data Model

### New Types

**File:** `packages/types/src/paymentPlanning.ts`

```typescript
/**
 * Payment Planning Types
 * For cash flow forecasting and payment scheduling
 */

import { Timestamp } from 'firebase/firestore';
import { Money } from './common';

/**
 * Forecast confidence based on historical payment behavior
 */
export type ForecastConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Payment risk status
 */
export type PaymentRiskStatus = 'ON_SCHEDULE' | 'AT_RISK' | 'OVERDUE';

/**
 * Direction of cash flow
 */
export type CashFlowDirection = 'INFLOW' | 'OUTFLOW';

/**
 * Individual forecast item (invoice or bill)
 */
export interface ForecastItem {
  // Reference
  transactionId: string;
  transactionType: 'CUSTOMER_INVOICE' | 'VENDOR_BILL';
  transactionNumber: string;
  direction: CashFlowDirection;

  // Entity (Customer or Vendor)
  entityId: string;
  entityName: string;

  // Financial
  totalAmount: Money;
  paidAmount: Money;
  outstandingAmount: Money;
  currency: string;

  // Dates
  transactionDate: Timestamp;
  dueDate?: Timestamp;
  expectedDate: Timestamp; // Calculated: dueDate or transactionDate + payment terms

  // Forecasting
  confidence: ForecastConfidence;
  riskStatus: PaymentRiskStatus;
  daysUntilDue: number;
  daysOverdue: number;

  // Historical context
  entityAvgPaymentDays?: number; // Average days to pay for this entity
  entityPaymentReliability?: number; // 0-100 score

  // Notes
  notes?: string;
}

/**
 * Daily cash flow projection
 */
export interface DailyForecast {
  date: Timestamp;

  // Projected amounts
  projectedReceipts: Money;
  projectedPayments: Money;
  netCashFlow: Money;

  // Running balance
  openingBalance: Money;
  closingBalance: Money;

  // Item counts
  receiptsCount: number;
  paymentsCount: number;

  // Risk-adjusted amounts (accounting for confidence)
  adjustedReceipts: Money;
  adjustedPayments: Money;
}

/**
 * Weekly summary for longer-term view
 */
export interface WeeklyForecast {
  weekStartDate: Timestamp;
  weekEndDate: Timestamp;
  weekNumber: number;

  totalReceipts: Money;
  totalPayments: Money;
  netCashFlow: Money;

  // Items due this week
  invoicesDue: number;
  billsDue: number;

  // Risk items
  overdueReceipts: Money;
  overduePayments: Money;
}

/**
 * Complete cash flow forecast
 */
export interface CashFlowForecast {
  // Metadata
  generatedAt: Timestamp;
  forecastStartDate: Timestamp;
  forecastEndDate: Timestamp;
  forecastDays: number;
  currency: string;

  // Opening position
  openingCashBalance: Money;

  // Projections
  dailyForecasts: DailyForecast[];
  weeklyForecasts: WeeklyForecast[];

  // Summary totals
  totalProjectedReceipts: Money;
  totalProjectedPayments: Money;
  netForecastedCashFlow: Money;
  projectedClosingBalance: Money;

  // Risk-adjusted summary
  adjustedProjectedReceipts: Money;
  adjustedProjectedPayments: Money;
  adjustedClosingBalance: Money;

  // Breakdown by category
  receiptsByEntity: EntityForecastSummary[];
  paymentsByEntity: EntityForecastSummary[];

  // Risk analysis
  overdueReceivables: Money;
  overduePayables: Money;
  atRiskItems: ForecastItem[];

  // All individual items
  allItems: ForecastItem[];
}

/**
 * Entity-level forecast summary
 */
export interface EntityForecastSummary {
  entityId: string;
  entityName: string;
  entityType: 'CUSTOMER' | 'VENDOR';

  totalOutstanding: Money;
  itemCount: number;

  // Timing
  earliestDueDate?: Timestamp;
  latestDueDate?: Timestamp;

  // Performance metrics
  avgPaymentDays: number;
  paymentReliability: number; // 0-100

  // Risk
  overdueAmount: Money;
  atRiskAmount: Money;
}

/**
 * Payment schedule entry (for planned payments)
 */
export interface PlannedPayment {
  id: string;

  // What to pay
  billId: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;

  // How much
  plannedAmount: Money;
  outstandingAmount: Money;

  // When
  scheduledDate: Timestamp;
  originalDueDate?: Timestamp;

  // Status
  status: 'SCHEDULED' | 'APPROVED' | 'EXECUTED' | 'CANCELLED';

  // Approval
  createdBy: string;
  createdAt: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;

  notes?: string;
}

/**
 * Forecast generation options
 */
export interface ForecastOptions {
  startDate: Date;
  endDate: Date;

  // What to include
  includeOverdue: boolean;
  includeDraft: boolean; // Include draft invoices/bills
  includeRecurring: boolean; // Include recurring transactions

  // Confidence adjustments
  applyConfidenceWeighting: boolean;
  defaultConfidence: ForecastConfidence;

  // Filters
  entityIds?: string[]; // Filter to specific customers/vendors
  projectIds?: string[]; // Filter to specific projects
  minAmount?: number;
}

// ============================================
// RECURRING TRANSACTIONS (New Feature Required)
// ============================================

/**
 * Frequency for recurring transactions
 */
export type RecurrenceFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY';

/**
 * Type of recurring transaction
 */
export type RecurringTransactionType =
  | 'SALARY'           // Employee salaries
  | 'VENDOR_BILL'      // Recurring vendor bills (rent, subscriptions)
  | 'CUSTOMER_INVOICE' // Recurring customer invoices (retainers)
  | 'JOURNAL_ENTRY';   // Recurring journal entries (depreciation)

/**
 * Recurring transaction template
 */
export interface RecurringTransaction {
  id: string;

  // Template info
  name: string;
  description?: string;
  type: RecurringTransactionType;
  isActive: boolean;

  // Schedule
  frequency: RecurrenceFrequency;
  startDate: Timestamp;
  endDate?: Timestamp;           // Optional end date
  nextOccurrence: Timestamp;     // Next scheduled date
  dayOfMonth?: number;           // For MONTHLY: 1-31, use 0 for last day
  dayOfWeek?: number;            // For WEEKLY: 0-6 (Sun-Sat)

  // Financial
  amount: Money;
  currency: string;

  // For SALARY type
  employeeIds?: string[];        // Which employees (empty = all active)

  // For VENDOR_BILL type
  vendorId?: string;
  expenseAccountId?: string;     // Default expense account

  // For CUSTOMER_INVOICE type
  customerId?: string;
  revenueAccountId?: string;     // Default revenue account

  // For JOURNAL_ENTRY type
  journalTemplate?: {
    debitAccountId: string;
    creditAccountId: string;
    narration: string;
  };

  // Auto-generation settings
  autoGenerate: boolean;         // Auto-create or just notify
  daysBeforeToGenerate: number;  // Generate N days before due
  requiresApproval: boolean;     // Needs approval before posting

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastGeneratedAt?: Timestamp;
}

/**
 * Generated occurrence from a recurring transaction
 */
export interface RecurringOccurrence {
  id: string;
  recurringTransactionId: string;

  // Scheduled info
  scheduledDate: Timestamp;
  amount: Money;

  // Status
  status: 'PENDING' | 'GENERATED' | 'SKIPPED' | 'MODIFIED';

  // Generated transaction reference
  generatedTransactionId?: string;
  generatedTransactionType?: 'INVOICE' | 'BILL' | 'JOURNAL_ENTRY' | 'SALARY_PAYMENT';

  // Modifications
  modifiedAmount?: Money;
  modifiedDate?: Timestamp;
  skipReason?: string;

  // Audit
  processedAt?: Timestamp;
  processedBy?: string;
}
```

---

## Recurring Transactions (Prerequisite Feature)

⚠️ **IMPORTANT**: The accounting module currently has **NO recurring transaction capabilities**. This must be built before Payment Planning can provide accurate forecasts.

### Current Gap Analysis

| Feature | Status | Impact |
|---------|--------|--------|
| Recurring Invoices | ❌ Missing | Cannot forecast retainer income |
| Recurring Bills | ❌ Missing | Cannot forecast subscriptions, rent |
| Salary Provisioning | ❌ Missing | Cannot forecast monthly payroll |
| Scheduled Journal Entries | ❌ Missing | Cannot auto-post depreciation |

### What Exists

- **Employee bank details** in HR module (can be used for salary payments)
- **Invoice/Bill creation** (manual only)
- **Journal entry creation** (manual only)

### Recurring Transactions UI

**New Pages:**
```
/accounting/recurring/
├── page.tsx                    # List all recurring transactions
├── new/page.tsx               # Create new recurring transaction
├── [id]/page.tsx              # View/edit recurring transaction
└── upcoming/page.tsx          # View upcoming occurrences
```

**Hub Page Features:**
1. **All Recurring Transactions** - Grid view with filters by type
2. **Upcoming This Month** - Calendar showing what's due
3. **Quick Actions** - Create salary template, subscription, etc.

### Salary Provisioning Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    SALARY PROVISIONING                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Setup (One-time)                                         │
│     └─ Create recurring transaction type=SALARY              │
│     └─ Select employees or "All Active"                      │
│     └─ Set frequency=MONTHLY, dayOfMonth=25                  │
│                                                              │
│  2. Monthly Generation (Auto or Manual)                      │
│     └─ System generates individual salary entries            │
│     └─ Each entry linked to employee                         │
│     └─ Amounts pulled from employee salary data              │
│                                                              │
│  3. Approval & Payment                                       │
│     └─ HR/Finance reviews generated entries                  │
│     └─ Adjust for leaves, bonuses, deductions                │
│     └─ Approve and process bank payments                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Integration with Payment Planning

Once recurring transactions exist:

```typescript
async function generateCashFlowForecast(db, options) {
  // 1. Get outstanding invoices (one-time)
  const invoices = await getOutstandingInvoices(db);

  // 2. Get outstanding bills (one-time)
  const bills = await getOutstandingBills(db);

  // 3. Get future recurring occurrences (NEW)
  const recurringItems = await getUpcomingRecurringTransactions(
    db,
    options.startDate,
    options.endDate
  );

  // 4. Merge all into forecast timeline
  const allItems = [...invoices, ...bills, ...recurringItems];

  // 5. Generate daily/weekly projections
  return buildForecast(allItems, options);
}
```

---

## Architecture

### Service Layer

**File:** `apps/web/src/lib/accounting/paymentPlanningService.ts`

```typescript
/**
 * Payment Planning Service
 *
 * Core functions:
 * 1. generateCashFlowForecast(db, options) - Main forecast generation
 * 2. getOutstandingInvoices(db, filters) - Fetch unpaid customer invoices
 * 3. getOutstandingBills(db, filters) - Fetch unpaid vendor bills
 * 4. calculateEntityPaymentMetrics(db, entityId) - Historical payment analysis
 * 5. createPlannedPayment(db, payment) - Schedule a payment
 * 6. getPlannedPayments(db, dateRange) - Fetch scheduled payments
 */
```

### Key Functions

#### 1. Generate Cash Flow Forecast

```typescript
async function generateCashFlowForecast(
  db: Firestore,
  options: ForecastOptions
): Promise<CashFlowForecast> {
  // 1. Get current cash balance from bank accounts
  // 2. Fetch all outstanding invoices (expected receipts)
  // 3. Fetch all outstanding bills (expected payments)
  // 4. Calculate entity payment metrics for confidence scoring
  // 5. Project daily cash flows based on due dates
  // 6. Apply confidence weighting if enabled
  // 7. Calculate running balances
  // 8. Generate weekly summaries
  // 9. Return complete forecast
}
```

#### 2. Calculate Entity Payment Metrics

```typescript
async function calculateEntityPaymentMetrics(
  db: Firestore,
  entityId: string,
  entityType: 'CUSTOMER' | 'VENDOR'
): Promise<{
  avgPaymentDays: number;
  paymentReliability: number;
  totalTransactions: number;
  onTimePayments: number;
  latePayments: number;
}> {
  // 1. Fetch all PAID invoices/bills for this entity
  // 2. Calculate average days from invoice date to payment date
  // 3. Calculate percentage paid on time vs late
  // 4. Return metrics
}
```

#### 3. Confidence Scoring Logic

```typescript
function calculateConfidence(
  item: ForecastItem,
  entityMetrics: EntityMetrics
): ForecastConfidence {
  // HIGH: Payment reliability > 80%, not overdue
  // MEDIUM: Payment reliability 50-80%, or slightly overdue (< 30 days)
  // LOW: Payment reliability < 50%, or significantly overdue (> 30 days)
}
```

---

## UI Components

### Page Structure

```
/accounting/payment-planning/
├── page.tsx                    # Main hub page
├── forecast/
│   └── page.tsx               # Cash flow forecast view
├── receivables/
│   └── page.tsx               # Expected receipts (invoices)
├── payables/
│   └── page.tsx               # Planned payments (bills)
└── schedule/
    └── page.tsx               # Payment schedule management
```

### Main Hub Page

**File:** `apps/web/src/app/accounting/payment-planning/page.tsx`

Cards/sections:
1. **Cash Flow Summary** - Quick metrics (30-day outlook)
2. **Cash Flow Forecast** - Detailed projections
3. **Expected Receipts** - Outstanding customer invoices
4. **Planned Payments** - Outstanding vendor bills
5. **Payment Schedule** - Manage scheduled payments

### Cash Flow Forecast Page

**File:** `apps/web/src/app/accounting/payment-planning/forecast/page.tsx`

Features:
- Date range selector (7/14/30/60/90 days)
- Chart: Projected cash balance over time
- Chart: Daily inflows vs outflows
- Table: Day-by-day breakdown
- Filters: By entity, project, confidence level
- Export to Excel/PDF

### Expected Receipts Page

**File:** `apps/web/src/app/accounting/payment-planning/receivables/page.tsx`

Features:
- Table of outstanding invoices
- Columns: Customer, Invoice #, Amount, Due Date, Days Overdue, Confidence
- Sorting by due date, amount, risk
- Aging buckets (Current, 30, 60, 90+ days)
- Quick actions: View invoice, Send reminder
- Bulk actions: Export, Email reminders

### Planned Payments Page

**File:** `apps/web/src/app/accounting/payment-planning/payables/page.tsx`

Features:
- Table of outstanding bills
- Columns: Vendor, Bill #, Amount, Due Date, Days Until Due, Priority
- Sorting by due date, amount, priority
- Payment prioritization helper
- Quick actions: View bill, Schedule payment
- Bulk actions: Schedule multiple payments

### Payment Schedule Page

**File:** `apps/web/src/app/accounting/payment-planning/schedule/page.tsx`

Features:
- Calendar view of scheduled payments
- List view with filters
- Create/edit/cancel scheduled payments
- Approval workflow for large payments
- Integration with payment execution

---

## UI Wireframes

### Cash Flow Forecast Chart

```
┌────────────────────────────────────────────────────────────────────┐
│  Cash Flow Forecast - Next 30 Days                    [Export] [🔍]│
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ₹ 50L ┤                    ╭─────╮                                │
│        │                   ╱       ╲          ╭──                  │
│  ₹ 40L ┤     ╭────────────╯         ╲        ╱                     │
│        │    ╱                         ╲──────╯                     │
│  ₹ 30L ┤───╯                                                       │
│        │                                                            │
│  ₹ 20L ┤─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ [Minimum Safe Balance] ─ ─ ─ ─   │
│        │                                                            │
│        └────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────     │
│           Jan 15  17   19   21   23   25   27   29   31  Feb 2     │
│                                                                     │
│  Legend: ─── Projected Balance   ─ ─ Min Safe Balance              │
│          ▓▓▓ Inflows (Receipts)  ░░░ Outflows (Payments)           │
└────────────────────────────────────────────────────────────────────┘
```

### Summary Cards

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Current Balance  │  │ Expected Receipts│  │ Planned Payments │  │ Projected Balance│
│                  │  │   (30 days)      │  │   (30 days)      │  │   (30 days)      │
│   ₹ 42,50,000   │  │   ₹ 28,75,000   │  │   ₹ 18,20,000   │  │   ₹ 53,05,000   │
│                  │  │                  │  │                  │  │                  │
│   ↑ 12% vs last │  │   15 invoices    │  │   8 bills        │  │   ↑ ₹10.5L net  │
└──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Outstanding Invoices Table

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Expected Receipts                                              [Filter] [Export]    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ Customer         │ Invoice #  │ Amount      │ Due Date  │ Status    │ Confidence   │
├──────────────────┼────────────┼─────────────┼───────────┼───────────┼──────────────┤
│ ABC Industries   │ INV-24-042 │ ₹ 8,50,000  │ Jan 20    │ Due in 5d │ 🟢 HIGH      │
│ XYZ Corp         │ INV-24-039 │ ₹ 12,25,000 │ Jan 18    │ Due in 3d │ 🟡 MEDIUM    │
│ PQR Ltd          │ INV-24-035 │ ₹ 4,75,000  │ Jan 10    │ 5d overdue│ 🔴 LOW       │
│ LMN Systems      │ INV-24-041 │ ₹ 3,25,000  │ Jan 25    │ Due in 10d│ 🟢 HIGH      │
├──────────────────┴────────────┴─────────────┴───────────┴───────────┴──────────────┤
│ Total Outstanding: ₹ 28,75,000                          Overdue: ₹ 4,75,000        │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### Existing Modules to Leverage

1. **Customer Invoices** (`/accounting/invoices/`)
   - Read outstanding invoices
   - Link to invoice detail

2. **Vendor Bills** (`/accounting/bills/`)
   - Read outstanding bills
   - Link to bill detail

3. **Payments** (`/accounting/payments/`)
   - Execute scheduled payments
   - Record actual receipts

4. **Entity Ledger** (`/accounting/reports/entity-ledger/`)
   - Historical payment data for metrics
   - Aging analysis components

5. **Bank Reconciliation** (`/accounting/reconciliation/`)
   - Current bank balances
   - Actual vs expected reconciliation

### New Firestore Collections

```
paymentSchedules/
  ├── {scheduleId}/
  │   ├── billId: string
  │   ├── vendorId: string
  │   ├── plannedAmount: Money
  │   ├── scheduledDate: Timestamp
  │   ├── status: 'SCHEDULED' | 'APPROVED' | 'EXECUTED' | 'CANCELLED'
  │   ├── createdBy: string
  │   ├── createdAt: Timestamp
  │   └── ...
```

### Firestore Indexes Required

```json
{
  "collectionGroup": "transactions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "type", "order": "ASCENDING" },
    { "fieldPath": "paymentStatus", "order": "ASCENDING" },
    { "fieldPath": "dueDate", "order": "ASCENDING" }
  ]
}
```

---

## Implementation Phases

### Phase 0: Recurring Transactions (Prerequisite) ⚠️ BUILD FIRST
- [ ] Create `recurringTransaction.ts` types
- [ ] Create Firestore collection `recurringTransactions`
- [ ] Implement `recurringTransactionService.ts`
- [ ] Build recurring transactions hub page
- [ ] Create/edit recurring transaction form
- [ ] View upcoming occurrences calendar
- [ ] Manual occurrence generation
- [ ] Auto-generation scheduler (background job)

### Phase 0.5: Salary Provisioning
- [ ] Create salary recurring template
- [ ] Link to employee HR data
- [ ] Generate monthly salary entries
- [ ] Integration with payment execution

### Phase 1: Core Forecast (MVP)
- [ ] Create `paymentPlanning.ts` types
- [ ] Implement `paymentPlanningService.ts`
- [ ] Create hub page with summary cards
- [ ] Build basic forecast chart (30-day view)
- [ ] Outstanding invoices table
- [ ] Outstanding bills table
- [ ] **Include recurring transactions in forecast**

### Phase 2: Enhanced Analytics
- [ ] Entity payment metrics calculation
- [ ] Confidence scoring algorithm
- [ ] Aging analysis integration
- [ ] Weekly/monthly forecast views
- [ ] Export to Excel

### Phase 3: Payment Scheduling
- [ ] Payment schedule collection
- [ ] Schedule CRUD operations
- [ ] Calendar view
- [ ] Approval workflow for large payments
- [ ] Integration with payment execution

### Phase 4: Advanced Features
- [ ] Scenario planning ("what-if" analysis)
- [ ] Email reminders for overdue invoices
- [ ] Auto-prioritization of payments
- [ ] Dashboard widgets
- [ ] Mobile-friendly views

---

## Questions to Resolve

### Payment Planning Questions

1. **Minimum Safe Balance**: Should users be able to set a minimum cash balance threshold for alerts?

2. **Payment Approval Threshold**: What amount should require approval before scheduling?

3. **Forecast Horizon**: Default to 30 days? Allow 60/90 day views?

4. **Confidence Weights**:
   - HIGH = 100% of amount
   - MEDIUM = 75% of amount
   - LOW = 50% of amount
   - Are these reasonable defaults?

5. **Integration with Bank Feeds**: Should opening balance come from actual bank balances or GL cash accounts?

6. **Multi-Currency**: How to handle forecasts with multiple currencies?

### Recurring Transaction Questions

7. **Auto-generation timing**: How many days before due date should transactions be auto-generated?
   - Suggestion: Configurable per recurring transaction (default: 5 days)

8. **Salary source data**: Where should salary amounts come from?
   - Option A: Store in recurring transaction template (simple)
   - Option B: Pull from HR employee records (requires integration)
   - Suggestion: Option B for accuracy, with override capability

9. **Approval workflow**: Who approves auto-generated recurring transactions?
   - Suggestion: Same approval rules as manual transactions of that type

10. **Skip/modify occurrences**: Should users be able to skip or modify individual occurrences without affecting the template?
    - Suggestion: Yes, with audit trail

11. **End date handling**: What happens when a recurring transaction reaches its end date?
    - Option A: Auto-deactivate
    - Option B: Notify and wait for user action
    - Suggestion: Auto-deactivate with notification

12. **Variable amounts**: How to handle recurring transactions with variable amounts (e.g., utility bills)?
    - Suggestion: Use estimated amount, allow modification before posting

---

## Files to Create

### Types Package
- `packages/types/src/recurringTransaction.ts` **(Phase 0)**
- `packages/types/src/paymentPlanning.ts`
- Update `packages/types/src/index.ts` (export new types)

### Web App - Services
- `apps/web/src/lib/accounting/recurringTransactionService.ts` **(Phase 0)**
- `apps/web/src/lib/accounting/paymentPlanningService.ts`

### Web App - Recurring Transactions Pages (Phase 0)
- `apps/web/src/app/accounting/recurring/page.tsx`
- `apps/web/src/app/accounting/recurring/new/page.tsx`
- `apps/web/src/app/accounting/recurring/[id]/page.tsx`
- `apps/web/src/app/accounting/recurring/upcoming/page.tsx`

### Web App - Recurring Transactions Components (Phase 0)
- `apps/web/src/app/accounting/recurring/components/RecurringTransactionForm.tsx`
- `apps/web/src/app/accounting/recurring/components/RecurringTransactionList.tsx`
- `apps/web/src/app/accounting/recurring/components/UpcomingOccurrencesCalendar.tsx`
- `apps/web/src/app/accounting/recurring/components/SalaryTemplateWizard.tsx`

### Web App - Payment Planning Pages
- `apps/web/src/app/accounting/payment-planning/page.tsx`
- `apps/web/src/app/accounting/payment-planning/forecast/page.tsx`
- `apps/web/src/app/accounting/payment-planning/receivables/page.tsx`
- `apps/web/src/app/accounting/payment-planning/payables/page.tsx`
- `apps/web/src/app/accounting/payment-planning/schedule/page.tsx`

### Web App - Payment Planning Components
- `apps/web/src/app/accounting/payment-planning/components/CashFlowChart.tsx`
- `apps/web/src/app/accounting/payment-planning/components/ForecastSummaryCards.tsx`
- `apps/web/src/app/accounting/payment-planning/components/OutstandingInvoicesTable.tsx`
- `apps/web/src/app/accounting/payment-planning/components/OutstandingBillsTable.tsx`
- `apps/web/src/app/accounting/payment-planning/components/PaymentScheduleCalendar.tsx`

### Firestore
- Add `recurringTransactions` collection
- Add `recurringOccurrences` subcollection
- Add indexes to `firestore.indexes.json`

### Accounting Hub
- Update `apps/web/src/app/accounting/page.tsx` (add Recurring Transactions and Payment Planning cards)

---

*Document created: 2026-01-14*
*Last updated: 2026-01-14*

---

## Summary

**Key Finding**: The accounting module currently has **NO recurring transaction capabilities**. Before accurate cash flow forecasting can be implemented, we need to build:

1. **Recurring Transactions Module** (Phase 0)
   - Templates for recurring invoices, bills, and journal entries
   - Occurrence scheduling and auto-generation
   - Manual override and skip capabilities

2. **Salary Provisioning** (Phase 0.5)
   - Integration with HR employee data
   - Monthly salary entry generation
   - Bank payment processing

Only after these foundational features exist can the Payment Planning module provide accurate forecasts that include:
- Outstanding one-time invoices/bills
- **Recurring subscriptions and rent**
- **Monthly payroll obligations**
- Scheduled journal entries (depreciation, etc.)
