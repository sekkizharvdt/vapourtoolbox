'use client';

import { useState, useEffect } from 'react';
import {
  TextField,
  Grid,
  MenuItem,
  Alert,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Paper,
  Stack,
  Button,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { FormDialog, FormDialogActions } from '@/components/common/forms/FormDialog';
import { AccountSelector } from '@/components/common/forms/AccountSelector';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { getFirebase } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { JournalEntry, LedgerEntry, TransactionStatus } from '@vapour/types';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { validateLedgerEntries, calculateBalance } from '@/lib/accounting/ledgerValidator';

interface CreateJournalEntryDialogProps {
  open: boolean;
  onClose: () => void;
  editingEntry?: JournalEntry | null;
}

interface LedgerEntryForm extends Omit<LedgerEntry, 'accountName' | 'accountCode'> {
  accountName?: string;
  accountCode?: string;
}

export function CreateJournalEntryDialog({
  open,
  onClose,
  editingEntry,
}: CreateJournalEntryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0] || '');
  const [description, setDescription] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState<TransactionStatus>('DRAFT');
  const [entries, setEntries] = useState<LedgerEntryForm[]>([
    { accountId: '', debit: 0, credit: 0, description: '', costCentreId: undefined },
    { accountId: '', debit: 0, credit: 0, description: '', costCentreId: undefined },
  ]);

  // Reset form when dialog opens/closes or editing entry changes
  useEffect(() => {
    if (open) {
      if (editingEntry) {
        const dateStr = editingEntry.date instanceof Date ? (editingEntry.date.toISOString().split('T')[0] || '') : (typeof editingEntry.date === 'string' ? editingEntry.date : '');
        setDate(dateStr || (new Date().toISOString().split('T')[0] || ''));
        setDescription(editingEntry.description || '');
        setReference(editingEntry.referenceNumber || '');
        setProjectId(editingEntry.projectId ?? null);
        setStatus(editingEntry.status);
        setEntries(editingEntry.entries || []);
      } else {
        setDate(new Date().toISOString().split('T')[0] || '');
        setDescription('');
        setReference('');
        setProjectId(null);
        setStatus('DRAFT');
        setEntries([
          { accountId: '', debit: 0, credit: 0, description: '', costCentreId: undefined },
          { accountId: '', debit: 0, credit: 0, description: '', costCentreId: undefined },
        ]);
      }
      setError('');
    }
  }, [open, editingEntry]);

  const addEntry = () => {
    setEntries([
      ...entries,
      { accountId: '', debit: 0, credit: 0, description: '', costCentreId: undefined },
    ]);
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 2) {
      setError('At least two ledger entries are required for double-entry bookkeeping');
      return;
    }
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof LedgerEntryForm, value: string | number | null | undefined) => {
    const newEntries = [...entries];
    const currentEntry = newEntries[index];
    if (currentEntry) {
      newEntries[index] = { ...currentEntry, [field]: value };
    }
    setEntries(newEntries);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      // Validate ledger entries
      const validation = validateLedgerEntries(entries);
      if (!validation.isValid) {
        setError(validation.errors.join(', '));
        setLoading(false);
        return;
      }

      const { db } = getFirebase();
      const balance = calculateBalance(entries);

      // Convert string date to Date object for Firestore
      const journalDate = new Date(date);

      const journalEntry: Partial<JournalEntry> = {
        type: 'JOURNAL_ENTRY',
        date: journalDate as any,
        journalDate: journalDate as any,
        description,
        referenceNumber: reference || undefined,
        projectId: projectId || undefined,
        status,
        entries,
        amount: balance.totalDebits,
        transactionNumber: editingEntry?.transactionNumber || await generateTransactionNumber('JOURNAL_ENTRY'),
        createdAt: editingEntry?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        currency: 'INR',
        baseAmount: balance.totalDebits,
        attachments: [],
        journalType: 'GENERAL',
        isReversed: false,
      } as any;

      if (editingEntry?.id) {
        // Update existing entry
        await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, editingEntry.id), journalEntry);
      } else {
        // Create new entry
        await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), journalEntry);
      }

      onClose();
    } catch (err) {
      console.error('[CreateJournalEntryDialog] Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to save journal entry');
    } finally {
      setLoading(false);
    }
  };

  const balance = calculateBalance(entries);
  const isBalanced = balance.isBalanced;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editingEntry ? 'Edit Journal Entry' : 'Create Journal Entry'}
      loading={loading}
      error={error}
      onError={setError}
      maxWidth="lg"
      actions={
        <FormDialogActions
          onCancel={onClose}
          onSubmit={handleSave}
          loading={loading}
          submitLabel={editingEntry ? 'Update' : 'Create'}
        />
      }
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            label="Status"
            select
            value={status}
            onChange={(e) => setStatus(e.target.value as TransactionStatus)}
            required
          >
            <MenuItem value="DRAFT">Draft</MenuItem>
            <MenuItem value="PENDING_APPROVAL">Pending Approval</MenuItem>
            <MenuItem value="APPROVED">Approved</MenuItem>
            <MenuItem value="POSTED">Posted</MenuItem>
            <MenuItem value="VOID">Void</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            label="Reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            helperText="Invoice number, PO number, etc."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ProjectSelector
            value={projectId}
            onChange={setProjectId}
            label="Project / Cost Centre"
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">Ledger Entries</Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={addEntry}
              >
                Add Entry
              </Button>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="30%">Account</TableCell>
                    <TableCell width="25%">Description</TableCell>
                    <TableCell width="15%" align="right">Debit</TableCell>
                    <TableCell width="15%" align="right">Credit</TableCell>
                    <TableCell width="10%">Project</TableCell>
                    <TableCell width="5%" align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <AccountSelector
                          value={entry.accountId}
                          onChange={(accountId) => updateEntry(index, 'accountId', accountId || '')}
                          label=""
                          required
                          excludeGroups
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          value={entry.description}
                          onChange={(e) => updateEntry(index, 'description', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={entry.debit}
                          onChange={(e) => updateEntry(index, 'debit', parseFloat(e.target.value) || 0)}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={entry.credit}
                          onChange={(e) => updateEntry(index, 'credit', parseFloat(e.target.value) || 0)}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </TableCell>
                      <TableCell>
                        <ProjectSelector
                          value={entry.costCentreId ?? null}
                          onChange={(costCentreId) => updateEntry(index, 'costCentreId', costCentreId ?? undefined)}
                          label=""
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => removeEntry(index)}
                          disabled={entries.length <= 2}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} align="right">
                      <Typography variant="subtitle2">Total:</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle2" fontWeight="bold">
                        {balance.totalDebits.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle2" fontWeight="bold">
                        {balance.totalCredits.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell colSpan={2}>
                      {!isBalanced && (
                        <Typography variant="caption" color="error">
                          Out of balance: {Math.abs(balance.balance).toFixed(2)}
                        </Typography>
                      )}
                      {isBalanced && entries.length >= 2 && (
                        <Typography variant="caption" color="success.main">
                          Balanced
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {!isBalanced && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Debits and credits must be equal. Current difference: {Math.abs(balance.balance).toFixed(2)}
              </Alert>
            )}
          </Box>
        </Grid>
      </Grid>
    </FormDialog>
  );
}
