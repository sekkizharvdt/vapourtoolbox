'use client';

/**
 * Comment Resolution Sheet List Component
 *
 * Displays a list of uploaded Comment Resolution Sheets for a document
 * with status indicators and download links.
 */

import {
  Box,
  Typography,
  Stack,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Link,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Description as FileIcon,
  CheckCircle as CompletedIcon,
  Pending as PendingIcon,
  PlayCircle as InProgressIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import type { CommentResolutionSheet } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

interface CRSListProps {
  crsList: CommentResolutionSheet[];
}

export default function CRSList({ crsList }: CRSListProps) {
  if (crsList.length === 0) {
    return null;
  }

  const getStatusChip = (status: CommentResolutionSheet['status']) => {
    switch (status) {
      case 'PENDING':
        return <Chip icon={<PendingIcon />} label="Pending" size="small" color="default" />;
      case 'IN_PROGRESS':
        return <Chip icon={<InProgressIcon />} label="In Progress" size="small" color="warning" />;
      case 'COMPLETED':
        return <Chip icon={<CompletedIcon />} label="Completed" size="small" color="success" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    return <FileIcon color="primary" />;
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="subtitle2" color="text.secondary">
          Uploaded Comment Resolution Sheets ({crsList.length})
        </Typography>

        <Divider />

        {crsList.map((crs) => (
          <Box
            key={crs.id}
            sx={{
              p: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              {getFileIcon()}

              <Box flex={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight="medium">
                    {crs.fileName}
                  </Typography>
                  <Chip label={crs.revision} size="small" variant="outlined" />
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(crs.fileSize)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Uploaded by {crs.uploadedByName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(crs.uploadedAt)}
                  </Typography>
                </Stack>
                {crs.commentsExtracted > 0 && (
                  <Typography
                    variant="caption"
                    color="success.main"
                    sx={{ display: 'block', mt: 0.5 }}
                  >
                    {crs.commentsExtracted} comments extracted
                  </Typography>
                )}
              </Box>

              <Stack direction="row" spacing={1} alignItems="center">
                {getStatusChip(crs.status)}

                <Tooltip title="Open File">
                  <IconButton
                    size="small"
                    component={Link}
                    href={crs.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <OpenIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Download">
                  <IconButton size="small" component="a" href={crs.fileUrl} download={crs.fileName}>
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
