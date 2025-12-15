'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  LinearProgress,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserLeaveBalances,
  getMyLeaveRequests,
  getCurrentFiscalYear,
  LEAVE_STATUS_COLORS,
  LEAVE_STATUS_LABELS,
  formatLeaveDate,
} from '@/lib/hr';
import type { LeaveBalance, LeaveRequest } from '@vapour/types';

// Use shared display helpers from @/lib/hr
const STATUS_COLORS = LEAVE_STATUS_COLORS;
const STATUS_LABELS = LEAVE_STATUS_LABELS;
const formatDate = formatLeaveDate;

export default function MyLeavesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fiscalYear = getCurrentFiscalYear();

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const [balancesData, requestsData] = await Promise.all([
        getUserLeaveBalances(user.uid, fiscalYear),
        getMyLeaveRequests(user.uid, { fiscalYear, limit: 10 }),
      ]);

      setBalances(balancesData);
      setRequests(requestsData);
    } catch (err) {
      console.error('Failed to load leave data:', err);
      setError('Failed to load leave data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            My Leaves
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {[1, 2].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Skeleton variant="rectangular" height={150} />
            </Grid>
          ))}
        </Grid>
        <Box sx={{ mt: 4 }}>
          <Skeleton variant="rectangular" height={300} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            My Leaves
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Fiscal Year {fiscalYear}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <IconButton onClick={loadData} title="Refresh">
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/hr/leaves/new')}
          >
            Apply for Leave
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Leave Balances */}
      <Typography variant="h6" gutterBottom>
        Leave Balance
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {balances.length === 0 ? (
          <Grid size={{ xs: 12 }}>
            <Alert severity="info">
              No leave balances found. Please contact HR to initialize your leave balances.
            </Alert>
          </Grid>
        ) : (
          balances.map((balance) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={balance.id}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    {balance.leaveTypeName}
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Available
                      </Typography>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        {balance.available} days
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(balance.available / balance.entitled) * 100}
                      color="success"
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Entitled: {balance.entitled}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Used: {balance.used}
                    </Typography>
                    {balance.pending > 0 && (
                      <Typography variant="body2" color="warning.main">
                        Pending: {balance.pending}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Recent Leave Requests */}
      <Typography variant="h6" gutterBottom>
        Recent Leave Requests
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Request #</TableCell>
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
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No leave requests found. Click &quot;Apply for Leave&quot; to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              requests.map((request) => (
                <TableRow key={request.id} hover>
                  <TableCell>{request.requestNumber}</TableCell>
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
                    <IconButton
                      size="small"
                      onClick={() => router.push(`/hr/leaves/${request.id}`)}
                      title="View Details"
                    >
                      <ViewIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
