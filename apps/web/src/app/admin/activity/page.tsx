'use client';

/**
 * Activity Feed Page
 *
 * Shows recent organization-wide activity in a user-friendly feed layout.
 * Groups entries by date and supports filtering by module and user.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Paper,
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  ShoppingCart as ProcurementIcon,
  AccountBalance as AccountingIcon,
  People as HRIcon,
  Assignment as ProjectIcon,
  Settings as SystemIcon,
  Description as DocumentIcon,
  Inventory as MaterialIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { format, isToday, isYesterday, startOfWeek, isWithinInterval } from 'date-fns';
import type { AuditLog, AuditEntityType } from '@vapour/types';

// Map entity types to module categories for filtering
const MODULE_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  Procurement: {
    label: 'Procurement',
    icon: <ProcurementIcon fontSize="small" />,
    color: '#2196f3',
  },
  Accounting: {
    label: 'Accounting',
    icon: <AccountingIcon fontSize="small" />,
    color: '#4caf50',
  },
  HR: {
    label: 'HR',
    icon: <HRIcon fontSize="small" />,
    color: '#9c27b0',
  },
  Projects: {
    label: 'Projects',
    icon: <ProjectIcon fontSize="small" />,
    color: '#ff9800',
  },
  Documents: {
    label: 'Documents',
    icon: <DocumentIcon fontSize="small" />,
    color: '#607d8b',
  },
  Materials: {
    label: 'Materials',
    icon: <MaterialIcon fontSize="small" />,
    color: '#795548',
  },
  System: {
    label: 'System',
    icon: <SystemIcon fontSize="small" />,
    color: '#9e9e9e',
  },
};

const ENTITY_TO_MODULE: Record<string, string> = {
  PURCHASE_REQUEST: 'Procurement',
  PURCHASE_REQUEST_ITEM: 'Procurement',
  RFQ: 'Procurement',
  QUOTATION: 'Procurement',
  OFFER: 'Procurement',
  PURCHASE_ORDER: 'Procurement',
  PURCHASE_ORDER_ITEM: 'Procurement',
  PURCHASE_ORDER_AMENDMENT: 'Procurement',
  GOODS_RECEIPT: 'Procurement',
  PACKING_LIST: 'Procurement',
  THREE_WAY_MATCH: 'Procurement',
  TRANSACTION: 'Accounting',
  INVOICE: 'Accounting',
  BILL: 'Accounting',
  PAYMENT: 'Accounting',
  JOURNAL_ENTRY: 'Accounting',
  GL_ACCOUNT: 'Accounting',
  COST_CENTRE: 'Accounting',
  LEAVE_REQUEST: 'HR',
  LEAVE_BALANCE: 'HR',
  LEAVE_TYPE: 'HR',
  PROJECT: 'Projects',
  PROJECT_CHARTER: 'Projects',
  MASTER_DOCUMENT: 'Documents',
  DOCUMENT_SUBMISSION: 'Documents',
  TRANSMITTAL: 'Documents',
  MATERIAL: 'Materials',
  BOM: 'Materials',
  BOUGHT_OUT_ITEM: 'Materials',
  USER: 'System',
  ROLE: 'System',
  PERMISSION: 'System',
  ENTITY: 'System',
  VENDOR: 'System',
  CUSTOMER: 'System',
  PARTNER: 'System',
  COMPANY: 'System',
  INVITATION: 'System',
  SYSTEM: 'System',
};

function getModuleForEntity(entityType?: AuditEntityType | string): string {
  if (!entityType) return 'System';
  return ENTITY_TO_MODULE[entityType] || 'System';
}

/** Format an audit log action into a human-readable activity description */
function formatActivity(log: AuditLog): string {
  const actor = log.actorName || 'Someone';
  const entity = log.entityName || log.entityId || '';
  const action = log.action?.replace(/_/g, ' ').toLowerCase() || '';

  // Use description if available (most descriptive)
  if (log.description) return log.description;

  // Fallback to structured format
  if (entity) return `${actor} ${action} ${entity}`;
  return `${actor} ${action}`;
}

/** Group date label */
function getDateGroup(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  if (isWithinInterval(date, { start: weekStart, end: new Date() })) {
    return 'Earlier This Week';
  }

  return format(date, 'EEEE, MMM d');
}

export default function ActivityFeedPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Subscribe to recent audit logs
  useEffect(() => {
    const { db } = getFirebase();
    const q = query(
      collection(db, COLLECTIONS.AUDIT_LOGS),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

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
        console.error('Error fetching activity feed:', err);
        setError('Failed to load activity feed. You may not have permission to view audit logs.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Unique actors for user filter display
  const uniqueActors = useMemo(() => {
    const actors = new Map<string, string>();
    auditLogs.forEach((log) => {
      if (log.actorName && log.actorName !== 'System') {
        actors.set(log.actorName, log.actorEmail || '');
      }
    });
    return Array.from(actors.entries()).map(([name]) => name);
  }, [auditLogs]);

  const [userFilter, setUserFilter] = useState<string>('all');

  // Filter and group logs
  const groupedLogs = useMemo(() => {
    const filtered = auditLogs.filter((log) => {
      // Module filter
      if (moduleFilter !== 'all') {
        const mod = getModuleForEntity(log.entityType);
        if (mod !== moduleFilter) return false;
      }

      // User filter
      if (userFilter !== 'all' && log.actorName !== userFilter) return false;

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (log.actorName?.toLowerCase() || '').includes(q) ||
          (log.entityName?.toLowerCase() || '').includes(q) ||
          (log.description?.toLowerCase() || '').includes(q) ||
          (log.action?.toLowerCase() || '').includes(q)
        );
      }

      return true;
    });

    // Group by date
    const groups: { label: string; logs: AuditLog[] }[] = [];
    let currentGroup = '';

    filtered.forEach((log) => {
      try {
        const date = log.timestamp?.toDate();
        if (!date) return;
        const group = getDateGroup(date);

        if (group !== currentGroup) {
          currentGroup = group;
          groups.push({ label: group, logs: [] });
        }

        const lastGroup = groups[groups.length - 1];
        if (lastGroup) lastGroup.logs.push(log);
      } catch {
        // Skip entries with invalid timestamps
      }
    });

    return groups;
  }, [auditLogs, moduleFilter, userFilter, searchQuery]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Activity Feed
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Recent organization-wide activity and changes
        </Typography>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Module</InputLabel>
            <Select
              value={moduleFilter}
              label="Module"
              onChange={(e) => setModuleFilter(e.target.value)}
            >
              <MenuItem value="all">All Modules</MenuItem>
              {Object.entries(MODULE_MAP).map(([key, config]) => (
                <MenuItem key={key} value={key}>
                  {config.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>User</InputLabel>
            <Select value={userFilter} label="User" onChange={(e) => setUserFilter(e.target.value)}>
              <MenuItem value="all">All Users</MenuItem>
              {uniqueActors.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="body2" color="text.secondary">
            {auditLogs.length} recent entries
          </Typography>
        </Stack>
      </Paper>

      {/* Activity Feed */}
      {groupedLogs.length === 0 ? (
        <Alert severity="info">
          {auditLogs.length === 0
            ? 'No activity recorded yet.'
            : 'No activity matches your filters.'}
        </Alert>
      ) : (
        <Stack spacing={3}>
          {groupedLogs.map((group) => (
            <Box key={group.label}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 1.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
              >
                {group.label}
              </Typography>

              <Stack spacing={1}>
                {group.logs.map((log) => {
                  const mod = getModuleForEntity(log.entityType);
                  const moduleConfig = MODULE_MAP[mod];
                  let timeStr = '';
                  try {
                    timeStr = format(log.timestamp?.toDate(), 'h:mm a');
                  } catch {
                    timeStr = '';
                  }

                  return (
                    <Card
                      key={log.id}
                      variant="outlined"
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                        ...(log.success === false && {
                          borderColor: 'error.main',
                          borderWidth: 2,
                        }),
                      }}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: moduleConfig?.color || '#9e9e9e',
                              fontSize: '0.75rem',
                            }}
                          >
                            {log.actorName?.[0]?.toUpperCase() || <PersonIcon fontSize="small" />}
                          </Avatar>

                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                              {formatActivity(log)}
                            </Typography>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mt: 0.5,
                                flexWrap: 'wrap',
                              }}
                            >
                              {timeStr && (
                                <Typography variant="caption" color="text.secondary">
                                  {timeStr}
                                </Typography>
                              )}
                              <Chip
                                label={moduleConfig?.label || mod}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.65rem',
                                }}
                              />
                              {log.severity === 'CRITICAL' && (
                                <Chip
                                  label="Critical"
                                  size="small"
                                  color="error"
                                  sx={{ height: 20, fontSize: '0.65rem' }}
                                />
                              )}
                              {log.success === false && (
                                <Chip
                                  label="Failed"
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.65rem' }}
                                />
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
