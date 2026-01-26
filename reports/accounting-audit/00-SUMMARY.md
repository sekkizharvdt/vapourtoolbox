# Accounting Data Audit Report

**Generated:** 2026-01-25
**Health Score:** 35/100 (Critical)

## Executive Summary

The accounting data requires significant attention to bring it up to proper standards. The main issues are:

1. **95 unapplied payments** totaling Rs. 6.5 crore - payments recorded but not linked to invoices/bills
2. **39 posted transactions without GL entries** - accounting entries missing from the general ledger
3. **34 overdue items** totaling Rs. 75.5 lakh - invoices and bills past their due dates
4. **78 line items without account mapping** - transactions missing expense/revenue account assignments

## Transaction Summary

| Type              | Count   |
| ----------------- | ------- |
| Vendor Bills      | 134     |
| Vendor Payments   | 60      |
| Customer Payments | 35      |
| Customer Invoices | 29      |
| Journal Entries   | 17      |
| **Total**         | **275** |

## Issues Breakdown

### 1. Overdue Items (34 items, Rs. 75,55,033.74)

| Category         | Count | Total Amount     |
| ---------------- | ----- | ---------------- |
| Overdue Invoices | 27    | Rs. 71,10,195.12 |
| Overdue Bills    | 7     | Rs. 4,44,838.62  |

**Oldest overdue:** VDT/FI-001/25-26 - 290 days past due (Rs. 14,75,000)

See: `01-overdue-items.csv`

### 2. Unapplied Payments (95 items, Rs. 6,50,49,947.10)

| Type              | Count | Total Amount       |
| ----------------- | ----- | ------------------ |
| Customer Payments | 35    | Rs. 4,64,49,247.67 |
| Vendor Payments   | 60    | Rs. 1,86,00,699.43 |

**Action Required:** Each payment needs to be applied to the corresponding invoice or bill.

See: `02-unapplied-payments.csv`

### 3. Missing GL Entries (39 items)

Posted transactions that have no general ledger entries:

- Customer Payments: 27
- Vendor Payments: 12

**Action Required:** GL entries need to be generated for these posted payments.

See: `03-missing-gl-entries.csv`

### 4. Line Items Without Account Mapping (78 transactions)

Transactions where line items don't have an expense/revenue account assigned:

- Vendor Bills: 65
- Customer Invoices: 13

**Action Required:** Assign appropriate Chart of Accounts to each line item.

See: `04-line-items-without-accounts.csv`

### 5. Journal Entries Missing Total Amount (17 items)

Journal entries that don't have a `totalAmount` field populated. This is a data normalization issue.

## Recommended Action Plan

### Priority 1: Fix GL Entries (Critical for Financial Reporting)

1. Review all 39 posted payments without GL entries
2. Generate GL entries using the system's GL entry generator
3. This will enable accurate Balance Sheet and P&L reports

### Priority 2: Apply Payments to Invoices/Bills

1. Match customer payments to customer invoices
2. Match vendor payments to vendor bills
3. This will update invoice/bill payment statuses and enable accurate AR/AP aging

### Priority 3: Assign Accounts to Line Items

1. For each vendor bill, select appropriate expense account
2. For each customer invoice, select appropriate revenue account
3. This enables proper expense/revenue categorization

### Priority 4: Follow Up on Overdue Items

1. Contact customers for overdue invoices
2. Plan payments for overdue vendor bills
3. Update payment status as collections are made

## Report Files

| File                                 | Description                            |
| ------------------------------------ | -------------------------------------- |
| `00-SUMMARY.md`                      | This summary report                    |
| `01-overdue-items.csv`               | Overdue invoices and bills             |
| `02-unapplied-payments.csv`          | Payments not linked to invoices/bills  |
| `03-missing-gl-entries.csv`          | Posted transactions without GL entries |
| `04-line-items-without-accounts.csv` | Line items missing account mapping     |
