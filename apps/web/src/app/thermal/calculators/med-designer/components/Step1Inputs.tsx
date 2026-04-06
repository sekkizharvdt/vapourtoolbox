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
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { getSaturationTemperature } from '@vapour/constants';
import type { MEDDesignerResult } from '@/lib/thermal';

interface Step1InputsProps {
  steamFlow: string;
  steamTemp: string;
  swTemp: string;
  numberOfEffects: string;
  numberOfPreheaters: string;
  tvcEnabled: boolean;
  tvcMotivePressure: string;
  tvcSuperheat: string;
  tvcEntrainedEffect: string;
  onSteamFlowChange: (v: string) => void;
  onSteamTempChange: (v: string) => void;
  onSwTempChange: (v: string) => void;
  onNumberOfEffectsChange: (v: string) => void;
  onNumberOfPreheatersChange: (v: string) => void;
  onTvcEnabledChange: (v: boolean) => void;
  onTvcMotivePressureChange: (v: string) => void;
  onTvcSuperheatChange: (v: string) => void;
  onTvcEntrainedEffectChange: (v: string) => void;
  designResult: MEDDesignerResult | null;
  onProceed: () => void;
}

function fmt(v: number, d = 1): string {
  return v.toFixed(d);
}

/**
 * Step 1: Design Inputs
 *
 * User enters steam supply conditions, plant configuration, and optional TVC.
 * A summary card shows the computed performance (GOR, output, etc.).
 */
export function Step1Inputs({
  steamFlow,
  steamTemp,
  swTemp,
  numberOfEffects,
  numberOfPreheaters,
  tvcEnabled,
  tvcMotivePressure,
  tvcSuperheat,
  tvcEntrainedEffect,
  onSteamFlowChange,
  onSteamTempChange,
  onSwTempChange,
  onNumberOfEffectsChange,
  onNumberOfPreheatersChange,
  onTvcEnabledChange,
  onTvcMotivePressureChange,
  onTvcSuperheatChange,
  onTvcEntrainedEffectChange,
  designResult,
  onProceed,
}: Step1InputsProps) {
  const nEff = parseInt(numberOfEffects, 10);
  const nPH = parseInt(numberOfPreheaters, 10);
  const maxPH = isNaN(nEff) ? 0 : Math.max(0, nEff - 2);

  // TVC helper: compute saturation temperature for display
  const motivePressureParsed = parseFloat(tvcMotivePressure);
  const motiveSatTemp =
    !isNaN(motivePressureParsed) && motivePressureParsed > 0
      ? getSaturationTemperature(motivePressureParsed)
      : null;
  const motiveSuperheat = parseFloat(tvcSuperheat) || 0;
  const motiveTemp = motiveSatTemp !== null ? motiveSatTemp + motiveSuperheat : null;

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

        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={tvcEnabled}
              onChange={(e) => onTvcEnabledChange(e.target.checked)}
            />
          }
          label="With Thermo Vapor Compressor (TVC)"
          sx={{ mb: 1 }}
        />

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <TextField
            label="Vapour Flow"
            value={steamFlow}
            onChange={(e) => onSteamFlowChange(e.target.value)}
            type="number"
            helperText={tvcEnabled ? 'Motive steam flow to TVC' : undefined}
            InputProps={{
              endAdornment: <InputAdornment position="end">T/h</InputAdornment>,
            }}
          />
          {tvcEnabled ? (
            <>
              <TextField
                label="Motive Steam Pressure"
                value={tvcMotivePressure}
                onChange={(e) => onTvcMotivePressureChange(e.target.value)}
                type="number"
                helperText={
                  motiveSatTemp !== null
                    ? `T_sat = ${motiveSatTemp.toFixed(1)}\u00B0C${motiveSuperheat > 0 ? ` \u2192 ${motiveTemp!.toFixed(1)}\u00B0C` : ''}`
                    : undefined
                }
                InputProps={{
                  endAdornment: <InputAdornment position="end">bar abs</InputAdornment>,
                }}
              />
              <TextField
                label="Superheat"
                value={tvcSuperheat}
                onChange={(e) => onTvcSuperheatChange(e.target.value)}
                type="number"
                helperText="Above saturation (0 for saturated)"
                InputProps={{
                  endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
                }}
              />
              <TextField
                label="Top Brine Temperature"
                value={steamTemp}
                onChange={(e) => onSteamTempChange(e.target.value)}
                type="number"
                helperText="Effect 1 operating temperature"
                InputProps={{
                  endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
                }}
              />
              <TextField
                label="Entrained Effect"
                value={tvcEntrainedEffect}
                onChange={(e) => onTvcEntrainedEffectChange(e.target.value)}
                type="number"
                placeholder={`Last (E${isNaN(nEff) ? '?' : nEff})`}
                helperText="Which effect supplies vapor to TVC"
                inputProps={{ min: 1, max: isNaN(nEff) ? 12 : nEff }}
                sx={{ width: 160 }}
              />
            </>
          ) : (
            <>
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
            </>
          )}
        </Stack>

        {/* Show seawater temp when TVC is enabled (moved outside the conditional row) */}
        {tvcEnabled && (
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
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
        )}
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
            helperText={`0 to ${maxPH} for ${isNaN(nEff) ? '\u2013' : nEff} effects`}
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
          <Stack direction="row" spacing={4} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
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
            {designResult.tvc && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  TVC Entrainment Ratio
                </Typography>
                <Typography variant="h6">{fmt(designResult.tvc.entrainmentRatio, 2)}</Typography>
              </Box>
            )}
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
