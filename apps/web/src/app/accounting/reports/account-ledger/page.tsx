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
  Chip,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { AccountSelector } from '@/components/common/forms/AccountSelector';

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
  vendorInvoiceNumber?: string;
}

interface LedgerLine {
  date: Date;
  description: string;
  typeLabel: string;
  reference: string;
  vendorRef?: string;
  debit: number;
  credit: number;
  balance: number;
}

function getTransactionTypeLabel(type: string): string {
  switch (type) {
    case 'JOURNAL_ENTRY':
      return 'Journal';
    case 'CUSTOMER_PAYMENT':
    case 'VENDOR_PAYMENT':
    case 'DIRECT_PAYMENT':
      return 'Payment';
    case 'CUSTOMER_INVOICE':
      return 'Invoice';
    case 'VENDOR_BILL':
      return 'Bill';
    default:
      return type || 'Entry';
  }
}

export default function AccountLedgerPage() {
  const router = useRouter();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [ledgerLines, setLedgerLines] = useState<LedgerLine[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountLedger(selectedAccountId);
    } else {
      setLedgerLines([]);
      setOpeningBalance(0);
      setClosingBalance(0);
    }
  }, [selectedAccountId]);

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
          relevantTransactions.push({ ...data, id: doc.id });
        }
      });

      // Sort by date ascending
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
              typeLabel: getTransactionTypeLabel(transaction.type),
              reference: transaction.referenceNumber || transaction.id,
              vendorRef: transaction.vendorInvoiceNumber,
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
        <Typography color="text.primary">Account Ledger</Typography>
      </Breadcrumbs>

      <Typography variant="h4" gutterBottom>
        Account Ledger
      </Typography>

      <Box sx={{ mt: 3, mb: 3 }}>
        <AccountSelector
          value={selectedAccountId}
          onChange={setSelectedAccountId}
          label="Select Account"
          placeholder="Search by code or name..."
          size="medium"
        />
      </Box>

      {selectedAccountId && (
        <>
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
                        <TableCell>
                          <Box
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                          >
                            <Chip label={line.typeLabel} size="small" variant="outlined" />
                            <Typography variant="body2">{line.reference}</Typography>
                            {line.vendorRef && (
                              <Typography variant="caption" color="text.secondary">
                                / {line.vendorRef}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
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
