'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Rating,
} from '@mui/material';
import type { BusinessEntity, OutsourcingVendor } from '@vapour/types';
import type { VendorFormData } from './types';

interface VendorFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  formData: VendorFormData;
  onChange: (field: keyof VendorFormData, value: string | number) => void;
  onVendorEntityChange: (entityId: string) => void;
  selectedVendor: OutsourcingVendor | null;
  vendorEntities: BusinessEntity[];
  loadingEntities: boolean;
  loading: boolean;
}

export function VendorFormDialog({
  open,
  onClose,
  onSubmit,
  formData,
  onChange,
  onVendorEntityChange,
  selectedVendor,
  vendorEntities,
  loadingEntities,
  loading,
}: VendorFormDialogProps) {
  const handleChange =
    (field: keyof VendorFormData) =>
    (
      event:
        | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
        | { target: { value: string } }
    ) => {
      onChange(field, event.target.value);
    };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{selectedVendor ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* Vendor Entity Selector (only when adding new) */}
          {!selectedVendor && (
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Select Vendor Entity (Optional)</InputLabel>
                <Select
                  value={formData.vendorEntityId}
                  label="Select Vendor Entity (Optional)"
                  onChange={(e) => onVendorEntityChange(e.target.value)}
                  disabled={loadingEntities}
                >
                  <MenuItem value="">
                    <em>Enter vendor details manually</em>
                  </MenuItem>
                  {vendorEntities.map((entity) => (
                    <MenuItem key={entity.id} value={entity.id}>
                      {entity.name} - {entity.billingAddress.city}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Vendor Name"
              value={formData.vendorName}
              onChange={handleChange('vendorName')}
              required
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Scope of Work"
              value={formData.scopeOfWork}
              onChange={handleChange('scopeOfWork')}
              multiline
              rows={2}
              required
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Contract Value (INR)"
              type="number"
              value={formData.contractValue}
              onChange={handleChange('contractValue')}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth required>
              <InputLabel>Contract Status</InputLabel>
              <Select
                value={formData.contractStatus}
                label="Contract Status"
                onChange={handleChange('contractStatus')}
              >
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="NEGOTIATION">Negotiation</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="TERMINATED">Terminated</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Contract Start Date"
              type="date"
              value={formData.contractStartDate}
              onChange={handleChange('contractStartDate')}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Contract End Date"
              type="date"
              value={formData.contractEndDate}
              onChange={handleChange('contractEndDate')}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Contact Person"
              value={formData.contactPerson}
              onChange={handleChange('contactPerson')}
              required
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Contact Email"
              type="email"
              value={formData.contactEmail}
              onChange={handleChange('contactEmail')}
              required
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Contact Phone"
              value={formData.contactPhone}
              onChange={handleChange('contactPhone')}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Deliverables"
              value={formData.deliverables}
              onChange={handleChange('deliverables')}
              placeholder="Comma-separated list (e.g., Design docs, Installation, Testing)"
              helperText="Enter deliverables separated by commas"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Box>
              <Typography variant="body2" gutterBottom>
                Performance Rating
              </Typography>
              <Rating
                value={formData.performanceRating}
                onChange={(_, newValue) => {
                  onChange('performanceRating', newValue || 0);
                }}
              />
            </Box>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Notes"
              value={formData.notes}
              onChange={handleChange('notes')}
              multiline
              rows={2}
              placeholder="Additional notes about this vendor"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={onSubmit} variant="contained" disabled={loading}>
          {loading ? 'Saving...' : selectedVendor ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
