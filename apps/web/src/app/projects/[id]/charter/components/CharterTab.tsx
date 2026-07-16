'use client';

import { useState, lazy, Suspense } from 'react';

import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  TextField,
  Alert,
  Card,
  CardContent,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Edit as EditIcon,
  Send as SubmitIcon,
} from '@mui/icons-material';
import type { Project, OrderAcceptanceStatus } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  canManageProjects,
  CHARTER_APPROVAL_STATUS_LABELS,
  ORDER_ACCEPTANCE_STATUS_LABELS,
} from '@vapour/constants';
import { StatusChip, LoadingState } from '@vapour/ui';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { formatDate, formatCurrencyCode } from '@/lib/utils/formatters';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import type { OrderAcceptanceFormData } from './RecordOrderAcceptanceDialog';

const RecordOrderAcceptanceDialog = lazy(() =>
  import('./RecordOrderAcceptanceDialog').then((m) => ({
    default: m.RecordOrderAcceptanceDialog,
  }))
);

function DialogLoader() {
  return <LoadingState variant="inline" sx={{ p: 4 }} />;
}

interface CharterTabProps {
  project: Project;
}

export function CharterTab({ project }: CharterTabProps) {
  const { claims, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Form state for charter authorization
  const [sponsorName, setSponsorName] = useState(project.charter?.authorization?.sponsorName || '');
  const [sponsorTitle, setSponsorTitle] = useState(
    project.charter?.authorization?.sponsorTitle || ''
  );
  const [budgetAuthority, setBudgetAuthority] = useState(
    project.charter?.authorization?.budgetAuthority || ''
  );

  const hasManageAccess = claims?.permissions ? canManageProjects(claims.permissions) : false;
  const userId = user?.uid || '';
  const userName = user?.displayName || user?.email || 'Unknown User';

  const charter = project.charter;
  const authorization = charter?.authorization;
  const approvalStatus = authorization?.approvalStatus || 'DRAFT';

  // Workflow gating (rules 6, 8, 10):
  // - DRAFT: anyone with MANAGE_PROJECTS submits for approval
  // - PENDING_APPROVAL: anyone with MANAGE_PROJECTS EXCEPT the submitter approves/rejects
  // - APPROVED is terminal — no actions
  const isSubmitter = !!authorization?.submittedBy && authorization.submittedBy === userId;
  const canEdit = hasManageAccess && approvalStatus === 'DRAFT';
  const canSubmit = hasManageAccess && approvalStatus === 'DRAFT' && !!authorization?.sponsorName;
  const canApprove = hasManageAccess && approvalStatus === 'PENDING_APPROVAL' && !isSubmitter;

  // Rejection dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Submit/approve confirmation dialogs
  const [showWarningConfirm, setShowWarningConfirm] = useState(false);
  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false);
  const [pendingWarnings, setPendingWarnings] = useState<string[]>([]);

  // --- Order Acceptance (charter.orderAcceptance) ---
  const orderAcceptance = charter?.orderAcceptance;
  const oaStatus: OrderAcceptanceStatus = orderAcceptance?.status || 'DRAFT';

  // Workflow gating mirrors the authorization block above (rules 6, 8, 10):
  // - No record yet, or DRAFT: anyone with MANAGE_PROJECTS can record/edit
  // - PENDING_APPROVAL: anyone with MANAGE_PROJECTS EXCEPT the submitter approves/rejects
  // - APPROVED is terminal; REJECTED must be explicitly reopened to DRAFT
  const oaIsSubmitter = !!orderAcceptance?.submittedBy && orderAcceptance.submittedBy === userId;
  const canEditOA = hasManageAccess && (!orderAcceptance || oaStatus === 'DRAFT');
  const canSubmitOA = hasManageAccess && !!orderAcceptance && oaStatus === 'DRAFT';
  const canApproveOA = hasManageAccess && oaStatus === 'PENDING_APPROVAL' && !oaIsSubmitter;
  const canReopenOA = hasManageAccess && oaStatus === 'REJECTED';

  const [orderAcceptanceDialogOpen, setOrderAcceptanceDialogOpen] = useState(false);
  const [oaRejectDialogOpen, setOaRejectDialogOpen] = useState(false);
  const [oaRejectionReason, setOaRejectionReason] = useState('');
  const [showOAApprovalConfirm, setShowOAApprovalConfirm] = useState(false);

  const handleSaveOrderAcceptance = async (data: OrderAcceptanceFormData) => {
    setLoading(true);
    setError(null);
    try {
      const { db } = getFirebase();
      const { saveOrderAcceptanceDraft } = await import('@/lib/projects/orderAcceptanceService');
      await saveOrderAcceptanceDraft(
        db,
        project.id,
        data,
        userId,
        userName,
        claims?.permissions ?? 0
      );
      setOrderAcceptanceDialogOpen(false);
      toast.success('Order acceptance draft saved');
    } catch (err) {
      console.error('[CharterTab] Error saving order acceptance draft:', err);
      const message = err instanceof Error ? err.message : 'Failed to save order acceptance draft';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOrderAcceptance = async () => {
    setLoading(true);
    setError(null);
    try {
      const { db } = getFirebase();
      const { submitOrderAcceptanceForApproval } =
        await import('@/lib/projects/orderAcceptanceService');
      await submitOrderAcceptanceForApproval(
        db,
        project.id,
        userId,
        userName,
        claims?.permissions ?? 0
      );
      toast.success('Order acceptance submitted for approval');
    } catch (err) {
      console.error('[CharterTab] Error submitting order acceptance:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to submit order acceptance for approval';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const proceedWithOAApproval = async () => {
    setShowOAApprovalConfirm(false);
    setLoading(true);
    setError(null);
    try {
      const { db } = getFirebase();
      const { approveOrderAcceptance } = await import('@/lib/projects/orderAcceptanceService');
      await approveOrderAcceptance(db, project.id, userId, userName, claims?.permissions ?? 0);
      toast.success('Order acceptance approved and applied to the charter');
    } catch (err) {
      console.error('[CharterTab] Error approving order acceptance:', err);
      const message = err instanceof Error ? err.message : 'Failed to approve order acceptance';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectOrderAcceptance = () => {
    setOaRejectionReason('');
    setOaRejectDialogOpen(true);
  };

  const confirmRejectOrderAcceptance = async () => {
    if (!oaRejectionReason.trim()) {
      return;
    }
    setOaRejectDialogOpen(false);
    setLoading(true);
    setError(null);
    try {
      const { db } = getFirebase();
      const { rejectOrderAcceptance } = await import('@/lib/projects/orderAcceptanceService');
      await rejectOrderAcceptance(
        db,
        project.id,
        userId,
        userName,
        claims?.permissions ?? 0,
        oaRejectionReason.trim()
      );
      toast.success('Order acceptance rejected');
    } catch (err) {
      console.error('[CharterTab] Error rejecting order acceptance:', err);
      const message = err instanceof Error ? err.message : 'Failed to reject order acceptance';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setOaRejectionReason('');
    }
  };

  const handleReopenOrderAcceptance = async () => {
    setLoading(true);
    setError(null);
    try {
      const { db } = getFirebase();
      const { reopenOrderAcceptance } = await import('@/lib/projects/orderAcceptanceService');
      await reopenOrderAcceptance(db, project.id, userId, userName, claims?.permissions ?? 0);
      toast.success('Order acceptance reopened for revision');
    } catch (err) {
      console.error('[CharterTab] Error reopening order acceptance:', err);
      const message = err instanceof Error ? err.message : 'Failed to reopen order acceptance';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAuthorization = async () => {
    if (!sponsorName.trim() || !sponsorTitle.trim()) {
      setError('Sponsor name and title are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      await updateDoc(projectRef, {
        'charter.authorization': {
          sponsorName: sponsorName.trim(),
          sponsorTitle: sponsorTitle.trim(),
          budgetAuthority: budgetAuthority.trim(),
          approvalStatus: 'DRAFT',
          authorizedDate: null,
          submittedBy: null,
          submittedByName: null,
          submittedAt: null,
          approvedBy: null,
          approvedAt: null,
          rejectionReason: null,
        },
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      setEditMode(false);
    } catch (err) {
      console.error('[CharterTab] Error saving authorization:', err);
      setError(err instanceof Error ? err.message : 'Failed to save charter authorization');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Submit for approval (DRAFT → PENDING_APPROVAL). Validation runs here so
   * the author fixes gaps before an approver ever sees the charter; the
   * service re-validates server-side.
   */
  const handleSubmitForApproval = async () => {
    const { validateCharterForApproval, getValidationSummary } =
      await import('@/lib/projects/charterValidationService');

    const validationResult = validateCharterForApproval(project.charter);

    if (!validationResult.isValid) {
      const summary = getValidationSummary(validationResult);
      setError(
        `Cannot submit charter - validation failed:\n\n${summary}\n\nPlease complete all required sections before submitting for approval.`
      );
      return;
    }

    // Show warnings if any - use dialog instead of window.confirm
    if (validationResult.warnings.length > 0) {
      setPendingWarnings(validationResult.warnings);
      setShowWarningConfirm(true);
      return;
    }

    await proceedWithSubmission();
  };

  const proceedWithSubmission = async () => {
    setShowWarningConfirm(false);
    setPendingWarnings([]);
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const { submitCharterForApproval } = await import('@/lib/projects/charterApprovalService');
      await submitCharterForApproval(db, project.id, userId, userName, claims?.permissions ?? 0);
    } catch (err) {
      console.error('[CharterTab] Error submitting charter for approval:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit charter for approval');
    } finally {
      setLoading(false);
    }
  };

  const proceedWithApproval = async () => {
    setShowApprovalConfirm(false);
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const { approveCharter } = await import('@/lib/projects/charterApprovalService');
      await approveCharter(db, project.id, userId, userName, claims?.permissions ?? 0);
    } catch (err) {
      console.error('[CharterTab] Error approving charter:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve charter');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const confirmRejection = async () => {
    if (!rejectionReason.trim()) {
      return;
    }

    setRejectDialogOpen(false);
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const { rejectCharter } = await import('@/lib/projects/charterApprovalService');
      await rejectCharter(
        db,
        project.id,
        userId,
        userName,
        claims?.permissions ?? 0,
        rejectionReason.trim()
      );
    } catch (err) {
      console.error('[CharterTab] Error rejecting charter:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject charter');
    } finally {
      setLoading(false);
      setRejectionReason('');
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Authorization Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Project Authorization</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <StatusChip
              status={approvalStatus}
              labels={CHARTER_APPROVAL_STATUS_LABELS}
              context="charterApproval"
            />
            {canEdit && !editMode && (
              <Button size="small" startIcon={<EditIcon />} onClick={() => setEditMode(true)}>
                Edit
              </Button>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {editMode ? (
          // Edit Mode
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Sponsor Name"
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Sponsor Title"
                value={sponsorTitle}
                onChange={(e) => setSponsorTitle(e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Budget Authority"
                value={budgetAuthority}
                onChange={(e) => setBudgetAuthority(e.target.value)}
                placeholder="Person/Department authorizing budget"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="contained" onClick={handleSaveAuthorization} disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </Button>
                <Button onClick={() => setEditMode(false)} disabled={loading}>
                  Cancel
                </Button>
              </Box>
            </Grid>
          </Grid>
        ) : (
          // View Mode
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Sponsor Name
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {authorization?.sponsorName || 'Not set'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Sponsor Title
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {authorization?.sponsorTitle || 'Not set'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Budget Authority
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {authorization?.budgetAuthority || 'Not set'}
              </Typography>
            </Grid>
            {authorization?.submittedByName && approvalStatus !== 'APPROVED' && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Submitted By
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {authorization.submittedByName}
                  {authorization.submittedAt ? ` on ${formatDate(authorization.submittedAt)}` : ''}
                </Typography>
              </Grid>
            )}
            {authorization?.authorizedDate && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Authorized Date
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formatDate(authorization.authorizedDate)}
                </Typography>
              </Grid>
            )}
            {authorization?.approvedBy && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Approved By
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {authorization.approvedBy}
                </Typography>
              </Grid>
            )}
            {authorization?.approvedAt && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  Approved At
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formatDate(authorization.approvedAt)}
                </Typography>
              </Grid>
            )}
            {authorization?.rejectionReason && approvalStatus === 'DRAFT' && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="warning">
                  <Typography variant="body2" fontWeight="medium">
                    Returned for revision:
                  </Typography>
                  <Typography variant="body2">{authorization.rejectionReason}</Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        )}

        {/* Workflow Actions */}
        {canSubmit && !editMode && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<SubmitIcon />}
              onClick={handleSubmitForApproval}
              disabled={loading}
            >
              Submit for Approval
            </Button>
          </Box>
        )}

        {canApprove && !editMode && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<ApproveIcon />}
              onClick={() => setShowApprovalConfirm(true)}
              disabled={loading}
            >
              Approve Charter
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<RejectIcon />}
              onClick={handleReject}
              disabled={loading}
            >
              Reject
            </Button>
          </Box>
        )}

        {/* Submitter cannot approve their own charter (separation of duty, rule 10) */}
        {approvalStatus === 'PENDING_APPROVAL' && isSubmitter && (
          <Alert severity="info" sx={{ mt: 3 }}>
            You submitted this charter for approval. Another user with project management access
            must approve or reject it.
          </Alert>
        )}

        {!authorization?.sponsorName && !editMode && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Charter authorization information is not set. Click &quot;Edit&quot; to add sponsor
            details.
          </Alert>
        )}
      </Paper>

      {/* Order Acceptance Section — the delta between the proposal and the
          customer's actually-signed order/agreement. Co-located with
          Authorization above rather than a new tab (both are charter-
          governance concerns, CLAUDE.md rule 34 anti-tab-sprawl). */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Order Acceptance</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <StatusChip
              status={oaStatus}
              labels={ORDER_ACCEPTANCE_STATUS_LABELS}
              context="orderAcceptance"
            />
            {canEditOA && (
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => setOrderAcceptanceDialogOpen(true)}
              >
                {orderAcceptance ? 'Edit' : 'Record'}
              </Button>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Record the signed customer order/agreement when it differs from the submitted proposal
          (schedule, payment terms, retention, deliverables register, key personnel). Approving
          these terms applies them onto the charter automatically.
        </Typography>

        {orderAcceptance ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="body2" color="text.secondary">
                Document Reference
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {orderAcceptance.documentReference || 'Not set'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="body2" color="text.secondary">
                Signature Date
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {orderAcceptance.documentDate
                  ? formatDate(orderAcceptance.documentDate)
                  : 'Not set'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="body2" color="text.secondary">
                Contract Value
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {orderAcceptance.contractValue
                  ? formatCurrencyCode(
                      orderAcceptance.contractValue.amount,
                      orderAcceptance.contractValue.currency
                    )
                  : 'Not set'}
              </Typography>
            </Grid>
            {orderAcceptance.terms?.scheduleDurationDays !== undefined && (
              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Schedule Duration
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {orderAcceptance.terms.scheduleDurationDays} days
                </Typography>
              </Grid>
            )}
            {orderAcceptance.terms?.paymentTermsDays !== undefined && (
              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Payment Terms
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {orderAcceptance.terms.paymentTermsDays} days
                  {orderAcceptance.terms.retentionPercentage !== undefined
                    ? ` · ${orderAcceptance.terms.retentionPercentage}% retention`
                    : ''}
                </Typography>
              </Grid>
            )}
            {orderAcceptance.terms?.deliverables &&
              orderAcceptance.terms.deliverables.length > 0 && (
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Deliverables Register
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {orderAcceptance.terms.deliverables.length} item(s)
                  </Typography>
                </Grid>
              )}
            {orderAcceptance.submittedByName && oaStatus !== 'APPROVED' && (
              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Submitted By
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {orderAcceptance.submittedByName}
                  {orderAcceptance.submittedAt
                    ? ` on ${formatDate(orderAcceptance.submittedAt)}`
                    : ''}
                </Typography>
              </Grid>
            )}
            {orderAcceptance.approvedByName && (
              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Approved By
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {orderAcceptance.approvedByName}
                  {orderAcceptance.approvedAt
                    ? ` on ${formatDate(orderAcceptance.approvedAt)}`
                    : ''}
                </Typography>
              </Grid>
            )}
            {orderAcceptance.applied && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="success" variant="outlined">
                  Terms applied to the charter
                  {orderAcceptance.appliedAt ? ` on ${formatDate(orderAcceptance.appliedAt)}` : ''}.
                </Alert>
              </Grid>
            )}
            {orderAcceptance.rejectionReason && oaStatus === 'REJECTED' && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="warning">
                  <Typography variant="body2" fontWeight="medium">
                    Rejected:
                  </Typography>
                  <Typography variant="body2">{orderAcceptance.rejectionReason}</Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        ) : (
          <Alert severity="info">
            No order acceptance recorded yet. If the signed customer order/agreement differs from
            the proposal, click &quot;Record&quot; to capture the delta.
          </Alert>
        )}

        {/* Workflow Actions */}
        {canSubmitOA && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<SubmitIcon />}
              onClick={handleSubmitOrderAcceptance}
              disabled={loading}
            >
              Submit for Approval
            </Button>
          </Box>
        )}

        {canApproveOA && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<ApproveIcon />}
              onClick={() => setShowOAApprovalConfirm(true)}
              disabled={loading}
            >
              Approve &amp; Apply to Charter
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<RejectIcon />}
              onClick={handleRejectOrderAcceptance}
              disabled={loading}
            >
              Reject
            </Button>
          </Box>
        )}

        {/* Submitter cannot approve their own terms (separation of duty, rule 10) */}
        {oaStatus === 'PENDING_APPROVAL' && oaIsSubmitter && (
          <Alert severity="info" sx={{ mt: 3 }}>
            You submitted these order acceptance terms. Another user with project management access
            must approve or reject them.
          </Alert>
        )}

        {canReopenOA && (
          <Box sx={{ mt: 3 }}>
            <Button variant="outlined" onClick={handleReopenOrderAcceptance} disabled={loading}>
              Reopen for Revision
            </Button>
          </Box>
        )}
      </Paper>

      {/* Charter Summary Cards */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Objectives
              </Typography>
              <Typography variant="h3">{charter?.objectives?.length || 0}</Typography>
              <Typography variant="body2" color="text.secondary">
                Defined objectives
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Deliverables
              </Typography>
              <Typography variant="h3">{charter?.deliverables?.length || 0}</Typography>
              <Typography variant="body2" color="text.secondary">
                Project deliverables
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Risks Identified
              </Typography>
              <Typography variant="h3">{charter?.risks?.length || 0}</Typography>
              <Typography variant="body2" color="text.secondary">
                Risk assessment
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Future: Add objectives, deliverables, scope, risks editing UI */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2" fontWeight="medium" gutterBottom>
          Charter Details Management
        </Typography>
        <Typography variant="body2">
          Objectives, deliverables, scope, risks, and stakeholder management features are available
          for future enhancement. For now, focus on authorization and approval workflow.
        </Typography>
      </Alert>

      {/* Rejection Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Charter</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            The charter will be returned to Draft for the submitter to revise and re-submit.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Rejection Reason"
            fullWidth
            multiline
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Please provide a reason for rejecting this charter..."
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={confirmRejection}
            color="error"
            variant="contained"
            disabled={!rejectionReason.trim()}
          >
            Reject Charter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Warning Confirmation Dialog (pre-submission validation warnings) */}
      <ConfirmDialog
        open={showWarningConfirm}
        title="Charter Validation Warnings"
        message={
          <>
            <Typography variant="body2" gutterBottom>
              Charter validation passed with the following warnings:
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              {pendingWarnings.map((warning, idx) => (
                <Typography component="li" variant="body2" key={idx}>
                  {warning}
                </Typography>
              ))}
            </Box>
            <Typography variant="body2" sx={{ mt: 2 }}>
              Do you want to proceed with submitting for approval?
            </Typography>
          </>
        }
        confirmLabel="Submit"
        variant="warning"
        onConfirm={proceedWithSubmission}
        onClose={() => {
          setShowWarningConfirm(false);
          setPendingWarnings([]);
        }}
      />

      {/* Approval Confirmation Dialog */}
      <ConfirmDialog
        open={showApprovalConfirm}
        title="Approve Project Charter"
        message="Approve this project charter? This will trigger automatic PR creation for HIGH/CRITICAL procurement items."
        confirmLabel="Approve"
        variant="info"
        onConfirm={proceedWithApproval}
        onClose={() => setShowApprovalConfirm(false)}
      />

      {/* Record / Edit Order Acceptance Dialog — lazy loaded */}
      {orderAcceptanceDialogOpen && (
        <Suspense fallback={<DialogLoader />}>
          <RecordOrderAcceptanceDialog
            open={orderAcceptanceDialogOpen}
            onClose={() => setOrderAcceptanceDialogOpen(false)}
            record={orderAcceptance}
            onSave={handleSaveOrderAcceptance}
            loading={loading}
          />
        </Suspense>
      )}

      {/* Order Acceptance Rejection Dialog */}
      <Dialog
        open={oaRejectDialogOpen}
        onClose={() => setOaRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Order Acceptance</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            These terms will be returned for revision. The submitter (or another user with project
            management access) can reopen and resubmit them.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Rejection Reason"
            fullWidth
            multiline
            rows={3}
            value={oaRejectionReason}
            onChange={(e) => setOaRejectionReason(e.target.value)}
            placeholder="Please provide a reason for rejecting these terms..."
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOaRejectDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={confirmRejectOrderAcceptance}
            color="error"
            variant="contained"
            disabled={!oaRejectionReason.trim()}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Order Acceptance Approval Confirmation Dialog */}
      <ConfirmDialog
        open={showOAApprovalConfirm}
        title="Approve Order Acceptance"
        message="Approve these order acceptance terms? This will apply them onto the charter's schedule, payment terms, key personnel, and deliverables register immediately."
        confirmLabel="Approve & Apply"
        variant="info"
        onConfirm={proceedWithOAApproval}
        onClose={() => setShowOAApprovalConfirm(false)}
      />
    </Box>
  );
}
