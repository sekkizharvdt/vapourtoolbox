'use client';

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
import { Delete as DeleteIcon } from '@mui/icons-material';
import type { WorkItem } from '@vapour/types';

interface WorkItemsTableProps {
  items: WorkItem[];
  onDeleteItem: (item: WorkItem) => void;
}

export default function WorkItemsTable({ items, onDeleteItem }: WorkItemsTableProps) {
  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const colors: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
      PENDING: 'default',
      IN_PROGRESS: 'warning',
      COMPLETED: 'success',
      CANCELLED: 'default',
    };
    return colors[status] || 'default';
  };

  if (items.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No work items added yet.
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
              <TableCell>Activity</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Description</TableCell>
              <TableCell width="100px">Status</TableCell>
              <TableCell width="80px" align="right">
                Est. Hrs
              </TableCell>
              <TableCell width="80px" align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {item.activityName}
                  </Typography>
                  {item.assignedToName && (
                    <Typography variant="caption" color="text.secondary">
                      Assigned: {item.assignedToName}
                    </Typography>
                  )}
                </TableCell>

                <TableCell>
                  <Chip label={item.activityType} size="small" variant="outlined" />
                </TableCell>

                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                    {item.description}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Chip
                    label={item.status}
                    size="small"
                    color={getStatusColor(item.status)}
                    sx={{ fontSize: '0.7rem' }}
                  />
                </TableCell>

                <TableCell align="right">
                  <Typography variant="body2">{item.estimatedHours || '-'}</Typography>
                </TableCell>

                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => onDeleteItem(item)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
