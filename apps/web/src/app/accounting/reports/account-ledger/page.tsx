'use client';

import { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface LedgerEntry {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

interface Transaction {
  id: string;
  type: string;
  date: Timestamp;
  description: string;
  entries: LedgerEntry[];
  referenceNumber?: string;
}

interface LedgerLine {
  date: Date;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function AccountLedgerPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [ledgerLines, setLedgerLines] = useState<LedgerLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountLedger(selectedAccountId);
    }
  }, [selectedAccountId]);

  const loadAccounts = async () => {
    try {
      const { db } = getFirebase();
      const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
      const q = query(accountsRef, orderBy('code', 'asc'));
      const snapshot = await getDocs(q);

      const accountData: Account[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        accountData.push({
          id: doc.id,
          code: data.code || '',
          name: data.name || '',
          type: data.type || '',
        });
      });

      setAccounts(accountData);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAccountLedger = async (accountId: string) => {
    setLoadingLedger(true);
    try {
      const { db } = getFirebase();
      const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
      const snapshot = await getDocs(transactionsRef);

      const lines: LedgerLine[] = [];
      let runningBalance = 0;

      // Get all transactions and filter those affecting this account
      const relevantTransactions: Transaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Transaction;
        const hasEntry = data.entries?.some((entry) => entry.accountId === accountId);
        if (hasEntry) {
          relevantTransactions.push({
            ...data,
            id: doc.id,
          });
        }
      });

      // Sort by date
      relevantTransactions.sort((a, b) => {
        const dateA = a.date.toDate();
        const dateB = b.date.toDate();
        return dateA.getTime() - dateB.getTime();
      });

      // Build ledger lines with running balance
      relevantTransactions.forEach((transaction) => {
        transaction.entries.forEach((entry) => {
          if (entry.accountId === accountId) {
            const debit = entry.debit || 0;
            const credit = entry.credit || 0;
            runningBalance += debit - credit;

            lines.push({
              date: transaction.date.toDate(),
              description: entry.description || transaction.description || '',
              reference: transaction.referenceNumber || transaction.id,
              debit,
              credit,
              balance: runningBalance,
            });
          }
        });
      });

      setOpeningBalance(0); // Could be calculated from a specific date
      setClosingBalance(runningBalance);
      setLedgerLines(lines);
    } catch (error) {
      console.error('Error loading account ledger:', error);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleAccountChange = (event: SelectChangeEvent) => {
    setSelectedAccountId(event.target.value);
  };

  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Account Ledger
      </Typography>

      <Box sx={{ mt: 3, mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Select Account</InputLabel>
          <Select value={selectedAccountId} label="Select Account" onChange={handleAccountChange}>
            {accounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {account.code} - {account.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {selectedAccountId && (
        <>
          {selectedAccount && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6">
                {selectedAccount.code} - {selectedAccount.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Type: {selectedAccount.type}
              </Typography>
            </Paper>
          )}

          {loadingLedger ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          ) : (
            <Paper sx={{ mt: 3 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Reference</TableCell>
                      <TableCell align="right">Debit</TableCell>
                      <TableCell align="right">Credit</TableCell>
                      <TableCell align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {openingBalance !== 0 && (
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell colSpan={3}>
                          <strong>Opening Balance</strong>
                        </TableCell>
                        <TableCell align="right">-</TableCell>
                        <TableCell align="right">-</TableCell>
                        <TableCell align="right">
                          <strong>{openingBalance.toFixed(2)}</strong>
                        </TableCell>
                      </TableRow>
                    )}
                    {ledgerLines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell>{line.date.toLocaleDateString('en-IN')}</TableCell>
                        <TableCell>{line.description}</TableCell>
                        <TableCell>{line.reference}</TableCell>
                        <TableCell align="right">
                          {line.debit > 0 ? line.debit.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {line.credit > 0 ? line.credit.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell align="right">{line.balance.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                      <TableCell colSpan={3}>
                        <strong>Closing Balance</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>
                          {ledgerLines.reduce((sum, line) => sum + line.debit, 0).toFixed(2)}
                        </strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>
                          {ledgerLines.reduce((sum, line) => sum + line.credit, 0).toFixed(2)}
                        </strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{closingBalance.toFixed(2)}</strong>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              {ledgerLines.length === 0 && (
                <Box p={3} textAlign="center">
                  <Typography color="text.secondary">
                    No transactions found for this account.
                  </Typography>
                </Box>
              )}
            </Paper>
          )}
        </>
      )}

      {!selectedAccountId && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Please select an account to view its ledger.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
