import React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { CreateProposalInput } from '@vapour/types';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
  InputAdornment,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';

export function DeliveryTimelineStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<CreateProposalInput>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'deliveryPeriod.milestones',
  });

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Delivery & Timeline
      </Typography>

      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label="Total Duration (Weeks)"
            type="number"
            fullWidth
            {...register('deliveryPeriod.durationInWeeks', { valueAsNumber: true })}
            error={!!errors.deliveryPeriod?.durationInWeeks}
            helperText={errors.deliveryPeriod?.durationInWeeks?.message}
            InputProps={{
              endAdornment: <InputAdornment position="end">Weeks</InputAdornment>,
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <TextField
            label="Delivery Description"
            fullWidth
            multiline
            rows={2}
            {...register('deliveryPeriod.description')}
            error={!!errors.deliveryPeriod?.description}
            helperText={errors.deliveryPeriod?.description?.message}
            placeholder="e.g., Delivery will commence 2 weeks after receipt of advance payment..."
          />
        </Grid>
      </Grid>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1">Project Milestones</Typography>
        <Button
          startIcon={<AddIcon />}
          variant="outlined"
          onClick={() =>
            append({
              id: crypto.randomUUID(),
              milestoneNumber: fields.length + 1,
              description: '',
              deliverable: '',
              durationInWeeks: 1,
              paymentPercentage: 0,
            })
          }
        >
          Add Milestone
        </Button>
      </Box>

      {fields.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width="5%">#</TableCell>
                <TableCell width="30%">Description</TableCell>
                <TableCell width="30%">Deliverable</TableCell>
                <TableCell width="15%">Duration (Wks)</TableCell>
                <TableCell width="15%">Payment %</TableCell>
                <TableCell width="5%"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      size="small"
                      variant="standard"
                      {...register(`deliveryPeriod.milestones.${index}.description`)}
                      error={!!errors.deliveryPeriod?.milestones?.[index]?.description}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      size="small"
                      variant="standard"
                      {...register(`deliveryPeriod.milestones.${index}.deliverable`)}
                      error={!!errors.deliveryPeriod?.milestones?.[index]?.deliverable}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      fullWidth
                      size="small"
                      variant="standard"
                      {...register(`deliveryPeriod.milestones.${index}.durationInWeeks`, {
                        valueAsNumber: true,
                      })}
                      error={!!errors.deliveryPeriod?.milestones?.[index]?.durationInWeeks}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      fullWidth
                      size="small"
                      variant="standard"
                      {...register(`deliveryPeriod.milestones.${index}.paymentPercentage`, {
                        valueAsNumber: true,
                      })}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" color="error" onClick={() => remove(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default' }}>
          <Typography color="text.secondary">
            No milestones defined. Add milestones to break down the project timeline.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
