# Accounting Module Testing Guide

## Overview
This guide will help you test the newly implemented accounting features in Vapour Toolbox. Please follow the steps below and report any issues you encounter.

**Access URL**: https://toolbox.vapourdesal.com/accounting

## Prerequisites
- You must have accounting permissions (MANAGE_ACCOUNTING or VIEW_ACCOUNTING)
- Ensure you have some test entities (customers/vendors) created
- Have your company GST settings configured

---

## Test 1: Chart of Accounts

**URL**: `/accounting/accounts`

### What to Test:
1. **View Account Hierarchy**
   - [ ] Verify all account categories are visible (Assets, Liabilities, Equity, Income, Expenses)
   - [ ] Check that accounts are properly indented showing parent-child relationships
   - [ ] Verify account codes are sequential and logical

2. **Expand/Collapse Functionality**
   - [ ] Click on group accounts to expand/collapse child accounts
   - [ ] Verify the expand/collapse icons work correctly
   - [ ] Check that the hierarchy remains stable after expanding/collapsing

3. **Account Balances**
   - [ ] Opening balances are displayed correctly
   - [ ] Current balances update after transactions (test this after creating transactions)

### Expected Results:
- Clean hierarchy view with proper indentation
- All Indian accounting accounts present (GST accounts, TDS accounts, Bank accounts)
- Account codes follow standard numbering (1000s for Assets, 2000s for Liabilities, etc.)

---

## Test 2: Customer Invoice

**URL**: `/accounting/invoices`

### What to Test:
1. **Create New Invoice**
   - [ ] Click "New Invoice" button
   - [ ] Select a customer from the Entity dropdown
   - [ ] Set invoice date
   - [ ] Add invoice description

2. **Line Items**
   - [ ] Click "Add Line Item"
   - [ ] Enter description, quantity, and unit price
   - [ ] Verify amount calculates automatically (quantity × unit price)
   - [ ] Add multiple line items
   - [ ] Test removing a line item

3. **GST Calculation**
   - [ ] Verify subtotal sums all line items correctly
   - [ ] Check GST calculation based on company GSTIN and customer GSTIN:
     - **Same state**: Should show CGST + SGST (9% + 9% = 18% total)
     - **Different state**: Should show IGST (18%)
   - [ ] Verify total = subtotal + GST

4. **Save Invoice**
   - [ ] Click "Create Invoice"
   - [ ] Verify success message appears
   - [ ] Check that invoice appears in the invoices list
   - [ ] Verify auto-generated invoice number (format: INV-YYYYMMDD-001)

5. **View Invoice**
   - [ ] Click on the invoice to view details
   - [ ] Verify all information is displayed correctly
   - [ ] Check that line items are preserved

### Sample Test Data:
```
Customer: [Select any customer entity]
Date: [Today's date]
Description: "Test Invoice for Software Services"

Line Items:
1. Description: "Development Services", Qty: 10, Price: 5000
2. Description: "Support Services", Qty: 5, Price: 3000

Expected Calculations:
- Subtotal: ₹65,000
- CGST (9%): ₹5,850
- SGST (9%): ₹5,850
- Total: ₹76,700
```

---

## Test 3: Vendor Bill

**URL**: `/accounting/bills`

### What to Test:
1. **Create New Bill**
   - [ ] Click "New Bill" button
   - [ ] Select a vendor from the Entity dropdown
   - [ ] Set bill date and due date
   - [ ] Add bill description

2. **Line Items**
   - [ ] Add line items with description, quantity, and unit price
   - [ ] Verify amounts calculate correctly
   - [ ] Test adding/removing line items

3. **GST Input Credit**
   - [ ] Verify GST calculation (CGST/SGST or IGST)
   - [ ] Check that GST is added to the subtotal (not deducted)
   - [ ] Verify input credit is properly shown

4. **TDS Deduction (if applicable)**
   - [ ] Toggle "TDS Deducted" checkbox
   - [ ] Select TDS section (e.g., 194C, 194J)
   - [ ] Verify TDS percentage applies correctly
   - [ ] Check that TDS amount is deducted from vendor payable
   - [ ] Formula: Payable = (Subtotal + GST) - TDS

5. **Save Bill**
   - [ ] Click "Create Bill"
   - [ ] Verify bill appears in bills list
   - [ ] Check auto-generated bill number (format: BILL-YYYYMMDD-001)

### Sample Test Data:
```
Vendor: [Select any vendor entity]
Date: [Today's date]
Due Date: [30 days from today]
Description: "Office Supplies Purchase"

Line Items:
1. Description: "Stationery", Qty: 50, Price: 200

TDS Section: 194C - Contractors (2%)

Expected Calculations:
- Subtotal: ₹10,000
- CGST (9%): ₹900
- SGST (9%): ₹900
- Total with GST: ₹11,800
- TDS (2% of ₹10,000): ₹200
- Vendor Payable: ₹11,600
```

---

## Test 4: Journal Entries

**URL**: `/accounting/journal-entries`

### What to Test:
1. **Create Manual Journal Entry**
   - [ ] Click "New Journal Entry"
   - [ ] Set date and description
   - [ ] Add narration/notes

2. **Debit/Credit Entries**
   - [ ] Click "Add Entry" to add ledger lines
   - [ ] Select accounts from the dropdown
   - [ ] Enter debit and credit amounts
   - [ ] Optionally assign to a project/cost centre

3. **Balance Validation**
   - [ ] Verify error message if total debits ≠ total credits
   - [ ] Check that save button is disabled when unbalanced
   - [ ] Ensure balanced entries can be saved

4. **Save Journal Entry**
   - [ ] Click "Create Journal Entry" when balanced
   - [ ] Verify entry appears in journal entries list
   - [ ] Check auto-generated entry number (format: JE-YYYYMMDD-001)

### Sample Test Data:
```
Date: [Today's date]
Description: "Bank Charges"
Reference: "Bank Statement"

Entries:
Debit  - Bank Charges Expense: ₹500
Credit - Bank Account: ₹500

Total Debits: ₹500
Total Credits: ₹500
Status: Balanced ✓
```

---

## Test 5: All Transactions View

**URL**: `/accounting/transactions`

### What to Test:
1. **View All Transactions**
   - [ ] Verify all created invoices, bills, and journal entries appear
   - [ ] Check transactions are sorted by date (newest first)
   - [ ] Verify transaction numbers are displayed correctly

2. **Filtering**
   - [ ] Test "Type" filter dropdown:
     - All Types
     - Invoices only
     - Bills only
     - Journal Entries only
     - Payments
   - [ ] Test "Status" filter:
     - All Status
     - Draft
     - Approved
     - Posted
     - Paid

3. **Search Functionality**
   - [ ] Search by transaction number
   - [ ] Search by entity name (customer/vendor)
   - [ ] Search by description
   - [ ] Search by reference number

4. **Transaction Summary**
   - [ ] Verify "Showing X of Y transactions" count is correct
   - [ ] Check that total amount displayed is accurate

---

## Test 6: Edge Cases & Error Handling

### What to Test:
1. **Validation Errors**
   - [ ] Try creating invoice without selecting customer (should show error)
   - [ ] Try creating invoice with no line items (should show error)
   - [ ] Try saving journal entry with unbalanced debits/credits (should prevent save)
   - [ ] Try entering negative quantities or prices (should validate)

2. **GST Edge Cases**
   - [ ] Test with 0% GST items (exempted goods)
   - [ ] Test with different GST rates (5%, 12%, 18%, 28%)
   - [ ] Test interstate vs intrastate transactions

3. **Date Validation**
   - [ ] Try entering future dates (should allow for invoicing)
   - [ ] Check date format is consistent (DD/MM/YYYY or system format)

4. **Permissions**
   - [ ] Log in as user with VIEW_ACCOUNTING only
   - [ ] Verify "New" buttons are hidden
   - [ ] Confirm edit/delete actions are disabled

---

## Test 7: Data Integrity

### What to Test:
1. **Transaction Numbers**
   - [ ] Create multiple transactions on same day
   - [ ] Verify sequential numbering (001, 002, 003...)
   - [ ] Check no duplicate transaction numbers exist

2. **Amount Calculations**
   - [ ] Manually verify all calculations with a calculator
   - [ ] Check rounding is correct (to 2 decimal places)
   - [ ] Verify Indian currency format (₹ symbol, lakhs/crores formatting)

3. **Entity Linking**
   - [ ] Create invoice for Customer A
   - [ ] Verify invoice shows correct customer name
   - [ ] Create bill for Vendor B
   - [ ] Verify bill shows correct vendor name

---

## Reporting Issues

If you encounter any issues, please report them with:

1. **What you were doing**: (e.g., "Creating a customer invoice with 3 line items")
2. **What you expected**: (e.g., "GST should calculate as 18% of subtotal")
3. **What actually happened**: (e.g., "GST showed as 0%")
4. **Screenshots**: Attach screenshots of the error or unexpected behavior
5. **Browser Console Errors**: Press F12, go to Console tab, and copy any red error messages

### Common Issues to Watch For:
- Loading screens that never complete
- Error messages about "permissions denied"
- Calculations that don't add up correctly
- Missing dropdowns or buttons
- Forms that don't save

---

## Test Completion Checklist

- [ ] Chart of Accounts: Hierarchy displays correctly
- [ ] Customer Invoice: Created successfully with correct GST
- [ ] Vendor Bill: Created successfully with GST and TDS
- [ ] Journal Entry: Created balanced manual entry
- [ ] All Transactions: View and filter work correctly
- [ ] Edge Cases: Validation works as expected
- [ ] Data Integrity: All calculations are accurate

**Testing Completed By**: ________________
**Date**: ________________
**Overall Status**: ⬜ All Tests Passed  ⬜ Issues Found (see attached report)

---

## Next Features Coming Soon

The following features are planned for future releases:
- Payments (customer receipts and vendor payments)
- Bank reconciliation
- Financial reports (P&L, Balance Sheet, Trial Balance)
- GST returns (GSTR-1, GSTR-3B)
- Expense claims and reimbursements
- Recurring invoices and bills
- Payment reminders
- Multi-currency support

---

**Support Contact**: sekkizhar@vapourdesal.com
