'use client';

/**
 * Projects — single list view (module landing page)
 *
 * Rendered at both /projects and /projects/list. Replaces the old
 * hub-of-cards + separate list two-step: status counts are clickable
 * filter chips on the list itself, and the active filters sync to the
 * URL (?status=&priority=&q=) so deep links and card-style shortcuts
 * land pre-filtered (rule 30b: history.replaceState, not router.replace).
 */

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Box,
  Paper,
  Button,
  TextField,
  InputAdornment,
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
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
  Home as HomeIcon,
  Folder as FilesIcon,
  RateReview as ReviewIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Project, ProjectStatus, ProjectPriority } from '@vapour/types';
import { PROJECT_STATUS_LABELS } from '@vapour/types';
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

// Chips always shown, in workflow order; the remaining statuses
// (PROPOSAL, CANCELLED, ARCHIVED) appear only when they have projects.
const CORE_STATUSES: ProjectStatus[] = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'];
const EXTRA_STATUSES: ProjectStatus[] = ['PROPOSAL', 'CANCELLED', 'ARCHIVED'];

const VALID_STATUSES = new Set<string>([...CORE_STATUSES, ...EXTRA_STATUSES]);
const VALID_PRIORITIES = new Set<string>(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

export default function ProjectsListClient() {
  const { user, claims } = useAuth();
  const router = useRouter();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<ProjectPriority | 'all'>('all');
  // Guards the URL-sync effect until the initial ?status=&priority=&q= read
  // has happened, so the mount render doesn't wipe the incoming params.
  const [urlSynced, setUrlSynced] = useState(false);

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

  // Check permissions (must be before useMemo that references hasManagePermission)
  const permissions = claims?.permissions || 0;
  const hasViewPermission = canViewProjects(permissions);
  const hasManagePermission = canManageProjects(permissions);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Initialize filters from the URL so shortcuts like ?status=PLANNING land
  // pre-filtered. window.location is parsed directly (not useSearchParams)
  // to avoid a Suspense boundary under output: 'export'.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status')?.toUpperCase();
    if (status && VALID_STATUSES.has(status)) setStatusFilter(status as ProjectStatus);
    const priority = params.get('priority')?.toUpperCase();
    if (priority && VALID_PRIORITIES.has(priority)) setPriorityFilter(priority as ProjectPriority);
    const q = params.get('q');
    if (q) setSearchTerm(q);
    setUrlSynced(true);
  }, []);

  // Keep the URL in step with the active filters so the view is
  // shareable/bookmarkable. history.replaceState — never router.replace,
  // which would re-focus the page root on every keystroke (rule 30b).
  useEffect(() => {
    if (!urlSynced || typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (searchTerm) params.set('q', searchTerm);
    const search = params.toString();
    const url = `${window.location.pathname}${search ? `?${search}` : ''}`;
    window.history.replaceState(null, '', url);
  }, [urlSynced, statusFilter, priorityFilter, searchTerm]);

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

  const { data: allProjects, loading, error } = useFirestoreQuery<Project>(projectsQuery);

  // Access-scoped projects: admins see all, others see only their projects
  const projects = useMemo(() => {
    if (hasManagePermission) return allProjects;
    const uid = user?.uid;
    if (!uid) return [];
    return allProjects.filter(
      (p) => p.projectManager?.userId === uid || p.team?.some((m) => m.userId === uid && m.isActive)
    );
  }, [allProjects, hasManagePermission, user?.uid]);

  // Status counts for the filter chips (over access-scoped projects,
  // independent of the currently selected status).
  const statusCounts = useMemo(() => {
    const counts = new Map<ProjectStatus, number>();
    for (const p of projects) {
      counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
    }
    return counts;
  }, [projects]);
  const chipStatuses: ProjectStatus[] = [
    ...CORE_STATUSES,
    ...EXTRA_STATUSES.filter((s) => (statusCounts.get(s) ?? 0) > 0),
  ];

  const selectStatus = (status: ProjectStatus | 'all') => {
    setStatusFilter(status);
    setPage(0);
  };

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
      <PageBreadcrumbs
        items={[{ label: 'Projects', href: '/projects', icon: <HomeIcon fontSize="small" /> }]}
      />
      <Box sx={{ mb: 4 }}>
        {/* Header */}
        <PageHeader
          title="Projects"
          subtitle="Manage projects from initiation to completion"
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<ReviewIcon />}
                onClick={() => router.push('/flow/portfolio')}
              >
                Portfolio Review
              </Button>
              <Button
                variant="outlined"
                startIcon={<FilesIcon />}
                onClick={() => router.push('/projects/files')}
              >
                Files
              </Button>
              {hasManagePermission && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateDialogOpen(true)}
                >
                  New Project
                </Button>
              )}
            </Box>
          }
        />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}

        {/* Status filter chips — one click from anywhere to a filtered view */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip
            label={`All (${projects.length})`}
            color={statusFilter === 'all' ? 'primary' : 'default'}
            variant={statusFilter === 'all' ? 'filled' : 'outlined'}
            onClick={() => selectStatus('all')}
          />
          {chipStatuses.map((status) => (
            <Chip
              key={status}
              label={`${PROJECT_STATUS_LABELS[status]} (${statusCounts.get(status) ?? 0})`}
              color={statusFilter === status ? getStatusColor(status, 'project') : 'default'}
              variant={statusFilter === status ? 'filled' : 'outlined'}
              onClick={() => selectStatus(status)}
            />
          ))}
        </Box>

        {/* Search + priority */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
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
              <InputLabel>Priority</InputLabel>
              <Select
                value={priorityFilter}
                label="Priority"
                onChange={(e) => {
                  setPriorityFilter(e.target.value as ProjectPriority | 'all');
                  setPage(0);
                }}
              >
                <MenuItem value="all">All Priorities</MenuItem>
                <MenuItem value="CRITICAL">Critical</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="LOW">Low</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Clear filters">
              <IconButton
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setPage(0);
                }}
                aria-label="Clear filters"
              >
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
                      <Typography variant="body2">{project.client?.entityName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={PROJECT_STATUS_LABELS[project.status] ?? project.status}
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
                      <Typography variant="body2">{project.projectManager?.userName}</Typography>
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
