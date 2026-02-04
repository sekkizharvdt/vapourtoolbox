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
  calculateRequiredPipeArea,
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
  calculateHeatExchangerArea,
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

// Shared Utilities
export { GRAVITY, ATM_PRESSURE_BAR, tonHrToKgS, kgSToTonHr, tonHrToM3S } from './thermalUtils';

// Heat Transfer Correlations
export {
  calculatePrandtlNumber,
  calculateTubeReynoldsNumber,
  calculateDittusBoelter,
  calculateTubeSideHTC,
  calculateNusseltCondensation,
  calculateOverallHTC,
  type PrandtlResult,
  type DittusBoelterResult,
  type TubeSideHTCInput,
  type TubeSideHTCResult,
  type NusseltCondensationInput,
  type CondensationHTCResult,
  type OverallHTCInput,
  type OverallHTCResult,
} from './heatTransfer';

// Pump Sizing
export {
  calculateTDH,
  calculateHydraulicPower,
  calculateBrakePower,
  STANDARD_MOTOR_SIZES_KW,
  type PumpSizingInput,
  type PumpSizingResult,
} from './pumpSizing';

// Desuperheating Calculator
export {
  calculateDesuperheating,
  type DesuperheatingInput,
  type DesuperheatingResult,
} from './desuperheatingCalculator';

// Thermo Vapour Compressor (TVC)
export { calculateTVC, type TVCInput, type TVCResult } from './tvcCalculator';

// Mechanical Vapour Compressor (MVC)
export { calculateMVC, type MVCInput, type MVCResult } from './mvcCalculator';
