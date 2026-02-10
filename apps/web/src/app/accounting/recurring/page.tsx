'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Box,
  Button,
  Alert,
  Chip,
  LinearProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Breadcrumbs,
  Link,
  Card,
  CardContent,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Delete as DeleteIcon,
  Home as HomeIcon,
  Repeat as RepeatIcon,
  CalendarMonth as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting, canManageAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import {
  getRecurringTransactions,
  getRecurringTransactionSummary,
  updateRecurringTransactionStatus,
  deleteRecurringTransaction,
} from '@/lib/accounting/recurringTransactionService';
import type {
  RecurringTransaction,
  RecurringTransactionType,
  RecurringTransactionSummary,
} from '@vapour/types';
import { getStatusColor } from '@vapour/ui';

const TYPE_LABELS: Record<RecurringTransactionType, string> = {
  SALARY: 'Salary',
  VENDOR_BILL: 'Vendor Bill',
  CUSTOMER_INVOICE: 'Customer Invoice',
  JOURNAL_ENTRY: 'Journal Entry',
};

const TYPE_COLORS: Record<RecurringTransactionType, 'primary' | 'secondary' | 'success' | 'info'> =
  {
    SALARY: 'secondary',
    VENDOR_BILL: 'primary',
    CUSTOMER_INVOICE: 'success',
    JOURNAL_ENTRY: 'info',
  };

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Bi-weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

export default function RecurringTransactionsPage() {
  const router = useRouter();
  const { claims, user } = useAuth();
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [summary, setSummary] = useState<RecurringTransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<RecurringTransactionType | 'ALL'>('ALL');
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    tx: RecurringTransaction;
  } | null>(null);

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;
  const hasManageAccess = claims?.permissions ? canManageAccounting(claims.permissions) : false;

  // Load data
  useEffect(() => {
    if (!hasViewAccess) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const { db } = getFirebase();
        const [txList, txSummary] = await Promise.all([
          getRecurringTransactions(db, typeFilter === 'ALL' ? undefined : { type: typeFilter }),
          getRecurringTransactionSummary(db),
        ]);
        setTransactions(txList);
        setSummary(txSummary);
      } catch (error) {
        console.error('[RecurringTransactions] Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [hasViewAccess, typeFilter]);

  const handleCreate = () => {
    router.push('/accounting/recurring/new');
  };

  const handleRowClick = (tx: RecurringTransaction) => {
    router.push(`/accounting/recurring/${tx.id}`);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, tx: RecurringTransaction) => {
    event.stopPropagation();
    setMenuAnchor({ el: event.currentTarget, tx });
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleToggleStatus = async () => {
    if (!menuAnchor || !user) return;
    const { tx } = menuAnchor;
    const { db } = getFirebase();

    try {
      const newStatus = tx.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      await updateRecurringTransactionStatus(db, tx.id, newStatus, user.uid);

      // Refresh list
      const txList = await getRecurringTransactions(
        db,
        typeFilter === 'ALL' ? undefined : { type: typeFilter }
      );
      setTransactions(txList);
    } catch (error) {
      console.error('[RecurringTransactions] Error toggling status:', error);
    }

    handleMenuClose();
  };

  const handleDelete = async () => {
    if (!menuAnchor || !user) return;
    const { tx } = menuAnchor;

    if (!confirm(`Are you sure you want to delete "${tx.name}"? This cannot be undone.`)) {
      handleMenuClose();
      return;
    }

    const { db } = getFirebase();

    try {
      await deleteRecurringTransaction(db, tx.id, user.uid, {
        userName: user.displayName || '',
        userEmail: user.email || '',
      });

      // Refresh list
      const txList = await getRecurringTransactions(
        db,
        typeFilter === 'ALL' ? undefined : { type: typeFilter }
      );
      setTransactions(txList);
    } catch (error) {
      console.error('[RecurringTransactions] Error deleting:', error);
    }

    handleMenuClose();
  };

  const formatCurrency = (amount: number, currency = 'INR') => {
    return `${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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
            Recurring Transactions
          </Typography>
          <Alert severity="error">
            You do not have permission to access recurring transactions.
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
          <Typography color="text.primary">Recurring Transactions</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Recurring Transactions
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage recurring invoices, bills, salaries, and journal entries
            </Typography>
          </Box>
          {hasManageAccess && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              Create Recurring
            </Button>
          )}
        </Box>

        {/* Summary Cards */}
        {summary && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <RepeatIcon color="primary" />
                    <Typography variant="subtitle2" color="text.secondary">
                      Active
                    </Typography>
                  </Box>
                  <Typography variant="h4">{summary.totalActive}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {summary.totalPaused} paused
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CalendarIcon color="warning" />
                    <Typography variant="subtitle2" color="text.secondary">
                      Upcoming
                    </Typography>
                  </Box>
                  <Typography variant="h4">{summary.upcomingThisWeek}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    this week / {summary.upcomingThisMonth} this month
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TrendingDownIcon color="error" />
                    <Typography variant="subtitle2" color="text.secondary">
                      Monthly Outflow
                    </Typography>
                  </Box>
                  <Typography variant="h5" color="error.main">
                    {formatCurrency(summary.monthlyOutflow.amount, summary.monthlyOutflow.currency)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    bills + salaries
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TrendingUpIcon color="success" />
                    <Typography variant="subtitle2" color="text.secondary">
                      Monthly Inflow
                    </Typography>
                  </Box>
                  <Typography variant="h5" color="success.main">
                    {formatCurrency(summary.monthlyInflow.amount, summary.monthlyInflow.currency)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    recurring invoices
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Type Filter */}
        <Box sx={{ mb: 2 }}>
          <ToggleButtonGroup
            value={typeFilter}
            exclusive
            onChange={(_, value) => value && setTypeFilter(value)}
            size="small"
          >
            <ToggleButton value="ALL">All</ToggleButton>
            <ToggleButton value="SALARY">Salaries</ToggleButton>
            <ToggleButton value="VENDOR_BILL">Bills</ToggleButton>
            <ToggleButton value="CUSTOMER_INVOICE">Invoices</ToggleButton>
            <ToggleButton value="JOURNAL_ENTRY">Journal</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {loading ? (
          <Box sx={{ mt: 4 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Loading recurring transactions...
            </Typography>
            <LinearProgress />
          </Box>
        ) : transactions.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No recurring transactions found. Create your first recurring transaction to automate
            regular invoices, bills, or salary payments.
          </Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Frequency</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Next Occurrence</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Generated</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow
                    key={tx.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(tx)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {tx.name}
                      </Typography>
                      {tx.description && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {tx.description.length > 50
                            ? `${tx.description.substring(0, 50)}...`
                            : tx.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={TYPE_LABELS[tx.type]}
                        color={TYPE_COLORS[tx.type]}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {FREQUENCY_LABELS[tx.frequency] || tx.frequency}
                      </Typography>
                      {tx.dayOfMonth && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Day {tx.dayOfMonth === 0 ? 'Last' : tx.dayOfMonth}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        color={
                          tx.type === 'CUSTOMER_INVOICE'
                            ? 'success.main'
                            : tx.type === 'VENDOR_BILL' || tx.type === 'SALARY'
                              ? 'error.main'
                              : 'text.primary'
                        }
                      >
                        {formatCurrency(tx.amount.amount, tx.amount.currency)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(tx.nextOccurrence)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={tx.status} color={getStatusColor(tx.status)} size="small" />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">{tx.totalOccurrences}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      {hasManageAccess && (
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, tx)}
                          aria-label="actions"
                        >
                          <MoreIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem
          onClick={() => {
            router.push(`/accounting/recurring/${menuAnchor?.tx.id}`);
            handleMenuClose();
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleToggleStatus}>
          {menuAnchor?.tx.status === 'ACTIVE' ? (
            <>
              <PauseIcon fontSize="small" sx={{ mr: 1 }} />
              Pause
            </>
          ) : (
            <>
              <PlayIcon fontSize="small" sx={{ mr: 1 }} />
              Resume
            </>
          )}
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}
