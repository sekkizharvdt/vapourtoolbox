# Accounting Module Implementation Roadmap
## Option B: Full Compliance - Production-Ready in 9-10 Weeks

**Target**: Production-ready accounting system with full Indian tax compliance
**Start Date**: 2025-11-02
**Estimated Completion**: 2026-01-15
**Total Tasks**: 30

---

## 📊 Progress Overview

- **Phase 1 (Core Fixes)**: 0/10 tasks (0%)
- **Phase 2 (Compliance)**: 0/6 tasks (0%)
- **Phase 3 (Production)**: 0/6 tasks (0%)
- **Phase 4 (Advanced)**: 0/8 tasks (0%)

**Overall Progress**: 0/30 tasks (0%)

---

## 🎯 Phase 1: Make It Work (Weeks 1-3)

### Critical: Fix Core Accounting Engine

#### Week 1: Ledger Posting Implementation

**1.1 Implement Ledger Posting for Invoices** ⏱️ 8-12 hours
- **Priority**: CRITICAL
- **Files to Modify**:
  - `apps/web/src/app/accounting/invoices/components/CreateInvoiceDialog.tsx`
  - `apps/web/src/lib/accounting/transactionHelpers.ts`
- **Tasks**:
  - [ ] Create helper to fetch system account IDs (Receivables, Revenue, GST Payable)
  - [ ] Call `generateInvoiceLedgerEntries()` before saving invoice
  - [ ] Add validation to ensure entries balance
  - [ ] Add error handling for missing accounts
  - [ ] Test with sample invoice (₹10,000 + ₹1,800 GST)
- **Acceptance Criteria**:
  - Invoice saves with non-empty `entries` array
  - Total debits = Total credits (within 0.01 tolerance)
  - Account balances ready for update

**1.2 Implement Ledger Posting for Bills** ⏱️ 8-12 hours
- **Priority**: CRITICAL
- **Files to Modify**:
  - `apps/web/src/app/accounting/bills/components/CreateBillDialog.tsx`
  - `apps/web/src/lib/accounting/transactionHelpers.ts`
- **Tasks**:
  - [ ] Create helper to fetch system account IDs (Payables, Expense, GST Input, TDS)
  - [ ] Call `generateBillLedgerEntries()` before saving bill
  - [ ] Handle TDS entries (if TDS deducted)
  - [ ] Add validation for balanced entries
  - [ ] Test with bill including TDS (₹10,000 - ₹1,000 TDS + ₹1,800 GST)
- **Acceptance Criteria**:
  - Bill saves with correct ledger entries
  - TDS entries created when applicable
  - All entries balance correctly

**1.3 Implement Ledger Posting for Journal Entries** ⏱️ 4-6 hours
- **Priority**: HIGH
- **Files to Modify**:
  - `apps/web/src/app/accounting/journal-entries/components/CreateJournalEntryDialog.tsx`
- **Tasks**:
  - [ ] Journal entries already have entries array, just validate
  - [ ] Add posting validation (ensure balanced before posting)
  - [ ] Prevent posting unbalanced entries
  - [ ] Add status transition validation
- **Acceptance Criteria**:
  - Cannot post unbalanced journal entries
  - Status changes tracked properly

**1.4 Create Cloud Function to Update Account Balances** ⏱️ 16-20 hours
- **Priority**: CRITICAL
- **Files to Create**:
  - `functions/src/accounting/updateAccountBalances.ts`
  - `functions/src/accounting/ledgerPosting.ts`
- **Tasks**:
  - [ ] Create Firestore trigger on transaction creation/update
  - [ ] When transaction status → POSTED, update account balances
  - [ ] Handle debit and credit balance logic (Assets vs Liabilities)
  - [ ] Add transaction to prevent race conditions
  - [ ] Create reversal logic for VOID transactions
  - [ ] Add comprehensive logging
  - [ ] Write tests for balance calculations
- **Acceptance Criteria**:
  - Account balances update automatically when transaction posted
  - Balances correct for asset accounts (debit increases)
  - Balances correct for liability/equity accounts (credit increases)
  - Handles concurrent transactions safely

**1.5 Fix Payment Allocation Integration** ⏱️ 6-8 hours
- **Priority**: HIGH
- **Files to Modify**:
  - `apps/web/src/app/accounting/payments/components/RecordCustomerPaymentDialog.tsx`
  - `apps/web/src/app/accounting/payments/components/RecordVendorPaymentDialog.tsx`
- **Tasks**:
  - [ ] Call `processPaymentAllocations()` after successful payment save
  - [ ] Update invoice/bill status to PAID/PARTIALLY_PAID automatically
  - [ ] Recalculate outstanding amounts
  - [ ] Add error handling for failed allocations
  - [ ] Test payment allocation flow end-to-end
- **Acceptance Criteria**:
  - Payment creates → Invoice status updates to PAID
  - Partial payment → Status = PARTIALLY_PAID
  - Outstanding amounts calculated correctly

**1.6 Implement Trial Balance Report** ⏱️ 12-16 hours
- **Priority**: HIGH
- **Files to Create**:
  - `apps/web/src/app/accounting/reports/trial-balance/page.tsx`
  - `apps/web/src/lib/accounting/reports/trialBalance.ts`
- **Tasks**:
  - [ ] Create report page UI
  - [ ] Query all accounts with balances
  - [ ] Calculate total debits and credits
  - [ ] Validate debits = credits
  - [ ] Add date range filter
  - [ ] Export to PDF and Excel
  - [ ] Show drill-down to account ledger
- **Acceptance Criteria**:
  - Shows all account balances
  - Total debits = Total credits
  - Exportable to PDF/Excel
  - Date range filtering works

**1.7 Implement Account Ledger Report** ⏱️ 10-14 hours
- **Priority**: MEDIUM
- **Files to Create**:
  - `apps/web/src/app/accounting/reports/account-ledger/page.tsx`
  - `apps/web/src/lib/accounting/reports/accountLedger.ts`
- **Tasks**:
  - [ ] Create ledger report page
  - [ ] Query all transactions for selected account
  - [ ] Show running balance
  - [ ] Add date range filter
  - [ ] Export to PDF and Excel
  - [ ] Show transaction drill-through
- **Acceptance Criteria**:
  - Shows all transactions for account
  - Running balance calculated correctly
  - Exportable to PDF/Excel

#### Week 2: Performance Optimization

**1.8 Add Pagination to All Transaction Lists** ⏱️ 12-16 hours
- **Priority**: HIGH
- **Files to Modify**:
  - `apps/web/src/app/accounting/invoices/page.tsx`
  - `apps/web/src/app/accounting/bills/page.tsx`
  - `apps/web/src/app/accounting/payments/page.tsx`
  - `apps/web/src/app/accounting/journal-entries/page.tsx`
  - `apps/web/src/app/accounting/transactions/page.tsx`
- **Tasks**:
  - [ ] Implement cursor-based pagination (Firestore `startAfter`)
  - [ ] Add "Load More" button with loading state
  - [ ] Set page size to 50 transactions
  - [ ] Add total count display
  - [ ] Test with 1000+ transactions
  - [ ] Add keyboard navigation (Page Up/Down)
- **Acceptance Criteria**:
  - Initial load shows 50 transactions
  - "Load More" loads next 50
  - Performance acceptable with 10,000+ transactions
  - Total count displayed

**1.9 Create Firestore Indexes Configuration** ⏱️ 4-6 hours
- **Priority**: HIGH
- **Files to Create/Modify**:
  - `firestore.indexes.json`
- **Tasks**:
  - [ ] Document all composite query requirements
  - [ ] Create index for `type + date` (used in all list pages)
  - [ ] Create index for `entityId + status` (used in payments)
  - [ ] Create index for `type + status + date`
  - [ ] Create index for `costCentreId + type + date` (project reports)
  - [ ] Deploy indexes to Firebase
  - [ ] Verify all queries work in production mode
- **Acceptance Criteria**:
  - All queries work without errors
  - No "missing index" errors in production
  - Query performance < 500ms

#### Week 3: Code Quality

**1.10 Refactor Duplicate Code** ⏱️ 16-20 hours
- **Priority**: MEDIUM
- **Files to Create**:
  - `apps/web/src/components/accounting/TransactionLineItemsTable.tsx`
  - `apps/web/src/components/accounting/TransactionFormDialog.tsx`
- **Files to Modify**:
  - `apps/web/src/app/accounting/invoices/components/CreateInvoiceDialog.tsx`
  - `apps/web/src/app/accounting/bills/components/CreateBillDialog.tsx`
- **Tasks**:
  - [ ] Extract `<TransactionLineItemsTable>` component
  - [ ] Extract shared form fields into `<TransactionFormDialog>`
  - [ ] Create shared hooks for line item management
  - [ ] Reduce invoice dialog from 535 to ~300 lines
  - [ ] Reduce bill dialog from 620 to ~350 lines
  - [ ] Test both dialogs still work correctly
- **Acceptance Criteria**:
  - Code duplication reduced by 40%
  - Both dialogs function identically
  - Line item table reusable across features

---

## 🇮🇳 Phase 2: Make It Compliant (Weeks 4-7)

### GST Compliance (Weeks 4-5)

**2.1 Implement GSTR-1 Report Generation** ⏱️ 20-24 hours
- **Priority**: CRITICAL
- **Files to Create**:
  - `apps/web/src/app/accounting/gst/gstr1/page.tsx`
  - `apps/web/src/lib/accounting/gst/gstr1Generator.ts`
  - `apps/web/src/lib/accounting/gst/gstTypes.ts`
- **Tasks**:
  - [ ] Create GSTR-1 report page UI
  - [ ] Query all POSTED invoices for selected month
  - [ ] Generate B2B (business to business) summary
  - [ ] Generate B2C (business to consumer) summary
  - [ ] Calculate HSN-wise summary
  - [ ] Group by GST rate (5%, 12%, 18%, 28%)
  - [ ] Export to JSON (for GST portal upload)
  - [ ] Export to Excel for review
  - [ ] Validate totals match invoice totals
- **Acceptance Criteria**:
  - Shows all outward supplies for month
  - B2B and B2C sections accurate
  - HSN summary matches invoice items
  - Exportable in GST portal format

**2.2 Implement GSTR-3B Report Generation** ⏱️ 20-24 hours
- **Priority**: CRITICAL
- **Files to Create**:
  - `apps/web/src/app/accounting/gst/gstr3b/page.tsx`
  - `apps/web/src/lib/accounting/gst/gstr3bGenerator.ts`
- **Tasks**:
  - [ ] Create GSTR-3B report page
  - [ ] Calculate outward taxable supplies (from invoices)
  - [ ] Calculate inward supplies liable to reverse charge (from bills)
  - [ ] Calculate eligible ITC (Input Tax Credit) from bills
  - [ ] Calculate net GST liability
  - [ ] Handle CGST, SGST, IGST separately
  - [ ] Export to JSON format for GST portal
  - [ ] Add month-wise comparison
- **Acceptance Criteria**:
  - Tax liability calculated correctly
  - ITC calculation matches eligible bills
  - Net payable amount accurate
  - Export format matches GST portal requirements

**2.3 Add GST Return Filing Interface** ⏱️ 12-16 hours
- **Priority**: HIGH
- **Files to Create**:
  - `apps/web/src/app/accounting/gst/filing/page.tsx`
  - `apps/web/src/lib/accounting/gst/filingStatus.ts`
- **Tasks**:
  - [ ] Create GST filing status tracker
  - [ ] Show GSTR-1, GSTR-3B filing status by month
  - [ ] Track filing dates and acknowledgment numbers
  - [ ] Add challan payment tracking
  - [ ] Generate filing summary report
  - [ ] Add reminder for upcoming due dates
- **Acceptance Criteria**:
  - Filing status tracked per month
  - Challan details stored
  - Due date reminders work

### TDS Compliance (Weeks 6-7)

**2.4 Implement TDS Certificate (Form 16A) Generation** ⏱️ 16-20 hours
- **Priority**: HIGH
- **Files to Create**:
  - `apps/web/src/app/accounting/tds/certificates/page.tsx`
  - `apps/web/src/lib/accounting/tds/form16aGenerator.ts`
  - `apps/web/src/lib/accounting/tds/pdfTemplates/form16a.tsx`
- **Tasks**:
  - [ ] Create TDS certificate generation page
  - [ ] Query vendor payments with TDS for quarter
  - [ ] Generate Form 16A PDF per vendor
  - [ ] Include TAN, PAN, assessment year
  - [ ] Show section-wise TDS deduction
  - [ ] Add certificate serial numbers
  - [ ] Track certificate issue dates
  - [ ] Email certificates to vendors
- **Acceptance Criteria**:
  - PDF matches official Form 16A format
  - All required fields populated
  - Vendor can receive via email

**2.5 Implement TDS Return (Form 26Q) Generation** ⏱️ 20-24 hours
- **Priority**: HIGH
- **Files to Create**:
  - `apps/web/src/app/accounting/tds/returns/page.tsx`
  - `apps/web/src/lib/accounting/tds/form26qGenerator.ts`
- **Tasks**:
  - [ ] Create TDS return generation page
  - [ ] Query all TDS deductions for quarter
  - [ ] Generate deductor details (company TAN)
  - [ ] Generate deductee details (vendor PAN)
  - [ ] Calculate section-wise TDS summary
  - [ ] Export to TDS utility format (.fvu file)
  - [ ] Generate challan summary
  - [ ] Validate return before export
- **Acceptance Criteria**:
  - FVU file format correct
  - Validation errors shown
  - Challan details included
  - Importable to TDS utility

**2.6 Add TDS Challan Tracking** ⏱️ 8-12 hours
- **Priority**: MEDIUM
- **Files to Create**:
  - `apps/web/src/app/accounting/tds/challans/page.tsx`
  - `packages/types/src/tds.ts` (TDSChallan type)
- **Tasks**:
  - [ ] Create challan entry form
  - [ ] Track BSR code, challan date, amount
  - [ ] Link challans to TDS periods
  - [ ] Show unmatched TDS amounts
  - [ ] Generate challan register report
- **Acceptance Criteria**:
  - Challans tracked by quarter
  - Unmatched amounts highlighted
  - Register exportable to Excel

---

## 🎯 Phase 3: Make It Production-Ready (Weeks 8-9)

### Financial Reports (Week 8)

**3.1 Implement Balance Sheet Report** ⏱️ 16-20 hours
- **Priority**: HIGH
- **Files to Create**:
  - `apps/web/src/app/accounting/reports/balance-sheet/page.tsx`
  - `apps/web/src/lib/accounting/reports/balanceSheet.ts`
- **Tasks**:
  - [ ] Create balance sheet page
  - [ ] Query all accounts by type (Assets, Liabilities, Equity)
  - [ ] Calculate total assets, liabilities, equity
  - [ ] Validate Assets = Liabilities + Equity
  - [ ] Add comparative view (This Year vs Last Year)
  - [ ] Export to PDF
  - [ ] Add drill-down to account ledger
- **Acceptance Criteria**:
  - Shows all balance sheet accounts
  - Accounting equation balances
  - PDF export professional format

**3.2 Implement Profit & Loss Statement** ⏱️ 16-20 hours
- **Priority**: HIGH
- **Files to Create**:
  - `apps/web/src/app/accounting/reports/profit-loss/page.tsx`
  - `apps/web/src/lib/accounting/reports/profitLoss.ts`
- **Tasks**:
  - [ ] Create P&L report page
  - [ ] Query revenue and expense accounts
  - [ ] Calculate gross profit (Revenue - Cost of Sales)
  - [ ] Calculate operating profit (Gross - Operating Expenses)
  - [ ] Calculate net profit (Operating - Other Expenses + Other Income)
  - [ ] Add month-wise breakdown
  - [ ] Export to PDF and Excel
  - [ ] Add chart visualization
- **Acceptance Criteria**:
  - Revenue, expenses, profit calculated correctly
  - Month-wise trends shown
  - Chart visualization clear

**3.3 Implement Cash Flow Statement** ⏱️ 16-20 hours
- **Priority**: MEDIUM
- **Files to Create**:
  - `apps/web/src/app/accounting/reports/cash-flow/page.tsx`
  - `apps/web/src/lib/accounting/reports/cashFlow.ts`
- **Tasks**:
  - [ ] Create cash flow report page
  - [ ] Implement indirect method (from P&L adjustments)
  - [ ] Calculate operating activities cash flow
  - [ ] Calculate investing activities cash flow
  - [ ] Calculate financing activities cash flow
  - [ ] Show opening and closing cash balance
  - [ ] Export to PDF
- **Acceptance Criteria**:
  - Cash flow categorized correctly
  - Net change in cash matches balance sheet
  - PDF export available

### User Experience (Week 9)

**3.4 Add Comprehensive Error Handling** ⏱️ 12-16 hours
- **Priority**: HIGH
- **Files to Create**:
  - `apps/web/src/components/common/ErrorBoundary.tsx`
  - `apps/web/src/lib/errors/errorMessages.ts`
- **Files to Modify**:
  - All dialog components
  - All list pages
- **Tasks**:
  - [ ] Create error boundary component
  - [ ] Wrap all accounting pages in error boundary
  - [ ] Create user-friendly error message mapping
  - [ ] Add retry logic for Firestore failures
  - [ ] Show actionable error messages
  - [ ] Log errors to monitoring service
  - [ ] Add error recovery suggestions
- **Acceptance Criteria**:
  - Firestore errors don't crash app
  - User sees helpful error messages
  - Retry functionality works

**3.5 Implement Loading States and Skeleton Screens** ⏱️ 10-14 hours
- **Priority**: MEDIUM
- **Files to Create**:
  - `apps/web/src/components/accounting/skeletons/TransactionListSkeleton.tsx`
  - `apps/web/src/components/accounting/skeletons/ReportSkeleton.tsx`
- **Files to Modify**:
  - All list pages
  - All report pages
- **Tasks**:
  - [ ] Create skeleton screens for transaction lists
  - [ ] Create skeleton screens for reports
  - [ ] Replace "Loading..." text with skeletons
  - [ ] Add loading spinners for actions
  - [ ] Implement optimistic updates for forms
- **Acceptance Criteria**:
  - Skeleton screens shown during loading
  - No flash of "Loading..." text
  - Smooth transitions

**3.6 Add Bulk Operations** ⏱️ 16-20 hours
- **Priority**: MEDIUM
- **Files to Create**:
  - `apps/web/src/components/accounting/BulkActionBar.tsx`
- **Files to Modify**:
  - `apps/web/src/app/accounting/invoices/page.tsx`
  - `apps/web/src/app/accounting/bills/page.tsx`
- **Tasks**:
  - [ ] Add checkbox selection to transaction lists
  - [ ] Create bulk action bar (Approve, Delete, Export)
  - [ ] Implement bulk approval workflow
  - [ ] Implement bulk Excel export
  - [ ] Implement bulk delete with confirmation
  - [ ] Add progress indicator for bulk operations
  - [ ] Handle partial failures gracefully
- **Acceptance Criteria**:
  - Can select multiple transactions
  - Bulk approve works correctly
  - Excel export includes all selected
  - Failed operations reported clearly

---

## 🚀 Phase 4: Advanced Features (Weeks 10-17)

**4.1 Implement Bank Reconciliation Module** ⏱️ 24-32 hours
- Week 10-11
- Priority: HIGH

**4.2 Add Accounts Receivable Aging Report** ⏱️ 12-16 hours
- Week 12
- Priority: HIGH

**4.3 Add Accounts Payable Aging Report** ⏱️ 12-16 hours
- Week 12
- Priority: HIGH

**4.4 Implement Expense Claims Module** ⏱️ 32-40 hours
- Week 13-14
- Priority: MEDIUM

**4.5 Implement Bank Transfer Tracking** ⏱️ 12-16 hours
- Week 14
- Priority: MEDIUM

**4.6 Add Multi-Currency Support** ⏱️ 24-32 hours
- Week 15
- Priority: LOW

**4.7 Implement Audit Trail** ⏱️ 20-24 hours
- Week 16
- Priority: MEDIUM

**4.8 Add Budget vs Actual Reports** ⏱️ 16-20 hours
- Week 17
- Priority: LOW

---

## 📋 Quality Gates

### Before Phase 2 (Week 4)
- ✅ All Phase 1 tests passing
- ✅ Trial Balance balances
- ✅ Account balances update correctly
- ✅ Payment allocations work
- ✅ Code coverage > 60%

### Before Phase 3 (Week 8)
- ✅ GSTR-1 and GSTR-3B generate correctly
- ✅ TDS certificates generate
- ✅ All reports tested with production-like data
- ✅ Code coverage > 70%

### Before Phase 4 (Week 10)
- ✅ All financial reports accurate
- ✅ Error handling comprehensive
- ✅ Performance acceptable with 10,000+ transactions
- ✅ Code coverage > 80%

### Production Release (Week 18)
- ✅ All 30 tasks completed
- ✅ UAT completed by accountant
- ✅ All tests passing
- ✅ Documentation complete
- ✅ Code coverage > 85%

---

## 🎯 Success Metrics

- **Accuracy**: Trial Balance always balances (0 tolerance for error)
- **Performance**: All pages load in < 2 seconds with 10,000 transactions
- **Compliance**: GST returns match official format 100%
- **Usability**: Accountant can create invoice in < 2 minutes
- **Reliability**: 99.9% uptime, error rate < 0.1%

---

## 📞 Stakeholders

- **Product Owner**: User
- **Tech Lead**: Claude Code
- **QA**: End-to-end tests + Manual UAT
- **Accountant**: Domain expert for compliance review

---

## 🔄 Review Cadence

- **Daily**: Todo list progress updates
- **Weekly**: Phase completion review
- **Bi-weekly**: Stakeholder demo
- **Monthly**: Production readiness assessment

---

**Document Version**: 1.0
**Last Updated**: 2025-11-02
**Next Review**: After Phase 1 completion
