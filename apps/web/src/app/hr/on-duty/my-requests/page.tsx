'use client';

import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Button,
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
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
  CheckCircle as ApprovedIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getMyOnDutyRequests, getCompOffBalance } from '@/lib/hr/onDuty';
import { getCurrentFiscalYear } from '@/lib/hr';
import type { OnDutyRequest } from '@vapour/types';
import { format } from 'date-fns';

// Status display helpers
const STATUS_COLORS: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  PARTIALLY_APPROVED: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending',
  PARTIALLY_APPROVED: 'Partially Approved',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export default function MyOnDutyRequestsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [requests, setRequests] = useState<OnDutyRequest[]>([]);
  const [compOffBalance, setCompOffBalance] = useState<{
    entitled: number;
    used: number;
    pending: number;
    available: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fiscalYear = getCurrentFiscalYear();

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const [requestsData, balanceData] = await Promise.all([
        getMyOnDutyRequests(user.uid),
        getCompOffBalance(user.uid, fiscalYear),
      ]);

      setRequests(requestsData);
      setCompOffBalance(balanceData);
    } catch (err) {
      console.error('Failed to load on-duty data:', err);
      setError('Failed to load on-duty requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <Box sx={{ p: 3 }}>
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
        <Typography color="text.primary">My On-Duty Requests</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            My On-Duty Requests
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
            onClick={() => router.push('/hr/on-duty/new')}
          >
            New On-Duty Request
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {compOffBalance && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Compensatory Leave Balance
            </Typography>
            <Box sx={{ display: 'flex', gap: 4, mt: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Entitled
                </Typography>
                <Typography variant="h5">{compOffBalance.entitled}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Used
                </Typography>
                <Typography variant="h5">{compOffBalance.used}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Pending
                </Typography>
                <Typography variant="h5">{compOffBalance.pending}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Available
                </Typography>
                <Typography variant="h5" color="primary">
                  {compOffBalance.available}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Requests
          </Typography>

          {loading ? (
            <Typography>Loading...</Typography>
          ) : requests.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">No on-duty requests yet</Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => router.push('/hr/on-duty/new')}
                sx={{ mt: 2 }}
              >
                Create Your First Request
              </Button>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Request Number</TableCell>
                    <TableCell>Holiday Date</TableCell>
                    <TableCell>Holiday Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Comp-Off Granted</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.requestNumber}</TableCell>
                      <TableCell>{format(request.holidayDate.toDate(), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{request.holidayName}</TableCell>
                      <TableCell>
                        <Chip
                          label={STATUS_LABELS[request.status] || request.status}
                          color={STATUS_COLORS[request.status] || 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {request.compOffGranted ? (
                          <ApprovedIcon color="success" fontSize="small" />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/hr/on-duty/${request.id}`)}
                          title="View Details"
                        >
                          <ViewIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
