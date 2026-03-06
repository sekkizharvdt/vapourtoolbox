'use client';

/**
 * Templates Tab
 *
 * Template library for the project. Shows company-wide and project-specific templates.
 * Supports search, filter, download tracking, and upload.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Box,
  Stack,
  Typography,
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
  Paper,
  Chip,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Description as DocIcon,
  TableChart as SpreadsheetIcon,
  Architecture as DrawingIcon,
  Article as FormIcon,
} from '@mui/icons-material';
import { FilterBar, LoadingState, EmptyState, TableActionCell } from '@vapour/ui';
import type { Project, DocumentTemplate, TemplateCategory } from '@vapour/types';
import { canManageDocuments } from '@vapour/constants';
import { useAuth } from '@/contexts/AuthContext';
import {
  getTemplatesForProject,
  trackTemplateDownload,
} from '@/lib/documents/documentTemplateService';
import { formatDate } from '@/lib/utils/formatters';
import Button from '@mui/material/Button';

const UploadTemplateDialog = dynamic(() => import('./UploadTemplateDialog'), { ssr: false });

const CATEGORY_COLORS: Record<
  TemplateCategory,
  'default' | 'info' | 'warning' | 'success' | 'error' | 'primary' | 'secondary'
> = {
  DRAWING: 'info',
  DOCUMENT: 'default',
  SPREADSHEET: 'success',
  CALCULATION: 'warning',
  REPORT: 'primary',
  FORM: 'secondary',
  PROCEDURE: 'info',
  OTHER: 'default',
};

const CATEGORY_ICONS: Record<TemplateCategory, React.ReactNode> = {
  DRAWING: <DrawingIcon fontSize="small" />,
  DOCUMENT: <DocIcon fontSize="small" />,
  SPREADSHEET: <SpreadsheetIcon fontSize="small" />,
  CALCULATION: <SpreadsheetIcon fontSize="small" />,
  REPORT: <DocIcon fontSize="small" />,
  FORM: <FormIcon fontSize="small" />,
  PROCEDURE: <DocIcon fontSize="small" />,
  OTHER: <DocIcon fontSize="small" />,
};

const CATEGORY_OPTIONS: { value: TemplateCategory | ''; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'DRAWING', label: 'Drawing' },
  { value: 'DOCUMENT', label: 'Document' },
  { value: 'SPREADSHEET', label: 'Spreadsheet' },
  { value: 'CALCULATION', label: 'Calculation' },
  { value: 'REPORT', label: 'Report' },
  { value: 'FORM', label: 'Form' },
  { value: 'PROCEDURE', label: 'Procedure' },
  { value: 'OTHER', label: 'Other' },
];

interface TemplatesTabProps {
  project: Project;
}

export default function TemplatesTab({ project }: TemplatesTabProps) {
  const { user, claims } = useAuth();
  const hasManageAccess = claims?.permissions ? canManageDocuments(claims.permissions) : false;

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | ''>('');

  // Upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTemplatesForProject(project.client.entityId, project.id);
      setTemplates(data);
    } catch (err) {
      console.error('[TemplatesTab] Error loading templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [project.id, project.client.entityId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const filteredTemplates = useMemo(() => {
    let result = templates;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.templateName.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.templateCode?.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    if (categoryFilter) {
      result = result.filter((t) => t.category === categoryFilter);
    }

    return result;
  }, [templates, searchQuery, categoryFilter]);

  // Stats
  const stats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    templates.forEach((t) => {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    });
    return { total: templates.length, byCategory };
  }, [templates]);

  const handleDownload = async (template: DocumentTemplate) => {
    if (!user) return;

    try {
      // Track the download
      await trackTemplateDownload(template.id, user.uid);

      // Open in new tab
      window.open(template.fileUrl, '_blank');

      // Update local state
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, downloadCount: t.downloadCount + 1 } : t))
      );
    } catch (err) {
      console.error('[TemplatesTab] Download tracking error:', err);
      // Still open the file even if tracking fails
      window.open(template.fileUrl, '_blank');
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return <LoadingState message="Loading templates..." variant="page" />;
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h6">
            Document Templates
            <Chip label={stats.total} size="small" sx={{ ml: 1 }} />
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Company-wide and project-specific templates
          </Typography>
        </Box>
        {hasManageAccess && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setUploadDialogOpen(true)}
          >
            Upload Template
          </Button>
        )}
      </Stack>

      {/* Stat Chips */}
      {Object.keys(stats.byCategory).length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          {Object.entries(stats.byCategory).map(([cat, count]) => (
            <Chip
              key={cat}
              label={`${cat}: ${count}`}
              size="small"
              color={CATEGORY_COLORS[cat as TemplateCategory] || 'default'}
              variant="outlined"
              onClick={() =>
                setCategoryFilter((prev) => (prev === cat ? '' : (cat as TemplateCategory)))
              }
            />
          ))}
        </Stack>
      )}

      {/* Filter Bar */}
      <FilterBar onClear={searchQuery || categoryFilter ? handleClearFilters : undefined}>
        <TextField
          size="small"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ minWidth: 250 }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={categoryFilter}
            label="Category"
            onChange={(e) => setCategoryFilter(e.target.value as TemplateCategory | '')}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </FilterBar>

      {/* Table */}
      {filteredTemplates.length === 0 ? (
        <EmptyState
          message={
            templates.length === 0
              ? 'No templates available yet. Upload a template to get started.'
              : 'No templates match your filters.'
          }
          variant="paper"
          action={
            templates.length === 0 && hasManageAccess ? (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setUploadDialogOpen(true)}
              >
                Upload First Template
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Template</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Scope</TableCell>
                  <TableCell>File</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell align="center">Downloads</TableCell>
                  <TableCell>Updated</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {CATEGORY_ICONS[template.category]}
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {template.templateName}
                          </Typography>
                          {template.templateCode && (
                            <Typography variant="caption" color="text.secondary">
                              {template.templateCode}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={template.category}
                        size="small"
                        color={CATEGORY_COLORS[template.category] || 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={template.applicability.replace(/_/g, ' ')}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={template.fileName}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                          .{template.fileExtension} ({formatFileSize(template.fileSize)})
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip label={`v${template.version}`} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">{template.downloadCount}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(template.updatedAt)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <TableActionCell
                        actions={[
                          {
                            icon: <DownloadIcon fontSize="small" />,
                            label: 'Download',
                            onClick: () => handleDownload(template),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Upload Dialog */}
      <UploadTemplateDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        projectId={project.id}
        projectName={project.name}
        onUploadComplete={() => {
          setUploadDialogOpen(false);
          loadTemplates();
        }}
      />
    </Box>
  );
}
