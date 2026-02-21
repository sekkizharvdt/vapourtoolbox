/**
 * Pressure Drop Calculator
 *
 * Calculate pressure drop in piping systems using Darcy-Weisbach equation
 * with Colebrook-White friction factor.
 *
 * References:
 * - Crane Technical Paper No. 410 "Flow of Fluids"
 * - Perry's Chemical Engineers' Handbook
 */

import { getPipeByNPS, type PipeVariant } from './pipeService';
import {
  GRAVITY,
  tonHrToKgS,
  mH2OToBar as _mH2OToBar,
  barToMH2O as _barToMH2O,
} from './thermalUtils';

// Re-export for backward compatibility
export const mH2OToBar = _mH2OToBar;
export const barToMH2O = _barToMH2O;

// ============================================================================
// Types
// ============================================================================

/**
 * Fitting types with their K-factors
 */
export type FittingType =
  | '90_elbow_standard'
  | '90_elbow_long_radius'
  | '45_elbow'
  | 'tee_through'
  | 'tee_branch'
  | 'gate_valve'
  | 'globe_valve'
  | 'ball_valve'
  | 'check_valve_swing'
  | 'check_valve_lift'
  | 'butterfly_valve'
  | 'reducer_sudden'
  | 'expander_sudden'
  | 'entrance_sharp'
  | 'entrance_rounded'
  | 'exit'
  | 'strainer_y_clean'
  | 'strainer_y_dirty'
  | 'strainer_bucket_clean'
  | 'strainer_bucket_dirty';

/**
 * Fitting count entry
 */
export interface FittingCount {
  type: FittingType;
  count: number;
}

/**
 * Input parameters for pressure drop calculation
 */
export interface PressureDropInput {
  /** Pipe size (NPS) */
  pipeNPS: string;
  /** Pipe length in meters */
  pipeLength: number;
  /** Mass flow rate in ton/hr */
  flowRate: number;
  /** Fluid density in kg/m³ */
  fluidDensity: number;
  /** Fluid dynamic viscosity in Pa·s */
  fluidViscosity: number;
  /** Pipe roughness in mm (default: 0.045 for commercial steel) */
  roughness?: number;
  /** List of fittings */
  fittings?: FittingCount[];
  /** Elevation change in m (positive = upward) */
  elevationChange?: number;
}

/**
 * Result of pressure drop calculation
 */
export interface PressureDropResult {
  /** Flow velocity in m/s */
  velocity: number;
  /** Reynolds number (dimensionless) */
  reynoldsNumber: number;
  /** Flow regime */
  flowRegime: 'laminar' | 'transitional' | 'turbulent';
  /** Darcy friction factor (dimensionless) */
  frictionFactor: number;
  /** Pressure drop in straight pipe in m H₂O */
  straightPipeLoss: number;
  /** Pressure drop in fittings in m H₂O */
  fittingsLoss: number;
  /** Fittings breakdown */
  fittingsBreakdown: Array<{ type: FittingType; count: number; kFactor: number; loss: number }>;
  /** Total K-factor for fittings */
  totalKFactor: number;
  /** Equivalent length of fittings in m */
  equivalentLength: number;
  /** Static head from elevation in m H₂O (positive = additional head required) */
  elevationHead: number;
  /** Total pressure drop in m H₂O */
  totalPressureDropMH2O: number;
  /** Total pressure drop in bar */
  totalPressureDropBar: number;
  /** Total pressure drop in mbar */
  totalPressureDropMbar: number;
  /** Total pressure drop in kPa */
  totalPressureDropKPa: number;
  /** Pipe data used */
  pipe: PipeVariant;
  /** Warnings */
  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * K-factors for common fittings (dimensionless)
 * Based on Crane TP-410 and industry standards
 */
export const K_FACTORS: Record<FittingType, number> = {
  '90_elbow_standard': 0.75,
  '90_elbow_long_radius': 0.45,
  '45_elbow': 0.35,
  tee_through: 0.4,
  tee_branch: 1.5,
  gate_valve: 0.17,
  globe_valve: 6.0,
  ball_valve: 0.05,
  check_valve_swing: 2.0,
  check_valve_lift: 10.0,
  butterfly_valve: 0.3,
  reducer_sudden: 0.5,
  expander_sudden: 1.0,
  entrance_sharp: 0.5,
  entrance_rounded: 0.04,
  exit: 1.0,
  strainer_y_clean: 2.0,
  strainer_y_dirty: 8.0,
  strainer_bucket_clean: 4.0,
  strainer_bucket_dirty: 12.0,
};

/**
 * Fitting display names
 */
export const FITTING_NAMES: Record<FittingType, string> = {
  '90_elbow_standard': '90° Elbow (Standard)',
  '90_elbow_long_radius': '90° Elbow (Long Radius)',
  '45_elbow': '45° Elbow',
  tee_through: 'Tee (Flow Through)',
  tee_branch: 'Tee (Flow to Branch)',
  gate_valve: 'Gate Valve (Open)',
  globe_valve: 'Globe Valve (Open)',
  ball_valve: 'Ball Valve (Open)',
  check_valve_swing: 'Check Valve (Swing)',
  check_valve_lift: 'Check Valve (Lift)',
  butterfly_valve: 'Butterfly Valve (Open)',
  reducer_sudden: 'Sudden Contraction',
  expander_sudden: 'Sudden Expansion',
  entrance_sharp: 'Pipe Entrance (Sharp)',
  entrance_rounded: 'Pipe Entrance (Rounded)',
  exit: 'Pipe Exit',
  strainer_y_clean: 'Y-Strainer (Clean)',
  strainer_y_dirty: 'Y-Strainer (Dirty)',
  strainer_bucket_clean: 'Bucket Strainer (Clean)',
  strainer_bucket_dirty: 'Bucket Strainer (Dirty)',
};

/** Default pipe roughness for commercial steel (mm) */
const DEFAULT_ROUGHNESS_MM = 0.045;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate Reynolds number
 *
 * Re = ρ × v × D / μ
 *
 * @param density - Fluid density in kg/m³
 * @param velocity - Flow velocity in m/s
 * @param diameter - Pipe inner diameter in m
 * @param viscosity - Dynamic viscosity in Pa·s
 * @returns Reynolds number (dimensionless)
 */
export function calculateReynoldsNumber(
  density: number,
  velocity: number,
  diameter: number,
  viscosity: number
): number {
  return (density * velocity * diameter) / viscosity;
}

/**
 * Calculate Darcy friction factor using Colebrook-White equation
 *
 * For turbulent flow: 1/√f = -2 × log₁₀(ε/(3.7D) + 2.51/(Re×√f))
 * For laminar flow: f = 64/Re
 *
 * Uses Swamee-Jain approximation for direct calculation.
 *
 * @param reynoldsNumber - Reynolds number
 * @param relativRoughness - Pipe roughness / pipe diameter (dimensionless)
 * @returns Darcy friction factor (dimensionless)
 */
export function calculateFrictionFactor(reynoldsNumber: number, relativeRoughness: number): number {
  // Laminar flow
  if (reynoldsNumber <= 2300) {
    return 64 / reynoldsNumber;
  }

  // Transitional flow - use average of laminar and turbulent
  if (reynoldsNumber < 4000) {
    const fLaminar = 64 / 2300;
    const fTurbulent = calculateTurbulentFrictionFactor(4000, relativeRoughness);
    const fraction = (reynoldsNumber - 2300) / (4000 - 2300);
    return fLaminar + fraction * (fTurbulent - fLaminar);
  }

  // Turbulent flow - Swamee-Jain approximation
  return calculateTurbulentFrictionFactor(reynoldsNumber, relativeRoughness);
}

/**
 * Calculate K-factor for a concentric or eccentric reducer (contraction)
 *
 * Based on Crane TP-410:
 * - Gradual contraction (cone angle < 45°): K = 0.5 × (1 - β²)²
 * - Eccentric reducer: ~20% higher than concentric
 *
 * @param dLargeMm - Larger pipe inner diameter in mm
 * @param dSmallMm - Smaller pipe inner diameter in mm
 * @param type - 'concentric' or 'eccentric'
 * @returns K-factor (dimensionless), referenced to the smaller (downstream) pipe velocity
 */
export function calculateReducerK(
  dLargeMm: number,
  dSmallMm: number,
  type: 'concentric' | 'eccentric' = 'concentric'
): number {
  if (dSmallMm >= dLargeMm) return 0; // No reduction
  const beta = dSmallMm / dLargeMm;
  const k = 0.5 * Math.pow(1 - beta * beta, 2);
  return type === 'eccentric' ? k * 1.2 : k;
}

/**
 * Calculate K-factor for a concentric or eccentric expander (enlargement)
 *
 * Based on Crane TP-410 (Borda-Carnot):
 * - Gradual expansion: K = (1 - β²)²
 * - Eccentric expander: ~20% higher than concentric
 *
 * @param dSmallMm - Smaller (upstream) pipe inner diameter in mm
 * @param dLargeMm - Larger (downstream) pipe inner diameter in mm
 * @param type - 'concentric' or 'eccentric'
 * @returns K-factor (dimensionless), referenced to the smaller (upstream) pipe velocity
 */
export function calculateExpanderK(
  dSmallMm: number,
  dLargeMm: number,
  type: 'concentric' | 'eccentric' = 'concentric'
): number {
  if (dSmallMm >= dLargeMm) return 0; // No expansion
  const beta = dSmallMm / dLargeMm;
  const k = Math.pow(1 - beta * beta, 2);
  return type === 'eccentric' ? k * 1.2 : k;
}

/**
 * Swamee-Jain approximation for turbulent friction factor
 * Valid for 5000 < Re < 10^8 and 10^-6 < ε/D < 10^-2
 */
function calculateTurbulentFrictionFactor(
  reynoldsNumber: number,
  relativeRoughness: number
): number {
  const term1 = relativeRoughness / 3.7;
  const term2 = 5.74 / Math.pow(reynoldsNumber, 0.9);
  const denominator = Math.log10(term1 + term2);
  return 0.25 / Math.pow(denominator, 2);
}

// ============================================================================
// Main Calculation Function
// ============================================================================

/**
 * Calculate pressure drop in a piping system
 *
 * Uses Darcy-Weisbach equation:
 * ΔP = f × (L/D) × (ρv²/2) + ΣK × (ρv²/2) + ρgh
 *
 * @param input - Pressure drop calculation input
 * @returns Pressure drop calculation result
 */
export function calculatePressureDrop(input: PressureDropInput): PressureDropResult {
  const warnings: string[] = [];

  // Get pipe data
  const pipe = getPipeByNPS(input.pipeNPS);
  if (!pipe) {
    throw new Error(`Pipe size NPS ${input.pipeNPS} not found in database`);
  }

  // Convert units
  const diameterM = pipe.id_mm / 1000; // mm to m
  const areaM2 = pipe.area_mm2 / 1e6; // mm² to m²
  const roughnessM = (input.roughness ?? DEFAULT_ROUGHNESS_MM) / 1000; // mm to m
  const relativeRoughness = roughnessM / diameterM;

  // Calculate velocity
  // Q = m / ρ (m³/s)
  // v = Q / A
  const massFlowKgS = tonHrToKgS(input.flowRate);
  const volumetricFlowM3S = massFlowKgS / input.fluidDensity;
  const velocity = volumetricFlowM3S / areaM2;

  // Check velocity
  if (velocity < 0.3) {
    warnings.push(`Low velocity (${velocity.toFixed(2)} m/s) - risk of solids settling`);
  } else if (velocity > 5) {
    warnings.push(`High velocity (${velocity.toFixed(2)} m/s) - risk of erosion`);
  }

  // Calculate Reynolds number
  const reynoldsNumber = calculateReynoldsNumber(
    input.fluidDensity,
    velocity,
    diameterM,
    input.fluidViscosity
  );

  // Determine flow regime
  let flowRegime: 'laminar' | 'transitional' | 'turbulent';
  if (reynoldsNumber <= 2300) {
    flowRegime = 'laminar';
  } else if (reynoldsNumber < 4000) {
    flowRegime = 'transitional';
    warnings.push('Flow is in transitional regime - results may be less accurate');
  } else {
    flowRegime = 'turbulent';
  }

  // Calculate friction factor
  const frictionFactor = calculateFrictionFactor(reynoldsNumber, relativeRoughness);

  // Calculate straight pipe pressure drop (Darcy-Weisbach)
  // ΔP = f × (L/D) × (ρv²/2)
  // In head form: h = f × (L/D) × (v²/2g)
  const velocityHead = (velocity * velocity) / (2 * GRAVITY); // m
  const straightPipeLoss = frictionFactor * (input.pipeLength / diameterM) * velocityHead;

  // Calculate fittings pressure drop
  const fittingsBreakdown: PressureDropResult['fittingsBreakdown'] = [];
  let totalKFactor = 0;

  if (input.fittings) {
    for (const fitting of input.fittings) {
      if (fitting.count <= 0) continue;

      const kFactor = K_FACTORS[fitting.type];
      const fittingTotalK = kFactor * fitting.count;
      const fittingLoss = fittingTotalK * velocityHead;

      fittingsBreakdown.push({
        type: fitting.type,
        count: fitting.count,
        kFactor,
        loss: fittingLoss,
      });

      totalKFactor += fittingTotalK;
    }
  }

  const fittingsLoss = totalKFactor * velocityHead;

  // Calculate equivalent length of fittings
  // Le = K × D / f
  const equivalentLength = frictionFactor > 0 ? (totalKFactor * diameterM) / frictionFactor : 0;

  // Calculate elevation head
  // Positive elevation change = additional head required to pump upward
  const elevationHead = input.elevationChange ?? 0;

  // Total pressure drop
  const totalPressureDropMH2O = straightPipeLoss + fittingsLoss + elevationHead;
  const totalPressureDropBar = mH2OToBar(totalPressureDropMH2O, input.fluidDensity);
  const totalPressureDropMbar = totalPressureDropBar * 1000;
  const totalPressureDropKPa = totalPressureDropBar * 100;

  return {
    velocity,
    reynoldsNumber,
    flowRegime,
    frictionFactor,
    straightPipeLoss,
    fittingsLoss,
    fittingsBreakdown,
    totalKFactor,
    equivalentLength,
    elevationHead,
    totalPressureDropMH2O,
    totalPressureDropBar,
    totalPressureDropMbar,
    totalPressureDropKPa,
    pipe,
    warnings,
  };
}

/**
 * Get all available fitting types with their K-factors
 */
export function getAvailableFittings(): Array<{
  type: FittingType;
  name: string;
  kFactor: number;
}> {
  return (Object.keys(K_FACTORS) as FittingType[]).map((type) => ({
    type,
    name: FITTING_NAMES[type],
    kFactor: K_FACTORS[type],
  }));
}
