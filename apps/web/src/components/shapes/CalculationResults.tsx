'use client';

import {
  Box,
  Grid,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
} from '@mui/material';
import { Warning as WarningIcon, Error as ErrorIcon } from '@mui/icons-material';

interface CalculationResultsProps {
  result: any;
}

export default function CalculationResults({ result }: CalculationResultsProps) {
  const formatNumber = (value: number | undefined, decimals = 2) => {
    if (value === undefined) return 'N/A';
    return value.toFixed(decimals);
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return `₹${value.toFixed(2)}`;
  };

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.50' }}>
            <Typography variant="caption" color="text.secondary">
              Weight
            </Typography>
            <Typography variant="h5">
              {formatNumber(result.weight)} {result.weightUnit}
            </Typography>
            {result.totalWeight && result.quantity > 1 && (
              <Typography variant="caption" color="text.secondary">
                Total: {formatNumber(result.totalWeight)} {result.weightUnit}
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
            <Typography variant="caption" color="text.secondary">
              Total Cost
            </Typography>
            <Typography variant="h5">{formatCurrency(result.totalCost)}</Typography>
            {result.quantity > 1 && (
              <Typography variant="caption" color="text.secondary">
                Per unit: {formatCurrency(result.costPerUnit)}
              </Typography>
            )}
          </Paper>
        </Grid>

        {result.volume && (
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.50' }}>
              <Typography variant="caption" color="text.secondary">
                Volume
              </Typography>
              <Typography variant="h5">{formatNumber(result.volume / 1000000)} L</Typography>
            </Paper>
          </Grid>
        )}

        {result.surfaceArea && (
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50' }}>
              <Typography variant="caption" color="text.secondary">
                Surface Area
              </Typography>
              <Typography variant="h5">
                {formatNumber(result.surfaceArea / 1000000, 3)} m²
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Warnings and Errors */}
      {result.warnings && result.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
          <Typography variant="subtitle2">Warnings:</Typography>
          {result.warnings.map((warning: string, index: number) => (
            <Typography key={index} variant="body2">
              • {warning}
            </Typography>
          ))}
        </Alert>
      )}

      {result.errors && result.errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }} icon={<ErrorIcon />}>
          <Typography variant="subtitle2">Errors:</Typography>
          {result.errors.map((error: string, index: number) => (
            <Typography key={index} variant="body2">
              • {error}
            </Typography>
          ))}
        </Alert>
      )}

      {/* Detailed Results */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Detailed Calculations
      </Typography>

      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Parameter</TableCell>
              <TableCell align="right">Value</TableCell>
              <TableCell>Unit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Dimensional Results */}
            {result.volume !== undefined && (
              <TableRow>
                <TableCell>Volume</TableCell>
                <TableCell align="right">{formatNumber(result.volume)}</TableCell>
                <TableCell>{result.volumeUnit}</TableCell>
              </TableRow>
            )}

            {result.surfaceArea !== undefined && (
              <TableRow>
                <TableCell>Total Surface Area</TableCell>
                <TableCell align="right">{formatNumber(result.surfaceArea)}</TableCell>
                <TableCell>{result.surfaceAreaUnit}</TableCell>
              </TableRow>
            )}

            {result.innerSurfaceArea !== undefined && (
              <TableRow>
                <TableCell>Inner Surface Area</TableCell>
                <TableCell align="right">{formatNumber(result.innerSurfaceArea)}</TableCell>
                <TableCell>{result.surfaceAreaUnit}</TableCell>
              </TableRow>
            )}

            {result.outerSurfaceArea !== undefined && (
              <TableRow>
                <TableCell>Outer Surface Area</TableCell>
                <TableCell align="right">{formatNumber(result.outerSurfaceArea)}</TableCell>
                <TableCell>{result.surfaceAreaUnit}</TableCell>
              </TableRow>
            )}

            {/* Weight Results */}
            {result.weight !== undefined && (
              <TableRow>
                <TableCell>Unit Weight</TableCell>
                <TableCell align="right">{formatNumber(result.weight)}</TableCell>
                <TableCell>{result.weightUnit}</TableCell>
              </TableRow>
            )}

            {result.totalWeight !== undefined && result.quantity > 1 && (
              <TableRow>
                <TableCell>Total Weight (Qty: {result.quantity})</TableCell>
                <TableCell align="right">{formatNumber(result.totalWeight)}</TableCell>
                <TableCell>{result.weightUnit}</TableCell>
              </TableRow>
            )}

            {/* Blank Material */}
            {result.blankArea !== undefined && (
              <>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell colSpan={3}>
                    <Typography variant="subtitle2">Blank Material</Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Blank Area</TableCell>
                  <TableCell align="right">{formatNumber(result.blankArea)}</TableCell>
                  <TableCell>{result.blankAreaUnit}</TableCell>
                </TableRow>
              </>
            )}

            {result.scrapPercentage !== undefined && (
              <TableRow>
                <TableCell>Scrap Percentage</TableCell>
                <TableCell align="right">{formatNumber(result.scrapPercentage)}</TableCell>
                <TableCell>%</TableCell>
              </TableRow>
            )}

            {/* Edge and Weld */}
            {result.edgeLength !== undefined && (
              <TableRow>
                <TableCell>Edge Length</TableCell>
                <TableCell align="right">{formatNumber(result.edgeLength)}</TableCell>
                <TableCell>{result.edgeLengthUnit}</TableCell>
              </TableRow>
            )}

            {result.weldLength !== undefined && (
              <TableRow>
                <TableCell>Weld Length</TableCell>
                <TableCell align="right">{formatNumber(result.weldLength)}</TableCell>
                <TableCell>{result.weldLengthUnit}</TableCell>
              </TableRow>
            )}

            {/* Cost Breakdown */}
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell colSpan={3}>
                <Typography variant="subtitle2">Cost Breakdown</Typography>
              </TableCell>
            </TableRow>

            {result.materialCost !== undefined && (
              <TableRow>
                <TableCell>Material Cost</TableCell>
                <TableCell align="right">{formatNumber(result.materialCost)}</TableCell>
                <TableCell>₹</TableCell>
              </TableRow>
            )}

            {result.fabricationCost !== undefined && result.fabricationCost > 0 && (
              <TableRow>
                <TableCell>Fabrication Cost</TableCell>
                <TableCell align="right">{formatNumber(result.fabricationCost)}</TableCell>
                <TableCell>₹</TableCell>
              </TableRow>
            )}

            {result.edgePreparationCost !== undefined && result.edgePreparationCost > 0 && (
              <TableRow>
                <TableCell sx={{ pl: 4 }}>• Edge Preparation</TableCell>
                <TableCell align="right">{formatNumber(result.edgePreparationCost)}</TableCell>
                <TableCell>₹</TableCell>
              </TableRow>
            )}

            {result.cuttingCost !== undefined && result.cuttingCost > 0 && (
              <TableRow>
                <TableCell sx={{ pl: 4 }}>• Cutting</TableCell>
                <TableCell align="right">{formatNumber(result.cuttingCost)}</TableCell>
                <TableCell>₹</TableCell>
              </TableRow>
            )}

            {result.weldingCost !== undefined && result.weldingCost > 0 && (
              <TableRow>
                <TableCell sx={{ pl: 4 }}>• Welding</TableCell>
                <TableCell align="right">{formatNumber(result.weldingCost)}</TableCell>
                <TableCell>₹</TableCell>
              </TableRow>
            )}

            {result.surfaceTreatmentCost !== undefined && result.surfaceTreatmentCost > 0 && (
              <TableRow>
                <TableCell sx={{ pl: 4 }}>• Surface Treatment</TableCell>
                <TableCell align="right">{formatNumber(result.surfaceTreatmentCost)}</TableCell>
                <TableCell>₹</TableCell>
              </TableRow>
            )}

            <TableRow sx={{ bgcolor: 'primary.50' }}>
              <TableCell>
                <strong>Total Cost</strong>
              </TableCell>
              <TableCell align="right">
                <strong>{formatNumber(result.totalCost)}</strong>
              </TableCell>
              <TableCell>
                <strong>₹</strong>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Custom Formula Results */}
      {result.customResults && Object.keys(result.customResults).length > 0 && (
        <>
          <Typography variant="h6" gutterBottom>
            Additional Calculations
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Parameter</TableCell>
                  <TableCell align="right">Value</TableCell>
                  <TableCell>Unit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(result.customResults).map(([key, value]: [string, any]) => (
                  <TableRow key={key}>
                    <TableCell>{key}</TableCell>
                    <TableCell align="right">{formatNumber(value.result)}</TableCell>
                    <TableCell>{value.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
