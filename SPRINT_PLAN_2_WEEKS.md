# 2-Week Sprint Plan: Complete Accounting Module to 100%

**Sprint Goal:** Get Accounting module to 100% completion with all financial reports working

**Start Date:** Today
**End Date:** +14 days
**Focus:** Feature completion, no E2E test debugging

---

## Week 1: Financial Reports (Days 1-7)

### Day 1: WSL Migration + Balance Sheet (Part 1)

**Morning (4 hours): WSL Setup**

- [ ] Install/update WSL Ubuntu
- [ ] Install Node.js 20, pnpm, Firebase CLI
- [ ] Clone project to WSL
- [ ] Install dependencies
- [ ] Copy .env files and service account key
- [ ] Verify dev server and emulators work

**Afternoon (4 hours): Balance Sheet Foundation**

- [ ] Create Balance Sheet page: `apps/web/src/app/accounting/reports/balance-sheet/page.tsx`
- [ ] Create Balance Sheet component: `apps/web/src/components/accounting/reports/BalanceSheetReport.tsx`
- [ ] Design data structure for Balance Sheet
- [ ] Create helper function to calculate account balances by type
- [ ] Test with sample data

**Deliverable:** WSL working + Balance Sheet page skeleton

---

### Day 2: Balance Sheet (Part 2)

**Full Day (8 hours): Complete Balance Sheet**

- [ ] Implement Assets section (Current + Fixed)
- [ ] Implement Liabilities section (Current + Long-term)
- [ ] Implement Equity section
- [ ] Calculate totals and verify Assets = Liabilities + Equity
- [ ] Add date range selector (As of Date)
- [ ] Add export to PDF functionality
- [ ] Add export to Excel functionality
- [ ] Manual testing with real Indian COA data
- [ ] Fix any calculation bugs

**Deliverable:** Fully working Balance Sheet report

---

### Day 3: Profit & Loss Statement (Part 1)

**Full Day (8 hours): P&L Foundation**

- [ ] Create P&L page: `apps/web/src/app/accounting/reports/profit-loss/page.tsx`
- [ ] Create P&L component: `apps/web/src/components/accounting/reports/ProfitLossReport.tsx`
- [ ] Design data structure for P&L
- [ ] Implement Income section (query transactions by account type)
- [ ] Implement COGS section
- [ ] Calculate Gross Profit
- [ ] Test with sample journal entries

**Deliverable:** P&L report with Income and COGS sections

---

### Day 4: Profit & Loss Statement (Part 2)

**Full Day (8 hours): Complete P&L**

- [ ] Implement Operating Expenses section
- [ ] Implement Other Income section
- [ ] Calculate Operating Profit
- [ ] Calculate Net Profit
- [ ] Add date range selector (From/To dates)
- [ ] Add comparison with previous period
- [ ] Add percentage calculations (margins, ratios)
- [ ] Add export to PDF
- [ ] Add export to Excel
- [ ] Manual testing with real data
- [ ] Verify calculations are correct

**Deliverable:** Fully working P&L Statement

---

### Day 5: Cash Flow Statement (Part 1)

**Full Day (8 hours): Cash Flow Foundation**

- [ ] Create Cash Flow page: `apps/web/src/app/accounting/reports/cash-flow/page.tsx`
- [ ] Create Cash Flow component: `apps/web/src/components/accounting/reports/CashFlowReport.tsx`
- [ ] Research Cash Flow calculation methods (Direct vs Indirect)
- [ ] Choose Indirect method (easier with current data)
- [ ] Implement Operating Activities section
- [ ] Calculate starting Net Income (from P&L)
- [ ] Add adjustments for non-cash items

**Deliverable:** Cash Flow report with Operating Activities

---

### Day 6: Cash Flow Statement (Part 2)

**Full Day (8 hours): Complete Cash Flow**

- [ ] Implement Investing Activities section
- [ ] Implement Financing Activities section
- [ ] Calculate Net Change in Cash
- [ ] Verify with actual cash account balances
- [ ] Add date range selector
- [ ] Add export to PDF
- [ ] Add export to Excel
- [ ] Manual testing
- [ ] Fix any calculation issues

**Deliverable:** Fully working Cash Flow Statement

---

### Day 7: Reports Integration & Testing

**Morning (4 hours): Reports Navigation & Integration**

- [ ] Create Reports landing page: `apps/web/src/app/accounting/reports/page.tsx`
- [ ] Add navigation cards for all reports
- [ ] Add descriptions and icons
- [ ] Update sidebar navigation
- [ ] Test all report links

**Afternoon (4 hours): Manual Testing**

- [ ] Create test scenario with complete accounting cycle
- [ ] Test Balance Sheet with various transactions
- [ ] Test P&L with income and expenses
- [ ] Test Cash Flow calculations
- [ ] Fix any bugs found
- [ ] Document known limitations

**Deliverable:** All 3 financial reports working and accessible

---

## Week 2: Bank Reconciliation + GST Reports (Days 8-14)

### Day 8: Bank Reconciliation (Part 1)

**Full Day (8 hours): Bank Rec Foundation**

- [ ] Create Bank Reconciliation page: `apps/web/src/app/accounting/bank-reconciliation/page.tsx`
- [ ] Design UI for statement upload (CSV import)
- [ ] Create CSV parser for bank statements
- [ ] Design reconciliation data structure
- [ ] Implement transaction matching algorithm (by amount + date)
- [ ] Show unmatched book transactions
- [ ] Show unmatched bank transactions

**Deliverable:** Bank reconciliation page with CSV import

---

### Day 9: Bank Reconciliation (Part 2)

**Full Day (8 hours): Complete Bank Rec**

- [ ] Add manual matching functionality
- [ ] Add "Create Journal Entry" for unmatched items
- [ ] Calculate reconciled balance
- [ ] Show reconciliation summary
- [ ] Add reconciliation history (past reconciliations)
- [ ] Add export reconciliation report to PDF
- [ ] Manual testing with sample bank statement
- [ ] Fix bugs

**Deliverable:** Fully working Bank Reconciliation

---

### Day 10: GST Reports (Part 1) - GSTR-1

**Full Day (8 hours): GSTR-1 Report**

- [ ] Create GST Reports page: `apps/web/src/app/accounting/reports/gst/page.tsx`
- [ ] Create GSTR-1 component: `apps/web/src/components/accounting/reports/GSTR1Report.tsx`
- [ ] Query all customer invoices with CGST/SGST/IGST
- [ ] Section B2B: Invoice-wise outward supplies to registered persons
- [ ] Section B2C: Invoice-wise outward supplies to unregistered persons
- [ ] Calculate total taxable value, CGST, SGST, IGST
- [ ] Add month selector
- [ ] Format for GSTN portal upload (JSON)

**Deliverable:** GSTR-1 report ready for filing

---

### Day 11: GST Reports (Part 2) - GSTR-3B

**Full Day (8 hours): GSTR-3B Report**

- [ ] Create GSTR-3B component: `apps/web/src/components/accounting/reports/GSTR3BReport.tsx`
- [ ] Section 3.1: Outward supplies (from GSTR-1)
- [ ] Section 4: Input Tax Credit (from Bills with GST)
- [ ] Calculate net tax liability
- [ ] Add month selector
- [ ] Format for GSTN portal upload (JSON)
- [ ] Manual testing with sample data
- [ ] Verify calculations match GSTR-1

**Deliverable:** GSTR-3B report ready for filing

---

### Day 12: TDS Reports

**Full Day (8 hours): TDS Reports**

- [ ] Create TDS Report page: `apps/web/src/app/accounting/reports/tds/page.tsx`
- [ ] Query all bills with TDS deductions
- [ ] Group by TDS section (194C, 194J, etc.)
- [ ] Calculate total TDS deducted
- [ ] Format for Form 26Q (Quarterly TDS return)
- [ ] Add quarter selector
- [ ] Add export to Excel
- [ ] Manual testing

**Deliverable:** TDS report for quarterly filing

---

### Day 13: Reports Polish & Bug Fixes

**Full Day (8 hours): Refinement**

- [ ] Review all reports for UI/UX consistency
- [ ] Add loading states for all reports
- [ ] Add error handling for all reports
- [ ] Add empty states (no data)
- [ ] Fix any calculation bugs found during testing
- [ ] Improve performance (add memoization where needed)
- [ ] Add print stylesheets for PDF export
- [ ] Test on different screen sizes (responsive)

**Deliverable:** All reports polished and production-ready

---

### Day 14: Documentation & Handoff

**Morning (4 hours): Documentation**

- [ ] Create Accounting Module Documentation: `docs/ACCOUNTING_MODULE.md`
- [ ] Document each report and its purpose
- [ ] Document data flow (from transactions to reports)
- [ ] Document export formats and integrations
- [ ] Document known limitations
- [ ] Create user guide with screenshots
- [ ] Document manual testing checklist

**Afternoon (4 hours): Final Testing & Commit**

- [ ] Run through complete accounting workflow manually
- [ ] Create sample company data for testing
- [ ] Test all features end-to-end
- [ ] Fix critical bugs
- [ ] Commit all changes with detailed message
- [ ] Push to GitHub
- [ ] Create GitHub release/tag: v0.3.0-accounting-complete

**Deliverable:** Accounting Module 100% Complete + Documented

---

## Success Metrics

### Completed Features (15 total):

- [x] Chart of Accounts with Indian COA template (DONE)
- [x] Customer Invoices with GST (DONE)
- [x] Vendor Bills with GST and TDS (DONE)
- [x] Customer/Vendor Payments (DONE)
- [x] Journal Entries (DONE)
- [x] GL Entry generation (DONE)
- [x] Trial Balance report (DONE)
- [x] Account Ledger report (DONE)
- [ ] Balance Sheet report (DAY 1-2)
- [ ] Profit & Loss Statement (DAY 3-4)
- [ ] Cash Flow Statement (DAY 5-6)
- [ ] Bank Reconciliation (DAY 8-9)
- [ ] GSTR-1 report (DAY 10)
- [ ] GSTR-3B report (DAY 11)
- [ ] TDS reports (DAY 12)

### Completion Tracking:

- Week 1 End: **11/15 features** (73%)
- Week 2 End: **15/15 features** (100%)

---

## Risk Management

### Potential Blockers:

1. **WSL migration takes longer than expected**
   - Mitigation: Keep Windows as backup, can continue there if needed
   - Time: Allocate extra 2 hours if needed

2. **Report calculations are complex**
   - Mitigation: Start with simple version, iterate
   - Time: Buffer time in Day 13

3. **Excel/PDF export issues**
   - Mitigation: Use proven libraries (xlsx, jsPDF)
   - Can skip and add later if blocked

4. **GST/TDS report formats unclear**
   - Mitigation: Use official GSTN templates as reference
   - Consult CA if needed

### Backup Plan:

If behind schedule by Day 7:

- Skip Cash Flow report (move to next sprint)
- Focus on Balance Sheet + P&L (most critical)
- Complete GST reports (regulatory requirement)

---

## Daily Standup Questions

Each day, track:

1. **What did I complete yesterday?**
2. **What will I complete today?**
3. **Any blockers?**

---

## Tools & Libraries Needed

### For Reports:

- `recharts` or `chart.js` - for visualizations (optional)
- `xlsx` - for Excel export
- `jspdf` + `html2canvas` - for PDF export
- `date-fns` - for date calculations

Install:

```bash
pnpm add xlsx jspdf html2canvas recharts date-fns
pnpm add -D @types/node
```

### For Bank Reconciliation:

- `papaparse` - CSV parsing
- `fuse.js` - fuzzy matching for transactions

Install:

```bash
pnpm add papaparse fuse.js
pnpm add -D @types/papaparse
```

---

## Post-Sprint Actions

After completing this sprint:

1. Demo Accounting module to stakeholders
2. Gather feedback
3. Create next sprint plan for:
   - Project Management module (foundation)
   - Time Tracking module
   - Task Management

**Goal:** 80% of application complete in 12 weeks total (8 weeks remaining)

---

## Motivation

**Current State:** 25% complete (6 weeks of work)
**After This Sprint:** 40% complete (8 weeks of work)
**Progress:** +15% in 2 weeks (best velocity yet!)

This sprint proves you can complete complex modules quickly when focused on features instead of tests.

**Let's ship something amazing! 🚀**
