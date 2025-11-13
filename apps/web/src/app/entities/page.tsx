'use client';

import { useState, useMemo } from 'react';
import {
  Container,
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
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity, Status } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { CreateEntityDialog } from '@/components/entities/CreateEntityDialog';
import { EditEntityDialog } from '@/components/entities/EditEntityDialog';
import { ViewEntityDialog } from '@/components/entities/ViewEntityDialog';
import { DeleteEntityDialog } from '@/components/entities/DeleteEntityDialog';
import { canViewEntities, canCreateEntities } from '@vapour/constants';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';

export default function EntitiesPage() {
  const { claims } = useAuth();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Sorting
  type SortField = 'name' | 'code' | 'contactPerson' | 'email' | 'status' | 'createdAt';
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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

      // Status filter
      const matchesStatus = statusFilter === 'all' || entity.status === statusFilter;

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
        case 'code':
          comparison = (a.code || '').localeCompare(b.code || '');
          break;
        case 'contactPerson':
          comparison = (a.contactPerson || '').localeCompare(b.contactPerson || '');
          break;
        case 'email':
          comparison = (a.email || '').localeCompare(b.email || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'createdAt':
          comparison = (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Stats
  const stats = {
    total: entities.length,
    active: entities.filter((e) => e.status === 'active').length,
    inactive: entities.filter((e) => e.status === 'inactive').length,
    vendors: entities.filter((e) => e.roles.includes('VENDOR')).length,
    customers: entities.filter((e) => e.roles.includes('CUSTOMER')).length,
  };

  // Get status color
  const getStatusColor = (status: Status): 'default' | 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'warning';
      case 'draft':
        return 'default';
      case 'archived':
        return 'error';
      default:
        return 'default';
    }
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
      <Container maxWidth="xl">
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error">
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            You do not have permission to view entities.
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <div>
            <Typography variant="h4" component="h1" gutterBottom>
              Entity Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage vendors, customers, and business partners
            </Typography>
          </div>
          {hasCreatePermission && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              New Entity
            </Button>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Total Entities
                </Typography>
                <Typography variant="h4">{stats.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Active
                </Typography>
                <Typography variant="h4">{stats.active}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Inactive
                </Typography>
                <Typography variant="h4">{stats.inactive}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Vendors
                </Typography>
                <Typography variant="h4">{stats.vendors}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Customers
                </Typography>
                <Typography variant="h4">{stats.customers}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
                onChange={(e) => setStatusFilter(e.target.value as Status | 'all')}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                label="Role"
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <MenuItem value="all">All Roles</MenuItem>
                <MenuItem value="VENDOR">Vendor</MenuItem>
                <MenuItem value="CUSTOMER">Customer</MenuItem>
                <MenuItem value="PARTNER">Partner</MenuItem>
                <MenuItem value="SUPPLIER">Supplier</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refresh">
              <IconButton onClick={() => window.location.reload()}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>

        {/* Entities Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredAndSortedEntities.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {entities.length === 0
                ? 'No entities yet. Click "New Entity" to create your first entity.'
                : 'No entities match your search criteria.'}
            </Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'code'}
                      direction={sortField === 'code' ? sortDirection : 'asc'}
                      onClick={() => handleSort('code')}
                    >
                      Code
                    </TableSortLabel>
                  </TableCell>
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
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'email'}
                      direction={sortField === 'email' ? sortDirection : 'asc'}
                      onClick={() => handleSort('email')}
                    >
                      Email
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Phone</TableCell>
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
                        {entity.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {entity.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {entity.roles.map((role) => (
                          <Chip key={role} label={role} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{entity.contactPerson}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{entity.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{entity.phone}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={entity.status}
                        size="small"
                        color={getStatusColor(entity.status)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedEntity(entity);
                              setViewDialogOpen(true);
                            }}
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {hasCreatePermission && (
                          <Tooltip title="Edit Entity">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedEntity(entity);
                                setEditDialogOpen(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
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
          onDelete={() => {
            setViewDialogOpen(false);
            setDeleteDialogOpen(true);
          }}
          canEdit={hasCreatePermission}
          canDelete={hasCreatePermission}
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

        {/* Delete Entity Dialog */}
        <DeleteEntityDialog
          open={deleteDialogOpen}
          entity={selectedEntity}
          onClose={() => {
            setDeleteDialogOpen(false);
            setSelectedEntity(null);
          }}
          onSuccess={() => {
            setDeleteDialogOpen(false);
            setSelectedEntity(null);
          }}
        />
      </Box>
    </Container>
  );
}
