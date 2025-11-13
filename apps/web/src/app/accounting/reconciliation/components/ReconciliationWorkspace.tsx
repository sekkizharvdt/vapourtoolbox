'use client';

import React, { useState } from 'react';
import { Box, LinearProgress, Alert, Button, Stack } from '@mui/material';
import { Grid } from '@mui/material';
import { Link as LinkIcon, Assessment as AssessmentIcon } from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  matchTransactions,
  unmatchTransaction,
  markStatementAsReconciled,
} from '@/lib/accounting/bankReconciliationService';
import { ReconciliationReport } from './ReconciliationReport';
import { useReconciliationData } from './workspace/useReconciliationData';
import { ReconciliationHeader } from './workspace/ReconciliationHeader';
import { UnmatchedBankTable } from './workspace/UnmatchedBankTable';
import { UnmatchedAccountingTable } from './workspace/UnmatchedAccountingTable';
import { MatchedTransactionsTable } from './workspace/MatchedTransactionsTable';
import { MatchConfirmationDialog } from './workspace/MatchConfirmationDialog';

interface ReconciliationWorkspaceProps {
  statementId: string;
  onBack: () => void;
}

export function ReconciliationWorkspace({ statementId, onBack }: ReconciliationWorkspaceProps) {
  const { user } = useAuth();
  const {
    statement,
    bankTransactions,
    accountingTransactions,
    suggestions,
    stats,
    loading,
    error,
  } = useReconciliationData(statementId);

  const [selectedBankTxn, setSelectedBankTxn] = useState<string | null>(null);
  const [selectedAccTxn, setSelectedAccTxn] = useState<string | null>(null);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchNotes, setMatchNotes] = useState('');
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [actionError, setActionError] = useState('');

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

      setSelectedBankTxn(null);
      setSelectedAccTxn(null);
      setMatchNotes('');
      setMatchDialogOpen(false);
    } catch (err) {
      console.error('[ReconciliationWorkspace] Error matching:', err);
      setActionError('Failed to match transactions');
    }
  };

  const handleUnmatch = async (bankTxnId: string) => {
    if (!confirm('Are you sure you want to unmatch this transaction?')) return;

    try {
      const { db } = getFirebase();
      await unmatchTransaction(db, bankTxnId);
    } catch (err) {
      console.error('[ReconciliationWorkspace] Error unmatching:', err);
      setActionError('Failed to unmatch transaction');
    }
  };

  const handleAutoMatch = async () => {
    if (suggestions.length === 0) {
      alert('No suggested matches found');
      return;
    }

    try {
      const { db } = getFirebase();

      const highConfidenceSuggestions = suggestions.filter((s) => s.confidence === 'HIGH');

      for (const suggestion of highConfidenceSuggestions) {
        await matchTransactions(
          db,
          {
            bankTransactionId: suggestion.bankTransactionId,
            accountingTransactionId: suggestion.accountingTransactionId,
            notes: 'Auto-matched: ' + suggestion.matchReasons.join(', '),
          },
          'SUGGESTED',
          user?.uid || 'system'
        );
      }

      alert('Auto-matched ' + highConfidenceSuggestions.length + ' transactions');
    } catch (err) {
      console.error('[ReconciliationWorkspace] Error auto-matching:', err);
      setActionError('Failed to auto-match transactions');
    }
  };

  const handleMarkAsReconciled = async () => {
    if (stats.reconciledCount < stats.totalCount) {
      alert(
        'Cannot mark as reconciled: ' +
          (stats.totalCount - stats.reconciledCount) +
          ' transactions are still unmatched'
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
      setActionError('Failed to mark as reconciled');
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (error || !statement) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Statement not found'}</Alert>
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
      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      <ReconciliationHeader
        statement={statement}
        stats={stats}
        suggestions={suggestions}
        onAutoMatch={handleAutoMatch}
        onMarkAsReconciled={handleMarkAsReconciled}
      />

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
          onClick={() => setReportDialogOpen(true)}
        >
          Generate Report
        </Button>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <UnmatchedBankTable
            transactions={unmatchedBankTxns}
            selectedTxnId={selectedBankTxn}
            onSelect={setSelectedBankTxn}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <UnmatchedAccountingTable
            transactions={accountingTransactions}
            selectedTxnId={selectedAccTxn}
            onSelect={setSelectedAccTxn}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <MatchedTransactionsTable transactions={matchedBankTxns} onUnmatch={handleUnmatch} />
        </Grid>
      </Grid>

      <MatchConfirmationDialog
        open={matchDialogOpen}
        notes={matchNotes}
        onNotesChange={setMatchNotes}
        onConfirm={handleConfirmMatch}
        onCancel={() => setMatchDialogOpen(false)}
      />

      <ReconciliationReport
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        statementId={statementId}
      />
    </Box>
  );
}
