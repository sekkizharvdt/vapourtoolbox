'use client';

/**
 * Proposals List Page
 *
 * Table view of all proposals with filtering and search
 * Moved from /proposals to /proposals/list for hub dashboard structure
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Breadcrumbs,
  Button,
  Container,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Home as HomeIcon } from '@mui/icons-material';
import EditIcon from '@mui/icons-material/Edit';
import ViewIcon from '@mui/icons-material/Visibility';
import { PageHeader, FilterBar, LoadingState, EmptyState, TableActionCell } from '@vapour/ui';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { listProposals } from '@/lib/proposals/proposalService';
import type { Proposal, ProposalStatus } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { PERMISSION_FLAGS, hasPermission } from '@vapour/constants';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_NEGOTIATION', label: 'Negotiating' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
];

const getStatusColor = (status: ProposalStatus) => {
  switch (status) {
    case 'DRAFT':
      return 'default';
    case 'PENDING_APPROVAL':
      return 'warning';
    case 'APPROVED':
      return 'info';
    case 'SUBMITTED':
      return 'primary';
    case 'UNDER_NEGOTIATION':
      return 'secondary';
    case 'ACCEPTED':
      return 'success';
    case 'REJECTED':
    case 'EXPIRED':
      return 'error';
    default:
      return 'default';
  }
};

export default function ProposalListPage() {
  const router = useRouter();
  const db = useFirestore();
  const { claims } = useAuth();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  // BP-4: Check if user has permission to view proposals
  const canViewProposals = claims?.permissions
    ? hasPermission(claims.permissions, PERMISSION_FLAGS.VIEW_PROPOSALS)
    : false;

  const fetchProposals = useCallback(async () => {
    if (!db) return;

    // Check if user has permission to manage entities (Superadmin/Director)
    const canManageEntities = claims?.permissions
      ? hasPermission(claims.permissions, PERMISSION_FLAGS.EDIT_ENTITIES)
      : false;

    // Require VIEW_PROPOSALS permission
    if (
      !claims?.permissions ||
      !hasPermission(claims.permissions, PERMISSION_FLAGS.VIEW_PROPOSALS)
    ) {
      setLoading(false);
      return;
    }

    // If user has no entity ID and cannot manage entities, stop loading
    if (!claims?.entityId && !canManageEntities) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await listProposals(db, {
        entityId: claims?.entityId, // Optional for Superadmin
        status: statusFilter.length > 0 ? (statusFilter as ProposalStatus[]) : undefined,
        searchTerm: searchTerm || undefined,
        dateFrom: dateRange.start ? Timestamp.fromDate(dateRange.start) : undefined,
        dateTo: dateRange.end ? Timestamp.fromDate(dateRange.end) : undefined,
      });

      setProposals(data);
    } catch (err) {
      console.error('Error fetching proposals:', err);
      setError('Failed to load proposals. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [db, claims, statusFilter, searchTerm, dateRange]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleCreateProposal = () => {
    router.push('/proposals/new');
  };

  const handleViewProposal = (id: string) => {
    router.push(`/proposals/${id}`);
  };

  const handleEditProposal = (id: string) => {
    router.push(`/proposals/${id}/edit`);
  };

  if (!canViewProposals && !loading) {
    return (
      <Container maxWidth="xl">
        <Alert severity="warning" sx={{ mt: 4 }}>
          You do not have permission to view proposals. Please contact your administrator.
        </Alert>
      </Container>
    );
  }

  if (loading && proposals.length === 0) {
    return <LoadingState message="Loading proposals..." />;
  }

  return (
    <Container maxWidth="xl">
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
        <Typography color="text.primary">All Proposals</Typography>
      </Breadcrumbs>
      <Box sx={{ mb: 4 }}>
        <PageHeader
          title="All Proposals"
          subtitle="View and manage all proposals across all stages"
          action={
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/proposals/new')}
            >
              New Proposal
            </Button>
          }
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <FilterBar
        onClear={() => {
          setSearchTerm('');
          setStatusFilter([]);
        }}
      >
        <TextField
          placeholder="Search proposals..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ width: 300 }}
        />

        <FormControl size="small" sx={{ width: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select
            multiple
            value={statusFilter}
            onChange={(e) => {
              const value = e.target.value;
              setStatusFilter(typeof value === 'string' ? value.split(',') : value);
            }}
            input={<OutlinedInput label="Status" />}
            renderValue={(selected) => selected.join(', ')}
          >
            {STATUS_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Checkbox checked={statusFilter.indexOf(option.value) > -1} />
                <ListItemText primary={option.label} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </FilterBar>

      {proposals.length === 0 ? (
        <EmptyState
          title="No proposals found"
          message={
            searchTerm || statusFilter.length > 0
              ? 'Try adjusting your filters'
              : 'Get started by creating your first proposal'
          }
          action={
            !searchTerm && statusFilter.length === 0 ? (
              <Button variant="contained" onClick={handleCreateProposal}>
                Create Proposal
              </Button>
            ) : undefined
          }
        />
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>Proposal #</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {proposals.map((proposal) => (
                <TableRow key={proposal.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {proposal.proposalNumber}
                    </Typography>
                    {proposal.revision > 1 && (
                      <Typography variant="caption" color="text.secondary">
                        Rev {proposal.revision}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{proposal.title}</TableCell>
                  <TableCell>{proposal.clientName}</TableCell>
                  <TableCell>
                    <Chip
                      label={
                        STATUS_OPTIONS.find((o) => o.value === proposal.status)?.label ||
                        proposal.status
                      }
                      color={getStatusColor(proposal.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {proposal.pricing?.totalAmount
                      ? new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: proposal.pricing.totalAmount.currency,
                        }).format(proposal.pricing.totalAmount.amount)
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {proposal.createdAt?.toDate
                      ? format(proposal.createdAt.toDate(), 'MMM d, yyyy')
                      : '-'}
                  </TableCell>
                  <TableActionCell
                    actions={[
                      {
                        label: 'View',
                        icon: <ViewIcon fontSize="small" />,
                        onClick: () => handleViewProposal(proposal.id),
                      },
                      {
                        label: 'Edit',
                        icon: <EditIcon fontSize="small" />,
                        onClick: () => handleEditProposal(proposal.id),
                        show: proposal.status === 'DRAFT' || proposal.status === 'PENDING_APPROVAL',
                      },
                    ]}
                  />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}
