'use client';

/**
 * Leave Balances Tab Component
 *
 * Admin view for managing employee leave balances:
 * - View all users' leave balances by year
 * - Initialize balances for all employees
 * - Manual balance adjustments
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Box,
  Button,
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
  Chip,
  TextField,
  MenuItem,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import { Refresh as RefreshIcon, PlaylistAdd as InitializeIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { getAllLeaveBalances, getCurrentFiscalYear } from '@/lib/hr/leaves/leaveBalanceService';
import type { LeaveBalance } from '@vapour/types';

interface UserInfo {
  id: string;
  displayName: string;
  email: string;
}

interface GroupedBalance {
  userId: string;
  userName: string;
  userEmail: string;
  balances: LeaveBalance[];
}

export default function LeaveBalancesTab() {
  const { user } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(getCurrentFiscalYear());
  const [initializing, setInitializing] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const currentYear = getCurrentFiscalYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [balanceData, usersData] = await Promise.all([
        getAllLeaveBalances(selectedYear),
        loadActiveUsers(),
      ]);

      setBalances(balanceData);
      setUsers(usersData);
    } catch (err) {
      console.error('Failed to load leave balances:', err);
      setError('Failed to load leave balances. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  const loadActiveUsers = async (): Promise<UserInfo[]> => {
    const { db } = getFirebase();

    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('isActive', '==', true),
      where('status', '==', 'active'),
      where('userType', '==', 'internal')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        displayName: data.displayName || data.email || 'Unknown',
        email: data.email || '',
      };
    });
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInitializeBalances = async () => {
    if (!user) return;

    setConfirmDialogOpen(false);
    setInitializing(true);
    setError(null);
    setSuccess(null);

    try {
      const functions = getFunctions(undefined, 'asia-south1');
      const manualReset = httpsCallable<
        { year: number },
        { success: boolean; message: string; created: number; skipped: number }
      >(functions, 'manualResetLeaveBalances');

      const result = await manualReset({ year: selectedYear });

      if (result.data.success) {
        setSuccess(
          `${result.data.message}. Created: ${result.data.created}, Skipped: ${result.data.skipped}`
        );
        await loadData();
      } else {
        setError('Failed to initialize leave balances');
      }
    } catch (err) {
      console.error('Failed to initialize leave balances:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to initialize leave balances. Please try again.'
      );
    } finally {
      setInitializing(false);
    }
  };

  // Group balances by user
  const groupedBalances: GroupedBalance[] = users.map((userInfo) => {
    const userBalances = balances.filter((b) => b.userId === userInfo.id);
    return {
      userId: userInfo.id,
      userName: userInfo.displayName,
      userEmail: userInfo.email,
      balances: userBalances,
    };
  });

  // Count users without balances
  const usersWithoutBalances = groupedBalances.filter((g) => g.balances.length === 0);

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">Employee Leave Balances</Typography>
          <TextField
            select
            label="Year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            size="small"
            sx={{ minWidth: 100 }}
          >
            {years.map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <IconButton onClick={loadData} title="Refresh" disabled={loading}>
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={
              initializing ? <CircularProgress size={20} color="inherit" /> : <InitializeIcon />
            }
            onClick={() => setConfirmDialogOpen(true)}
            disabled={initializing}
          >
            {initializing ? 'Initializing...' : `Initialize Balances for ${selectedYear}`}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {usersWithoutBalances.length > 0 && !loading && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {usersWithoutBalances.length} active user(s) do not have leave balances for {selectedYear}
          . Click &quot;Initialize Balances&quot; to create them.
        </Alert>
      )}

      {loading ? (
        <Skeleton variant="rectangular" height={400} />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="center">Leave Type</TableCell>
                <TableCell align="center">Entitled</TableCell>
                <TableCell align="center">Used</TableCell>
                <TableCell align="center">Pending</TableCell>
                <TableCell align="center">Available</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupedBalances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Box sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary" gutterBottom>
                        No active internal users found.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                groupedBalances.map((group) => {
                  if (group.balances.length === 0) {
                    // User without balances
                    return (
                      <TableRow key={group.userId} hover>
                        <TableCell>{group.userName}</TableCell>
                        <TableCell>{group.userEmail}</TableCell>
                        <TableCell align="center" colSpan={5}>
                          <Typography variant="body2" color="text.secondary">
                            No balances initialized
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip label="Not Initialized" size="small" color="warning" />
                        </TableCell>
                      </TableRow>
                    );
                  }

                  // User with balances - show first balance in main row, rest as sub-rows
                  return group.balances.map((balance, idx) => (
                    <TableRow key={balance.id} hover>
                      {idx === 0 ? (
                        <>
                          <TableCell rowSpan={group.balances.length}>{group.userName}</TableCell>
                          <TableCell rowSpan={group.balances.length}>{group.userEmail}</TableCell>
                        </>
                      ) : null}
                      <TableCell align="center">
                        <Chip label={balance.leaveTypeCode} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="center">{balance.entitled}</TableCell>
                      <TableCell align="center">{balance.used}</TableCell>
                      <TableCell align="center">
                        {balance.pending > 0 ? (
                          <Chip label={balance.pending} size="small" color="warning" />
                        ) : (
                          balance.pending
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          color={balance.available <= 0 ? 'error' : 'inherit'}
                          fontWeight={balance.available <= 2 ? 'bold' : 'normal'}
                        >
                          {balance.available}
                        </Typography>
                      </TableCell>
                      {idx === 0 ? (
                        <TableCell rowSpan={group.balances.length} align="center">
                          <Chip label="Active" size="small" color="success" />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ));
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Summary */}
      {!loading && (
        <Box sx={{ mt: 2, display: 'flex', gap: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Total Users: {users.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            With Balances: {groupedBalances.filter((g) => g.balances.length > 0).length}
          </Typography>
          <Typography variant="body2" color="warning.main">
            Without Balances: {usersWithoutBalances.length}
          </Typography>
        </Box>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Initialize Leave Balances</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will create leave balance records for all active internal users who don&apos;t
            already have balances for {selectedYear}.
            <br />
            <br />
            Users who already have balances will be skipped.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleInitializeBalances} variant="contained" autoFocus>
            Initialize
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
