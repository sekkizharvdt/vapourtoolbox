'use client';

import { Typography, Box, Card, CardContent, Grid, Divider } from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  TrendingUp as TrendingUpIcon,
  Description as ReportIcon,
  SwapHoriz as TransferIcon,
  CurrencyExchange as ForexIcon,
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
  Settings as SettingsIcon,
  Receipt as ReceiptIcon,
  Assessment as AssessmentIcon,
  AutoMode as AutoModeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting } from '@vapour/constants';

interface AccountingModule {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  comingSoon?: boolean;
}

interface ModuleSection {
  title: string;
  description: string;
  icon: React.ReactNode;
  modules: AccountingModule[];
}

export default function AccountingPage() {
  const router = useRouter();
  const { claims } = useAuth();

  // Check permissions
  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;

  const sections: ModuleSection[] = [
    {
      title: 'Setup & Configuration',
      description: 'Foundation settings for your accounting system',
      icon: <SettingsIcon />,
      modules: [
        {
          title: 'Chart of Accounts',
          description: "Manage your company's chart of accounts with hierarchical structure",
          icon: <AccountBalanceIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/chart-of-accounts',
        },
        {
          title: 'Currency & Forex',
          description: 'Manage exchange rates, track forex gains/losses, and monitor currency exposure',
          icon: <ForexIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/currency',
        },
        {
          title: 'Cost Centres',
          description: 'Project-based cost tracking and budget management',
          icon: <TransferIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/cost-centres',
        },
      ],
    },
    {
      title: 'Daily Transactions',
      description: 'Record invoices, bills, payments, and journal entries',
      icon: <ReceiptIcon />,
      modules: [
        {
          title: 'Customer Invoices',
          description: 'Create and track customer invoices with GST calculations',
          icon: <InvoiceIcon sx={{ fontSize: 40, color: 'success.main' }} />,
          path: '/accounting/invoices',
        },
        {
          title: 'Vendor Bills',
          description: 'Manage vendor bills with GST and TDS calculations',
          icon: <BillIcon sx={{ fontSize: 40, color: 'error.main' }} />,
          path: '/accounting/bills',
        },
        {
          title: 'Payments',
          description: 'Record customer receipts and vendor payments with allocation',
          icon: <PaymentIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/payments',
        },
        {
          title: 'Journal Entries',
          description: 'Create manual journal entries for adjustments and accruals',
          icon: <JournalIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/journal-entries',
        },
      ],
    },
    {
      title: 'Workflow & Automation',
      description: 'Batch processing, recurring transactions, and reconciliation',
      icon: <AutoModeIcon />,
      modules: [
        {
          title: 'Payment Batches',
          description: 'Allocate receipts to payments with approval workflow',
          icon: <PaymentBatchIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/payment-batches',
        },
        {
          title: 'Recurring Transactions',
          description: 'Manage recurring invoices, bills, salaries, and journal entries',
          icon: <RecurringIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/recurring',
        },
        {
          title: 'Bank Reconciliation',
          description: 'Match bank statements with accounting records',
          icon: <ReconciliationIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/reconciliation',
        },
      ],
    },
    {
      title: 'Planning & Analysis',
      description: 'Cash flow forecasting and interproject tracking',
      icon: <PlanningIcon />,
      modules: [
        {
          title: 'Payment Planning',
          description: 'Cash flow forecasting, expected receipts/payments, and financial planning',
          icon: <PlanningIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/payment-planning',
        },
        {
          title: 'Interproject Loans',
          description: 'Track loans between projects with interest and repayment schedules',
          icon: <LoanIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/interproject-loans',
        },
        {
          title: 'All Transactions',
          description: 'View and filter all financial transactions in one place',
          icon: <TransactionsIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/transactions',
        },
      ],
    },
    {
      title: 'Reports & Compliance',
      description: 'Financial reports and tax compliance',
      icon: <AssessmentIcon />,
      modules: [
        {
          title: 'Financial Reports',
          description: 'Balance Sheet, P&L, Cash Flow, Trial Balance, and Ledgers',
          icon: <ReportIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/reports',
        },
        {
          title: 'GST & TDS',
          description: 'GST returns (GSTR-1, GSTR-2, GSTR-3B), TDS reports, and tax compliance',
          icon: <TrendingUpIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/tax-compliance',
        },
        {
          title: 'Files',
          description: 'Browse and manage accounting-related documents',
          icon: <FolderIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
          path: '/accounting/files',
        },
      ],
    },
  ];

  if (!hasViewAccess) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Accounting
        </Typography>
        <Typography variant="body1" color="error">
          You do not have permission to access the Accounting module.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Accounting
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive accounting and financial management system
        </Typography>
      </Box>

      {sections.map((section, sectionIndex) => (
        <Box key={section.title} sx={{ mb: 4 }}>
          {sectionIndex > 0 && <Divider sx={{ mb: 3 }} />}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{ color: 'primary.main' }}>{section.icon}</Box>
            <Typography variant="h6" component="h2">
              {section.title}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {section.description}
          </Typography>

          <Grid container spacing={2}>
            {section.modules.map((module) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={module.path}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    cursor: module.comingSoon ? 'default' : 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': module.comingSoon
                      ? {}
                      : {
                          transform: 'translateY(-2px)',
                          boxShadow: 4,
                        },
                    ...(module.comingSoon && {
                      opacity: 0.7,
                      backgroundColor: 'action.hover',
                    }),
                  }}
                  onClick={() => !module.comingSoon && router.push(module.path)}
                >
                  {module.comingSoon && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'warning.main',
                        color: 'warning.contrastText',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                      }}
                    >
                      Coming Soon
                    </Box>
                  )}

                  <CardContent sx={{ flexGrow: 1, pt: 2, pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box sx={{ flexShrink: 0 }}>{module.icon}</Box>
                      <Box>
                        <Typography variant="subtitle1" component="h3" fontWeight="medium">
                          {module.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {module.description}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </>
  );
}
