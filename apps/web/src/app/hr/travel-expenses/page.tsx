'use client';

import { useState } from 'react';
import {
  Typography,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  Skeleton,
  Tabs,
  Tab,
  Button,
} from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  useMyTravelExpenseReports,
  TRAVEL_EXPENSE_STATUS_COLORS,
  TRAVEL_EXPENSE_STATUS_LABELS,
  formatExpenseDate,
  formatExpenseAmount,
  formatTripDuration,
} from '@/lib/hr';
import type { TravelExpenseStatus } from '@vapour/types';

type TabValue = 'all' | 'draft' | 'submitted' | 'approved' | 'reimbursed';

const TAB_STATUS_MAP: Record<TabValue, TravelExpenseStatus | TravelExpenseStatus[] | undefined> = {
  all: undefined,
  draft: 'DRAFT',
  submitted: ['SUBMITTED', 'UNDER_REVIEW'],
  approved: 'APPROVED',
  reimbursed: 'REIMBURSED',
};

export default function TravelExpensesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabValue>('all');

  const statusFilter = TAB_STATUS_MAP[tab];

  const {
    data: reports = [],
    isLoading,
    error,
    refetch,
  } = useMyTravelExpenseReports(user?.uid, {
    status: statusFilter,
  });

  return (
    <>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Travel Expenses
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Submit and track your travel expense reports
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={() => refetch()} title="Refresh">
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/hr/travel-expenses/new')}
          >
            New Report
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load travel expense reports. Please try again.
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)}>
          <Tab label="All" value="all" />
          <Tab label="Drafts" value="draft" />
          <Tab label="Pending" value="submitted" />
          <Tab label="Approved" value="approved" />
          <Tab label="Reimbursed" value="reimbursed" />
        </Tabs>
      </Box>

      {isLoading ? (
        <Skeleton variant="rectangular" height={400} />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Report #</TableCell>
                <TableCell>Trip Purpose</TableCell>
                <TableCell>Destinations</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      No travel expense reports found.
                      {tab === 'all' && (
                        <Box sx={{ mt: 2 }}>
                          <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => router.push('/hr/travel-expenses/new')}
                          >
                            Create Your First Report
                          </Button>
                        </Box>
                      )}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {report.reportNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {report.tripPurpose}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                        {report.destinations.join(', ')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">
                          {formatExpenseDate(report.tripStartDate.toDate())}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTripDuration(
                            report.tripStartDate.toDate(),
                            report.tripEndDate.toDate()
                          )}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatExpenseAmount(report.totalAmount, report.currency)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {report.items.length} items
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={TRAVEL_EXPENSE_STATUS_LABELS[report.status]}
                        color={TRAVEL_EXPENSE_STATUS_COLORS[report.status]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant={report.status === 'DRAFT' ? 'contained' : 'outlined'}
                        onClick={() => router.push(`/hr/travel-expenses/${report.id}`)}
                      >
                        {report.status === 'DRAFT' ? 'Edit' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
