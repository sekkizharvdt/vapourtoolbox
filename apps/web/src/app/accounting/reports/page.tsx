'use client';

import {
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Breadcrumbs,
  Link,
} from '@mui/material';
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
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting } from '@vapour/constants';

interface FinancialReport {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  comingSoon?: boolean;
}

export default function FinancialReportsPage() {
  const router = useRouter();
  const { claims } = useAuth();

  // Check permissions
  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;

  const reports: FinancialReport[] = [
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
      title: 'Entity Ledger',
      description:
        'Financial history for vendors and customers - invoices, bills, payments, and balances',
      icon: <EntityIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/entity-ledger',
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
      title: 'Custom Reports',
      description: 'Build custom financial reports with filters and groupings',
      icon: <ReportIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports/custom',
      comingSoon: true,
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
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/accounting"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/accounting');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Accounting
        </Link>
        <Typography color="text.primary">Financial Reports</Typography>
      </Breadcrumbs>

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
                ...(report.comingSoon && {
                  opacity: 0.7,
                  backgroundColor: 'action.hover',
                }),
              }}
            >
              {report.comingSoon && (
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
                <Button
                  variant="contained"
                  onClick={() => router.push(report.path)}
                  disabled={report.comingSoon}
                >
                  {report.comingSoon ? 'Coming Soon' : 'View Report'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
