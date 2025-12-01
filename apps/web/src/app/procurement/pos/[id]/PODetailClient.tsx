'use client';

/**
 * Purchase Order Detail Page
 *
 * View PO details with approval workflow
 */

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Box, Stack, CircularProgress, Alert, Button } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import {
  getPOById,
  getPOItems,
  submitPOForApproval,
  approvePO,
  rejectPO,
  issuePO,
  updatePOStatus,
} from '@/lib/procurement/purchaseOrderService';
import { useWorkflowDialogs } from './components/useWorkflowDialogs';
import { POHeader } from './components/POHeader';
import { POProgressIndicators } from './components/POProgressIndicators';
import { PODetailsSection } from './components/PODetailsSection';
import { FinancialSummarySection } from './components/FinancialSummarySection';
import { POLineItemsTable } from './components/POLineItemsTable';
import { POTermsSection } from './components/POTermsSection';
import { POApprovalInfo } from './components/POApprovalInfo';
import { POWorkflowDialogs } from './components/POWorkflowDialogs';

export default function PODetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [poId, setPoId] = useState<string | null>(null);

  const dialogState = useWorkflowDialogs();

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/procurement\/pos\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setPoId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (poId) {
      loadPO();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId]);

  const loadPO = async () => {
    if (!poId) return;
    setLoading(true);
    setError('');
    try {
      const [poData, itemsData] = await Promise.all([getPOById(poId), getPOItems(poId)]);

      if (!poData) {
        setError('Purchase Order not found');
        return;
      }

      setPO(poData);
      setItems(itemsData);
    } catch (err) {
      console.error('[PODetailPage] Error loading PO:', err);
      setError('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!user || !po || !poId) return;

    setActionLoading(true);
    try {
      await submitPOForApproval(
        poId,
        user.uid,
        user.displayName || 'Unknown',
        dialogState.selectedApproverId || undefined
      );
      dialogState.resetSubmitForm();
      await loadPO();
    } catch (err) {
      console.error('[PODetailPage] Error submitting PO:', err);
      setError('Failed to submit PO for approval');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!user || !po || !poId) return;

    setActionLoading(true);
    try {
      await approvePO(poId, user.uid, user.displayName || 'Unknown', dialogState.approvalComments);
      dialogState.resetApprovalForm();
      await loadPO();
    } catch (err) {
      console.error('[PODetailPage] Error approving PO:', err);
      setError('Failed to approve PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!user || !po || !poId || !dialogState.rejectionReason.trim()) return;

    setActionLoading(true);
    try {
      await rejectPO(poId, user.uid, user.displayName || 'Unknown', dialogState.rejectionReason);
      dialogState.resetRejectionForm();
      await loadPO();
    } catch (err) {
      console.error('[PODetailPage] Error rejecting PO:', err);
      setError('Failed to reject PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssue = async () => {
    if (!user || !po || !poId) return;

    setActionLoading(true);
    try {
      await issuePO(poId, user.uid, user.displayName || user.email || 'Unknown');
      dialogState.setIssueDialogOpen(false);
      await loadPO();
    } catch (err) {
      console.error('[PODetailPage] Error issuing PO:', err);
      setError('Failed to issue PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!user || !po || !poId || !dialogState.cancellationReason.trim()) return;

    setActionLoading(true);
    try {
      await updatePOStatus(poId, 'CANCELLED', user.uid);
      dialogState.resetCancellationForm();
      await loadPO();
    } catch (err) {
      console.error('[PODetailPage] Error cancelling PO:', err);
      setError('Failed to cancel PO');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !po) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Purchase Order not found'}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/procurement/pos')}
          sx={{ mt: 2 }}
        >
          Back to Purchase Orders
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <POHeader
          po={po}
          onBack={() => router.push('/procurement/pos')}
          onSubmitForApproval={() => dialogState.setSubmitDialogOpen(true)}
          onApprove={() => dialogState.setApproveDialogOpen(true)}
          onReject={() => dialogState.setRejectDialogOpen(true)}
          onIssue={() => dialogState.setIssueDialogOpen(true)}
          onCancel={() => dialogState.setCancelDialogOpen(true)}
        />

        {error && <Alert severity="error">{error}</Alert>}

        <POProgressIndicators po={po} />
        <PODetailsSection po={po} />
        <FinancialSummarySection po={po} />
        <POLineItemsTable po={po} items={items} />
        <POTermsSection po={po} />
        <POApprovalInfo po={po} />
      </Stack>

      <POWorkflowDialogs
        dialogState={dialogState}
        actionLoading={actionLoading}
        onSubmitForApproval={handleSubmitForApproval}
        onApprove={handleApprove}
        onReject={handleReject}
        onIssue={handleIssue}
        onCancel={handleCancel}
      />
    </Box>
  );
}
