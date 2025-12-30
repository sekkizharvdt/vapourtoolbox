'use client';

/**
 * Enquiries List Page
 * Phase 2: Enquiry Management UI
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  PendingActions as PendingIcon,
  CheckCircle as WonIcon,
  Cancel as LostIcon,
  Description as ProposalIcon,
} from '@mui/icons-material';
import {
  PageHeader,
  FilterBar,
  StatCard,
  LoadingState,
  EmptyState,
  TableActionCell,
} from '@vapour/ui';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import dynamic from 'next/dynamic';
import { listEnquiries, getEnquiriesCountByStatus } from '@/lib/enquiry/enquiryService';
import type { Enquiry, EnquiryStatus, EnquiryUrgency } from '@vapour/types';
import { ENQUIRY_STATUS_LABELS, ENQUIRY_URGENCY_LABELS } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

// Fallback entity ID for users without multi-entity claims
const FALLBACK_ENTITY_ID = 'default-entity';

// Dynamically import to avoid SSR issues with date pickers
const CreateEnquiryDialog = dynamic(
  () =>
    import('./components/CreateEnquiryDialog').then((mod) => ({
      default: mod.CreateEnquiryDialog,
    })),
  { ssr: false }
);

const STATUS_COLORS: Record<
  EnquiryStatus,
  'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'
> = {
  NEW: 'info',
  UNDER_REVIEW: 'primary',
  PROPOSAL_IN_PROGRESS: 'warning',
  PROPOSAL_SUBMITTED: 'secondary',
  WON: 'success',
  LOST: 'error',
  CANCELLED: 'default',
};

const URGENCY_COLORS: Record<
  EnquiryUrgency,
  'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'
> = {
  STANDARD: 'default',
  URGENT: 'error',
};

export default function EnquiriesPage() {
  const router = useRouter();
  const db = useFirestore();
  const { claims } = useAuth();

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<EnquiryStatus, number>>(
    {} as Record<EnquiryStatus, number>
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<EnquiryStatus | 'ALL'>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<EnquiryUrgency | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const entityId = claims?.entityId || FALLBACK_ENTITY_ID;
    if (!db) return;

    const fetchEnquiries = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load enquiries with filters
        const enquiriesList = await listEnquiries(db, {
          entityId,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          urgency: urgencyFilter !== 'ALL' ? urgencyFilter : undefined,
          searchTerm: searchTerm || undefined,
          limit: 100,
        });

        setEnquiries(enquiriesList);

        // Load status counts for stat cards
        const counts = await getEnquiriesCountByStatus(db, entityId);
        setStatusCounts(counts);
      } catch (err) {
        console.error('Error loading enquiries:', err);
        setError('Failed to load enquiries. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchEnquiries();
  }, [db, claims?.entityId, statusFilter, urgencyFilter, searchTerm, refreshKey]);

  const handleCreateEnquiry = () => {
    setCreateDialogOpen(true);
  };

  const handleEnquiryCreated = () => {
    // Trigger a refetch by updating the refresh key
    setRefreshKey((prev) => prev + 1);
  };

  const handleViewEnquiry = (enquiryId: string) => {
    router.push(`/proposals/enquiries/${enquiryId}`);
  };

  const handleEditEnquiry = (enquiryId: string) => {
    router.push(`/proposals/enquiries/${enquiryId}/edit`);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setUrgencyFilter('ALL');
  };

  if (loading && enquiries.length === 0) {
    return <LoadingState message="Loading enquiries..." />;
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <EmptyState
          title="Error Loading Enquiries"
          message={error}
          action={<Button onClick={() => setRefreshKey((prev) => prev + 1)}>Retry</Button>}
        />
      </Box>
    );
  }

  const activeCount =
    (statusCounts.NEW || 0) +
    (statusCounts.UNDER_REVIEW || 0) +
    (statusCounts.PROPOSAL_IN_PROGRESS || 0);
  const submittedCount = statusCounts.PROPOSAL_SUBMITTED || 0;
  const wonCount = statusCounts.WON || 0;
  const lostCount = statusCounts.LOST || 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <PageHeader
        title="Enquiries"
        subtitle="Manage incoming client enquiries and track proposal progress"
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateEnquiry}
            size="large"
          >
            New enquiry
          </Button>
        }
      />

      {/* Stat Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard label="Active" value={activeCount} icon={<PendingIcon />} color="primary" />
        <StatCard
          label="Submitted"
          value={submittedCount}
          icon={<ProposalIcon />}
          color="secondary"
        />
        <StatCard label="Won" value={wonCount} icon={<WonIcon />} color="success" />
        <StatCard label="Lost" value={lostCount} icon={<LostIcon />} color="error" />
      </Box>

      {/* Filters */}
      <FilterBar onClear={handleClearFilters}>
        <TextField
          label="Search"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by enquiry #, title..."
          sx={{ minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EnquiryStatus | 'ALL')}
            label="Status"
          >
            <MenuItem value="ALL">All Status</MenuItem>
            {Object.entries(ENQUIRY_STATUS_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Urgency</InputLabel>
          <Select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value as EnquiryUrgency | 'ALL')}
            label="Urgency"
          >
            <MenuItem value="ALL">All Urgency</MenuItem>
            {Object.entries(ENQUIRY_URGENCY_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </FilterBar>

      {/* Table */}
      {enquiries.length === 0 ? (
        <EmptyState
          title="No Enquiries Found"
          message={
            searchTerm
              ? `No enquiries found matching "${searchTerm}"`
              : 'No enquiries found. Create a new enquiry to get started.'
          }
          action={
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Enquiry
            </Button>
          }
        />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Enquiry #</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Received Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Urgency</TableCell>
                <TableCell>Assigned To</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {enquiries.map((enquiry) => (
                <TableRow key={enquiry.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {enquiry.enquiryNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{enquiry.clientName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {enquiry.clientContactPerson}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{enquiry.title}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatDate(enquiry.receivedDate)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={ENQUIRY_STATUS_LABELS[enquiry.status]}
                      color={STATUS_COLORS[enquiry.status]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={ENQUIRY_URGENCY_LABELS[enquiry.urgency]}
                      color={URGENCY_COLORS[enquiry.urgency]}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{enquiry.assignedToUserName || '-'}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <TableActionCell
                      actions={[
                        {
                          label: 'View',
                          icon: <ViewIcon fontSize="small" />,
                          onClick: () => handleViewEnquiry(enquiry.id),
                        },
                        {
                          label: 'Edit',
                          icon: <EditIcon fontSize="small" />,
                          onClick: () => handleEditEnquiry(enquiry.id),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CreateEnquiryDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleEnquiryCreated}
      />
    </Box>
  );
}
