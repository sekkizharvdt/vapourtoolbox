'use client';

/**
 * Master Document List Tab
 *
 * Main MDL view with stats, filters, grouped/flat table, and CRUD dialogs.
 * Assembles existing components (CreateDocumentDialog, EditDocumentDialog,
 * DocumentRegisterUploadDialog, GroupedDocumentsTable, DocumentMetrics, QuickFilters).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Box,
  Button,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  Typography,
  Alert,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as ImportIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  ViewList as FlatViewIcon,
  AccountTree as GroupedViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { FilterBar, LoadingState, EmptyState, TableActionCell } from '@vapour/ui';
import type { MasterDocumentEntry, MasterDocumentStatus, DisciplineCode } from '@vapour/types';
import type { Project } from '@vapour/types';
import { canManageDocuments } from '@vapour/constants';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import {
  getMasterDocumentsByProject,
  deleteMasterDocument,
} from '@/lib/documents/masterDocumentService';
import {
  getNumberingConfig,
  getActiveDisciplineCodes,
} from '@/lib/documents/documentNumberingService';
import { downloadMDLAsCSV } from '@/lib/documents/exportMDL';
import { formatDate } from '@/lib/utils/formatters';
import { DocumentMetrics, type MetricFilter } from '@/app/documents/components/DocumentMetrics';
import { QuickFilters } from '@/app/documents/components/QuickFilters';
import { GroupedDocumentsTable } from '@/app/documents/components/GroupedDocumentsTable';

// Dynamic imports for dialogs
const CreateDocumentDialog = dynamic(
  () => import('@/app/documents/components/CreateDocumentDialog'),
  { ssr: false }
);
const EditDocumentDialog = dynamic(() => import('@/app/documents/components/EditDocumentDialog'), {
  ssr: false,
});
const DocumentRegisterUploadDialog = dynamic(
  () => import('@/app/documents/components/DocumentRegisterUploadDialog'),
  { ssr: false }
);
const NumberingSetupDialog = dynamic(() => import('./NumberingSetupDialog'), { ssr: false });

// Status color map
const STATUS_COLORS: Record<
  MasterDocumentStatus,
  'default' | 'info' | 'warning' | 'success' | 'error'
> = {
  DRAFT: 'default',
  IN_PROGRESS: 'info',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  ACCEPTED: 'success',
  ON_HOLD: 'warning',
  CANCELLED: 'error',
};

const PRIORITY_COLORS: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'error',
};

const STATUS_OPTIONS: { value: MasterDocumentStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

interface MasterDocumentListTabProps {
  project: Project;
}

export default function MasterDocumentListTab({ project }: MasterDocumentListTabProps) {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { db } = getFirebase();
  const hasManageAccess = claims?.permissions ? canManageDocuments(claims.permissions) : false;

  // Data
  const [documents, setDocuments] = useState<MasterDocumentEntry[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineCode[]>([]);
  const [hasNumberingConfig, setHasNumberingConfig] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MasterDocumentStatus | ''>('');
  const [disciplineFilter, setDisciplineFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [metricFilter, setMetricFilter] = useState<MetricFilter | null>(null);

  // View
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [editDocument, setEditDocument] = useState<MasterDocumentEntry | null>(null);
  const [deleteDocument, setDeleteDocument] = useState<MasterDocumentEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load data
  const loadDocuments = useCallback(async () => {
    if (!db) return;

    try {
      const filters: Record<string, string> = {};
      if (statusFilter) filters.status = statusFilter;
      if (disciplineFilter) filters.disciplineCode = disciplineFilter;

      const docs = await getMasterDocumentsByProject(db, project.id, filters);
      setDocuments(docs.filter((d) => !d.isDeleted));
    } catch (err) {
      console.error('[MasterDocumentListTab] Error loading documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    }
  }, [db, project.id, statusFilter, disciplineFilter]);

  const loadConfig = useCallback(async () => {
    try {
      const [config, activeDisciplines] = await Promise.all([
        getNumberingConfig(project.id),
        getActiveDisciplineCodes(project.id),
      ]);
      setHasNumberingConfig(!!config);
      setDisciplines(activeDisciplines);
    } catch (err) {
      console.error('[MasterDocumentListTab] Error loading config:', err);
    }
  }, [project.id]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadDocuments(), loadConfig()]);
      setLoading(false);
    };
    init();
  }, [loadDocuments, loadConfig]);

  // Reload when filters change
  useEffect(() => {
    if (!loading) {
      loadDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, disciplineFilter]);

  // Filtered documents (client-side filters on top of server-side)
  const filteredDocuments = useMemo(() => {
    let result = documents;

    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (doc) =>
          doc.documentNumber.toLowerCase().includes(query) ||
          doc.documentTitle.toLowerCase().includes(query) ||
          doc.description?.toLowerCase().includes(query)
      );
    }

    // Priority filter
    if (priorityFilter) {
      result = result.filter((doc) => doc.priority === priorityFilter);
    }

    // Quick filters
    if (quickFilter === 'my-docs' && user) {
      result = result.filter((doc) => doc.assignedTo.includes(user.uid));
    } else if (quickFilter === 'overdue') {
      const now = new Date();
      result = result.filter((doc) => {
        if (!doc.dueDate || doc.status === 'ACCEPTED' || doc.status === 'CANCELLED') return false;
        const dueDate =
          doc.dueDate && typeof doc.dueDate === 'object' && 'seconds' in doc.dueDate
            ? new Date((doc.dueDate as { seconds: number }).seconds * 1000)
            : null;
        return dueDate ? dueDate < now : false;
      });
    } else if (quickFilter === 'pending-review') {
      result = result.filter((doc) => doc.status === 'SUBMITTED' || doc.status === 'UNDER_REVIEW');
    } else if (quickFilter === 'client-visible') {
      result = result.filter((doc) => doc.visibility === 'CLIENT_VISIBLE');
    }

    // Metric filter
    if (metricFilter === 'overdue') {
      const now = new Date();
      result = result.filter((doc) => {
        if (!doc.dueDate || doc.status === 'ACCEPTED') return false;
        const dueDate =
          doc.dueDate && typeof doc.dueDate === 'object' && 'seconds' in doc.dueDate
            ? new Date((doc.dueDate as { seconds: number }).seconds * 1000)
            : null;
        return dueDate ? dueDate < now : false;
      });
    } else if (metricFilter === 'review') {
      result = result.filter((doc) => doc.status === 'SUBMITTED' || doc.status === 'UNDER_REVIEW');
    } else if (metricFilter === 'completed') {
      result = result.filter((doc) => doc.status === 'ACCEPTED');
    }

    return result;
  }, [documents, searchQuery, priorityFilter, quickFilter, metricFilter, user]);

  // Paginated documents
  const paginatedDocuments = useMemo(
    () => filteredDocuments.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredDocuments, page, rowsPerPage]
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadDocuments(), loadConfig()]);
  }, [loadDocuments, loadConfig]);

  const handleDelete = async () => {
    if (!deleteDocument || !user) return;
    setDeleting(true);
    try {
      await deleteMasterDocument(deleteDocument.projectId, deleteDocument.id, user.uid);
      setDeleteDocument(null);
      await loadDocuments();
    } catch (err) {
      console.error('[MasterDocumentListTab] Error deleting:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setDisciplineFilter('');
    setPriorityFilter('');
    setQuickFilter(null);
    setMetricFilter(null);
    setPage(0);
  };

  const handleMetricClick = (filter: MetricFilter) => {
    setMetricFilter((prev) => (prev === filter ? null : filter));
    setQuickFilter(null);
    setPage(0);
  };

  const handleQuickFilterChange = (filter: string | null) => {
    setQuickFilter(filter);
    setMetricFilter(null);
    setPage(0);
  };

  const handleRowClick = (doc: MasterDocumentEntry) => {
    router.push(`/documents/${doc.id}?projectId=${doc.projectId}`);
  };

  if (loading) {
    return <LoadingState message="Loading master document list..." variant="page" />;
  }

  return (
    <Box>
      {/* Setup Banner */}
      {hasNumberingConfig === false && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<SettingsIcon />}
              onClick={() => setSetupDialogOpen(true)}
            >
              Set Up Now
            </Button>
          }
        >
          <Typography variant="body2">
            <strong>Document numbering not configured.</strong> Set up discipline codes to enable
            automatic document numbering for this project.
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Action Bar */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">
          Master Document List
          <Chip label={filteredDocuments.length} size="small" sx={{ ml: 1 }} />
        </Typography>
        <Stack direction="row" spacing={1}>
          {hasManageAccess && (
            <>
              <Button
                variant="outlined"
                startIcon={<ImportIcon />}
                onClick={() => setImportDialogOpen(true)}
                disabled={!hasNumberingConfig}
              >
                Import Register
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
                disabled={!hasNumberingConfig}
              >
                New Document
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {/* Metrics */}
      <DocumentMetrics documents={documents} onMetricClick={handleMetricClick} />

      {/* Quick Filters */}
      <QuickFilters
        activeFilter={quickFilter}
        onFilterChange={handleQuickFilterChange}
        currentUserId={user?.uid}
      />

      {/* Filter Bar */}
      <FilterBar
        onClear={
          searchQuery || statusFilter || disciplineFilter || priorityFilter
            ? handleClearFilters
            : undefined
        }
      >
        <TextField
          size="small"
          placeholder="Search by number or title..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ minWidth: 250 }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => {
              setStatusFilter(e.target.value as MasterDocumentStatus | '');
              setPage(0);
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Discipline</InputLabel>
          <Select
            value={disciplineFilter}
            label="Discipline"
            onChange={(e) => {
              setDisciplineFilter(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">All Disciplines</MenuItem>
            {disciplines.map((disc) => (
              <MenuItem key={disc.code} value={disc.code}>
                {disc.code} - {disc.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Priority</InputLabel>
          <Select
            value={priorityFilter}
            label="Priority"
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(0);
            }}
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tooltip title="Export CSV">
          <span>
            <IconButton
              onClick={() => downloadMDLAsCSV(filteredDocuments, project.code)}
              disabled={filteredDocuments.length === 0}
            >
              <DownloadIcon />
            </IconButton>
          </span>
        </Tooltip>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, val) => val && setViewMode(val)}
          size="small"
        >
          <ToggleButton value="flat">
            <Tooltip title="Flat View">
              <FlatViewIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="grouped">
            <Tooltip title="Grouped by Discipline">
              <GroupedViewIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </FilterBar>

      {/* Table */}
      {filteredDocuments.length === 0 ? (
        <EmptyState
          message={
            documents.length === 0
              ? 'No documents in this project yet'
              : 'No documents match your filters'
          }
          variant="paper"
          action={
            documents.length === 0 &&
            hasManageAccess && (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<ImportIcon />}
                  onClick={() => setImportDialogOpen(true)}
                  disabled={!hasNumberingConfig}
                >
                  Import Register
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateDialogOpen(true)}
                  disabled={!hasNumberingConfig}
                >
                  Create First Document
                </Button>
              </Stack>
            )
          }
        />
      ) : viewMode === 'grouped' ? (
        <GroupedDocumentsTable documents={filteredDocuments} />
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Doc Number</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Rev</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Assigned To</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell align="center">Progress</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedDocuments.map((doc) => {
                  const isOverdue = (() => {
                    if (!doc.dueDate || doc.status === 'ACCEPTED' || doc.status === 'CANCELLED')
                      return false;
                    const dueDate =
                      doc.dueDate && typeof doc.dueDate === 'object' && 'seconds' in doc.dueDate
                        ? new Date((doc.dueDate as { seconds: number }).seconds * 1000)
                        : null;
                    return dueDate ? dueDate < new Date() : false;
                  })();

                  return (
                    <TableRow
                      key={doc.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(doc)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium" noWrap>
                          {doc.documentNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                          {doc.documentTitle}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {doc.documentType || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={doc.currentRevision} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={doc.status.replace(/_/g, ' ')}
                          size="small"
                          color={STATUS_COLORS[doc.status] || 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                          {doc.assignedToNames?.length > 0 ? doc.assignedToNames.join(', ') : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={isOverdue ? 'error.main' : 'text.primary'}
                          fontWeight={isOverdue ? 600 : 400}
                        >
                          {formatDate(doc.dueDate)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={doc.priority}
                          size="small"
                          color={PRIORITY_COLORS[doc.priority] || 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack alignItems="center" spacing={0.5}>
                          <LinearProgress
                            variant="determinate"
                            value={doc.progressPercentage ?? 0}
                            sx={{ width: 60, height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {doc.progressPercentage ?? 0}%
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <TableActionCell
                          actions={[
                            {
                              icon: <ViewIcon fontSize="small" />,
                              label: 'View Details',
                              onClick: () => handleRowClick(doc),
                            },
                            {
                              icon: <EditIcon fontSize="small" />,
                              label: 'Edit',
                              onClick: () => setEditDocument(doc),
                              show: hasManageAccess,
                            },
                            {
                              icon: <DeleteIcon fontSize="small" />,
                              label: 'Delete',
                              onClick: () => setDeleteDocument(doc),
                              show: hasManageAccess,
                              color: 'error',
                              disabled: doc.status === 'ACCEPTED' || doc.status === 'CANCELLED',
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
          <TablePagination
            component="div"
            count={filteredDocuments.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </Paper>
      )}

      {/* Create Document Dialog */}
      <CreateDocumentDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        projectId={project.id}
        projectCode={project.code}
        onDocumentCreated={() => {
          setCreateDialogOpen(false);
          handleRefresh();
        }}
      />

      {/* Import Register Dialog */}
      <DocumentRegisterUploadDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        projectId={project.id}
        projectCode={project.code}
        onDocumentsImported={() => {
          setImportDialogOpen(false);
          handleRefresh();
        }}
      />

      {/* Numbering Setup Dialog */}
      <NumberingSetupDialog
        open={setupDialogOpen}
        onClose={() => setSetupDialogOpen(false)}
        projectId={project.id}
        projectCode={project.code}
        onSetupComplete={handleRefresh}
      />

      {/* Edit Document Dialog */}
      {editDocument && (
        <EditDocumentDialog
          open={!!editDocument}
          onClose={() => setEditDocument(null)}
          document={editDocument}
          onUpdate={() => {
            setEditDocument(null);
            handleRefresh();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDocument} onClose={() => !deleting && setDeleteDocument(null)}>
        <DialogTitle>Delete Document</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Are you sure you want to delete <strong>{deleteDocument?.documentNumber}</strong>{' '}
            &mdash; {deleteDocument?.documentTitle}? This will move the document to trash.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDocument(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
