'use client';

import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { Grid, TextField, Typography, Box, Button, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

export function ScopeOfWorkStep() {
  const { control } = useFormContext();

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Scope of Work
      </Typography>

      <Grid container spacing={3}>
        <Grid size={12}>
          <Controller
            name="scopeOfWork.summary"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Executive Summary"
                fullWidth
                multiline
                rows={4}
                placeholder="Provide a high-level summary of the proposed work..."
              />
            )}
          />
        </Grid>

        <Grid size={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            Objectives
          </Typography>
          <DynamicList name="scopeOfWork.objectives" label="Objective" />
        </Grid>

        <Grid size={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            Deliverables
          </Typography>
          <DynamicList name="scopeOfWork.deliverables" label="Deliverable" />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            Inclusions
          </Typography>
          <DynamicList name="scopeOfWork.inclusions" label="Inclusion" />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            Exclusions
          </Typography>
          <DynamicList name="scopeOfWork.exclusions" label="Exclusion" />
        </Grid>

        <Grid size={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            Assumptions
          </Typography>
          <DynamicList name="scopeOfWork.assumptions" label="Assumption" />
        </Grid>
      </Grid>
    </Box>
  );
}

function DynamicList({ name, label }: { name: string; label: string }) {
  const { control, register } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  return (
    <Box>
      {fields.map((field, index) => (
        <Box key={field.id} sx={{ display: 'flex', mb: 1, alignItems: 'flex-start' }}>
          <TextField
            {...register(`${name}.${index}` as const)}
            label={`${label} ${index + 1}`}
            fullWidth
            size="small"
            sx={{ mr: 1 }}
          />
          <IconButton onClick={() => remove(index)} color="error" size="small">
            <DeleteIcon />
          </IconButton>
        </Box>
      ))}
      <Button
        startIcon={<AddIcon />}
        onClick={() => append('')}
        size="small"
        variant="outlined"
        sx={{ mt: 1 }}
      >
        Add {label}
      </Button>
    </Box>
  );
}
