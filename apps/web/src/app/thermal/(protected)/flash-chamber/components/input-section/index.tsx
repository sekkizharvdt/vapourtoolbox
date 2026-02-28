'use client';

/**
 * Flash Chamber Input Section
 *
 * Form for entering flash chamber design parameters.
 * Supports two modes: Water Flow Known and Vapor Quantity Known.
 *
 * This component has been split into smaller, focused subcomponents:
 * - ProcessInputs.tsx - Water type, mode, operating pressure, flow rate inputs
 * - ChamberDesignInputs.tsx - Vessel diameter, retention time, flashing zone, spray angle
 * - ElevationInputs.tsx - Pump centerline, operating level, BTL gap inputs
 * - NozzleVelocityInputs.tsx - Inlet, outlet, vapor velocity inputs
 * - helpers.ts - Calculation helper functions
 */

import { Paper, Typography, Stack } from '@mui/material';
import type {
  FlashChamberInput,
  FlashChamberInputMode,
  FlashChamberWaterType,
  FlowRateUnit,
} from '@vapour/types';
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
  const handleChange = (field: keyof FlashChamberInput, value: number | string | boolean) => {
    onChange({
      ...inputs,
      [field]: value,
    });
  };

  // Handle diameter mode toggle
  const handleDiameterModeChange = (autoCalculate: boolean) => {
    onChange({
      ...inputs,
      autoCalculateDiameter: autoCalculate,
      // When switching to manual, default to current calculated value if available
      userDiameter: !autoCalculate && calculatedDiameter ? calculatedDiameter : inputs.userDiameter,
    });
  };

  // Handle mode change
  const handleModeChange = (mode: FlashChamberInputMode) => {
    onChange({
      ...inputs,
      mode,
      // Clear the non-applicable field when switching modes
      waterFlowRate: mode === 'WATER_FLOW' ? inputs.waterFlowRate || 100 : undefined,
      vaporQuantity: mode === 'VAPOR_QUANTITY' ? inputs.vaporQuantity || 5 : undefined,
    });
  };

  // Handle water type change
  const handleWaterTypeChange = (waterType: FlashChamberWaterType) => {
    onChange({
      ...inputs,
      waterType,
      // Set appropriate default salinity based on water type
      salinity: waterType === 'SEAWATER' ? 35000 : 0,
    });
  };

  // Handle flow rate unit change
  const handleFlowRateUnitChange = (flowRateUnit: FlowRateUnit) => {
    onChange({
      ...inputs,
      flowRateUnit,
    });
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Process Inputs
      </Typography>

      <Stack spacing={3}>
        {/* Process Inputs: Water type, mode, pressure, flow rate */}
        <ProcessInputs
          inputs={inputs}
          onChange={handleChange}
          onWaterTypeChange={handleWaterTypeChange}
          onModeChange={handleModeChange}
          onFlowRateUnitChange={handleFlowRateUnitChange}
        />

        {/* Chamber Design: Diameter, retention time, flashing zone, spray angle */}
        <ChamberDesignInputs
          inputs={inputs}
          calculatedDiameter={calculatedDiameter}
          vaporVelocity={vaporVelocity}
          vaporVelocityStatus={vaporVelocityStatus}
          vaporLoading={vaporLoading}
          onChange={handleChange}
          onDiameterModeChange={handleDiameterModeChange}
        />

        {/* Elevation Reference: Pump centerline, operating level, BTL gap */}
        <ElevationInputs inputs={inputs} onChange={handleChange} />

        {/* Nozzle Velocities: Inlet, outlet, vapor velocities */}
        <NozzleVelocityInputs inputs={inputs} onChange={handleChange} />
      </Stack>
    </Paper>
  );
}
