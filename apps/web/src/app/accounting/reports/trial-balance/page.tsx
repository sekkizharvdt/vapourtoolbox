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
  Breadcrumbs,
  Link,
} from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

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
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });

  useEffect(() => {
    loadTrialBalance();
  }, []);

  const loadTrialBalance = async () => {
    try {
      const { db } = getFirebase();
      const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
      const q = query(accountsRef, orderBy('code', 'asc'));
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;

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

      <Typography variant="h4" gutterBottom>
        Trial Balance
      </Typography>

      <Paper sx={{ mt: 3 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Account Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Debit</TableCell>
                <TableCell align="right">Credit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
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
              ))}
              <TableRow sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
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
                <TableCell colSpan={5} align="center">
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
