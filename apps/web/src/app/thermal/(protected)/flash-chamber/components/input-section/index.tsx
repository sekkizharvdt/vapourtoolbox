'use client';

import { useState } from 'react';
import { Paper, Typography, Stack, Tabs, Tab, Box } from '@mui/material';
import type {
  FlashChamberInput,
  FlashChamberInputMode,
  FlashChamberWaterType,
  FlashingInputMode,
  FlowRateUnit,
} from '@vapour/types';
import { getSaturationTemperature, getSaturationPressure, mbarAbsToBar } from '@vapour/constants';
import { ProcessInputs } from './ProcessInputs';
import { ChamberDesignInputs } from './ChamberDesignInputs';
import { ElevationInputs } from './ElevationInputs';
import { NozzleVelocityInputs } from './NozzleVelocityInputs';

interface InputSectionProps {
  inputs: FlashChamberInput;
  onChange: (inputs: FlashChamberInput) => void;
  /** Auto-calculated diameter from results (optional, for display) */
  calculatedDiameter?: number;
  /** Vapor velocity through chamber cross-section in m/s */
  vaporVelocity?: number;
  /** Vapor velocity status indicator */
  vaporVelocityStatus?: 'OK' | 'HIGH' | 'VERY_HIGH';
  /** Vapor loading - vapor flow rate per unit cross-section area in ton/hr/m² */
  vaporLoading?: number;
}

export function InputSection({
  inputs,
  onChange,
  calculatedDiameter,
  vaporVelocity,
  vaporVelocityStatus,
  vaporLoading,
}: InputSectionProps) {
  const [activeTab, setActiveTab] = useState(0);

  const handleChange = (field: keyof FlashChamberInput, value: number | string | boolean) => {
    onChange({
      ...inputs,
      [field]: value,
    });
  };

  const handleDiameterModeChange = (autoCalculate: boolean) => {
    onChange({
      ...inputs,
      autoCalculateDiameter: autoCalculate,
      userDiameter: !autoCalculate && calculatedDiameter ? calculatedDiameter : inputs.userDiameter,
    });
  };

  const handleModeChange = (mode: FlashChamberInputMode) => {
    onChange({
      ...inputs,
      mode,
      waterFlowRate: mode === 'WATER_FLOW' ? inputs.waterFlowRate || 100 : undefined,
      vaporQuantity: mode === 'VAPOR_QUANTITY' ? inputs.vaporQuantity || 5 : undefined,
    });
  };

  const handleWaterTypeChange = (waterType: FlashChamberWaterType) => {
    onChange({
      ...inputs,
      waterType,
      salinity: waterType === 'SEAWATER' ? 35000 : 0,
    });
  };

  const handleFlowRateUnitChange = (flowRateUnit: FlowRateUnit) => {
    onChange({ ...inputs, flowRateUnit });
  };

  const handleFlashingInputModeChange = (mode: FlashingInputMode) => {
    if (mode === 'TEMPERATURE') {
      const pressureBar = mbarAbsToBar(inputs.operatingPressure);
      const satTemp = Math.round(getSaturationTemperature(pressureBar) * 10) / 10;
      onChange({ ...inputs, flashingInputMode: 'TEMPERATURE', flashingTemperature: satTemp });
    } else {
      onChange({ ...inputs, flashingInputMode: 'PRESSURE' });
    }
  };

  const handleFlashingTemperatureChange = (tempC: number) => {
    const pressureMbar = Math.round(getSaturationPressure(tempC) * 1000);
    onChange({ ...inputs, flashingTemperature: tempC, operatingPressure: pressureMbar });
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Inputs
      </Typography>

      <Tabs
        value={activeTab}
        onChange={(_e, v: number) => setActiveTab(v)}
        variant="fullWidth"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Process" />
        <Tab label="Chamber" />
        <Tab label="Elevations" />
        <Tab label="Nozzles" />
      </Tabs>

      {activeTab === 0 && (
        <Stack spacing={2}>
          <ProcessInputs
            inputs={inputs}
            onChange={handleChange}
            onWaterTypeChange={handleWaterTypeChange}
            onModeChange={handleModeChange}
            onFlowRateUnitChange={handleFlowRateUnitChange}
            onFlashingInputModeChange={handleFlashingInputModeChange}
            onFlashingTemperatureChange={handleFlashingTemperatureChange}
          />
        </Stack>
      )}

      {activeTab === 1 && (
        <Stack spacing={2}>
          <ChamberDesignInputs
            inputs={inputs}
            calculatedDiameter={calculatedDiameter}
            vaporVelocity={vaporVelocity}
            vaporVelocityStatus={vaporVelocityStatus}
            vaporLoading={vaporLoading}
            onChange={handleChange}
            onDiameterModeChange={handleDiameterModeChange}
          />
        </Stack>
      )}

      {activeTab === 2 && (
        <Stack spacing={2}>
          <ElevationInputs inputs={inputs} onChange={handleChange} />
        </Stack>
      )}

      {activeTab === 3 && (
        <Stack spacing={2}>
          <NozzleVelocityInputs inputs={inputs} onChange={handleChange} />
        </Stack>
      )}

      {/* Tab hint */}
      <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          {activeTab === 0 && 'Water type, flow rate, and flash chamber operating condition'}
          {activeTab === 1 && 'Vessel diameter, retention time, flashing zone, and spray angle'}
          {activeTab === 2 && 'Pump and liquid level elevations for NPSHa calculation'}
          {activeTab === 3 && 'Inlet, outlet, and vapor nozzle design velocities'}
        </Typography>
      </Box>
    </Paper>
  );
}
