'use client';

/**
 * FolderTree Component
 *
 * Displays a hierarchical folder tree for document navigation
 * Based on AccountTreeView pattern with Set<string> state for expanded folders
 */

import { useState, useMemo, useCallback, memo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  Stack,
  Button,
  Badge,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  CreateNewFolder as CreateNewFolderIcon,
  UnfoldMore as ExpandAllIcon,
  UnfoldLess as CollapseAllIcon,
  Description as FileIcon,
} from '@mui/icons-material';
import type { FolderNode } from '@vapour/types';

// ============================================================================
// TYPES
// ============================================================================

interface FolderTreeProps {
  nodes: FolderNode[];
  selectedPath: string | null;
  onSelect: (path: string, node: FolderNode) => void;
  onCreateFolder?: (parentPath: string) => void;
  loading?: boolean;
  showDocumentCounts?: boolean;
  allowFolderCreation?: boolean;
}

interface FolderTreeItemProps {
  node: FolderNode;
  depth: number;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  onSelect: (path: string, node: FolderNode) => void;
  onToggleExpand: (path: string) => void;
  onCreateFolder?: (parentPath: string) => void;
  showDocumentCounts?: boolean;
  allowFolderCreation?: boolean;
}

// ============================================================================
// FOLDER TREE ITEM COMPONENT
// ============================================================================

const FolderTreeItem = memo(function FolderTreeItem({
  node,
  depth,
  selectedPath,
  expandedPaths,
  onSelect,
  onToggleExpand,
  onCreateFolder,
  showDocumentCounts = true,
  allowFolderCreation = false,
}: FolderTreeItemProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpand(node.path);
    },
    [node.path, onToggleExpand]
  );

  const handleSelect = useCallback(() => {
    onSelect(node.path, node);
  }, [node, onSelect]);

  const handleCreateFolder = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCreateFolder?.(node.path);
    },
    [node.path, onCreateFolder]
  );

  return (
    <Box>
      <Box
        onClick={handleSelect}
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 0.75,
          px: 1,
          ml: depth * 2,
          borderRadius: 1,
          cursor: 'pointer',
          bgcolor: isSelected ? 'action.selected' : 'transparent',
          '&:hover': {
            bgcolor: isSelected ? 'action.selected' : 'action.hover',
          },
          transition: 'background-color 0.15s',
        }}
      >
        {/* Expand/Collapse button */}
        <IconButton
          size="small"
          onClick={handleToggle}
          aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
          sx={{
            p: 0.25,
            mr: 0.5,
            visibility: hasChildren ? 'visible' : 'hidden',
          }}
        >
          {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>

        {/* Folder icon */}
        {isExpanded ? (
          <FolderOpenIcon
            fontSize="small"
            sx={{ mr: 1, color: node.type === 'user' ? 'primary.main' : 'text.secondary' }}
          />
        ) : (
          <FolderIcon
            fontSize="small"
            sx={{ mr: 1, color: node.type === 'user' ? 'primary.main' : 'text.secondary' }}
          />
        )}

        {/* Folder name */}
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            fontWeight: isSelected ? 600 : 400,
            color: isSelected ? 'primary.main' : 'text.primary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.name}
        </Typography>

        {/* Document count badge */}
        {showDocumentCounts && node.totalDocumentCount > 0 && (
          <Tooltip title={`${node.totalDocumentCount} document(s)`}>
            <Badge
              badgeContent={node.totalDocumentCount}
              color="default"
              max={999}
              sx={{
                mr: 1,
                '& .MuiBadge-badge': {
                  fontSize: '0.65rem',
                  height: 16,
                  minWidth: 16,
                  bgcolor: 'grey.200',
                  color: 'text.secondary',
                },
              }}
            >
              <FileIcon fontSize="small" sx={{ color: 'text.disabled', fontSize: 14 }} />
            </Badge>
          </Tooltip>
        )}

        {/* Create subfolder button */}
        {allowFolderCreation && node.type !== 'virtual' && (
          <Tooltip title="Create subfolder">
            <IconButton
              size="small"
              onClick={handleCreateFolder}
              sx={{ p: 0.25 }}
              aria-label="Create subfolder"
            >
              <CreateNewFolderIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Children */}
      {hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onCreateFolder={onCreateFolder}
              showDocumentCounts={showDocumentCounts}
              allowFolderCreation={allowFolderCreation}
            />
          ))}
        </Collapse>
      )}
    </Box>
  );
});

// ============================================================================
// FOLDER TREE COMPONENT
// ============================================================================

export function FolderTree({
  nodes,
  selectedPath,
  onSelect,
  onCreateFolder,
  loading = false,
  showDocumentCounts = true,
  allowFolderCreation = false,
}: FolderTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Collect all paths that have children
  const pathsWithChildren = useMemo(() => {
    const withChildren = new Set<string>();

    const collectPaths = (nodeList: FolderNode[]) => {
      nodeList.forEach((node) => {
        if (node.children && node.children.length > 0) {
          withChildren.add(node.path);
          collectPaths(node.children);
        }
      });
    };

    collectPaths(nodes);
    return withChildren;
  }, [nodes]);

  const handleExpandAll = useCallback(() => {
    setExpandedPaths(new Set(pathsWithChildren));
  }, [pathsWithChildren]);

  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  // Auto-expand to selected path
  useMemo(() => {
    if (selectedPath) {
      const parts = selectedPath.split('/');
      const pathsToExpand: string[] = [];
      let currentPath = '';

      for (const part of parts.slice(0, -1)) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        pathsToExpand.push(currentPath);
      }

      if (pathsToExpand.length > 0) {
        setExpandedPaths((prev) => {
          const newSet = new Set(prev);
          pathsToExpand.forEach((p) => newSet.add(p));
          return newSet;
        });
      }
    }
  }, [selectedPath]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (nodes.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No folders found
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Toolbar */}
      <Stack direction="row" spacing={1} sx={{ mb: 1, px: 1 }}>
        <Button
          size="small"
          startIcon={<ExpandAllIcon />}
          onClick={handleExpandAll}
          sx={{ fontSize: '0.75rem' }}
        >
          Expand All
        </Button>
        <Button
          size="small"
          startIcon={<CollapseAllIcon />}
          onClick={handleCollapseAll}
          sx={{ fontSize: '0.75rem' }}
        >
          Collapse All
        </Button>
      </Stack>

      {/* Tree */}
      <Box sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
        {nodes.map((node) => (
          <FolderTreeItem
            key={node.id}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            expandedPaths={expandedPaths}
            onSelect={onSelect}
            onToggleExpand={handleToggleExpand}
            onCreateFolder={onCreateFolder}
            showDocumentCounts={showDocumentCounts}
            allowFolderCreation={allowFolderCreation}
          />
        ))}
      </Box>
    </Box>
  );
}

export default FolderTree;
