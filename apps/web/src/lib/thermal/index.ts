/**
 * Thermal Desalination Module
 *
 * Services and calculators for thermal desalination equipment design.
 */

// Flash Chamber Calculator
export { calculateFlashChamber, validateFlashChamberInput } from './flashChamberCalculator';

// Pipe Service
export {
  getSchedule40Pipes,
  selectPipeSize,
  selectPipeByVelocity,
  calculateRequiredArea,
  calculateVelocity,
  getPipeByNPS,
  getPipeByDN,
  clearPipeCache,
  SCHEDULE_40_PIPES,
  type PipeVariant,
  type SelectedPipe,
} from './pipeService';

// Pressure Drop Calculator
export {
  calculatePressureDrop,
  calculateReynoldsNumber,
  calculateFrictionFactor,
  mH2OToBar,
  barToMH2O,
  getAvailableFittings,
  K_FACTORS,
  FITTING_NAMES,
  type FittingType,
  type FittingCount,
  type PressureDropInput,
  type PressureDropResult,
} from './pressureDropCalculator';

// NPSHa Calculator
export {
  calculateNPSHa,
  calculateMinimumLiquidLevel,
  barToHead,
  headToBar,
  type VesselType,
  type LiquidType,
  type NPSHaInput,
  type NPSHaResult,
} from './npshaCalculator';

// Heat Duty Calculator
export {
  calculateSensibleHeat,
  calculateLatentHeat,
  calculateLMTD,
  calculateCombinedHeat,
  calculateHeatDutyFromLMTD,
  calculateRequiredArea as calculateHeatExchangerArea,
  TYPICAL_HTC,
  type HeatFluidType,
  type HeatProcessType,
  type FlowArrangement,
  type SensibleHeatInput,
  type LatentHeatInput,
  type LMTDInput,
  type SensibleHeatResult,
  type LatentHeatResult,
  type LMTDResult,
  type CombinedHeatResult,
} from './heatDutyCalculator';
