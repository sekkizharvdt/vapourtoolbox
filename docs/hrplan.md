# HR Module Planning Document

## Overview

This document outlines the comprehensive plan for implementing a Human Resources module in the Vapour Toolbox application. The module will follow existing architectural patterns and integrate seamlessly with the current codebase.

---

## Core Features (User Requested)

### 1. Leave Application

- Leave request submission with type selection (casual, sick, earned, comp-off)
- Multi-level approval workflow (reporting manager → HR)
- Leave balance tracking and accrual
- Calendar view of team leaves
- Leave history and reports

### 2. Expense Reports

- Expense claim submission with receipt uploads
- Category-based expense tracking (travel, meals, equipment, etc.)
- Approval workflow with amount-based routing
- Integration with Accounting module for reimbursement
- Project-linked expenses for cost allocation

### 3. Payslip Generation

- Monthly payslip generation from salary structure
- Tax calculations (TDS, PF, ESI)
- Allowances and deductions management
- PDF generation and email distribution
- Payroll reports and summaries

---

## Additional Recommended Features

### 4. Employee Management (Foundation)

- Employee profiles with personal/professional details
- Department and reporting hierarchy
- Employment history and documents
- Emergency contacts and bank details
- Employee onboarding checklist

### 5. Attendance & Time Tracking

- Daily attendance marking (integrated with existing TIME_ENTRIES)
- Shift management for operations staff
- Overtime tracking and approval
- Regularization requests for missed punches
- Attendance reports and analytics

### 6. On-Duty & Work From Home

- OD/WFH request submission
- Location/reason tracking
- Approval workflow
- Integration with attendance

### 7. Salary Structure Management

- Salary components configuration (Basic, HRA, DA, etc.)
- CTC breakdown and calculation
- Increment history tracking
- Salary revision workflows

### 8. Employee Self-Service Portal

- Personal information updates
- Document downloads (payslips, Form 16, etc.)
- Leave balance view
- Expense claim status tracking

### 9. HR Analytics Dashboard

- Headcount by department
- Leave utilization trends
- Expense patterns
- Attrition metrics (if employee exit is tracked)

### 10. Holiday Calendar

- Company holidays management
- Location-specific holidays
- Integration with leave calculations

### 11. Asset Assignment

- Company assets tracking (laptop, phone, ID card)
- Assignment to employees
- Return tracking on exit

### 12. Training & Certifications

- Training records
- Certification tracking with expiry alerts
- Skill matrix

---

## Technical Architecture

### Directory Structure

```
apps/web/src/app/hr/
├── page.tsx                          # HR Dashboard
├── layout.tsx                        # HR Module Layout
├── error.tsx
├── loading.tsx
├── employees/
│   ├── page.tsx                      # Employee List
│   ├── [id]/
│   │   ├── page.tsx                  # Employee Detail
│   │   └── edit/page.tsx             # Edit Employee
│   └── new/page.tsx                  # New Employee
├── leaves/
│   ├── page.tsx                      # Leave Requests List
│   ├── calendar/page.tsx             # Team Calendar View
│   └── [id]/page.tsx                 # Leave Detail
├── expenses/
│   ├── page.tsx                      # Expense Claims List
│   └── [id]/page.tsx                 # Expense Detail
├── payroll/
│   ├── page.tsx                      # Payroll Dashboard
│   ├── run/page.tsx                  # Run Payroll
│   └── history/page.tsx              # Payroll History
├── attendance/
│   ├── page.tsx                      # Attendance Dashboard
│   └── regularization/page.tsx       # Regularization Requests
├── settings/
│   ├── page.tsx                      # HR Settings
│   ├── leave-types/page.tsx          # Leave Types Config
│   ├── expense-categories/page.tsx   # Expense Categories
│   ├── salary-components/page.tsx    # Salary Components
│   └── holidays/page.tsx             # Holiday Calendar
└── reports/
    └── page.tsx                      # HR Reports

apps/web/src/lib/hr/
├── index.ts                          # Main exports
├── employees/
│   ├── employeeService.ts
│   ├── types.ts
│   └── hooks/
├── leaves/
│   ├── leaveService.ts
│   ├── leaveBalanceService.ts
│   ├── types.ts
│   └── hooks/
├── expenses/
│   ├── expenseService.ts
│   ├── types.ts
│   └── hooks/
├── payroll/
│   ├── payrollService.ts
│   ├── taxCalculationService.ts
│   ├── payslipService.ts
│   ├── types.ts
│   └── hooks/
├── attendance/
│   ├── attendanceService.ts
│   ├── types.ts
│   └── hooks/
└── queryKeys.ts                      # HR Query Keys

packages/types/src/
├── hr/
│   ├── index.ts
│   ├── employee.ts
│   ├── leave.ts
│   ├── expense.ts
│   ├── payroll.ts
│   └── attendance.ts
```

### Firestore Collections

```typescript
// New collections for HR module
HR_EMPLOYEES; // Employee extended profiles
HR_LEAVE_REQUESTS; // Leave applications
HR_LEAVE_BALANCES; // Leave balance per employee per year
HR_LEAVE_TYPES; // Leave type configuration
HR_EXPENSE_CLAIMS; // Expense reports
HR_EXPENSE_ITEMS; // Line items in expense claims
HR_EXPENSE_CATEGORIES; // Expense category configuration
HR_SALARY_STRUCTURES; // Employee salary structures
HR_SALARY_COMPONENTS; // Salary component master
HR_PAYROLL_RUNS; // Monthly payroll runs
HR_PAYSLIPS; // Generated payslips
HR_ATTENDANCE; // Daily attendance records
HR_HOLIDAYS; // Holiday calendar
HR_ASSETS; // Company assets
HR_ASSET_ASSIGNMENTS; // Asset to employee mapping
```

### Permission Flags (New)

```typescript
// HR Permissions (bits 24-31 reserved for HR)
MANAGE_HR_SETTINGS = 1 << 24,      // Configure HR module
VIEW_ALL_EMPLOYEES = 1 << 25,      // View all employee data
MANAGE_PAYROLL = 1 << 26,          // Run payroll, generate payslips
APPROVE_EXPENSES = 1 << 27,        // Approve expense claims
VIEW_HR_REPORTS = 1 << 28,         // Access HR analytics
MANAGE_ATTENDANCE = 1 << 29,       // Manage attendance records

// Existing flags to leverage
APPROVE_LEAVES = 1 << 9,           // Already exists
```

---

## Key Type Definitions

### Employee (Extended User)

```typescript
interface Employee extends User {
  employeeId: string; // EMP-001
  employmentType: 'full-time' | 'part-time' | 'contract' | 'intern';
  dateOfJoining: Timestamp;
  dateOfBirth?: Timestamp;
  reportingManagerId?: string;
  designation: string;
  grade?: string;
  location?: string;
  personalEmail?: string;
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  };
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
  };
  documents?: {
    aadhar?: string;
    pan?: string;
    passport?: string;
  };
  salaryStructureId?: string;
}
```

### Leave Request

```typescript
interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: Timestamp;
  endDate: Timestamp;
  totalDays: number;
  halfDay?: 'first' | 'second';
  reason: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvals: Approval[];
  attachments?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface LeaveBalance {
  employeeId: string;
  fiscalYear: string;
  balances: {
    [leaveTypeId: string]: {
      opening: number;
      accrued: number;
      taken: number;
      balance: number;
    };
  };
}
```

### Expense Claim

```typescript
interface ExpenseClaim {
  id: string;
  claimNumber: string; // EXP-2025-001
  employeeId: string;
  employeeName: string;
  projectId?: string;
  projectName?: string;
  purpose: string;
  totalAmount: number;
  currency: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'reimbursed';
  items: ExpenseItem[];
  approvals: Approval[];
  reimbursementDetails?: {
    transactionId: string;
    date: Timestamp;
    method: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ExpenseItem {
  id: string;
  categoryId: string;
  categoryName: string;
  description: string;
  amount: number;
  date: Timestamp;
  receiptUrl?: string;
  billNumber?: string;
}
```

### Payroll & Payslip

```typescript
interface SalaryStructure {
  id: string;
  employeeId: string;
  effectiveFrom: Timestamp;
  ctc: number;
  components: SalaryComponent[];
  status: 'active' | 'superseded';
}

interface SalaryComponent {
  componentId: string;
  name: string;
  type: 'earning' | 'deduction';
  calculationType: 'fixed' | 'percentage';
  baseComponent?: string; // For percentage-based
  value: number;
  isTaxable: boolean;
}

interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: 'draft' | 'processing' | 'completed' | 'locked';
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  processedBy: string;
  processedAt?: Timestamp;
}

interface Payslip {
  id: string;
  payrollRunId: string;
  employeeId: string;
  month: number;
  year: number;
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  taxDetails?: {
    incomeTax: number;
    professionalTax: number;
  };
  pdfUrl?: string;
  emailSentAt?: Timestamp;
}
```

---

## Integration Points

### With Accounting Module

- Expense reimbursement creates journal entries
- Payroll creates salary expense entries
- Statutory payments (PF, ESI, TDS) tracking

### With Projects Module

- Project-linked expenses for cost allocation
- Employee assignment to projects (existing)

### With Flow Module (Tasks)

- Leave approval tasks
- Expense approval tasks
- Payroll processing reminders

### With Users/Auth

- Extend existing User type with Employee details
- Leverage department assignments
- Reporting hierarchy for approvals

---

## Implementation Phases (Suggested)

### Phase 1: Foundation

- Employee extended profiles
- HR settings & configuration
- Leave types, expense categories, salary components setup

### Phase 2: Leave Management

- Leave request workflow
- Leave balance tracking
- Team calendar view
- Leave reports

### Phase 3: Expense Management

- Expense claim submission
- Receipt upload
- Approval workflow
- Accounting integration for reimbursement

### Phase 4: Payroll

- Salary structure management
- Payroll run process
- Payslip generation (PDF)
- Tax calculations

### Phase 5: Attendance

- Daily attendance
- Regularization requests
- Integration with time tracking

### Phase 6: Advanced Features

- HR Analytics dashboard
- Asset management
- Training records

---

## Open Questions for Discussion

1. **Tax Regime**: Should we support both Old and New tax regimes for TDS calculation?
2. **Multi-location**: Do you need location-specific holiday calendars and leave policies?
3. **Approval Hierarchies**: Should expense approvals be amount-based (e.g., >10k needs Finance approval)?
4. **Payroll Frequency**: Monthly only, or support for weekly/bi-weekly for contract staff?
5. **Leave Encashment**: Should unused leaves be encashable? How to handle carry-forward limits?
6. **Statutory Compliance**: Do you need PF/ESI/PT calculations, or is this handled externally?
7. **Employee Self-Service**: Should employees be able to update their own profiles, or only HR?
8. **Biometric Integration**: Any plans to integrate with biometric attendance systems?
9. **Exit Process**: Should we include employee exit/offboarding workflow?
10. **Recruitment**: Is hiring/applicant tracking needed, or out of scope?

---

## Summary

This HR module plan covers:

- **3 core features** (Leave, Expenses, Payslips) as requested
- **9 additional features** to make it comprehensive
- **Technical architecture** following existing patterns
- **Type definitions** for key entities
- **Integration points** with existing modules
- **6-phase implementation** approach

The module will leverage existing patterns (React Query, Firebase, audit logging, permissions) ensuring consistency with the rest of the application.
