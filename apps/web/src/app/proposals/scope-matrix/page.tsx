'use client';

/**
 * Scope Matrix List Page
 *
 * Lists proposals that have been created and are ready for scope definition.
 * This is the entry point for the Scope Matrix sub-module.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  CheckCircle as CompleteIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';
import {
  PageHeader,
  FilterBar,
  LoadingState,
  EmptyState,
  TableActionCell,
} from '@vapour/ui';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { listProposals } from '@/lib/proposals/proposalService';
import type { Proposal, ProposalStatus } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

// Fallback entity ID
const FALLBACK_ENTITY_ID = 'default-entity';

// Status filter options for scope matrix view
const SCOPE_RELEVANT_STATUSES: ProposalStatus[] = ['DRAFT', 'PENDING_APPROVAL'];

export default function ScopeMatrixPage() {
  const router = useRouter();
  const db = useFirestore();
  const { claims } = useAuth();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'COMPLETE' | 'INCOMPLETE'>('ALL');

  useEffect(() => {
    const entityId = claims?.entityId || FALLBACK_ENTITY_ID;
    if (!db) return;

    const fetchProposals = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch proposals that are in draft or pending stages (scope work happens here)
        const proposalsList = await listProposals(db, {
          entityId,
          status: SCOPE_RELEVANT_STATUSES,
          isLatestRevision: true,
          limit: 100,
        });

        setProposals(proposalsList);
      } catch (err) {
        console.error('Error loading proposals:', err);
        setError('Failed to load proposals. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProposals();
  }, [db, claims?.entityId]);

  const handleEditScope = (proposalId: string) => {
    router.push(`/proposals/${proposalId}/scope`);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setScopeFilter('ALL');
  };

  // Filter proposals based on search and scope completion
  const filteredProposals = proposals.filter((proposal) => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        proposal.proposalNumber.toLowerCase().includes(searchLower) ||
        proposal.title.toLowerCase().includes(searchLower) ||
        proposal.clientName.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Scope completion filter
    if (scopeFilter !== 'ALL') {
      const isComplete = proposal.scopeMatrix?.isComplete ?? false;
      if (scopeFilter === 'COMPLETE' && !isComplete) return false;
      if (scopeFilter === 'INCOMPLETE' && isComplete) return false;
    }

    return true;
  });

  const getScopeStatus = (proposal: Proposal) => {
    if (proposal.scopeMatrix?.isComplete) {
      return { label: 'Complete', color: 'success' as const, icon: <CompleteIcon fontSize="small" /> };
    }
    if (proposal.scopeMatrix) {
      const itemCount =
        (proposal.scopeMatrix.services?.length || 0) +
        (proposal.scopeMatrix.supply?.length || 0) +
        (proposal.scopeMatrix.exclusions?.length || 0);
      if (itemCount > 0) {
        return { label: 'In Progress', color: 'warning' as const, icon: <PendingIcon fontSize="small" /> };
      }
    }
    return { label: 'Not Started', color: 'default' as const, icon: <PendingIcon fontSize="small" /> };
  };

  if (loading) {
    return <LoadingState message="Loading proposals..." />;
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <EmptyState
          title="Error Loading Proposals"
          message={error}
          action={<Button onClick={() => window.location.reload()}>Retry</Button>}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Scope Matrix"
        subtitle="Define scope of services, supply, and exclusions for proposals"
      />

      {/* Filters */}
      <FilterBar onClear={handleClearFilters}>
        <TextField
          label="Search"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by proposal #, title, client..."
          sx={{ minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Scope Status</InputLabel>
          <Select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as typeof scopeFilter)}
            label="Scope Status"
          >
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="INCOMPLETE">Incomplete</MenuItem>
            <MenuItem value="COMPLETE">Complete</MenuItem>
          </Select>
        </FormControl>
      </FilterBar>

      {/* Table */}
      {filteredProposals.length === 0 ? (
        <EmptyState
          title="No Proposals Found"
          message={
            searchTerm || scopeFilter !== 'ALL'
              ? 'No proposals match your filters. Try adjusting your search criteria.'
              : 'No proposals are ready for scope definition. Create a proposal from an enquiry first.'
          }
          action={
            <Button variant="contained" onClick={() => router.push('/proposals/enquiries')}>
              View Enquiries
            </Button>
          }
        />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Proposal #</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Scope Status</TableCell>
                <TableCell>Items</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProposals.map((proposal) => {
                const scopeStatus = getScopeStatus(proposal);
                const serviceCount = proposal.scopeMatrix?.services?.length || 0;
                const supplyCount = proposal.scopeMatrix?.supply?.length || 0;
                const exclusionCount = proposal.scopeMatrix?.exclusions?.length || 0;
                const totalItems = serviceCount + supplyCount + exclusionCount;

                return (
                  <TableRow key={proposal.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {proposal.proposalNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{proposal.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {proposal.enquiryNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{proposal.clientName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(proposal.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={scopeStatus.label}
                        color={scopeStatus.color}
                        size="small"
                        icon={scopeStatus.icon}
                      />
                    </TableCell>
                    <TableCell>
                      {totalItems > 0 ? (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {serviceCount > 0 && (
                            <Chip label={`${serviceCount} svc`} size="small" variant="outlined" />
                          )}
                          {supplyCount > 0 && (
                            <Chip label={`${supplyCount} sup`} size="small" variant="outlined" />
                          )}
                          {exclusionCount > 0 && (
                            <Chip label={`${exclusionCount} exc`} size="small" variant="outlined" />
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <TableActionCell
                        actions={[
                          {
                            label: 'Edit Scope',
                            icon: <EditIcon fontSize="small" />,
                            onClick: () => handleEditScope(proposal.id),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
