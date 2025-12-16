'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Home as HomeIcon,
  MoreVert as MoreIcon,
  PictureAsPdf as PdfIcon,
  CloudUpload as SavePdfIcon,
  Edit as EditIcon,
  Send as SendIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  ChangeCircle as ChangesIcon,
  AccountTree as ProjectIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  CalendarToday as DateIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { Timestamp } from 'firebase/firestore';
import { PageHeader, LoadingState, EmptyState } from '@vapour/ui';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getProposalById } from '@/lib/proposal/proposalService';
import { generateAndDownloadProposalPDF } from '@/lib/proposals/proposalPDF';
import {
  submitProposalForApproval,
  approveProposal,
  rejectProposal,
  requestProposalChanges,
  getAvailableActions,
} from '@/lib/proposals/approvalWorkflow';
import { canConvertToProject } from '@/lib/proposals/projectConversion';
import type { Proposal } from '@vapour/types';
import { format } from 'date-fns';
import { logger } from '@vapour/logger';

// Import components we'll create
import StatusBadge from './components/StatusBadge';
import ApprovalHistory from './components/ApprovalHistory';
import ConvertToProjectDialog from './components/ConvertToProjectDialog';
import ProposalAttachments from './components/ProposalAttachments';

export default function ProposalDetailClient() {
  const pathname = usePathname();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useAuth();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [proposalId, setProposalId] = useState<string | null>(null);

  // Comment dialog state for approval actions
  const [commentDialog, setCommentDialog] = useState<{
    open: boolean;
    title: string;
    action: 'approve' | 'reject' | 'changes' | null;
    required: boolean;
  }>({ open: false, title: '', action: null, required: false });
  const [commentText, setCommentText] = useState('');

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/proposals\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setProposalId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (!db || !proposalId) return;

    const loadProposal = async () => {
      try {
        setLoading(true);
        const data = await getProposalById(db, proposalId);
        if (!data) {
          setError('Proposal not found');
        } else {
          setProposal(data);
        }
      } catch (err) {
        logger.error('Error loading proposal', { proposalId, error: err });
        setError('Failed to load proposal details');
      } finally {
        setLoading(false);
      }
    };

    loadProposal();
  }, [db, proposalId]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const reloadProposal = async () => {
    if (!db || !proposalId) return;
    try {
      const data = await getProposalById(db, proposalId);
      if (data) setProposal(data);
    } catch (err) {
      logger.error('Error reloading proposal', { error: err });
    }
  };

  const handleDownloadPDF = async (saveToStorage: boolean = false) => {
    if (!proposal || !db) return;
    try {
      setPdfGenerating(true);
      await generateAndDownloadProposalPDF(
        db,
        proposal,
        {
          showCostBreakdown: true,
          showIndirectCosts: true,
          includeTerms: true,
          includeDeliverySchedule: true,
        },
        saveToStorage
      );
      // Reload proposal to get updated PDF URL if saved
      if (saveToStorage) {
        await reloadProposal();
      }
    } catch (err) {
      logger.error('Error generating PDF', { error: err });
      setError('Failed to generate PDF');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!db || !proposal || !user) return;
    try {
      setActionLoading(true);
      await submitProposalForApproval(db, proposal.id, user.uid, user.displayName || 'Unknown');
      await reloadProposal();
      handleMenuClose();
    } catch (err) {
      logger.error('Error submitting for approval', { error: err });
      setError('Failed to submit proposal for approval');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = () => {
    setCommentDialog({
      open: true,
      title: 'Approve Proposal',
      action: 'approve',
      required: false,
    });
    setCommentText('');
  };

  const handleReject = () => {
    setCommentDialog({
      open: true,
      title: 'Reject Proposal',
      action: 'reject',
      required: true,
    });
    setCommentText('');
    handleMenuClose();
  };

  const handleRequestChanges = () => {
    setCommentDialog({
      open: true,
      title: 'Request Changes',
      action: 'changes',
      required: true,
    });
    setCommentText('');
    handleMenuClose();
  };

  const handleCommentDialogClose = () => {
    setCommentDialog({ open: false, title: '', action: null, required: false });
    setCommentText('');
  };

  const handleCommentSubmit = async () => {
    if (!db || !proposal || !user) return;
    if (commentDialog.required && !commentText.trim()) return;

    try {
      setActionLoading(true);
      handleCommentDialogClose();

      switch (commentDialog.action) {
        case 'approve':
          await approveProposal(
            db,
            proposal.id,
            user.uid,
            user.displayName || 'Unknown',
            commentText
          );
          break;
        case 'reject':
          await rejectProposal(
            db,
            proposal.id,
            user.uid,
            user.displayName || 'Unknown',
            commentText
          );
          break;
        case 'changes':
          await requestProposalChanges(
            db,
            proposal.id,
            user.uid,
            user.displayName || 'Unknown',
            commentText
          );
          break;
      }

      await reloadProposal();
    } catch (err) {
      logger.error(`Error ${commentDialog.action} proposal`, { error: err });
      setError(`Failed to ${commentDialog.action} proposal`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertToProject = () => {
    setConvertDialogOpen(true);
  };

  const handleConversionComplete = (projectId: string) => {
    setConvertDialogOpen(false);
    router.push(`/projects/${projectId}`);
  };

  const formatDate = (timestamp: Timestamp | Date | undefined) => {
    if (!timestamp) return '-';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    return format(date, 'MMM d, yyyy');
  };

  const formatCurrency = (money: { amount: number; currency: string } | undefined) => {
    if (!money) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: money.currency,
    }).format(money.amount);
  };

  if (loading) return <LoadingState message="Loading proposal details..." />;

  if (error || !proposal) {
    return (
      <Box sx={{ p: 3 }}>
        <EmptyState
          title="Proposal Not Found"
          message={error || "The proposal you're looking for doesn't exist or has been deleted."}
          action={<Button onClick={() => router.push('/proposals')}>Back to Proposals</Button>}
        />
      </Box>
    );
  }

  const actions = getAvailableActions(proposal.status);
  const canConvert = canConvertToProject(proposal);

  return (
    <Box>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/proposals"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/proposals');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Proposals
        </Link>
        <Typography color="text.primary">{proposal.proposalNumber}</Typography>
      </Breadcrumbs>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <PageHeader
        title={proposal.proposalNumber}
        subtitle={proposal.title}
        action={
          <Box sx={{ display: 'flex', gap: 2 }}>
            {/* PDF Actions */}
            {actions.canDownloadPDF && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<PdfIcon />}
                  onClick={() => handleDownloadPDF(false)}
                  disabled={pdfGenerating}
                >
                  {pdfGenerating ? 'Generating...' : 'Download PDF'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SavePdfIcon />}
                  onClick={() => handleDownloadPDF(true)}
                  disabled={pdfGenerating}
                  title="Download and save PDF to storage"
                >
                  Save PDF
                </Button>
              </>
            )}
            {/* View Saved PDF */}
            {proposal.generatedPdfUrl && (
              <Button
                variant="text"
                size="small"
                startIcon={<OpenIcon />}
                href={proposal.generatedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Saved PDF
              </Button>
            )}

            {/* Submit for Approval */}
            {actions.canSubmit && (
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={handleSubmitForApproval}
                disabled={actionLoading}
              >
                Submit for Approval
              </Button>
            )}

            {/* Approve */}
            {actions.canApprove && (
              <Button
                variant="contained"
                color="success"
                startIcon={<ApproveIcon />}
                onClick={handleApprove}
                disabled={actionLoading}
              >
                Approve
              </Button>
            )}

            {/* Convert to Project */}
            {canConvert.canConvert && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<ProjectIcon />}
                onClick={handleConvertToProject}
              >
                Convert to Project
              </Button>
            )}

            {/* Edit */}
            {actions.canEdit && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => router.push(`/proposals/${proposalId}/edit`)}
              >
                Edit
              </Button>
            )}

            {/* More Actions */}
            <IconButton onClick={handleMenuOpen}>
              <MoreIcon />
            </IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
              {actions.canReject && (
                <MenuItem onClick={handleReject} disabled={actionLoading}>
                  <ListItemIcon>
                    <RejectIcon fontSize="small" color="error" />
                  </ListItemIcon>
                  <ListItemText>Reject</ListItemText>
                </MenuItem>
              )}
              {actions.canRequestChanges && (
                <MenuItem onClick={handleRequestChanges} disabled={actionLoading}>
                  <ListItemIcon>
                    <ChangesIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Request Changes</ListItemText>
                </MenuItem>
              )}
            </Menu>
          </Box>
        }
      >
        <StatusBadge status={proposal.status} />
        {proposal.revision > 1 && (
          <Chip label={`Rev ${proposal.revision}`} variant="outlined" sx={{ ml: 1 }} />
        )}
      </PageHeader>

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Scope of Work */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Scope of Work
              </Typography>
              {proposal.scopeOfWork?.summary && (
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                  {proposal.scopeOfWork.summary}
                </Typography>
              )}

              {proposal.scopeOfWork?.objectives && proposal.scopeOfWork.objectives.length > 0 && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                    Objectives
                  </Typography>
                  <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                    {proposal.scopeOfWork.objectives.map((obj, idx) => (
                      <li key={idx}>
                        <Typography variant="body2">{obj}</Typography>
                      </li>
                    ))}
                  </Box>
                </>
              )}

              {proposal.scopeOfWork?.deliverables &&
                proposal.scopeOfWork.deliverables.length > 0 && (
                  <>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                      Deliverables
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                      {proposal.scopeOfWork.deliverables.map((del, idx) => (
                        <li key={idx}>
                          <Typography variant="body2">{del}</Typography>
                        </li>
                      ))}
                    </Box>
                  </>
                )}
            </CardContent>
          </Card>

          {/* Scope of Supply */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Scope of Supply
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {proposal.scopeOfSupply.length} items
              </Typography>
              {proposal.scopeOfSupply.slice(0, 5).map((item, idx) => (
                <Box key={item.id} sx={{ mb: 1 }}>
                  <Typography variant="body2">
                    {idx + 1}. {item.itemName} - {item.quantity} {item.unit}
                  </Typography>
                </Box>
              ))}
              {proposal.scopeOfSupply.length > 5 && (
                <Typography variant="caption" color="text.secondary">
                  ... and {proposal.scopeOfSupply.length - 5} more items
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Pricing Summary */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Pricing Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Subtotal
                  </Typography>
                  <Typography variant="body1">
                    {formatCurrency(proposal.pricing.subtotal)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Amount
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {formatCurrency(proposal.pricing.totalAmount)}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Approval History */}
          {proposal.approvalHistory && proposal.approvalHistory.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Approval History
                </Typography>
                <ApprovalHistory history={proposal.approvalHistory} />
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          <ProposalAttachments
            proposal={proposal}
            onUpdate={reloadProposal}
            readOnly={!['DRAFT'].includes(proposal.status)}
          />
        </Grid>

        {/* Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Client Details */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Client Details
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <BusinessIcon color="action" sx={{ mr: 1 }} />
                <Typography variant="subtitle1" fontWeight="medium">
                  {proposal.clientName}
                </Typography>
              </Box>

              {proposal.clientContactPerson && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Contact Person
                  </Typography>
                  <Typography variant="body2">{proposal.clientContactPerson}</Typography>
                </Box>
              )}

              {proposal.clientEmail && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <EmailIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                  <Typography variant="body2">{proposal.clientEmail}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Key Information */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Key Information
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DateIcon color="action" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Preparation Date
                  </Typography>
                  <Typography variant="body2">{formatDate(proposal.preparationDate)}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DateIcon color="action" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Valid Until
                  </Typography>
                  <Typography variant="body2">{formatDate(proposal.validityDate)}</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Enquiry Reference
                </Typography>
                <Typography variant="body2">{proposal.enquiryNumber}</Typography>
              </Box>

              {proposal.deliveryPeriod && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Delivery Period
                  </Typography>
                  <Typography variant="body2">
                    {proposal.deliveryPeriod.durationInWeeks} weeks
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Comment Dialog for Approval Actions */}
      <Dialog open={commentDialog.open} onClose={handleCommentDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>{commentDialog.title}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={
              commentDialog.action === 'approve'
                ? 'Comments (optional)'
                : commentDialog.action === 'reject'
                  ? 'Reason for rejection'
                  : 'What changes are needed?'
            }
            fullWidth
            multiline
            rows={3}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            required={commentDialog.required}
            placeholder={
              commentDialog.action === 'approve'
                ? 'Add any comments about this approval...'
                : commentDialog.action === 'reject'
                  ? 'Please explain why this proposal is being rejected...'
                  : 'Describe the changes that need to be made...'
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCommentDialogClose}>Cancel</Button>
          <Button
            onClick={handleCommentSubmit}
            variant="contained"
            color={commentDialog.action === 'reject' ? 'error' : 'primary'}
            disabled={commentDialog.required && !commentText.trim()}
          >
            {commentDialog.action === 'approve'
              ? 'Approve'
              : commentDialog.action === 'reject'
                ? 'Reject'
                : 'Request Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Convert to Project Dialog */}
      {proposal && (
        <ConvertToProjectDialog
          open={convertDialogOpen}
          proposal={proposal}
          onClose={() => setConvertDialogOpen(false)}
          onComplete={handleConversionComplete}
        />
      )}
    </Box>
  );
}
