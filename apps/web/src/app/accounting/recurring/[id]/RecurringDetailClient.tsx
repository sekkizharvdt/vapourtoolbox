'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Typography,
  Box,
  Breadcrumbs,
  Link,
  Alert,
  Paper,
  Grid,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Home as HomeIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  SkipNext as SkipIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting, canManageAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import {
  getRecurringTransaction,
  getOccurrencesForTransaction,
  updateRecurringTransactionStatus,
  deleteRecurringTransaction,
  skipOccurrence,
} from '@/lib/accounting/recurringTransactionService';
import type { RecurringTransaction, RecurringOccurrence } from '@vapour/types';

const TYPE_LABELS: Record<string, string> = {
  SALARY: 'Salary',
  VENDOR_BILL: 'Vendor Bill',
  CUSTOMER_INVOICE: 'Customer Invoice',
  JOURNAL_ENTRY: 'Journal Entry',
};

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Bi-weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'default' | 'error' | 'info'> = {
  PENDING: 'warning',
  GENERATED: 'success',
  SKIPPED: 'default',
  MODIFIED: 'info',
  FAILED: 'error',
};

export default function RecurringDetailClient() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { claims, user } = useAuth();
  const [transaction, setTransaction] = useState<RecurringTransaction | null>(null);
  const [occurrences, setOccurrences] = useState<RecurringOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [skipOccurrenceId, setSkipOccurrenceId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;
  const hasManageAccess = claims?.permissions ? canManageAccounting(claims.permissions) : false;

  useEffect(() => {
    if (!hasViewAccess) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const { db } = getFirebase();
        const [tx, occ] = await Promise.all([
          getRecurringTransaction(db, id),
          getOccurrencesForTransaction(db, id),
        ]);
        setTransaction(tx);
        setOccurrences(occ);
      } catch (error) {
        console.error('[RecurringDetail] Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, hasViewAccess]);

  const handleToggleStatus = async () => {
    if (!transaction || !user) return;
    const { db } = getFirebase();

    try {
      const newStatus = transaction.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      await updateRecurringTransactionStatus(db, transaction.id, newStatus, user.uid);

      // Refresh
      const tx = await getRecurringTransaction(db, id);
      setTransaction(tx);
    } catch (error) {
      console.error('[RecurringDetail] Error toggling status:', error);
    }
  };

  const handleDelete = async () => {
    if (!transaction || !user) return;

    if (
      !confirm(`Are you sure you want to delete "${transaction.name}"? This cannot be undone.`)
    ) {
      return;
    }

    const { db } = getFirebase();

    try {
      await deleteRecurringTransaction(db, transaction.id, user.uid);
      router.push('/accounting/recurring');
    } catch (error) {
      console.error('[RecurringDetail] Error deleting:', error);
    }
  };

  const handleSkipOccurrence = (occurrenceId: string) => {
    setSkipOccurrenceId(occurrenceId);
    setSkipReason('');
    setSkipDialogOpen(true);
  };

  const confirmSkipOccurrence = async () => {
    if (!skipOccurrenceId || !user) return;

    const { db } = getFirebase();

    try {
      await skipOccurrence(db, skipOccurrenceId, skipReason, user.uid);

      // Refresh occurrences
      const occ = await getOccurrencesForTransaction(db, id);
      setOccurrences(occ);
    } catch (error) {
      console.error('[RecurringDetail] Error skipping occurrence:', error);
    } finally {
      setSkipDialogOpen(false);
      setSkipOccurrenceId(null);
      setSkipReason('');
    }
  };

  const formatCurrency = (amount: number, currency = 'INR') => {
    return `${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  };

  const formatDate = (timestamp: { toDate: () => Date } | undefined) => {
    if (!timestamp) return '-';
    return timestamp.toDate().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (!hasViewAccess) {
    return (
      <>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Recurring Transaction
          </Typography>
          <Alert severity="error">
            You do not have permission to view recurring transactions.
          </Alert>
        </Box>
      </>
    );
  }

  if (loading) {
    return (
      <Box sx={{ mt: 4 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Loading...
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (!transaction) {
    return (
      <>
        <Box sx={{ mb: 4 }}>
          <Alert severity="error">Recurring transaction not found.</Alert>
          <Button
            variant="outlined"
            sx={{ mt: 2 }}
            onClick={() => router.push('/accounting/recurring')}
          >
            Back to List
          </Button>
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
          <Typography color="text.primary">{transaction.name}</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {transaction.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Chip
                label={TYPE_LABELS[transaction.type]}
                color="primary"
                variant="outlined"
                size="small"
              />
              <Chip
                label={transaction.status}
                color={
                  transaction.status === 'ACTIVE'
                    ? 'success'
                    : transaction.status === 'PAUSED'
                      ? 'warning'
                      : 'default'
                }
                size="small"
              />
              <Chip label={FREQUENCY_LABELS[transaction.frequency]} size="small" variant="outlined" />
            </Box>
          </Box>

          {hasManageAccess && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={transaction.status === 'ACTIVE' ? <PauseIcon /> : <PlayIcon />}
                onClick={handleToggleStatus}
              >
                {transaction.status === 'ACTIVE' ? 'Pause' : 'Resume'}
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </Box>
          )}
        </Box>

        {/* Details */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Details
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Amount
                  </Typography>
                  <Typography variant="h5">
                    {formatCurrency(transaction.amount.amount, transaction.amount.currency)}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Frequency
                  </Typography>
                  <Typography variant="body1">
                    {FREQUENCY_LABELS[transaction.frequency]}
                    {transaction.dayOfMonth !== undefined && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Day {transaction.dayOfMonth === 0 ? 'Last' : transaction.dayOfMonth} of month
                      </Typography>
                    )}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Start Date
                  </Typography>
                  <Typography variant="body1">{formatDate(transaction.startDate)}</Typography>
                </Grid>

                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    End Date
                  </Typography>
                  <Typography variant="body1">
                    {transaction.endDate ? formatDate(transaction.endDate) : 'No end date'}
                  </Typography>
                </Grid>

                {transaction.description && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body2">{transaction.description}</Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Schedule & Automation
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Next Occurrence
                  </Typography>
                  <Typography variant="h6" color="primary.main">
                    {formatDate(transaction.nextOccurrence)}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Total Generated
                  </Typography>
                  <Typography variant="h6">{transaction.totalOccurrences}</Typography>
                </Grid>

                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Auto-generate
                  </Typography>
                  <Typography variant="body1">
                    {transaction.autoGenerate ? 'Yes' : 'No'}
                    {transaction.autoGenerate && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {transaction.daysBeforeToGenerate} days before
                      </Typography>
                    )}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Requires Approval
                  </Typography>
                  <Typography variant="body1">
                    {transaction.requiresApproval ? 'Yes' : 'No'}
                  </Typography>
                </Grid>

                {transaction.lastGeneratedAt && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">
                      Last Generated
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(transaction.lastGeneratedAt)}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>
        </Grid>

        {/* Occurrences */}
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Occurrences
            </Typography>
          </Box>

          {occurrences.length === 0 ? (
            <Alert severity="info">No occurrences generated yet.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Scheduled Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Transaction</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {occurrences.map((occ) => (
                    <TableRow key={occ.id}>
                      <TableCell>{occ.occurrenceNumber}</TableCell>
                      <TableCell>{formatDate(occ.scheduledDate)}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(occ.finalAmount.amount, occ.finalAmount.currency)}
                        {occ.status === 'MODIFIED' &&
                          occ.finalAmount.amount !== occ.originalAmount.amount && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              sx={{ textDecoration: 'line-through' }}
                            >
                              {formatCurrency(
                                occ.originalAmount.amount,
                                occ.originalAmount.currency
                              )}
                            </Typography>
                          )}
                      </TableCell>
                      <TableCell>
                        <Chip label={occ.status} color={STATUS_COLORS[occ.status]} size="small" />
                        {occ.skipReason && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {occ.skipReason}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {occ.generatedTransactionNumber ? (
                          <Typography variant="body2">{occ.generatedTransactionNumber}</Typography>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {occ.status === 'PENDING' && hasManageAccess && (
                          <Tooltip title="Skip this occurrence">
                            <IconButton size="small" onClick={() => handleSkipOccurrence(occ.id)}>
                              <SkipIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Skip Dialog */}
      <Dialog open={skipDialogOpen} onClose={() => setSkipDialogOpen(false)}>
        <DialogTitle>Skip Occurrence</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Are you sure you want to skip this occurrence? Please provide a reason.
          </Typography>
          <TextField
            fullWidth
            label="Reason"
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSkipDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmSkipOccurrence} variant="contained" disabled={!skipReason.trim()}>
            Skip
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
