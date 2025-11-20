import React from 'react';
import { Grid, TextField, MenuItem, Box, InputAdornment } from '@mui/material';
import { BoughtOutCategory } from '@vapour/types';

interface SpecificationFormProps {
  category: BoughtOutCategory;
  specs: Record<string, unknown>;
  onChange: (newSpecs: Record<string, unknown>) => void;
  readOnly?: boolean;
}

export default function SpecificationForm({
  category,
  specs,
  onChange,
  readOnly = false,
}: SpecificationFormProps) {
  const handleChange = (field: string, value: unknown) => {
    onChange({
      ...specs,
      [field]: value,
    });
  };

  // Common fields for all categories
  const renderCommonFields = () => (
    <>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Manufacturer"
          value={specs.manufacturer || ''}
          onChange={(e) => handleChange('manufacturer', e.target.value)}
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Model"
          value={specs.model || ''}
          onChange={(e) => handleChange('model', e.target.value)}
          disabled={readOnly}
        />
      </Grid>
    </>
  );

  const renderPumpFields = () => (
    <>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          select
          fullWidth
          label="Pump Type"
          value={specs.type || ''}
          onChange={(e) => handleChange('type', e.target.value)}
          disabled={readOnly}
        >
          <MenuItem value="Centrifugal">Centrifugal</MenuItem>
          <MenuItem value="Reciprocating">Reciprocating</MenuItem>
          <MenuItem value="Rotary">Rotary</MenuItem>
          <MenuItem value="Diaphragm">Diaphragm</MenuItem>
          <MenuItem value="Other">Other</MenuItem>
        </TextField>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          type="number"
          label="Flow Rate"
          value={specs.flowRate || ''}
          onChange={(e) => handleChange('flowRate', parseFloat(e.target.value))}
          InputProps={{
            endAdornment: <InputAdornment position="end">m³/hr</InputAdornment>,
          }}
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          type="number"
          label="Head"
          value={specs.head || ''}
          onChange={(e) => handleChange('head', parseFloat(e.target.value))}
          InputProps={{
            endAdornment: <InputAdornment position="end">m</InputAdornment>,
          }}
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          type="number"
          label="NPSHr"
          value={specs.npshr || ''}
          onChange={(e) => handleChange('npshr', parseFloat(e.target.value))}
          InputProps={{
            endAdornment: <InputAdornment position="end">m</InputAdornment>,
          }}
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          type="number"
          label="Power"
          value={specs.power || ''}
          onChange={(e) => handleChange('power', parseFloat(e.target.value))}
          InputProps={{
            endAdornment: <InputAdornment position="end">kW</InputAdornment>,
          }}
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          type="number"
          label="Efficiency"
          value={specs.efficiency || ''}
          onChange={(e) => handleChange('efficiency', parseFloat(e.target.value))}
          InputProps={{
            endAdornment: <InputAdornment position="end">%</InputAdornment>,
          }}
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Casing Material"
          value={specs.casingMaterial || ''}
          onChange={(e) => handleChange('casingMaterial', e.target.value)}
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Impeller Material"
          value={specs.impellerMaterial || ''}
          onChange={(e) => handleChange('impellerMaterial', e.target.value)}
          disabled={readOnly}
        />
      </Grid>
    </>
  );

  const renderValveFields = () => (
    <>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          select
          fullWidth
          label="Valve Type"
          value={specs.type || ''}
          onChange={(e) => handleChange('type', e.target.value)}
          disabled={readOnly}
        >
          <MenuItem value="Gate">Gate</MenuItem>
          <MenuItem value="Globe">Globe</MenuItem>
          <MenuItem value="Ball">Ball</MenuItem>
          <MenuItem value="Butterfly">Butterfly</MenuItem>
          <MenuItem value="Check">Check</MenuItem>
          <MenuItem value="Plug">Plug</MenuItem>
          <MenuItem value="Control">Control</MenuItem>
        </TextField>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Size"
          value={specs.size || ''}
          onChange={(e) => handleChange('size', e.target.value)}
          placeholder="e.g. 2 inch, DN50"
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Pressure Rating"
          value={specs.pressureRating || ''}
          onChange={(e) => handleChange('pressureRating', e.target.value)}
          placeholder="e.g. Class 150, PN16"
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Body Material"
          value={specs.bodyMaterial || ''}
          onChange={(e) => handleChange('bodyMaterial', e.target.value)}
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Trim Material"
          value={specs.trimMaterial || ''}
          onChange={(e) => handleChange('trimMaterial', e.target.value)}
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="End Connection"
          value={specs.endConnection || ''}
          onChange={(e) => handleChange('endConnection', e.target.value)}
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Operation"
          value={specs.operation || ''}
          onChange={(e) => handleChange('operation', e.target.value)}
          placeholder="Manual, Gear, Actuated"
          disabled={readOnly}
        />
      </Grid>
    </>
  );

  const renderInstrumentFields = () => (
    <>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          select
          fullWidth
          label="Instrument Type"
          value={specs.type || ''}
          onChange={(e) => handleChange('type', e.target.value)}
          disabled={readOnly}
        >
          <MenuItem value="Gauge">Gauge</MenuItem>
          <MenuItem value="Transmitter">Transmitter</MenuItem>
          <MenuItem value="Switch">Switch</MenuItem>
          <MenuItem value="Flow Meter">Flow Meter</MenuItem>
          <MenuItem value="Analyzer">Analyzer</MenuItem>
        </TextField>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          select
          fullWidth
          label="Variable"
          value={specs.variable || ''}
          onChange={(e) => handleChange('variable', e.target.value)}
          disabled={readOnly}
        >
          <MenuItem value="Pressure">Pressure</MenuItem>
          <MenuItem value="Temperature">Temperature</MenuItem>
          <MenuItem value="Flow">Flow</MenuItem>
          <MenuItem value="Level">Level</MenuItem>
        </TextField>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            type="number"
            label="Min Range"
            value={specs.rangeMin || ''}
            onChange={(e) => handleChange('rangeMin', parseFloat(e.target.value))}
            disabled={readOnly}
          />
          <TextField
            fullWidth
            type="number"
            label="Max Range"
            value={specs.rangeMax || ''}
            onChange={(e) => handleChange('rangeMax', parseFloat(e.target.value))}
            disabled={readOnly}
          />
        </Box>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Unit"
          value={specs.unit || ''}
          onChange={(e) => handleChange('unit', e.target.value)}
          placeholder="bar, degC, m3/hr"
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Output Signal"
          value={specs.outputSignal || ''}
          onChange={(e) => handleChange('outputSignal', e.target.value)}
          placeholder="4-20mA, HART"
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Process Connection"
          value={specs.processConnection || ''}
          onChange={(e) => handleChange('processConnection', e.target.value)}
          disabled={readOnly}
        />
      </Grid>
    </>
  );

  const renderElectricalFields = () => (
    <>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Type"
          value={specs.type || ''}
          onChange={(e) => handleChange('type', e.target.value)}
          placeholder="Motor, Switchgear"
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Voltage"
          value={specs.voltage || ''}
          onChange={(e) => handleChange('voltage', e.target.value)}
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="Power Rating"
          value={specs.powerRating || ''}
          onChange={(e) => handleChange('powerRating', e.target.value)}
          disabled={readOnly}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          fullWidth
          label="IP Rating"
          value={specs.ipRating || ''}
          onChange={(e) => handleChange('ipRating', e.target.value)}
          disabled={readOnly}
        />
      </Grid>
    </>
  );

  const renderOtherFields = () => (
    <Grid size={{ xs: 12 }}>
      <TextField
        fullWidth
        multiline
        rows={4}
        label="Specification Details"
        value={specs.specification || ''}
        onChange={(e) => handleChange('specification', e.target.value)}
        disabled={readOnly}
      />
    </Grid>
  );

  return (
    <Grid container spacing={2}>
      {renderCommonFields()}

      {category === 'PUMP' && renderPumpFields()}
      {category === 'VALVE' && renderValveFields()}
      {category === 'INSTRUMENT' && renderInstrumentFields()}
      {category === 'ELECTRICAL' && renderElectricalFields()}
      {category === 'OTHER' && renderOtherFields()}

      <Grid size={{ xs: 12 }}>
        <TextField
          fullWidth
          multiline
          rows={2}
          label="Additional Notes"
          value={specs.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          disabled={readOnly}
        />
      </Grid>
    </Grid>
  );
}
