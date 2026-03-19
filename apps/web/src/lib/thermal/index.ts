/**
 * Thermal Desalination Module
 *
 * Services and calculators for thermal desalination equipment design.
 */

// Flash Chamber Calculator
export { calculateFlashChamber, validateFlashChamberInput } from './flashChamberCalculator';

// NCG Properties Calculator
export {
  calculateNCGProperties,
  dissolvedGasContent,
  type NCGInputMode,
  type NCGInput,
  type NCGResult,
  type NCGSeawaterInfo,
} from './ncgCalculator';

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
  calculateReducerK,
  calculateExpanderK,
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

// Head/Pressure conversion utilities (from thermalUtils)
export { barToHead, headToBar } from './thermalUtils';

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
  calculateShellEquivalentDiameter,
  calculateKernShellSideHTC,
  calculateMostinskiBoiling,
  calculateOverallHTC,
  type PrandtlResult,
  type DittusBoelterResult,
  type TubeSideHTCInput,
  type TubeSideHTCResult,
  type NusseltCondensationInput,
  type CondensationHTCResult,
  type KernShellSideInput,
  type KernShellSideResult,
  type MostinskiBoilingInput,
  type MostinskiBoilingResult,
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

// Siphon Sizing Calculator
export {
  calculateSiphonSizing,
  validateSiphonInput,
  type SiphonSizingInput,
  type SiphonSizingResult,
  type SiphonFluidType,
  type PressureUnit,
  type ElbowConfig,
} from './siphonSizingCalculator';

// Demister / Mist Eliminator Sizing
export {
  calculateDemisterSizing,
  DEMISTER_TYPE_LABELS,
  DEMISTER_K_FACTORS,
  DEMISTER_PRESSURE_DROP,
  DEMISTER_EFFICIENCY,
  DEFAULT_PAD_THICKNESS,
  DP_MODEL,
  estimatePrimaryEntrainment,
  calculateDemisterEfficiency,
  type DemisterInput,
  type DemisterResult,
  type DemisterType,
  type DemisterOrientation,
  type VesselGeometry,
  type FluidInputMode,
  type CarryoverInput,
  type CarryoverResult,
  calculateCarryoverComparison,
  type CarryoverComparisonRow,
} from './demisterCalculator';

// Chemical Dosing Calculator (Antiscalant + Anti-foam + CIP)
export {
  calculateDosing,
  calculateCIP,
  calculateTankDimensions,
  calculatePumpPressure,
  selectDosingLine,
  CHEMICAL_PRODUCTS,
  ACID_PRODUCTS,
  DOSING_TUBING_SIZES,
  DEFAULT_SPECIFIC_VOLUME_LPM2,
  CIP_TANK_MARGIN,
  BUND_FACTOR,
  type ChemicalType,
  type ChemicalProduct,
  type AcidType,
  type AcidProduct,
  type TankDimensions,
  type DosingInput,
  type DosingResult,
  type DilutionResult,
  type PumpPressureResult,
  type DosingLineResult,
  type CIPInput,
  type CIPResult,
} from './chemicalDosingCalculator';

// MED Suction System Designer
export {
  calculateSuctionSystem,
  validateSuctionSystemInput,
  parseNPSToNumber,
  type SuctionSystemInput,
  type SuctionSystemResult,
  type SuctionFluidType,
  type ValveType,
  type StrainerType,
  type CalculationMode,
  type HoldupResult,
  type StrainerPressureDrop,
  type NPSHaCondition,
  type AutoSelectedFitting,
  type ReducerDetail,
} from './suctionSystemCalculator';

// Vacuum System Design
export {
  calculateVacuumSystem,
  type NCGLoadMode,
  type TrainConfig,
  type VacuumSystemInput,
  type StageResult,
  type VacuumSystemResult,
} from './vacuumSystemCalculator';

// Spray Nozzle Selection Calculator
export {
  selectSprayNozzles,
  calculateFlowAtPressure,
  interpolateSprayAngle,
  calculateCoverage,
  calculateNozzleLayout,
  getOrderingModel,
  NOZZLE_CATEGORIES,
  NOZZLE_CATEGORY_LABELS,
  type NozzleCategory,
  type NozzleEntry,
  type NozzleCategoryConfig,
  type SprayNozzleInput,
  type NozzleMatch,
  type SprayNozzleResult,
  type NozzleLayoutInput,
  type NozzleLayoutMatch,
  type NozzleLayoutResult,
} from './sprayNozzleCalculator';

// Fouling & Scaling Prediction
export {
  calculateFoulingScaling,
  STANDARD_SEAWATER_CHEMISTRY,
  SCALING_THRESHOLDS,
  getCaSO4Solubility,
  getCaSO4BrineConcentration,
  getCaSO4SaturationIndex,
  calculateLSI,
  evaluateMgOH2Risk,
  getRecommendedFouling,
  type FoulingScalingInput,
  type FoulingScalingResult,
  type ScalingPoint,
} from './foulingScalingCalculator';

// Falling Film Evaporator
export {
  calculateFallingFilm,
  validateFallingFilmInput,
  TUBE_MATERIALS as FF_TUBE_MATERIALS,
  STANDARD_TUBE_SIZES as FF_STANDARD_TUBE_SIZES,
  WETTING_LIMITS,
  type FallingFilmInput,
  type FallingFilmResult,
} from './fallingFilmCalculator';

// Performance Ratio / GOR
export {
  calculateGOR,
  PLANT_CONFIGURATIONS,
  TYPICAL_RANGES as GOR_TYPICAL_RANGES,
  type PlantConfiguration,
  type GORInput,
  type EffectDetail,
  type GORResult,
} from './gorCalculator';

// Fluid Properties (unified resolver)
export {
  getFluidProperties,
  getSaturationProperties,
  getSteamTableLiquidDensity,
  type FluidType,
  type FluidProperties,
  type SaturationFluidProperties,
} from './fluidProperties';

// Iterative Heat Exchanger Design
export { designHeatExchanger } from './iterativeHXDesign';
export type {
  ExchangerType,
  TubeOrientation,
  FluidSpec,
  ShellSideCondensing,
  ShellSideSensible,
  ShellSideSpec,
  TubeGeometrySpec,
  FoulingSpec,
  IterativeHXInput,
  IterationStep,
  HeatDutyResult,
  LMTDResultSummary,
  VelocityResult,
  GeometryResult,
  IterativeHXResult,
} from './iterativeHXDesign.types';

// Vacuum Breaker Sizing
export {
  calculateVacuumBreaker,
  STANDARD_DN_SIZES,
  VALVE_TYPE_LABELS as VB_VALVE_TYPE_LABELS,
  VALVE_CD as VB_VALVE_CD,
  MODE_LABELS as VB_MODE_LABELS,
  type ValveType as VBValveType,
  type CalculationMode as VBCalculationMode,
  type DNValveSize,
  type VacuumBreakerInput,
  type VacuumBreakerResult,
  type ManualValveInput,
  type ManualValveResult,
  type DiaphragmAnalysisInput,
  type DiaphragmAnalysisResult,
  type DiaphragmDesignInput,
  type DiaphragmDesignResult,
  type TimeStep,
} from './vacuumBreakerCalculator';

// Strainer Sizing
export {
  calculateStrainerSizing,
  getAvailableLineSizes,
  STRAINER_TYPE_LABELS,
  FLUID_TYPE_LABELS as STRAINER_FLUID_TYPE_LABELS,
  type StrainerType as StrainerSizingStrainerType,
  type FluidType as StrainerFluidType,
  type StrainerSizingInput,
  type StrainerSizingResult,
} from './strainerSizingCalculator';

// Heat Exchanger Sizing
export {
  sizeHeatExchanger,
  calculateTubeSideVelocity,
  calculateShellSideVelocity,
  estimateTubeSidePressureDrop,
  findTubeIndex,
  getDistinctODs,
  getBWGsForOD,
  STANDARD_TUBES,
  TUBE_MATERIALS,
  TUBE_LAYOUT_LABELS,
  STANDARD_SHELL_IDS_MM,
  TUBE_COUNT_CONSTANT,
  LAYOUT_CONSTANT,
  MIN_PITCH_RATIO,
  type TubeSpec,
  type TubeLayout,
  type HeatExchangerInput,
  type HeatExchangerResult,
} from './heatExchangerSizing';

// Tube Bundle Geometry
export {
  calculateTubeBundleGeometry,
  calculateBundleArea,
  generateDefaultVapourLanes,
  type TubePosition,
  type RowInfo,
  type VapourLane,
  type ExclusionZone,
  type BundleShape,
  type TubeBundleGeometryInput,
  type TubeBundleGeometryResult,
} from './tubeBundleGeometry';

// MED Plant Designer
export {
  designMED,
  generateDesignOptions,
  type MEDDesignerInput,
  type MEDDesignerResult,
  type MEDEffectResult,
  type MEDCondenserResult,
  type MEDPreheaterResult,
  type MEDScenarioRow,
  type MEDDesignOption,
  type MEDWeightEstimate,
  type ShellWeight,
  type MEDAuxiliaryEquipment,
  type MEDDemisterResult,
  type MEDSprayNozzleResult,
  type MEDSiphonResult,
  type MEDLineSizing,
  type MEDPumpResult,
} from './medDesigner';

// Single Tube Analysis
export {
  calculateSingleTube,
  validateSingleTubeInput,
  getDefaultWallThickness,
  getQuickSelectConductivity,
  QUICK_SELECT_MATERIALS,
} from './singleTubeCalculator';
