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
  CircularProgress,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import type { MasterDocumentEntry } from '@vapour/types';
import { getMasterDocumentsByProject } from '@/lib/documents/masterDocumentService';
import CreateDocumentDialog from './components/CreateDocumentDialog';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { DocumentMetrics } from './components/DocumentMetrics';
import { QuickFilters } from './components/QuickFilters';
import { GroupedDocumentsTable } from './components/GroupedDocumentsTable';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function MasterDocumentsPage() {
  const { db } = getFirebase();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<MasterDocumentEntry[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<MasterDocumentEntry[]>([]);

  // Selected project
  const [projectId, setProjectId] = useState<string>('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('ALL');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('ALL');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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
  }, [documents, searchQuery, quickFilter, statusFilter, disciplineFilter, visibilityFilter]);

  const loadDocuments = async () => {
    if (!db) {
      console.error('[MasterDocumentsPage] Firebase db not initialized');
      setLoading(false);
      return;
    }

    if (!projectId) {
      console.log('[MasterDocumentsPage] loadDocuments called without projectId');
      return;
    }

    console.log('[MasterDocumentsPage] Starting to load documents for project:', projectId);
    setLoading(true);

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('[MasterDocumentsPage] Query timeout after 10 seconds');
      setLoading(false);
      alert('Loading documents timed out. Please check console for errors.');
    }, 10000);

    try {
      console.log('[MasterDocumentsPage] Calling getMasterDocumentsByProject...');
      const data = await getMasterDocumentsByProject(db, projectId);
      console.log('[MasterDocumentsPage] Successfully loaded documents:', data.length);
      setDocuments(data);
      clearTimeout(timeoutId);
    } catch (error) {
      console.error('[MasterDocumentsPage] Error loading documents:', error);
      console.error('[MasterDocumentsPage] Error details:', JSON.stringify(error, null, 2));
      clearTimeout(timeoutId);
      alert(`Error loading documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      console.log('[MasterDocumentsPage] Loading complete');
    }
  };

  const applyFilters = () => {
    let filtered = [...documents];

    // Quick filters
    if (quickFilter) {
      switch (quickFilter) {
        case 'my-docs':
          if (user?.uid) {
            filtered = filtered.filter((doc) => doc.assignedTo.includes(user.uid));
          }
          break;
        case 'overdue':
          filtered = filtered.filter((doc) => {
            if (!doc.dueDate || doc.status === 'ACCEPTED') return false;
            const dueDate = new Date(doc.dueDate.seconds * 1000);
            return dueDate < new Date();
          });
          break;
        case 'pending-review':
          filtered = filtered.filter(
            (doc) =>
              doc.status === 'SUBMITTED' ||
              doc.status === 'CLIENT_REVIEW' ||
              doc.status === 'COMMENTED' ||
              doc.status === 'INTERNAL_REVIEW'
          );
          break;
        case 'client-visible':
          filtered = filtered.filter((doc) => doc.visibility === 'CLIENT_VISIBLE');
          break;
      }
    }

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
  };

  const getUniqueDisciplines = () => {
    const disciplines = new Set(documents.map((doc) => doc.disciplineCode));
    return Array.from(disciplines).sort();
  };

  const handleDocumentCreated = () => {
    loadDocuments();
    setCreateDialogOpen(false);
  };

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
            {/* Document Metrics */}
            <DocumentMetrics
              documents={documents}
              onMetricClick={(filter) => {
                if (filter === 'overdue') setQuickFilter('overdue');
                else if (filter === 'review') setQuickFilter('pending-review');
                else if (filter === 'completed') setStatusFilter('ACCEPTED');
              }}
            />

            {/* Quick Filters */}
            <QuickFilters
              activeFilter={quickFilter}
              onFilterChange={setQuickFilter}
              currentUserId={user?.uid}
            />

            {/* Search and Advanced Filters */}
            <Paper sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <TextField
                    label="Search documents"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Document number, title, description..."
                    fullWidth
                    size="small"
                  />
                  <Button
                    variant="outlined"
                    startIcon={<FilterListIcon />}
                    endIcon={showAdvancedFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  >
                    Filters
                  </Button>
                </Stack>

                {/* Advanced Filters (Collapsible) */}
                <Collapse in={showAdvancedFilters}>
                  <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ pt: 1 }}>
                    <FormControl sx={{ minWidth: 150 }} size="small">
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

                    <FormControl sx={{ minWidth: 150 }} size="small">
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

                    <FormControl sx={{ minWidth: 150 }} size="small">
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

                    <Button
                      size="small"
                      onClick={() => {
                        setSearchQuery('');
                        setQuickFilter(null);
                        setStatusFilter('ALL');
                        setDisciplineFilter('ALL');
                        setVisibilityFilter('ALL');
                      }}
                    >
                      Clear All
                    </Button>
                  </Stack>
                </Collapse>
              </Stack>
            </Paper>

            {/* Documents Table */}
            {loading ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Loading documents...
                </Typography>
              </Paper>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Showing {filteredDocuments.length} of {documents.length} documents
                </Typography>
                <GroupedDocumentsTable documents={filteredDocuments} />
              </>
            )}
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
