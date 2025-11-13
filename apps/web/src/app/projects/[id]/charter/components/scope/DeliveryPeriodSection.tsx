/**
 * Delivery Period Section Component
 */

'use client';

import { useState } from 'react';
import { Box, Typography, Paper, Button, Grid, TextField, Divider } from '@mui/material';
import { Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';

// Helper function to convert Firestore Timestamp to Date
const convertToDate = (timestamp: unknown): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
    const tsObj = timestamp as { toDate?: () => Date };
    return tsObj.toDate?.() || null;
  }
  return null;
};

interface DeliveryPeriodSectionProps {
  hasManageAccess: boolean;
  loading: boolean;
  deliveryPeriod?: {
    startDate?: unknown;
    endDate?: unknown;
    duration?: number;
    description?: string;
  };
  onSave: (data: {
    startDate: string;
    endDate: string;
    duration: string;
    description: string;
  }) => void;
}

export function DeliveryPeriodSection({
  hasManageAccess,
  loading,
  deliveryPeriod,
  onSave,
}: DeliveryPeriodSectionProps) {
  const [editing, setEditing] = useState(false);
  const [startDate, setStartDate] = useState<string>(() => {
    const date = convertToDate(deliveryPeriod?.startDate);
    return date ? date.toISOString().split('T')[0]! : '';
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const date = convertToDate(deliveryPeriod?.endDate);
    return date ? date.toISOString().split('T')[0]! : '';
  });
  const [duration, setDuration] = useState<string>(deliveryPeriod?.duration?.toString() || '');
  const [description, setDescription] = useState<string>(deliveryPeriod?.description || '');

  const handleSave = () => {
    onSave({
      startDate: startDate || '',
      endDate: endDate || '',
      duration: duration || '',
      description: description || '',
    });
    setEditing(false);
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Delivery Period</Typography>
        {hasManageAccess && !editing && (
          <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {editing ? (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Duration (days)"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., 12 months from order date"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={loading}
              >
                Save
              </Button>
              <Button
                startIcon={<CancelIcon />}
                onClick={() => setEditing(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </Box>
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="body2" color="text.secondary">
              Start Date
            </Typography>
            <Typography variant="body1">{startDate || 'Not set'}</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="body2" color="text.secondary">
              End Date
            </Typography>
            <Typography variant="body1">{endDate || 'Not set'}</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="body2" color="text.secondary">
              Duration
            </Typography>
            <Typography variant="body1">{duration ? `${duration} days` : 'Not set'}</Typography>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Typography variant="body2" color="text.secondary">
              Description
            </Typography>
            <Typography variant="body1">{description || 'Not set'}</Typography>
          </Grid>
        </Grid>
      )}
    </Paper>
  );
}
