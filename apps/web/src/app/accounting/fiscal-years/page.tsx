'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Collapse,
  Breadcrumbs,
  Link,
  Skeleton,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Star as CurrentIcon,
  StarBorder as SetCurrentIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Lock as LockIcon,
  LockOpen as OpenIcon,
  CheckCircle as ClosedIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { canManageAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import {
  getAllFiscalYears,
  createFiscalYear,
  setCurrentFiscalYear,
  getAccountingPeriods,
  closePeriod,
  lockPeriod,
  reopenPeriod,
} from '@/lib/accounting/fiscalYearService';
import type { FiscalYear, AccountingPeriod } from '@vapour/types';

/** Convert Firestore Timestamp or Date to JS Date */
function toDate(val: unknown): Date {
  if (val && typeof val === 'object' && 'toDate' in val) {
    return (val as { toDate: () => Date }).toDate();
  }
  return val instanceof Date ? val : new Date(val as string);
}

function formatDate(val: unknown): string {
  return toDate(val).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusChip(status: string) {
  switch (status) {
    case 'OPEN':
      return <Chip label="Open" color="success" size="small" />;
    case 'CLOSED':
      return <Chip label="Closed" color="warning" size="small" />;
    case 'LOCKED':
      return <Chip label="Locked" color="error" size="small" />;
    default:
      return <Chip label={status} size="small" />;
  }
}

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function FiscalYearsPage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const hasManageAccess = claims?.permissions ? canManageAccounting(claims.permissions) : false;

  const [loading, setLoading] = useState(true);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFYStartMonth, setNewFYStartMonth] = useState(4); // April default
  const [newFYYear, setNewFYYear] = useState(() => {
    const now = new Date();
    // If we're past the start month, use current year; otherwise previous year
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  });
  const [newFYIsCurrent] = useState(true);

  // Expanded FY periods
  const [expandedFY, setExpandedFY] = useState<string | null>(null);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  // Period action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [periodNotes, setPeriodNotes] = useState('');
  const [periodActionDialog, setPeriodActionDialog] = useState<{
    type: 'close' | 'lock' | 'reopen';
    periodId: string;
    periodName: string;
  } | null>(null);

  const loadFiscalYears = useCallback(async () => {
    try {
      setLoading(true);
      const { db } = getFirebase();
      const fys = await getAllFiscalYears(db);
      setFiscalYears(fys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fiscal years');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiscalYears();
  }, [loadFiscalYears]);

  const handleExpandFY = async (fyId: string) => {
    if (expandedFY === fyId) {
      setExpandedFY(null);
      setPeriods([]);
      return;
    }

    setExpandedFY(fyId);
    setLoadingPeriods(true);
    try {
      const { db } = getFirebase();
      const p = await getAccountingPeriods(db, fyId);
      setPeriods(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load periods');
    } finally {
      setLoadingPeriods(false);
    }
  };

  const handleCreateFY = async () => {
    if (!user) return;
    setCreating(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const startDate = new Date(newFYYear, newFYStartMonth - 1, 1);
      const endYear = newFYStartMonth === 1 ? newFYYear : newFYYear + 1;
      const endMonth = newFYStartMonth === 1 ? 12 : newFYStartMonth - 1;
      const endDate = new Date(endYear, endMonth, 0); // last day of the month before start month next year

      const name =
        newFYStartMonth === 1 ? `FY ${newFYYear}` : `FY ${newFYYear}-${String(endYear).slice(2)}`;

      await createFiscalYear(db, {
        name,
        startDate,
        endDate,
        isCurrent: newFYIsCurrent,
        userId: user.uid,
      });

      setCreateOpen(false);
      setSuccess(`Fiscal year "${name}" created with 12 accounting periods`);
      await loadFiscalYears();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create fiscal year');
    } finally {
      setCreating(false);
    }
  };

  const handleSetCurrent = async (fyId: string) => {
    if (!user) return;
    try {
      const { db } = getFirebase();
      await setCurrentFiscalYear(db, fyId, user.uid);
      setSuccess('Fiscal year set as current');
      await loadFiscalYears();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set current fiscal year');
    }
  };

  const handlePeriodAction = async () => {
    if (!user || !periodActionDialog) return;
    setActionLoading(periodActionDialog.periodId);
    setError(null);

    try {
      const { db } = getFirebase();
      switch (periodActionDialog.type) {
        case 'close':
          await closePeriod(db, periodActionDialog.periodId, user.uid, periodNotes);
          break;
        case 'lock':
          await lockPeriod(
            db,
            periodActionDialog.periodId,
            user.uid,
            periodNotes || 'Period locked'
          );
          break;
        case 'reopen':
          await reopenPeriod(
            db,
            periodActionDialog.periodId,
            user.uid,
            periodNotes || 'Period reopened'
          );
          break;
      }

      setPeriodActionDialog(null);
      setPeriodNotes('');
      setSuccess(
        `Period "${periodActionDialog.periodName}" ${periodActionDialog.type === 'close' ? 'closed' : periodActionDialog.type === 'lock' ? 'locked' : 'reopened'} successfully`
      );

      // Reload periods
      if (expandedFY) {
        const { db: db2 } = getFirebase();
        const p = await getAccountingPeriods(db2, expandedFY);
        setPeriods(p);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${periodActionDialog.type} period`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          underline="hover"
          color="inherit"
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => router.push('/accounting')}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Accounting
        </Link>
        <Typography color="text.primary">Fiscal Years</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Fiscal Years"
        subtitle="Manage fiscal years, accounting periods, and year-end closing"
        action={
          hasManageAccess ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Create Fiscal Year
            </Button>
          ) : undefined
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {loading ? (
        <Card>
          <CardContent>
            <Skeleton variant="rectangular" height={200} />
          </CardContent>
        </Card>
      ) : fiscalYears.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Fiscal Years Created
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Create your first fiscal year to start managing accounting periods.
              </Typography>
              {hasManageAccess && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateOpen(true)}
                >
                  Create Fiscal Year
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>Name</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Current</TableCell>
                <TableCell>Closing Stage</TableCell>
                {hasManageAccess && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {fiscalYears.map((fy) => (
                <>
                  <TableRow
                    key={fy.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleExpandFY(fy.id)}
                  >
                    <TableCell>
                      <IconButton size="small">
                        {expandedFY === fy.id ? <CollapseIcon /> : <ExpandIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{fy.name}</Typography>
                    </TableCell>
                    <TableCell>{formatDate(fy.startDate)}</TableCell>
                    <TableCell>{formatDate(fy.endDate)}</TableCell>
                    <TableCell>{getStatusChip(fy.status)}</TableCell>
                    <TableCell>
                      {fy.isCurrent ? (
                        <Chip label="Current" color="primary" size="small" icon={<CurrentIcon />} />
                      ) : (
                        hasManageAccess &&
                        fy.status === 'OPEN' && (
                          <Tooltip title="Set as current fiscal year">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetCurrent(fy.id);
                              }}
                            >
                              <SetCurrentIcon />
                            </IconButton>
                          </Tooltip>
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      {fy.closingStage ? (
                        <Chip
                          label={fy.closingStage === 'PROVISIONAL' ? 'Provisional' : 'Final'}
                          color={fy.closingStage === 'FINAL' ? 'error' : 'warning'}
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          &mdash;
                        </Typography>
                      )}
                    </TableCell>
                    {hasManageAccess && <TableCell align="right" />}
                  </TableRow>
                  {expandedFY === fy.id && (
                    <TableRow key={`${fy.id}-periods`}>
                      <TableCell colSpan={hasManageAccess ? 8 : 7} sx={{ py: 0 }}>
                        <Collapse in={expandedFY === fy.id} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, px: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Accounting Periods
                            </Typography>
                            {loadingPeriods ? (
                              <Skeleton variant="rectangular" height={100} />
                            ) : (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>#</TableCell>
                                    <TableCell>Period</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Start</TableCell>
                                    <TableCell>End</TableCell>
                                    <TableCell>Status</TableCell>
                                    {hasManageAccess && (
                                      <TableCell align="right">Actions</TableCell>
                                    )}
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {periods.map((period) => (
                                    <TableRow key={period.id}>
                                      <TableCell>{period.periodNumber}</TableCell>
                                      <TableCell>{period.name}</TableCell>
                                      <TableCell>
                                        <Chip
                                          label={period.periodType}
                                          size="small"
                                          variant="outlined"
                                          color={
                                            period.periodType === 'ADJUSTMENT'
                                              ? 'warning'
                                              : 'default'
                                          }
                                        />
                                      </TableCell>
                                      <TableCell>{formatDate(period.startDate)}</TableCell>
                                      <TableCell>{formatDate(period.endDate)}</TableCell>
                                      <TableCell>{getStatusChip(period.status)}</TableCell>
                                      {hasManageAccess && (
                                        <TableCell align="right">
                                          {period.status === 'OPEN' && (
                                            <Tooltip title="Close period">
                                              <IconButton
                                                size="small"
                                                color="warning"
                                                disabled={actionLoading === period.id}
                                                onClick={() =>
                                                  setPeriodActionDialog({
                                                    type: 'close',
                                                    periodId: period.id,
                                                    periodName: period.name,
                                                  })
                                                }
                                              >
                                                <ClosedIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                          {period.status === 'CLOSED' && (
                                            <>
                                              <Tooltip title="Lock period">
                                                <IconButton
                                                  size="small"
                                                  color="error"
                                                  disabled={actionLoading === period.id}
                                                  onClick={() =>
                                                    setPeriodActionDialog({
                                                      type: 'lock',
                                                      periodId: period.id,
                                                      periodName: period.name,
                                                    })
                                                  }
                                                >
                                                  <LockIcon fontSize="small" />
                                                </IconButton>
                                              </Tooltip>
                                              <Tooltip title="Reopen period">
                                                <IconButton
                                                  size="small"
                                                  color="success"
                                                  disabled={actionLoading === period.id}
                                                  onClick={() =>
                                                    setPeriodActionDialog({
                                                      type: 'reopen',
                                                      periodId: period.id,
                                                      periodName: period.name,
                                                    })
                                                  }
                                                >
                                                  <OpenIcon fontSize="small" />
                                                </IconButton>
                                              </Tooltip>
                                            </>
                                          )}
                                          {period.status === 'LOCKED' && (
                                            <Typography variant="caption" color="text.secondary">
                                              Locked
                                            </Typography>
                                          )}
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create Fiscal Year Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Fiscal Year</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                select
                label="Start Month"
                value={newFYStartMonth}
                onChange={(e) => setNewFYStartMonth(Number(e.target.value))}
                helperText="The month your fiscal year begins"
              >
                {MONTHS.map((m) => (
                  <MenuItem key={m.value} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Start Year"
                value={newFYYear}
                onChange={(e) => setNewFYYear(Number(e.target.value))}
                helperText="Calendar year the FY starts in"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Alert severity="info">
                {newFYStartMonth === 1
                  ? `This will create FY ${newFYYear} (Jan ${newFYYear} \u2013 Dec ${newFYYear})`
                  : `This will create FY ${newFYYear}-${String(newFYStartMonth === 1 ? newFYYear : newFYYear + 1).slice(2)} (${MONTHS[newFYStartMonth - 1]?.label} ${newFYYear} \u2013 ${MONTHS[(newFYStartMonth - 2 + 12) % 12]?.label} ${newFYStartMonth === 1 ? newFYYear : newFYYear + 1})`}{' '}
                with 12 monthly accounting periods, all set to Open.
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateFY} disabled={creating}>
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Period Action Dialog */}
      <Dialog
        open={!!periodActionDialog}
        onClose={() => {
          setPeriodActionDialog(null);
          setPeriodNotes('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {periodActionDialog?.type === 'close' && 'Close Period'}
          {periodActionDialog?.type === 'lock' && 'Lock Period'}
          {periodActionDialog?.type === 'reopen' && 'Reopen Period'}
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            {periodActionDialog?.type === 'close' &&
              `Close "${periodActionDialog.periodName}"? No more transactions can be posted to this period.`}
            {periodActionDialog?.type === 'lock' &&
              `Lock "${periodActionDialog.periodName}"? This prevents reopening. Only use this after year-end closing.`}
            {periodActionDialog?.type === 'reopen' &&
              `Reopen "${periodActionDialog.periodName}"? This allows transactions to be posted again.`}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={2}
            label={periodActionDialog?.type === 'lock' ? 'Reason (required)' : 'Notes (optional)'}
            value={periodNotes}
            onChange={(e) => setPeriodNotes(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPeriodActionDialog(null);
              setPeriodNotes('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color={
              periodActionDialog?.type === 'lock'
                ? 'error'
                : periodActionDialog?.type === 'reopen'
                  ? 'success'
                  : 'warning'
            }
            onClick={handlePeriodAction}
            disabled={
              actionLoading !== null || (periodActionDialog?.type === 'lock' && !periodNotes.trim())
            }
          >
            {periodActionDialog?.type === 'close' && 'Close'}
            {periodActionDialog?.type === 'lock' && 'Lock'}
            {periodActionDialog?.type === 'reopen' && 'Reopen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
