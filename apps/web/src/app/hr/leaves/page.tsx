'use client';

import { useState, useEffect } from 'react';
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
  Breadcrumbs,
  Link,
} from '@mui/material';
import { Refresh as RefreshIcon, Home as HomeIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canApproveLeaves } from '@vapour/constants';
import {
  listLeaveRequests,
  LEAVE_STATUS_COLORS,
  LEAVE_STATUS_LABELS,
  formatLeaveDate,
} from '@/lib/hr';
import type { LeaveRequest, LeaveRequestStatus } from '@vapour/types';

// Use shared display helpers from @/lib/hr
const STATUS_COLORS = LEAVE_STATUS_COLORS;
const STATUS_LABELS = LEAVE_STATUS_LABELS;
const formatDate = formatLeaveDate;

type TabValue = 'pending' | 'approved' | 'rejected' | 'all';

export default function LeaveRequestsPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabValue>('pending');

  const permissions2 = claims?.permissions2 ?? 0;
  const hasApproveAccess = canApproveLeaves(permissions2);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const statusFilter: LeaveRequestStatus | undefined =
        tab === 'pending'
          ? 'PENDING_APPROVAL'
          : tab === 'approved'
            ? 'APPROVED'
            : tab === 'rejected'
              ? 'REJECTED'
              : undefined;

      const data = await listLeaveRequests({
        status: statusFilter,
        limit: 50,
      });

      setRequests(data);
    } catch (err) {
      console.error('Failed to load leave requests:', err);
      setError('Failed to load leave requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!hasApproveAccess) {
    return (
      <>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Leave Requests
          </Typography>
          <Alert severity="error">
            You do not have permission to view leave requests. Only approvers can access this page.
          </Alert>
        </Box>
      </>
    );
  }

  return (
    <>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/hr"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/hr');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          HR
        </Link>
        <Typography color="text.primary">Leave Requests</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Leave Requests
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Review and manage team leave requests
          </Typography>
        </Box>
        <IconButton onClick={loadData} title="Refresh">
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)}>
          <Tab label="Pending Approval" value="pending" />
          <Tab label="Approved" value="approved" />
          <Tab label="Rejected" value="rejected" />
          <Tab label="All" value="all" />
        </Tabs>
      </Box>

      {loading ? (
        <Skeleton variant="rectangular" height={400} />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Request #</TableCell>
                <TableCell>Employee</TableCell>
                <TableCell>Leave Type</TableCell>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell align="center">Days</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No leave requests found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.id} hover>
                    <TableCell>{request.requestNumber}</TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{request.userName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {request.userEmail}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{request.leaveTypeName}</TableCell>
                    <TableCell>{formatDate(request.startDate.toDate())}</TableCell>
                    <TableCell>{formatDate(request.endDate.toDate())}</TableCell>
                    <TableCell align="center">
                      {request.numberOfDays}
                      {request.isHalfDay && ' (Half)'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_LABELS[request.status]}
                        color={STATUS_COLORS[request.status]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant={request.status === 'PENDING_APPROVAL' ? 'contained' : 'outlined'}
                        onClick={() => router.push(`/hr/leaves/${request.id}`)}
                      >
                        {request.status === 'PENDING_APPROVAL' ? 'Review' : 'View'}
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
