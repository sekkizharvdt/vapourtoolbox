/**
 * Basic Information Step Component
 *
 * First step of purchase request form for basic details
 */

'use client';

import { Paper, Typography, Divider, Stack, TextField, MenuItem } from '@mui/material';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import type { FormData } from './usePurchaseRequestForm';

interface BasicInformationStepProps {
  formData: FormData;
  onInputChange: (field: string, value: string) => void;
  onProjectSelect: (projectId: string | null) => void;
}

export function BasicInformationStep({
  formData,
  onInputChange,
  onProjectSelect,
}: BasicInformationStepProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Basic Information
      </Typography>
      <Divider sx={{ mb: 3 }} />

      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            select
            label="Type"
            value={formData.type}
            onChange={(e) => onInputChange('type', e.target.value)}
            fullWidth
            required
          >
            <MenuItem value="PROJECT">Project</MenuItem>
            <MenuItem value="BUDGETARY">Budgetary</MenuItem>
            <MenuItem value="INTERNAL">Internal</MenuItem>
          </TextField>

          <TextField
            select
            label="Category"
            value={formData.category}
            onChange={(e) => onInputChange('category', e.target.value)}
            fullWidth
            required
          >
            <MenuItem value="SERVICE">Service</MenuItem>
            <MenuItem value="RAW_MATERIAL">Raw Material</MenuItem>
            <MenuItem value="BOUGHT_OUT">Bought Out</MenuItem>
          </TextField>
        </Stack>

        {formData.type === 'PROJECT' && (
          <ProjectSelector value={formData.projectId} onChange={onProjectSelect} required />
        )}

        <TextField
          label="Title"
          value={formData.title}
          onChange={(e) => onInputChange('title', e.target.value)}
          fullWidth
          required
          placeholder="e.g., Raw Materials for Project X"
        />

        <TextField
          label="Description"
          value={formData.description}
          onChange={(e) => onInputChange('description', e.target.value)}
          multiline
          rows={3}
          fullWidth
          required
          placeholder="Detailed description of the purchase request and its purpose"
        />

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            select
            label="Priority"
            value={formData.priority}
            onChange={(e) => onInputChange('priority', e.target.value)}
            fullWidth
            required
          >
            <MenuItem value="LOW">Low</MenuItem>
            <MenuItem value="MEDIUM">Medium</MenuItem>
            <MenuItem value="HIGH">High</MenuItem>
            <MenuItem value="URGENT">Urgent</MenuItem>
          </TextField>

          <TextField
            label="Required By Date"
            type="date"
            value={formData.requiredBy}
            onChange={(e) => onInputChange('requiredBy', e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            helperText="When do you need these items?"
          />
        </Stack>
      </Stack>
    </Paper>
  );
}
