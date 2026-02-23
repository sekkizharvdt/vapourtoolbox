/**
 * Siphon Sizing Calculator
 *
 * Sizes inter-effect siphon pipes in MED thermal desalination plants.
 * Siphons are U-shaped pipes connecting two effects operating at different
 * pressures. The U-bend height must exceed the static head equivalent of
 * the pressure difference to prevent vapor passage.
 *
 * Calculates:
 * 1. Pipe size selection (based on velocity constraints)
 * 2. Pressure drop across the pipe (Darcy-Weisbach)
 * 3. Minimum siphon height (static head + friction + safety)
 * 4. Flashed vapor at the downstream effect
 *
 * References:
 * - Crane Technical Paper No. 410 "Flow of Fluids"
 * - IAPWS-IF97 Steam Tables
 * - Sharqawy et al. (2010) Seawater Correlations
 */

import {
  getSaturationTemperature,
  getEnthalpyLiquid,
  getEnthalpyVapor,
  getDensityLiquid,
  mbarAbsToBar,
  getSeawaterDensity,
  getSeawaterViscosity,
  getSeawaterEnthalpy,
  getBoilingPointElevation,
} from '@vapour/constants';

import { selectPipeByVelocity, type SelectedPipe } from './pipeService';
import {
  calculatePressureDrop,
  type PressureDropResult,
  type FittingCount,
} from './pressureDropCalculator';
import { barToHead, tonHrToM3S } from './thermalUtils';

// ============================================================================
// Types
// ============================================================================

export type SiphonFluidType = 'seawater' | 'brine' | 'distillate';
export type PressureUnit = 'mbar_abs' | 'bar_abs' | 'kpa_abs';
export type ElbowConfig = '2_elbows' | '3_elbows' | '4_elbows';

export interface SiphonSizingInput {
  /** Upstream effect pressure (in selected unit) */
  upstreamPressure: number;
  /** Downstream effect pressure (in selected unit) */
  downstreamPressure: number;
  /** Pressure unit */
  pressureUnit: PressureUnit;

  /** Fluid type */
  fluidType: SiphonFluidType;
  /** Salinity in ppm (used for seawater/brine) */
  salinity: number;

  /** Mass flow rate in ton/hr */
  flowRate: number;

  /** Elbow configuration: 2 (same plane), 3 (different plane), or 4 (same plane, routing around another siphon) */
  elbowConfig: ElbowConfig;
  /** Horizontal distance between nozzle centers (m) */
  horizontalDistance: number;
  /** Lateral offset distance (m) — used for 3-elbow (one offset) and 4-elbow (out + back) configs */
  offsetDistance: number;

  /** Target fluid velocity in m/s (pipe is sized to match this) */
  targetVelocity: number;

  /** Safety factor as percentage (minimum 20%) */
  safetyFactor: number;

  /** Custom pipe for plate-formed pipes exceeding standard sizes */
  customPipe?: {
    /** Inner diameter in mm */
    id_mm: number;
    /** Wall thickness in mm */
    wt_mm: number;
  };
}

export interface SiphonSizingResult {
  /** Selected pipe */
  pipe: SelectedPipe;
  /** Flow velocity in m/s */
  velocity: number;
  /** Velocity status */
  velocityStatus: 'OK' | 'HIGH' | 'LOW';
  /** True when auto-sized pipe exceeds standard pipe range (24" max) */
  pipeExceedsStandard: boolean;

  /** Pressure drop calculation result */
  pressureDrop: PressureDropResult;

  /** Static head from pressure difference (m) */
  staticHead: number;
  /** Friction head losses from pipe + fittings (m) */
  frictionHead: number;
  /** Safety margin applied (m) */
  safetyMargin: number;
  /** Minimum siphon height required (m) */
  minimumHeight: number;

  /** Flash vapor fraction (0 to 1), 0 if subcooled */
  flashVaporFraction: number;
  /** Flash vapor flow rate (ton/hr) */
  flashVaporFlow: number;
  /** Liquid flow after flash (ton/hr) */
  liquidFlowAfterFlash: number;
  /** Downstream saturation temperature (°C) — with BPE for seawater/brine */
  downstreamSatTemp: number;
  /** Pure saturation temperature at downstream pressure (°C) */
  downstreamSatTempPure: number;
  /** Whether flash occurs */
  flashOccurs: boolean;

  /** Derived fluid temperature at upstream effect (°C) — sat temp + BPE */
  fluidTemperature: number;
  /** Pure saturation temperature at upstream pressure (°C) */
  upstreamSatTempPure: number;

  /** Fluid density used (kg/m³) */
  fluidDensity: number;
  /** Fluid viscosity used (Pa·s) */
  fluidViscosity: number;

  /** Total pipe length (m) */
  totalPipeLength: number;
  /** Number of elbows */
  elbowCount: number;
  /** Pressure difference in bar */
  pressureDiffBar: number;

  /** Warnings */
  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Siphon velocity limits (m/s) */
const SIPHON_VELOCITY_MIN = 0.05;
const SIPHON_VELOCITY_MAX = 1.0;

/** Minimum allowed safety factor (%) */
const MIN_SAFETY_FACTOR = 20;

/** Maximum iterations for height convergence */
const MAX_ITERATIONS = 10;
/** Convergence tolerance for height (m) */
const CONVERGENCE_TOLERANCE = 0.01;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert pressure from user's unit to bar
 */
function pressureToBar(value: number, unit: PressureUnit): number {
  switch (unit) {
    case 'mbar_abs':
      return mbarAbsToBar(value);
    case 'bar_abs':
      return value;
    case 'kpa_abs':
      return value / 100;
  }
}

/**
 * Get fluid properties based on type
 */
function getFluidProperties(
  fluidType: SiphonFluidType,
  tempC: number,
  salinity: number
): { density: number; viscosity: number } {
  switch (fluidType) {
    case 'seawater':
    case 'brine':
      return {
        density: getSeawaterDensity(salinity, tempC),
        viscosity: getSeawaterViscosity(salinity, tempC),
      };
    case 'distillate':
      return {
        density: getDensityLiquid(tempC),
        // getSeawaterViscosity at 0 salinity returns pure water viscosity
        viscosity: getSeawaterViscosity(0, tempC),
      };
  }
}

/**
 * Get fluid enthalpy based on type
 */
function getFluidEnthalpy(fluidType: SiphonFluidType, tempC: number, salinity: number): number {
  switch (fluidType) {
    case 'seawater':
    case 'brine':
      return getSeawaterEnthalpy(salinity, tempC);
    case 'distillate':
      return getEnthalpyLiquid(tempC);
  }
}

/**
 * Get the number of elbows for a given configuration.
 */
function getElbowCount(elbowConfig: ElbowConfig): number {
  switch (elbowConfig) {
    case '2_elbows':
      return 2;
    case '3_elbows':
      return 3;
    case '4_elbows':
      return 4;
  }
}

/**
 * Build the fittings list based on elbow configuration.
 * Siphon always has: entrance + elbows + exit
 */
function buildSiphonFittings(elbowConfig: ElbowConfig): FittingCount[] {
  return [
    { type: 'entrance_sharp', count: 1 },
    { type: '90_elbow_standard', count: getElbowCount(elbowConfig) },
    { type: 'exit', count: 1 },
  ];
}

// ============================================================================
// Validation
// ============================================================================

export function validateSiphonInput(input: SiphonSizingInput): string[] {
  const errors: string[] = [];

  // Pressure validation
  if (input.upstreamPressure <= 0) {
    errors.push('Upstream pressure must be positive');
  }
  if (input.downstreamPressure <= 0) {
    errors.push('Downstream pressure must be positive');
  }
  if (input.upstreamPressure <= input.downstreamPressure) {
    errors.push('Upstream pressure must be higher than downstream pressure');
  }

  // Salinity
  if (
    (input.fluidType === 'seawater' || input.fluidType === 'brine') &&
    (input.salinity < 0 || input.salinity > 120000)
  ) {
    errors.push('Salinity must be between 0 and 120,000 ppm');
  }

  // Flow rate
  if (input.flowRate <= 0) {
    errors.push('Flow rate must be positive');
  }

  // Geometry
  if (input.horizontalDistance <= 0) {
    errors.push('Horizontal distance must be positive');
  }
  if (input.elbowConfig !== '2_elbows' && input.offsetDistance <= 0) {
    errors.push('Offset distance must be positive for this elbow configuration');
  }

  // Velocity
  if (input.targetVelocity < SIPHON_VELOCITY_MIN || input.targetVelocity > SIPHON_VELOCITY_MAX) {
    errors.push(
      `Target velocity must be between ${SIPHON_VELOCITY_MIN} and ${SIPHON_VELOCITY_MAX} m/s`
    );
  }

  // Safety factor
  if (input.safetyFactor < MIN_SAFETY_FACTOR) {
    errors.push(`Safety factor must be at least ${MIN_SAFETY_FACTOR}%`);
  }

  // Custom pipe
  if (input.customPipe) {
    if (input.customPipe.id_mm <= 0) {
      errors.push('Custom pipe ID must be positive');
    }
    if (input.customPipe.wt_mm <= 0) {
      errors.push('Custom pipe wall thickness must be positive');
    }
  }

  return errors;
}

// ============================================================================
// Main Calculation
// ============================================================================

/**
 * Calculate siphon sizing for inter-effect transfer pipe
 *
 * Uses an iterative approach:
 * 1. Estimate initial pipe length from geometry
 * 2. Calculate pressure drop → friction head
 * 3. Calculate minimum height (static + friction + safety)
 * 4. Recalculate pipe length with updated height
 * 5. Iterate until height converges
 */
export function calculateSiphonSizing(input: SiphonSizingInput): SiphonSizingResult {
  const warnings: string[] = [];

  // Validate
  const errors = validateSiphonInput(input);
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  // Convert pressures to bar
  const upstreamBar = pressureToBar(input.upstreamPressure, input.pressureUnit);
  const downstreamBar = pressureToBar(input.downstreamPressure, input.pressureUnit);
  const pressureDiffBar = upstreamBar - downstreamBar;

  // Derive fluid temperature from upstream pressure (fluids are always saturated)
  const upstreamSatTempPure = getSaturationTemperature(upstreamBar);
  const upstreamBpe =
    input.fluidType === 'distillate'
      ? 0
      : getBoilingPointElevation(input.salinity, upstreamSatTempPure);
  const fluidTemperature = upstreamSatTempPure + upstreamBpe;

  // Get fluid properties at derived temperature
  const { density, viscosity } = getFluidProperties(
    input.fluidType,
    fluidTemperature,
    input.salinity
  );

  // Select pipe size
  const volumetricFlow = tonHrToM3S(input.flowRate, density);

  let pipeResult: SelectedPipe & { actualVelocity: number; velocityStatus: 'OK' | 'HIGH' | 'LOW' };
  let pipeExceedsStandard = false;

  if (input.customPipe) {
    const { id_mm, wt_mm } = input.customPipe;
    const od_mm = id_mm + 2 * wt_mm;
    const area_mm2 = (Math.PI / 4) * id_mm * id_mm;
    const actualVelocity = volumetricFlow / (area_mm2 / 1e6);
    const velocityStatus: 'OK' | 'HIGH' | 'LOW' =
      actualVelocity > SIPHON_VELOCITY_MAX
        ? 'HIGH'
        : actualVelocity < SIPHON_VELOCITY_MIN
          ? 'LOW'
          : 'OK';
    pipeResult = {
      nps: 'CUSTOM',
      dn: `${Math.round(id_mm)}`,
      schedule: 'N/A',
      od_mm,
      wt_mm,
      id_mm,
      area_mm2,
      weight_kgm: 0,
      displayName: `Custom (ID ${id_mm} mm)`,
      isExactMatch: true,
      actualVelocity,
      velocityStatus,
    };
    pipeExceedsStandard = true;
  } else {
    pipeResult = selectPipeByVelocity(volumetricFlow, input.targetVelocity, {
      min: SIPHON_VELOCITY_MIN,
      max: SIPHON_VELOCITY_MAX,
    });
    pipeExceedsStandard = pipeResult.displayName.includes('(MAX)');
  }

  if (pipeResult.velocityStatus === 'HIGH') {
    warnings.push(
      `Velocity ${pipeResult.actualVelocity.toFixed(2)} m/s exceeds recommended maximum of ${SIPHON_VELOCITY_MAX} m/s`
    );
  } else if (pipeResult.velocityStatus === 'LOW') {
    warnings.push(
      `Velocity ${pipeResult.actualVelocity.toFixed(2)} m/s is below recommended minimum of ${SIPHON_VELOCITY_MIN} m/s`
    );
  }

  // Build fittings
  const fittings = buildSiphonFittings(input.elbowConfig);
  const elbowCount = getElbowCount(input.elbowConfig);

  // Static head from pressure difference
  const staticHead = barToHead(pressureDiffBar, density);

  // Iterative calculation: pipe length depends on height, height depends on pressure drop
  let currentHeight = staticHead * 1.3; // Initial estimate: 130% of static head
  let pressureDropResult: PressureDropResult | null = null;
  let totalPipeLength = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Calculate total pipe length from geometry
    // Vertical legs: 2 legs of currentHeight each (down into U-bend and back up)
    const verticalRun = 2 * currentHeight;
    const horizontalRun = input.horizontalDistance;
    // 3-elbow: one lateral offset; 4-elbow: offset out + offset back = 2× offset
    let lateralRun = 0;
    if (input.elbowConfig === '3_elbows') lateralRun = input.offsetDistance;
    else if (input.elbowConfig === '4_elbows') lateralRun = 2 * input.offsetDistance;
    totalPipeLength = horizontalRun + lateralRun + verticalRun;

    // Calculate pressure drop
    pressureDropResult = calculatePressureDrop({
      pipeNPS: pipeResult.nps,
      pipeLength: totalPipeLength,
      flowRate: input.flowRate,
      fluidDensity: density,
      fluidViscosity: viscosity,
      fittings,
      ...(input.customPipe
        ? { customPipe: { id_mm: pipeResult.id_mm, area_mm2: pipeResult.area_mm2 } }
        : {}),
    });

    // Calculate minimum height
    const frictionHead = pressureDropResult.totalPressureDropMH2O;
    const baseHeight = staticHead + frictionHead;
    const safetyMargin = baseHeight * (input.safetyFactor / 100);
    const newHeight = baseHeight + safetyMargin;

    // Check convergence
    if (Math.abs(newHeight - currentHeight) < CONVERGENCE_TOLERANCE) {
      currentHeight = newHeight;
      break;
    }
    currentHeight = newHeight;
  }

  // Final values
  const frictionHead = pressureDropResult!.totalPressureDropMH2O;
  const baseHeight = staticHead + frictionHead;
  const safetyMargin = baseHeight * (input.safetyFactor / 100);
  const minimumHeight = baseHeight + safetyMargin;

  // Flash vapor calculation at downstream effect
  const downstreamSatTempPure = getSaturationTemperature(downstreamBar);
  const bpe =
    input.fluidType === 'distillate'
      ? 0
      : getBoilingPointElevation(input.salinity, downstreamSatTempPure);
  const downstreamSatTemp = downstreamSatTempPure + bpe;

  let flashVaporFraction = 0;
  let flashVaporFlow = 0;
  let liquidFlowAfterFlash = input.flowRate;
  const flashOccurs = fluidTemperature > downstreamSatTemp;

  if (flashOccurs) {
    // Enthalpy of incoming liquid at upstream saturation temperature
    const inletEnthalpy = getFluidEnthalpy(input.fluidType, fluidTemperature, input.salinity);

    // Enthalpy of liquid at downstream saturation temperature
    const brineEnthalpy = getFluidEnthalpy(input.fluidType, downstreamSatTemp, input.salinity);

    // Enthalpy of vapor at downstream pure saturation temperature
    const vaporEnthalpy = getEnthalpyVapor(downstreamSatTempPure);

    // Energy balance: m_v = m_total × (h_in - h_brine) / (h_vapor - h_brine)
    const enthalpyDiff = vaporEnthalpy - brineEnthalpy;
    if (enthalpyDiff > 0) {
      flashVaporFlow = (input.flowRate * (inletEnthalpy - brineEnthalpy)) / enthalpyDiff;
      flashVaporFraction = flashVaporFlow / input.flowRate;
      liquidFlowAfterFlash = input.flowRate - flashVaporFlow;
    }

    if (flashVaporFraction > 0.05) {
      warnings.push(
        `High flash vapor fraction (${(flashVaporFraction * 100).toFixed(1)}%) — consider subcooling the liquid before the siphon`
      );
    }
  }

  return {
    pipe: pipeResult,
    velocity: pipeResult.actualVelocity,
    velocityStatus: pipeResult.velocityStatus,
    pipeExceedsStandard,

    pressureDrop: pressureDropResult!,

    staticHead,
    frictionHead,
    safetyMargin,
    minimumHeight,

    flashVaporFraction,
    flashVaporFlow,
    liquidFlowAfterFlash,
    downstreamSatTemp,
    downstreamSatTempPure,
    flashOccurs,

    fluidTemperature,
    upstreamSatTempPure,

    fluidDensity: density,
    fluidViscosity: viscosity,

    totalPipeLength,
    elbowCount,
    pressureDiffBar,

    warnings,
  };
}
