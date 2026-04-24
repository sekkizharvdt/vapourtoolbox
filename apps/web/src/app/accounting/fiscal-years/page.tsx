'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
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
  Skeleton,
} from '@mui/material';
import {
  Star as CurrentIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Lock as LockIcon,
  LockOpen as OpenIcon,
  CheckCircle as ClosedIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { PageHeader } from '@vapour/ui';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { useAuth } from '@/contexts/AuthContext';
import { canManageAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import {
  getAvailableFiscalYears,
  getAccountingPeriods,
  closePeriod,
  lockPeriod,
  reopenPeriod,
} from '@/lib/accounting/fiscalYearService';
import type { FiscalYear, AccountingPeriod } from '@vapour/types';

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

export default function FiscalYearsPage() {
  const { user, claims } = useAuth();
  const hasManageAccess = claims?.permissions ? canManageAccounting(claims.permissions) : false;

  const [loading, setLoading] = useState(true);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [expandedFY, setExpandedFY] = useState<string | null>(null);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [periodNotes, setPeriodNotes] = useState('');
  const [periodActionDialog, setPeriodActionDialog] = useState<{
    type: 'close' | 'lock' | 'reopen';
    fiscalYearId: string;
    periodNumber: number;
    periodName: string;
  } | null>(null);

  const loadFiscalYears = useCallback(async () => {
    try {
      setLoading(true);
      const { db } = getFirebase();
      setFiscalYears(await getAvailableFiscalYears(db));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fiscal years');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiscalYears();
  }, [loadFiscalYears]);

  const reloadPeriods = useCallback(async (fyId: string) => {
    const { db } = getFirebase();
    setPeriods(await getAccountingPeriods(db, fyId));
  }, []);

  const handleExpandFY = async (fyId: string) => {
    if (expandedFY === fyId) {
      setExpandedFY(null);
      setPeriods([]);
      return;
    }
    setExpandedFY(fyId);
    setLoadingPeriods(true);
    try {
      await reloadPeriods(fyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load periods');
    } finally {
      setLoadingPeriods(false);
    }
  };

  const handlePeriodAction = async () => {
    if (!user || !periodActionDialog) return;
    const actionKey = `${periodActionDialog.fiscalYearId}-${periodActionDialog.periodNumber}`;
    setActionLoading(actionKey);
    setError(null);

    try {
      const { db } = getFirebase();
      const { fiscalYearId, periodNumber, type } = periodActionDialog;
      const tenantId = claims?.tenantId || 'default-entity';
      switch (type) {
        case 'close':
          await closePeriod(db, fiscalYearId, periodNumber, user.uid, tenantId, periodNotes);
          break;
        case 'lock':
          await lockPeriod(
            db,
            fiscalYearId,
            periodNumber,
            user.uid,
            tenantId,
            periodNotes || 'Period locked'
          );
          break;
        case 'reopen':
          await reopenPeriod(
            db,
            fiscalYearId,
            periodNumber,
            user.uid,
            tenantId,
            periodNotes || 'Period reopened'
          );
          break;
      }

      setPeriodActionDialog(null);
      setPeriodNotes('');
      setSuccess(
        `Period "${periodActionDialog.periodName}" ${type === 'close' ? 'closed' : type === 'lock' ? 'locked' : 'reopened'} successfully`
      );

      if (expandedFY) await reloadPeriods(expandedFY);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${periodActionDialog.type} period`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Accounting', href: '/accounting', icon: <HomeIcon fontSize="small" /> },
          { label: 'Fiscal Years' },
        ]}
      />

      <PageHeader
        title="Fiscal Years"
        subtitle="Indian fiscal years (Apr–Mar) are derived from your transaction dates. Close or lock individual months here."
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
                No fiscal years yet
              </Typography>
              <Typography color="text.secondary">
                Fiscal years will appear here once you post transactions.
              </Typography>
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
                <TableCell>Current</TableCell>
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
                      <IconButton size="small" aria-label="Expand periods">
                        {expandedFY === fy.id ? <CollapseIcon /> : <ExpandIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{fy.name}</Typography>
                    </TableCell>
                    <TableCell>{formatDate(fy.startDate)}</TableCell>
                    <TableCell>{formatDate(fy.endDate)}</TableCell>
                    <TableCell>
                      {fy.isCurrent ? (
                        <Chip label="Current" color="primary" size="small" icon={<CurrentIcon />} />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          &mdash;
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedFY === fy.id && (
                    <TableRow key={`${fy.id}-periods`}>
                      <TableCell colSpan={5} sx={{ py: 0 }}>
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
                                    <TableCell>Start</TableCell>
                                    <TableCell>End</TableCell>
                                    <TableCell>Status</TableCell>
                                    {hasManageAccess && (
                                      <TableCell align="right">Actions</TableCell>
                                    )}
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {periods.map((period) => {
                                    const actionKey = `${fy.id}-${period.periodNumber}`;
                                    const isBusy = actionLoading === actionKey;
                                    return (
                                      <TableRow key={period.id}>
                                        <TableCell>{period.periodNumber}</TableCell>
                                        <TableCell>{period.name}</TableCell>
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
                                                  disabled={isBusy}
                                                  onClick={() =>
                                                    setPeriodActionDialog({
                                                      type: 'close',
                                                      fiscalYearId: fy.id,
                                                      periodNumber: period.periodNumber,
                                                      periodName: period.name,
                                                    })
                                                  }
                                                  aria-label="Close period"
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
                                                    disabled={isBusy}
                                                    onClick={() =>
                                                      setPeriodActionDialog({
                                                        type: 'lock',
                                                        fiscalYearId: fy.id,
                                                        periodNumber: period.periodNumber,
                                                        periodName: period.name,
                                                      })
                                                    }
                                                    aria-label="Lock period"
                                                  >
                                                    <LockIcon fontSize="small" />
                                                  </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Reopen period">
                                                  <IconButton
                                                    size="small"
                                                    color="success"
                                                    disabled={isBusy}
                                                    onClick={() =>
                                                      setPeriodActionDialog({
                                                        type: 'reopen',
                                                        fiscalYearId: fy.id,
                                                        periodNumber: period.periodNumber,
                                                        periodName: period.name,
                                                      })
                                                    }
                                                    aria-label="Reopen period"
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
                                    );
                                  })}
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
