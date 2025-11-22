import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { CreateProposalInput, ProposalLineItem } from '@vapour/types';

interface ProposalFormValues extends CreateProposalInput {
  scopeOfSupply: ProposalLineItem[];
  overheadPercentage?: number;
  contingencyPercentage?: number;
  profitMarginPercentage?: number;
}
import {
  Box,
  Typography,
  TextField,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  InputAdornment,
} from '@mui/material';

export function PricingStep() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProposalFormValues>();

  const scopeOfSupply = useWatch({
    control,
    name: 'scopeOfSupply',
    defaultValue: [],
  });

  const overheadPercentage = useWatch({
    control,
    name: 'overheadPercentage',
    defaultValue: 0,
  });

  const contingencyPercentage = useWatch({
    control,
    name: 'contingencyPercentage',
    defaultValue: 0,
  });

  const profitMarginPercentage = useWatch({
    control,
    name: 'profitMarginPercentage',
    defaultValue: 0,
  });

  // Calculate totals based on Scope of Supply
  const subtotal = scopeOfSupply.reduce((acc: number, item: ProposalLineItem) => {
    return acc + (item.totalPrice?.amount || 0);
  }, 0);

  // Calculate overhead, contingency, and profit
  const overhead = (subtotal * (overheadPercentage || 0)) / 100;
  const contingency = (subtotal * (contingencyPercentage || 0)) / 100;
  const subtotalWithAddOns = subtotal + overhead + contingency;
  const profit = (subtotalWithAddOns * (profitMarginPercentage || 0)) / 100;
  const total = subtotalWithAddOns + profit;

  // Assuming INR for now as per previous steps
  const currency = scopeOfSupply[0]?.totalPrice?.currency || 'INR';

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Pricing & Payment Terms
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Price Breakdown (from Scope of Supply)
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="right">Total Price</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scopeOfSupply.map((item: ProposalLineItem, index: number) => (
                    <TableRow key={index}>
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">
                        {item.unitPrice?.amount?.toLocaleString('en-IN', {
                          style: 'currency',
                          currency: item.unitPrice?.currency || 'INR',
                        })}
                      </TableCell>
                      <TableCell align="right">
                        {item.totalPrice?.amount?.toLocaleString('en-IN', {
                          style: 'currency',
                          currency: item.totalPrice?.currency || 'INR',
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>
                      Subtotal
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {subtotal.toLocaleString('en-IN', {
                        style: 'currency',
                        currency: currency,
                      })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Cost Configuration
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Overhead"
                  type="number"
                  fullWidth
                  size="small"
                  {...register('overheadPercentage', { valueAsNumber: true })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  helperText={
                    overheadPercentage
                      ? `₹${overhead.toLocaleString('en-IN', {
                          maximumFractionDigits: 2,
                        })}`
                      : 'Optional'
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Contingency"
                  type="number"
                  fullWidth
                  size="small"
                  {...register('contingencyPercentage', { valueAsNumber: true })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  helperText={
                    contingencyPercentage
                      ? `₹${contingency.toLocaleString('en-IN', {
                          maximumFractionDigits: 2,
                        })}`
                      : 'Optional'
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Profit Margin"
                  type="number"
                  fullWidth
                  size="small"
                  {...register('profitMarginPercentage', { valueAsNumber: true })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  helperText={
                    profitMarginPercentage
                      ? `₹${profit.toLocaleString('en-IN', {
                          maximumFractionDigits: 2,
                        })}`
                      : 'Optional'
                  }
                />
              </Grid>
            </Grid>

            {((overheadPercentage || 0) > 0 ||
              (contingencyPercentage || 0) > 0 ||
              (profitMarginPercentage || 0) > 0) && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Cost Breakdown:
                </Typography>
                <Grid container spacing={1} sx={{ fontSize: '0.875rem' }}>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2">Subtotal:</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2" align="right">
                      {subtotal.toLocaleString('en-IN', {
                        style: 'currency',
                        currency: currency,
                      })}
                    </Typography>
                  </Grid>
                  {(overheadPercentage || 0) > 0 && (
                    <>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="body2">
                          Overhead ({overheadPercentage || 0}%):
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="body2" align="right">
                          {overhead.toLocaleString('en-IN', {
                            style: 'currency',
                            currency: currency,
                          })}
                        </Typography>
                      </Grid>
                    </>
                  )}
                  {(contingencyPercentage || 0) > 0 && (
                    <>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="body2">
                          Contingency ({contingencyPercentage || 0}%):
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="body2" align="right">
                          {contingency.toLocaleString('en-IN', {
                            style: 'currency',
                            currency: currency,
                          })}
                        </Typography>
                      </Grid>
                    </>
                  )}
                  {(profitMarginPercentage || 0) > 0 && (
                    <>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="body2">
                          Profit Margin ({profitMarginPercentage || 0}%):
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="body2" align="right">
                          {profit.toLocaleString('en-IN', {
                            style: 'currency',
                            currency: currency,
                          })}
                        </Typography>
                      </Grid>
                    </>
                  )}
                </Grid>
              </Box>
            )}
          </Paper>

          <TextField
            label="Payment Terms"
            fullWidth
            multiline
            rows={4}
            {...register('paymentTerms')}
            error={!!errors.paymentTerms}
            helperText={errors.paymentTerms?.message}
            placeholder="e.g., 30% Advance, 60% against Proforma Invoice, 10% after commissioning..."
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            variant="outlined"
            sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}
          >
            <Typography variant="subtitle2">Total Proposal Value</Typography>
            <Typography variant="h4" fontWeight="bold">
              {total.toLocaleString('en-IN', {
                style: 'currency',
                currency: currency,
              })}
            </Typography>
            {((overheadPercentage || 0) > 0 ||
              (contingencyPercentage || 0) > 0 ||
              (profitMarginPercentage || 0) > 0) && (
              <Typography variant="caption" display="block" mt={1}>
                Base: {subtotal.toLocaleString('en-IN', { style: 'currency', currency: currency })}
              </Typography>
            )}
            <Typography variant="caption" display="block" mt={1}>
              * Taxes extra as applicable
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
