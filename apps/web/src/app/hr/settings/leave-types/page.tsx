'use client';

import { useState, useEffect } from 'react';
import {
  Container,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Grid,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canManageHRSettings } from '@vapour/constants';
import {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  type CreateLeaveTypeInput,
} from '@/lib/hr';
import type { LeaveType, LeaveTypeCode } from '@vapour/types';

const LEAVE_TYPE_CODES: { value: LeaveTypeCode; label: string }[] = [
  { value: 'SICK', label: 'Sick Leave' },
  { value: 'CASUAL', label: 'Casual Leave' },
  { value: 'EARNED', label: 'Earned Leave' },
  { value: 'UNPAID', label: 'Unpaid Leave' },
  { value: 'MATERNITY', label: 'Maternity Leave' },
  { value: 'PATERNITY', label: 'Paternity Leave' },
];

const DEFAULT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

interface FormData {
  code: LeaveTypeCode;
  name: string;
  description: string;
  annualQuota: number;
  carryForwardAllowed: boolean;
  maxCarryForward: number;
  isPaid: boolean;
  requiresApproval: boolean;
  minNoticeDays: number;
  maxConsecutiveDays: number | undefined;
  allowHalfDay: boolean;
  color: string;
}

const defaultFormData: FormData = {
  code: 'CASUAL',
  name: '',
  description: '',
  annualQuota: 12,
  carryForwardAllowed: false,
  maxCarryForward: 0,
  isPaid: true,
  requiresApproval: true,
  minNoticeDays: 0,
  maxConsecutiveDays: undefined,
  allowHalfDay: true,
  color: '#3b82f6',
};

export default function LeaveTypesSettingsPage() {
  const { user, claims } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [saving, setSaving] = useState(false);

  const permissions2 = claims?.permissions2 ?? 0;
  const hasManageAccess = canManageHRSettings(permissions2);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getLeaveTypes(true); // Include inactive
      setLeaveTypes(data);
    } catch (err) {
      console.error('Failed to load leave types:', err);
      setError('Failed to load leave types. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = () => {
    setEditingType(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const handleEdit = (type: LeaveType) => {
    setEditingType(type);
    setFormData({
      code: type.code,
      name: type.name,
      description: type.description || '',
      annualQuota: type.annualQuota,
      carryForwardAllowed: type.carryForwardAllowed,
      maxCarryForward: type.maxCarryForward || 0,
      isPaid: type.isPaid,
      requiresApproval: type.requiresApproval,
      minNoticeDays: type.minNoticeDays || 0,
      maxConsecutiveDays: type.maxConsecutiveDays,
      allowHalfDay: type.allowHalfDay,
      color: type.color || '#3b82f6',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setError(null);

    try {
      if (editingType) {
        // Update existing
        await updateLeaveType(
          editingType.id,
          {
            name: formData.name,
            description: formData.description,
            annualQuota: formData.annualQuota,
            carryForwardAllowed: formData.carryForwardAllowed,
            maxCarryForward: formData.maxCarryForward,
            isPaid: formData.isPaid,
            requiresApproval: formData.requiresApproval,
            minNoticeDays: formData.minNoticeDays,
            maxConsecutiveDays: formData.maxConsecutiveDays,
            allowHalfDay: formData.allowHalfDay,
            color: formData.color,
          },
          user.uid
        );
      } else {
        // Create new
        const input: CreateLeaveTypeInput = {
          code: formData.code,
          name:
            formData.name ||
            LEAVE_TYPE_CODES.find((c) => c.value === formData.code)?.label ||
            formData.code,
          description: formData.description,
          annualQuota: formData.annualQuota,
          carryForwardAllowed: formData.carryForwardAllowed,
          maxCarryForward: formData.maxCarryForward,
          isPaid: formData.isPaid,
          requiresApproval: formData.requiresApproval,
          minNoticeDays: formData.minNoticeDays,
          maxConsecutiveDays: formData.maxConsecutiveDays,
          allowHalfDay: formData.allowHalfDay,
          color: formData.color,
        };
        await createLeaveType(input, user.uid);
      }

      setDialogOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save leave type:', err);
      setError(err instanceof Error ? err.message : 'Failed to save leave type');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (type: LeaveType) => {
    if (!user) return;

    try {
      await updateLeaveType(type.id, { isActive: !type.isActive }, user.uid);
      await loadData();
    } catch (err) {
      console.error('Failed to toggle leave type:', err);
      setError('Failed to update leave type status');
    }
  };

  if (!hasManageAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Leave Type Settings
          </Typography>
          <Alert severity="error">You do not have permission to manage HR settings.</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Leave Type Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure leave types, quotas, and policies
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <IconButton onClick={loadData} title="Refresh">
            <RefreshIcon />
          </IconButton>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Leave Type
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Skeleton variant="rectangular" height={400} />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="center">Annual Quota</TableCell>
                <TableCell align="center">Carry Forward</TableCell>
                <TableCell align="center">Paid</TableCell>
                <TableCell align="center">Half Day</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leaveTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No leave types configured. Click &quot;Add Leave Type&quot; to create one.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                leaveTypes.map((type) => (
                  <TableRow key={type.id} hover>
                    <TableCell>
                      <Chip
                        label={type.code}
                        size="small"
                        sx={{ backgroundColor: type.color || '#3b82f6', color: 'white' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{type.name}</Typography>
                        {type.description && (
                          <Typography variant="caption" color="text.secondary">
                            {type.description}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">{type.annualQuota} days</TableCell>
                    <TableCell align="center">
                      {type.carryForwardAllowed ? `Yes (max ${type.maxCarryForward})` : 'No'}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={type.isPaid ? 'Paid' : 'Unpaid'}
                        size="small"
                        color={type.isPaid ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">{type.allowHalfDay ? 'Yes' : 'No'}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={type.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={type.isActive ? 'success' : 'default'}
                        onClick={() => handleToggleActive(type)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleEdit(type)} title="Edit">
                        <EditIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingType ? 'Edit Leave Type' : 'Add Leave Type'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {!editingType && (
              <Grid size={{ xs: 12 }}>
                <TextField
                  select
                  label="Leave Type Code"
                  fullWidth
                  value={formData.code}
                  onChange={(e) => {
                    const code = e.target.value as LeaveTypeCode;
                    setFormData({
                      ...formData,
                      code,
                      name: LEAVE_TYPE_CODES.find((c) => c.value === code)?.label || '',
                    });
                  }}
                  slotProps={{
                    select: {
                      native: true,
                    },
                  }}
                >
                  {LEAVE_TYPE_CODES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </TextField>
              </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Name"
                fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={LEAVE_TYPE_CODES.find((c) => c.value === formData.code)?.label}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Annual Quota (days)"
                type="number"
                fullWidth
                value={formData.annualQuota}
                onChange={(e) =>
                  setFormData({ ...formData, annualQuota: parseInt(e.target.value) || 0 })
                }
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Min Notice (days)"
                type="number"
                fullWidth
                value={formData.minNoticeDays}
                onChange={(e) =>
                  setFormData({ ...formData, minNoticeDays: parseInt(e.target.value) || 0 })
                }
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.carryForwardAllowed}
                    onChange={(e) =>
                      setFormData({ ...formData, carryForwardAllowed: e.target.checked })
                    }
                  />
                }
                label="Allow Carry Forward"
              />
            </Grid>
            {formData.carryForwardAllowed && (
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Max Carry Forward (days)"
                  type="number"
                  fullWidth
                  value={formData.maxCarryForward}
                  onChange={(e) =>
                    setFormData({ ...formData, maxCarryForward: parseInt(e.target.value) || 0 })
                  }
                />
              </Grid>
            )}
            <Grid size={{ xs: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPaid}
                    onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                  />
                }
                label="Paid Leave"
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.requiresApproval}
                    onChange={(e) =>
                      setFormData({ ...formData, requiresApproval: e.target.checked })
                    }
                  />
                }
                label="Requires Approval"
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.allowHalfDay}
                    onChange={(e) => setFormData({ ...formData, allowHalfDay: e.target.checked })}
                  />
                }
                label="Allow Half Day"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Color
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {DEFAULT_COLORS.map((color) => (
                  <Box
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1,
                      backgroundColor: color,
                      cursor: 'pointer',
                      border: formData.color === color ? 3 : 0,
                      borderColor: 'primary.main',
                    }}
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
