'use client';

import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  Visibility as VisibilityIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import type { FeedbackItem } from './types';
import { typeConfig, statusConfig } from './config';

interface FeedbackTableProps {
  items: FeedbackItem[];
  page: number;
  rowsPerPage: number;
  totalCount: number;
  onPageChange: (event: unknown, newPage: number) => void;
  onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onViewDetails: (item: FeedbackItem) => void;
}

export function FeedbackTable({
  items,
  page,
  rowsPerPage,
  totalCount,
  onPageChange,
  onRowsPerPageChange,
  onViewDetails,
}: FeedbackTableProps) {
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 120 }}>Type</TableCell>
            <TableCell>Title</TableCell>
            <TableCell sx={{ width: 180 }}>Submitted By</TableCell>
            <TableCell sx={{ width: 130 }}>Status</TableCell>
            <TableCell sx={{ width: 140 }}>Submitted</TableCell>
            <TableCell sx={{ width: 60 }} align="center">
              📎
            </TableCell>
            <TableCell sx={{ width: 100 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} hover>
              {/* Type */}
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      color: `${typeConfig[item.type].color}.main`,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {typeConfig[item.type].icon}
                  </Box>
                  <Typography variant="body2">
                    {typeConfig[item.type].label.split(' ')[0]}
                  </Typography>
                </Box>
              </TableCell>

              {/* Title */}
              <TableCell>
                <Typography
                  variant="body2"
                  sx={{
                    maxWidth: 300,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.title}
                </Typography>
              </TableCell>

              {/* Submitted By */}
              <TableCell>
                <Typography variant="body2" noWrap>
                  {item.userName}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {item.userEmail}
                </Typography>
              </TableCell>

              {/* Status */}
              <TableCell>
                <Chip
                  label={statusConfig[item.status].label}
                  size="small"
                  color={statusConfig[item.status].color}
                />
              </TableCell>

              {/* Submitted */}
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true })}
                </Typography>
              </TableCell>

              {/* Screenshots */}
              <TableCell align="center">
                {item.screenshotUrls?.length > 0 && (
                  <Badge badgeContent={item.screenshotUrls.length} color="primary">
                    <AttachFileIcon fontSize="small" color="action" />
                  </Badge>
                )}
              </TableCell>

              {/* Actions */}
              <TableCell align="right">
                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                  <Tooltip title="View Details">
                    <IconButton size="small" onClick={() => onViewDetails(item)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {item.pageUrl && (
                    <Tooltip title="Open Page URL">
                      <IconButton
                        size="small"
                        component="a"
                        href={item.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={totalCount}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
      />
    </TableContainer>
  );
}
