'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Paper,
  IconButton,
  Collapse,
  Skeleton,
} from '@mui/material';
import {
  Star as CurrentIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { PageHeader, StatusChip } from '@vapour/ui';
import {
  canManageAccounting,
  ACCOUNTING_PERIOD_STATUS_LABELS,
  YEAR_END_CLOSING_STATUS_LABELS,
} from '@vapour/constants';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { getFirebase } from '@/lib/firebase';
import { retryOnStaleToken } from '@/lib/firebase/retryOnStaleToken';
import {
  getAvailableFiscalYears,
  getAccountingPeriods,
  closePeriod,
  lockPeriod,
  reopenPeriod,
} from '@/lib/accounting/fiscalYearService';
import {
  checkYearEndClosingReadiness,
  previewYearEndClosing,
  executeYearEndClosing,
  reverseYearEndClosing,
  getYearEndClosingHistory,
  type YearEndClosingReadiness,
  type YearEndClosingPreview,
} from '@/lib/accounting/yearEndClosingService';
import type { FiscalYear, AccountingPeriod, YearEndClosingEntry } from '@vapour/types';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';

type PeriodDialogAction = 'CLOSE' | 'REOPEN';

export default function FiscalYearsPage() {
  const { user, claims } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();

  const hasManage = claims?.permissions ? canManageAccounting(claims.permissions) : false;
  const tenantId = claims?.tenantId || 'default-entity';

  const [loading, setLoading] = useState(true);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [expandedFY, setExpandedFY] = useState<string | null>(null);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  // Per-period close/reopen dialog
  const [periodDialog, setPeriodDialog] = useState<{
    action: PeriodDialogAction;
    period: AccountingPeriod;
  } | null>(null);
  const [periodDialogText, setPeriodDialogText] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // Year-end closing
  const [closingHistory, setClosingHistory] = useState<YearEndClosingEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [yeFy, setYeFy] = useState<FiscalYear | null>(null);
  const [yeStep, setYeStep] = useState<'readiness' | 'preview'>('readiness');
  const [yeLoading, setYeLoading] = useState(false);
  const [readiness, setReadiness] = useState<YearEndClosingReadiness | null>(null);
  const [preview, setPreview] = useState<YearEndClosingPreview | null>(null);
  const [yeNotes, setYeNotes] = useState('');
  const [reverseTarget, setReverseTarget] = useState<YearEndClosingEntry | null>(null);
  const [reverseReason, setReverseReason] = useState('');

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
    setLoadingPeriods(true);
    try {
      const { db } = getFirebase();
      setPeriods(await getAccountingPeriods(db, fyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load periods');
    } finally {
      setLoadingPeriods(false);
    }
  }, []);

  const loadClosingHistory = useCallback(async (fyId: string) => {
    setLoadingHistory(true);
    try {
      const { db } = getFirebase();
      setClosingHistory(await getYearEndClosingHistory(db, fyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load year-end closing history');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const handleExpandFY = async (fyId: string) => {
    if (expandedFY === fyId) {
      setExpandedFY(null);
      setPeriods([]);
      setClosingHistory([]);
      return;
    }
    setExpandedFY(fyId);
    setPeriods([]);
    setClosingHistory([]);
    await Promise.all([reloadPeriods(fyId), loadClosingHistory(fyId)]);
  };

  // -------------------------------------------------------------------------
  // Period actions
  // -------------------------------------------------------------------------

  const openPeriodDialog = (action: PeriodDialogAction, period: AccountingPeriod) => {
    setPeriodDialog({ action, period });
    setPeriodDialogText('');
  };

  const handlePeriodDialogSubmit = async () => {
    if (!periodDialog || !user) return;
    const { action, period } = periodDialog;
    const text = (periodDialogText ?? '').trim();
    if (action === 'REOPEN' && !text) return;

    setActionBusy(true);
    try {
      const { db } = getFirebase();
      if (action === 'CLOSE') {
        await retryOnStaleToken(() =>
          closePeriod(
            db,
            period.fiscalYearId,
            period.periodNumber,
            user.uid,
            tenantId,
            text || undefined
          )
        );
        toast.success(`${period.name} closed`);
      } else {
        await retryOnStaleToken(() =>
          reopenPeriod(db, period.fiscalYearId, period.periodNumber, user.uid, tenantId, text)
        );
        toast.success(`${period.name} reopened`);
      }
      setPeriodDialog(null);
      setPeriodDialogText('');
      await reloadPeriods(period.fiscalYearId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(false);
    }
  };

  const handleLockPeriod = async (period: AccountingPeriod) => {
    if (!user) return;
    const confirmed = await confirm({
      title: 'Lock Period',
      message: `Lock ${period.name}? Locked periods cannot be reopened from this page — contact a super admin to unlock.`,
      confirmText: 'Lock',
      confirmColor: 'error',
    });
    if (!confirmed) return;

    setActionBusy(true);
    try {
      const { db } = getFirebase();
      await retryOnStaleToken(() =>
        lockPeriod(
          db,
          period.fiscalYearId,
          period.periodNumber,
          user.uid,
          tenantId,
          'Period locked from Fiscal Years page'
        )
      );
      toast.success(`${period.name} locked`);
      await reloadPeriods(period.fiscalYearId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Year-end closing
  // -------------------------------------------------------------------------

  const openYearEndDialog = async (fy: FiscalYear) => {
    setYeFy(fy);
    setYeStep('readiness');
    setReadiness(null);
    setPreview(null);
    setYeNotes('');
    setYeLoading(true);
    try {
      const { db } = getFirebase();
      setReadiness(await retryOnStaleToken(() => checkYearEndClosingReadiness(db, fy.id)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setYeLoading(false);
    }
  };

  const handleYearEndPreview = async () => {
    if (!yeFy) return;
    setYeLoading(true);
    try {
      const { db } = getFirebase();
      setPreview(await retryOnStaleToken(() => previewYearEndClosing(db, yeFy.id)));
      setYeStep('preview');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setYeLoading(false);
    }
  };

  const handleYearEndExecute = async () => {
    if (!yeFy || !user || !preview) return;
    const confirmed = await confirm({
      title: 'Execute Year-End Close',
      message:
        `This will post a closing journal entry for ${yeFy.name}, zero out all income and ` +
        `expense accounts, and transfer net ${preview.netIncome >= 0 ? 'profit' : 'loss'} of ` +
        `${formatCurrency(Math.abs(preview.netIncome))} to ${preview.retainedEarningsAccount.name}.`,
      confirmText: 'Execute Close',
      confirmColor: 'error',
    });
    if (!confirmed) return;

    setYeLoading(true);
    try {
      const { db } = getFirebase();
      const notes = (yeNotes ?? '').trim();
      const result = await retryOnStaleToken(() =>
        executeYearEndClosing(db, {
          fiscalYearId: yeFy.id,
          userId: user.uid,
          userName: user.displayName || user.email || user.uid,
          ...(notes && { notes }),
          entityId: tenantId,
          tenantId,
        })
      );
      if (result.success) {
        toast.success(
          `Year-end close posted (${result.journalEntryNumber}) — net income ${formatCurrency(result.netIncome ?? 0)}`
        );
        setYeFy(null);
        await loadClosingHistory(yeFy.id);
      } else {
        toast.error(result.error || 'Year-end closing failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setYeLoading(false);
    }
  };

  const handleReverseSubmit = async () => {
    if (!reverseTarget || !user) return;
    const reason = (reverseReason ?? '').trim();
    if (!reason) return;

    setActionBusy(true);
    try {
      const { db } = getFirebase();
      const result = await retryOnStaleToken(() =>
        reverseYearEndClosing(
          db,
          reverseTarget.id,
          user.uid,
          user.displayName || user.email || user.uid,
          reason,
          tenantId
        )
      );
      if (result.success) {
        toast.success(`Year-end closing for ${reverseTarget.fiscalYearName} reversed`);
        setReverseTarget(null);
        setReverseReason('');
        await loadClosingHistory(reverseTarget.fiscalYearId);
      } else {
        toast.error(result.error || 'Failed to reverse year-end closing');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(false);
    }
  };

  const hasPostedClosing = closingHistory.some((h) => h.status === 'POSTED');

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
        subtitle="Indian fiscal years (Apr–Mar) are derived from your transaction dates."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
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
                <Fragment key={fy.id}>
                  <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => handleExpandFY(fy.id)}>
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
                    <TableRow>
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
                                    {hasManage && <TableCell align="right">Actions</TableCell>}
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {periods.map((period) => (
                                    <TableRow key={period.id}>
                                      <TableCell>{period.periodNumber}</TableCell>
                                      <TableCell>{period.name}</TableCell>
                                      <TableCell>{formatDate(period.startDate)}</TableCell>
                                      <TableCell>{formatDate(period.endDate)}</TableCell>
                                      <TableCell>
                                        <StatusChip
                                          status={period.status}
                                          labels={ACCOUNTING_PERIOD_STATUS_LABELS}
                                          context="accountingPeriod"
                                        />
                                      </TableCell>
                                      {hasManage && (
                                        <TableCell align="right">
                                          <Stack
                                            direction="row"
                                            spacing={1}
                                            justifyContent="flex-end"
                                          >
                                            {period.status === 'OPEN' && (
                                              <Button
                                                size="small"
                                                variant="outlined"
                                                disabled={actionBusy}
                                                onClick={() => openPeriodDialog('CLOSE', period)}
                                              >
                                                Close
                                              </Button>
                                            )}
                                            {period.status === 'CLOSED' && (
                                              <>
                                                <Button
                                                  size="small"
                                                  variant="outlined"
                                                  color="error"
                                                  disabled={actionBusy}
                                                  onClick={() => handleLockPeriod(period)}
                                                >
                                                  Lock
                                                </Button>
                                                <Button
                                                  size="small"
                                                  variant="outlined"
                                                  disabled={actionBusy}
                                                  onClick={() => openPeriodDialog('REOPEN', period)}
                                                >
                                                  Reopen
                                                </Button>
                                              </>
                                            )}
                                            {period.status === 'LOCKED' && (
                                              <Typography variant="caption" color="text.secondary">
                                                &mdash;
                                              </Typography>
                                            )}
                                          </Stack>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}

                            <Divider sx={{ my: 2 }} />

                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                              sx={{ mb: 1 }}
                            >
                              <Typography variant="subtitle2">Year-End Closing</Typography>
                              {hasManage && !hasPostedClosing && !loadingHistory && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => openYearEndDialog(fy)}
                                >
                                  Start Year-End Close
                                </Button>
                              )}
                            </Stack>
                            {loadingHistory ? (
                              <Skeleton variant="rectangular" height={60} />
                            ) : closingHistory.length === 0 ? (
                              <Typography variant="body2" color="text.secondary">
                                No year-end closing has been run for this fiscal year.
                              </Typography>
                            ) : (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Closing Date</TableCell>
                                    <TableCell>Journal #</TableCell>
                                    <TableCell align="right">Revenue</TableCell>
                                    <TableCell align="right">Expenses</TableCell>
                                    <TableCell align="right">Net Income</TableCell>
                                    <TableCell>Status</TableCell>
                                    {hasManage && <TableCell align="right">Actions</TableCell>}
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {closingHistory.map((entry) => (
                                    <TableRow key={entry.id}>
                                      <TableCell>{formatDate(entry.closingDate)}</TableCell>
                                      <TableCell>{entry.journalEntryNumber}</TableCell>
                                      <TableCell align="right">
                                        {formatCurrency(entry.totalRevenue)}
                                      </TableCell>
                                      <TableCell align="right">
                                        {formatCurrency(entry.totalExpenses)}
                                      </TableCell>
                                      <TableCell align="right">
                                        {formatCurrency(entry.netIncome)}
                                      </TableCell>
                                      <TableCell>
                                        <StatusChip
                                          status={entry.status}
                                          labels={YEAR_END_CLOSING_STATUS_LABELS}
                                          context="transaction"
                                        />
                                      </TableCell>
                                      {hasManage && (
                                        <TableCell align="right">
                                          {entry.status === 'POSTED' && (
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              color="error"
                                              disabled={actionBusy}
                                              onClick={() => {
                                                setReverseTarget(entry);
                                                setReverseReason('');
                                              }}
                                            >
                                              Reverse
                                            </Button>
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
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Close / Reopen period dialog */}
      <Dialog
        open={periodDialog !== null}
        onClose={() => setPeriodDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {periodDialog?.action === 'CLOSE' ? 'Close Period' : 'Reopen Period'}
          {periodDialog ? ` — ${periodDialog.period.name}` : ''}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {periodDialog?.action === 'CLOSE'
              ? 'Closing this period blocks new transactions dated within it. You can reopen it later if needed.'
              : 'Please provide a reason for reopening this period (recorded in the period audit trail):'}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={periodDialogText}
            onChange={(e) => setPeriodDialogText(e.target.value)}
            placeholder={
              periodDialog?.action === 'CLOSE'
                ? 'Closing notes (optional)...'
                : 'Reason for reopening...'
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPeriodDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={periodDialog?.action === 'CLOSE' ? 'primary' : 'warning'}
            onClick={handlePeriodDialogSubmit}
            disabled={
              actionBusy || (periodDialog?.action === 'REOPEN' && !(periodDialogText ?? '').trim())
            }
          >
            {periodDialog?.action === 'CLOSE' ? 'Close Period' : 'Reopen Period'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Year-end closing dialog */}
      <Dialog open={yeFy !== null} onClose={() => setYeFy(null)} maxWidth="md" fullWidth>
        <DialogTitle>Year-End Close{yeFy ? ` — ${yeFy.name}` : ''}</DialogTitle>
        <DialogContent>
          {yeLoading && <Skeleton variant="rectangular" height={120} />}

          {!yeLoading && yeStep === 'readiness' && readiness && (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {readiness.errors.map((e) => (
                <Alert key={e} severity="error">
                  {e}
                </Alert>
              ))}
              {readiness.warnings.map((w) => (
                <Alert key={w} severity="warning">
                  {w}
                </Alert>
              ))}
              {readiness.isReady ? (
                <Alert severity="success">
                  All checks passed — {readiness.closedPeriods.length} closed and{' '}
                  {readiness.lockedPeriods.length} locked period(s). Retained earnings account:{' '}
                  {readiness.retainedEarningsAccount?.name}.
                </Alert>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Resolve the blockers above, then re-open this dialog to continue.
                </Typography>
              )}
            </Stack>
          )}

          {!yeLoading && yeStep === 'preview' && preview && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={4}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Revenue
                  </Typography>
                  <Typography fontWeight={600}>{formatCurrency(preview.totalRevenue)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Expenses
                  </Typography>
                  <Typography fontWeight={600}>{formatCurrency(preview.totalExpenses)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Net {preview.netIncome >= 0 ? 'Profit' : 'Loss'}
                  </Typography>
                  <Typography
                    fontWeight={600}
                    color={preview.netIncome >= 0 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(Math.abs(preview.netIncome))}
                  </Typography>
                </Box>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                The net {preview.netIncome >= 0 ? 'profit' : 'loss'} will be transferred to{' '}
                {preview.retainedEarningsAccount.code} — {preview.retainedEarningsAccount.name}.
              </Typography>

              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Account</TableCell>
                      <TableCell align="right">Debit</TableCell>
                      <TableCell align="right">Credit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.closingEntries.map((entry, idx) => (
                      <TableRow key={`${entry.accountId}-${idx}`}>
                        <TableCell>
                          {entry.accountCode} — {entry.accountName}
                        </TableCell>
                        <TableCell align="right">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                        </TableCell>
                        <TableCell align="right">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Notes (optional)"
                value={yeNotes}
                onChange={(e) => setYeNotes(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setYeFy(null)}>Cancel</Button>
          {yeStep === 'readiness' && (
            <Button
              variant="contained"
              onClick={handleYearEndPreview}
              disabled={yeLoading || !readiness?.isReady}
            >
              Continue to Preview
            </Button>
          )}
          {yeStep === 'preview' && (
            <Button
              variant="contained"
              color="error"
              onClick={handleYearEndExecute}
              disabled={yeLoading || !preview}
            >
              Execute Year-End Close
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Reverse year-end closing dialog */}
      <Dialog
        open={reverseTarget !== null}
        onClose={() => setReverseTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reverse Year-End Closing</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This posts a reversing journal entry, restores income/expense account balances, and
            reopens the fiscal year. Please provide a reason:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
            placeholder="Reason for reversal..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReverseTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleReverseSubmit}
            disabled={actionBusy || !(reverseReason ?? '').trim()}
          >
            Reverse
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
