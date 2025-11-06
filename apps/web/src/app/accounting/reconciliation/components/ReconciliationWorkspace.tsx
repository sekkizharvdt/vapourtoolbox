'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  Stack,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  CheckCircle as CheckCircleIcon,
  AutoAwesome as AutoAwesomeIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import type { BankStatement, BankTransaction, MatchSuggestion } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import {
  getUnmatchedBankTransactions,
  getUnmatchedAccountingTransactions,
  getSuggestedMatches,
  matchTransactions,
  unmatchTransaction,
  getReconciliationStats,
  markStatementAsReconciled,
} from '@/lib/accounting/bankReconciliationService';

interface ReconciliationWorkspaceProps {
  statementId: string;
  onBack: () => void;
}

export function ReconciliationWorkspace({ statementId, onBack }: ReconciliationWorkspaceProps) {
  const { user } = useAuth();
  const [statement, setStatement] = useState<BankStatement | null>(null);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [accountingTransactions, setAccountingTransactions] = useState<unknown[]>([]);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [stats, setStats] = useState({
    reconciledCount: 0,
    totalCount: 0,
    percentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBankTxn, setSelectedBankTxn] = useState<string | null>(null);
  const [selectedAccTxn, setSelectedAccTxn] = useState<string | null>(null);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchNotes, setMatchNotes] = useState('');

  // Load statement and transactions
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function loadData() {
      try {
        const { db } = getFirebase();

        // Load statement
        const statementDoc = await getDoc(doc(db, 'bankStatements', statementId));
        if (!statementDoc.exists()) {
          setError('Bank statement not found');
          setLoading(false);
          return;
        }
        const statementData = {
          id: statementDoc.id,
          ...statementDoc.data(),
        } as unknown as BankStatement;
        setStatement(statementData);

        // Load bank transactions (real-time)
        const bankTxnRef = collection(db, 'bankTransactions');
        const bankQ = query(bankTxnRef, where('statementId', '==', statementId));
        unsubscribe = onSnapshot(bankQ, (snapshot) => {
          const txns: BankTransaction[] = [];
          snapshot.forEach((doc) => {
            txns.push({ id: doc.id, ...doc.data() } as unknown as BankTransaction);
          });
          setBankTransactions(txns);
        });

        // Load accounting transactions
        const accTxns = await getUnmatchedAccountingTransactions(
          db,
          statementData.accountId,
          statementData.startDate,
          statementData.endDate
        );
        setAccountingTransactions(accTxns);

        // Load suggested matches
        const matchSuggestions = await getSuggestedMatches(db, statementId);
        setSuggestions(matchSuggestions);

        // Load stats
        const reconciliationStats = await getReconciliationStats(db, statementId);
        setStats({
          reconciledCount: reconciliationStats.reconciledBankTransactions,
          totalCount: reconciliationStats.totalBankTransactions,
          percentage: reconciliationStats.percentageComplete,
        });

        setLoading(false);
      } catch (err) {
        console.error('[ReconciliationWorkspace] Error loading data:', err);
        setError('Failed to load reconciliation data');
        setLoading(false);
      }
    }

    loadData();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [statementId]);

  // Refresh stats when transactions change
  useEffect(() => {
    async function refreshStats() {
      if (!statement) return;
      try {
        const { db } = getFirebase();
        const reconciliationStats = await getReconciliationStats(db, statementId);
        setStats({
          reconciledCount: reconciliationStats.reconciledBankTransactions,
          totalCount: reconciliationStats.totalBankTransactions,
          percentage: reconciliationStats.percentageComplete,
        });
      } catch (err) {
        console.error('[ReconciliationWorkspace] Error refreshing stats:', err);
      }
    }
    refreshStats();
  }, [bankTransactions, statementId, statement]);

  const handleMatch = () => {
    if (selectedBankTxn && selectedAccTxn) {
      setMatchDialogOpen(true);
    }
  };

  const handleConfirmMatch = async () => {
    if (!selectedBankTxn || !selectedAccTxn) return;

    try {
      const { db } = getFirebase();
      await matchTransactions(
        db,
        {
          bankTransactionId: selectedBankTxn,
          accountingTransactionId: selectedAccTxn,
          notes: matchNotes,
        },
        'MANUAL',
        user?.uid || 'system'
      );

      // Reload data
      const bankTxns = await getUnmatchedBankTransactions(db, statementId);
      setBankTransactions(bankTxns);

      setSelectedBankTxn(null);
      setSelectedAccTxn(null);
      setMatchNotes('');
      setMatchDialogOpen(false);
    } catch (err) {
      console.error('[ReconciliationWorkspace] Error matching:', err);
      setError('Failed to match transactions');
    }
  };

  const handleUnmatch = async (bankTxnId: string) => {
    if (!confirm('Are you sure you want to unmatch this transaction?')) return;

    try {
      const { db } = getFirebase();
      await unmatchTransaction(db, bankTxnId);

      // Reload data
      const bankTxns = await getUnmatchedBankTransactions(db, statementId);
      setBankTransactions(bankTxns);
    } catch (err) {
      console.error('[ReconciliationWorkspace] Error unmatching:', err);
      setError('Failed to unmatch transaction');
    }
  };

  const handleAutoMatch = async () => {
    if (suggestions.length === 0) {
      alert('No suggested matches found');
      return;
    }

    try {
      const { db } = getFirebase();

      // Match all high-confidence suggestions
      const highConfidenceSuggestions = suggestions.filter((s) => s.confidence === 'HIGH');

      for (const suggestion of highConfidenceSuggestions) {
        await matchTransactions(
          db,
          {
            bankTransactionId: suggestion.bankTransactionId,
            accountingTransactionId: suggestion.accountingTransactionId,
            notes: `Auto-matched: ${suggestion.matchReasons.join(', ')}`,
          },
          'SUGGESTED',
          user?.uid || 'system'
        );
      }

      // Reload data
      const bankTxns = await getUnmatchedBankTransactions(db, statementId);
      setBankTransactions(bankTxns);
      const matchSuggestions = await getSuggestedMatches(db, statementId);
      setSuggestions(matchSuggestions);

      alert(`Auto-matched ${highConfidenceSuggestions.length} transactions`);
    } catch (err) {
      console.error('[ReconciliationWorkspace] Error auto-matching:', err);
      setError('Failed to auto-match transactions');
    }
  };

  const handleMarkAsReconciled = async () => {
    if (stats.reconciledCount < stats.totalCount) {
      alert(
        `Cannot mark as reconciled: ${stats.totalCount - stats.reconciledCount} transactions are still unmatched`
      );
      return;
    }

    try {
      const { db } = getFirebase();
      await markStatementAsReconciled(db, statementId, user?.uid || 'system');
      alert('Statement marked as reconciled');
      onBack();
    } catch (err) {
      console.error('[ReconciliationWorkspace] Error marking as reconciled:', err);
      setError('Failed to mark as reconciled');
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading reconciliation workspace...</Typography>
        <LinearProgress sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={onBack} sx={{ mt: 2 }}>
          Back to Statements
        </Button>
      </Box>
    );
  }

  if (!statement) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Statement not found</Alert>
        <Button onClick={onBack} sx={{ mt: 2 }}>
          Back to Statements
        </Button>
      </Box>
    );
  }

  const unmatchedBankTxns = bankTransactions.filter((t) => !t.isReconciled);
  const matchedBankTxns = bankTransactions.filter((t) => t.isReconciled);

  return (
    <Box>
      {/* Header Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Reconciliation Progress
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                <Typography variant="h5">
                  {stats.reconciledCount} / {stats.totalCount}
                </Typography>
                <Chip
                  label={`${stats.percentage.toFixed(0)}%`}
                  size="small"
                  color={stats.percentage === 100 ? 'success' : 'warning'}
                />
              </Stack>
              <LinearProgress
                variant="determinate"
                value={stats.percentage}
                sx={{ mt: 1, height: 8, borderRadius: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Suggested Matches
              </Typography>
              <Typography variant="h5">{suggestions.length}</Typography>
              <Typography variant="caption" color="text.secondary">
                {suggestions.filter((s) => s.confidence === 'HIGH').length} high confidence
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Closing Balance
              </Typography>
              <Typography variant="h5">{formatCurrency(statement.closingBalance)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Stack spacing={1}>
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={handleAutoMatch}
              disabled={suggestions.length === 0}
              fullWidth
            >
              Auto Match ({suggestions.filter((s) => s.confidence === 'HIGH').length})
            </Button>
            <Button
              variant="outlined"
              startIcon={<CheckCircleIcon />}
              onClick={handleMarkAsReconciled}
              disabled={stats.percentage < 100}
              fullWidth
            >
              Mark as Reconciled
            </Button>
          </Stack>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<LinkIcon />}
          onClick={handleMatch}
          disabled={!selectedBankTxn || !selectedAccTxn}
        >
          Match Selected
        </Button>
        <Button
          variant="outlined"
          startIcon={<AssessmentIcon />}
          onClick={() => alert('Generate report feature coming soon')}
        >
          Generate Report
        </Button>
      </Stack>

      {/* Transactions Tables */}
      <Grid container spacing={2}>
        {/* Unmatched Bank Transactions */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Unmatched Bank Transactions ({unmatchedBankTxns.length})
            </Typography>
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unmatchedBankTxns.map((txn) => (
                    <TableRow
                      key={txn.id}
                      hover
                      selected={selectedBankTxn === txn.id}
                      onClick={() =>
                        setSelectedBankTxn(selectedBankTxn === txn.id ? null : txn.id!)
                      }
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked={selectedBankTxn === txn.id} />
                      </TableCell>
                      <TableCell>
                        {new Date(txn.transactionDate.toDate()).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap>
                          {txn.description}
                        </Typography>
                        {txn.chequeNumber && (
                          <Typography variant="caption" color="text.secondary">
                            Cheque: {txn.chequeNumber}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={txn.debitAmount > 0 ? 'error.main' : 'success.main'}
                        >
                          {txn.debitAmount > 0 ? '-' : '+'}
                          {formatCurrency(txn.debitAmount || txn.creditAmount)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Unmatched Accounting Transactions */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Unmatched Accounting Transactions ({accountingTransactions.length})
            </Typography>
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accountingTransactions.map((txn) => {
                    const typedTxn = txn as {
                      id?: string;
                      date?: { toDate: () => Date };
                      description?: string;
                      transactionNumber?: string;
                      amount?: number;
                      totalAmount?: number;
                    };
                    return (
                      <TableRow
                        key={typedTxn.id}
                        hover
                        selected={selectedAccTxn === typedTxn.id}
                        onClick={() =>
                          setSelectedAccTxn(selectedAccTxn === typedTxn.id ? null : typedTxn.id!)
                        }
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox checked={selectedAccTxn === typedTxn.id} />
                        </TableCell>
                        <TableCell>
                          {typedTxn.date && new Date(typedTxn.date.toDate()).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {typedTxn.description}
                          </Typography>
                          {typedTxn.transactionNumber && (
                            <Typography variant="caption" color="text.secondary">
                              {typedTxn.transactionNumber}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(typedTxn.amount || typedTxn.totalAmount || 0)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Matched Transactions */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Matched Transactions ({matchedBankTxns.length})
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Bank Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Match Type</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matchedBankTxns.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>
                        {new Date(txn.transactionDate.toDate()).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{txn.description}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(txn.debitAmount || txn.creditAmount)}
                      </TableCell>
                      <TableCell>
                        <Chip label={txn.matchType || 'MANUAL'} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Unmatch">
                          <IconButton size="small" onClick={() => handleUnmatch(txn.id!)}>
                            <LinkOffIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Match Confirmation Dialog */}
      <Dialog
        open={matchDialogOpen}
        onClose={() => setMatchDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Transaction Match</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Are you sure you want to match these transactions?
          </Typography>
          <TextField
            fullWidth
            label="Notes (Optional)"
            value={matchNotes}
            onChange={(e) => setMatchNotes(e.target.value)}
            multiline
            rows={3}
            placeholder="Add any notes about this match..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMatchDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmMatch} variant="contained">
            Confirm Match
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
