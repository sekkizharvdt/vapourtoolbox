'use client';

/**
 * Three-Way Match List Page
 *
 * List and manage three-way matches between POs, GRs, and Vendor Bills
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CompareArrows as CompareArrowsIcon,
} from '@mui/icons-material';
import type { ThreeWayMatch, ThreeWayMatchStatus } from '@vapour/types';
import { listThreeWayMatches } from '@/lib/procurement/threeWayMatch';
import { getFirebase } from '@/lib/firebase';
import {
  filterMatches,
  filterMatchesByStatus,
  calculateMatchStats,
  getMatchStatusText,
  getMatchStatusColor,
  formatCurrency,
  formatPercentage,
} from '@/lib/procurement/threeWayMatchHelpers';
import { formatDate } from '@/lib/utils/formatters';

export default function ThreeWayMatchListPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<ThreeWayMatch[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ThreeWayMatchStatus | 'ALL'>('ALL');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setLoading(true);
    setError('');
    try {
      const { db } = getFirebase();
      const data = await listThreeWayMatches(db, {});
      setMatches(data);
    } catch (err) {
      console.error('[ThreeWayMatchListPage] Error loading matches:', err);
      setError('Failed to load three-way matches');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const filteredMatches = useMemo(() => {
    let result = matches;
    result = filterMatchesByStatus(result, statusFilter);
    result = filterMatches(result, searchTerm);
    return result;
  }, [matches, searchTerm, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => calculateMatchStats(matches), [matches]);

  // Paginate
  const paginatedMatches = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredMatches.slice(start, start + rowsPerPage);
  }, [filteredMatches, page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Three-Way Match
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Match Purchase Orders, Goods Receipts, and Vendor Bills
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/procurement/three-way-match/new')}
          >
            New Match
          </Button>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Card sx={{ minWidth: 150 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <CompareArrowsIcon color="primary" />
                <Box>
                  <Typography variant="h5">{stats.total}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Matches
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 150 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <CheckCircleIcon color="success" />
                <Box>
                  <Typography variant="h5">{stats.matched}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Fully Matched
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 150 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <WarningIcon color="warning" />
                <Box>
                  <Typography variant="h5">{stats.pendingReview}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending Review
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 150 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <ErrorIcon color="error" />
                <Box>
                  <Typography variant="h5">{stats.notMatched}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Not Matched
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              placeholder="Search by match #, PO, GR, vendor..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value as ThreeWayMatchStatus | 'ALL');
                  setPage(0);
                }}
              >
                <MenuItem value="ALL">All Statuses</MenuItem>
                <MenuItem value="MATCHED">Matched</MenuItem>
                <MenuItem value="PARTIALLY_MATCHED">Partially Matched</MenuItem>
                <MenuItem value="NOT_MATCHED">Not Matched</MenuItem>
                <MenuItem value="PENDING_REVIEW">Pending Review</MenuItem>
                <MenuItem value="APPROVED_WITH_VARIANCE">Approved with Variance</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {/* Match Table */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Match #</TableCell>
                  <TableCell>PO #</TableCell>
                  <TableCell>GR #</TableCell>
                  <TableCell>Bill #</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell align="right">Match %</TableCell>
                  <TableCell align="right">Variance</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedMatches.map((match) => (
                  <TableRow
                    key={match.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/procurement/three-way-match/${match.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {match.matchNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{match.poNumber}</TableCell>
                    <TableCell>{match.grNumber}</TableCell>
                    <TableCell>{match.vendorBillNumber}</TableCell>
                    <TableCell>{match.vendorName}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={formatPercentage(match.overallMatchPercentage)}
                        color={
                          match.overallMatchPercentage >= 95
                            ? 'success'
                            : match.overallMatchPercentage >= 80
                              ? 'warning'
                              : 'error'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={Math.abs(match.variance) < 0.01 ? 'success.main' : 'error.main'}
                      >
                        {formatCurrency(match.variance)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getMatchStatusText(match.status)}
                        color={getMatchStatusColor(match.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(match.matchedAt)}</TableCell>
                  </TableRow>
                ))}
                {paginatedMatches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography color="text.secondary" sx={{ py: 4 }}>
                        {searchTerm || statusFilter !== 'ALL'
                          ? 'No matches found with current filters'
                          : 'No three-way matches found'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredMatches.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </Paper>
      </Stack>
    </Box>
  );
}
