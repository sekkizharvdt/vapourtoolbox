'use client';

/**
 * DocumentBrowser Component
 *
 * Main document browser with folder tree navigation and file list.
 * Supports entity-based and project-based view modes.
 */

import { memo, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Divider,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Typography,
  Alert,
  Toolbar,
  Button,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CreateNewFolder as CreateFolderIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  DriveFileMove as MoveIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type { DocumentModule, DocumentRecord } from '@vapour/types';
import { useDocumentBrowser } from './hooks/useDocumentBrowser';
import { FolderTree } from './FolderTree';
import { FileList } from './FileList';
import { BreadcrumbNav } from './BreadcrumbNav';
import { ViewModeToggle } from './ViewModeToggle';
import { CreateFolderDialog } from './CreateFolderDialog';

interface DocumentBrowserProps {
  module: DocumentModule;
  projectId?: string;
  initialPath?: string;
  showViewToggle?: boolean;
  allowFolderCreation?: boolean;
  allowUpload?: boolean;
  onViewDocument?: (document: DocumentRecord) => void;
  onDownloadDocument?: (document: DocumentRecord) => void;
  onUploadClick?: () => void;
}

function DocumentBrowserComponent({
  module,
  projectId,
  initialPath,
  showViewToggle = true,
  allowFolderCreation = true,
  allowUpload = true,
  onViewDocument,
  onDownloadDocument,
  onUploadClick,
}: DocumentBrowserProps) {
  const {
    // View state
    viewMode,
    setViewMode,
    // Folder tree
    folderTree,
    isLoadingTree,
    refreshTree,
    // Selection
    selectedPath,
    selectFolder,
    breadcrumbs,
    // Documents
    filteredDocuments,
    isLoadingDocuments,
    refreshDocuments,
    // Document selection
    selectedDocumentIds,
    toggleDocumentSelection,
    selectAllDocuments,
    clearDocumentSelection,
    isDocumentSelected,
    // Search
    searchQuery,
    setSearchQuery,
    // Folder actions
    createFolder,
    // Error state
    error,
    clearError,
  } = useDocumentBrowser({
    module,
    projectId,
    initialPath,
  });

  // Create folder dialog state
  const [createFolderOpen, setCreateFolderOpen] = useState(false);

  // Handle folder selection from tree
  const handleFolderSelect = useCallback(
    (path: string, _node: import('@vapour/types').FolderNode) => {
      selectFolder(path);
      clearDocumentSelection();
    },
    [selectFolder, clearDocumentSelection]
  );

  // Handle breadcrumb navigation
  const handleBreadcrumbNavigate = useCallback(
    (path: string) => {
      selectFolder(path);
      clearDocumentSelection();
    },
    [selectFolder, clearDocumentSelection]
  );

  // Handle search input
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [setSearchQuery]
  );

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshTree(), refreshDocuments()]);
  }, [refreshTree, refreshDocuments]);

  // Handle create folder
  const handleCreateFolder = useCallback(
    async (name: string) => {
      if (selectedPath) {
        await createFolder(selectedPath, name);
      }
    },
    [selectedPath, createFolder]
  );

  // Get existing folder names for validation
  const existingFolderNames = folderTree
    .flatMap((node) => [node, ...(node.children || [])])
    .map((node) => node.name.toLowerCase());

  const hasSelectedDocuments = selectedDocumentIds.size > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}

      {/* Top Toolbar */}
      <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar variant="dense" sx={{ gap: 2 }}>
          {/* View Mode Toggle */}
          {showViewToggle && (
            <ViewModeToggle value={viewMode} onChange={setViewMode} disabled={isLoadingTree} />
          )}

          {/* Search */}
          <TextField
            size="small"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={handleSearchChange}
            sx={{ minWidth: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClearSearch} aria-label="Clear search">
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ flex: 1 }} />

          {/* Selection Actions */}
          {hasSelectedDocuments && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {selectedDocumentIds.size} selected
              </Typography>
              <Tooltip title="Move selected">
                <IconButton size="small" aria-label="Move selected documents">
                  <MoveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete selected">
                <IconButton size="small" color="error" aria-label="Delete selected documents">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button size="small" onClick={clearDocumentSelection}>
                Clear
              </Button>
            </Box>
          )}

          {/* Actions */}
          {allowFolderCreation && selectedPath && (
            <Tooltip title="Create folder">
              <IconButton
                size="small"
                onClick={() => setCreateFolderOpen(true)}
                aria-label="Create folder"
              >
                <CreateFolderIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {allowUpload && (
            <Tooltip title="Upload documents">
              <IconButton size="small" onClick={onUploadClick} aria-label="Upload documents">
                <UploadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Refresh">
            <IconButton size="small" onClick={handleRefresh} aria-label="Refresh document list">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </Paper>

      {/* Breadcrumb Navigation */}
      <BreadcrumbNav breadcrumbs={breadcrumbs} onNavigate={handleBreadcrumbNavigate} />

      {/* Main Content Area */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Folder Tree Sidebar */}
        <Paper
          elevation={0}
          sx={{
            width: 280,
            minWidth: 280,
            borderRight: 1,
            borderColor: 'divider',
            overflow: 'auto',
          }}
        >
          <FolderTree
            nodes={folderTree}
            loading={isLoadingTree}
            selectedPath={selectedPath}
            onSelect={handleFolderSelect}
            allowFolderCreation={allowFolderCreation}
            onCreateFolder={(parentPath) => {
              selectFolder(parentPath);
              setCreateFolderOpen(true);
            }}
          />
        </Paper>

        {/* Divider */}
        <Divider orientation="vertical" flexItem />

        {/* File List Area */}
        <Box sx={{ flex: 1, overflow: 'auto', bgcolor: 'background.default' }}>
          <FileList
            documents={filteredDocuments}
            loading={isLoadingDocuments}
            selectedIds={selectedDocumentIds}
            onToggleSelect={toggleDocumentSelection}
            onSelectAll={selectAllDocuments}
            onClearSelection={clearDocumentSelection}
            isSelected={isDocumentSelected}
            onViewDocument={onViewDocument}
            onDownloadDocument={onDownloadDocument}
          />
        </Box>
      </Box>

      {/* Create Folder Dialog */}
      <CreateFolderDialog
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        onConfirm={handleCreateFolder}
        parentPath={selectedPath || ''}
        existingNames={existingFolderNames}
      />
    </Box>
  );
}

export const DocumentBrowser = memo(DocumentBrowserComponent);
