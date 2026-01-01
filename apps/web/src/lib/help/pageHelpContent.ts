/**
 * Page Help Content
 *
 * Centralized help content for all pages.
 * Each page can import the relevant help content and pass it to PageHeader.
 */

import type { PageHelpContent } from '@vapour/ui';

// ============================================================================
// HR Module
// ============================================================================

export const leaveListHelp: PageHelpContent = {
  description:
    'View and manage all leave requests. Track your leave balance, apply for new leave, and see the status of pending requests.',
  tips: [
    'Check your leave balance before applying - it shows entitled, used, and available days',
    'Leave requests require approval from designated approvers (usually 2 approvals needed)',
    'You can cancel pending requests if your plans change',
    'Use filters to view requests by status or date range',
  ],
  guideSection: 'hr',
};

export const leaveDetailHelp: PageHelpContent = {
  description:
    'View detailed information about a leave request including approval status and history.',
  tips: [
    'The approval status section shows who needs to approve and current progress',
    'Approvers can approve or reject with comments',
    'You cannot approve your own leave requests',
    'Once fully approved, the leave is deducted from your balance',
  ],
  guideSection: 'hr',
};

export const travelExpenseListHelp: PageHelpContent = {
  description:
    'Manage travel expense reports. Create new expense claims, track approvals, and view reimbursement status.',
  tips: [
    'Create expense reports after completing business travel',
    'Upload receipts for each expense item - this speeds up approval',
    'Reports go through manager approval before reimbursement',
    'You can download a PDF of any report for your records',
  ],
  guideSection: 'hr',
};

export const travelExpenseDetailHelp: PageHelpContent = {
  description: 'View and manage a travel expense report with itemized expenses and receipts.',
  tips: [
    'Add all expense items with accurate amounts and categories',
    'Upload clear photos of receipts - GST details should be visible',
    'Approvers can adjust amounts if receipts show different values',
    'Keep original receipts until reimbursement is complete',
  ],
  guideSection: 'hr',
};

export const employeeListHelp: PageHelpContent = {
  description: 'View and manage employee records including personal details and employment status.',
  tips: [
    'Click on an employee to view their full profile',
    'Use search to quickly find employees by name or email',
    'Employee data is used for leave management and approvals',
  ],
  guideSection: 'hr',
};

// ============================================================================
// Procurement Module
// ============================================================================

export const purchaseRequestListHelp: PageHelpContent = {
  description:
    'Create and manage purchase requests. Track approval status and convert approved PRs to Purchase Orders.',
  tips: [
    'Start with a PR for any material or service purchase',
    'Add items with detailed specifications for accurate quotes',
    'PRs require approval before proceeding to RFQ or PO',
    'Link PRs to projects for cost tracking',
  ],
  guideSection: 'procurement',
};

export const purchaseOrderListHelp: PageHelpContent = {
  description:
    'Manage purchase orders sent to vendors. Track order status, deliveries, and payments.',
  tips: [
    'POs are created from approved Purchase Requests or RFQ quotes',
    'Send POs to vendors via email directly from the system',
    'Track partial deliveries with Goods Receipt Notes',
    'POs link to invoices for three-way matching',
  ],
  guideSection: 'procurement',
};

export const rfqListHelp: PageHelpContent = {
  description:
    'Request for Quotations - get quotes from multiple vendors and compare prices before ordering.',
  tips: [
    'Send RFQs to 3+ vendors for competitive pricing',
    'Set a deadline for quote submissions',
    'Compare quotes side-by-side to select the best offer',
    'Convert winning quote directly to a Purchase Order',
  ],
  guideSection: 'procurement',
};

export const goodsReceiptListHelp: PageHelpContent = {
  description:
    'Record goods received against Purchase Orders. Track deliveries and quality inspections.',
  tips: [
    'Create a GRN when materials arrive at site',
    'Verify quantities and quality before accepting',
    'Partial receipts are supported - record what you receive',
    'GRNs are required for three-way matching with invoices',
  ],
  guideSection: 'procurement',
};

// ============================================================================
// Accounting Module
// ============================================================================

export const invoiceListHelp: PageHelpContent = {
  description:
    'Manage customer and vendor invoices. Track payments, due dates, and outstanding amounts.',
  tips: [
    'Customer invoices are for billing clients',
    'Vendor invoices record supplier bills for payment',
    'Use three-way matching to verify vendor invoices against POs and GRNs',
    'Overdue invoices are highlighted for follow-up',
  ],
  guideSection: 'accounting',
};

export const chartOfAccountsHelp: PageHelpContent = {
  description:
    'Define and manage your chart of accounts. Organize accounts by type for financial reporting.',
  tips: [
    'Accounts are organized by type: Assets, Liabilities, Equity, Revenue, Expenses',
    'Use account codes for easy identification',
    'Parent-child relationships create account hierarchies',
    'Standard Indian accounting structure with GST accounts included',
  ],
  guideSection: 'accounting',
};

export const journalEntryListHelp: PageHelpContent = {
  description:
    'View and create journal entries. Record adjustments, accruals, and other accounting transactions.',
  tips: [
    'Journal entries must balance (debits = credits)',
    'Add reference documents for audit trail',
    'Use templates for recurring entries',
    'Entries can be reversed if needed',
  ],
  guideSection: 'accounting',
};

export const reconciliationHelp: PageHelpContent = {
  description:
    'Bank reconciliation - match bank statements with recorded transactions to ensure accuracy.',
  tips: [
    'Upload bank statements in CSV format',
    'System suggests matches based on amount and date',
    'Review and confirm matches manually for accuracy',
    'Outstanding items should be investigated',
  ],
  guideSection: 'accounting',
};

// ============================================================================
// Flow Module
// ============================================================================

export const flowHelp: PageHelpContent = {
  description:
    'Your task inbox - see all pending tasks, approvals, and notifications organized by project and category.',
  tips: [
    'Click on a task to go directly to where you can take action',
    'Tasks auto-complete when you perform the action',
    'Use channels to filter by category (Approvals, HR, Procurement)',
    'Mentions (@you) appear when someone needs your attention',
  ],
  guideSection: 'flow',
};

// ============================================================================
// Documents Module
// ============================================================================

export const documentsHelp: PageHelpContent = {
  description:
    'Document management system. Upload, organize, and share project documents and files.',
  tips: [
    'Organize documents in project folders',
    'Supported formats: PDF, images, Office documents, CAD files',
    'Use tags for easy searching across projects',
    'Version history tracks changes to documents',
  ],
  guideSection: 'documents',
};

// ============================================================================
// Projects Module
// ============================================================================

export const projectListHelp: PageHelpContent = {
  description: 'View and manage all projects. Track progress, costs, and team assignments.',
  tips: [
    'Each project has its own documents, materials, and financials',
    'Project dashboard shows key metrics at a glance',
    'Link proposals, POs, and expenses to projects for tracking',
    'Archive completed projects to keep the list clean',
  ],
  guideSection: 'getting-started',
};

// ============================================================================
// Materials Module
// ============================================================================

export const materialsHelp: PageHelpContent = {
  description:
    'Material master data - manage your catalog of materials, specifications, and pricing.',
  tips: [
    'Add materials with detailed specifications for accurate ordering',
    'Link materials to suppliers for quick PO creation',
    'Track material costs across projects',
    'Use categories to organize your material catalog',
  ],
  guideSection: 'materials',
};

// ============================================================================
// Proposals Module
// ============================================================================

export const proposalListHelp: PageHelpContent = {
  description:
    'Manage customer proposals and quotations. Track from enquiry to order confirmation.',
  tips: [
    'Create proposals from customer enquiries',
    'Add line items with detailed specifications and pricing',
    'Generate professional PDF quotes for customers',
    'Convert won proposals to projects for execution',
  ],
  guideSection: 'proposals',
};

export const enquiryListHelp: PageHelpContent = {
  description: 'Track customer enquiries. Capture requirements and convert to proposals.',
  tips: [
    'Log all customer enquiries for follow-up',
    'Capture technical requirements and specifications',
    'Set follow-up dates to stay on top of opportunities',
    'Convert qualified enquiries to proposals',
  ],
  guideSection: 'proposals',
};

// ============================================================================
// Admin Module
// ============================================================================

export const userManagementHelp: PageHelpContent = {
  description: 'Manage user accounts and permissions. Control who can access what in the system.',
  tips: [
    'Add users by email - they receive a login link',
    'Assign roles to control access to modules',
    'Permissions can be customized per user',
    'Deactivate users instead of deleting to preserve history',
  ],
  guideSection: 'getting-started',
};

export const hrSetupHelp: PageHelpContent = {
  description: 'Configure HR settings including leave types, approvers, and policies.',
  tips: [
    'Define leave types with yearly entitlements',
    'Set up approval workflows for leaves and expenses',
    'Configure approvers who can approve requests',
    'Initialize leave balances for each financial year',
  ],
  guideSection: 'hr',
};
