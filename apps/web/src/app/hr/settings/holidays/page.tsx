'use client';

import { useState, useEffect } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Tooltip,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '@/contexts/AuthContext';
import { canManageHRSettings } from '@vapour/constants';
import {
  getHolidaysForYear,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  copyHolidaysToYear,
  DEFAULT_RECURRING_CONFIG,
} from '@/lib/hr/holidays';
import type { Holiday, HolidayType } from '@vapour/types';
import { format } from 'date-fns';

const HOLIDAY_TYPE_OPTIONS: { value: HolidayType; label: string; color: string }[] = [
  { value: 'COMPANY', label: 'Company Holiday', color: '#f97316' },
  { value: 'NATIONAL', label: 'National Holiday', color: '#ef4444' },
  { value: 'OPTIONAL', label: 'Optional Holiday', color: '#8b5cf6' },
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
  name: string;
  date: Date | null;
  type: HolidayType;
  description: string;
  color: string;
}

const defaultFormData: FormData = {
  name: '',
  date: null,
  type: 'COMPANY',
  description: '',
  color: '#f97316',
};

export default function HolidaySettingsPage() {
  const { user, claims } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyTargetYear, setCopyTargetYear] = useState(new Date().getFullYear() + 1);

  const permissions2 = claims?.permissions2 ?? 0;
  const hasManageAccess = canManageHRSettings(permissions2);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getHolidaysForYear(selectedYear);
      setHolidays(data);
    } catch (err) {
      console.error('Failed to load holidays:', err);
      setError('Failed to load holidays. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const handleAdd = () => {
    setEditingHoliday(null);
    setFormData({
      ...defaultFormData,
      date: new Date(selectedYear, 0, 1), // Default to Jan 1 of selected year
    });
    setDialogOpen(true);
  };

  const handleEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      date: holiday.date.toDate(),
      type: holiday.type,
      description: holiday.description || '',
      color: holiday.color || '#f97316',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formData.date) return;

    if (!formData.name.trim()) {
      setError('Please enter a holiday name');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingHoliday) {
        await updateHoliday(
          editingHoliday.id,
          {
            name: formData.name,
            date: formData.date,
            type: formData.type,
            description: formData.description,
            color: formData.color,
          },
          user.uid
        );
        setSuccess('Holiday updated successfully');
      } else {
        await createHoliday(
          {
            name: formData.name,
            date: formData.date,
            type: formData.type,
            description: formData.description,
            color: formData.color,
          },
          user.uid
        );
        setSuccess('Holiday created successfully');
      }

      setDialogOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save holiday:', err);
      setError(err instanceof Error ? err.message : 'Failed to save holiday');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (holiday: Holiday) => {
    if (!user) return;

    if (!confirm(`Are you sure you want to delete "${holiday.name}"?`)) {
      return;
    }

    try {
      await deleteHoliday(holiday.id, user.uid);
      setSuccess('Holiday deleted successfully');
      await loadData();
    } catch (err) {
      console.error('Failed to delete holiday:', err);
      setError('Failed to delete holiday');
    }
  };

  const handleCopyHolidays = async () => {
    if (!user) return;

    setSaving(true);
    setError(null);

    try {
      const result = await copyHolidaysToYear(selectedYear, copyTargetYear, user.uid);
      setSuccess(
        `Copied ${result.copied} holidays to ${copyTargetYear}. ${result.skipped} skipped (already exist).`
      );
      setCopyDialogOpen(false);
    } catch (err) {
      console.error('Failed to copy holidays:', err);
      setError('Failed to copy holidays');
    } finally {
      setSaving(false);
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);

  if (!hasManageAccess) {
    return (
      <Box>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Holiday Settings
          </Typography>
          <Alert severity="error">You do not have permission to manage HR settings.</Alert>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Holiday Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage company holidays for the leave calendar
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
          <Tooltip title="Copy holidays to another year">
            <Button
              variant="outlined"
              startIcon={<CopyIcon />}
              onClick={() => setCopyDialogOpen(true)}
            >
              Copy
            </Button>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Holiday
          </Button>
        </Box>
      </Box>

      {/* Recurring Holidays Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Recurring Holidays (Auto-calculated)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The following days are automatically treated as holidays:
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            {DEFAULT_RECURRING_CONFIG.sundays && (
              <Chip
                label="All Sundays"
                size="small"
                sx={{ backgroundColor: '#9ca3af', color: 'white' }}
              />
            )}
            {DEFAULT_RECURRING_CONFIG.firstSaturday && (
              <Chip
                label="1st Saturday of each month"
                size="small"
                sx={{ backgroundColor: '#9ca3af', color: 'white' }}
              />
            )}
            {DEFAULT_RECURRING_CONFIG.thirdSaturday && (
              <Chip
                label="3rd Saturday of each month"
                size="small"
                sx={{ backgroundColor: '#9ca3af', color: 'white' }}
              />
            )}
          </Box>
        </CardContent>
      </Card>

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

      {loading ? (
        <Skeleton variant="rectangular" height={400} />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {holidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No holidays configured for {selectedYear}. Click &quot;Add Holiday&quot; to
                      create one.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                holidays.map((holiday) => {
                  const typeInfo = HOLIDAY_TYPE_OPTIONS.find((t) => t.value === holiday.type);
                  return (
                    <TableRow key={holiday.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: holiday.color || typeInfo?.color || '#f97316',
                            }}
                          />
                          <Typography variant="body2">
                            {format(holiday.date.toDate(), 'EEE, dd MMM yyyy')}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {holiday.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={typeInfo?.label || holiday.type}
                          size="small"
                          sx={{
                            backgroundColor: holiday.color || typeInfo?.color || '#f97316',
                            color: 'white',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {holiday.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => handleEdit(holiday)} title="Edit">
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(holiday)}
                          title="Delete"
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Holiday Name"
                fullWidth
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Diwali, Pongal, Independence Day"
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Date"
                  value={formData.date}
                  onChange={(newValue) =>
                    setFormData({ ...formData, date: newValue as Date | null })
                  }
                  slotProps={{
                    textField: { fullWidth: true, required: true },
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                select
                label="Type"
                fullWidth
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as HolidayType })}
              >
                {HOLIDAY_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Description (optional)"
                fullWidth
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || !formData.name || !formData.date}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Copy Dialog */}
      <Dialog
        open={copyDialogOpen}
        onClose={() => setCopyDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Copy Holidays to Another Year</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Copy all holidays from {selectedYear} to another year. Existing holidays on the same
            dates will be skipped.
          </Typography>
          <TextField
            select
            label="Target Year"
            fullWidth
            value={copyTargetYear}
            onChange={(e) => setCopyTargetYear(parseInt(e.target.value))}
          >
            {yearOptions
              .filter((y) => y !== selectedYear)
              .map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCopyHolidays} variant="contained" disabled={saving}>
            {saving ? 'Copying...' : 'Copy Holidays'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
