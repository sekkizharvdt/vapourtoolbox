'use client';

/**
 * Purchase Order Detail Page
 *
 * View PO details with approval workflow
 */

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Box, Stack, CircularProgress, Alert, Button } from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { Home as HomeIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import {
  getPOById,
  getPOItems,
  submitPOForApproval,
  firstApprovePO,
  approvePO,
  rejectPO,
  issuePO,
  updatePOStatus,
  updatePOItemHsnSac,
  addPOAttachment,
  removePOAttachment,
} from '@/lib/procurement/purchaseOrderService';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import { purchaseOrderStateMachine } from '@/lib/workflow/stateMachines';
import { toDate } from '@/lib/utils/date';
import DocumentUploadWidget from '@/components/procurement/DocumentUploadWidget';
import { downloadPOPDF } from '@/lib/procurement/poPDF';
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
  const { user, claims } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
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

  const handleUpdateHsnSac = async (itemId: string, hsnSacCode: string) => {
    if (!user) return;
    try {
      await updatePOItemHsnSac(itemId, hsnSacCode, user.uid, claims?.permissions || 0);
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, hsnSacCode } : it)));
    } catch (err) {
      console.error('[PODetailPage] Error updating HSN/SAC:', err);
      setError(err instanceof Error ? err.message : 'Failed to update HSN/SAC');
    }
  };

  const handleUploadAttachment = async (file: File) => {
    if (!user || !poId) return;
    const attachment = await addPOAttachment(poId, file, user.uid, claims?.permissions || 0);
    setPO((prev) =>
      prev ? { ...prev, attachments: [...(prev.attachments ?? []), attachment] } : prev
    );
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!user || !poId) return;
    await removePOAttachment(poId, attachmentId, user.uid, claims?.permissions || 0);
    setPO((prev) =>
      prev
        ? { ...prev, attachments: (prev.attachments ?? []).filter((a) => a.id !== attachmentId) }
        : prev
    );
  };

  const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_PROCUREMENT);

  const handleSubmitForApproval = async () => {
    if (!user || !po || !poId) return;

    if (!dialogState.selectedApproverId || !dialogState.selectedSecondApproverId) {
      setError('Select both the first and second approvers');
      return;
    }

    setActionLoading(true);
    try {
      await submitPOForApproval(
        poId,
        user.uid,
        user.displayName || 'Unknown',
        claims?.permissions || 0,
        dialogState.selectedApproverId,
        dialogState.selectedSecondApproverId,
        dialogState.selectedApproverName || undefined,
        dialogState.selectedSecondApproverName || undefined
      );
      dialogState.resetSubmitForm();
      await loadPO();
    } catch (err) {
      console.error('[PODetailPage] Error submitting PO:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit PO for approval');
    } finally {
      setActionLoading(false);
    }
  };

  const openSubmitDialog = () => {
    // Pre-fill the first approver with the source PR's requester (editable).
    // Skip if the requester is the PO creator — an approver can't be the creator.
    if (po?.requestedBy && po.requestedBy !== po.createdBy) {
      dialogState.setSelectedApprover(po.requestedBy, po.requestedByName || '');
    }
    dialogState.setSubmitDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!user || !po || !poId || !claims) return;

    setActionLoading(true);
    try {
      if (po.status === 'PENDING_APPROVAL') {
        // First approver.
        await firstApprovePO(
          poId,
          user.uid,
          user.displayName || 'Unknown',
          dialogState.approvalComments
        );
      } else {
        // Second / final approver.
        await approvePO(
          poId,
          user.uid,
          user.displayName || 'Unknown',
          dialogState.approvalComments
        );
      }
      dialogState.resetApprovalForm();
      await loadPO();
    } catch (err) {
      console.error('[PODetailPage] Error approving PO:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to approve PO';
      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!user || !po || !poId || !claims || !dialogState.rejectionReason.trim()) return;

    setActionLoading(true);
    try {
      await rejectPO(
        poId,
        user.uid,
        user.displayName || 'Unknown',
        claims.permissions,
        dialogState.rejectionReason
      );
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
    if (!user || !po || !poId || !claims) return;

    setActionLoading(true);
    try {
      await issuePO(
        poId,
        user.uid,
        user.displayName || user.email || 'Unknown',
        claims.permissions
      );
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

  const handleDownloadPDF = async () => {
    if (!po) return;

    setPdfLoading(true);
    try {
      await downloadPOPDF(po, items);
    } catch (err) {
      console.error('[PODetailPage] Error generating PDF:', err);
      setError('Failed to generate PDF');
    } finally {
      setPdfLoading(false);
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
        <Button onClick={() => router.push('/procurement/pos')} sx={{ mt: 2 }}>
          Back to Purchase Orders
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Breadcrumbs */}
        <PageBreadcrumbs
          items={[
            {
              label: 'Purchase Orders',
              href: '/procurement/pos',
              icon: <HomeIcon fontSize="small" />,
            },
            { label: po.number },
          ]}
        />

        <POHeader
          po={po}
          onBack={() => router.push('/procurement/pos')}
          onEdit={() => router.push(`/procurement/pos/${poId}/edit`)}
          onSubmitForApproval={openSubmitDialog}
          onApprove={() => dialogState.setApproveDialogOpen(true)}
          onReject={() => dialogState.setRejectDialogOpen(true)}
          onIssue={() => dialogState.setIssueDialogOpen(true)}
          onCancel={() => dialogState.setCancelDialogOpen(true)}
          onCreateGoodsReceipt={() => router.push(`/procurement/goods-receipts/new?poId=${poId}`)}
          onCreateWorkCompletion={() =>
            router.push(`/procurement/work-completion/new?poId=${poId}`)
          }
          onDownloadPDF={handleDownloadPDF}
          pdfLoading={pdfLoading}
        />

        {error && <Alert severity="error">{error}</Alert>}

        <POProgressIndicators po={po} />
        <PODetailsSection po={po} />
        <FinancialSummarySection po={po} />
        <POLineItemsTable
          po={po}
          items={items}
          editable={canManage && !purchaseOrderStateMachine.isTerminal(po.status)}
          onUpdateHsnSac={handleUpdateHsnSac}
        />
        <POTermsSection po={po} />
        <POApprovalInfo po={po} />
        <DocumentUploadWidget
          documents={(po.attachments ?? []).map((a) => ({
            id: a.id,
            fileName: a.fileName,
            fileUrl: a.fileUrl,
            fileSize: a.fileSize,
            uploadedAt: toDate(a.uploadedAt) ?? new Date(0),
          }))}
          onUpload={handleUploadAttachment}
          onDelete={handleDeleteAttachment}
          onDownload={(d) => window.open(d.fileUrl, '_blank')}
          disabled={!canManage}
        />
      </Stack>

      <POWorkflowDialogs
        dialogState={dialogState}
        actionLoading={actionLoading}
        approvalStage={po.status === 'PENDING_APPROVAL' ? 'FIRST' : 'FINAL'}
        onSubmitForApproval={handleSubmitForApproval}
        onApprove={handleApprove}
        onReject={handleReject}
        onIssue={handleIssue}
        onCancel={handleCancel}
      />
    </Box>
  );
}
