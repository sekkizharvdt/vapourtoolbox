'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Box,
  Breadcrumbs,
  Link,
  Alert,
  Paper,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardContent,
} from '@mui/material';
import {
  Home as HomeIcon,
  CalendarMonth as CalendarIcon,
  TrendingUp as InflowIcon,
  TrendingDown as OutflowIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { getUpcomingOccurrences } from '@/lib/accounting/recurringTransactionService';
import type { RecurringOccurrence, RecurringTransactionType } from '@vapour/types';

const TYPE_LABELS: Record<RecurringTransactionType, string> = {
  SALARY: 'Salary',
  VENDOR_BILL: 'Vendor Bill',
  CUSTOMER_INVOICE: 'Customer Invoice',
  JOURNAL_ENTRY: 'Journal Entry',
};

const TYPE_COLORS: Record<RecurringTransactionType, 'primary' | 'secondary' | 'success' | 'info'> = {
  SALARY: 'secondary',
  VENDOR_BILL: 'primary',
  CUSTOMER_INVOICE: 'success',
  JOURNAL_ENTRY: 'info',
};

type DateRange = '7' | '14' | '30' | '60';

export default function UpcomingOccurrencesPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const [occurrences, setOccurrences] = useState<RecurringOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30');

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;

  useEffect(() => {
    if (!hasViewAccess) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const { db } = getFirebase();
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + parseInt(dateRange));

        const occ = await getUpcomingOccurrences(db, startDate, endDate);
        setOccurrences(occ);
      } catch (error) {
        console.error('[UpcomingOccurrences] Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [hasViewAccess, dateRange]);

  const formatCurrency = (amount: number, currency = 'INR') => {
    return `${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} ${currency}`;
  };

  // Calculate totals
  const summary = occurrences.reduce(
    (acc, occ) => {
      if (occ.type === 'CUSTOMER_INVOICE') {
        acc.inflow += occ.finalAmount.amount;
        acc.inflowCount++;
      } else if (occ.type === 'VENDOR_BILL' || occ.type === 'SALARY') {
        acc.outflow += occ.finalAmount.amount;
        acc.outflowCount++;
      }
      return acc;
    },
    { inflow: 0, outflow: 0, inflowCount: 0, outflowCount: 0 }
  );

  // Group by date
  const groupedByDate = occurrences.reduce<Record<string, RecurringOccurrence[]>>(
    (acc, occ) => {
      const scheduledDate = occ.scheduledDate as { toDate: () => Date };
      const isoString = scheduledDate.toDate().toISOString();
      const dateKey = isoString.substring(0, 10); // YYYY-MM-DD format
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(occ);
      return acc;
    },
    {}
  );

  const sortedDates = Object.keys(groupedByDate).sort();

  if (!hasViewAccess) {
    return (
      <>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Upcoming Occurrences
          </Typography>
          <Alert severity="error">
            You do not have permission to view recurring transactions.
          </Alert>
        </Box>
      </>
    );
  }

  return (
    <>
      <Box sx={{ mb: 4 }}>
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
            href="/accounting/recurring"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/accounting/recurring');
            }}
            sx={{ cursor: 'pointer' }}
          >
            Recurring Transactions
          </Link>
          <Typography color="text.primary">Upcoming</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              <CalendarIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Upcoming Occurrences
            </Typography>
            <Typography variant="body1" color="text.secondary">
              View upcoming recurring transactions and their expected dates
            </Typography>
          </Box>

          <ToggleButtonGroup
            value={dateRange}
            exclusive
            onChange={(_, value) => value && setDateRange(value)}
            size="small"
          >
            <ToggleButton value="7">7 Days</ToggleButton>
            <ToggleButton value="14">14 Days</ToggleButton>
            <ToggleButton value="30">30 Days</ToggleButton>
            <ToggleButton value="60">60 Days</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CalendarIcon color="primary" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Upcoming
                  </Typography>
                </Box>
                <Typography variant="h4">{occurrences.length}</Typography>
                <Typography variant="caption" color="text.secondary">
                  in next {dateRange} days
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <InflowIcon color="success" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Expected Inflow
                  </Typography>
                </Box>
                <Typography variant="h5" color="success.main">
                  {formatCurrency(summary.inflow)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {summary.inflowCount} invoices
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <OutflowIcon color="error" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Expected Outflow
                  </Typography>
                </Box>
                <Typography variant="h5" color="error.main">
                  {formatCurrency(summary.outflow)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {summary.outflowCount} bills/salaries
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {loading ? (
          <Box sx={{ mt: 4 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Loading upcoming occurrences...
            </Typography>
            <LinearProgress />
          </Box>
        ) : occurrences.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No upcoming occurrences in the next {dateRange} days.
          </Alert>
        ) : (
          <>
            {sortedDates.map((dateKey) => {
              const dayOccurrences = groupedByDate[dateKey] ?? [];
              const date = new Date(dateKey);
              const isToday = new Date().toISOString().split('T')[0] === dateKey;
              const isTomorrow =
                new Date(Date.now() + 86400000).toISOString().split('T')[0] === dateKey;

              if (dayOccurrences.length === 0) return null;

              return (
                <Paper key={dateKey} sx={{ mb: 2 }}>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: isToday ? 'primary.50' : isTomorrow ? 'warning.50' : 'grey.50',
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight="medium">
                      {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : ''}
                      {' '}
                      {date.toLocaleDateString('en-IN', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Typography>
                  </Box>

                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dayOccurrences.map((occ) => (
                          <TableRow
                            key={occ.id}
                            hover
                            sx={{ cursor: 'pointer' }}
                            onClick={() =>
                              router.push(`/accounting/recurring/${occ.recurringTransactionId}`)
                            }
                          >
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {occ.recurringTransactionName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Occurrence #{occ.occurrenceNumber}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={TYPE_LABELS[occ.type]}
                                color={TYPE_COLORS[occ.type]}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                variant="body2"
                                fontWeight="medium"
                                color={
                                  occ.type === 'CUSTOMER_INVOICE'
                                    ? 'success.main'
                                    : occ.type === 'VENDOR_BILL' || occ.type === 'SALARY'
                                      ? 'error.main'
                                      : 'text.primary'
                                }
                              >
                                {occ.type === 'CUSTOMER_INVOICE' ? '+' : '-'}
                                {formatCurrency(occ.finalAmount.amount, occ.finalAmount.currency)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={occ.status}
                                color={occ.status === 'PENDING' ? 'warning' : 'success'}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              );
            })}
          </>
        )}
      </Box>
    </>
  );
}
