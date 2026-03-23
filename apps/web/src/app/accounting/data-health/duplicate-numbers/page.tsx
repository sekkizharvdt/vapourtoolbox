'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  Chip,
  Alert,
  TextField,
  Breadcrumbs,
  Link,
  Paper,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Home as HomeIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { PageHeader, LoadingState, StatCard, FilterBar, EmptyState } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { TRANSACTION_TYPE_LABELS } from '@vapour/constants';
import type { TransactionType } from '@vapour/types';
import { formatCurrency } from '@/lib/utils/formatters';
import { ContentCopy as DuplicateIcon } from '@mui/icons-material';

interface DuplicateTransaction {
  id: string;
  transactionNumber: string;
  type: TransactionType;
  entityName: string;
  date: string;
  totalAmount: number;
}

interface DuplicateGroup {
  transactionNumber: string;
  count: number;
  transactions: DuplicateTransaction[];
}

function toDateString(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'object' && raw !== null && 'toDate' in raw) {
    return (raw as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  if (raw instanceof Date) return raw.toLocaleDateString();
  if (typeof raw === 'string') return new Date(raw).toLocaleDateString();
  return '';
}

function DuplicateGroupRow({
  group,
  onEditTransaction,
}: {
  group: DuplicateGroup;
  onEditTransaction: (txn: DuplicateTransaction) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: open ? 'unset' : undefined } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight="medium">
            {group.transactionNumber}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            label={`${group.count} transactions`}
            size="small"
            color="error"
            variant="outlined"
          />
        </TableCell>
        <TableCell>
          {[...new Set(group.transactions.map((t) => TRANSACTION_TYPE_LABELS[t.type]))].join(', ')}
        </TableCell>
        <TableCell>
          {[...new Set(group.transactions.map((t) => t.entityName).filter(Boolean))].join(', ') ||
            '—'}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} sx={{ py: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ m: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Entity</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>ID</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>
                        <Chip
                          label={TRANSACTION_TYPE_LABELS[txn.type]}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{txn.date}</TableCell>
                      <TableCell>{txn.entityName || '—'}</TableCell>
                      <TableCell align="right">{formatCurrency(txn.totalAmount, 'INR')}</TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {txn.id.slice(0, 8)}…
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => onEditTransaction(txn)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

const TYPE_TO_ROUTE: Partial<Record<TransactionType, string>> = {
  VENDOR_BILL: '/accounting/bills',
  CUSTOMER_INVOICE: '/accounting/invoices',
  VENDOR_PAYMENT: '/accounting/payments?tab=vendor',
  CUSTOMER_PAYMENT: '/accounting/payments?tab=customer',
  JOURNAL_ENTRY: '/accounting/journal-entries',
  BANK_TRANSFER: '/accounting/bank-transfers',
  EXPENSE_CLAIM: '/accounting/expense-claims',
  DIRECT_PAYMENT: '/accounting/payments?tab=direct-payment',
  DIRECT_RECEIPT: '/accounting/payments?tab=direct-receipt',
};

export default function DuplicateNumbersPage() {
  const router = useRouter();
  useAuth();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<DuplicateGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [error, setError] = useState<string | null>(null);

  const fetchDuplicates = async () => {
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);

      const [
        paymentsSnap,
        billsSnap,
        invoicesSnap,
        journalSnap,
        bankTransferSnap,
        directPaySnap,
        directReceiptSnap,
        expenseSnap,
      ] = await Promise.all([
        getDocs(
          query(transactionsRef, where('type', 'in', ['CUSTOMER_PAYMENT', 'VENDOR_PAYMENT']))
        ),
        getDocs(query(transactionsRef, where('type', '==', 'VENDOR_BILL'))),
        getDocs(query(transactionsRef, where('type', '==', 'CUSTOMER_INVOICE'))),
        getDocs(query(transactionsRef, where('type', '==', 'JOURNAL_ENTRY'))),
        getDocs(query(transactionsRef, where('type', '==', 'BANK_TRANSFER'))),
        getDocs(query(transactionsRef, where('type', '==', 'DIRECT_PAYMENT'))),
        getDocs(query(transactionsRef, where('type', '==', 'DIRECT_RECEIPT'))),
        getDocs(query(transactionsRef, where('type', '==', 'EXPENSE_CLAIM'))),
      ]);

      const allDocs = [
        ...paymentsSnap.docs,
        ...billsSnap.docs,
        ...invoicesSnap.docs,
        ...journalSnap.docs,
        ...bankTransferSnap.docs,
        ...directPaySnap.docs,
        ...directReceiptSnap.docs,
        ...expenseSnap.docs,
      ].filter((d) => !d.data().isDeleted);

      // Group by transaction number
      const numberMap = new Map<string, DuplicateTransaction[]>();
      allDocs.forEach((doc) => {
        const data = doc.data();
        const num = data.transactionNumber as string;
        if (!num) return;
        if (!numberMap.has(num)) numberMap.set(num, []);
        numberMap.get(num)!.push({
          id: doc.id,
          transactionNumber: num,
          type: data.type as TransactionType,
          entityName: (data.entityName as string) || '',
          date: toDateString(data.date),
          totalAmount: (data.baseAmount as number) || (data.totalAmount as number) || 0,
        });
      });

      // Filter to only groups with duplicates, sort by count descending
      const duplicateGroups: DuplicateGroup[] = [];
      numberMap.forEach((transactions, transactionNumber) => {
        if (transactions.length > 1) {
          duplicateGroups.push({ transactionNumber, count: transactions.length, transactions });
        }
      });
      duplicateGroups.sort((a, b) => b.count - a.count);

      setGroups(duplicateGroups);
      setFilteredGroups(duplicateGroups);
    } catch (err) {
      console.error('Error fetching duplicate numbers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch duplicate numbers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredGroups(groups);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredGroups(
        groups.filter(
          (g) =>
            g.transactionNumber.toLowerCase().includes(term) ||
            g.transactions.some((t) => t.entityName?.toLowerCase().includes(term))
        )
      );
    }
    setPage(0);
  }, [groups, searchTerm]);

  const handleEditTransaction = (txn: DuplicateTransaction) => {
    const route = TYPE_TO_ROUTE[txn.type];
    if (route) {
      router.push(`${route}?edit=${txn.id}`);
    }
  };

  const totalDuplicateTransactions = groups.reduce((sum, g) => sum + g.count, 0);

  if (loading) {
    return <LoadingState variant="page" message="Scanning for duplicate transaction numbers..." />;
  }

  return (
    <Box sx={{ py: 4 }}>
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
          href="/accounting/data-health"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/accounting/data-health');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Data Health
        </Link>
        <Typography color="text.primary">Duplicate Transaction Numbers</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Duplicate Transaction Numbers"
        action={
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => router.push('/accounting/data-health')}
          >
            Back
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {groups.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {groups.length} transaction number{groups.length > 1 ? 's are' : ' is'} shared by multiple
          transactions ({totalDuplicateTransactions} transactions total). Expand each group to view
          and edit the affected transactions.
        </Alert>
      )}

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <StatCard
          label="Duplicate Groups"
          value={groups.length.toString()}
          icon={<DuplicateIcon />}
          color="error"
        />
        <StatCard
          label="Affected Transactions"
          value={totalDuplicateTransactions.toString()}
          icon={<DuplicateIcon />}
          color="warning"
        />
      </Box>

      {/* Search */}
      <FilterBar onClear={() => setSearchTerm('')}>
        <TextField
          placeholder="Search by transaction number or entity..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 300 }}
        />
      </FilterBar>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 50 }} />
              <TableCell>Transaction Number</TableCell>
              <TableCell>Duplicates</TableCell>
              <TableCell>Types</TableCell>
              <TableCell>Entities</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredGroups.length === 0 ? (
              <EmptyState
                message={
                  groups.length === 0
                    ? 'No duplicate transaction numbers found.'
                    : 'No groups match your search.'
                }
                variant="table"
                colSpan={5}
              />
            ) : (
              filteredGroups
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((group) => (
                  <DuplicateGroupRow
                    key={group.transactionNumber}
                    group={group}
                    onEditTransaction={handleEditTransaction}
                  />
                ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filteredGroups.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>
    </Box>
  );
}
