'use client';

/**
 * Projects List Page
 *
 * Table view of all projects with filtering, sorting, and pagination
 * Moved from /projects to /projects/list for hub dashboard structure
 */

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
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
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Typography,
} from '@mui/material';
import {
  PageHeader,
  LoadingState,
  EmptyState,
  TableActionCell,
  getStatusColor,
  getPriorityColor,
} from '@vapour/ui';
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
import type { Project, ProjectStatus, ProjectPriority } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProjects, canManageProjects } from '@vapour/constants';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { useRouter } from 'next/navigation';

// Lazy load heavy dialog components
const CreateProjectDialog = dynamic(
  () => import('@/components/projects/CreateProjectDialog').then((mod) => mod.CreateProjectDialog),
  { ssr: false }
);
const EditProjectDialog = dynamic(
  () => import('@/components/projects/EditProjectDialog').then((mod) => mod.EditProjectDialog),
  { ssr: false }
);
const ViewProjectDialog = dynamic(
  () => import('@/components/projects/ViewProjectDialog').then((mod) => mod.ViewProjectDialog),
  { ssr: false }
);
const DeleteProjectDialog = dynamic(
  () => import('@/components/projects/DeleteProjectDialog').then((mod) => mod.DeleteProjectDialog),
  { ssr: false }
);

export default function ProjectsListPage() {
  const { claims } = useAuth();
  const router = useRouter();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<ProjectPriority | 'all'>('all');

  // Sorting
  type SortField = 'name' | 'code' | 'status' | 'priority' | 'client' | 'createdAt';
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Firestore query using custom hook
  const { db } = getFirebase();
  const projectsQuery = useMemo(
    () =>
      query(
        collection(db, COLLECTIONS.PROJECTS),
        orderBy('createdAt', 'desc'),
        firestoreLimit(100)
      ),
    [db]
  );

  const { data: projects, loading, error } = useFirestoreQuery<Project>(projectsQuery);

  // Client-side filtering and sorting
  const filteredAndSortedProjects = projects
    .filter((project) => {
      // Search filter
      const matchesSearch = searchTerm
        ? (project.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (project.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (project.client?.entityName || '').toLowerCase().includes(searchTerm.toLowerCase())
        : true;

      // Status filter
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;

      // Priority filter
      const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      let comparison = 0;

      const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

      switch (sortField) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'code':
          comparison = (a.code || '').localeCompare(b.code || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'priority':
          comparison = (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
          break;
        case 'client':
          comparison = (a.client?.entityName || '').localeCompare(b.client?.entityName || '');
          break;
        case 'createdAt':
          comparison = (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

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

  // Paginate projects in memory (client-side pagination)
  const paginatedProjects = filteredAndSortedProjects.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Check permissions
  const permissions = claims?.permissions || 0;
  const hasViewPermission = canViewProjects(permissions);
  const hasManagePermission = canManageProjects(permissions);

  // User must at least be able to view projects
  if (!hasViewPermission) {
    return (
      <>
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error">
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            You do not have permission to view projects.
          </Typography>
        </Box>
      </>
    );
  }

  return (
    <>
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <PageHeader
          title="All Projects"
          subtitle="View and manage all projects"
          action={
            hasManagePermission ? (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                New Project
              </Button>
            ) : undefined
          }
        />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search projects..."
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
                onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="PLANNING">Planning</MenuItem>
                <MenuItem value="PROPOSAL">Proposal</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="ON_HOLD">On Hold</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
                <MenuItem value="ARCHIVED">Archived</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priorityFilter}
                label="Priority"
                onChange={(e) => setPriorityFilter(e.target.value as ProjectPriority | 'all')}
              >
                <MenuItem value="all">All Priorities</MenuItem>
                <MenuItem value="CRITICAL">Critical</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="LOW">Low</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refresh">
              <IconButton onClick={() => window.location.reload()}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>

        {/* Projects Table */}
        {loading ? (
          <LoadingState message="Loading projects..." variant="page" />
        ) : filteredAndSortedProjects.length === 0 ? (
          <EmptyState
            message={
              projects.length === 0
                ? 'No projects yet. Click "New Project" to create your first project.'
                : 'No projects match your search criteria.'
            }
            variant="paper"
          />
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
                      Project Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'client'}
                      direction={sortField === 'client' ? sortDirection : 'asc'}
                      onClick={() => handleSort('client')}
                    >
                      Client
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'status'}
                      direction={sortField === 'status' ? sortDirection : 'asc'}
                      onClick={() => handleSort('status')}
                    >
                      Status
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'priority'}
                      direction={sortField === 'priority' ? sortDirection : 'asc'}
                      onClick={() => handleSort('priority')}
                    >
                      Priority
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Project Manager</TableCell>
                  <TableCell align="center">Team</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedProjects.map((project) => (
                  <TableRow
                    key={project.id}
                    hover
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      cursor: 'pointer',
                    }}
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {project.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {project.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{project.client.entityName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={project.status}
                        size="small"
                        color={getStatusColor(project.status, 'project')}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={project.priority}
                        size="small"
                        color={getPriorityColor(project.priority)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{project.projectManager.userName}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">{project.team?.length || 0}</Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <TableActionCell
                        actions={[
                          {
                            icon: <ViewIcon fontSize="small" />,
                            label: 'View Project',
                            onClick: () => router.push(`/projects/${project.id}`),
                          },
                          {
                            icon: <EditIcon fontSize="small" />,
                            label: 'Edit Project',
                            onClick: () => {
                              setSelectedProject(project);
                              setEditDialogOpen(true);
                            },
                            show: hasManagePermission,
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
              count={filteredAndSortedProjects.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </TableContainer>
        )}

        {/* Create Project Dialog */}
        <CreateProjectDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onSuccess={() => {
            setCreateDialogOpen(false);
          }}
        />

        {/* View Project Dialog */}
        <ViewProjectDialog
          open={viewDialogOpen}
          project={selectedProject}
          onClose={() => {
            setViewDialogOpen(false);
            setSelectedProject(null);
          }}
          onEdit={() => {
            setViewDialogOpen(false);
            setEditDialogOpen(true);
          }}
          onDelete={() => {
            setViewDialogOpen(false);
            setDeleteDialogOpen(true);
          }}
          canManage={hasManagePermission}
        />

        {/* Edit Project Dialog */}
        <EditProjectDialog
          open={editDialogOpen}
          project={selectedProject}
          onClose={() => {
            setEditDialogOpen(false);
            setSelectedProject(null);
          }}
          onSuccess={() => {
            setEditDialogOpen(false);
            setSelectedProject(null);
          }}
        />

        {/* Delete Project Dialog */}
        <DeleteProjectDialog
          open={deleteDialogOpen}
          project={selectedProject}
          onClose={() => {
            setDeleteDialogOpen(false);
            setSelectedProject(null);
          }}
          onSuccess={() => {
            setDeleteDialogOpen(false);
            setSelectedProject(null);
          }}
        />
      </Box>
    </>
  );
}
