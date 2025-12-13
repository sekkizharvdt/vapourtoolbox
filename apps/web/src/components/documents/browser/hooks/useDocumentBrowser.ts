'use client';

/**
 * useDocumentBrowser Hook
 *
 * Main state management hook for the DocumentBrowser component
 * Manages folder tree, document list, selection, and search state
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  DocumentModule,
  DocumentRecord,
  FolderNode,
  DocumentBrowserViewMode,
  BreadcrumbSegment,
} from '@vapour/types';
import {
  buildFolderTree,
  generateBreadcrumbs,
  createFolder as createFolderService,
  deleteFolder as deleteFolderService,
  renameFolder as renameFolderService,
  moveDocumentToFolder,
  moveDocumentsToFolder,
} from '@/lib/documents/folderService';
import { searchDocuments } from '@/lib/documents/documentService';

// ============================================================================
// TYPES
// ============================================================================

export interface UseDocumentBrowserOptions {
  module: DocumentModule;
  projectId?: string;
  initialViewMode?: DocumentBrowserViewMode;
  initialPath?: string;
}

export interface UseDocumentBrowserReturn {
  // View state
  viewMode: DocumentBrowserViewMode;
  setViewMode: (mode: DocumentBrowserViewMode) => void;

  // Folder tree
  folderTree: FolderNode[];
  isLoadingTree: boolean;
  refreshTree: () => Promise<void>;

  // Selection
  selectedPath: string | null;
  selectFolder: (path: string) => void;
  breadcrumbs: BreadcrumbSegment[];

  // Documents
  documents: DocumentRecord[];
  isLoadingDocuments: boolean;
  refreshDocuments: () => Promise<void>;

  // Document selection
  selectedDocumentIds: Set<string>;
  toggleDocumentSelection: (id: string) => void;
  selectAllDocuments: () => void;
  clearDocumentSelection: () => void;
  isDocumentSelected: (id: string) => boolean;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredDocuments: DocumentRecord[];

  // Folder actions
  createFolder: (parentPath: string, name: string) => Promise<void>;
  renameFolder: (folderId: string, newName: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;

  // Document actions
  moveDocuments: (documentIds: string[], targetPath: string) => Promise<void>;

  // Error state
  error: string | null;
  clearError: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useDocumentBrowser(options: UseDocumentBrowserOptions): UseDocumentBrowserReturn {
  const { module, projectId, initialViewMode = 'entity', initialPath } = options;

  // View mode state
  const [viewMode, setViewMode] = useState<DocumentBrowserViewMode>(initialViewMode);

  // Folder tree state
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(true);

  // Selection state
  const [selectedPath, setSelectedPath] = useState<string | null>(initialPath || null);

  // Documents state
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

  // Document selection state
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Error state
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // LOAD FOLDER TREE
  // ============================================================================

  const loadFolderTree = useCallback(async () => {
    setIsLoadingTree(true);
    setError(null);

    try {
      const tree = await buildFolderTree({
        module,
        projectId,
        viewMode,
      });
      setFolderTree(tree);
    } catch (err) {
      console.error('[useDocumentBrowser] Error loading folder tree:', err);
      setError('Failed to load folder tree');
    } finally {
      setIsLoadingTree(false);
    }
  }, [module, projectId, viewMode]);

  // Load tree on mount and when dependencies change
  useEffect(() => {
    loadFolderTree();
  }, [loadFolderTree]);

  // ============================================================================
  // LOAD DOCUMENTS FOR SELECTED FOLDER
  // ============================================================================

  const loadDocuments = useCallback(async () => {
    if (!selectedPath) {
      setDocuments([]);
      return;
    }

    setIsLoadingDocuments(true);
    setError(null);

    try {
      // For now, load all documents in the module and filter client-side
      // In the future, we can optimize with folder-based queries
      const result = await searchDocuments({
        module,
        projectId,
        onlyLatest: true,
        orderBy: 'uploadedAt',
        orderDirection: 'desc',
      });

      // Filter by folder path if needed
      // TODO: Implement proper folder-based filtering in documentService
      setDocuments(result.documents);
    } catch (err) {
      console.error('[useDocumentBrowser] Error loading documents:', err);
      setError('Failed to load documents');
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [module, projectId, selectedPath]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // ============================================================================
  // BREADCRUMBS
  // ============================================================================

  const breadcrumbs = useMemo(() => {
    if (!selectedPath) {
      return [{ label: module, path: module.toLowerCase(), type: 'module' as const }];
    }
    return generateBreadcrumbs(selectedPath, viewMode, module);
  }, [selectedPath, viewMode, module]);

  // ============================================================================
  // FILTERED DOCUMENTS (search)
  // ============================================================================

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) {
      return documents;
    }

    const query = searchQuery.toLowerCase();
    return documents.filter(
      (doc) =>
        doc.fileName.toLowerCase().includes(query) ||
        doc.title?.toLowerCase().includes(query) ||
        doc.description?.toLowerCase().includes(query) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [documents, searchQuery]);

  // ============================================================================
  // DOCUMENT SELECTION
  // ============================================================================

  const toggleDocumentSelection = useCallback((id: string) => {
    setSelectedDocumentIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAllDocuments = useCallback(() => {
    setSelectedDocumentIds(new Set(filteredDocuments.map((d) => d.id)));
  }, [filteredDocuments]);

  const clearDocumentSelection = useCallback(() => {
    setSelectedDocumentIds(new Set());
  }, []);

  const isDocumentSelected = useCallback(
    (id: string) => selectedDocumentIds.has(id),
    [selectedDocumentIds]
  );

  // ============================================================================
  // FOLDER ACTIONS
  // ============================================================================

  const createFolder = useCallback(
    async (parentPath: string, name: string) => {
      try {
        // Get user info from auth context - for now, use placeholders
        // In real usage, this would come from useAuth()
        const userId = 'system';
        const userName = 'System';

        await createFolderService(parentPath, name, module, userId, userName, {
          projectId,
        });

        // Refresh tree
        await loadFolderTree();
      } catch (err) {
        console.error('[useDocumentBrowser] Error creating folder:', err);
        setError('Failed to create folder');
        throw err;
      }
    },
    [module, projectId, loadFolderTree]
  );

  const renameFolder = useCallback(
    async (folderId: string, newName: string) => {
      try {
        await renameFolderService(folderId, newName);
        await loadFolderTree();
      } catch (err) {
        console.error('[useDocumentBrowser] Error renaming folder:', err);
        setError('Failed to rename folder');
        throw err;
      }
    },
    [loadFolderTree]
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      try {
        // Get user ID from auth context
        const userId = 'system';
        await deleteFolderService(folderId, userId);
        await loadFolderTree();
      } catch (err) {
        console.error('[useDocumentBrowser] Error deleting folder:', err);
        setError('Failed to delete folder');
        throw err;
      }
    },
    [loadFolderTree]
  );

  // ============================================================================
  // DOCUMENT ACTIONS
  // ============================================================================

  const moveDocuments = useCallback(
    async (documentIds: string[], targetPath: string) => {
      try {
        if (documentIds.length === 1 && documentIds[0]) {
          await moveDocumentToFolder(documentIds[0], targetPath);
        } else {
          await moveDocumentsToFolder(documentIds, targetPath);
        }

        // Refresh both tree and documents
        await Promise.all([loadFolderTree(), loadDocuments()]);

        // Clear selection
        clearDocumentSelection();
      } catch (err) {
        console.error('[useDocumentBrowser] Error moving documents:', err);
        setError('Failed to move documents');
        throw err;
      }
    },
    [loadFolderTree, loadDocuments, clearDocumentSelection]
  );

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // View state
    viewMode,
    setViewMode,

    // Folder tree
    folderTree,
    isLoadingTree,
    refreshTree: loadFolderTree,

    // Selection
    selectedPath,
    selectFolder: setSelectedPath,
    breadcrumbs,

    // Documents
    documents,
    isLoadingDocuments,
    refreshDocuments: loadDocuments,

    // Document selection
    selectedDocumentIds,
    toggleDocumentSelection,
    selectAllDocuments,
    clearDocumentSelection,
    isDocumentSelected,

    // Search
    searchQuery,
    setSearchQuery,
    filteredDocuments,

    // Folder actions
    createFolder,
    renameFolder,
    deleteFolder,

    // Document actions
    moveDocuments,

    // Error state
    error,
    clearError: () => setError(null),
  };
}

export default useDocumentBrowser;
