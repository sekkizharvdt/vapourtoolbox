'use client';

import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box,
  Tooltip,
} from '@mui/material';
import { People as PeopleIcon, Person as PersonIcon } from '@mui/icons-material';
import type { HolidayWorkingOverride } from '@vapour/types';
import { format } from 'date-fns';

interface HolidayWorkingHistoryProps {
  overrides: HolidayWorkingOverride[];
  loading?: boolean;
}

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  PROCESSING: 'warning',
  COMPLETED: 'success',
  FAILED: 'error',
};

const STATUS_LABELS: Record<string, string> = {
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

export default function HolidayWorkingHistory({
  overrides,
  loading = false,
}: HolidayWorkingHistoryProps) {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Holiday Working History
          </Typography>
          <Typography>Loading...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Holiday Working History
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Past conversions of holidays to working days
        </Typography>

        {overrides.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No holiday conversions yet. Convert a holiday to a working day to see history here.
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Holiday</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Scope</TableCell>
                  <TableCell align="center">Comp-Off Granted</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overrides.map((override) => (
                  <TableRow key={override.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {override.holidayName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(override.holidayDate.toDate(), 'dd MMM yyyy')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip
                        title={
                          override.scope === 'ALL_USERS'
                            ? 'Applied to all users'
                            : `Applied to ${override.affectedUserIds.length} specific user(s)`
                        }
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {override.scope === 'ALL_USERS' ? (
                            <>
                              <PeopleIcon fontSize="small" color="action" />
                              <Typography variant="body2">All Users</Typography>
                            </>
                          ) : (
                            <>
                              <PersonIcon fontSize="small" color="action" />
                              <Typography variant="body2">
                                {override.affectedUserIds.length} User(s)
                              </Typography>
                            </>
                          )}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={override.compOffGrantedCount}
                        size="small"
                        color={override.compOffGrantedCount > 0 ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_LABELS[override.status] || override.status}
                        size="small"
                        color={STATUS_COLORS[override.status] || 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {override.createdByName || 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {format(override.createdAt.toDate(), 'dd MMM yyyy')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
