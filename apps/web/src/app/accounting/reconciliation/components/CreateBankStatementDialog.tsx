'use client';

import React, { useState, useEffect } from 'react';
import { TextField, Box, Typography, MenuItem, Alert } from '@mui/material';
import { Grid } from '@mui/material';
import { FormDialog, FormDialogActions } from '@/components/common/forms/FormDialog';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { createBankStatement } from '@/lib/accounting/bankReconciliationService';
import type { Account } from '@vapour/types';

interface CreateBankStatementDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateBankStatementDialog({ open, onClose }: CreateBankStatementDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);

  // Form fields
  const [accountId, setAccountId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [statementDate, setStatementDate] = useState<string>(
    () => new Date().toISOString().split('T')[0] || ''
  );
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [totalDebits, setTotalDebits] = useState('');
  const [totalCredits, setTotalCredits] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch bank accounts
  useEffect(() => {
    async function fetchBankAccounts() {
      const { db } = getFirebase();
      const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
      const q = query(
        accountsRef,
        where('isBankAccount', '==', true),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);
      const accounts: Account[] = [];
      snapshot.forEach((doc) => {
        accounts.push({ id: doc.id, ...doc.data() } as unknown as Account);
      });
      setBankAccounts(accounts);
    }

    if (open) {
      fetchBankAccounts();
    }
  }, [open]);

  // Auto-populate account details when account is selected
  const handleAccountChange = (selectedAccountId: string) => {
    setAccountId(selectedAccountId);
    const account = bankAccounts.find((a) => a.id === selectedAccountId);
    if (account) {
      setAccountName(account.name);
      setAccountNumber(account.accountNumber || '');
      setBankName(account.bankName || '');
    }
  };

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setAccountId('');
      setAccountName('');
      setAccountNumber('');
      setBankName('');
      setStatementDate(new Date().toISOString().split('T')[0] || '');
      setStartDate('');
      setEndDate('');
      setOpeningBalance('');
      setClosingBalance('');
      setTotalDebits('');
      setTotalCredits('');
      setNotes('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async () => {
    // Validation
    if (!accountId) {
      setError('Please select a bank account');
      return;
    }

    if (!statementDate || !startDate || !endDate) {
      setError('Please provide all date fields');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before end date');
      return;
    }

    const openingBal = parseFloat(openingBalance);
    const closingBal = parseFloat(closingBalance);
    const debits = parseFloat(totalDebits) || 0;
    const credits = parseFloat(totalCredits) || 0;

    if (isNaN(openingBal) || isNaN(closingBal)) {
      setError('Please provide valid opening and closing balances');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();

      await createBankStatement(
        db,
        {
          accountId,
          accountName,
          accountNumber,
          bankName,
          statementDate: Timestamp.fromDate(new Date(statementDate)),
          startDate: Timestamp.fromDate(new Date(startDate)),
          endDate: Timestamp.fromDate(new Date(endDate)),
          openingBalance: openingBal,
          closingBalance: closingBal,
          totalDebits: debits,
          totalCredits: credits,
          status: 'DRAFT',
          notes,
          uploadedBy: user?.uid || 'system',
        },
        user?.uid || 'system'
      );

      onClose();
    } catch (err) {
      console.error('[CreateBankStatementDialog] Error:', err);
      setError('Failed to create bank statement. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialog open={open} onClose={onClose} title="Create Bank Statement" maxWidth="md">
      <Box sx={{ p: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Bank Account Selection */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom>
              Bank Account
            </Typography>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              select
              label="Select Bank Account"
              value={accountId}
              onChange={(e) => handleAccountChange(e.target.value)}
              required
              disabled={bankAccounts.length === 0}
              helperText={
                bankAccounts.length === 0
                  ? 'No bank accounts found. Please create a bank account in Chart of Accounts first.'
                  : 'Select the bank account for this statement'
              }
            >
              {bankAccounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name} - {account.accountNumber || 'N/A'}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {accountId && (
            <>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth label="Account Number" value={accountNumber} disabled />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth label="Bank Name" value={bankName} disabled />
              </Grid>
            </>
          )}

          {/* Statement Dates */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom>
              Statement Period
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Statement Date"
              type="date"
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Period Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Period End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
            />
          </Grid>

          {/* Balances */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom>
              Statement Balances
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Opening Balance"
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              slotProps={{ htmlInput: { step: 0.01 } }}
              required
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Closing Balance"
              type="number"
              value={closingBalance}
              onChange={(e) => setClosingBalance(e.target.value)}
              slotProps={{ htmlInput: { step: 0.01 } }}
              required
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Total Debits (Money Out)"
              type="number"
              value={totalDebits}
              onChange={(e) => setTotalDebits(e.target.value)}
              slotProps={{ htmlInput: { step: 0.01 } }}
              helperText="Optional: Total of all debit transactions"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Total Credits (Money In)"
              type="number"
              value={totalCredits}
              onChange={(e) => setTotalCredits(e.target.value)}
              slotProps={{ htmlInput: { step: 0.01 } }}
              helperText="Optional: Total of all credit transactions"
            />
          </Grid>

          {/* Notes */}
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={3}
              placeholder="Optional notes about this statement"
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Alert severity="info">
              After creating the statement, you can import bank transactions from a CSV file or
              manually add them in the reconciliation workspace.
            </Alert>
          </Grid>
        </Grid>
      </Box>

      <FormDialogActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel="Create Statement"
        loading={loading}
      />
    </FormDialog>
  );
}
