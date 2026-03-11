'use client';

import {
  TextField,
  InputAdornment,
  Stack,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Box,
} from '@mui/material';
import {
  VALVE_TYPE_LABELS,
  VALVE_CD,
  MODE_LABELS,
  STANDARD_DN_SIZES,
  type ValveType,
  type CalculationMode,
} from '@/lib/thermal/vacuumBreakerCalculator';

interface VacuumBreakerInputsProps {
  calcMode: CalculationMode;
  totalVolume: string;
  numberOfBreakers: string;
  operatingPressure: string;
  ambientTemperature: string;
  equalizationTime: string;
  valveType: ValveType;
  burstPressure: string;
  selectedDN: string;
  maxRiseRate: string;
  onCalcModeChange: (value: CalculationMode) => void;
  onTotalVolumeChange: (value: string) => void;
  onNumberOfBreakersChange: (value: string) => void;
  onOperatingPressureChange: (value: string) => void;
  onAmbientTemperatureChange: (value: string) => void;
  onEqualizationTimeChange: (value: string) => void;
  onValveTypeChange: (value: ValveType) => void;
  onBurstPressureChange: (value: string) => void;
  onSelectedDNChange: (value: string) => void;
  onMaxRiseRateChange: (value: string) => void;
}

export function VacuumBreakerInputs({
  calcMode,
  totalVolume,
  numberOfBreakers,
  operatingPressure,
  ambientTemperature,
  equalizationTime,
  valveType,
  burstPressure,
  selectedDN,
  maxRiseRate,
  onCalcModeChange,
  onTotalVolumeChange,
  onNumberOfBreakersChange,
  onOperatingPressureChange,
  onAmbientTemperatureChange,
  onEqualizationTimeChange,
  onValveTypeChange,
  onBurstPressureChange,
  onSelectedDNChange,
  onMaxRiseRateChange,
}: VacuumBreakerInputsProps) {
  return (
    <Stack spacing={2}>
      {/* Mode Selector */}
      <Typography variant="subtitle2" color="text.secondary">
        Calculation Mode
      </Typography>
      <Box>
        <ToggleButtonGroup
          value={calcMode}
          exclusive
          onChange={(_, v) => v && onCalcModeChange(v)}
          size="small"
          fullWidth
          sx={{ flexWrap: 'wrap' }}
        >
          {(Object.keys(MODE_LABELS) as CalculationMode[]).map((m) => (
            <ToggleButton
              key={m}
              value={m}
              sx={{ textTransform: 'none', fontSize: '0.75rem', py: 1 }}
            >
              {MODE_LABELS[m]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Divider />

      {/* Shared: Vessel Configuration */}
      <Typography variant="subtitle2" color="text.secondary">
        Vessel Configuration
      </Typography>

      <TextField
        label="Total Volume (all effects)"
        value={totalVolume}
        onChange={(e) => onTotalVolumeChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">m&sup3;</InputAdornment>,
        }}
        helperText="Combined volume of all MED effects"
      />

      <TextField
        label="Number of Vacuum Breakers"
        value={numberOfBreakers}
        onChange={(e) => onNumberOfBreakersChange(e.target.value)}
        type="number"
        fullWidth
        helperText="Volume is split equally (typically 2: shell + tube side)"
      />

      <Divider />

      {/* Shared: Operating Conditions */}
      <Typography variant="subtitle2" color="text.secondary">
        Operating Conditions
      </Typography>

      <TextField
        label="Lowest Operating Vacuum Pressure"
        value={operatingPressure}
        onChange={(e) => onOperatingPressureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">mbar abs</InputAdornment>,
        }}
        helperText="Absolute pressure inside MED effects (typical: 50-150 mbar abs)"
      />

      <TextField
        label="Ambient Air Temperature"
        value={ambientTemperature}
        onChange={(e) => onAmbientTemperatureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
        }}
      />

      <Divider />

      {/* Mode-specific inputs */}
      {calcMode === 'MANUAL_VALVE' && (
        <>
          <Typography variant="subtitle2" color="text.secondary">
            Valve Configuration
          </Typography>

          <TextField
            label="Equalization Time"
            value={equalizationTime}
            onChange={(e) => onEqualizationTimeChange(e.target.value)}
            type="number"
            fullWidth
            InputProps={{
              endAdornment: <InputAdornment position="end">minutes</InputAdornment>,
            }}
            helperText="Time to bring vessel to near-atmospheric pressure"
          />

          <FormControl fullWidth>
            <InputLabel>Valve Type</InputLabel>
            <Select
              value={valveType}
              label="Valve Type"
              onChange={(e) => onValveTypeChange(e.target.value as ValveType)}
            >
              {(Object.keys(VALVE_TYPE_LABELS) as ValveType[]).map((vt) => (
                <MenuItem key={vt} value={vt}>
                  {VALVE_TYPE_LABELS[vt]} (C_d = {VALVE_CD[vt]})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      )}

      {calcMode === 'DIAPHRAGM_ANALYSIS' && (
        <>
          <Typography variant="subtitle2" color="text.secondary">
            Diaphragm Configuration
          </Typography>

          <TextField
            label="Diaphragm Burst Pressure"
            value={burstPressure}
            onChange={(e) => onBurstPressureChange(e.target.value)}
            type="number"
            fullWidth
            InputProps={{
              endAdornment: <InputAdornment position="end">mbar abs</InputAdornment>,
            }}
            helperText="Pressure at which the diaphragm ruptures (can be as low as 15 mbar)"
          />

          <FormControl fullWidth>
            <InputLabel>Diaphragm Size (DN)</InputLabel>
            <Select
              value={selectedDN}
              label="Diaphragm Size (DN)"
              onChange={(e) => onSelectedDNChange(e.target.value)}
            >
              {STANDARD_DN_SIZES.map((v) => (
                <MenuItem key={v.dn} value={String(v.dn)}>
                  DN {v.dn} ({v.nps}) &mdash; {v.boreArea} cm&sup2;
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="caption" color="text.secondary">
            C_d = 0.60 (sharp-edged orifice after diaphragm rupture)
          </Typography>
        </>
      )}

      {calcMode === 'DIAPHRAGM_DESIGN' && (
        <>
          <Typography variant="subtitle2" color="text.secondary">
            Diaphragm Design Constraints
          </Typography>

          <TextField
            label="Diaphragm Burst Pressure"
            value={burstPressure}
            onChange={(e) => onBurstPressureChange(e.target.value)}
            type="number"
            fullWidth
            InputProps={{
              endAdornment: <InputAdornment position="end">mbar abs</InputAdornment>,
            }}
            helperText="Pressure at which the diaphragm ruptures (can be as low as 15 mbar)"
          />

          <TextField
            label="Max Allowable Pressure Rise Rate"
            value={maxRiseRate}
            onChange={(e) => onMaxRiseRateChange(e.target.value)}
            type="number"
            fullWidth
            InputProps={{
              endAdornment: <InputAdornment position="end">mbar/s</InputAdornment>,
            }}
            helperText="Limit to prevent mechanical disturbance to tubes with rubber grommets"
          />

          <Typography variant="caption" color="text.secondary">
            C_d = 0.60 (sharp-edged orifice after diaphragm rupture)
          </Typography>
        </>
      )}
    </Stack>
  );
}
