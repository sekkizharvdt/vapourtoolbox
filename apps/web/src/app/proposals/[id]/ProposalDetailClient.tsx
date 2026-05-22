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
  Tab,
  Tabs,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  Home as HomeIcon,
  MoreVert as MoreIcon,
  PictureAsPdf as PdfIcon,
  CloudUpload as SavePdfIcon,
  Send as SendIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  ChangeCircle as ChangesIcon,
  AccountTree as ProjectIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  CalendarToday as DateIcon,
  OpenInNew as OpenIcon,
  ContentCopy as CloneIcon,
  BookmarkAdd as TemplateIcon,
  History as RevisionIcon,
  Dashboard as OverviewIcon,
  GridView as ScopeIcon,
  Schedule as DeliveryIcon,
  Calculate as CostingIcon,
  PriceChange as PricingIcon,
  Gavel as TermsIcon,
  Visibility as PreviewIcon,
  Mail as CoverLetterIcon,
  Subject as DescriptionTabIcon,
  Verified as QualificationsIcon,
  FactCheck as ComplianceIcon,
} from '@mui/icons-material';
import { Timestamp } from 'firebase/firestore';
import { PageHeader, LoadingState, EmptyState } from '@vapour/ui';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getProposalById, updateProposal } from '@/lib/proposals/proposalService';
import { computeCommercialSummary } from '@/lib/proposals/commercialSummary';
import { generateAndDownloadProposalPDF } from '@/lib/proposals/proposalPDF';
import {
  submitProposalForApproval,
  cancelProposalSubmission,
  approveProposal,
  rejectProposal,
  requestProposalChanges,
  getAvailableActions,
} from '@/lib/proposals/approvalWorkflow';
import { canConvertToProject } from '@/lib/proposals/projectConversion';
import type { Proposal } from '@vapour/types';
import { formatDate, formatCurrency as sharedFormatCurrency } from '@/lib/utils/formatters';
import { logger } from '@vapour/logger';
import { WORK_COMPONENT_LABELS, CURRENCIES } from '@vapour/constants';

// Components
import StatusBadge from './components/StatusBadge';
import ApprovalHistory from './components/ApprovalHistory';
import ConvertToProjectDialog from './components/ConvertToProjectDialog';
import ProposalAttachments from './components/ProposalAttachments';
import { CloneProposalDialog } from './components/CloneProposalDialog';
import { SaveAsTemplateDialog } from './components/SaveAsTemplateDialog';
import SubmitForApprovalDialog from './components/SubmitForApprovalDialog';
import CreateRevisionDialog from './components/CreateRevisionDialog';
import RevisionHistoryCard from './components/RevisionHistoryCard';
import QualificationsEditor from './components/QualificationsEditor';
import ComplianceMatrixEditor from './components/ComplianceMatrixEditor';
import type { ProposalApproverCandidate } from '@/lib/proposals/userHelpers';

// Tab editors
import { UnifiedScopeEditor } from './scope/UnifiedScopeEditor';
import DeliveryEditor from './components/DeliveryEditor';
import CostingBlocksEditor from './pricing/PricingBlocksEditor';
import PricingEditor from './pricing/PricingEditor';
import TermsEditor from './components/TermsEditor';
import CoverLetterEditor from './components/CoverLetterEditor';
import ProjectBriefEditor from './components/ProjectBriefEditor';
import PreviewClient from './preview/PreviewClient';

// Tab indices — order matches the natural authoring flow:
//   Overview → Description → Qualifications → Scope → Compliance → Costing →
//   Pricing → Delivery → Terms → Cover Letter → Preview
const TAB_OVERVIEW = 0;
const TAB_DESCRIPTION = 1;
const TAB_QUALIFICATIONS = 2;
const TAB_SCOPE = 3;
const TAB_COMPLIANCE = 4;
const TAB_COSTING = 5;
const TAB_PRICING = 6;
const TAB_DELIVERY = 7;
const TAB_TERMS = 8;
const TAB_COVER_LETTER = 9;
const TAB_PREVIEW = 10;

// URL-driven tab selection: ?tab=description maps onto the activeTab index.
// Used by post-scope redirects and any external bookmark.
const TAB_NAMES = [
  'overview',
  'description',
  'qualifications',
  'scope',
  'compliance',
  'costing',
  'pricing',
  'delivery',
  'terms',
  'cover-letter',
  'preview',
];
const tabIndexFromName = (name: string | null): number | null => {
  if (!name) return null;
  const idx = TAB_NAMES.indexOf(name.toLowerCase());
  return idx >= 0 ? idx : null;
};

export default function ProposalDetailClient() {
  const pathname = usePathname();
  const router = useRouter();
  const db = useFirestore();
  const { user, claims } = useAuth();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  // Two distinct error channels:
  //  - loadError: the proposal failed to load → page collapses to a
  //    "Proposal Not Found" empty state (recoverable only by retrying)
  //  - actionError: an action (approve/reject/PDF/etc.) failed → renders
  //    as a dismissible Alert at the top of the page; content stays
  //    usable so the user can see what happened and try something else
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [submitForApprovalDialogOpen, setSubmitForApprovalDialogOpen] = useState(false);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [extendValidityOpen, setExtendValidityOpen] = useState(false);
  const [extendValidityDraft, setExtendValidityDraft] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(TAB_OVERVIEW);

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

  // Sync activeTab with the ?tab= query param so external links (e.g. the
  // "Mark Scope Complete" redirect) can land on a specific tab. Parsing
  // window.location.search directly (rather than via useSearchParams) keeps
  // the page from needing a Suspense boundary under output: 'export'.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tab = new URLSearchParams(window.location.search).get('tab');
    const idx = tabIndexFromName(tab);
    if (idx !== null) setActiveTab(idx);
  }, [pathname]);

  const reloadProposal = async () => {
    if (!db || !proposalId) return;
    try {
      const data = await getProposalById(db, proposalId);
      if (data) setProposal(data);
    } catch (err) {
      logger.error('Error reloading proposal', { error: err });
    }
  };

  const handleTabChange = (next: number) => {
    setActiveTab(next);
    if (typeof window !== 'undefined' && proposalId) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', TAB_NAMES[next] ?? 'overview');
      window.history.replaceState(null, '', url.toString());
    }
    // Overview and Preview aggregate data edited in the other tabs (each
    // editor loads + saves its own copy of the proposal). Re-fetch when
    // landing on them so they don't show a stale in-memory total.
    if (next === TAB_OVERVIEW || next === TAB_PREVIEW) {
      void reloadProposal();
    }
  };

  useEffect(() => {
    if (!db || !proposalId) return;

    const loadProposal = async () => {
      try {
        setLoading(true);
        const data = await getProposalById(db, proposalId);
        if (!data) {
          setLoadError('Proposal not found');
        } else {
          setProposal(data);
        }
      } catch (err) {
        logger.error('Error loading proposal', { proposalId, error: err });
        setLoadError('Failed to load proposal details');
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

  const handleDownloadPDF = async (saveToStorage: boolean = false) => {
    if (!proposal || !db) return;
    try {
      setPdfGenerating(true);
      await generateAndDownloadProposalPDF(
        db,
        proposal,
        {
          includeTerms: true,
          includeDeliverySchedule: true,
        },
        saveToStorage
      );
      if (saveToStorage) {
        await reloadProposal();
      }
    } catch (err) {
      logger.error('Error generating PDF', { error: err });
      setActionError('Failed to generate PDF');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleSubmitForApproval = () => {
    setSubmitForApprovalDialogOpen(true);
    handleMenuClose();
  };

  const handleConfirmSubmitForApproval = async (approver: ProposalApproverCandidate) => {
    if (!db || !proposal || !user) return;
    setActionLoading(true);
    try {
      await submitProposalForApproval(
        db,
        proposal.id,
        user.uid,
        user.displayName || 'Unknown',
        claims?.permissions ?? 0,
        {
          userId: approver.id,
          userName: approver.displayName,
        }
      );
      await reloadProposal();
      setSubmitForApprovalDialogOpen(false);
    } catch (err) {
      logger.error('Error submitting for approval', { error: err });
      // Re-throw so the dialog can surface the message inline.
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubmission = async () => {
    if (!db || !proposal || !user) return;
    const confirmed = window.confirm(
      'Cancel this submission and return the proposal to DRAFT?\n\n' +
        'You will be able to edit it again and re-submit to a different approver.'
    );
    if (!confirmed) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await cancelProposalSubmission(db, proposal.id, user.uid, user.displayName || 'Unknown');
      await reloadProposal();
    } catch (err) {
      logger.error('Error cancelling proposal submission', { error: err });
      setActionError(
        err instanceof Error ? err.message : 'Failed to cancel the submission. Try again.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const openExtendValidity = () => {
    if (!proposal) return;
    const current = proposal.validityDate;
    const asDate =
      current && typeof current === 'object' && 'toDate' in current
        ? (current as { toDate: () => Date }).toDate()
        : new Date();
    setExtendValidityDraft(asDate.toISOString().slice(0, 10));
    setExtendValidityOpen(true);
    handleMenuClose();
  };

  const handleExtendValiditySave = async () => {
    if (!db || !proposal || !user || !extendValidityDraft) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const newDate = new Date(extendValidityDraft);
      if (Number.isNaN(newDate.getTime())) {
        setActionError('Invalid date.');
        return;
      }
      // validityDate is a workflow field (offer expiry), editable even
      // after a proposal leaves DRAFT — pass allowWorkflowChange.
      await updateProposal(
        db,
        proposal.id,
        { validityDate: Timestamp.fromDate(newDate) },
        user.uid,
        claims?.permissions ?? 0,
        { allowWorkflowChange: true }
      );
      setExtendValidityOpen(false);
      await reloadProposal();
    } catch (err) {
      logger.error('Error extending validity', { error: err });
      setActionError(err instanceof Error ? err.message : 'Failed to extend validity.');
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

      const permissions = claims?.permissions ?? 0;

      switch (commentDialog.action) {
        case 'approve':
          await approveProposal(
            db,
            proposal.id,
            user.uid,
            user.displayName || 'Unknown',
            permissions,
            commentText
          );
          break;
        case 'reject':
          await rejectProposal(
            db,
            proposal.id,
            user.uid,
            user.displayName || 'Unknown',
            permissions,
            commentText
          );
          break;
        case 'changes':
          await requestProposalChanges(
            db,
            proposal.id,
            user.uid,
            user.displayName || 'Unknown',
            permissions,
            commentText
          );
          break;
      }

      await reloadProposal();
    } catch (err) {
      logger.error(`Error ${commentDialog.action} proposal`, { error: err });
      // Surface the underlying server error so the user can act on it
      // (e.g. self-approval blocked, permission denied) rather than a
      // generic "Failed to approve proposal" message.
      const fallback = `Failed to ${commentDialog.action} proposal`;
      setActionError(err instanceof Error ? err.message : fallback);
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

  const formatCurrency = (money: { amount: number; currency: string } | undefined) => {
    if (!money) return '-';
    return sharedFormatCurrency(money.amount, money.currency);
  };

  if (loading) return <LoadingState message="Loading proposal details..." />;

  // Only collapse the page on a genuine load failure. Action errors stay
  // inline as a dismissible Alert so the rest of the page remains usable.
  if (loadError || !proposal) {
    return (
      <Box sx={{ p: 3 }}>
        <EmptyState
          title="Proposal Not Found"
          message={
            loadError || "The proposal you're looking for doesn't exist or has been deleted."
          }
          action={<Button onClick={() => router.push('/proposals')}>Back to Proposals</Button>}
        />
      </Box>
    );
  }

  const actions = getAvailableActions(proposal.status);
  const canConvert = canConvertToProject(proposal);

  // Approval actions (Approve / Reject / Request Changes) must NOT be
  // visible to the proposal's submitter — the server-side
  // preventSelfApproval guard would reject the call anyway. Hiding the
  // buttons keeps the submitter from clicking and seeing a confusing
  // "Failed to approve" toast.
  const isSubmitter = !!proposal.submittedByUserId && proposal.submittedByUserId === user?.uid;
  const canAct = !isSubmitter;

  // Revisions are how client feedback / post-approval changes get folded
  // back in. Gated to states past the initial draft — once the proposal
  // has been approved, sent to the client, or come back rejected, a new
  // revision is the right move (rather than editing the live record).
  // Only the latest revision can spawn a new one to keep the chain linear.
  const canCreateRevision =
    proposal.isLatestRevision &&
    ['APPROVED', 'SUBMITTED', 'UNDER_NEGOTIATION', 'REJECTED', 'ACCEPTED', 'EXPIRED'].includes(
      proposal.status
    );

  // Edit lock: once a proposal leaves DRAFT (submitted for approval,
  // approved, sent to client, …) the content is frozen. Editors disable
  // their Save buttons; updateProposal throws on the server side. A
  // banner explains the state so the user isn't left guessing.
  const isLocked = proposal.status !== 'DRAFT';

  return (
    <Box>
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: 'Proposals', href: '/proposals', icon: <HomeIcon fontSize="small" /> },
          { label: proposal.proposalNumber },
        ]}
      />

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      {isLocked && (
        <Alert severity="info" sx={{ mb: 2 }} icon={false}>
          <strong>Proposal is locked for edits.</strong> Status is{' '}
          <strong>{proposal.status.replace(/_/g, ' ')}</strong> — tabs are read-only. To make
          changes,{' '}
          {isSubmitter && proposal.status === 'PENDING_APPROVAL'
            ? 'Cancel Submission to return to DRAFT'
            : 'create a new Revision'}
          .
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

            {/* Cancel Submission — visible only to the submitter while
                the proposal is still PENDING_APPROVAL. Closes the gap
                where a submitter who picked an unavailable approver
                (or themselves) had no way back to DRAFT without help. */}
            {proposal.status === 'PENDING_APPROVAL' && isSubmitter && (
              <Button
                variant="outlined"
                color="warning"
                onClick={handleCancelSubmission}
                disabled={actionLoading}
              >
                Cancel Submission
              </Button>
            )}

            {/* Approve — hidden from the submitter to enforce
                separation-of-duty (matches the server-side guard) */}
            {actions.canApprove && canAct && (
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

            {/* More Actions */}
            <IconButton onClick={handleMenuOpen} aria-label="More options">
              <MoreIcon />
            </IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
              {actions.canReject && canAct && (
                <MenuItem onClick={handleReject} disabled={actionLoading}>
                  <ListItemIcon>
                    <RejectIcon fontSize="small" color="error" />
                  </ListItemIcon>
                  <ListItemText>Reject</ListItemText>
                </MenuItem>
              )}
              {actions.canRequestChanges && canAct && (
                <MenuItem onClick={handleRequestChanges} disabled={actionLoading}>
                  <ListItemIcon>
                    <ChangesIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Request Changes</ListItemText>
                </MenuItem>
              )}
              <MenuItem onClick={openExtendValidity}>
                <ListItemIcon>
                  <DateIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Extend Validity</ListItemText>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setCloneDialogOpen(true);
                  handleMenuClose();
                }}
              >
                <ListItemIcon>
                  <CloneIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Clone Proposal</ListItemText>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setTemplateDialogOpen(true);
                  handleMenuClose();
                }}
              >
                <ListItemIcon>
                  <TemplateIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Save as Template</ListItemText>
              </MenuItem>
              {/* Create Revision — once a proposal has been seen by the
                  client (or rejected internally), revisions are how
                  feedback gets folded in. Gated to states where it makes
                  sense; not shown on a brand-new draft (just edit it). */}
              {canCreateRevision && (
                <MenuItem
                  onClick={() => {
                    setRevisionDialogOpen(true);
                    handleMenuClose();
                  }}
                >
                  <ListItemIcon>
                    <RevisionIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Create Revision</ListItemText>
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
        {proposal.status === 'PENDING_APPROVAL' && proposal.approverUserName && (
          <Chip
            label={`Pending with ${proposal.approverUserName}`}
            variant="outlined"
            color="warning"
            size="small"
            sx={{ ml: 1 }}
          />
        )}
        {proposal.workComponents?.map((c) => (
          <Chip
            key={c}
            label={WORK_COMPONENT_LABELS[c].title}
            variant="outlined"
            color="primary"
            size="small"
            sx={{ ml: 1 }}
          />
        ))}
        {proposal.clientPricing?.currency && proposal.clientPricing.currency !== 'INR' && (
          <Chip
            label={`Quote in ${CURRENCIES[proposal.clientPricing.currency].symbol} ${proposal.clientPricing.currency}`}
            variant="outlined"
            sx={{ ml: 1 }}
          />
        )}
      </PageHeader>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => handleTabChange(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<OverviewIcon />} iconPosition="start" label="Overview" />
          <Tab icon={<DescriptionTabIcon />} iconPosition="start" label="Description" />
          <Tab icon={<QualificationsIcon />} iconPosition="start" label="Qualifications" />
          <Tab icon={<ScopeIcon />} iconPosition="start" label="Scope" />
          <Tab icon={<ComplianceIcon />} iconPosition="start" label="Compliance" />
          <Tab icon={<CostingIcon />} iconPosition="start" label="Costing" />
          <Tab icon={<PricingIcon />} iconPosition="start" label="Pricing" />
          <Tab icon={<DeliveryIcon />} iconPosition="start" label="Delivery" />
          <Tab icon={<TermsIcon />} iconPosition="start" label="Terms" />
          <Tab icon={<CoverLetterIcon />} iconPosition="start" label="Cover Letter" />
          <Tab icon={<PreviewIcon />} iconPosition="start" label="Preview" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === TAB_OVERVIEW && (
        <OverviewTab
          proposal={proposal}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
          reloadProposal={reloadProposal}
        />
      )}

      {activeTab === TAB_DESCRIPTION && proposalId && (
        <ProjectBriefEditor proposalId={proposalId} />
      )}

      {activeTab === TAB_QUALIFICATIONS && proposalId && (
        <QualificationsEditor proposalId={proposalId} />
      )}

      {activeTab === TAB_SCOPE && proposalId && <UnifiedScopeEditor proposalId={proposalId} />}

      {activeTab === TAB_COMPLIANCE && proposalId && (
        <ComplianceMatrixEditor proposalId={proposalId} />
      )}

      {activeTab === TAB_COSTING && proposalId && (
        <CostingBlocksEditor proposalId={proposalId} embedded />
      )}

      {activeTab === TAB_PRICING && proposalId && (
        <PricingEditor proposalId={proposalId} embedded />
      )}

      {activeTab === TAB_DELIVERY && proposalId && <DeliveryEditor proposalId={proposalId} />}

      {activeTab === TAB_TERMS && proposalId && <TermsEditor proposalId={proposalId} />}

      {activeTab === TAB_COVER_LETTER && proposalId && (
        <CoverLetterEditor proposalId={proposalId} />
      )}

      {activeTab === TAB_PREVIEW && proposalId && (
        <PreviewClient proposalId={proposalId} embedded />
      )}

      {/* Extend Validity Dialog */}
      <Dialog
        open={extendValidityOpen}
        onClose={() => setExtendValidityOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Extend Proposal Validity</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Change the &quot;valid until&quot; date the customer sees on the offer. Editable at any
            status (it&apos;s an offer-expiry field, not content).
          </Typography>
          <TextField
            autoFocus
            type="date"
            fullWidth
            label="Valid Until"
            value={extendValidityDraft}
            onChange={(e) => setExtendValidityDraft(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExtendValidityOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleExtendValiditySave}
            disabled={actionLoading || !extendValidityDraft}
          >
            {actionLoading ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* Clone Proposal Dialog */}
      {proposal && (
        <CloneProposalDialog
          open={cloneDialogOpen}
          proposal={proposal}
          onClose={() => setCloneDialogOpen(false)}
          onComplete={(newProposalId) => {
            setCloneDialogOpen(false);
            router.push(`/proposals/${newProposalId}`);
          }}
        />
      )}

      {/* Save as Template Dialog */}
      {proposal && (
        <SaveAsTemplateDialog
          open={templateDialogOpen}
          proposal={proposal}
          onClose={() => setTemplateDialogOpen(false)}
          onComplete={() => {
            setTemplateDialogOpen(false);
          }}
        />
      )}

      {/* Submit For Approval Dialog — picks the approver who'll receive
          the task notification. */}
      {proposal && user && (
        <SubmitForApprovalDialog
          open={submitForApprovalDialogOpen}
          tenantId={proposal.tenantId}
          submitterUserId={user.uid}
          proposalNumber={proposal.proposalNumber}
          proposalTitle={proposal.title}
          onClose={() => setSubmitForApprovalDialogOpen(false)}
          onSubmit={handleConfirmSubmitForApproval}
        />
      )}

      {/* Create Revision Dialog — captures the reason then forks a new
          DRAFT revision pre-filled with everything from this proposal. */}
      {proposal && (
        <CreateRevisionDialog
          open={revisionDialogOpen}
          proposal={proposal}
          onClose={() => setRevisionDialogOpen(false)}
          onComplete={(newProposalId) => {
            setRevisionDialogOpen(false);
            router.push(`/proposals/${newProposalId}`);
          }}
        />
      )}
    </Box>
  );
}

// ============================================================================
// Overview Tab — client info, scope summary, pricing summary, approval history
// ============================================================================

interface OverviewTabProps {
  proposal: Proposal;
  formatDate: (timestamp: Timestamp | Date | undefined) => string;
  formatCurrency: (money: { amount: number; currency: string } | undefined) => string;
  reloadProposal: () => Promise<void>;
}

function OverviewTab({ proposal, formatDate, formatCurrency, reloadProposal }: OverviewTabProps) {
  return (
    <Grid container spacing={3}>
      {/* Main Content */}
      <Grid size={{ xs: 12, md: 8 }}>
        {/* Scope Summary — Unified Scope Matrix */}
        {proposal.unifiedScopeMatrix &&
        proposal.unifiedScopeMatrix.categories.some((c) => c.items.length > 0) ? (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Scope Matrix
                {proposal.unifiedScopeMatrix.isComplete && (
                  <Chip label="Complete" color="success" size="small" sx={{ ml: 1 }} />
                )}
              </Typography>

              {(() => {
                const allItems = proposal.unifiedScopeMatrix!.categories.flatMap((c) => c.items);
                const included = allItems.filter((i) => i.included);
                const excluded = allItems.filter((i) => !i.included);
                const services = included.filter((i) => i.classification === 'SERVICE');
                const supply = included.filter((i) => i.classification === 'SUPPLY');

                return (
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Services ({services.length})
                      </Typography>
                      {services.slice(0, 3).map((item) => (
                        <Typography key={item.id} variant="body2" sx={{ mb: 0.5 }}>
                          {item.name}
                        </Typography>
                      ))}
                      {services.length > 3 && (
                        <Typography variant="caption" color="text.secondary">
                          +{services.length - 3} more
                        </Typography>
                      )}
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Supply ({supply.length})
                      </Typography>
                      {supply.slice(0, 3).map((item) => (
                        <Typography key={item.id} variant="body2" sx={{ mb: 0.5 }}>
                          {item.name}
                        </Typography>
                      ))}
                      {supply.length > 3 && (
                        <Typography variant="caption" color="text.secondary">
                          +{supply.length - 3} more
                        </Typography>
                      )}
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Exclusions ({excluded.length})
                      </Typography>
                      {excluded.slice(0, 3).map((item) => (
                        <Typography key={item.id} variant="body2" sx={{ mb: 0.5 }}>
                          {item.name}
                        </Typography>
                      ))}
                      {excluded.length > 3 && (
                        <Typography variant="caption" color="text.secondary">
                          +{excluded.length - 3} more
                        </Typography>
                      )}
                    </Grid>
                  </Grid>
                );
              })()}
            </CardContent>
          </Card>
        ) : null}

        {/* Pricing Summary — read from the canonical commercial summary
            (matches what the customer sees on the PDF and the Pricing tab).
            Falls back gracefully when the proposal has no pricing yet. */}
        {(() => {
          const summary = computeCommercialSummary(proposal);
          if (!summary) return null;
          return (
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
                      {formatCurrency({
                        amount: summary.sectionsSum,
                        currency: summary.currency,
                      })}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Total ({summary.currency})
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {formatCurrency({
                        amount: summary.total,
                        currency: summary.currency,
                      })}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          );
        })()}

        {/* Delivery Summary */}
        {proposal.deliveryPeriod && proposal.deliveryPeriod.milestones.length > 0 && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Delivery ({proposal.deliveryPeriod.durationInWeeks} weeks)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {proposal.deliveryPeriod.milestones.length} milestone
                {proposal.deliveryPeriod.milestones.length !== 1 ? 's' : ''} defined
              </Typography>
              {proposal.deliveryPeriod.milestones.slice(0, 3).map((m) => (
                <Typography key={m.id} variant="body2" sx={{ mb: 0.5 }}>
                  {m.milestoneNumber}. {m.description}
                  {m.paymentPercentage ? ` (${m.paymentPercentage}%)` : ''}
                </Typography>
              ))}
              {proposal.deliveryPeriod.milestones.length > 3 && (
                <Typography variant="caption" color="text.secondary">
                  +{proposal.deliveryPeriod.milestones.length - 3} more
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

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

        {/* Revision History — auto-hides when there's only one revision. */}
        <RevisionHistoryCard
          proposalNumber={proposal.proposalNumber}
          currentProposalId={proposal.id}
        />

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
  );
}
