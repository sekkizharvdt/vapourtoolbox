'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Box,
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
  TextField,
  MenuItem,
  Chip,
  Card,
  CardContent,
  Grid,
  InputAdornment,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canManageHRSettings, canApproveLeaves } from '@vapour/constants';
import { getAllLeaveBalances, getCurrentFiscalYear } from '@/lib/hr/leaves';
import type { LeaveBalance } from '@vapour/types';

interface UserSummary {
  userId: string;
  userName: string;
  userEmail: string;
  balances: {
    [leaveTypeCode: string]: {
      leaveTypeName: string;
      entitled: number;
      used: number;
      pending: number;
      available: number;
    };
  };
  totalUsed: number;
  totalAvailable: number;
}

export default function LeaveSummaryPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(getCurrentFiscalYear());
  const [searchQuery, setSearchQuery] = useState('');

  const permissions2 = claims?.permissions2 ?? 0;
  const hasAccess = canManageHRSettings(permissions2) || canApproveLeaves(permissions2);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getAllLeaveBalances(selectedYear);
      setBalances(data);
    } catch (err) {
      console.error('Failed to load leave balances:', err);
      setError('Failed to load leave balances. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  // Aggregate balances by user
  const userSummaries = useMemo(() => {
    const summaryMap = new Map<string, UserSummary>();

    balances.forEach((balance) => {
      if (!summaryMap.has(balance.userId)) {
        summaryMap.set(balance.userId, {
          userId: balance.userId,
          userName: balance.userName,
          userEmail: balance.userEmail,
          balances: {},
          totalUsed: 0,
          totalAvailable: 0,
        });
      }

      const summary = summaryMap.get(balance.userId)!;
      summary.balances[balance.leaveTypeCode] = {
        leaveTypeName: balance.leaveTypeName,
        entitled: balance.entitled,
        used: balance.used,
        pending: balance.pending,
        available: balance.available,
      };
      summary.totalUsed += balance.used;
      summary.totalAvailable += balance.available;
    });

    return Array.from(summaryMap.values()).sort((a, b) => a.userName.localeCompare(b.userName));
  }, [balances]);

  // Get unique leave types for table columns
  const leaveTypes = useMemo(() => {
    const types = new Set<string>();
    balances.forEach((b) => types.add(b.leaveTypeCode));
    return Array.from(types).sort();
  }, [balances]);

  // Filter by search query
  const filteredSummaries = useMemo(() => {
    if (!searchQuery.trim()) return userSummaries;

    const query = searchQuery.toLowerCase();
    return userSummaries.filter(
      (summary) =>
        summary.userName.toLowerCase().includes(query) ||
        summary.userEmail.toLowerCase().includes(query)
    );
  }, [userSummaries, searchQuery]);

  // Calculate totals for summary cards
  const totals = useMemo(() => {
    const result: { [key: string]: { used: number; available: number } } = {};

    leaveTypes.forEach((type) => {
      result[type] = { used: 0, available: 0 };
    });

    balances.forEach((balance) => {
      const entry = result[balance.leaveTypeCode];
      if (entry) {
        entry.used += balance.used;
        entry.available += balance.available;
      }
    });

    return result;
  }, [balances, leaveTypes]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => getCurrentFiscalYear() - 2 + i);

  if (!hasAccess) {
    return (
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Leave Summary
          </Typography>
          <Alert severity="error">You do not have permission to view leave summary.</Alert>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
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
        <Typography color="text.primary">Leave Summary</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Leave Summary
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View leave balances for all employees
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            select
            label="Year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            size="small"
            sx={{ width: 100 }}
          >
            {yearOptions.map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </TextField>
          <IconButton onClick={loadData} title="Refresh">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      {!loading && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Total Employees
                </Typography>
                <Typography variant="h3">{userSummaries.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          {leaveTypes.map((type) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={type}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    {type} Leave
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Used
                      </Typography>
                      <Typography variant="h5" color="error.main">
                        {totals[type]?.used ?? 0}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Available
                      </Typography>
                      <Typography variant="h5" color="success.main">
                        {totals[type]?.available ?? 0}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{ width: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {loading ? (
        <Skeleton variant="rectangular" height={400} />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                {leaveTypes.map((type) => (
                  <TableCell key={type} align="center" colSpan={2}>
                    {type}
                  </TableCell>
                ))}
                <TableCell align="center">Total</TableCell>
              </TableRow>
              <TableRow>
                <TableCell></TableCell>
                {leaveTypes.map((type) => (
                  <Box component="tr" key={type} sx={{ display: 'contents' }}>
                    <TableCell align="center" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      Used
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      Avail
                    </TableCell>
                  </Box>
                ))}
                <TableCell align="center" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  Used
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSummaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={leaveTypes.length * 2 + 2} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      {searchQuery
                        ? 'No employees found matching your search.'
                        : 'No leave balances found for this year.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSummaries.map((summary) => (
                  <TableRow key={summary.userId} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {summary.userName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {summary.userEmail}
                        </Typography>
                      </Box>
                    </TableCell>
                    {leaveTypes.map((type) => {
                      const balance = summary.balances[type];
                      return (
                        <Box component="tr" key={type} sx={{ display: 'contents' }}>
                          <TableCell align="center">
                            {balance ? (
                              <Chip
                                label={balance.used}
                                size="small"
                                color={balance.used > 0 ? 'error' : 'default'}
                                variant={balance.used > 0 ? 'filled' : 'outlined'}
                                sx={{ minWidth: 36 }}
                              />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell align="center">
                            {balance ? (
                              <Chip
                                label={balance.available}
                                size="small"
                                color={balance.available > 0 ? 'success' : 'default'}
                                variant={balance.available > 0 ? 'filled' : 'outlined'}
                                sx={{ minWidth: 36 }}
                              />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </Box>
                      );
                    })}
                    <TableCell align="center">
                      <Chip
                        label={summary.totalUsed}
                        size="small"
                        color={summary.totalUsed > 0 ? 'warning' : 'default'}
                        variant="filled"
                        sx={{ minWidth: 36 }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
