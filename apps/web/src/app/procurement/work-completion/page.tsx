'use client';

/**
 * Work Completion Certificates List Page
 *
 * List and manage work completion certificates
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import type { WorkCompletionCertificate } from '@vapour/types';
import { listWCCs } from '@/lib/procurement/workCompletionService';
import {
  filterWCCs,
  calculateWCCStats,
  getCompletionStatus,
} from '@/lib/procurement/workCompletionHelpers';
import { formatDate } from '@/lib/utils/formatters';

export default function WorkCompletionListPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wccs, setWccs] = useState<WorkCompletionCertificate[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    loadWCCs();
  }, []);

  const loadWCCs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listWCCs({});
      setWccs(data);
    } catch (err) {
      console.error('[WorkCompletionListPage] Error loading WCCs:', err);
      setError('Failed to load work completion certificates');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const filteredWCCs = useMemo(() => {
    return filterWCCs(wccs, searchTerm);
  }, [wccs, searchTerm]);

  // Calculate stats
  const stats = useMemo(() => calculateWCCStats(wccs), [wccs]);

  // Paginate
  const paginatedWCCs = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredWCCs.slice(start, start + rowsPerPage);
  }, [filteredWCCs, page, rowsPerPage]);

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
              Work Completion Certificates
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track and manage work completion certificates for purchase orders
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/procurement/work-completion/new')}
          >
            New WCC
          </Button>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Card sx={{ minWidth: 150 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <DescriptionIcon color="primary" />
                <Box>
                  <Typography variant="h5">{stats.total}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total WCCs
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
                  <Typography variant="h5">{stats.fullyComplete}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Fully Complete
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
                  <Typography variant="h5">{stats.pendingPayments}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending Payment
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Search */}
        <Paper sx={{ p: 2 }}>
          <TextField
            fullWidth
            placeholder="Search by WCC number, PO number, vendor, or project..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Paper>

        {/* WCC Table */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>WCC Number</TableCell>
                  <TableCell>PO Number</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell>Completion Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Issued By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedWCCs.map((wcc) => {
                  const status = getCompletionStatus(wcc);
                  return (
                    <TableRow
                      key={wcc.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/procurement/work-completion/${wcc.id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {wcc.number}
                        </Typography>
                      </TableCell>
                      <TableCell>{wcc.poNumber}</TableCell>
                      <TableCell>{wcc.vendorName}</TableCell>
                      <TableCell>{wcc.projectName}</TableCell>
                      <TableCell>{formatDate(wcc.completionDate)}</TableCell>
                      <TableCell>
                        <Chip label={status.label} color={status.color} size="small" />
                      </TableCell>
                      <TableCell>{wcc.issuedByName}</TableCell>
                    </TableRow>
                  );
                })}
                {paginatedWCCs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary" sx={{ py: 4 }}>
                        {searchTerm
                          ? 'No work completion certificates match your search'
                          : 'No work completion certificates found'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredWCCs.length}
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
