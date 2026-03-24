'use client';

import {
  TextField,
  InputAdornment,
  Stack,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Box,
} from '@mui/material';
import type { GORConfigRow } from '@/lib/thermal';

interface Step1InputsProps {
  // Primary inputs
  steamFlow: string;
  steamTemp: string;
  swTemp: string;
  targetGOR: string;
  onSteamFlowChange: (v: string) => void;
  onSteamTempChange: (v: string) => void;
  onSwTempChange: (v: string) => void;
  onTargetGORChange: (v: string) => void;
  // GOR config matrix
  gorConfigs: GORConfigRow[];
  // Selection
  onSelectConfig: (effects: number, preheaters: number) => void;
}

function fmt(v: number, d = 1): string {
  return v.toFixed(d);
}

/**
 * Step 1: Primary Inputs + GOR Configuration Selection
 *
 * User enters 4 values, sees a matrix of effects × preheaters
 * that achieve their target GOR, and clicks one to proceed.
 */
export function Step1Inputs({
  steamFlow,
  steamTemp,
  swTemp,
  targetGOR,
  onSteamFlowChange,
  onSteamTempChange,
  onSwTempChange,
  onTargetGORChange,
  gorConfigs,
  onSelectConfig,
}: Step1InputsProps) {
  const hasInputs =
    parseFloat(steamFlow) > 0 &&
    parseFloat(steamTemp) > 0 &&
    parseFloat(swTemp) > 0 &&
    parseFloat(targetGOR) > 0;

  // Filter configs near target GOR (±1.5)
  const gor = parseFloat(targetGOR) || 6;
  const nearConfigs = gorConfigs.filter((c) => c.feasible && Math.abs(c.gor - gor) <= 1.5);

  // Find the closest match to target GOR
  const closest = nearConfigs.reduce<GORConfigRow | null>(
    (best, c) => (!best || Math.abs(c.gor - gor) < Math.abs(best.gor - gor) ? c : best),
    null
  );

  return (
    <Stack spacing={3}>
      {/* Primary Inputs */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Step 1 — Design Inputs
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter the steam supply conditions and target performance. The calculator will find the
          optimal number of effects and preheaters.
        </Typography>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Vapour Flow"
            value={steamFlow}
            onChange={(e) => onSteamFlowChange(e.target.value)}
            type="number"
            InputProps={{
              endAdornment: <InputAdornment position="end">T/h</InputAdornment>,
            }}
          />
          <TextField
            label="Vapour Temperature"
            value={steamTemp}
            onChange={(e) => onSteamTempChange(e.target.value)}
            type="number"
            InputProps={{
              endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
            }}
          />
          <TextField
            label="Seawater Temperature"
            value={swTemp}
            onChange={(e) => onSwTempChange(e.target.value)}
            type="number"
            InputProps={{
              endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
            }}
          />
          <TextField
            label="Target GOR"
            value={targetGOR}
            onChange={(e) => onTargetGORChange(e.target.value)}
            type="number"
          />
        </Stack>
      </Paper>

      {/* GOR Configuration Matrix */}
      {hasInputs && nearConfigs.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom fontWeight={600}>
            Configurations to Achieve GOR {gor}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a configuration to proceed with the detailed design.
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell align="center">Effects</TableCell>
                <TableCell align="center">Preheaters</TableCell>
                <TableCell align="center">GOR</TableCell>
                <TableCell align="right">Output (m&sup3;/day)</TableCell>
                <TableCell align="right">Feed Temp (&deg;C)</TableCell>
                <TableCell align="right">Work &Delta;T/eff (&deg;C)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {nearConfigs.map((c, i) => {
                const isClosest = c === closest;
                return (
                  <TableRow
                    key={i}
                    hover
                    sx={{
                      cursor: 'pointer',
                      bgcolor: isClosest ? 'action.selected' : undefined,
                    }}
                    onClick={() => onSelectConfig(c.effects, c.preheaters)}
                  >
                    <TableCell>
                      {isClosest ? (
                        <Chip label="Best" size="small" color="success" />
                      ) : (
                        <Chip label="OK" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="center">{c.effects}</TableCell>
                    <TableCell align="center">{c.preheaters}</TableCell>
                    <TableCell align="center">
                      <strong>{fmt(c.gor)}</strong>
                    </TableCell>
                    <TableCell align="right">{Math.round(c.outputM3Day)}</TableCell>
                    <TableCell align="right">{fmt(c.feedTemp)}&deg;C</TableCell>
                    <TableCell align="right">{fmt(c.workDTPerEffect, 2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Click a row to select that configuration and proceed to geometry design.
            </Typography>
          </Box>
        </Paper>
      )}
    </Stack>
  );
}
