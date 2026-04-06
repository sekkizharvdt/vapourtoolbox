'use client';

import {
  TextField,
  InputAdornment,
  Stack,
  Typography,
  Paper,
  Button,
  Box,
  Alert,
} from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import type { MEDDesignerResult } from '@/lib/thermal';

interface Step1InputsProps {
  steamFlow: string;
  steamTemp: string;
  swTemp: string;
  numberOfEffects: string;
  numberOfPreheaters: string;
  onSteamFlowChange: (v: string) => void;
  onSteamTempChange: (v: string) => void;
  onSwTempChange: (v: string) => void;
  onNumberOfEffectsChange: (v: string) => void;
  onNumberOfPreheatersChange: (v: string) => void;
  designResult: MEDDesignerResult | null;
  onProceed: () => void;
}

function fmt(v: number, d = 1): string {
  return v.toFixed(d);
}

/**
 * Step 1: Design Inputs
 *
 * User enters steam supply conditions and plant configuration.
 * A summary card shows the computed performance (GOR, output, etc.).
 */
export function Step1Inputs({
  steamFlow,
  steamTemp,
  swTemp,
  numberOfEffects,
  numberOfPreheaters,
  onSteamFlowChange,
  onSteamTempChange,
  onSwTempChange,
  onNumberOfEffectsChange,
  onNumberOfPreheatersChange,
  designResult,
  onProceed,
}: Step1InputsProps) {
  const nEff = parseInt(numberOfEffects, 10);
  const nPH = parseInt(numberOfPreheaters, 10);
  const maxPH = isNaN(nEff) ? 0 : Math.max(0, nEff - 2);

  return (
    <Stack spacing={3}>
      {/* Steam Supply */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Steam Supply
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter the heating steam conditions available for the MED plant.
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
        </Stack>
      </Paper>

      {/* Plant Configuration */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Plant Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select the number of effects and preheaters for the MED plant.
        </Typography>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Number of Effects"
            value={numberOfEffects}
            onChange={(e) => onNumberOfEffectsChange(e.target.value)}
            type="number"
            inputProps={{ min: 2, max: 12, step: 1 }}
            sx={{ width: 180 }}
          />
          <TextField
            label="Number of Preheaters"
            value={numberOfPreheaters}
            onChange={(e) => onNumberOfPreheatersChange(e.target.value)}
            type="number"
            inputProps={{ min: 0, max: maxPH, step: 1 }}
            helperText={`0 to ${maxPH} for ${isNaN(nEff) ? '–' : nEff} effects`}
            sx={{ width: 180 }}
          />
        </Stack>
        {!isNaN(nPH) && nPH > maxPH && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Maximum {maxPH} preheaters for {nEff} effects (preheaters must be &le; effects &minus;
            2).
          </Alert>
        )}
      </Paper>

      {/* Performance Summary */}
      {designResult && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom fontWeight={600}>
            Performance Summary
          </Typography>
          <Stack direction="row" spacing={4} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                GOR
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {fmt(designResult.achievedGOR)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Distillate Output
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {Math.round(designResult.totalDistillateM3Day)} m&sup3;/day
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Total Distillate
              </Typography>
              <Typography variant="h6">{fmt(designResult.totalDistillate, 2)} T/h</Typography>
            </Box>
            {designResult.preheaters.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Feed Temperature
                </Typography>
                <Typography variant="h6">
                  {fmt(designResult.preheaters[designResult.preheaters.length - 1]!.swOutlet)}
                  &deg;C
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary">
                Work &Delta;T / Effect
              </Typography>
              <Typography variant="h6">
                {fmt(designResult.effects[0]?.workingDeltaT ?? 0, 2)}&deg;C
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={onProceed}>
              Proceed to Equipment &amp; Geometry
            </Button>
          </Box>
        </Paper>
      )}
    </Stack>
  );
}
