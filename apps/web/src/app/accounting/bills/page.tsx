'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  TablePagination,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { VendorBill } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { CreateBillDialog } from './components/CreateBillDialog';

export default function BillsPage() {
  const { claims } = useAuth();
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<VendorBill | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);

  // Real-time listener for bills
  useEffect(() => {
    const { db } = getFirebase();
    const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const q = query(transactionsRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const billsData: VendorBill[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.type === 'VENDOR_BILL') {
          billsData.push({ id: doc.id, ...data } as VendorBill);
        }
      });
      setBills(billsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreate = () => {
    setEditingBill(null);
    setCreateDialogOpen(true);
  };

  const handleEdit = (bill: VendorBill) => {
    setEditingBill(bill);
    setCreateDialogOpen(true);
  };

  const handleDelete = async (billId: string) => {
    if (!confirm('Are you sure you want to delete this bill?')) return;

    try {
      const { db } = getFirebase();
      await deleteDoc(doc(db, COLLECTIONS.TRANSACTIONS, billId));
    } catch (error) {
      console.error('[BillsPage] Error deleting bill:', error);
      alert('Failed to delete bill');
    }
  };

  const handleDialogClose = () => {
    setCreateDialogOpen(false);
    setEditingBill(null);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Paginate bills in memory (simple client-side pagination)
  const paginatedBills = bills.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading bills...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Vendor Bills</Typography>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            New Bill
          </Button>
        )}
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Bill Number</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Subtotal</TableCell>
              <TableCell align="right">GST</TableCell>
              <TableCell align="right">TDS</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    No bills found. Click &quot;New Bill&quot; to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedBills.map((bill) => (
                <TableRow key={bill.id} hover>
                  <TableCell>{new Date(bill.date).toLocaleDateString()}</TableCell>
                  <TableCell>{bill.transactionNumber}</TableCell>
                  <TableCell>{bill.entityName || '-'}</TableCell>
                  <TableCell>{bill.description || '-'}</TableCell>
                  <TableCell align="right">{formatCurrency(bill.subtotal || 0)}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(bill.gstDetails?.totalGST || 0)}
                  </TableCell>
                  <TableCell align="right">
                    {bill.tdsDeducted ? formatCurrency(bill.tdsAmount || 0) : '-'}
                  </TableCell>
                  <TableCell align="right">{formatCurrency(bill.totalAmount || 0)}</TableCell>
                  <TableCell>
                    <Chip
                      label={bill.status}
                      size="small"
                      color={
                        bill.status === 'POSTED'
                          ? 'success'
                          : bill.status === 'APPROVED'
                            ? 'info'
                            : bill.status === 'DRAFT'
                              ? 'default'
                              : bill.status === 'VOID'
                                ? 'error'
                                : 'warning'
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View">
                      <IconButton size="small" onClick={() => handleEdit(bill)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canManage && (
                      <>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEdit(bill)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Record Payment">
                          <IconButton size="small" color="primary">
                            <PaymentIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(bill.id!)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={bills.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      <CreateBillDialog
        open={createDialogOpen}
        onClose={handleDialogClose}
        editingBill={editingBill}
      />
    </Box>
  );
}
