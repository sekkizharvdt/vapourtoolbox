'use client';

import {
  AccountBalance as AccountBalanceIcon,
  TrendingUp as TrendingUpIcon,
  Description as ReportIcon,
  SwapHoriz as TransferIcon,
  LibraryBooks as JournalIcon,
  Article as InvoiceIcon,
  RequestQuote as BillIcon,
  List as TransactionsIcon,
  Payment as PaymentIcon,
  AccountBalanceWallet as ReconciliationIcon,
  Folder as FolderIcon,
  Repeat as RecurringIcon,
  CalendarMonth as PlanningIcon,
  Payments as PaymentBatchIcon,
  Handshake as LoanIcon,
  HealthAndSafety as DataHealthIcon,
  DeleteSweep as TrashIcon,
  ReceiptLong as GRNBillsIcon,
  Business as AssetIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting } from '@vapour/constants';
import { ModuleLandingPage, type ModuleSection } from '@/components/modules';

export default function AccountingPage() {
  const { claims } = useAuth();

  // Check permissions
  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;

  const sections: ModuleSection[] = [
    {
      id: 'setup',
      title: 'Setup & Configuration',
      description: 'Foundation settings for your accounting system',
      items: [
        {
          id: 'chart-of-accounts',
          title: 'Chart of Accounts',
          description: "Manage your company's chart of accounts with hierarchical structure",
          icon: <AccountBalanceIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/chart-of-accounts',
        },
        {
          id: 'cost-centres',
          title: 'Cost Centres',
          description: 'Project-based cost tracking and budget management',
          icon: <TransferIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/cost-centres',
        },
      ],
    },
    {
      id: 'daily-transactions',
      title: 'Daily Transactions',
      description: 'Record invoices, bills, payments, and journal entries',
      items: [
        {
          id: 'invoices',
          title: 'Customer Invoices',
          description: 'Create and track customer invoices with GST calculations',
          icon: <InvoiceIcon sx={{ fontSize: 32, color: 'success.main' }} />,
          path: '/accounting/invoices',
        },
        {
          id: 'bills',
          title: 'Vendor Bills',
          description: 'Manage vendor bills with GST and TDS calculations',
          icon: <BillIcon sx={{ fontSize: 32, color: 'error.main' }} />,
          path: '/accounting/bills',
        },
        {
          id: 'payments',
          title: 'Payments',
          description: 'Record customer receipts and vendor payments with allocation',
          icon: <PaymentIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/payments',
        },
        {
          id: 'journal-entries',
          title: 'Journal Entries',
          description: 'Create manual journal entries for adjustments and accruals',
          icon: <JournalIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/journal-entries',
        },
      ],
    },
    {
      id: 'workflow',
      title: 'Workflow & Automation',
      description: 'Batch processing, recurring transactions, and reconciliation',
      items: [
        {
          id: 'data-health',
          title: 'Data Health',
          description: 'Fix data issues: unapplied payments, missing GL entries, unmapped accounts',
          icon: <DataHealthIcon sx={{ fontSize: 32, color: 'warning.main' }} />,
          path: '/accounting/data-health',
        },
        {
          id: 'grn-bills',
          title: 'GRN Bills',
          description: 'Create vendor bills from completed goods receipts',
          icon: <GRNBillsIcon sx={{ fontSize: 32, color: 'warning.main' }} />,
          path: '/accounting/grn-bills',
        },
        {
          id: 'payment-batches',
          title: 'Payment Batches',
          description: 'Allocate receipts to payments with approval workflow',
          icon: <PaymentBatchIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/payment-batches',
        },
        {
          id: 'recurring',
          title: 'Recurring Transactions',
          description: 'Manage recurring invoices, bills, salaries, and journal entries',
          icon: <RecurringIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/recurring',
        },
        {
          id: 'reconciliation',
          title: 'Bank Reconciliation',
          description: 'Match bank statements with accounting records',
          icon: <ReconciliationIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/reconciliation',
        },
        {
          id: 'trash',
          title: 'Trash',
          description: 'View and manage deleted transactions. Restore or permanently delete.',
          icon: <TrashIcon sx={{ fontSize: 32, color: 'text.secondary' }} />,
          path: '/accounting/trash',
        },
      ],
    },
    {
      id: 'planning',
      title: 'Planning & Analysis',
      description: 'Cash flow forecasting and interproject tracking',
      items: [
        {
          id: 'payment-planning',
          title: 'Payment Planning',
          description: 'Cash flow forecasting, expected receipts/payments, and financial planning',
          icon: <PlanningIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/payment-planning',
        },
        {
          id: 'interproject-loans',
          title: 'Interproject Loans',
          description: 'Track loans between projects with interest and repayment schedules',
          icon: <LoanIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/interproject-loans',
        },
        {
          id: 'fixed-assets',
          title: 'Fixed Assets',
          description: 'Asset register, depreciation tracking, and disposal management',
          icon: <AssetIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/fixed-assets',
        },
        {
          id: 'transactions',
          title: 'All Transactions',
          description: 'View and filter all financial transactions in one place',
          icon: <TransactionsIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/transactions',
        },
      ],
    },
    {
      id: 'reports',
      title: 'Reports & Compliance',
      description: 'Financial reports and tax compliance',
      items: [
        {
          id: 'financial-reports',
          title: 'Financial Reports',
          description: 'Balance Sheet, P&L, Cash Flow, Trial Balance, and Ledgers',
          icon: <ReportIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/reports',
        },
        {
          id: 'tax-compliance',
          title: 'GST & TDS',
          description: 'GST returns (GSTR-1, GSTR-2, GSTR-3B), TDS reports, and tax compliance',
          icon: <TrendingUpIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/tax-compliance',
        },
        {
          id: 'files',
          title: 'Files',
          description: 'Browse and manage accounting-related documents',
          icon: <FolderIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
          path: '/accounting/files',
        },
      ],
    },
  ];

  return (
    <ModuleLandingPage
      title="Accounting"
      description="Comprehensive accounting and financial management system"
      sections={sections}
      newAction={{
        label: 'New Entry',
        path: '/accounting/journal-entries/new',
      }}
      permissionDenied={!hasViewAccess}
      compact
    />
  );
}
