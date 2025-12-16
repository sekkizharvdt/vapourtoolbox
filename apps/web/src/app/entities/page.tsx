'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import {
  PageHeader,
  StatCard,
  FilterBar,
  LoadingState,
  EmptyState,
  TableActionCell,
} from '@vapour/ui';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canViewEntities, canCreateEntities } from '@vapour/constants';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';

// Lazy load heavy dialog components
const CreateEntityDialog = dynamic(
  () => import('@/components/entities/CreateEntityDialog').then((mod) => mod.CreateEntityDialog),
  { ssr: false }
);
const EditEntityDialog = dynamic(
  () => import('@/components/entities/EditEntityDialog').then((mod) => mod.EditEntityDialog),
  { ssr: false }
);
const ViewEntityDialog = dynamic(
  () => import('@/components/entities/ViewEntityDialog').then((mod) => mod.ViewEntityDialog),
  { ssr: false }
);
const ArchiveEntityDialog = dynamic(
  () => import('@/components/entities/ArchiveEntityDialog').then((mod) => mod.ArchiveEntityDialog),
  { ssr: false }
);
const UnarchiveEntityDialog = dynamic(
  () =>
    import('@/components/entities/UnarchiveEntityDialog').then((mod) => mod.UnarchiveEntityDialog),
  { ssr: false }
);

export default function EntitiesPage() {
  const { claims } = useAuth();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Sorting
  type SortField = 'name' | 'contactPerson' | 'status' | 'createdAt';
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [unarchiveDialogOpen, setUnarchiveDialogOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<BusinessEntity | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Firestore query using custom hook
  const { db } = getFirebase();
  const entitiesQuery = useMemo(
    () =>
      query(
        collection(db, COLLECTIONS.ENTITIES),
        orderBy('createdAt', 'desc'),
        firestoreLimit(100)
      ),
    [db]
  );

  const { data: allEntities, loading, error } = useFirestoreQuery<BusinessEntity>(entitiesQuery);

  // Filter out deleted entities (client-side filtering to handle legacy data)
  const entities = allEntities.filter((entity) => entity.isDeleted !== true);

  // Client-side filtering and sorting
  const filteredAndSortedEntities = entities
    .filter((entity) => {
      // Search filter
      const matchesSearch = searchTerm
        ? (entity.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (entity.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (entity.contactPerson || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (entity.email || '').toLowerCase().includes(searchTerm.toLowerCase())
        : true;

      // Status filter (uses isArchived boolean)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && entity.isArchived !== true) ||
        (statusFilter === 'archived' && entity.isArchived === true);

      // Role filter
      const matchesRole =
        roleFilter === 'all' ||
        entity.roles.includes(roleFilter.toUpperCase() as 'VENDOR' | 'CUSTOMER');

      return matchesSearch && matchesStatus && matchesRole;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'contactPerson':
          comparison = (a.contactPerson || '').localeCompare(b.contactPerson || '');
          break;
        case 'status':
          // Sort by isActive: active first (true > false)
          comparison = (a.isActive === false ? 1 : 0) - (b.isActive === false ? 1 : 0);
          break;
        case 'createdAt':
          comparison = (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Stats (uses isArchived boolean)
  const stats = {
    total: entities.length,
    active: entities.filter((e) => e.isArchived !== true).length,
    archived: entities.filter((e) => e.isArchived === true).length,
    vendors: entities.filter((e) => e.roles.includes('VENDOR')).length,
    customers: entities.filter((e) => e.roles.includes('CUSTOMER')).length,
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Pagination handlers
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Paginate entities in memory (client-side pagination)
  const paginatedEntities = filteredAndSortedEntities.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Check permissions
  const permissions = claims?.permissions || 0;
  const hasViewPermission = canViewEntities(permissions);
  const hasCreatePermission = canCreateEntities(permissions);

  // User must at least be able to view entities
  if (!hasViewPermission) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="error">
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
          You do not have permission to view entities.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <PageHeader
          title="Entity Management"
          subtitle="Manage vendors, customers, and business partners"
          action={
            hasCreatePermission ? (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                New Entity
              </Button>
            ) : undefined
          }
        />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Total Entities" value={stats.total} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Active" value={stats.active} color="success" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Archived" value={stats.archived} color="warning" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Vendors" value={stats.vendors} color="info" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Customers" value={stats.customers} color="primary" />
          </Grid>
        </Grid>

        {/* Filters */}
        <FilterBar onClear={() => window.location.reload()}>
          <TextField
            placeholder="Search entities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value as 'active' | 'archived' | 'all')}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Role</InputLabel>
            <Select value={roleFilter} label="Role" onChange={(e) => setRoleFilter(e.target.value)}>
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="VENDOR">Vendor</MenuItem>
              <MenuItem value="CUSTOMER">Customer</MenuItem>
              <MenuItem value="PARTNER">Partner</MenuItem>
              <MenuItem value="SUPPLIER">Supplier</MenuItem>
            </Select>
          </FormControl>
        </FilterBar>

        {/* Entities Table */}
        {loading ? (
          <LoadingState message="Loading entities..." variant="table" colSpan={5} />
        ) : filteredAndSortedEntities.length === 0 ? (
          <EmptyState
            message={
              entities.length === 0
                ? 'No entities yet. Click "New Entity" to create your first entity.'
                : 'No entities match your search criteria.'
            }
            variant="table"
            colSpan={5}
          />
        ) : (
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'name'}
                      direction={sortField === 'name' ? sortDirection : 'asc'}
                      onClick={() => handleSort('name')}
                    >
                      Entity Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Roles</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'contactPerson'}
                      direction={sortField === 'contactPerson' ? sortDirection : 'asc'}
                      onClick={() => handleSort('contactPerson')}
                    >
                      Contact Person
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'status'}
                      direction={sortField === 'status' ? sortDirection : 'asc'}
                      onClick={() => handleSort('status')}
                    >
                      Status
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedEntities.map((entity) => (
                  <TableRow
                    key={entity.id}
                    hover
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {entity.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {entity.roles.map((role) => (
                          <Chip
                            key={role}
                            label={role}
                            size="small"
                            sx={{
                              ...(role === 'VENDOR' && {
                                bgcolor: 'info.main',
                                color: 'info.contrastText',
                              }),
                              ...(role === 'CUSTOMER' && {
                                bgcolor: 'success.main',
                                color: 'success.contrastText',
                              }),
                              ...(role !== 'VENDOR' &&
                                role !== 'CUSTOMER' && {
                                  bgcolor: 'grey.200',
                                  color: 'text.primary',
                                }),
                            }}
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{entity.contactPerson}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={entity.billingAddress?.state ? 'text.primary' : 'error'}
                      >
                        {entity.billingAddress?.state || 'Not set'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={entity.isArchived === true ? 'Archived' : 'Active'}
                        size="small"
                        color={entity.isArchived === true ? 'warning' : 'success'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TableActionCell
                        actions={[
                          {
                            icon: <ViewIcon />,
                            label: 'View Details',
                            onClick: () => {
                              setSelectedEntity(entity);
                              setViewDialogOpen(true);
                            },
                          },
                          {
                            icon: <EditIcon />,
                            label: 'Edit Entity',
                            onClick: () => {
                              setSelectedEntity(entity);
                              setEditDialogOpen(true);
                            },
                            show: hasCreatePermission && entity.isArchived !== true,
                          },
                          {
                            icon: <ArchiveIcon />,
                            label: 'Archive Entity',
                            onClick: () => {
                              setSelectedEntity(entity);
                              setArchiveDialogOpen(true);
                            },
                            show: hasCreatePermission && entity.isArchived !== true,
                          },
                          {
                            icon: <UnarchiveIcon />,
                            label: 'Unarchive Entity',
                            onClick: () => {
                              setSelectedEntity(entity);
                              setUnarchiveDialogOpen(true);
                            },
                            show: hasCreatePermission && entity.isArchived === true,
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[25, 50, 100]}
              component="div"
              count={filteredAndSortedEntities.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </TableContainer>
        )}

        {/* Create Entity Dialog */}
        <CreateEntityDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onSuccess={() => {
            setCreateDialogOpen(false);
          }}
        />

        {/* View Entity Dialog */}
        <ViewEntityDialog
          open={viewDialogOpen}
          entity={selectedEntity}
          onClose={() => {
            setViewDialogOpen(false);
            setSelectedEntity(null);
          }}
          onEdit={() => {
            setViewDialogOpen(false);
            setEditDialogOpen(true);
          }}
          onArchive={() => {
            setViewDialogOpen(false);
            setArchiveDialogOpen(true);
          }}
          canEdit={hasCreatePermission}
          canArchive={hasCreatePermission}
        />

        {/* Edit Entity Dialog */}
        <EditEntityDialog
          open={editDialogOpen}
          entity={selectedEntity}
          onClose={() => {
            setEditDialogOpen(false);
            setSelectedEntity(null);
          }}
          onSuccess={() => {
            setEditDialogOpen(false);
            setSelectedEntity(null);
          }}
        />

        {/* Archive Entity Dialog */}
        <ArchiveEntityDialog
          open={archiveDialogOpen}
          entity={selectedEntity}
          onClose={() => {
            setArchiveDialogOpen(false);
            setSelectedEntity(null);
          }}
          onSuccess={() => {
            setArchiveDialogOpen(false);
            setSelectedEntity(null);
          }}
        />

        {/* Unarchive Entity Dialog */}
        <UnarchiveEntityDialog
          open={unarchiveDialogOpen}
          entity={selectedEntity}
          onClose={() => {
            setUnarchiveDialogOpen(false);
            setSelectedEntity(null);
          }}
          onSuccess={() => {
            setUnarchiveDialogOpen(false);
            setSelectedEntity(null);
          }}
        />
      </Box>
    </>
  );
}
