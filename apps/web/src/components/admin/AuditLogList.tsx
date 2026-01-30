'use client';

/**
 * Audit Log List Component
 *
 * Admin interface to view and filter audit log entries.
 * Provides filtering by action, entity type, severity, and text search.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Stack,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Paper,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { formatDistanceToNow, format } from 'date-fns';
import type { AuditLog, AuditAction, AuditEntityType, AuditSeverity } from '@vapour/types';
import {
  ACTION_CATEGORIES,
  ENTITY_TYPE_CATEGORIES,
  SEVERITY_CONFIG,
} from '@/lib/audit/auditLogService';
import { AuditLogDetail } from './AuditLogDetail';

export function AuditLogList() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<AuditEntityType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Detail dialog state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Subscribe to audit logs collection
  useEffect(() => {
    const { db } = getFirebase();
    const auditLogsRef = collection(db, COLLECTIONS.AUDIT_LOGS);
    const q = query(auditLogsRef, orderBy('timestamp', 'desc'), limit(500));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const logs: AuditLog[] = [];
        snapshot.forEach((doc) => {
          logs.push({ id: doc.id, ...doc.data() } as AuditLog);
        });
        setAuditLogs(logs);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching audit logs:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        // Check for common Firestore permission errors
        if (
          errorMessage.includes('permission-denied') ||
          errorMessage.includes('PERMISSION_DENIED')
        ) {
          setError('Access denied. You do not have permission to view audit logs.');
        } else if (errorMessage.includes('Missing or insufficient permissions')) {
          setError('Missing permissions. Please ensure your account has admin access.');
        } else {
          setError(`Failed to load audit logs: ${errorMessage}`);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter audit logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // Action filter
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;

      // Entity type filter
      if (entityTypeFilter !== 'all' && log.entityType !== entityTypeFilter) return false;

      // Severity filter
      if (severityFilter !== 'all' && log.severity !== severityFilter) return false;

      // Date range filter
      if (startDate || endDate) {
        try {
          const logDate = log.timestamp?.toDate();
          if (!logDate) return false;
          if (startDate && logDate < new Date(startDate)) return false;
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (logDate > end) return false;
          }
        } catch {
          return false;
        }
      }

      // Search filter (actor name/email, entity name, description)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          (log.actorName?.toLowerCase() || '').includes(query) ||
          (log.actorEmail?.toLowerCase() || '').includes(query) ||
          (log.entityName?.toLowerCase() || '').includes(query) ||
          (log.description?.toLowerCase() || '').includes(query) ||
          (log.entityId?.toLowerCase() || '').includes(query)
        );
      }

      return true;
    });
  }, [auditLogs, actionFilter, entityTypeFilter, severityFilter, searchQuery, startDate, endDate]);

  // Paginated logs
  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredLogs, page, rowsPerPage]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const openDetailDialog = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActionFilter('all');
    setEntityTypeFilter('all');
    setSeverityFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(0);
  };

  const exportToCSV = () => {
    const headers = [
      'Timestamp',
      'Actor',
      'Email',
      'Action',
      'Entity Type',
      'Entity ID',
      'Entity Name',
      'Severity',
      'Description',
      'Success',
    ];

    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const rows = filteredLogs.map((log) => [
      escapeCSV(formatFullTimestamp(log.timestamp)),
      escapeCSV(log.actorName || 'System'),
      escapeCSV(log.actorEmail || ''),
      escapeCSV(log.action?.replace(/_/g, ' ') || ''),
      escapeCSV(log.entityType?.replace(/_/g, ' ') || ''),
      escapeCSV(log.entityId || ''),
      escapeCSV(log.entityName || ''),
      escapeCSV(log.severity || ''),
      escapeCSV(log.description || ''),
      log.success !== false ? 'Yes' : 'No',
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: AuditLog['timestamp']) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate();
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Invalid date';
    }
  };

  const formatFullTimestamp = (timestamp: AuditLog['timestamp']) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate();
      return format(date, 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return 'Invalid date';
    }
  };

  // Format action for display (replace underscores with spaces)
  const formatAction = (action: string | undefined | null) => {
    return action?.replace(/_/g, ' ') || '';
  };

  // Get severity color
  const getSeverityColor = (severity: AuditSeverity): 'info' | 'warning' | 'error' | 'default' => {
    return SEVERITY_CONFIG[severity]?.color || 'default';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search by actor, entity, or description..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 300 }}
          />

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Action</InputLabel>
            <Select
              value={actionFilter}
              label="Action"
              onChange={(e) => {
                setActionFilter(e.target.value as AuditAction | 'all');
                setPage(0);
              }}
            >
              <MenuItem value="all">All Actions</MenuItem>
              {Object.entries(ACTION_CATEGORIES).flatMap(([category, actions]) => [
                <MenuItem
                  key={`cat-${category}`}
                  disabled
                  sx={{ fontWeight: 'bold', opacity: 1, bgcolor: 'action.hover' }}
                >
                  {category}
                </MenuItem>,
                ...(actions || []).filter(Boolean).map((action) => (
                  <MenuItem key={action} value={action} sx={{ pl: 4 }}>
                    {formatAction(action)}
                  </MenuItem>
                )),
              ])}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Entity Type</InputLabel>
            <Select
              value={entityTypeFilter}
              label="Entity Type"
              onChange={(e) => {
                setEntityTypeFilter(e.target.value as AuditEntityType | 'all');
                setPage(0);
              }}
            >
              <MenuItem value="all">All Entity Types</MenuItem>
              {Object.entries(ENTITY_TYPE_CATEGORIES).flatMap(([category, types]) => [
                <MenuItem
                  key={`cat-${category}`}
                  disabled
                  sx={{ fontWeight: 'bold', opacity: 1, bgcolor: 'action.hover' }}
                >
                  {category}
                </MenuItem>,
                ...(types || []).filter(Boolean).map((type) => (
                  <MenuItem key={type} value={type} sx={{ pl: 4 }}>
                    {type.replace(/_/g, ' ')}
                  </MenuItem>
                )),
              ])}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Severity</InputLabel>
            <Select
              value={severityFilter}
              label="Severity"
              onChange={(e) => {
                setSeverityFilter(e.target.value as AuditSeverity | 'all');
                setPage(0);
              }}
            >
              <MenuItem value="all">All Severities</MenuItem>
              {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                <MenuItem key={key} value={key}>
                  {config.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            type="date"
            label="From"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(0);
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />

          <TextField
            size="small"
            type="date"
            label="To"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(0);
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />

          <Tooltip title="Clear Filters">
            <IconButton onClick={clearFilters} size="small" aria-label="Clear filters">
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="body2" color="text.secondary">
            {filteredLogs.length} of {auditLogs.length} entries
          </Typography>

          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={exportToCSV}
            disabled={filteredLogs.length === 0}
          >
            Export CSV
          </Button>
        </Stack>
      </Paper>

      {/* Audit Logs Table */}
      {filteredLogs.length === 0 ? (
        <Alert severity="info">
          {auditLogs.length === 0 ? 'No audit log entries yet.' : 'No entries match your filters.'}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 140 }}>Timestamp</TableCell>
                <TableCell sx={{ width: 180 }}>Actor</TableCell>
                <TableCell sx={{ width: 160 }}>Action</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell sx={{ width: 90 }}>Severity</TableCell>
                <TableCell sx={{ width: 60 }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedLogs.map((log) => (
                <TableRow
                  key={log.id}
                  hover
                  sx={{
                    cursor: 'pointer',
                    ...(log.severity === 'CRITICAL' && {
                      bgcolor: 'error.dark',
                      '&:hover': { bgcolor: 'error.main' },
                    }),
                  }}
                  onClick={() => openDetailDialog(log)}
                >
                  {/* Timestamp */}
                  <TableCell>
                    <Tooltip title={formatFullTimestamp(log.timestamp)}>
                      <Typography variant="body2" color="text.secondary">
                        {formatTimestamp(log.timestamp)}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  {/* Actor */}
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                      {log.actorName || log.actorEmail || 'System'}
                    </Typography>
                    {log.actorEmail &&
                      log.actorName &&
                      log.actorEmail !== log.actorName &&
                      !log.actorEmail.includes('unknown@') &&
                      !log.actorEmail.includes('system@') && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          component="div"
                          sx={{ maxWidth: 160 }}
                        >
                          {log.actorEmail}
                        </Typography>
                      )}
                  </TableCell>

                  {/* Action */}
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                      {formatAction(log.action)}
                    </Typography>
                  </TableCell>

                  {/* Entity */}
                  <TableCell>
                    <Typography variant="body2" noWrap>
                      {log.entityName || log.entityId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div">
                      {log.entityType?.replace(/_/g, ' ')}
                    </Typography>
                  </TableCell>

                  {/* Severity */}
                  <TableCell>
                    <Chip
                      label={log.severity}
                      size="small"
                      color={getSeverityColor(log.severity)}
                      variant={log.severity === 'CRITICAL' ? 'filled' : 'outlined'}
                    />
                  </TableCell>

                  {/* Actions */}
                  <TableCell align="right">
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetailDialog(log);
                        }}
                        aria-label="View details"
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredLogs.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      )}

      {/* Detail Dialog */}
      <AuditLogDetail
        log={selectedLog}
        open={detailDialogOpen}
        onClose={() => {
          setDetailDialogOpen(false);
          setSelectedLog(null);
        }}
      />
    </Box>
  );
}
