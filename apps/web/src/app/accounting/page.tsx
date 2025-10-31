'use client';

import { Container, Typography, Box, Card, CardContent, CardActions, Button, Grid } from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  TrendingUp as TrendingUpIcon,
  Description as ReportIcon,
  SwapHoriz as TransferIcon,
  CurrencyExchange as ForexIcon,
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

export default function AccountingPage() {
  const router = useRouter();
  const { claims } = useAuth();

  // Check permissions
  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;

  const modules: AccountingModule[] = [
    {
      title: 'Chart of Accounts',
      description: 'Manage your company\'s chart of accounts with hierarchical structure',
      icon: <AccountBalanceIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/chart-of-accounts',
    },
    {
      title: 'Transactions',
      description: 'View and manage all financial transactions',
      icon: <ReceiptIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/transactions',
      comingSoon: true,
    },
    {
      title: 'Currency & Forex',
      description: 'Monitor currency exchange rates and stability analysis',
      icon: <ForexIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/currency',
      comingSoon: true,
    },
    {
      title: 'Cost Centres',
      description: 'Project-based cost tracking and budget management',
      icon: <TransferIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/cost-centres',
      comingSoon: true,
    },
    {
      title: 'Financial Reports',
      description: 'Balance Sheet, P&L, Cash Flow, and other reports',
      icon: <ReportIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/reports',
      comingSoon: true,
    },
    {
      title: 'GST & TDS',
      description: 'GST returns, TDS reports, and tax compliance',
      icon: <TrendingUpIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/accounting/tax-compliance',
      comingSoon: true,
    },
  ];

  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Accounting
          </Typography>
          <Typography variant="body1" color="error">
            You do not have permission to access the Accounting module.
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Accounting
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive accounting and financial management system
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {modules.map((module) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={module.path}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                ...(module.comingSoon && {
                  opacity: 0.7,
                  backgroundColor: 'action.hover',
                }),
              }}
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

              <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
                <Box sx={{ mb: 2 }}>{module.icon}</Box>
                <Typography variant="h6" component="h2" gutterBottom>
                  {module.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {module.description}
                </Typography>
              </CardContent>

              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => router.push(module.path)}
                  disabled={module.comingSoon}
                >
                  {module.comingSoon ? 'Coming Soon' : 'Open Module'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
