'use client';

import { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  TablePagination,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  RestoreFromTrash as RestoreIcon,
  DeleteForever as DeleteForeverIcon,
  Search as SearchIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import {
  PageHeader,
  LoadingState,
  EmptyState,
  TableActionCell,
  getStatusColor,
  FilterBar,
} from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { BaseTransaction, TransactionType } from '@vapour/types';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { useRouter } from 'next/navigation';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  restoreTransaction,
  hardDeleteTransaction,
  getTransactionTypeLabel,
} from '@/lib/accounting/transactionDeleteService';

// Extended type to access soft-delete fields and entity info
interface DeletedTransaction extends BaseTransaction {
  entityName?: string;
  totalAmount?: number;
  deletedAt?: Timestamp;
  deletedBy?: string;
  deletionReason?: string;
}

export default function TrashPage() {
  const router = useRouter();
  const { claims, user } = useAuth();
  const { confirm } = useConfirmDialog();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');

  const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);

  // Firestore query for soft-deleted transactions
  const { db } = getFirebase();
  const trashQuery = useMemo(
    () =>
      query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('isDeleted', '==', true),
        orderBy('deletedAt', 'desc')
      ),
    [db]
  );

  const { data: deletedTransactions, loading } = useFirestoreQuery<DeletedTransaction>(trashQuery);

  // Filter logic
  const filteredTransactions = useMemo(() => {
    return deletedTransactions.filter((txn) => {
      const matchesSearch =
        searchTerm === '' ||
        txn.transactionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = filterType === 'ALL' || txn.type === filterType;

      return matchesSearch && matchesType;
    });
  }, [deletedTransactions, searchTerm, filterType]);

  const handleRestore = async (txn: DeletedTransaction) => {
    const confirmed = await confirm({
      title: 'Restore Transaction',
      message: `Restore "${txn.transactionNumber}" (${getTransactionTypeLabel(txn.type)})? It will reappear on its original list page.`,
      confirmText: 'Restore',
      confirmColor: 'success',
    });
    if (!confirmed) return;

    try {
      const result = await restoreTransaction(db, {
        transactionId: txn.id,
        userId: user?.uid || 'unknown',
        userName: user?.displayName || user?.email || 'Unknown',
      });
      if (!result.success) {
        alert(result.error || 'Failed to restore transaction');
      }
    } catch (error) {
      console.error('[TrashPage] Error restoring transaction:', error);
      alert('Failed to restore transaction');
    }
  };

  const handlePermanentDelete = async (txn: DeletedTransaction) => {
    const confirmed = await confirm({
      title: 'Permanently Delete',
      message: `Are you sure you want to permanently delete "${txn.transactionNumber}" (${getTransactionTypeLabel(txn.type)})? This action cannot be undone. The data will be archived for audit purposes.`,
      confirmText: 'Delete Permanently',
      confirmColor: 'error',
    });
    if (!confirmed) return;

    try {
      const result = await hardDeleteTransaction(db, {
        transactionId: txn.id,
        userId: user?.uid || 'unknown',
        userName: user?.displayName || user?.email || 'Unknown',
      });
      if (!result.success) {
        alert(result.error || 'Failed to permanently delete transaction');
      }
    } catch (error) {
      console.error('[TrashPage] Error permanently deleting transaction:', error);
      alert('Failed to permanently delete transaction');
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterType('ALL');
  };

  // Format deletedAt timestamp
  const formatDeletedAt = (deletedAt: Timestamp | Date | unknown): string => {
    if (!deletedAt) return '-';
    if (deletedAt instanceof Timestamp) return formatDate(deletedAt.toDate());
    if (deletedAt instanceof Date) return formatDate(deletedAt);
    if (
      typeof deletedAt === 'object' &&
      'toDate' in deletedAt &&
      typeof (deletedAt as { toDate: () => Date }).toDate === 'function'
    ) {
      return formatDate((deletedAt as { toDate: () => Date }).toDate());
    }
    return '-';
  };

  // Paginate
  const paginatedTransactions = filteredTransactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return (
      <Box sx={{ py: 4 }}>
        <LoadingState message="Loading trash..." variant="page" />
      </Box>
    );
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
        <Typography color="text.primary">Trash</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Trash"
        subtitle="Deleted transactions can be restored or permanently deleted here"
      />

      {/* Filters */}
      <FilterBar onClear={handleClearFilters}>
        <TextField
          label="Search"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by number, entity, or description..."
          sx={{ minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as TransactionType | 'ALL')}
            label="Type"
          >
            <MenuItem value="ALL">All Types</MenuItem>
            <MenuItem value="CUSTOMER_INVOICE">Invoices</MenuItem>
            <MenuItem value="VENDOR_BILL">Bills</MenuItem>
            <MenuItem value="JOURNAL_ENTRY">Journal Entries</MenuItem>
            <MenuItem value="CUSTOMER_PAYMENT">Customer Payments</MenuItem>
            <MenuItem value="VENDOR_PAYMENT">Vendor Payments</MenuItem>
            <MenuItem value="DIRECT_PAYMENT">Direct Payments</MenuItem>
          </Select>
        </FormControl>
      </FilterBar>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Transaction #</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Original Status</TableCell>
              <TableCell>Deleted At</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedTransactions.length === 0 ? (
              <EmptyState
                message={
                  searchTerm || filterType !== 'ALL'
                    ? 'No deleted transactions match the selected filters.'
                    : 'Trash is empty. Deleted transactions will appear here.'
                }
                variant="table"
                colSpan={8}
              />
            ) : (
              paginatedTransactions.map((txn) => (
                <TableRow key={txn.id} hover>
                  <TableCell>
                    <Chip
                      label={getTransactionTypeLabel(txn.type)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{txn.transactionNumber}</TableCell>
                  <TableCell>{txn.entityName || '-'}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(txn.totalAmount || txn.amount || 0, txn.currency || 'INR')}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={txn.status}
                      size="small"
                      color={getStatusColor(txn.status, 'transaction')}
                    />
                  </TableCell>
                  <TableCell>{formatDeletedAt(txn.deletedAt)}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ maxWidth: 200 }}
                      noWrap
                      title={txn.deletionReason}
                    >
                      {txn.deletionReason || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <TableActionCell
                      actions={[
                        {
                          icon: <RestoreIcon />,
                          label: 'Restore',
                          onClick: () => handleRestore(txn),
                          color: 'success',
                          show: canManage,
                        },
                        {
                          icon: <DeleteForeverIcon />,
                          label: 'Delete Permanently',
                          onClick: () => handlePermanentDelete(txn),
                          color: 'error',
                          show: canManage,
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredTransactions.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
    </Box>
  );
}
