'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  InputAdornment,
} from '@mui/material';
import {
  OverheadConfig,
  ContingencyConfig,
  ProfitConfig,
  OverheadApplicability,
  OVERHEAD_APPLICABILITY_LABELS,
} from '@vapour/types';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';

interface CostConfigFormProps {
  initialData: {
    overhead: OverheadConfig;
    contingency: ContingencyConfig;
    profit: ProfitConfig;
    name?: string;
    description?: string;
  };
  onSave: (data: {
    overhead: OverheadConfig;
    contingency: ContingencyConfig;
    profit: ProfitConfig;
    name?: string;
    description?: string;
  }) => void;
  onCancel: () => void;
}

export default function CostConfigForm({ initialData, onSave, onCancel }: CostConfigFormProps) {
  const [formData, setFormData] = useState(initialData);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            General Information
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Configuration Name (Optional)"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Overhead 2025"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description (Optional)"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this cost configuration"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Overhead Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography variant="h6">Overhead</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.overhead.enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      overhead: { ...formData.overhead, enabled: e.target.checked },
                    })
                  }
                />
              }
              label={formData.overhead.enabled ? 'Enabled' : 'Disabled'}
            />
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Overhead Rate"
                value={formData.overhead.ratePercent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    overhead: { ...formData.overhead, ratePercent: Number(e.target.value) },
                  })
                }
                disabled={!formData.overhead.enabled}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                inputProps={{
                  min: 0,
                  max: 100,
                  step: 0.1,
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth disabled={!formData.overhead.enabled}>
                <InputLabel>Applied To</InputLabel>
                <Select
                  value={formData.overhead.applicableTo}
                  label="Applied To"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      overhead: {
                        ...formData.overhead,
                        applicableTo: e.target.value as OverheadApplicability,
                      },
                    })
                  }
                >
                  {Object.entries(OVERHEAD_APPLICABILITY_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description (Optional)"
                value={formData.overhead.description || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    overhead: { ...formData.overhead, description: e.target.value },
                  })
                }
                disabled={!formData.overhead.enabled}
                placeholder="e.g., Shop overhead, utilities, and general manufacturing costs"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Contingency Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography variant="h6">Contingency</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.contingency.enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contingency: { ...formData.contingency, enabled: e.target.checked },
                    })
                  }
                />
              }
              label={formData.contingency.enabled ? 'Enabled' : 'Disabled'}
            />
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Contingency Rate"
                value={formData.contingency.ratePercent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contingency: { ...formData.contingency, ratePercent: Number(e.target.value) },
                  })
                }
                disabled={!formData.contingency.enabled}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                inputProps={{
                  min: 0,
                  max: 100,
                  step: 0.1,
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description (Optional)"
                value={formData.contingency.description || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contingency: { ...formData.contingency, description: e.target.value },
                  })
                }
                disabled={!formData.contingency.enabled}
                placeholder="e.g., Buffer for material price fluctuations and unknowns"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Profit Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography variant="h6">Profit Margin</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.profit.enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      profit: { ...formData.profit, enabled: e.target.checked },
                    })
                  }
                />
              }
              label={formData.profit.enabled ? 'Enabled' : 'Disabled'}
            />
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Profit Rate"
                value={formData.profit.ratePercent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    profit: { ...formData.profit, ratePercent: Number(e.target.value) },
                  })
                }
                disabled={!formData.profit.enabled}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                inputProps={{
                  min: 0,
                  max: 100,
                  step: 0.1,
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description (Optional)"
                value={formData.profit.description || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    profit: { ...formData.profit, description: e.target.value },
                  })
                }
                disabled={!formData.profit.enabled}
                placeholder="e.g., Target profit margin for BOM quotations"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button variant="outlined" startIcon={<CancelIcon />} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" startIcon={<SaveIcon />}>
          Save Configuration
        </Button>
      </Box>
    </form>
  );
}
