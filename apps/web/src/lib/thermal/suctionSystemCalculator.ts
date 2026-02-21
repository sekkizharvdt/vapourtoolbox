/**
 * MED Suction System Designer
 *
 * Designs complete pump suction systems for MED thermal desalination plants.
 * Automatically sizes nozzle and suction piping, selects fittings, calculates
 * friction losses (Darcy-Weisbach), computes holdup volume for VFD control,
 * and determines NPSHa for both clean and dirty strainer conditions.
 *
 * Flow path: Vessel nozzle → standpipe (holdup) → reducer → suction pipe
 *   → TEE (1W+1S) → elbow → valve → strainer → pump
 *
 * References:
 * - Crane Technical Paper No. 410 "Flow of Fluids"
 * - Hydraulic Institute ANSI/HI 9.6.1 "NPSHa Margin"
 * - IAPWS-IF97 Steam Tables
 * - Sharqawy et al. (2010) Seawater Correlations
 */

import {
  getSaturationTemperature,
  getSaturationPressure,
  getDensityLiquid,
  mbarAbsToBar,
  getSeawaterDensity,
  getSeawaterViscosity,
  getBoilingPointElevation,
} from '@vapour/constants';

import { selectPipeByVelocity, getPipeByNPS, type SelectedPipe } from './pipeService';
import {
  calculatePressureDrop,
  calculateReducerK,
  K_FACTORS,
  FITTING_NAMES,
  type PressureDropResult,
  type FittingCount,
  type FittingType,
} from './pressureDropCalculator';
import { barToHead, tonHrToM3S, GRAVITY } from './thermalUtils';

// ============================================================================
// Types
// ============================================================================

export type SuctionFluidType = 'brine' | 'distillate';
export type ValveType = 'ball' | 'gate';
export type StrainerType = 'y_type' | 'bucket_type';
export type CalculationMode = 'find_elevation' | 'verify_elevation';

export interface SuctionSystemInput {
  /** Effect pressure in mbar abs */
  effectPressure: number;
  /** Fluid type */
  fluidType: SuctionFluidType;
  /** Salinity in ppm (for brine; ignored for distillate) */
  salinity: number;
  /** Mass flow rate in ton/hr */
  flowRate: number;

  /** Nozzle velocity target in m/s (typ < 0.1) */
  nozzleVelocityTarget: number;
  /** Suction pipe velocity target in m/s (typ 1.0–1.5) */
  suctionVelocityTarget: number;

  /** Number of 90° elbows (default 1) */
  elbowCount: number;
  /** Vertical pipe run in m (nozzle to pump level) */
  verticalPipeRun: number;
  /** Horizontal pipe run in m */
  horizontalPipeRun: number;

  /** Holdup pipe diameter NPS (optional, defaults to nozzle size) */
  holdupPipeDiameter?: string;
  /** Minimum liquid column height for level gauge in m */
  minColumnHeight: number;
  /** Required residence time in seconds */
  residenceTime: number;

  /** Pump NPSHr from datasheet in m */
  pumpNPSHr: number;
  /** Safety margin above NPSHr in m (default 0.5) */
  safetyMargin: number;

  /** Calculation mode */
  mode: CalculationMode;
  /** User-provided elevation in m (only for verify_elevation mode) */
  userElevation?: number;
}

/** Holdup volume calculation result */
export interface HoldupResult {
  /** Holdup pipe NPS */
  holdupPipeNPS: string;
  /** Holdup pipe inner diameter in mm */
  holdupPipeID: number;
  /** Height required from residence time in m */
  heightFromResidenceTime: number;
  /** Height required from min column in m */
  heightFromMinColumn: number;
  /** Governing height (max of both) in m */
  governingHeight: number;
  /** Which constraint governs */
  governingConstraint: 'residence_time' | 'min_column_height';
  /** Holdup volume in litres */
  holdupVolume: number;
  /** Actual residence time at governing height in seconds */
  actualResidenceTime: number;
}

/** Strainer pressure drop for clean and dirty conditions */
export interface StrainerPressureDrop {
  /** Strainer type selected */
  strainerType: StrainerType;
  /** Strainer display name */
  strainerName: string;
  /** Clean strainer K-factor */
  cleanKFactor: number;
  /** Dirty strainer K-factor */
  dirtyKFactor: number;
  /** Clean strainer loss in m H₂O */
  cleanLoss: number;
  /** Dirty strainer loss in m H₂O */
  dirtyLoss: number;
  /** Clean strainer loss in mbar */
  cleanLossMbar: number;
  /** Dirty strainer loss in mbar */
  dirtyLossMbar: number;
}

/** NPSHa result for a single condition (clean or dirty strainer) */
export interface NPSHaCondition {
  /** Condition label */
  label: string;
  /** Static head (elevation) in m */
  staticHead: number;
  /** Pressure head in m */
  pressureHead: number;
  /** Vapor pressure head in m */
  vaporPressureHead: number;
  /** Total friction loss in m */
  frictionLoss: number;
  /** NPSHa in m */
  npsha: number;
  /** Margin over NPSHr in m */
  margin: number;
  /** Whether NPSHa >= NPSHr + safetyMargin */
  isAdequate: boolean;
}

/** Auto-selected fitting detail for display */
export interface AutoSelectedFitting {
  /** Display name */
  name: string;
  /** Fitting type key (undefined for computed fittings like reducer) */
  fittingType?: FittingType;
  /** K-factor */
  kFactor: number;
  /** Count */
  count: number;
  /** Loss in m H₂O */
  loss: number;
}

/** Reducer details for display */
export interface ReducerDetail {
  /** Reducer type */
  type: 'concentric';
  /** Beta ratio (d_small / d_large) */
  beta: number;
  /** K-factor (computed from beta) */
  kFactor: number;
  /** Loss in m H₂O */
  loss: number;
  /** Large pipe NPS */
  largePipeNPS: string;
  /** Small pipe NPS */
  smallPipeNPS: string;
}

/** Complete result from suction system calculation */
export interface SuctionSystemResult {
  // Derived fluid properties
  /** Saturation temperature at effect pressure (pure water) in °C */
  saturationTemperature: number;
  /** Boiling point elevation in °C */
  boilingPointElevation: number;
  /** Fluid temperature (Tsat + BPE) in °C */
  fluidTemperature: number;
  /** Fluid density in kg/m³ */
  fluidDensity: number;
  /** Fluid viscosity in Pa·s */
  fluidViscosity: number;
  /** Vapor pressure at fluid temperature in bar */
  vaporPressure: number;

  // Nozzle sizing
  /** Selected nozzle pipe */
  nozzlePipe: SelectedPipe;
  /** Actual nozzle velocity in m/s */
  nozzleVelocity: number;
  /** Nozzle velocity status */
  nozzleVelocityStatus: 'OK' | 'HIGH' | 'LOW';

  // Suction pipe sizing
  /** Selected suction pipe */
  suctionPipe: SelectedPipe;
  /** Actual suction velocity in m/s */
  suctionVelocity: number;
  /** Suction velocity status */
  suctionVelocityStatus: 'OK' | 'HIGH' | 'LOW';

  // Auto-selected components
  /** Valve type */
  valveType: ValveType;
  /** Strainer type */
  strainerType: StrainerType;
  /** All fittings (excluding strainer, which varies by condition) */
  fittings: AutoSelectedFitting[];
  /** Reducer details (computed from beta ratio) */
  reducer: ReducerDetail;

  // Holdup
  /** Holdup calculation */
  holdup: HoldupResult;

  // Pressure drop
  /** Pressure drop with clean strainer */
  pressureDropClean: PressureDropResult;
  /** Pressure drop with dirty strainer */
  pressureDropDirty: PressureDropResult;
  /** Strainer pressure drop details */
  strainerPressureDrop: StrainerPressureDrop;

  // NPSHa
  /** NPSHa with clean strainer */
  npshaClean: NPSHaCondition;
  /** NPSHa with dirty strainer (worst case) */
  npshaDirty: NPSHaCondition;

  // Elevation
  /** Required minimum elevation (pump CL to vessel nozzle) in m */
  requiredElevation: number;
  /** Elevation breakdown */
  elevationBreakdown: {
    /** Holdup standpipe height in m */
    holdupHeight: number;
    /** Additional height above holdup required for NPSHa in m */
    additionalHeadRequired: number;
    /** Total required elevation in m */
    total: number;
  };

  // Verification (only for verify_elevation mode)
  /** User-provided elevation */
  userElevation?: number;
  /** Whether user elevation is adequate */
  elevationAdequate?: boolean;

  /** Warnings */
  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

const NOZZLE_VELOCITY_MIN = 0.01;
const NOZZLE_VELOCITY_MAX = 0.15;
const SUCTION_VELOCITY_MIN = 0.5;
const SUCTION_VELOCITY_MAX = 2.0;
const NPS_CUTOFF_FOR_GATE_VALVE = 4; // >= 4" uses gate valve, < 4" uses ball valve

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse NPS string to a numeric value for comparisons.
 * Handles fractions: "1/2" → 0.5, "1-1/4" → 1.25, "4" → 4
 */
export function parseNPSToNumber(nps: string): number {
  if (nps.includes('-')) {
    const parts = nps.split('-');
    return parseInt(parts[0]!) + parseFraction(parts[1]!);
  }
  if (nps.includes('/')) {
    return parseFraction(nps);
  }
  return parseFloat(nps);
}

function parseFraction(frac: string): number {
  const parts = frac.split('/');
  return parseInt(parts[0]!) / parseInt(parts[1]!);
}

/**
 * Get fluid properties based on type (matches siphon calculator pattern)
 */
function getFluidProperties(
  fluidType: SuctionFluidType,
  tempC: number,
  salinity: number
): { density: number; viscosity: number } {
  switch (fluidType) {
    case 'brine':
      return {
        density: getSeawaterDensity(salinity, tempC),
        viscosity: getSeawaterViscosity(salinity, tempC),
      };
    case 'distillate':
      return {
        density: getDensityLiquid(tempC),
        viscosity: getSeawaterViscosity(0, tempC),
      };
  }
}

// ============================================================================
// Validation
// ============================================================================

export function validateSuctionSystemInput(input: SuctionSystemInput): string[] {
  const errors: string[] = [];

  // Operating conditions
  if (input.effectPressure <= 0) {
    errors.push('Effect pressure must be positive');
  }
  if (input.effectPressure > 1013.25) {
    errors.push('Effect pressure should be under vacuum (< 1013.25 mbar abs)');
  }
  if (input.fluidType === 'brine' && (input.salinity < 0 || input.salinity > 120000)) {
    errors.push('Salinity must be between 0 and 120,000 ppm');
  }
  if (input.flowRate <= 0) {
    errors.push('Flow rate must be positive');
  }

  // Velocity targets
  if (
    input.nozzleVelocityTarget < NOZZLE_VELOCITY_MIN ||
    input.nozzleVelocityTarget > NOZZLE_VELOCITY_MAX
  ) {
    errors.push(
      `Nozzle velocity target must be between ${NOZZLE_VELOCITY_MIN} and ${NOZZLE_VELOCITY_MAX} m/s`
    );
  }
  if (
    input.suctionVelocityTarget < SUCTION_VELOCITY_MIN ||
    input.suctionVelocityTarget > SUCTION_VELOCITY_MAX
  ) {
    errors.push(
      `Suction velocity target must be between ${SUCTION_VELOCITY_MIN} and ${SUCTION_VELOCITY_MAX} m/s`
    );
  }

  // Geometry
  if (input.elbowCount < 0 || !Number.isInteger(input.elbowCount)) {
    errors.push('Elbow count must be a non-negative integer');
  }
  if (input.verticalPipeRun < 0) {
    errors.push('Vertical pipe run must be non-negative');
  }
  if (input.horizontalPipeRun < 0) {
    errors.push('Horizontal pipe run must be non-negative');
  }

  // Holdup
  if (input.minColumnHeight <= 0) {
    errors.push('Minimum column height must be positive');
  }
  if (input.residenceTime <= 0) {
    errors.push('Residence time must be positive');
  }

  // Pump data
  if (input.pumpNPSHr < 0) {
    errors.push('Pump NPSHr must be non-negative');
  }
  if (input.safetyMargin < 0) {
    errors.push('Safety margin must be non-negative');
  }

  // Verify mode
  if (input.mode === 'verify_elevation') {
    if (input.userElevation === undefined || input.userElevation <= 0) {
      errors.push('User elevation must be positive in verify mode');
    }
  }

  return errors;
}

// ============================================================================
// Main Calculation
// ============================================================================

export function calculateSuctionSystem(input: SuctionSystemInput): SuctionSystemResult {
  const warnings: string[] = [];

  // Validate
  const errors = validateSuctionSystemInput(input);
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  // ---- Step 1: Derive fluid properties from pressure ----
  const effectPressureBar = mbarAbsToBar(input.effectPressure);
  const satTemp = getSaturationTemperature(effectPressureBar);
  const bpe =
    input.fluidType === 'distillate' ? 0 : getBoilingPointElevation(input.salinity, satTemp);
  const fluidTemperature = satTemp + bpe;
  const { density, viscosity } = getFluidProperties(
    input.fluidType,
    fluidTemperature,
    input.salinity
  );
  const vaporPressure = getSaturationPressure(fluidTemperature);

  // Warnings for extreme conditions
  if (effectPressureBar < 0.05) {
    warnings.push(
      `Deep vacuum operation (${input.effectPressure.toFixed(0)} mbar) — verify pump seal compatibility`
    );
  }
  if (fluidTemperature > 90) {
    warnings.push(
      `High fluid temperature (${fluidTemperature.toFixed(1)}°C) — verify pump materials and seal selection`
    );
  }

  // ---- Step 2: Size nozzle pipe ----
  const volumetricFlow = tonHrToM3S(input.flowRate, density);
  const nozzleResult = selectPipeByVelocity(volumetricFlow, input.nozzleVelocityTarget, {
    min: NOZZLE_VELOCITY_MIN,
    max: NOZZLE_VELOCITY_MAX,
  });

  if (nozzleResult.velocityStatus === 'HIGH') {
    warnings.push(
      `Nozzle velocity ${nozzleResult.actualVelocity.toFixed(3)} m/s exceeds recommended maximum of ${NOZZLE_VELOCITY_MAX} m/s`
    );
  }

  // ---- Step 3: Size suction pipe ----
  const suctionResult = selectPipeByVelocity(volumetricFlow, input.suctionVelocityTarget, {
    min: SUCTION_VELOCITY_MIN,
    max: SUCTION_VELOCITY_MAX,
  });

  if (suctionResult.velocityStatus === 'HIGH') {
    warnings.push(
      `Suction velocity ${suctionResult.actualVelocity.toFixed(2)} m/s exceeds recommended maximum of ${SUCTION_VELOCITY_MAX} m/s`
    );
  } else if (suctionResult.velocityStatus === 'LOW') {
    warnings.push(
      `Suction velocity ${suctionResult.actualVelocity.toFixed(2)} m/s is below recommended minimum of ${SUCTION_VELOCITY_MIN} m/s`
    );
  }

  // ---- Step 4: Auto-select fittings based on suction pipe NPS ----
  const suctionNPSNumeric = parseNPSToNumber(suctionResult.nps);
  const valveType: ValveType = suctionNPSNumeric >= NPS_CUTOFF_FOR_GATE_VALVE ? 'gate' : 'ball';
  const strainerType: StrainerType =
    suctionNPSNumeric >= NPS_CUTOFF_FOR_GATE_VALVE ? 'bucket_type' : 'y_type';
  const valveFittingType: FittingType = valveType === 'gate' ? 'gate_valve' : 'ball_valve';

  // Compute reducer K-factor from beta ratio (nozzle → suction pipe)
  const reducerKFactor = calculateReducerK(nozzleResult.id_mm, suctionResult.id_mm, 'concentric');
  const reducerBeta = suctionResult.id_mm / nozzleResult.id_mm;

  // Base fittings (without strainer or reducer — both handled separately)
  const baseFittings: FittingCount[] = [
    { type: 'tee_branch', count: 1 },
    ...(input.elbowCount > 0
      ? [{ type: '90_elbow_standard' as FittingType, count: input.elbowCount }]
      : []),
    { type: valveFittingType, count: 1 },
  ];

  // ---- Step 5: Calculate holdup volume ----
  const holdupPipeNPS = input.holdupPipeDiameter || nozzleResult.nps;
  const holdupPipe = getPipeByNPS(holdupPipeNPS);
  if (!holdupPipe) {
    throw new Error(`Holdup pipe size NPS ${holdupPipeNPS} not found in database`);
  }
  const holdupAreaM2 = holdupPipe.area_mm2 / 1e6;

  const heightFromResidenceTime = (volumetricFlow * input.residenceTime) / holdupAreaM2;
  const heightFromMinColumn = input.minColumnHeight;
  const governingHeight = Math.max(heightFromResidenceTime, heightFromMinColumn);
  const governingConstraint: HoldupResult['governingConstraint'] =
    heightFromResidenceTime >= heightFromMinColumn ? 'residence_time' : 'min_column_height';
  const holdupVolume = holdupAreaM2 * governingHeight * 1000; // m³ to litres
  const actualResidenceTime = (holdupAreaM2 * governingHeight) / volumetricFlow;

  const holdup: HoldupResult = {
    holdupPipeNPS,
    holdupPipeID: holdupPipe.id_mm,
    heightFromResidenceTime,
    heightFromMinColumn,
    governingHeight,
    governingConstraint,
    holdupVolume,
    actualResidenceTime,
  };

  // ---- Step 6 & 7: Calculate friction losses (clean and dirty strainer) ----
  const totalPipeLength = input.verticalPipeRun + input.horizontalPipeRun;

  const cleanStrainerType: FittingType =
    strainerType === 'y_type' ? 'strainer_y_clean' : 'strainer_bucket_clean';
  const dirtyStrainerType: FittingType =
    strainerType === 'y_type' ? 'strainer_y_dirty' : 'strainer_bucket_dirty';

  const cleanFittings: FittingCount[] = [...baseFittings, { type: cleanStrainerType, count: 1 }];
  const dirtyFittings: FittingCount[] = [...baseFittings, { type: dirtyStrainerType, count: 1 }];

  const pressureDropClean = calculatePressureDrop({
    pipeNPS: suctionResult.nps,
    pipeLength: totalPipeLength,
    flowRate: input.flowRate,
    fluidDensity: density,
    fluidViscosity: viscosity,
    fittings: cleanFittings,
  });

  const pressureDropDirty = calculatePressureDrop({
    pipeNPS: suctionResult.nps,
    pipeLength: totalPipeLength,
    flowRate: input.flowRate,
    fluidDensity: density,
    fluidViscosity: viscosity,
    fittings: dirtyFittings,
  });

  // ---- Reducer pressure drop (computed from beta, added separately) ----
  const velocityHead =
    (suctionResult.actualVelocity * suctionResult.actualVelocity) / (2 * GRAVITY);
  const reducerLoss = reducerKFactor * velocityHead;

  // Add reducer loss to both pressure drop results
  // (reducer K is referenced to the smaller pipe velocity, which is the suction pipe)
  pressureDropClean.totalPressureDropMH2O += reducerLoss;
  pressureDropClean.totalPressureDropBar += (reducerLoss * density * GRAVITY) / 100000;
  pressureDropClean.totalPressureDropMbar += (reducerLoss * density * GRAVITY) / 100;
  pressureDropClean.totalPressureDropKPa += (reducerLoss * density * GRAVITY) / 1000;
  pressureDropClean.fittingsLoss += reducerLoss;
  pressureDropClean.fittingsBreakdown.push({
    type: 'reducer_sudden' as FittingType, // Use for display mapping
    count: 1,
    kFactor: reducerKFactor,
    loss: reducerLoss,
  });

  pressureDropDirty.totalPressureDropMH2O += reducerLoss;
  pressureDropDirty.totalPressureDropBar += (reducerLoss * density * GRAVITY) / 100000;
  pressureDropDirty.totalPressureDropMbar += (reducerLoss * density * GRAVITY) / 100;
  pressureDropDirty.totalPressureDropKPa += (reducerLoss * density * GRAVITY) / 1000;
  pressureDropDirty.fittingsLoss += reducerLoss;
  pressureDropDirty.fittingsBreakdown.push({
    type: 'reducer_sudden' as FittingType,
    count: 1,
    kFactor: reducerKFactor,
    loss: reducerLoss,
  });

  const reducer: ReducerDetail = {
    type: 'concentric',
    beta: reducerBeta,
    kFactor: reducerKFactor,
    loss: reducerLoss,
    largePipeNPS: nozzleResult.nps,
    smallPipeNPS: suctionResult.nps,
  };

  // ---- Strainer pressure drop details ----

  const { cleanKFactor, dirtyKFactor } = getStrainerKFactors(strainerType);
  const cleanStrainerLoss = cleanKFactor * velocityHead;
  const dirtyStrainerLoss = dirtyKFactor * velocityHead;

  // Convert to mbar: loss_mbar = loss_mH2O × density × g / 100
  const cleanLossMbar = (cleanStrainerLoss * density * GRAVITY) / 100;
  const dirtyLossMbar = (dirtyStrainerLoss * density * GRAVITY) / 100;

  const strainerPressureDrop: StrainerPressureDrop = {
    strainerType,
    strainerName: strainerType === 'y_type' ? 'Y-Type Strainer' : 'Bucket Strainer',
    cleanKFactor,
    dirtyKFactor,
    cleanLoss: cleanStrainerLoss,
    dirtyLoss: dirtyStrainerLoss,
    cleanLossMbar,
    dirtyLossMbar,
  };

  // ---- Step 8 & 9: Calculate NPSHa and required elevation ----
  const pressureHead = barToHead(effectPressureBar, density);
  const vaporPressureHead = barToHead(vaporPressure, density);

  // For find_elevation mode: solve for required static head using dirty strainer (worst case)
  // NPSHa = Hs + Hp - Hvp - Hf
  // Required: NPSHa >= NPSHr + margin
  // Therefore: Hs >= NPSHr + margin - Hp + Hvp + Hf_dirty
  const requiredStaticHead =
    input.pumpNPSHr +
    input.safetyMargin -
    pressureHead +
    vaporPressureHead +
    pressureDropDirty.totalPressureDropMH2O;

  // Required elevation must accommodate both holdup height and NPSHa-driven static head
  const requiredElevation = Math.max(requiredStaticHead, holdup.governingHeight + 0.3);

  const elevationBreakdown = {
    holdupHeight: holdup.governingHeight,
    additionalHeadRequired: Math.max(0, requiredStaticHead - holdup.governingHeight),
    total: requiredElevation,
  };

  // Compute NPSHa for both conditions at the determined elevation
  const staticHead = input.mode === 'verify_elevation' ? input.userElevation! : requiredElevation;

  const npshaClean = computeNPSHaCondition(
    'Clean Strainer',
    staticHead,
    pressureHead,
    vaporPressureHead,
    pressureDropClean.totalPressureDropMH2O,
    input.pumpNPSHr,
    input.safetyMargin
  );

  const npshaDirty = computeNPSHaCondition(
    'Dirty Strainer',
    staticHead,
    pressureHead,
    vaporPressureHead,
    pressureDropDirty.totalPressureDropMH2O,
    input.pumpNPSHr,
    input.safetyMargin
  );

  // NPSHa warnings
  if (npshaDirty.npsha < 0) {
    warnings.push('CRITICAL: NPSHa is negative with dirty strainer — pump will cavitate');
  } else if (npshaDirty.margin < 0) {
    warnings.push(
      `NPSHa (${npshaDirty.npsha.toFixed(2)} m) is less than NPSHr (${input.pumpNPSHr} m) with dirty strainer`
    );
  } else if (npshaDirty.margin < input.safetyMargin) {
    warnings.push(
      `NPSHa margin (${npshaDirty.margin.toFixed(2)} m) is less than recommended safety margin (${input.safetyMargin} m) with dirty strainer`
    );
  }

  // Build fittings detail for display (includes reducer as first entry)
  const fittingsDetail: AutoSelectedFitting[] = [
    {
      name: `Concentric Reducer (${nozzleResult.nps}" → ${suctionResult.nps}", \u03B2=${reducerBeta.toFixed(3)})`,
      kFactor: reducerKFactor,
      count: 1,
      loss: reducerLoss,
    },
    ...buildFittingsDetail(baseFittings, velocityHead),
  ];

  // Verification
  let elevationAdequate: boolean | undefined;
  if (input.mode === 'verify_elevation') {
    elevationAdequate = npshaDirty.isAdequate;
  }

  return {
    saturationTemperature: satTemp,
    boilingPointElevation: bpe,
    fluidTemperature,
    fluidDensity: density,
    fluidViscosity: viscosity,
    vaporPressure,

    nozzlePipe: nozzleResult,
    nozzleVelocity: nozzleResult.actualVelocity,
    nozzleVelocityStatus: nozzleResult.velocityStatus,

    suctionPipe: suctionResult,
    suctionVelocity: suctionResult.actualVelocity,
    suctionVelocityStatus: suctionResult.velocityStatus,

    valveType,
    strainerType,
    fittings: fittingsDetail,
    reducer,

    holdup,

    pressureDropClean,
    pressureDropDirty,
    strainerPressureDrop,

    npshaClean,
    npshaDirty,

    requiredElevation,
    elevationBreakdown,

    userElevation: input.mode === 'verify_elevation' ? input.userElevation : undefined,
    elevationAdequate,

    warnings,
  };
}

// ============================================================================
// Internal Helpers
// ============================================================================

function computeNPSHaCondition(
  label: string,
  staticHead: number,
  pressureHead: number,
  vaporPressureHead: number,
  frictionLoss: number,
  pumpNPSHr: number,
  safetyMargin: number
): NPSHaCondition {
  const npsha = staticHead + pressureHead - vaporPressureHead - frictionLoss;
  const margin = npsha - pumpNPSHr;
  return {
    label,
    staticHead,
    pressureHead,
    vaporPressureHead,
    frictionLoss,
    npsha,
    margin,
    isAdequate: margin >= safetyMargin,
  };
}

function getStrainerKFactors(strainerType: StrainerType): {
  cleanKFactor: number;
  dirtyKFactor: number;
} {
  if (strainerType === 'y_type') {
    return { cleanKFactor: 2.0, dirtyKFactor: 8.0 };
  }
  return { cleanKFactor: 4.0, dirtyKFactor: 12.0 };
}

function buildFittingsDetail(
  baseFittings: FittingCount[],
  velocityHead: number
): AutoSelectedFitting[] {
  return baseFittings.map((f) => ({
    name: FITTING_NAMES[f.type],
    fittingType: f.type,
    kFactor: K_FACTORS[f.type],
    count: f.count,
    loss: K_FACTORS[f.type] * f.count * velocityHead,
  }));
}
