'use client';

/**
 * ShapeCalculationResults Component
 *
 * Displays the calculated results for a shape including weight, surface area,
 * cost breakdown, and other calculated values.
 */

import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Stack,
  Collapse,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useState } from 'react';
import type { CurrencyCode } from '@vapour/types';

interface CalculatedValues {
  volume: number;
  weight: number;
  surfaceArea?: number;
  innerSurfaceArea?: number;
  outerSurfaceArea?: number;
  blankArea?: number;
  finishedArea?: number;
  scrapPercentage?: number;
  scrapWeight?: number;
  edgeLength?: number;
  weldLength?: number;
  perimeter?: number;
}

interface CostEstimate {
  materialCost: number;
  materialCostActual: number;
  scrapRecoveryValue: number;
  fabricationCost: number;
  surfaceTreatmentCost: number;
  edgePreparationCost: number;
  cuttingCost: number;
  weldingCost: number;
  totalCost: number;
  currency: CurrencyCode;
  effectiveCostPerKg: number;
}

interface ShapeCalculationResultsProps {
  calculatedValues: CalculatedValues;
  costEstimate: CostEstimate;
  quantity: number;
  totalWeight: number;
  totalCost: number;
  compact?: boolean;
}

export default function ShapeCalculationResults({
  calculatedValues,
  costEstimate,
  quantity,
  totalWeight: _totalWeight,
  totalCost,
  compact = false,
}: ShapeCalculationResultsProps) {
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  const formatNumber = (value: number, decimals = 2) => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const formatCurrency = (value: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (compact) {
    return (
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Chip
            label={`Weight: ${formatNumber(calculatedValues.weight)} kg`}
            color="primary"
            variant="outlined"
          />
          <Chip
            label={`Unit Cost: ${formatCurrency(costEstimate.totalCost, costEstimate.currency)}`}
            color="success"
            variant="outlined"
          />
          {quantity > 1 && (
            <>
              <Chip label={`Qty: ${quantity}`} variant="outlined" />
              <Chip
                label={`Total: ${formatCurrency(totalCost, costEstimate.currency)}`}
                color="success"
              />
            </>
          )}
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        Calculation Results
      </Typography>

      {/* Key Results */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 2,
          mb: 2,
        }}
      >
        <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Unit Weight
          </Typography>
          <Typography variant="h6">{formatNumber(calculatedValues.weight)} kg</Typography>
        </Paper>

        {calculatedValues.surfaceArea && (
          <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Surface Area
            </Typography>
            <Typography variant="h6">
              {formatNumber(calculatedValues.surfaceArea / 1000000, 3)} m²
            </Typography>
          </Paper>
        )}

        <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Unit Cost
          </Typography>
          <Typography variant="h6" color="success.main">
            {formatCurrency(costEstimate.totalCost, costEstimate.currency)}
          </Typography>
        </Paper>

        {quantity > 1 && (
          <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', bgcolor: 'primary.50' }}>
            <Typography variant="caption" color="text.secondary">
              Total ({quantity} pcs)
            </Typography>
            <Typography variant="h6" color="primary.main">
              {formatCurrency(totalCost, costEstimate.currency)}
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Additional Values */}
      {(calculatedValues.scrapPercentage !== undefined || calculatedValues.weldLength) && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            Additional Calculations
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {calculatedValues.scrapPercentage !== undefined && (
              <Chip
                label={`Scrap: ${formatNumber(calculatedValues.scrapPercentage, 1)}%`}
                size="small"
                variant="outlined"
              />
            )}
            {calculatedValues.weldLength && (
              <Chip
                label={`Weld Length: ${formatNumber(calculatedValues.weldLength / 1000, 2)} m`}
                size="small"
                variant="outlined"
              />
            )}
            {calculatedValues.perimeter && (
              <Chip
                label={`Perimeter: ${formatNumber(calculatedValues.perimeter / 1000, 2)} m`}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>
        </Box>
      )}

      {/* Cost Breakdown (Expandable) */}
      <Box>
        <Box
          onClick={() => setShowCostBreakdown(!showCostBreakdown)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' },
            borderRadius: 1,
            p: 0.5,
            mx: -0.5,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Cost Breakdown
          </Typography>
          <IconButton size="small">
            {showCostBreakdown ? (
              <ExpandLessIcon fontSize="small" />
            ) : (
              <ExpandMoreIcon fontSize="small" />
            )}
          </IconButton>
        </Box>

        <Collapse in={showCostBreakdown}>
          <Table size="small" sx={{ mt: 1 }}>
            <TableBody>
              <TableRow>
                <TableCell sx={{ py: 0.5 }}>Material Cost (finished)</TableCell>
                <TableCell align="right" sx={{ py: 0.5 }}>
                  {formatCurrency(costEstimate.materialCost, costEstimate.currency)}
                </TableCell>
              </TableRow>
              {costEstimate.materialCostActual > costEstimate.materialCost && (
                <>
                  <TableRow>
                    <TableCell sx={{ py: 0.5 }}>Material Cost (blank)</TableCell>
                    <TableCell align="right" sx={{ py: 0.5 }}>
                      {formatCurrency(costEstimate.materialCostActual, costEstimate.currency)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ py: 0.5, color: 'success.main' }}>Scrap Recovery</TableCell>
                    <TableCell align="right" sx={{ py: 0.5, color: 'success.main' }}>
                      -{formatCurrency(costEstimate.scrapRecoveryValue, costEstimate.currency)}
                    </TableCell>
                  </TableRow>
                </>
              )}
              {costEstimate.cuttingCost > 0 && (
                <TableRow>
                  <TableCell sx={{ py: 0.5 }}>Cutting</TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>
                    {formatCurrency(costEstimate.cuttingCost, costEstimate.currency)}
                  </TableCell>
                </TableRow>
              )}
              {costEstimate.edgePreparationCost > 0 && (
                <TableRow>
                  <TableCell sx={{ py: 0.5 }}>Edge Preparation</TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>
                    {formatCurrency(costEstimate.edgePreparationCost, costEstimate.currency)}
                  </TableCell>
                </TableRow>
              )}
              {costEstimate.weldingCost > 0 && (
                <TableRow>
                  <TableCell sx={{ py: 0.5 }}>Welding</TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>
                    {formatCurrency(costEstimate.weldingCost, costEstimate.currency)}
                  </TableCell>
                </TableRow>
              )}
              {costEstimate.surfaceTreatmentCost > 0 && (
                <TableRow>
                  <TableCell sx={{ py: 0.5 }}>Surface Treatment</TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>
                    {formatCurrency(costEstimate.surfaceTreatmentCost, costEstimate.currency)}
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell sx={{ py: 0.5, fontWeight: 'bold' }}>Total</TableCell>
                <TableCell align="right" sx={{ py: 0.5, fontWeight: 'bold' }}>
                  {formatCurrency(costEstimate.totalCost, costEstimate.currency)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ py: 0.5, color: 'text.secondary' }}>Effective Rate</TableCell>
                <TableCell align="right" sx={{ py: 0.5, color: 'text.secondary' }}>
                  {formatCurrency(costEstimate.effectiveCostPerKg, costEstimate.currency)}/kg
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Collapse>
      </Box>
    </Paper>
  );
}
