'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  CircularProgress,
  Breadcrumbs,
  Link,
  IconButton,
  Collapse,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Home as HomeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  OpenInNew as OpenInNewIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import {
  fetchAccountGLEntries,
  getTransactionTypeLabel,
  type GLDrilldownEntry,
} from '@/lib/accounting/reports/glDrilldown';
import {
  downloadReportCSV,
  downloadReportExcel,
  type ExportSection,
} from '@/lib/accounting/reports/exportReport';

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function TrialBalancePage() {
  const router = useRouter();
  const { claims } = useAuth();
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });

  // Drill-down state
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [drilldownData, setDrilldownData] = useState<Map<string, GLDrilldownEntry[]>>(new Map());
  const [drilldownLoading, setDrilldownLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTrialBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claims?.tenantId]);

  const loadTrialBalance = async () => {
    const tenantId = claims?.tenantId || 'default-entity';
    try {
      const { db } = getFirebase();
      const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
      const q = query(accountsRef, where('tenantId', '==', tenantId), orderBy('code', 'asc'));
      const snapshot = await getDocs(q);

      const accountData: AccountBalance[] = [];
      let totalDebit = 0;
      let totalCredit = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const debit = data.debit || 0;
        const credit = data.credit || 0;

        accountData.push({
          id: doc.id,
          code: data.code || '',
          name: data.name || '',
          type: data.type || '',
          debit,
          credit,
          balance: debit - credit,
        });

        totalDebit += debit;
        totalCredit += credit;
      });

      setAccounts(accountData);
      setTotals({ debit: totalDebit, credit: totalCredit });
    } catch (error) {
      console.error('Error loading trial balance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = useCallback(
    async (account: AccountBalance) => {
      if (expandedAccountId === account.id) {
        setExpandedAccountId(null);
        return;
      }

      setExpandedAccountId(account.id);

      // Fetch only if not already cached
      if (!drilldownData.has(account.id)) {
        setDrilldownLoading((prev) => new Set(prev).add(account.id));
        try {
          const { db } = getFirebase();
          const entries = await fetchAccountGLEntries(db, account.id);
          setDrilldownData((prev) => new Map(prev).set(account.id, entries));
        } catch (err) {
          console.error('Error loading GL entries:', err);
          setDrilldownData((prev) => new Map(prev).set(account.id, []));
        } finally {
          setDrilldownLoading((prev) => {
            const next = new Set(prev);
            next.delete(account.id);
            return next;
          });
        }
      }
    },
    [expandedAccountId, drilldownData]
  );

  const formatDate = (date: Date): string =>
    date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;

  const buildExportSections = (): ExportSection[] => {
    const columns = [
      { header: 'Code', key: 'code', width: 10 },
      { header: 'Account Name', key: 'name', width: 30 },
      { header: 'Type', key: 'type', width: 15 },
      {
        header: 'Debit',
        key: 'debit',
        width: 15,
        align: 'right' as const,
        format: 'currency' as const,
      },
      {
        header: 'Credit',
        key: 'credit',
        width: 15,
        align: 'right' as const,
        format: 'currency' as const,
      },
    ];
    return [
      {
        title: 'Trial Balance',
        columns,
        rows: accounts.map((a) => ({
          code: a.code,
          name: a.name,
          type: a.type,
          debit: a.debit > 0 ? a.debit : 0,
          credit: a.credit > 0 ? a.credit : 0,
        })),
        summary: { code: '', name: 'TOTAL', type: '', debit: totals.debit, credit: totals.credit },
      },
    ];
  };

  const handleExportCSV = () =>
    downloadReportCSV(
      buildExportSections(),
      `Trial_Balance_${new Date().toISOString().slice(0, 10)}`
    );
  const handleExportExcel = () =>
    downloadReportExcel(
      buildExportSections(),
      `Trial_Balance_${new Date().toISOString().slice(0, 10)}`,
      'Trial Balance'
    );

  return (
    <Box p={3}>
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
        <Typography color="text.primary">Trial Balance</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Trial Balance
        </Typography>
        {accounts.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Export CSV">
              <IconButton onClick={handleExportCSV} size="small">
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export Excel">
              <IconButton onClick={handleExportExcel} size="small" color="primary">
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Click an account row to view the underlying transactions.
      </Typography>

      <Paper sx={{ mt: 1 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>Code</TableCell>
                <TableCell>Account Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Debit</TableCell>
                <TableCell align="right">Credit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((account) => {
                const isExpanded = expandedAccountId === account.id;
                const isLoading = drilldownLoading.has(account.id);
                const entries = drilldownData.get(account.id) ?? [];

                return (
                  <>
                    <TableRow
                      key={account.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleToggleExpand(account)}
                    >
                      <TableCell padding="none" sx={{ pl: 1 }}>
                        <IconButton size="small">
                          {isExpanded ? (
                            <ExpandLessIcon fontSize="small" />
                          ) : (
                            <ExpandMoreIcon fontSize="small" />
                          )}
                        </IconButton>
                      </TableCell>
                      <TableCell>{account.code}</TableCell>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>{account.type}</TableCell>
                      <TableCell align="right">
                        {account.debit > 0 ? account.debit.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {account.credit > 0 ? account.credit.toFixed(2) : '-'}
                      </TableCell>
                    </TableRow>

                    {/* Drill-down row */}
                    <TableRow key={`${account.id}-detail`}>
                      <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ mx: 4, my: 1 }}>
                            {isLoading ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                                <CircularProgress size={16} />
                                <Typography variant="body2" color="text.secondary">
                                  Loading transactions...
                                </Typography>
                              </Box>
                            ) : entries.length === 0 ? (
                              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                No GL entries found for this account.
                              </Typography>
                            ) : (
                              <Table size="small" sx={{ mb: 1 }}>
                                <TableHead>
                                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Transaction #</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Description</TableCell>
                                    <TableCell align="right">Debit</TableCell>
                                    <TableCell align="right">Credit</TableCell>
                                    <TableCell align="center">View</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {entries.map((entry, idx) => (
                                    <TableRow key={`${entry.transactionId}-${idx}`} hover>
                                      <TableCell>{formatDate(entry.date)}</TableCell>
                                      <TableCell>
                                        <Typography variant="body2" fontWeight="medium">
                                          {entry.transactionNumber}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Chip
                                          label={getTransactionTypeLabel(entry.transactionType)}
                                          size="small"
                                          variant="outlined"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Typography
                                          variant="body2"
                                          color="text.secondary"
                                          sx={{
                                            maxWidth: 240,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {entry.description || '-'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="right">
                                        {entry.debit > 0 ? entry.debit.toFixed(2) : '-'}
                                      </TableCell>
                                      <TableCell align="right">
                                        {entry.credit > 0 ? entry.credit.toFixed(2) : '-'}
                                      </TableCell>
                                      <TableCell align="center">
                                        <Tooltip
                                          title={`View in ${getTransactionTypeLabel(entry.transactionType)}s`}
                                        >
                                          <IconButton
                                            size="small"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              router.push(entry.route);
                                            }}
                                          >
                                            <OpenInNewIcon fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                );
              })}

              <TableRow sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                <TableCell />
                <TableCell colSpan={3}>
                  <strong>TOTAL</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{totals.debit.toFixed(2)}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{totals.credit.toFixed(2)}</strong>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={6} align="center">
                  {isBalanced ? (
                    <Typography color="success.main">✓ Trial Balance is balanced</Typography>
                  ) : (
                    <Typography color="error.main">
                      ⚠ Trial Balance is out of balance by{' '}
                      {Math.abs(totals.debit - totals.credit).toFixed(2)}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
