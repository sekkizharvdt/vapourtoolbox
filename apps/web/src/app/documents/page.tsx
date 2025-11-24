'use client';

/**
 * Master Document List Page
 *
 * Main page for managing project documents
 * - View all master documents
 * - Filter by project, discipline, status
 * - Create new documents
 * - Access document details
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  TablePagination,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  FilterList as FilterListIcon,
  Send as SendIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { MasterDocumentEntry } from '@vapour/types';
import { getMasterDocumentsByProject } from '@/lib/documents/masterDocumentService';
import CreateDocumentDialog from './components/CreateDocumentDialog';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';

export default function MasterDocumentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<MasterDocumentEntry[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<MasterDocumentEntry[]>([]);

  // Selected project
  const [projectId, setProjectId] = useState<string>('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('ALL');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('ALL');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadDocuments();
    } else {
      setDocuments([]);
      setFilteredDocuments([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, searchQuery, statusFilter, disciplineFilter, visibilityFilter]);

  const loadDocuments = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const data = await getMasterDocumentsByProject(projectId);
      setDocuments(data);
    } catch (error) {
      console.error('[MasterDocumentsPage] Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...documents];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.documentNumber.toLowerCase().includes(query) ||
          doc.documentTitle.toLowerCase().includes(query) ||
          doc.description.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((doc) => doc.status === statusFilter);
    }

    // Discipline filter
    if (disciplineFilter !== 'ALL') {
      filtered = filtered.filter((doc) => doc.disciplineCode === disciplineFilter);
    }

    // Visibility filter
    if (visibilityFilter !== 'ALL') {
      filtered = filtered.filter((doc) => doc.visibility === visibilityFilter);
    }

    setFilteredDocuments(filtered);
    setPage(0);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
      DRAFT: 'default',
      NOT_STARTED: 'info',
      IN_PROGRESS: 'warning',
      SUBMITTED: 'info',
      UNDER_CLIENT_REVIEW: 'warning',
      COMMENTS_RECEIVED: 'warning',
      COMMENTS_RESOLVED: 'info',
      ACCEPTED: 'success',
      REJECTED: 'error',
    };
    return colors[status] || 'default';
  };

  const getUniqueDisciplines = () => {
    const disciplines = new Set(documents.map((doc) => doc.disciplineCode));
    return Array.from(disciplines).sort();
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDocumentCreated = () => {
    loadDocuments();
    setCreateDialogOpen(false);
  };

  const paginatedDocuments = filteredDocuments.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4" component="h1">
            Master Document List
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            disabled={!projectId}
          >
            New Document
          </Button>
        </Stack>

        {/* Project Selector */}
        <Paper sx={{ p: 2 }}>
          <ProjectSelector
            value={projectId}
            onChange={(value: string | null) => setProjectId(value || '')}
            required
            label="Select Project"
          />
        </Paper>

        {!projectId ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Please select a project to view its master document list
            </Typography>
          </Paper>
        ) : (
          <>
            {/* Filters */}
            <Paper sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <FilterListIcon />
                  <Typography variant="h6">Filters</Typography>
                </Stack>

                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <TextField
                    label="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Document number, title, description..."
                    sx={{ minWidth: 300 }}
                  />

                  <FormControl sx={{ minWidth: 150 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      label="Status"
                    >
                      <MenuItem value="ALL">All Statuses</MenuItem>
                      <MenuItem value="DRAFT">Draft</MenuItem>
                      <MenuItem value="NOT_STARTED">Not Started</MenuItem>
                      <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                      <MenuItem value="SUBMITTED">Submitted</MenuItem>
                      <MenuItem value="UNDER_CLIENT_REVIEW">Under Client Review</MenuItem>
                      <MenuItem value="COMMENTS_RECEIVED">Comments Received</MenuItem>
                      <MenuItem value="COMMENTS_RESOLVED">Comments Resolved</MenuItem>
                      <MenuItem value="ACCEPTED">Accepted</MenuItem>
                      <MenuItem value="REJECTED">Rejected</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl sx={{ minWidth: 150 }}>
                    <InputLabel>Discipline</InputLabel>
                    <Select
                      value={disciplineFilter}
                      onChange={(e) => setDisciplineFilter(e.target.value)}
                      label="Discipline"
                    >
                      <MenuItem value="ALL">All Disciplines</MenuItem>
                      {getUniqueDisciplines().map((disc) => (
                        <MenuItem key={disc} value={disc}>
                          {disc}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl sx={{ minWidth: 150 }}>
                    <InputLabel>Visibility</InputLabel>
                    <Select
                      value={visibilityFilter}
                      onChange={(e) => setVisibilityFilter(e.target.value)}
                      label="Visibility"
                    >
                      <MenuItem value="ALL">All</MenuItem>
                      <MenuItem value="CLIENT_VISIBLE">Client Visible</MenuItem>
                      <MenuItem value="INTERNAL_ONLY">Internal Only</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Stack>
            </Paper>

            {/* Documents Table */}
            <Paper>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Document Number</TableCell>
                          <TableCell>Title</TableCell>
                          <TableCell>Discipline</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Visibility</TableCell>
                          <TableCell>Assigned To</TableCell>
                          <TableCell>Due Date</TableCell>
                          <TableCell>Submissions</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedDocuments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} align="center">
                              <Typography variant="body2" color="text.secondary">
                                No documents found
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedDocuments.map((doc) => (
                            <TableRow key={doc.id} hover>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {doc.documentNumber}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{doc.documentTitle}</Typography>
                                {doc.description && (
                                  <Typography variant="caption" color="text.secondary">
                                    {doc.description}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip label={doc.disciplineCode} size="small" />
                                {doc.subCode && (
                                  <Chip
                                    label={doc.subCode}
                                    size="small"
                                    variant="outlined"
                                    sx={{ ml: 0.5 }}
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={doc.status}
                                  color={getStatusColor(doc.status)}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={doc.visibility === 'CLIENT_VISIBLE' ? 'Client' : 'Internal'}
                                  size="small"
                                  variant="outlined"
                                  color={doc.visibility === 'CLIENT_VISIBLE' ? 'primary' : 'default'}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {doc.assignedTo.length > 0 ? doc.assignedTo.join(', ') : '-'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {doc.dueDate
                                    ? new Date(doc.dueDate.seconds * 1000).toLocaleDateString()
                                    : '-'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{doc.submissionCount}</Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                  <Tooltip title="View Details">
                                    <IconButton
                                      size="small"
                                      onClick={() => router.push(`/documents/${doc.id}`)}
                                    >
                                      <VisibilityIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Submit to Client">
                                    <IconButton
                                      size="small"
                                      onClick={() => router.push(`/documents/${doc.id}?tab=submit`)}
                                    >
                                      <SendIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Manage Links">
                                    <IconButton
                                      size="small"
                                      onClick={() => router.push(`/documents/${doc.id}?tab=links`)}
                                    >
                                      <LinkIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <TablePagination
                    component="div"
                    count={filteredDocuments.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                  />
                </>
              )}
            </Paper>
          </>
        )}
      </Stack>

      {/* Create Document Dialog */}
      <CreateDocumentDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        projectId={projectId}
        onDocumentCreated={handleDocumentCreated}
      />
    </Box>
  );
}
