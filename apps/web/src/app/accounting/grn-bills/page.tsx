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
} from '@/lib/procurement/accountingIntegration';
import type { GoodsReceipt } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

export default function GRNBillsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingGRs, setPendingGRs] = useState<GoodsReceipt[]>([]);
  const [creatingBillFor, setCreatingBillFor] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

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

  const handleCreateBill = async (gr: GoodsReceipt) => {
    if (!user) return;

    setCreatingBillFor(gr.id);
    setError('');
    setSuccessMessage('');
    try {
      const { db } = getFirebase();
      const billId = await createBillFromGoodsReceipt(db, gr, user.uid, user.email || '');
      setSuccessMessage(`Bill created successfully for ${gr.number} (ID: ${billId})`);
      // Remove the GR from the list
      setPendingGRs((prev) => prev.filter((g) => g.id !== gr.id));
    } catch (err) {
      console.error('[GRNBillsPage] Error creating bill:', err);
      setError(
        `Failed to create bill for ${gr.number}. Please check system accounts are configured in Chart of Accounts.`
      );
    } finally {
      setCreatingBillFor(null);
    }
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
                    <TableCell>Project</TableCell>
                    <TableCell>Condition</TableCell>
                    <TableCell>Sent By</TableCell>
                    <TableCell>Date Sent</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingGRs.map((gr) => (
                    <TableRow key={gr.id}>
                      <TableCell>
                        <Link
                          href={`/procurement/goods-receipts/${gr.id}`}
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            router.push(`/procurement/goods-receipts/${gr.id}`);
                          }}
                          sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          {gr.number}
                          <OpenInNewIcon fontSize="small" sx={{ fontSize: 14 }} />
                        </Link>
                      </TableCell>
                      <TableCell>{gr.poNumber}</TableCell>
                      <TableCell>{gr.projectName}</TableCell>
                      <TableCell>
                        <Chip
                          label={gr.overallCondition.replace('_', ' ')}
                          color={
                            gr.overallCondition === 'ACCEPTED'
                              ? 'success'
                              : gr.overallCondition === 'CONDITIONALLY_ACCEPTED'
                                ? 'warning'
                                : 'error'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{gr.accountingAssigneeName || '—'}</TableCell>
                      <TableCell>{formatDate(gr.sentToAccountingAt)}</TableCell>
                      <TableCell align="right">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={
                            creatingBillFor === gr.id ? (
                              <CircularProgress size={16} />
                            ) : (
                              <ReceiptIcon />
                            )
                          }
                          onClick={() => handleCreateBill(gr)}
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
    </Box>
  );
}
