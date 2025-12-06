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
import dynamic from 'next/dynamic';
import {
  Box,
  Paper,
  Button,
  TextField,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Send as SendIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState, EmptyState } from '@vapour/ui';
import type { MasterDocumentEntry } from '@vapour/types';
import { getMasterDocumentsByProject } from '@/lib/documents/masterDocumentService';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { DocumentMetrics } from './components/DocumentMetrics';
import { QuickFilters } from './components/QuickFilters';
import { GroupedDocumentsTable } from './components/GroupedDocumentsTable';
import TransmittalsList from './components/transmittals/TransmittalsList';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

// Lazy load heavy dialog components
const CreateDocumentDialog = dynamic(() => import('./components/CreateDocumentDialog'), {
  ssr: false,
});
const GenerateTransmittalDialog = dynamic(
  () => import('./components/transmittals/GenerateTransmittalDialog'),
  { ssr: false }
);
const DocumentRegisterUploadDialog = dynamic(
  () => import('./components/DocumentRegisterUploadDialog'),
  { ssr: false }
);

export default function MasterDocumentsPage() {
  const { db } = getFirebase();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<MasterDocumentEntry[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<MasterDocumentEntry[]>([]);

  // Selected project
  const [projectId, setProjectId] = useState<string>('');
  const [projectCode, setProjectCode] = useState<string>('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('ALL');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('ALL');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [transmittalDialogOpen, setTransmittalDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

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
      console.warn('[MasterDocumentsPage] loadDocuments called without projectId');
      return;
    }

    console.warn('[MasterDocumentsPage] Starting to load documents for project:', projectId);
    setLoading(true);

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('[MasterDocumentsPage] Query timeout after 10 seconds');
      setLoading(false);
      alert('Loading documents timed out. Please check console for errors.');
    }, 10000);

    try {
      console.warn('[MasterDocumentsPage] Calling getMasterDocumentsByProject...');
      const data = await getMasterDocumentsByProject(db, projectId);
      console.warn('[MasterDocumentsPage] Successfully loaded documents:', data.length);
      setDocuments(data);
      clearTimeout(timeoutId);
    } catch (error) {
      console.error('[MasterDocumentsPage] Error loading documents:', error);
      console.error('[MasterDocumentsPage] Error details:', JSON.stringify(error, null, 2));
      clearTimeout(timeoutId);
      alert(`Error loading documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      console.warn('[MasterDocumentsPage] Loading complete');
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
            (doc) => doc.status === 'SUBMITTED' || doc.status === 'UNDER_REVIEW'
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
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <PageHeader
          title="Master Document List"
          action={
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => setImportDialogOpen(true)}
                disabled={!projectId}
              >
                Import Register
              </Button>
              <Button
                variant="outlined"
                startIcon={<SendIcon />}
                onClick={() => setTransmittalDialogOpen(true)}
                disabled={!projectId || filteredDocuments.length === 0}
              >
                Create Transmittal
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
                disabled={!projectId}
              >
                New Document
              </Button>
            </Stack>
          }
        />

        {/* Project Selector */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <ProjectSelector
            value={projectId}
            onChange={(value: string | null, projectName?: string) => {
              setProjectId(value || '');
              // Extract project code from project name (format: "CODE - Name")
              if (projectName) {
                const code = projectName.split(' - ')[0] || value || '';
                setProjectCode(code);
              } else {
                setProjectCode('');
              }
            }}
            required
            label="Select Project"
          />
        </Paper>

        {/* Tabs */}
        {projectId && (
          <Paper sx={{ mb: 3 }}>
            <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
              <Tab label="Documents" />
              <Tab label="Transmittals" />
            </Tabs>
          </Paper>
        )}

        {!projectId ? (
          <EmptyState
            message="Please select a project to view its master document list"
            variant="paper"
          />
        ) : activeTab === 1 ? (
          <TransmittalsList projectId={projectId} />
        ) : (
          <Stack spacing={3}>
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
                        <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                        <MenuItem value="SUBMITTED">Submitted</MenuItem>
                        <MenuItem value="UNDER_REVIEW">Under Review</MenuItem>
                        <MenuItem value="APPROVED">Approved</MenuItem>
                        <MenuItem value="ACCEPTED">Accepted</MenuItem>
                        <MenuItem value="ON_HOLD">On Hold</MenuItem>
                        <MenuItem value="CANCELLED">Cancelled</MenuItem>
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
              <LoadingState message="Loading documents..." variant="page" />
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Showing {filteredDocuments.length} of {documents.length} documents
                </Typography>
                <GroupedDocumentsTable documents={filteredDocuments} />
              </>
            )}
          </Stack>
        )}
        {/* Create Document Dialog */}
        <CreateDocumentDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          projectId={projectId}
          onDocumentCreated={handleDocumentCreated}
        />

        {/* Generate Transmittal Dialog */}
        {projectId && (
          <GenerateTransmittalDialog
            open={transmittalDialogOpen}
            onClose={() => setTransmittalDialogOpen(false)}
            projectId={projectId}
            projectName={projectId}
            documents={filteredDocuments}
          />
        )}

        {/* Import Document Register Dialog */}
        {projectId && (
          <DocumentRegisterUploadDialog
            open={importDialogOpen}
            onClose={() => setImportDialogOpen(false)}
            projectId={projectId}
            projectCode={projectCode || projectId}
            onDocumentsImported={loadDocuments}
          />
        )}
      </Box>
    </Container>
  );
}
