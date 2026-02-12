'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Alert,
  LinearProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
  AccountBalance as RevenueIcon,
  Payment as ExpenseIcon,
  ShowChart as ProfitIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { docToTypedWithDates } from '@/lib/firebase/typeHelpers';
import type { BaseTransaction, CostCentre } from '@vapour/types';

interface ProjectFinancials {
  projectId: string;
  projectName: string;
  revenue: number;
  expenses: number;
  profit: number;
  budget?: number;
  budgetCurrency?: string;
  transactions: BaseTransaction[];
  costCentres: CostCentre[];
}

export default function ProjectFinancialReportPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [financials, setFinancials] = useState<ProjectFinancials | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;
  const entityId = claims?.entityId;

  // Set default date range (current month)
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startStr = firstDay.toISOString().split('T')[0];
    const endStr = lastDay.toISOString().split('T')[0];

    if (startStr) setStartDate(startStr);
    if (endStr) setEndDate(endStr);
  }, []);

  // Load financial data when project or dates change
  useEffect(() => {
    if (!selectedProject || !startDate || !endDate || !entityId) {
      setFinancials(null);
      return;
    }

    loadFinancials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, startDate, endDate, entityId]);

  const loadFinancials = async () => {
    if (!selectedProject || !entityId) return;

    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();

      // Convert date strings to Timestamps
      const startTimestamp = Timestamp.fromDate(new Date(startDate + 'T00:00:00'));
      const endTimestamp = Timestamp.fromDate(new Date(endDate + 'T23:59:59'));

      // Query transactions for this project in the date range
      const transactionsQuery = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('entityId', '==', entityId),
        where('projectId', '==', selectedProject),
        where('date', '>=', startTimestamp),
        where('date', '<=', endTimestamp)
      );

      const transactionsSnapshot = await getDocs(transactionsQuery);

      // Calculate revenue and expenses
      let revenue = 0;
      let expenses = 0;
      const transactions: BaseTransaction[] = [];

      transactionsSnapshot.forEach((doc) => {
        const data = doc.data();
        const transaction = docToTypedWithDates<BaseTransaction>(doc.id, data);

        transactions.push(transaction);

        // Calculate revenue and expenses based on transaction type
        const amount = data.amount || 0;
        if (data.type === 'CUSTOMER_INVOICE' || data.type === 'CUSTOMER_PAYMENT') {
          revenue += amount;
        } else if (data.type === 'VENDOR_BILL' || data.type === 'VENDOR_PAYMENT') {
          expenses += amount;
        }
      });

      // Query cost centres for this project
      const costCentresQuery = query(
        collection(db, COLLECTIONS.COST_CENTRES),
        where('entityId', '==', entityId),
        where('projectId', '==', selectedProject)
      );

      const costCentresSnapshot = await getDocs(costCentresQuery);
      const costCentres: CostCentre[] = costCentresSnapshot.docs.map((doc) =>
        docToTypedWithDates<CostCentre>(doc.id, doc.data())
      );

      // Get project budget from cost centres
      const totalBudget = costCentres.reduce((sum, cc) => sum + (cc.budgetAmount || 0), 0);
      const budgetCurrency = costCentres.find((cc) => cc.budgetCurrency)?.budgetCurrency;

      setFinancials({
        projectId: selectedProject,
        projectName: '', // Will be populated from ProjectSelector
        revenue,
        expenses,
        profit: revenue - expenses,
        budget: totalBudget > 0 ? totalBudget : undefined,
        budgetCurrency,
        transactions,
        costCentres,
      });
    } catch (err) {
      console.error('[ProjectFinancialReport] Error loading financials:', err);
      setError(err instanceof Error ? err.message : 'Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency = 'INR') => {
    return `${currency} ${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CUSTOMER_INVOICE: 'Invoice',
      CUSTOMER_PAYMENT: 'Payment Received',
      VENDOR_BILL: 'Bill',
      VENDOR_PAYMENT: 'Payment Made',
      JOURNAL_ENTRY: 'Journal Entry',
    };
    return labels[type] || type;
  };

  const getTransactionTypeColor = (
    type: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    if (type === 'CUSTOMER_INVOICE' || type === 'CUSTOMER_PAYMENT') return 'success';
    if (type === 'VENDOR_BILL' || type === 'VENDOR_PAYMENT') return 'error';
    return 'default';
  };

  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Project Financial Reports
          </Typography>
          <Alert severity="error">You do not have permission to access financial reports.</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
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
        <Link
          color="inherit"
          href="/accounting/reports"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/accounting/reports');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Reports
        </Link>
        <Typography color="text.primary">Project Financial</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Project Financial Reports
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Analyze project-wise revenue, expenses, and profitability
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ProjectSelector
                value={selectedProject}
                onChange={setSelectedProject}
                label="Select Project"
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Loading financial data...
          </Typography>
          <LinearProgress />
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Financial Summary */}
      {financials && !loading && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Revenue Card */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <RevenueIcon color="success" sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Revenue
                    </Typography>
                  </Box>
                  <Typography variant="h5" color="success.main" fontWeight="medium">
                    {formatCurrency(financials.revenue, financials.budgetCurrency)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Expenses Card */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <ExpenseIcon color="error" sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Expenses
                    </Typography>
                  </Box>
                  <Typography variant="h5" color="error.main" fontWeight="medium">
                    {formatCurrency(financials.expenses, financials.budgetCurrency)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Profit/Loss Card */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <ProfitIcon
                      color={financials.profit >= 0 ? 'success' : 'error'}
                      sx={{ mr: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {financials.profit >= 0 ? 'Profit' : 'Loss'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {financials.profit >= 0 ? (
                      <UpIcon color="success" fontSize="small" />
                    ) : (
                      <DownIcon color="error" fontSize="small" />
                    )}
                    <Typography
                      variant="h5"
                      color={financials.profit >= 0 ? 'success.main' : 'error.main'}
                      fontWeight="medium"
                    >
                      {formatCurrency(Math.abs(financials.profit), financials.budgetCurrency)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Budget Utilization Card */}
            {financials.budget && financials.budget > 0 && (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Budget Utilization
                    </Typography>
                    <Typography variant="h5" fontWeight="medium" gutterBottom>
                      {((financials.expenses / financials.budget) * 100).toFixed(1)}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min((financials.expenses / financials.budget) * 100, 100)}
                      color={
                        (financials.expenses / financials.budget) * 100 < 75
                          ? 'success'
                          : (financials.expenses / financials.budget) * 100 < 90
                            ? 'warning'
                            : 'error'
                      }
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      {formatCurrency(financials.expenses, financials.budgetCurrency)} of{' '}
                      {formatCurrency(financials.budget, financials.budgetCurrency)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          {/* Transactions Table */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Transactions ({financials.transactions.length})
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Number</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {financials.transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          No transactions found for the selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      financials.transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>{formatDate(transaction.date)}</TableCell>
                          <TableCell>
                            <Chip
                              label={getTransactionTypeLabel(transaction.type)}
                              color={getTransactionTypeColor(transaction.type)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{transaction.transactionNumber || '-'}</TableCell>
                          <TableCell>{transaction.description || '-'}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(
                              transaction.amount || 0,
                              transaction.currency || financials.budgetCurrency
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip label={transaction.status} size="small" />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!financials && !loading && !error && (
        <Alert severity="info">Select a project and date range to view financial reports</Alert>
      )}
    </Container>
  );
}
