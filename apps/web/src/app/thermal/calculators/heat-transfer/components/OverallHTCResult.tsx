'use client';

import {
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import type { OverallHTCResult as OverallHTCResultType } from '@/lib/thermal';

interface OverallHTCResultProps {
  result: OverallHTCResultType;
}

export function OverallHTCResult({ result }: OverallHTCResultProps) {
  const { resistances } = result;

  const rows = [
    { label: 'Tube-side convection', value: resistances.tubeSide },
    { label: 'Tube-side fouling', value: resistances.tubeSideFouling },
    { label: 'Tube wall', value: resistances.tubeWall },
    { label: 'Shell-side fouling', value: resistances.shellSideFouling },
    { label: 'Shell-side convection', value: resistances.shellSide },
  ];

  const maxResistance = Math.max(...rows.map((r) => r.value));

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Overall HTC Result
      </Typography>

      {/* Primary result: Overall U */}
      <Card
        variant="outlined"
        sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}
      >
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Overall Heat Transfer Coefficient (U_o)
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">{result.overallHTC.toFixed(0)}</Typography>
            <Typography variant="h6">W/(m²·K)</Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Resistance Breakdown */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Thermal Resistance Breakdown
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Component</TableCell>
                <TableCell align="right">Resistance (m²·K/W)</TableCell>
                <TableCell align="right">%</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const pct = resistances.total > 0 ? (row.value / resistances.total) * 100 : 0;
                const isDominant = row.value === maxResistance && row.value > 0;
                return (
                  <TableRow key={row.label}>
                    <TableCell
                      sx={{
                        py: 0.5,
                        fontWeight: isDominant ? 'bold' : 'normal',
                      }}
                    >
                      {row.label}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        py: 0.5,
                        fontFamily: 'monospace',
                        fontWeight: isDominant ? 'bold' : 'normal',
                      }}
                    >
                      {row.value.toFixed(6)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        py: 0.5,
                        fontFamily: 'monospace',
                        fontWeight: isDominant ? 'bold' : 'normal',
                      }}
                    >
                      {pct.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell sx={{ borderTop: 1, borderBottom: 0, py: 0.5, fontWeight: 'bold' }}>
                  Total
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    borderTop: 1,
                    borderBottom: 0,
                    py: 0.5,
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                  }}
                >
                  {resistances.total.toFixed(6)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    borderTop: 1,
                    borderBottom: 0,
                    py: 0.5,
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                  }}
                >
                  100.0%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Formula */}
      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2">
          <strong>Overall HTC (based on outer area):</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          1/U_o = (1/h_i)×(D_o/D_i) + R_fi×(D_o/D_i) + D_o×ln(D_o/D_i)/(2×k_w) + R_fo + 1/h_o
        </Typography>
      </Box>
    </Paper>
  );
}
