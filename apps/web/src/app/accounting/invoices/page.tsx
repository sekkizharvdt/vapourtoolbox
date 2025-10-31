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
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { CustomerInvoice } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { CreateInvoiceDialog } from './components/CreateInvoiceDialog';

export default function InvoicesPage() {
  const { userData } = useAuth();
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<CustomerInvoice | null>(null);

  const canManage = hasPermission(userData?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);

  // Real-time listener for invoices
  useEffect(() => {
    const { db } = getFirebase();
    const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const q = query(
      transactionsRef,
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invoicesData: CustomerInvoice[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.type === 'CUSTOMER_INVOICE') {
          invoicesData.push({ id: doc.id, ...data } as CustomerInvoice);
        }
      });
      setInvoices(invoicesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreate = () => {
    setEditingInvoice(null);
    setCreateDialogOpen(true);
  };

  const handleEdit = (invoice: CustomerInvoice) => {
    setEditingInvoice(invoice);
    setCreateDialogOpen(true);
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { db } = getFirebase();
      await deleteDoc(doc(db, COLLECTIONS.TRANSACTIONS, invoiceId));
    } catch (error) {
      console.error('[InvoicesPage] Error deleting invoice:', error);
      alert('Failed to delete invoice');
    }
  };

  const handleDialogClose = () => {
    setCreateDialogOpen(false);
    setEditingInvoice(null);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading invoices...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Customer Invoices</Typography>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            New Invoice
          </Button>
        )}
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Invoice Number</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Subtotal</TableCell>
              <TableCell align="right">GST</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    No invoices found. Click &quot;New Invoice&quot; to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id} hover>
                  <TableCell>
                    {new Date(invoice.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{invoice.transactionNumber}</TableCell>
                  <TableCell>{invoice.entityName || '-'}</TableCell>
                  <TableCell>{invoice.description || '-'}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(invoice.subtotal || 0)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(invoice.gstDetails?.totalGST || 0)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(invoice.totalAmount || 0)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={invoice.status}
                      size="small"
                      color={
                        invoice.status === 'PAID' ? 'success' :
                        invoice.status === 'SENT' ? 'info' :
                        invoice.status === 'DRAFT' ? 'default' :
                        invoice.status === 'OVERDUE' ? 'error' :
                        'warning'
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View">
                      <IconButton size="small" onClick={() => handleEdit(invoice)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canManage && (
                      <>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEdit(invoice)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Send">
                          <IconButton size="small" color="primary">
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(invoice.id!)}
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
      </TableContainer>

      <CreateInvoiceDialog
        open={createDialogOpen}
        onClose={handleDialogClose}
        editingInvoice={editingInvoice}
      />
    </Box>
  );
}
