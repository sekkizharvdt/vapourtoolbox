# Sprint Plan - Week 1: Core Ledger Posting
## Phase 1.1-1.3: Fix Double-Entry Bookkeeping

**Sprint Duration**: Week of 2025-11-02 to 2025-11-08
**Sprint Goal**: Implement ledger posting for all transaction types
**Team**: Solo development with Claude Code assistance

---

## 📊 Sprint Overview

### Sprint Objectives
1. ✅ Set up development environment with test data
2. ✅ Create system account resolver utility
3. ✅ Implement invoice ledger posting
4. ✅ Implement bill ledger posting
5. ✅ Add journal entry posting validation
6. ✅ Test all ledger posting flows

### Success Criteria
- [ ] All transactions save with non-empty `entries` array
- [ ] Ledger entries balance (total debits = total credits)
- [ ] Test invoice creates correct GL entries
- [ ] Test bill with TDS creates correct GL entries
- [ ] Journal entry posting validation works

---

## 🎯 Daily Breakdown

### Day 1 (Monday): Setup & Investigation
**Time**: 4-6 hours

#### Tasks
1. **Environment Setup** ✅ In Progress
   - [x] Verify Firebase emulator is running
   - [ ] Check Chart of Accounts has required system accounts
   - [ ] Create test customer and vendor entities
   - [ ] Document current account structure

2. **Code Investigation**
   - [ ] Review `transactionHelpers.ts` ledger generation functions
   - [ ] Identify required system account types
   - [ ] Map account requirements for each transaction type

3. **Create Development Test Data**
   - [ ] Create sample accounts: Receivables, Revenue, GST Payable
   - [ ] Create sample accounts: Payables, Expenses, GST Input, TDS Payable
   - [ ] Create sample customer: "Test Customer Ltd"
   - [ ] Create sample vendor: "Test Vendor Pvt Ltd"

**Deliverables**:
- Test data setup script
- System account mapping document
- Development environment verified

---

### Day 2 (Tuesday): System Account Resolver
**Time**: 4-6 hours

#### Task 1: Create Account Resolver Utility
**File**: `apps/web/src/lib/accounting/systemAccountResolver.ts`

```typescript
/**
 * System Account Resolver
 * Maps transaction types to required GL accounts
 */

import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { AccountType } from '@vapour/types';

export interface SystemAccountIds {
  // Receivables & Revenue (for invoices)
  accountsReceivable?: string;
  revenue?: string;
  cgstPayable?: string;
  sgstPayable?: string;
  igstPayable?: string;

  // Payables & Expenses (for bills)
  accountsPayable?: string;
  expenses?: string;
  cgstInput?: string;
  sgstInput?: string;
  igstInput?: string;
  tdsPayable?: string;

  // Cash & Bank
  cashInHand?: string;
  bankAccounts?: { [accountId: string]: string }; // id -> name mapping
}

/**
 * Fetch system accounts from Firestore
 * Caches results for performance
 */
export async function getSystemAccountIds(
  db: any
): Promise<SystemAccountIds> {
  // Query accounts collection
  const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);

  const accounts: SystemAccountIds = {};

  // Find Accounts Receivable (Asset -> Current Assets)
  const arQuery = query(
    accountsRef,
    where('name', '==', 'Accounts Receivable')
  );
  const arDocs = await getDocs(arQuery);
  if (!arDocs.empty) {
    accounts.accountsReceivable = arDocs.docs[0].id;
  }

  // Find Revenue account
  const revenueQuery = query(
    accountsRef,
    where('type', '==', 'REVENUE')
  );
  const revDocs = await getDocs(revenueQuery);
  if (!revDocs.empty) {
    // Get first revenue account or one named "Sales"
    const salesAccount = revDocs.docs.find(doc =>
      doc.data().name.includes('Sales')
    );
    accounts.revenue = salesAccount?.id || revDocs.docs[0].id;
  }

  // Find GST accounts
  const gstQuery = query(
    accountsRef,
    where('isGSTAccount', '==', true)
  );
  const gstDocs = await getDocs(gstQuery);
  gstDocs.forEach(doc => {
    const data = doc.data();
    if (data.name.includes('CGST Payable')) accounts.cgstPayable = doc.id;
    if (data.name.includes('SGST Payable')) accounts.sgstPayable = doc.id;
    if (data.name.includes('IGST Payable')) accounts.igstPayable = doc.id;
    if (data.name.includes('CGST Input')) accounts.cgstInput = doc.id;
    if (data.name.includes('SGST Input')) accounts.sgstInput = doc.id;
    if (data.name.includes('IGST Input')) accounts.igstInput = doc.id;
  });

  // Find Accounts Payable
  const apQuery = query(
    accountsRef,
    where('name', '==', 'Accounts Payable')
  );
  const apDocs = await getDocs(apQuery);
  if (!apDocs.empty) {
    accounts.accountsPayable = apDocs.docs[0].id;
  }

  // Find TDS Payable
  const tdsQuery = query(
    accountsRef,
    where('isTDSAccount', '==', true)
  );
  const tdsDocs = await getDocs(tdsQuery);
  if (!tdsDocs.empty) {
    accounts.tdsPayable = tdsDocs.docs[0].id;
  }

  return accounts;
}

/**
 * Validate that required accounts exist
 */
export function validateSystemAccounts(
  accounts: SystemAccountIds,
  transactionType: 'CUSTOMER_INVOICE' | 'VENDOR_BILL'
): { valid: boolean; missingAccounts: string[] } {
  const missing: string[] = [];

  if (transactionType === 'CUSTOMER_INVOICE') {
    if (!accounts.accountsReceivable) missing.push('Accounts Receivable');
    if (!accounts.revenue) missing.push('Revenue/Sales');
    if (!accounts.cgstPayable) missing.push('CGST Payable');
    if (!accounts.sgstPayable) missing.push('SGST Payable');
    if (!accounts.igstPayable) missing.push('IGST Payable');
  } else if (transactionType === 'VENDOR_BILL') {
    if (!accounts.accountsPayable) missing.push('Accounts Payable');
    if (!accounts.expenses) missing.push('Expenses');
    if (!accounts.cgstInput) missing.push('CGST Input');
    if (!accounts.sgstInput) missing.push('SGST Input');
    if (!accounts.igstInput) missing.push('IGST Input');
  }

  return {
    valid: missing.length === 0,
    missingAccounts: missing,
  };
}
```

**Acceptance Criteria**:
- [ ] Can fetch all required system account IDs
- [ ] Returns typed object with account IDs
- [ ] Validates accounts exist before transaction posting
- [ ] Shows helpful error if accounts missing

---

### Day 3 (Wednesday): Invoice Ledger Posting
**Time**: 6-8 hours

#### Task 1: Modify CreateInvoiceDialog
**File**: `apps/web/src/app/accounting/invoices/components/CreateInvoiceDialog.tsx`

**Changes Required**:

1. Import system account resolver:
```typescript
import { getSystemAccountIds, validateSystemAccounts } from '@/lib/accounting/systemAccountResolver';
```

2. Modify save handler (around line 180):
```typescript
const handleSubmit = async () => {
  // ... existing validation ...

  setLoading(true);
  setError('');

  try {
    const { db } = getFirebase();

    // 1. Fetch system account IDs
    const systemAccounts = await getSystemAccountIds(db);

    // 2. Validate accounts exist
    const validation = validateSystemAccounts(systemAccounts, 'CUSTOMER_INVOICE');
    if (!validation.valid) {
      setError(`Missing required accounts: ${validation.missingAccounts.join(', ')}`);
      setLoading(false);
      return;
    }

    // 3. Generate transaction number
    let transactionNumber = editingInvoice?.transactionNumber;
    if (!editingInvoice) {
      transactionNumber = await generateTransactionNumber('CUSTOMER_INVOICE');
    }

    // 4. Generate ledger entries
    const gstAccountId = invoiceData.gstDetails?.type === 'IGST'
      ? systemAccounts.igstPayable!
      : systemAccounts.cgstPayable!; // Will use both CGST and SGST

    const ledgerEntries = generateInvoiceLedgerEntries(
      invoiceData,
      systemAccounts.accountsReceivable!,
      systemAccounts.revenue!,
      gstAccountId
    );

    // 5. Validate entries balance
    const { balanced, totalDebits, totalCredits } = validateLedgerBalance(ledgerEntries);
    if (!balanced) {
      setError(`Ledger entries don't balance! Debits: ${totalDebits}, Credits: ${totalCredits}`);
      setLoading(false);
      return;
    }

    // 6. Add entries to invoice data
    invoiceData.entries = ledgerEntries;

    // ... rest of save logic ...
  } catch (err) {
    console.error('[CreateInvoiceDialog] Error:', err);
    setError('Failed to save invoice. Please check system accounts setup.');
  } finally {
    setLoading(false);
  }
};
```

**Acceptance Criteria**:
- [ ] Invoice saves with populated `entries` array
- [ ] Entries include: Debit AR, Credit Revenue, Credit GST
- [ ] Total debits = Total credits
- [ ] Error shown if system accounts missing

---

### Day 4 (Thursday): Bill Ledger Posting
**Time**: 6-8 hours

#### Task 1: Modify CreateBillDialog
**File**: `apps/web/src/app/accounting/bills/components/CreateBillDialog.tsx`

**Similar changes to invoice**, plus TDS handling:

```typescript
// Generate ledger entries with TDS
const ledgerEntries = generateBillLedgerEntries(
  billData,
  systemAccounts.accountsPayable!,
  systemAccounts.expenses!,
  gstAccountId,
  billData.tdsDeducted ? systemAccounts.tdsPayable : undefined
);
```

**TDS Ledger Entry Logic**:
- When TDS deducted:
  - Debit: Expense (full amount)
  - Debit: GST Input
  - Credit: Accounts Payable (net amount after TDS)
  - Credit: TDS Payable (TDS amount)

**Acceptance Criteria**:
- [ ] Bill saves with ledger entries
- [ ] TDS entries created when applicable
- [ ] GST input credit entries correct
- [ ] All entries balance

---

### Day 5 (Friday): Testing & Validation
**Time**: 6-8 hours

#### Task 1: End-to-End Testing

**Test Case 1: Create Invoice**
```
Customer: Test Customer Ltd
Amount: ₹10,000
GST (18%): ₹1,800 (₹900 CGST + ₹900 SGST)
Total: ₹11,800

Expected Entries:
- Dr. Accounts Receivable: ₹11,800
- Cr. Sales Revenue: ₹10,000
- Cr. CGST Payable: ₹900
- Cr. SGST Payable: ₹900
```

**Test Case 2: Create Bill with TDS**
```
Vendor: Test Vendor Pvt Ltd
Amount: ₹10,000
GST (18%): ₹1,800
TDS (10%): ₹1,000
Net Payable: ₹10,800

Expected Entries:
- Dr. Expenses: ₹10,000
- Dr. CGST Input: ₹900
- Dr. SGST Input: ₹900
- Cr. Accounts Payable: ₹10,800
- Cr. TDS Payable: ₹1,000
```

**Test Case 3: Inter-state Invoice (IGST)**
```
Customer in different state
Amount: ₹10,000
IGST (18%): ₹1,800
Total: ₹11,800

Expected Entries:
- Dr. Accounts Receivable: ₹11,800
- Cr. Sales Revenue: ₹10,000
- Cr. IGST Payable: ₹1,800
```

#### Task 2: Create Test Script
**File**: `apps/web/src/lib/accounting/tests/ledgerPosting.test.ts`

```typescript
import { generateInvoiceLedgerEntries, generateBillLedgerEntries } from '../transactionHelpers';
import { validateLedgerBalance } from '../ledgerValidator';

describe('Ledger Posting', () => {
  test('Invoice creates balanced entries', () => {
    const invoice = {
      subtotal: 10000,
      taxAmount: 1800,
      totalAmount: 11800,
      gstDetails: {
        type: 'CGST_SGST',
        cgst: 900,
        sgst: 900,
      },
    };

    const entries = generateInvoiceLedgerEntries(
      invoice,
      'AR_ACCOUNT_ID',
      'REV_ACCOUNT_ID',
      'GST_ACCOUNT_ID'
    );

    const { balanced, totalDebits, totalCredits } = validateLedgerBalance(entries);

    expect(balanced).toBe(true);
    expect(totalDebits).toBe(11800);
    expect(totalCredits).toBe(11800);
    expect(entries).toHaveLength(3); // AR, Revenue, GST
  });

  test('Bill with TDS creates balanced entries', () => {
    // Similar test for bills
  });
});
```

**Acceptance Criteria**:
- [ ] All test cases pass
- [ ] Entries balance in all scenarios
- [ ] TDS handled correctly
- [ ] IGST vs CGST+SGST logic works

---

## 📋 Sprint Checklist

### Setup Phase
- [ ] Firebase emulator running
- [ ] Test accounts created in Chart of Accounts
- [ ] Test customer and vendor entities created
- [ ] System account resolver implemented

### Implementation Phase
- [ ] Invoice ledger posting integrated
- [ ] Bill ledger posting integrated
- [ ] Journal entry validation added
- [ ] Error handling for missing accounts

### Testing Phase
- [ ] Test Case 1: Invoice (CGST+SGST) ✅
- [ ] Test Case 2: Invoice (IGST) ✅
- [ ] Test Case 3: Bill without TDS ✅
- [ ] Test Case 4: Bill with TDS ✅
- [ ] Automated tests written
- [ ] Manual testing completed

### Documentation
- [ ] Code commented
- [ ] Test data documented
- [ ] Known issues logged
- [ ] Sprint retrospective notes

---

## 🎯 Sprint Retrospective (End of Week)

### What Went Well
- TBD after completion

### What Could Be Improved
- TBD after completion

### Action Items for Next Sprint
- TBD after completion

### Blockers Encountered
- TBD during sprint

---

## 📊 Sprint Metrics

**Target Velocity**: 24-32 hours of development
**Actual Velocity**: TBD

**Tasks Completed**: 0/10
**Code Coverage**: TBD
**Bugs Found**: TBD
**Bugs Fixed**: TBD

---

## 🔄 Next Sprint Preview

**Sprint 2 (Week 2)**: Account Balance Updates & Reports
- Implement Cloud Function for balance updates
- Fix payment allocation
- Create Trial Balance report
- Create Account Ledger report

---

**Sprint Owner**: User
**Technical Lead**: Claude Code
**Start Date**: 2025-11-02
**Target End Date**: 2025-11-08
**Status**: 🟢 In Progress
