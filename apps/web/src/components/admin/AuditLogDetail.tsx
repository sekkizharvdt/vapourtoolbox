'use client';

/**
 * Audit Log Detail Component
 *
 * Dialog component to display full details of an audit log entry.
 * Shows actor info, action details, entity info, changes, and metadata.
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Stack,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Person as PersonIcon,
  CheckCircle as SuccessIcon,
  Cancel as FailIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { AuditLog, AuditSeverity } from '@vapour/types';
import { SEVERITY_CONFIG } from '@/lib/audit/auditLogService';

interface AuditLogDetailProps {
  log: AuditLog | null;
  open: boolean;
  onClose: () => void;
}

export function AuditLogDetail({ log, open, onClose }: AuditLogDetailProps) {
  if (!log) return null;

  const formatTimestamp = (timestamp: AuditLog['timestamp']) => {
    if (!timestamp) return 'N/A';
    try {
      return format(timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return 'Invalid date';
    }
  };

  const getSeverityColor = (severity: AuditSeverity): 'info' | 'warning' | 'error' | 'default' => {
    return SEVERITY_CONFIG[severity]?.color || 'default';
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ');
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">{formatAction(log.action)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTimestamp(log.timestamp)}
            </Typography>
          </Box>
          <Chip
            label={log.severity}
            color={getSeverityColor(log.severity)}
            variant={log.severity === 'CRITICAL' ? 'filled' : 'outlined'}
          />
          {log.success !== undefined && (
            <Chip
              icon={log.success ? <SuccessIcon /> : <FailIcon />}
              label={log.success ? 'Success' : 'Failed'}
              color={log.success ? 'success' : 'error'}
              variant="outlined"
              size="small"
            />
          )}
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Description */}
          {log.description && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Description
              </Typography>
              <Typography>{log.description}</Typography>
            </Box>
          )}

          {/* Error Message (if failed) */}
          {log.errorMessage && (
            <Box>
              <Typography variant="subtitle2" color="error" gutterBottom>
                Error Message
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'error.dark',
                  color: 'error.contrastText',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                }}
              >
                {log.errorMessage}
              </Paper>
            </Box>
          )}

          <Divider />

          {/* Actor Information */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              <PersonIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
              Actor
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                <strong>Name:</strong> {log.actorName || 'N/A'}
              </Typography>
              {log.actorEmail &&
                !log.actorEmail.includes('unknown@') &&
                !log.actorEmail.includes('system@') && (
                  <Typography variant="body2">
                    <strong>Email:</strong> {log.actorEmail}
                  </Typography>
                )}
              <Typography variant="body2">
                <strong>User ID:</strong>{' '}
                <Typography component="code" variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {log.actorId}
                </Typography>
              </Typography>
              {log.actorPermissions !== undefined && (
                <Typography variant="body2">
                  <strong>Permissions:</strong> {log.actorPermissions}
                </Typography>
              )}
            </Stack>
          </Box>

          <Divider />

          {/* Entity Information */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Target Entity
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                <strong>Type:</strong>{' '}
                <Chip label={log.entityType?.replace(/_/g, ' ')} size="small" variant="outlined" />
              </Typography>
              <Typography variant="body2">
                <strong>ID:</strong>{' '}
                <Typography component="code" variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {log.entityId}
                </Typography>
              </Typography>
              {log.entityName && (
                <Typography variant="body2">
                  <strong>Name:</strong> {log.entityName}
                </Typography>
              )}
            </Stack>
          </Box>

          {/* Parent Entity (if present) */}
          {log.parentEntityType && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Parent Entity
                </Typography>
                <Stack spacing={0.5}>
                  <Typography variant="body2">
                    <strong>Type:</strong>{' '}
                    <Chip
                      label={log.parentEntityType?.replace(/_/g, ' ')}
                      size="small"
                      variant="outlined"
                    />
                  </Typography>
                  <Typography variant="body2">
                    <strong>ID:</strong>{' '}
                    <Typography component="code" variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {log.parentEntityId}
                    </Typography>
                  </Typography>
                </Stack>
              </Box>
            </>
          )}

          {/* Changes (if present) */}
          {log.changes && log.changes.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Changes ({log.changes.length} field{log.changes.length !== 1 ? 's' : ''})
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Field</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Old Value</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>New Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {log.changes.map((change, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{ fontFamily: 'monospace', fontWeight: 'medium' }}
                            >
                              {change.field}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                color: 'error.main',
                                whiteSpace: 'pre-wrap',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {formatValue(change.oldValue)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                color: 'success.main',
                                whiteSpace: 'pre-wrap',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {formatValue(change.newValue)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </>
          )}

          {/* Metadata (if present) */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Metadata
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: 'grey.900',
                    color: 'grey.100',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    whiteSpace: 'pre-wrap',
                    overflow: 'auto',
                    maxHeight: 200,
                  }}
                >
                  {JSON.stringify(log.metadata, null, 2)}
                </Paper>
              </Box>
            </>
          )}

          {/* Technical Information */}
          {(log.ipAddress || log.userAgent) && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Technical Information
                </Typography>
                <Stack spacing={0.5}>
                  {log.ipAddress && (
                    <Typography variant="body2">
                      <strong>IP Address:</strong> {log.ipAddress}
                    </Typography>
                  )}
                  {log.userAgent && (
                    <Typography
                      variant="body2"
                      sx={{
                        wordBreak: 'break-all',
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                      }}
                    >
                      <strong>User Agent:</strong> {log.userAgent}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </>
          )}

          {/* Compliance Information */}
          {log.isComplianceSensitive && (
            <>
              <Divider />
              <Box>
                <Chip label="Compliance Sensitive" color="warning" size="small" sx={{ mr: 1 }} />
                {log.retentionDays && (
                  <Typography variant="caption" color="text.secondary">
                    Retention: {log.retentionDays} days
                  </Typography>
                )}
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
