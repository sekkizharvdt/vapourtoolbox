'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  Alert,
  LinearProgress,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { BankStatement, BankTransaction } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { getReconciliationStats } from '@/lib/accounting/bankReconciliation';

interface ReconciliationReportProps {
  open: boolean;
  onClose: () => void;
  statementId: string;
}

interface ReportData {
  statement: BankStatement;
  stats: {
    totalBankTransactions: number;
    reconciledBankTransactions: number;
    unreconciledBankTransactions: number;
    percentageComplete: number;
  };
  matchedTransactions: Array<{
    bankTransaction: BankTransaction;
    accountingTransaction: unknown;
  }>;
  unmatchedBankTransactions: BankTransaction[];
  unmatchedAccountingTransactions: unknown[];
}

export function ReconciliationReport({ open, onClose, statementId }: ReconciliationReportProps) {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');

  const loadReportData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();

      // Load statement
      const statementDoc = await getDoc(doc(db, 'bankStatements', statementId));
      if (!statementDoc.exists()) {
        throw new Error('Statement not found');
      }

      const statement = {
        id: statementDoc.id,
        ...statementDoc.data(),
      } as unknown as BankStatement;

      // Load statistics
      const stats = await getReconciliationStats(db, statementId);

      // Load all bank transactions
      const bankTxnQuery = query(
        collection(db, 'bankTransactions'),
        where('statementId', '==', statementId)
      );
      const bankTxnSnapshot = await getDocs(bankTxnQuery);
      const allBankTxns: BankTransaction[] = [];
      bankTxnSnapshot.forEach((doc) => {
        allBankTxns.push({ id: doc.id, ...doc.data() } as unknown as BankTransaction);
      });

      // Separate matched and unmatched
      const matchedTransactions: Array<{
        bankTransaction: BankTransaction;
        accountingTransaction: unknown;
      }> = [];
      const unmatchedBankTransactions: BankTransaction[] = [];

      for (const bankTxn of allBankTxns) {
        if (bankTxn.isReconciled && bankTxn.reconciledWith) {
          // Load accounting transaction
          try {
            const accTxnDoc = await getDoc(doc(db, 'transactions', bankTxn.reconciledWith));
            if (accTxnDoc.exists()) {
              matchedTransactions.push({
                bankTransaction: bankTxn,
                accountingTransaction: { id: accTxnDoc.id, ...accTxnDoc.data() },
              });
            } else {
              unmatchedBankTransactions.push(bankTxn);
            }
          } catch {
            unmatchedBankTransactions.push(bankTxn);
          }
        } else {
          unmatchedBankTransactions.push(bankTxn);
        }
      }

      // Load unmatched accounting transactions
      const accTxnQuery = query(
        collection(db, 'transactions'),
        where('bankAccountId', '==', statement.accountId),
        where('date', '>=', statement.startDate),
        where('date', '<=', statement.endDate),
        where('status', '==', 'POSTED')
      );
      const accTxnSnapshot = await getDocs(accTxnQuery);
      const unmatchedAccountingTransactions: unknown[] = [];

      accTxnSnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.isReconciled) {
          unmatchedAccountingTransactions.push({ id: doc.id, ...data });
        }
      });

      setReportData({
        statement,
        stats,
        matchedTransactions,
        unmatchedBankTransactions,
        unmatchedAccountingTransactions,
      });
    } catch (err) {
      console.error('[ReconciliationReport] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [statementId]);

  useEffect(() => {
    if (open && statementId) {
      loadReportData();
    }
  }, [open, statementId, loadReportData]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!reportData) return;

    const csvContent = generateCSV(reportData);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reconciliation-report-${statementId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateCSV = (data: ReportData): string => {
    const lines: string[] = [];

    // Header
    lines.push('Bank Reconciliation Report');
    lines.push(`Statement: ${data.statement.accountName}`);
    lines.push(
      `Period: ${new Date(data.statement.startDate.toDate()).toLocaleDateString()} - ${new Date(data.statement.endDate.toDate()).toLocaleDateString()}`
    );
    lines.push('');

    // Summary
    lines.push('Summary');
    lines.push(`Total Bank Transactions,${data.stats.totalBankTransactions}`);
    lines.push(`Reconciled,${data.stats.reconciledBankTransactions}`);
    lines.push(`Unreconciled,${data.stats.unreconciledBankTransactions}`);
    lines.push(`Completion,${data.stats.percentageComplete.toFixed(1)}%`);
    lines.push('');

    // Matched transactions
    lines.push('Matched Transactions');
    lines.push(
      'Bank Date,Bank Description,Bank Amount,Accounting Date,Accounting Description,Accounting Amount'
    );
    data.matchedTransactions.forEach((match) => {
      const accTxn = match.accountingTransaction as {
        date?: { toDate: () => Date };
        description?: string;
        amount?: number;
      };
      lines.push(
        `${new Date(match.bankTransaction.transactionDate.toDate()).toLocaleDateString()},${match.bankTransaction.description},${match.bankTransaction.debitAmount || match.bankTransaction.creditAmount},${accTxn.date ? new Date(accTxn.date.toDate()).toLocaleDateString() : ''},${accTxn.description || ''},${accTxn.amount || ''}`
      );
    });
    lines.push('');

    // Unmatched bank transactions
    lines.push('Unmatched Bank Transactions');
    lines.push('Date,Description,Debit,Credit,Balance');
    data.unmatchedBankTransactions.forEach((txn) => {
      lines.push(
        `${new Date(txn.transactionDate.toDate()).toLocaleDateString()},${txn.description},${txn.debitAmount},${txn.creditAmount},${txn.balance || ''}`
      );
    });
    lines.push('');

    // Unmatched accounting transactions
    lines.push('Unmatched Accounting Transactions');
    lines.push('Date,Description,Amount,Type');
    data.unmatchedAccountingTransactions.forEach((txn) => {
      const t = txn as {
        date?: { toDate: () => Date };
        description?: string;
        amount?: number;
        type?: string;
      };
      lines.push(
        `${t.date ? new Date(t.date.toDate()).toLocaleDateString() : ''},${t.description || ''},${t.amount || ''},${t.type || ''}`
      );
    });

    return lines.join('\n');
  };

  if (loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Generating Report...</DialogTitle>
        <DialogContent>
          <LinearProgress />
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          <Alert severity="error">{error}</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (!reportData) return null;

  const {
    statement,
    stats,
    matchedTransactions,
    unmatchedBankTransactions,
    unmatchedAccountingTransactions,
  } = reportData;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">Bank Reconciliation Report</Typography>
          <Box>
            <Button startIcon={<PrintIcon />} onClick={handlePrint} sx={{ mr: 1 }}>
              Print
            </Button>
            <Button startIcon={<DownloadIcon />} onClick={handleExport}>
              Export CSV
            </Button>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Statement Details */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Statement Information
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Account
              </Typography>
              <Typography variant="body1">{statement.accountName}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Account Number
              </Typography>
              <Typography variant="body1">{statement.accountNumber}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Statement Date
              </Typography>
              <Typography variant="body1">
                {new Date(statement.statementDate.toDate()).toLocaleDateString()}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Period
              </Typography>
              <Typography variant="body1">
                {new Date(statement.startDate.toDate()).toLocaleDateString()} -{' '}
                {new Date(statement.endDate.toDate()).toLocaleDateString()}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Opening Balance
              </Typography>
              <Typography variant="body1">{formatCurrency(statement.openingBalance)}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Closing Balance
              </Typography>
              <Typography variant="body1">{formatCurrency(statement.closingBalance)}</Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Reconciliation Summary */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Reconciliation Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Total Transactions
              </Typography>
              <Typography variant="h4">{stats.totalBankTransactions}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Reconciled
              </Typography>
              <Typography variant="h4" color="success.main">
                {stats.reconciledBankTransactions}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Unreconciled
              </Typography>
              <Typography variant="h4" color="error.main">
                {stats.unreconciledBankTransactions}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Completion
              </Typography>
              <Typography variant="h4">{stats.percentageComplete.toFixed(1)}%</Typography>
            </Grid>
          </Grid>

          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={stats.percentageComplete}
              sx={{ height: 10, borderRadius: 1 }}
              color={stats.percentageComplete === 100 ? 'success' : 'primary'}
            />
          </Box>

          {stats.percentageComplete === 100 ? (
            <Alert severity="success" icon={<CheckIcon />} sx={{ mt: 2 }}>
              Reconciliation complete! All transactions have been matched.
            </Alert>
          ) : (
            <Alert severity="warning" icon={<ErrorIcon />} sx={{ mt: 2 }}>
              {stats.unreconciledBankTransactions} transaction(s) still need to be reconciled.
            </Alert>
          )}
        </Paper>

        {/* Matched Transactions */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Matched Transactions ({matchedTransactions.length})
          </Typography>
          <TableContainer sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Bank Date</TableCell>
                  <TableCell>Bank Description</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Match Type</TableCell>
                  <TableCell>Accounting Ref</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {matchedTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No matched transactions
                    </TableCell>
                  </TableRow>
                ) : (
                  matchedTransactions.map((match, index) => {
                    const accTxn = match.accountingTransaction as {
                      transactionNumber?: string;
                      type?: string;
                    };
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          {new Date(
                            match.bankTransaction.transactionDate.toDate()
                          ).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{match.bankTransaction.description}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(
                            match.bankTransaction.debitAmount || match.bankTransaction.creditAmount
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={match.bankTransaction.matchType || 'MANUAL'}
                            size="small"
                            color="success"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {accTxn.transactionNumber || '-'}
                          </Typography>
                          <br />
                          <Typography variant="caption" color="text.secondary">
                            {accTxn.type || ''}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Unmatched Bank Transactions */}
        {unmatchedBankTransactions.length > 0 && (
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Unmatched Bank Transactions ({unmatchedBankTransactions.length})
            </Typography>
            <TableContainer sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Debit</TableCell>
                    <TableCell align="right">Credit</TableCell>
                    <TableCell align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unmatchedBankTransactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>
                        {new Date(txn.transactionDate.toDate()).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{txn.description}</TableCell>
                      <TableCell align="right">
                        {txn.debitAmount > 0 ? formatCurrency(txn.debitAmount) : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {txn.creditAmount > 0 ? formatCurrency(txn.creditAmount) : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {txn.balance ? formatCurrency(txn.balance) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* Unmatched Accounting Transactions */}
        {unmatchedAccountingTransactions.length > 0 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Unmatched Accounting Transactions ({unmatchedAccountingTransactions.length})
            </Typography>
            <TableContainer sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Number</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unmatchedAccountingTransactions.map((txn) => {
                    const t = txn as {
                      id?: string;
                      date?: { toDate: () => Date };
                      type?: string;
                      transactionNumber?: string;
                      description?: string;
                      amount?: number;
                    };
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          {t.date ? new Date(t.date.toDate()).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Chip label={t.type || '-'} size="small" />
                        </TableCell>
                        <TableCell>{t.transactionNumber || '-'}</TableCell>
                        <TableCell>{t.description || '-'}</TableCell>
                        <TableCell align="right">
                          {t.amount ? formatCurrency(t.amount) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
