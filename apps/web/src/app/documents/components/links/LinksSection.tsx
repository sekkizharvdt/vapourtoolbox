'use client';

/**
 * Links Section Component
 *
 * Displays and manages a list of document links (predecessors, successors, or related)
 * - Shows linked documents in a list
 * - Action buttons (view, remove)
 * - Status indicators
 * - Empty state
 */

import {
  Paper,
  Typography,
  Button,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  Tooltip,
  Box,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  CheckCircle as CompleteIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { DocumentLink } from '@vapour/types';

interface LinksSectionProps {
  title: string;
  links: DocumentLink[];
  onAdd: () => void;
  onRemove: (link: DocumentLink) => void;
  emptyMessage: string;
}

export default function LinksSection({
  title,
  links,
  onAdd,
  onRemove,
  emptyMessage,
}: LinksSectionProps) {
  const router = useRouter();

  const getStatusIcon = (status: string) => {
    if (status === 'ACCEPTED') {
      return <CompleteIcon color="success" fontSize="small" />;
    }
    if (
      status === 'SUBMITTED' ||
      status === 'CLIENT_REVIEW' ||
      status === 'COMMENTED' ||
      status === 'INTERNAL_REVIEW'
    ) {
      return <WarningIcon color="warning" fontSize="small" />;
    }
    return null;
  };

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const colors: Record<string, 'default' | 'error' | 'warning' | 'info' | 'success'> = {
      DRAFT: 'default',
      NOT_STARTED: 'info',
      IN_PROGRESS: 'warning',
      SUBMITTED: 'info',
      CLIENT_REVIEW: 'warning',
      COMMENTED: 'warning',
      INTERNAL_REVIEW: 'info',
      ACCEPTED: 'success',
      REJECTED: 'error',
    };
    return colors[status] || 'default';
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h6">{title}</Typography>
          <Chip label={links.length} size="small" />
        </Stack>
        <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={onAdd}>
          Add
        </Button>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      {links.length === 0 ? (
        <Typography color="text.secondary" variant="body2">
          {emptyMessage}
        </Typography>
      ) : (
        <List disablePadding>
          {links.map((link, index) => (
            <ListItem
              key={`${link.masterDocumentId}-${index}`}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
                '&:last-child': { mb: 0 },
              }}
              secondaryAction={
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="View Document">
                    <IconButton
                      size="small"
                      onClick={() => router.push(`/documents/${link.masterDocumentId}`)}
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove Link">
                    <IconButton size="small" onClick={() => onRemove(link)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              }
            >
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    {getStatusIcon(link.status)}
                    <Typography variant="body2" fontWeight="medium">
                      {link.documentNumber}
                    </Typography>
                    <Chip
                      label={link.status.replace(/_/g, ' ')}
                      size="small"
                      color={getStatusColor(link.status)}
                      sx={{ fontSize: '0.7rem' }}
                    />
                  </Stack>
                }
                secondary={
                  <>
                    <Typography variant="body2" component="span">
                      {link.documentTitle}
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      {link.currentRevision && (
                        <Chip
                          label={`Rev ${link.currentRevision}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.65rem', mr: 0.5 }}
                        />
                      )}
                      {link.assignedToNames && link.assignedToNames.length > 0 && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="span"
                          sx={{ ml: 0.5 }}
                        >
                          Assigned: {link.assignedToNames.join(', ')}
                        </Typography>
                      )}
                    </Box>
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}
