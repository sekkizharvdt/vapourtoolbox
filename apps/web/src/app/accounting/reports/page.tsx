'use client';

import { Typography, Box, Card, CardContent, CardActions, Button, Grid } from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  AccountBalance as BalanceSheetIcon,
  TrendingUp as PLIcon,
  WaterfallChart as CashFlowIcon,
  FormatListNumbered as TrialBalanceIcon,
  Receipt as LedgerIcon,
  Assessment as ReportIcon,
  BusinessCenter as ProjectIcon,
  Business as EntityIcon,
  Home as HomeIcon,
  Payments as ReceiptsPaymentsIcon,
  AccountBalanceWallet as GSTIcon,
  Speed as ReceivablesIcon,
  PieChart as ConcentrationIcon,
  AccountBalance as BankBookIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting } from '@vapour/constants';

interface FinancialReport {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
}

export default function FinancialReportsPage() {
  const router = useRouter();
  const { claims } = useAuth();

  // Check permissions
  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;

  const reports: FinancialReport[] = [
    {
      title: 'Management Report (Quarterly / Annual)',
      description:
        'Everything in one document for a fiscal quarter or full year — executive summary, ' +
        'comparative P&L, balance sheet, cash flow, AR/AP aging, working capital ratios, GST, ' +
        'project performance, and data-quality checks. Downloadable as PDF.',
      icon: <ReportIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/period-report',
    },
    {
      title: 'Trial Balance',
      description: 'View all account balances with debits and credits for a specific period',
      icon: <TrialBalanceIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/trial-balance',
    },
    {
      title: 'Balance Sheet',
      description: 'Assets, Liabilities, and Equity snapshot at a specific date',
      icon: <BalanceSheetIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/balance-sheet',
    },
    {
      title: 'Profit & Loss Statement',
      description: 'Revenue and expenses for a specific period to determine profitability',
      icon: <PLIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/profit-loss',
    },
    {
      title: 'Cash Flow Statement',
      description: 'Track cash inflows and outflows from operating, investing, and financing',
      icon: <CashFlowIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/cash-flow',
    },
    {
      title: 'Account Ledger',
      description: 'Detailed transaction history for any specific account',
      icon: <LedgerIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/account-ledger',
    },
    {
      title: 'Receivables Performance',
      description:
        'How quickly customers pay — days sales outstanding, average and median days to collect, ' +
        'on-time payment rate, ageing, and the worst-paying accounts',
      icon: <ReceivablesIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/receivables-performance',
    },
    {
      title: 'Customer & Vendor Concentration',
      description:
        'Who the revenue and the spend depend on — ranked shares, cumulative exposure, ' +
        'top-N concentration, and movement against the previous period',
      icon: <ConcentrationIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/concentration',
    },
    {
      title: 'Entity Ledger',
      description:
        'Financial history for vendors and customers - invoices, bills, payments, and balances',
      icon: <EntityIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/entity-ledger',
    },
    {
      title: 'Bank Book',
      description:
        'Opening to closing balance for each bank and cash account, with every receipt and ' +
        'payment behind it and a breakdown by payment method',
      icon: <BankBookIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/bank-book',
    },
    {
      title: 'Project Financial Reports',
      description: 'Project-wise income, expenses, and budget analysis',
      icon: <ProjectIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/project-financial',
    },
    {
      title: 'Receipts & Payments',
      description: 'Monthly cash receipts and payments with categorized breakdowns',
      icon: <ReceiptsPaymentsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/receipts-payments',
    },
    {
      title: 'GST Summary',
      description: 'Net GST position across CGST, SGST, and IGST with input vs output breakdown',
      icon: <GSTIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/gst-summary',
    },
  ];

  if (!hasViewAccess) {
    return (
      <>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Financial Reports
          </Typography>
          <Typography variant="body1" color="error">
            You do not have permission to access financial reports.
          </Typography>
        </Box>
      </>
    );
  }

  return (
    <>
      <PageBreadcrumbs
        items={[
          { label: 'Accounting', href: '/accounting', icon: <HomeIcon fontSize="small" /> },
          { label: 'Financial Reports' },
        ]}
      />

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Financial Reports
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Generate and view comprehensive financial reports for analysis and compliance
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {reports.map((report) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={report.path}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
                <Box sx={{ mb: 2 }}>{report.icon}</Box>
                <Typography variant="h6" component="h2" gutterBottom>
                  {report.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {report.description}
                </Typography>
              </CardContent>

              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button variant="contained" onClick={() => router.push(report.path)}>
                  View Report
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
