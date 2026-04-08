'use client';

import {
  TextField,
  InputAdornment,
  Stack,
  Typography,
  Paper,
  Button,
  Box,
  Checkbox,
  FormControlLabel,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { getSaturationTemperature } from '@vapour/constants';
import type { MEDDesignerResult } from '@/lib/thermal';

interface Step1InputsProps {
  steamFlow: string;
  steamTemp: string;
  swTemp: string;
  swSalinity: string;
  maxBrineSalinity: string;
  numberOfEffects: string;
  condenserApproach: string;
  condenserOutletTemp: string;
  preheaterEffects: number[];
  tvcEnabled: boolean;
  tvcMotivePressure: string;
  tvcSuperheat: string;
  tvcEntrainedEffect: string;
  onSteamFlowChange: (v: string) => void;
  onSteamTempChange: (v: string) => void;
  onSwTempChange: (v: string) => void;
  onSwSalinityChange: (v: string) => void;
  onMaxBrineSalinityChange: (v: string) => void;
  onNumberOfEffectsChange: (v: string) => void;
  onCondenserApproachChange: (v: string) => void;
  onCondenserOutletTempChange: (v: string) => void;
  onTogglePreheater: (effNum: number) => void;
  onTvcEnabledChange: (v: boolean) => void;
  onTvcMotivePressureChange: (v: string) => void;
  onTvcSuperheatChange: (v: string) => void;
  onTvcEntrainedEffectChange: (v: string) => void;
  // Advanced parameters
  tubeMaterial: string;
  nea: string;
  demisterLoss: string;
  ductLoss: string;
  foulingResistance: string;
  designMargin: string;
  onTubeMaterialChange: (v: string) => void;
  onNeaChange: (v: string) => void;
  onDemisterLossChange: (v: string) => void;
  onDuctLossChange: (v: string) => void;
  onFoulingResistanceChange: (v: string) => void;
  onDesignMarginChange: (v: string) => void;
  designResult: MEDDesignerResult | null;
  onProceed: () => void;
}

function fmt(v: number, d = 1): string {
  return v.toFixed(d);
}

/**
 * Step 1: Design Inputs
 *
 * Matches the MED process calculator inputs — steam supply, seawater,
 * condenser, preheaters (per-effect checkboxes), and optional TVC.
 */
export function Step1Inputs({
  steamFlow,
  steamTemp,
  swTemp,
  swSalinity,
  maxBrineSalinity,
  numberOfEffects,
  condenserApproach,
  condenserOutletTemp,
  preheaterEffects,
  tvcEnabled,
  tvcMotivePressure,
  tvcSuperheat,
  tvcEntrainedEffect,
  onSteamFlowChange,
  onSteamTempChange,
  onSwTempChange,
  onSwSalinityChange,
  onMaxBrineSalinityChange,
  onNumberOfEffectsChange,
  onCondenserApproachChange,
  onCondenserOutletTempChange,
  onTogglePreheater,
  onTvcEnabledChange,
  onTvcMotivePressureChange,
  onTvcSuperheatChange,
  onTvcEntrainedEffectChange,
  tubeMaterial,
  nea,
  demisterLoss,
  ductLoss,
  foulingResistance,
  designMargin,
  onTubeMaterialChange,
  onNeaChange,
  onDemisterLossChange,
  onDuctLossChange,
  onFoulingResistanceChange,
  onDesignMarginChange,
  designResult,
  onProceed,
}: Step1InputsProps) {
  const nEff = parseInt(numberOfEffects, 10) || 6;

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
      {/* ── Steam Supply ─────────────────────────────────────────────── */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Steam Supply
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
            size="small"
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
                size="small"
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
                size="small"
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
                size="small"
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
                size="small"
                placeholder={`Last (E${nEff})`}
                helperText="Vapor source for TVC"
                inputProps={{ min: 1, max: nEff }}
                sx={{ width: 150 }}
              />
            </>
          ) : (
            <TextField
              label="Vapour Temperature"
              value={steamTemp}
              onChange={(e) => onSteamTempChange(e.target.value)}
              type="number"
              size="small"
              InputProps={{
                endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
              }}
            />
          )}
        </Stack>
      </Paper>

      {/* ── Seawater & Condenser ─────────────────────────────────────── */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Seawater &amp; Condenser
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <TextField
            label="Seawater Temperature"
            value={swTemp}
            onChange={(e) => onSwTempChange(e.target.value)}
            type="number"
            size="small"
            InputProps={{
              endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
            }}
          />
          <TextField
            label="Seawater Salinity"
            value={swSalinity}
            onChange={(e) => onSwSalinityChange(e.target.value)}
            type="number"
            size="small"
            InputProps={{
              endAdornment: <InputAdornment position="end">ppm</InputAdornment>,
            }}
          />
          <TextField
            label="Max Brine Salinity"
            value={maxBrineSalinity}
            onChange={(e) => onMaxBrineSalinityChange(e.target.value)}
            type="number"
            size="small"
            InputProps={{
              endAdornment: <InputAdornment position="end">ppm</InputAdornment>,
            }}
          />
          <TextField
            label="Condenser Approach"
            value={condenserApproach}
            onChange={(e) => onCondenserApproachChange(e.target.value)}
            type="number"
            size="small"
            InputProps={{
              endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
            }}
          />
          <TextField
            label="SW Outlet Temperature"
            value={condenserOutletTemp}
            onChange={(e) => onCondenserOutletTempChange(e.target.value)}
            type="number"
            size="small"
            placeholder="Auto"
            helperText="Blank = seawater + 5&deg;C"
            InputProps={{
              endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
            }}
          />
        </Stack>
      </Paper>

      {/* ── Plant Configuration ──────────────────────────────────────── */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight={600}>
          Plant Configuration
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            label="Number of Effects"
            value={numberOfEffects}
            onChange={(e) => onNumberOfEffectsChange(e.target.value)}
            type="number"
            size="small"
            inputProps={{ min: 2, max: 12, step: 1 }}
            sx={{ width: 180 }}
          />
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Preheaters
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Select which effects supply vapor to preheaters. E1 vapor cannot be used (heating steam
          condensation). E{nEff} vapor goes to the final condenser.
        </Typography>
        {nEff > 2 ? (
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {Array.from({ length: Math.max(0, nEff - 2) }, (_, i) => i + 2).map((effNum) => (
              <FormControlLabel
                key={effNum}
                control={
                  <Checkbox
                    size="small"
                    checked={preheaterEffects.includes(effNum)}
                    onChange={() => onTogglePreheater(effNum)}
                  />
                }
                label={`E${effNum}`}
                sx={{ mr: 0 }}
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Need at least 3 effects for preheaters.
          </Typography>
        )}

        {/* Preheater performance table — visible when preheaters selected and design computed */}
        {designResult && designResult.preheaters.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Preheater Performance
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Source</TableCell>
                  <TableCell align="right">Vap Temp (&deg;C)</TableCell>
                  <TableCell align="right">SW In (&deg;C)</TableCell>
                  <TableCell align="right">SW Out (&deg;C)</TableCell>
                  <TableCell align="right">&Delta;T Rise</TableCell>
                  <TableCell align="right">LMTD (&deg;C)</TableCell>
                  <TableCell align="right">Duty (kW)</TableCell>
                  <TableCell align="right">SW Flow (T/h)</TableCell>
                  <TableCell align="right">Area (m&sup2;)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {designResult.preheaters.map((ph) => (
                  <TableRow key={ph.id}>
                    <TableCell>{ph.vapourSource}</TableCell>
                    <TableCell align="right">{fmt(ph.vapourTemp)}</TableCell>
                    <TableCell align="right">{fmt(ph.swInlet)}</TableCell>
                    <TableCell align="right">{fmt(ph.swOutlet)}</TableCell>
                    <TableCell align="right">{fmt(ph.swOutlet - ph.swInlet)}</TableCell>
                    <TableCell align="right">{fmt(ph.lmtd)}</TableCell>
                    <TableCell align="right">{Math.round(ph.duty)}</TableCell>
                    <TableCell align="right">{fmt(ph.flowTh)}</TableCell>
                    <TableCell align="right">{fmt(ph.designArea)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Preheaters on later effects (closer to condenser end) improve GOR more — vapor
              diverted from earlier effects loses more cascade steps.
            </Typography>
          </>
        )}
      </Paper>

      {/* ── Advanced Parameters ─────────────────────────────────────── */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Advanced Parameters</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              <TextField
                select
                label="Tube Material"
                value={tubeMaterial}
                onChange={(e) => onTubeMaterialChange(e.target.value)}
                size="small"
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="Al 5052">Al 5052</MenuItem>
                <MenuItem value="Titanium">Titanium</MenuItem>
                <MenuItem value="Cu-Ni 90/10">Cu-Ni 90/10</MenuItem>
                <MenuItem value="Cu-Ni 70/30">Cu-Ni 70/30</MenuItem>
              </TextField>
              <TextField
                label="Design Margin"
                value={designMargin}
                onChange={(e) => onDesignMarginChange(e.target.value)}
                type="number"
                size="small"
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                sx={{ width: 140 }}
              />
              <TextField
                label="Fouling Resistance"
                value={foulingResistance}
                onChange={(e) => onFoulingResistanceChange(e.target.value)}
                type="number"
                size="small"
                helperText="m&sup2;&middot;K/W"
                sx={{ width: 160 }}
              />
            </Stack>
            <Divider />
            <Typography variant="caption" color="text.secondary">
              Temperature losses per effect
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                label="NEA"
                value={nea}
                onChange={(e) => onNeaChange(e.target.value)}
                type="number"
                size="small"
                InputProps={{
                  endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
                }}
                sx={{ width: 120 }}
              />
              <TextField
                label="Demister Loss"
                value={demisterLoss}
                onChange={(e) => onDemisterLossChange(e.target.value)}
                type="number"
                size="small"
                InputProps={{
                  endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
                }}
                sx={{ width: 140 }}
              />
              <TextField
                label="Duct Loss"
                value={ductLoss}
                onChange={(e) => onDuctLossChange(e.target.value)}
                type="number"
                size="small"
                InputProps={{
                  endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
                }}
                sx={{ width: 120 }}
              />
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* ── Performance Summary ───────────────────────────────────────── */}
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
