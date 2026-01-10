import React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';

type ProposalFormValues = {
  terms: {
    customTerms: string[];
    warranty?: string;
    performanceBond?: string;
    liquidatedDamages?: string;
    forceMajeure?: string;
  };
};
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemSecondaryAction,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';

export function TermsStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProposalFormValues>();

  // useFieldArray with primitive arrays (string[]) requires 'any' type
  // react-hook-form's typing expects arrays of objects with 'id' property
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { fields, append, remove } = useFieldArray<any>({
    control,
    name: 'terms.customTerms',
  });

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Terms & Conditions
      </Typography>

      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Warranty"
            fullWidth
            multiline
            rows={2}
            {...register('terms.warranty')}
            placeholder="e.g., 12 months from commissioning or 18 months from supply..."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Performance Bond"
            fullWidth
            multiline
            rows={2}
            {...register('terms.performanceBond')}
            placeholder="e.g., 10% of contract value..."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Liquidated Damages"
            fullWidth
            multiline
            rows={2}
            {...register('terms.liquidatedDamages')}
            placeholder="e.g., 0.5% per week of delay..."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Force Majeure"
            fullWidth
            multiline
            rows={2}
            {...register('terms.forceMajeure')}
            placeholder="Standard clause applicable..."
          />
        </Grid>
      </Grid>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1">Custom Terms</Typography>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={() => append('')}>
          Add Term
        </Button>
      </Box>

      {fields.length > 0 ? (
        <Paper variant="outlined">
          <List>
            {fields.map((field, index) => (
              <ListItem key={field.id} divider={index < fields.length - 1}>
                <TextField
                  fullWidth
                  multiline
                  size="small"
                  variant="standard"
                  {...register(`terms.customTerms.${index}`)}
                  placeholder={`Term ${index + 1}`}
                  error={!!errors.terms?.customTerms?.[index]}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" aria-label="delete" onClick={() => remove(index)}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default' }}>
          <Typography color="text.secondary">
            No custom terms added. Add specific terms if required.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
