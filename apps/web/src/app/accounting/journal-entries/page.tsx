'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  TablePagination,
  Breadcrumbs,
  Link,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { FilterBar } from '@vapour/ui';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Home as HomeIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { JournalEntry } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import {
  downloadReportCSV,
  downloadReportExcel,
  type ExportSection,
} from '@/lib/accounting/reports/exportReport';
import { CreateJournalEntryDialog } from './components/CreateJournalEntryDialog';
import { formatDate } from '@/lib/utils/formatters';
import { useRouter } from 'next/navigation';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { softDeleteTransaction } from '@/lib/accounting/transactionDeleteService';

// Generate month options for the filter (current month and 11 previous months)
function getMonthOptions() {
  const options: Array<{ value: string; label: string }> = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    options.push({ value, label });
  }

  return options;
}

export default function JournalEntriesPage() {
  const router = useRouter();
  const { claims, user } = useAuth();
  const { confirm } = useConfirmDialog();
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Real-time listener for journal entries
  useEffect(() => {
    const { db } = getFirebase();
    const entriesRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const q = query(entriesRef, where('type', '==', 'JOURNAL_ENTRY'), orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entriesData: JournalEntry[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.isDeleted) {
          entriesData.push({ id: doc.id, ...data } as JournalEntry);
        }
      });
      setJournalEntries(entriesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreate = () => {
    setEditingEntry(null);
    setCreateDialogOpen(true);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setCreateDialogOpen(true);
  };

  const handleDelete = async (entryId: string) => {
    const confirmed = await confirm({
      title: 'Move to Trash',
      message:
        'This journal entry will be moved to the Trash. You can restore it later or permanently delete it from there.',
      confirmText: 'Move to Trash',
      confirmColor: 'error',
    });
    if (!confirmed) return;

    try {
      const { db } = getFirebase();
      const result = await softDeleteTransaction(db, {
        transactionId: entryId,
        reason: 'Moved to trash by user',
        userId: user?.uid || 'unknown',
        userName: user?.displayName || user?.email || 'Unknown',
        userPermissions: claims?.permissions || 0,
      });
      if (!result.success) {
        alert(result.error || 'Failed to move journal entry to trash');
      }
    } catch (error) {
      console.error('[JournalEntriesPage] Error moving entry to trash:', error);
      alert('Failed to move journal entry to trash');
    }
  };

  const handleDialogClose = () => {
    setCreateDialogOpen(false);
    setEditingEntry(null);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredEntries = useMemo(() => {
    return journalEntries.filter((entry) => {
      const matchesSearch =
        searchTerm === '' ||
        entry.transactionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.reference?.toLowerCase().includes(searchTerm.toLowerCase());

      // Month filter - compare year-month of entry date
      let matchesMonth = true;
      if (filterMonth !== 'ALL' && entry.date) {
        // Handle both Firestore Timestamp and Date objects
        const entryDate =
          typeof (entry.date as unknown as { toDate?: () => Date }).toDate === 'function'
            ? (entry.date as unknown as { toDate: () => Date }).toDate()
            : new Date(entry.date as unknown as string | number);
        const entryYearMonth = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
        matchesMonth = entryYearMonth === filterMonth;
      }

      return matchesSearch && matchesMonth;
    });
  }, [journalEntries, searchTerm, filterMonth]);

  // Paginate journal entries in memory
  const paginatedEntries = filteredEntries.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const buildExportSections = (): ExportSection[] => {
    const columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Transaction Number', key: 'number', width: 18 },
      { header: 'Description', key: 'description', width: 35 },
      { header: 'Reference', key: 'reference', width: 20 },
      {
        header: 'Amount',
        key: 'amount',
        width: 15,
        align: 'right' as const,
        format: 'currency' as const,
      },
      { header: 'Status', key: 'status', width: 12 },
    ];
    return [
      {
        title: 'Journal Entries',
        columns,
        rows: filteredEntries.map((entry) => ({
          date: formatDate(entry.date),
          number: entry.transactionNumber,
          description: entry.description || '',
          reference: entry.reference || '',
          amount: entry.amount,
          status: entry.status,
        })),
        summary: {
          date: '',
          number: '',
          description: 'TOTAL',
          reference: '',
          amount: filteredEntries.reduce((s, e) => s + (e.amount || 0), 0),
          status: '',
        },
      },
    ];
  };

  const handleExportCSV = () =>
    downloadReportCSV(
      buildExportSections(),
      `Journal_Entries_${new Date().toISOString().slice(0, 10)}`
    );
  const handleExportExcel = () =>
    downloadReportExcel(
      buildExportSections(),
      `Journal_Entries_${new Date().toISOString().slice(0, 10)}`,
      'Journal Entries'
    );

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading journal entries...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/accounting"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/accounting');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Accounting
        </Link>
        <Typography color="text.primary">Journal Entries</Typography>
      </Breadcrumbs>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Journal Entries</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {filteredEntries.length > 0 && (
            <>
              <Tooltip title="Export CSV">
                <IconButton onClick={handleExportCSV} size="small">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export Excel">
                <IconButton onClick={handleExportExcel} size="small" color="primary">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              Create Journal Entry
            </Button>
          )}
        </Stack>
      </Stack>

      <FilterBar
        onClear={() => {
          setSearchTerm('');
          setFilterMonth('ALL');
        }}
      >
        <TextField
          placeholder="Search by number, description or reference..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(0);
          }}
          size="small"
          sx={{ minWidth: 340 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Month</InputLabel>
          <Select
            value={filterMonth}
            onChange={(e) => {
              setFilterMonth(e.target.value);
              setPage(0);
            }}
            label="Month"
          >
            <MenuItem value="ALL">All Months</MenuItem>
            {monthOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </FilterBar>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Transaction Number</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    No journal entries found. Click &quot;New Journal Entry&quot; to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedEntries.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell>{formatDate(entry.date)}</TableCell>
                  <TableCell>{entry.transactionNumber}</TableCell>
                  <TableCell>{entry.description || '-'}</TableCell>
                  <TableCell>{entry.reference || '-'}</TableCell>
                  <TableCell align="right">{formatCurrency(entry.amount)}</TableCell>
                  <TableCell>
                    <Chip
                      label={entry.status}
                      size="small"
                      color={
                        entry.status === 'POSTED'
                          ? 'success'
                          : entry.status === 'DRAFT'
                            ? 'default'
                            : 'warning'
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View">
                      <IconButton size="small" onClick={() => handleEdit(entry)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canManage && (
                      <>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEdit(entry)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Move to Trash">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(entry.id!)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredEntries.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      <CreateJournalEntryDialog
        open={createDialogOpen}
        onClose={handleDialogClose}
        editingEntry={editingEntry}
        tenantId={claims?.tenantId || 'default-entity'}
      />
    </Box>
  );
}
