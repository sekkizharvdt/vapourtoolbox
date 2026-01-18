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
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Edit as EditIcon,
  Home as HomeIcon,
  MoreVert as MoreIcon,
  Description as ProposalIcon,
  CheckCircle as WonIcon,
  Cancel as LostIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  CalendarToday as DateIcon,
  Timer as UrgencyIcon,
  Gavel as BidDecisionIcon,
  ThumbUp as BidIcon,
  ThumbDown as NoBidIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState, EmptyState, getStatusColor } from '@vapour/ui';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getEnquiryById, updateEnquiryStatus, deleteEnquiry } from '@/lib/enquiry/enquiryService';
import type { Enquiry, EnquiryStatus } from '@vapour/types';
import {
  ENQUIRY_STATUS_LABELS,
  ENQUIRY_URGENCY_LABELS,
  ENQUIRY_PROJECT_TYPE_LABELS,
  STRATEGIC_ALIGNMENT_LABELS,
  WIN_PROBABILITY_LABELS,
  COMMERCIAL_VIABILITY_LABELS,
  RISK_EXPOSURE_LABELS,
  CAPACITY_CAPABILITY_LABELS,
  BID_DECISION_LABELS,
} from '@vapour/types';
import { EnquiryDocumentUpload } from '../components/EnquiryDocumentUpload';
import { BidDecisionDialog } from '../components/BidDecisionDialog';
import { formatDate } from '@/lib/utils/formatters';

export default function EnquiryDetailClient() {
  const pathname = usePathname();
  const router = useRouter();
  const db = useFirestore();
  const { user, claims } = useAuth();

  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [enquiryId, setEnquiryId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [bidDecisionDialogOpen, setBidDecisionDialogOpen] = useState(false);

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/proposals\/enquiries\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setEnquiryId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (!db || !enquiryId) return;

    const loadEnquiry = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getEnquiryById(db, enquiryId);
        if (!data) {
          setError('Enquiry not found');
        } else {
          setEnquiry(data);
        }
      } catch (err) {
        console.error('Error loading enquiry:', err);
        setError('Failed to load enquiry details');
      } finally {
        setLoading(false);
      }
    };

    loadEnquiry();
  }, [db, enquiryId, refreshKey]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleStatusChange = async (newStatus: EnquiryStatus) => {
    if (!db || !enquiry || !user?.uid) return;
    try {
      await updateEnquiryStatus(db, enquiry.id, newStatus, user.uid);
      setEnquiry({ ...enquiry, status: newStatus });
      handleMenuClose();
    } catch (err) {
      console.error('Error updating status:', err);
      // Show error snackbar
    }
  };

  const handleDelete = async () => {
    if (!db || !enquiry || !user?.uid || !claims) return;
    if (!window.confirm('Are you sure you want to delete this enquiry?')) return;

    try {
      await deleteEnquiry(db, enquiry.id, user.uid, claims.permissions);
      router.push('/proposals/enquiries');
    } catch (err) {
      console.error('Error deleting enquiry:', err);
    }
  };

  if (loading) return <LoadingState message="Loading enquiry details..." />;

  if (error || !enquiry) {
    return (
      <Box sx={{ p: 3 }}>
        <EmptyState
          title="Enquiry Not Found"
          message={error || "The enquiry you're looking for doesn't exist or has been deleted."}
          action={<Button onClick={() => setRefreshKey((prev) => prev + 1)}>Retry</Button>}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/proposals/enquiries"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/proposals/enquiries');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Enquiries
        </Link>
        <Typography color="text.primary">{enquiry.enquiryNumber}</Typography>
      </Breadcrumbs>

      <PageHeader
        title={enquiry.enquiryNumber}
        subtitle={enquiry.title}
        action={
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => router.push(`/proposals/enquiries/${enquiryId}/edit`)}
            >
              Edit
            </Button>
            {/* Show Make Bid Decision for enquiries without a bid decision */}
            {!enquiry.bidDecision &&
              !['WON', 'LOST', 'CANCELLED', 'NO_BID'].includes(enquiry.status) && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<BidDecisionIcon />}
                  onClick={() => setBidDecisionDialogOpen(true)}
                >
                  Make Bid Decision
                </Button>
              )}
            {/* Show Create Proposal only after BID decision */}
            {enquiry.bidDecision?.decision === 'BID' &&
              !['WON', 'LOST', 'CANCELLED'].includes(enquiry.status) && (
                <Button
                  variant="contained"
                  startIcon={<ProposalIcon />}
                  onClick={() => {
                    router.push(`/proposals/new?enquiryId=${enquiry.id}`);
                  }}
                >
                  Create Proposal
                </Button>
              )}
            <IconButton onClick={handleMenuOpen}>
              <MoreIcon />
            </IconButton>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
              <MenuItem onClick={() => handleStatusChange('WON')}>
                <ListItemIcon>
                  <WonIcon fontSize="small" color="success" />
                </ListItemIcon>
                <ListItemText>Mark as Won</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => handleStatusChange('LOST')}>
                <ListItemIcon>
                  <LostIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText>Mark as Lost</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                <ListItemIcon>
                  <DeleteIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText>Delete Enquiry</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        }
      >
        <Chip
          label={ENQUIRY_STATUS_LABELS[enquiry.status]}
          color={getStatusColor(enquiry.status)}
          sx={{ mr: 1 }}
        />
        <Chip
          icon={<UrgencyIcon />}
          label={ENQUIRY_URGENCY_LABELS[enquiry.urgency]}
          variant="outlined"
        />
      </PageHeader>

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Description & Scope
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 3 }}>
                {enquiry.description || 'No description provided.'}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Project Type
                  </Typography>
                  <Typography variant="body1">
                    {enquiry.projectType ? ENQUIRY_PROJECT_TYPE_LABELS[enquiry.projectType] : '-'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Estimated Budget
                  </Typography>
                  <Typography variant="body1">
                    {enquiry.estimatedBudget
                      ? new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: enquiry.estimatedBudget.currency,
                        }).format(enquiry.estimatedBudget.amount)
                      : 'Not specified'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Location
                  </Typography>
                  <Typography variant="body1">{enquiry.location || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Industry
                  </Typography>
                  <Typography variant="body1">{enquiry.industry || '-'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Requirements Section (Placeholder) */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Requirements
              </Typography>
              {enquiry.requirements && enquiry.requirements.length > 0 ? (
                <Box component="ul" sx={{ pl: 2 }}>
                  {enquiry.requirements.map((req, index) => (
                    <li key={index}>
                      <Typography variant="body1">{req}</Typography>
                    </li>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No specific requirements listed.
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Documents Section */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Documents
            </Typography>
            <EnquiryDocumentUpload enquiry={enquiry} onUpdate={setEnquiry} />
          </Box>
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
                  {enquiry.clientName}
                </Typography>
              </Box>

              {enquiry.clientContactPerson && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Contact Person
                  </Typography>
                  <Typography variant="body2">{enquiry.clientContactPerson}</Typography>
                </Box>
              )}

              {enquiry.clientEmail && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <EmailIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                  <Typography variant="body2">{enquiry.clientEmail}</Typography>
                </Box>
              )}

              {enquiry.clientPhone && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PhoneIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                  <Typography variant="body2">{enquiry.clientPhone}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Key Dates */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Key Dates
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DateIcon color="action" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Received Date
                  </Typography>
                  <Typography variant="body2">{formatDate(enquiry.receivedDate)}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <DateIcon color="action" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Created At
                  </Typography>
                  <Typography variant="body2">{formatDate(enquiry.createdAt)}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Bid Decision Card */}
          {enquiry.bidDecision && (
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  {enquiry.bidDecision.decision === 'BID' ? (
                    <BidIcon color="success" />
                  ) : (
                    <NoBidIcon color="error" />
                  )}
                  <Typography variant="h6">
                    Bid Decision: {BID_DECISION_LABELS[enquiry.bidDecision.decision]}
                  </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Decided by {enquiry.bidDecision.decidedByName} on{' '}
                  {formatDate(enquiry.bidDecision.decidedAt)}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Rationale
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                  {enquiry.bidDecision.rationale}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Evaluation Summary
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      Strategic Alignment
                    </Typography>
                    <Chip
                      size="small"
                      label={
                        STRATEGIC_ALIGNMENT_LABELS[
                          enquiry.bidDecision.evaluation.strategicAlignment.rating
                        ]
                      }
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      Win Probability
                    </Typography>
                    <Chip
                      size="small"
                      label={
                        WIN_PROBABILITY_LABELS[enquiry.bidDecision.evaluation.winProbability.rating]
                      }
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      Commercial Viability
                    </Typography>
                    <Chip
                      size="small"
                      label={
                        COMMERCIAL_VIABILITY_LABELS[
                          enquiry.bidDecision.evaluation.commercialViability.rating
                        ]
                      }
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      Risk Exposure
                    </Typography>
                    <Chip
                      size="small"
                      label={
                        RISK_EXPOSURE_LABELS[enquiry.bidDecision.evaluation.riskExposure.rating]
                      }
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      Capacity & Capability
                    </Typography>
                    <Chip
                      size="small"
                      label={
                        CAPACITY_CAPABILITY_LABELS[
                          enquiry.bidDecision.evaluation.capacityCapability.rating
                        ]
                      }
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Bid Decision Dialog */}
      <BidDecisionDialog
        open={bidDecisionDialogOpen}
        onClose={() => setBidDecisionDialogOpen(false)}
        enquiry={enquiry}
        onSuccess={(updatedEnquiry) => {
          setEnquiry(updatedEnquiry);
          setBidDecisionDialogOpen(false);
        }}
      />
    </Box>
  );
}
