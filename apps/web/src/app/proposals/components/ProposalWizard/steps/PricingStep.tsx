import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { CreateProposalInput, ProposalLineItem } from '@vapour/types';

interface ProposalFormValues extends CreateProposalInput {
  scopeOfSupply: ProposalLineItem[];
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

  // Calculate totals based on Scope of Supply
  const subtotal = scopeOfSupply.reduce((acc: number, item: ProposalLineItem) => {
    return acc + (item.totalPrice?.amount || 0);
  }, 0);

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
              {subtotal.toLocaleString('en-IN', {
                style: 'currency',
                currency: currency,
              })}
            </Typography>
            <Typography variant="caption" display="block" mt={1}>
              * Taxes extra as applicable
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
