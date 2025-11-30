'use client';

/**
 * Grouped Documents Table Component
 *
 * Displays documents grouped by discipline with collapsible sections
 * - Compact view optimized for scanning
 * - Expandable rows for details
 * - Color-coded status indicators
 */

import { useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as VisibilityIcon,
  Send as SendIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { MasterDocumentEntry } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

interface GroupedDocumentsTableProps {
  documents: MasterDocumentEntry[];
}

interface DocumentGroup {
  discipline: string;
  documents: MasterDocumentEntry[];
}

export function GroupedDocumentsTable({ documents }: GroupedDocumentsTableProps) {
  const router = useRouter();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group documents by discipline
  const groups: DocumentGroup[] = Object.entries(
    documents.reduce(
      (acc, doc) => {
        const discipline = doc.disciplineCode || 'UNCATEGORIZED';
        if (!acc[discipline]) {
          acc[discipline] = [];
        }
        acc[discipline].push(doc);
        return acc;
      },
      {} as Record<string, MasterDocumentEntry[]>
    )
  )
    .map(([discipline, docs]) => ({
      discipline,
      documents: docs,
    }))
    .sort((a, b) => a.discipline.localeCompare(b.discipline));

  const toggleGroup = (discipline: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(discipline)) {
      newExpanded.delete(discipline);
    } else {
      newExpanded.add(discipline);
    }
    setExpandedGroups(newExpanded);
  };

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const colors: Record<string, 'default' | 'error' | 'warning' | 'info' | 'success'> = {
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

  const getStatusIcon = (doc: MasterDocumentEntry): string => {
    // Check if overdue
    if (doc.dueDate && doc.status !== 'ACCEPTED') {
      const dueDate = new Date(doc.dueDate.seconds * 1000);
      if (dueDate < new Date()) {
        return '🔴'; // Red circle for overdue
      }
    }

    // Status-based icons
    switch (doc.status) {
      case 'ACCEPTED':
        return '🟢'; // Green for completed
      case 'APPROVED':
        return '🟢'; // Green for approved
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return '🟡'; // Yellow for in review
      case 'DRAFT':
        return '⚪'; // White for not started
      case 'ON_HOLD':
      case 'CANCELLED':
        return '🔴'; // Red for on hold or cancelled
      default:
        return '🔵'; // Blue for in progress
    }
  };

  if (documents.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No documents found
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="40px"></TableCell>
              <TableCell>Document Number</TableCell>
              <TableCell>Title</TableCell>
              <TableCell width="120px">Status</TableCell>
              <TableCell width="150px">Assigned To</TableCell>
              <TableCell width="100px">Due Date</TableCell>
              <TableCell width="80px" align="center">
                Subs.
              </TableCell>
              <TableCell width="120px" align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.discipline);

              return (
                <>
                  {/* Group Header */}
                  <TableRow
                    key={`group-${group.discipline}`}
                    sx={{
                      bgcolor: 'action.hover',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.selected',
                      },
                    }}
                    onClick={() => toggleGroup(group.discipline)}
                  >
                    <TableCell>
                      <IconButton size="small">
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell colSpan={7}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {group.discipline}
                        </Typography>
                        <Chip label={`${group.documents.length} documents`} size="small" />
                      </Stack>
                    </TableCell>
                  </TableRow>

                  {/* Group Documents */}
                  {group.documents.slice(0, isExpanded ? undefined : 5).map((doc) => (
                    <TableRow
                      key={doc.id}
                      hover
                      sx={{
                        display:
                          isExpanded || group.documents.indexOf(doc) < 5 ? undefined : 'none',
                      }}
                    >
                      <TableCell>
                        <Typography fontSize="16px">{getStatusIcon(doc)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {doc.documentNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                          {doc.documentTitle}
                        </Typography>
                        {doc.description && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{ maxWidth: 300, display: 'block' }}
                          >
                            {doc.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={doc.status.replace(/_/g, ' ')}
                          color={getStatusColor(doc.status)}
                          size="small"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                          {doc.assignedTo.length > 0 ? doc.assignedTo.join(', ') : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatDate(doc.dueDate)}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{doc.submissionCount}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() =>
                                router.push(`/documents/${doc.id}?projectId=${doc.projectId}`)
                              }
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Submit">
                            <IconButton
                              size="small"
                              onClick={() =>
                                router.push(
                                  `/documents/${doc.id}?projectId=${doc.projectId}&tab=submit`
                                )
                              }
                            >
                              <SendIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Links">
                            <IconButton
                              size="small"
                              onClick={() =>
                                router.push(
                                  `/documents/${doc.id}?projectId=${doc.projectId}&tab=links`
                                )
                              }
                            >
                              <LinkIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Show "Load More" for collapsed groups with more than 5 documents */}
                  {!isExpanded && group.documents.length > 5 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography
                          variant="body2"
                          color="primary"
                          sx={{ cursor: 'pointer', py: 1 }}
                          onClick={() => toggleGroup(group.discipline)}
                        >
                          Show {group.documents.length - 5} more documents...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
