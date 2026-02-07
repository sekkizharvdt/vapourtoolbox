'use client';

/**
 * GRN Bills Page
 *
 * Lists completed Goods Receipts that need vendor bills created.
 * Accounting users can create bills directly from this page.
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Home as HomeIcon,
  Receipt as ReceiptIcon,
  CheckCircle as CheckCircleIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import {
  getGRNsPendingBilling,
  createBillFromGoodsReceipt,
  type GRNPendingBill,
} from '@/lib/procurement/accountingIntegration';
import { formatDate } from '@/lib/utils/formatters';

export default function GRNBillsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingGRs, setPendingGRs] = useState<GRNPendingBill[]>([]);
  const [creatingBillFor, setCreatingBillFor] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmGR, setConfirmGR] = useState<GRNPendingBill | null>(null);

  useEffect(() => {
    loadPendingGRs();
  }, []);

  const loadPendingGRs = async () => {
    setLoading(true);
    setError('');
    try {
      const { db } = getFirebase();
      const grs = await getGRNsPendingBilling(db);
      setPendingGRs(grs);
    } catch (err) {
      console.error('[GRNBillsPage] Error loading pending GRNs:', err);
      setError('Failed to load pending goods receipts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBill = async (item: GRNPendingBill) => {
    if (!user) return;

    setConfirmGR(null);
    setCreatingBillFor(item.gr.id);
    setError('');
    setSuccessMessage('');
    try {
      const { db } = getFirebase();
      const billId = await createBillFromGoodsReceipt(db, item.gr, user.uid, user.email || '');
      setSuccessMessage(`Bill created successfully for ${item.gr.number} (ID: ${billId})`);
      setPendingGRs((prev) => prev.filter((g) => g.gr.id !== item.gr.id));
    } catch (err) {
      console.error('[GRNBillsPage] Error creating bill:', err);
      setError(
        `Failed to create bill for ${item.gr.number}. Please check system accounts are configured in Chart of Accounts.`
      );
    } finally {
      setCreatingBillFor(null);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Breadcrumbs */}
        <Breadcrumbs>
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
          <Typography color="text.primary">GRN Bills</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box>
          <Typography variant="h4" gutterBottom>
            GRN Bills
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create vendor bills from completed goods receipts sent by the procurement team.
          </Typography>
        </Box>

        {/* Messages */}
        {error && (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" onClose={() => setSuccessMessage('')}>
            {successMessage}
          </Alert>
        )}

        {/* Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : pendingGRs.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              All caught up!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No pending goods receipts require bill creation.
            </Typography>
          </Paper>
        ) : (
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>GR Number</TableCell>
                    <TableCell>PO Number</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Project</TableCell>
                    <TableCell align="right">PO Amount</TableCell>
                    <TableCell>Condition</TableCell>
                    <TableCell>Assigned To</TableCell>
                    <TableCell>Date Sent</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingGRs.map((item) => (
                    <TableRow key={item.gr.id}>
                      <TableCell>
                        <Link
                          href={`/procurement/goods-receipts/${item.gr.id}`}
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            router.push(`/procurement/goods-receipts/${item.gr.id}`);
                          }}
                          sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          {item.gr.number}
                          <OpenInNewIcon fontSize="small" sx={{ fontSize: 14 }} />
                        </Link>
                      </TableCell>
                      <TableCell>{item.gr.poNumber}</TableCell>
                      <TableCell>{item.vendorName}</TableCell>
                      <TableCell>{item.gr.projectName}</TableCell>
                      <TableCell align="right">
                        {formatAmount(item.poTotalAmount, item.currency)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.gr.overallCondition.replace('_', ' ')}
                          color={
                            item.gr.overallCondition === 'ACCEPTED'
                              ? 'success'
                              : item.gr.overallCondition === 'CONDITIONALLY_ACCEPTED'
                                ? 'warning'
                                : 'error'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{item.gr.accountingAssigneeName || '—'}</TableCell>
                      <TableCell>{formatDate(item.gr.sentToAccountingAt)}</TableCell>
                      <TableCell align="right">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={
                            creatingBillFor === item.gr.id ? (
                              <CircularProgress size={16} />
                            ) : (
                              <ReceiptIcon />
                            )
                          }
                          onClick={() => setConfirmGR(item)}
                          disabled={creatingBillFor !== null}
                        >
                          Create Bill
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Stack>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmGR} onClose={() => setConfirmGR(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Vendor Bill</DialogTitle>
        <DialogContent>
          {confirmGR && (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Typography>This will create a vendor bill with GL entries for:</Typography>
              <Typography variant="body2" color="text.secondary">
                GR: {confirmGR.gr.number} &bull; PO: {confirmGR.gr.poNumber}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Vendor: {confirmGR.vendorName} &bull; Amount:{' '}
                {formatAmount(confirmGR.poTotalAmount, confirmGR.currency)}
              </Typography>
              <Alert severity="info" sx={{ mt: 1 }}>
                The bill amount will be calculated based on accepted quantities in the goods
                receipt, which may differ from the PO total shown above.
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmGR(null)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<ReceiptIcon />}
            onClick={() => confirmGR && handleCreateBill(confirmGR)}
          >
            Create Bill
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
