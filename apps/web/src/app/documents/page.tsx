'use client';

/**
 * Company Documents Page
 *
 * Company-wide document storage for:
 * - SOPs (Standard Operating Procedures)
 * - Company policies
 * - Templates (RFQ, Offer, PO, etc.)
 * - Standards and manuals
 */

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Box,
  Paper,
  Button,
  TextField,
  Tabs,
  Tab,
  Container,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  CloudUpload as UploadIcon,
  History as VersionIcon,
  Description as DocIcon,
  Assignment as SOPIcon,
  Policy as PolicyIcon,
  FileCopy as TemplateIcon,
  Verified as StandardIcon,
  MenuBook as ManualIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState, EmptyState } from '@vapour/ui';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import {
  getCompanyDocuments,
  deleteCompanyDocument,
  getDocumentVersionHistory,
  getDocumentCountsByCategory,
} from '@/lib/companyDocuments';
import type { CompanyDocument, CompanyDocumentCategory } from '@vapour/types';
import { COMPANY_DOCUMENT_CATEGORIES, TEMPLATE_TYPES } from '@vapour/types';

// Dynamic imports for dialogs - loaded on demand for better code splitting
const UploadDocumentDialog = dynamic(
  () =>
    import('./components/UploadDocumentDialog').then((mod) => ({
      default: mod.UploadDocumentDialog,
    })),
  { ssr: false }
);

const EditCompanyDocumentDialog = dynamic(
  () =>
    import('./components/EditCompanyDocumentDialog').then((mod) => ({
      default: mod.EditCompanyDocumentDialog,
    })),
  { ssr: false }
);

const NewVersionDialog = dynamic(
  () => import('./components/NewVersionDialog').then((mod) => ({ default: mod.NewVersionDialog })),
  { ssr: false }
);

const CATEGORY_ICONS: Record<CompanyDocumentCategory, React.ReactElement> = {
  SOP: <SOPIcon />,
  POLICY: <PolicyIcon />,
  TEMPLATE: <TemplateIcon />,
  STANDARD: <StandardIcon />,
  MANUAL: <ManualIcon />,
  OTHER: <DocIcon />,
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(timestamp: { seconds: number } | null): string {
  if (!timestamp) return '-';
  return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function CompanyDocumentsPage() {
  const { db } = getFirebase();
  const { user, claims } = useAuth();
  const isAdmin = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_USERS);

  // State
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<CompanyDocument[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<CompanyDocumentCategory, number>>({
    SOP: 0,
    POLICY: 0,
    TEMPLATE: 0,
    STANDARD: 0,
    MANUAL: 0,
    OTHER: 0,
  });

  // Filters
  const [activeCategory, setActiveCategory] = useState<CompanyDocumentCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<CompanyDocument | null>(null);
  const [versionHistory, setVersionHistory] = useState<CompanyDocument[]>([]);

  // Menu
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuDocument, setMenuDocument] = useState<CompanyDocument | null>(null);

  // Load documents
  const loadDocuments = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const docs = await getCompanyDocuments(db);
      setDocuments(docs);
      const counts = await getDocumentCountsByCategory(db);
      setCategoryCounts(counts);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Filter documents
  useEffect(() => {
    let filtered = [...documents];

    if (activeCategory !== 'ALL') {
      filtered = filtered.filter((doc) => doc.category === activeCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.title.toLowerCase().includes(query) ||
          doc.description.toLowerCase().includes(query) ||
          doc.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    setFilteredDocuments(filtered);
  }, [documents, activeCategory, searchQuery]);

  // Handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, doc: CompanyDocument) => {
    setMenuAnchor(event.currentTarget);
    setMenuDocument(doc);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuDocument(null);
  };

  const handleDownload = (doc: CompanyDocument) => {
    window.open(doc.fileUrl, '_blank');
    handleMenuClose();
  };

  const handleEdit = (doc: CompanyDocument) => {
    setSelectedDocument(doc);
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleNewVersion = (doc: CompanyDocument) => {
    setSelectedDocument(doc);
    setVersionDialogOpen(true);
    handleMenuClose();
  };

  const handleDelete = (doc: CompanyDocument) => {
    setSelectedDocument(doc);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleViewHistory = async (doc: CompanyDocument) => {
    if (!db) return;
    setSelectedDocument(doc);
    const history = await getDocumentVersionHistory(db, doc.id);
    setVersionHistory(history);
    setVersionHistoryOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (!db || !selectedDocument || !user) return;
    try {
      await deleteCompanyDocument(db, selectedDocument.id, user.uid);
      await loadDocuments();
      setDeleteDialogOpen(false);
      setSelectedDocument(null);
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const totalDocuments = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  if (loading) {
    return <LoadingState message="Loading company documents..." variant="page" />;
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <PageHeader
          title="Company Documents"
          subtitle="SOPs, policies, templates, and company-wide resources"
          action={
            isAdmin && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setUploadDialogOpen(true)}
              >
                Upload Document
              </Button>
            )
          }
        />

        {/* Category Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={activeCategory}
            onChange={(_, value) => setActiveCategory(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              value="ALL"
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>All</span>
                  <Chip label={totalDocuments} size="small" />
                </Stack>
              }
            />
            {(Object.keys(COMPANY_DOCUMENT_CATEGORIES) as CompanyDocumentCategory[]).map(
              (category) => (
                <Tab
                  key={category}
                  value={category}
                  icon={CATEGORY_ICONS[category]}
                  iconPosition="start"
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{COMPANY_DOCUMENT_CATEGORIES[category].label}</span>
                      {categoryCounts[category] > 0 && (
                        <Chip label={categoryCounts[category]} size="small" />
                      )}
                    </Stack>
                  }
                />
              )
            )}
          </Tabs>
        </Paper>

        {/* Search */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search documents by title, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            size="small"
          />
        </Paper>

        {/* Documents Table */}
        {filteredDocuments.length === 0 ? (
          <EmptyState
            message={
              searchQuery
                ? 'No documents match your search'
                : activeCategory !== 'ALL'
                  ? `No ${COMPANY_DOCUMENT_CATEGORIES[activeCategory].label.toLowerCase()} found`
                  : 'No company documents uploaded yet'
            }
            variant="paper"
            action={
              isAdmin && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setUploadDialogOpen(true)}
                >
                  Upload First Document
                </Button>
              )
            }
          />
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Document</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Uploaded</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ color: 'primary.main' }}>{CATEGORY_ICONS[doc.category]}</Box>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {doc.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {doc.fileName}
                          </Typography>
                          {doc.isTemplate && doc.templateType && (
                            <Chip
                              label={TEMPLATE_TYPES[doc.templateType].label}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={COMPANY_DOCUMENT_CATEGORIES[doc.category].label}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View version history">
                        <Chip
                          label={`v${doc.version}`}
                          size="small"
                          onClick={() => handleViewHistory(doc)}
                          sx={{ cursor: 'pointer' }}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(doc.uploadedAt as { seconds: number })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        by {doc.uploadedByName}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleDownload(doc)}>
                        <DownloadIcon />
                      </IconButton>
                      {isAdmin && (
                        <IconButton size="small" onClick={(e) => handleMenuOpen(e, doc)}>
                          <MoreIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Action Menu */}
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
          <MenuItem onClick={() => menuDocument && handleDownload(menuDocument)}>
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => menuDocument && handleEdit(menuDocument)}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit Details</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => menuDocument && handleNewVersion(menuDocument)}>
            <ListItemIcon>
              <UploadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Upload New Version</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => menuDocument && handleViewHistory(menuDocument)}>
            <ListItemIcon>
              <VersionIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Version History</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => menuDocument && handleDelete(menuDocument)}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        </Menu>

        {/* Upload Dialog */}
        <UploadDocumentDialog
          open={uploadDialogOpen}
          onClose={() => setUploadDialogOpen(false)}
          onSuccess={() => {
            setUploadDialogOpen(false);
            loadDocuments();
          }}
        />

        {/* Edit Dialog */}
        {selectedDocument && (
          <EditCompanyDocumentDialog
            open={editDialogOpen}
            document={selectedDocument}
            onClose={() => {
              setEditDialogOpen(false);
              setSelectedDocument(null);
            }}
            onSuccess={() => {
              setEditDialogOpen(false);
              setSelectedDocument(null);
              loadDocuments();
            }}
          />
        )}

        {/* New Version Dialog */}
        {selectedDocument && (
          <NewVersionDialog
            open={versionDialogOpen}
            document={selectedDocument}
            onClose={() => {
              setVersionDialogOpen(false);
              setSelectedDocument(null);
            }}
            onSuccess={() => {
              setVersionDialogOpen(false);
              setSelectedDocument(null);
              loadDocuments();
            }}
          />
        )}

        {/* Version History Dialog */}
        <Dialog
          open={versionHistoryOpen}
          onClose={() => setVersionHistoryOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Version History: {selectedDocument?.title}
            <IconButton
              onClick={() => setVersionHistoryOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Version</TableCell>
                    <TableCell>File</TableCell>
                    <TableCell>Uploaded By</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versionHistory.map((ver) => (
                    <TableRow key={ver.id}>
                      <TableCell>
                        <Chip
                          label={`v${ver.version}`}
                          size="small"
                          color={ver.isLatest ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{ver.fileName}</TableCell>
                      <TableCell>{ver.uploadedByName}</TableCell>
                      <TableCell>{formatDate(ver.uploadedAt as { seconds: number })}</TableCell>
                      <TableCell>{ver.revisionNotes || '-'}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => window.open(ver.fileUrl, '_blank')}>
                          <DownloadIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Document</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Are you sure you want to delete &quot;{selectedDocument?.title}&quot;? This action
              cannot be undone.
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
}
