'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { Grid, TextField, Typography, Box } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { EntitySelector } from '@/components/common/forms/EntitySelector';

export function BasicInfoStep() {
  const { control } = useFormContext();

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Basic Information
      </Typography>

      <Grid container spacing={3}>
        <Grid size={12}>
          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Proposal Title"
                fullWidth
                required
                error={!!field.value && field.value.length < 3}
                helperText={
                  field.value && field.value.length < 3 ? 'Title must be at least 3 characters' : ''
                }
              />
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Controller
            name="clientId"
            control={control}
            render={({ field }) => (
              <EntitySelector
                value={field.value}
                onChange={field.onChange}
                error={!field.value}
                helperText={!field.value ? 'Client is required' : ''}
              />
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Controller
            name="validityDate"
            control={control}
            render={({ field }) => (
              <DatePicker
                label="Validity Date"
                value={field.value}
                onChange={field.onChange}
                format="dd/MM/yyyy"
                slotProps={{ textField: { fullWidth: true } }}
              />
            )}
          />
        </Grid>

        <Grid size={12}>
          <Controller
            name="paymentTerms"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Payment Terms" fullWidth multiline rows={2} required />
            )}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
