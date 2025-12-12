'use client';

import {
  Box,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
} from '@mui/material';
import type { Project, ThermalDesalSpecs } from '@vapour/types';

interface ThermalDesalSpecsViewProps {
  specs: NonNullable<Project['technicalSpecs']>['thermalDesalSpecs'];
}

export function ThermalDesalSpecsView({ specs }: ThermalDesalSpecsViewProps) {
  if (!specs) return null;

  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          Thermal Desalination Specifications
        </Typography>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <Typography variant="body2" color="text.secondary">
          Technology
        </Typography>
        <Typography variant="body1" fontWeight="medium">
          {specs.technology}
        </Typography>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <Typography variant="body2" color="text.secondary">
          Capacity
        </Typography>
        <Typography variant="body1" fontWeight="medium">
          {specs.capacity.value} {specs.capacity.unit === 'M3_PER_DAY' ? 'm³/day' : 'gallons/day'}
        </Typography>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <Typography variant="body2" color="text.secondary">
          Feed Water Source
        </Typography>
        <Typography variant="body1" fontWeight="medium">
          {specs.feedWaterSource || 'Not specified'}
        </Typography>
      </Grid>

      {specs.energySource && (
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Typography variant="body2" color="text.secondary">
            Energy Source
          </Typography>
          <Typography variant="body1" fontWeight="medium">
            {specs.energySource}
          </Typography>
        </Grid>
      )}

      {specs.operatingTemperature && (
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Typography variant="body2" color="text.secondary">
            Operating Temperature
          </Typography>
          <Typography variant="body1" fontWeight="medium">
            {specs.operatingTemperature.min}°{' '}
            {specs.operatingTemperature.unit === 'CELSIUS' ? 'C' : 'F'} to{' '}
            {specs.operatingTemperature.max}°{' '}
            {specs.operatingTemperature.unit === 'CELSIUS' ? 'C' : 'F'}
          </Typography>
        </Grid>
      )}

      {specs.complianceStandards && specs.complianceStandards.length > 0 && (
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Compliance Standards
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {specs.complianceStandards.map((standard, idx) => (
              <Chip key={idx} label={standard} size="small" />
            ))}
          </Box>
        </Grid>
      )}
    </>
  );
}

interface ThermalDesalSpecsEditProps {
  desalTechnology: ThermalDesalSpecs['technology'];
  setDesalTechnology: (value: ThermalDesalSpecs['technology']) => void;
  capacityValue: string;
  setCapacityValue: (value: string) => void;
  capacityUnit: 'M3_PER_DAY' | 'GALLONS_PER_DAY';
  setCapacityUnit: (value: 'M3_PER_DAY' | 'GALLONS_PER_DAY') => void;
  feedWaterSource: string;
  setFeedWaterSource: (value: string) => void;
  energySource: string;
  setEnergySource: (value: string) => void;
  minTemp: string;
  setMinTemp: (value: string) => void;
  maxTemp: string;
  setMaxTemp: (value: string) => void;
  tempUnit: 'CELSIUS' | 'FAHRENHEIT';
  setTempUnit: (value: 'CELSIUS' | 'FAHRENHEIT') => void;
  complianceStandards: string;
  setComplianceStandards: (value: string) => void;
}

export function ThermalDesalSpecsEdit({
  desalTechnology,
  setDesalTechnology,
  capacityValue,
  setCapacityValue,
  capacityUnit,
  setCapacityUnit,
  feedWaterSource,
  setFeedWaterSource,
  energySource,
  setEnergySource,
  minTemp,
  setMinTemp,
  maxTemp,
  setMaxTemp,
  tempUnit,
  setTempUnit,
  complianceStandards,
  setComplianceStandards,
}: ThermalDesalSpecsEditProps) {
  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          Thermal Desalination Specifications
        </Typography>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth required>
          <InputLabel>Technology</InputLabel>
          <Select
            value={desalTechnology}
            label="Technology"
            onChange={(e) => setDesalTechnology(e.target.value as ThermalDesalSpecs['technology'])}
          >
            <MenuItem value="MSF">MSF (Multi-Stage Flash)</MenuItem>
            <MenuItem value="MED">MED (Multi-Effect Distillation)</MenuItem>
            <MenuItem value="RO">RO (Reverse Osmosis)</MenuItem>
            <MenuItem value="HYBRID">Hybrid</MenuItem>
            <MenuItem value="OTHER">Other</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 3 }}>
        <TextField
          fullWidth
          label="Capacity"
          type="number"
          value={capacityValue}
          onChange={(e) => setCapacityValue(e.target.value)}
          required
        />
      </Grid>

      <Grid size={{ xs: 12, md: 3 }}>
        <FormControl fullWidth required>
          <InputLabel>Unit</InputLabel>
          <Select
            value={capacityUnit}
            label="Unit"
            onChange={(e) => setCapacityUnit(e.target.value as 'M3_PER_DAY' | 'GALLONS_PER_DAY')}
          >
            <MenuItem value="M3_PER_DAY">m³/day</MenuItem>
            <MenuItem value="GALLONS_PER_DAY">gallons/day</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          fullWidth
          label="Feed Water Source"
          value={feedWaterSource}
          onChange={(e) => setFeedWaterSource(e.target.value)}
          placeholder="e.g., Seawater, Brackish water"
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          fullWidth
          label="Energy Source"
          value={energySource}
          onChange={(e) => setEnergySource(e.target.value)}
          placeholder="e.g., Solar, Natural gas, Grid electricity"
        />
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <TextField
          fullWidth
          label="Min Operating Temp"
          type="number"
          value={minTemp}
          onChange={(e) => setMinTemp(e.target.value)}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <TextField
          fullWidth
          label="Max Operating Temp"
          type="number"
          value={maxTemp}
          onChange={(e) => setMaxTemp(e.target.value)}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <FormControl fullWidth>
          <InputLabel>Temp Unit</InputLabel>
          <Select
            value={tempUnit}
            label="Temp Unit"
            onChange={(e) => setTempUnit(e.target.value as 'CELSIUS' | 'FAHRENHEIT')}
          >
            <MenuItem value="CELSIUS">°C</MenuItem>
            <MenuItem value="FAHRENHEIT">°F</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <TextField
          fullWidth
          label="Compliance Standards"
          value={complianceStandards}
          onChange={(e) => setComplianceStandards(e.target.value)}
          placeholder="Comma-separated list (e.g., ISO 9001, WHO Guidelines)"
          helperText="Enter standards separated by commas"
        />
      </Grid>
    </>
  );
}
