/**
 * Iterative Heat Exchanger Design — Type Definitions
 *
 * Types for the unified, iterative shell-and-tube heat exchanger sizing engine
 * that integrates heat duty, LMTD, HTC correlations, and geometric sizing
 * into a single convergent design loop.
 */

import type { FluidType } from './fluidProperties';
import type { TubeLayout, TubeSpec } from './heatExchangerSizing';
import type { FlowArrangement } from './heatDutyCalculator';
import type { OverallHTCResult } from './heatTransfer';

// ============================================================================
// Exchanger Configuration
// ============================================================================

/**
 * Exchanger type determines which HTC correlations are used.
 *
 * CONDENSER: Shell-side condensation (Nusselt) + tube-side forced convection (Dittus-Boelter)
 * EVAPORATOR: Reserved for Phase 2 (Chen/Mostinski + Dittus-Boelter)
 * LIQUID_LIQUID: Reserved for Phase 2 (Bell-Delaware + Dittus-Boelter)
 */
export type ExchangerType = 'CONDENSER' | 'EVAPORATOR' | 'LIQUID_LIQUID';

/**
 * Tube orientation for Nusselt condensation correlation.
 * Horizontal is standard for shell-and-tube condensers.
 */
export type TubeOrientation = 'horizontal' | 'vertical';

// ============================================================================
// Fluid Specification
// ============================================================================

/** Specification for a fluid stream (tube-side or shell-side) */
export interface FluidSpec {
  /** Fluid type */
  fluid: FluidType;
  /** Salinity in ppm (required for SEAWATER) */
  salinity?: number;
  /** Mass flow rate in ton/hr */
  massFlowRate: number;
  /** Inlet temperature in °C */
  inletTemp: number;
  /** Outlet temperature in °C (for sensible heat streams) */
  outletTemp: number;
}

/** Specification for a condensing/evaporating stream on the shell side */
export interface ShellSideCondensing {
  /** Mass flow rate of condensing vapor in ton/hr */
  massFlowRate: number;
  /** Saturation temperature in °C */
  saturationTemp: number;
}

// ============================================================================
// Tube Geometry Specification
// ============================================================================

/** Tube geometry and material selection */
export interface TubeGeometrySpec {
  /** Tube spec index into STANDARD_TUBES array */
  tubeSpecIndex: number;
  /** Tube material key into TUBE_MATERIALS */
  tubeMaterial: string;
  /** Tube layout pattern */
  tubeLayout: TubeLayout;
  /** Pitch-to-OD ratio (≥ 1.25 per TEMA) */
  pitchRatio?: number;
  /** Number of tube passes (1, 2, 4, or 6) */
  tubePasses: number;
  /** Effective tube length in m (between tube sheets) */
  tubeLength: number;
}

/** Fouling resistance specification */
export interface FoulingSpec {
  /** Tube-side fouling resistance in m²·K/W */
  tubeSide: number;
  /** Shell-side fouling resistance in m²·K/W */
  shellSide: number;
}

// ============================================================================
// Design Input
// ============================================================================

/** Complete input for the iterative heat exchanger design */
export interface IterativeHXInput {
  /** Exchanger type */
  exchangerType: ExchangerType;

  /** Tube-side fluid specification */
  tubeSide: FluidSpec;

  /** Shell-side specification — condensing vapor for CONDENSER type */
  shellSide: ShellSideCondensing;

  /** Flow arrangement for LMTD calculation */
  flowArrangement: FlowArrangement;

  /** Tube orientation (horizontal or vertical) */
  tubeOrientation: TubeOrientation;

  /** Tube geometry specification */
  tubeGeometry: TubeGeometrySpec;

  /** Fouling resistances */
  fouling: FoulingSpec;

  /** Convergence tolerance as fraction (default 0.05 = 5%) */
  convergenceTolerance?: number;

  /** Maximum iterations (default 20) */
  maxIterations?: number;

  /** Under-relaxation factor for U updates (default 0.7) */
  relaxationFactor?: number;
}

// ============================================================================
// Iteration Tracking
// ============================================================================

/** Snapshot of a single iteration step */
export interface IterationStep {
  /** Iteration number (1-based) */
  iteration: number;
  /** Assumed overall HTC at start of this iteration (W/m²·K) */
  assumedU: number;
  /** Calculated overall HTC from correlations (W/m²·K) */
  calculatedU: number;
  /** Required clean area for this iteration (m²) */
  requiredArea: number;
  /** Tube count for this iteration */
  tubeCount: number;
  /** Tube-side velocity for this iteration (m/s) */
  tubeSideVelocity: number;
  /** Tube-side HTC (W/m²·K) */
  tubeSideHTC: number;
  /** Shell-side HTC (W/m²·K) */
  shellSideHTC: number;
  /** Relative error |U_calc - U_assumed| / U_calc */
  relativeError: number;
}

// ============================================================================
// Design Result
// ============================================================================

/** Heat duty breakdown */
export interface HeatDutyResult {
  /** Heat duty in kW */
  heatDutyKW: number;
  /** Calculation method used */
  method: 'SENSIBLE' | 'LATENT';
  /** Specific heat used (for sensible), kJ/(kg·K) */
  specificHeat?: number;
  /** Latent heat used (for latent), kJ/kg */
  latentHeat?: number;
  /** Mass flow rate in kg/s */
  massFlowKgS: number;
}

/** LMTD calculation result */
export interface LMTDResultSummary {
  /** Raw LMTD in °C */
  lmtd: number;
  /** Correction factor (1.0 for counter-current) */
  correctionFactor: number;
  /** Corrected LMTD in °C */
  correctedLMTD: number;
  /** ΔT at hot end (°C) */
  deltaT1: number;
  /** ΔT at cold end (°C) */
  deltaT2: number;
}

/** Velocity and pressure drop summary */
export interface VelocityResult {
  /** Tube-side velocity in m/s */
  tubeSideVelocity: number;
  /** Tube-side pressure drop in Pa */
  tubeSidePressureDrop: number;
  /** Tube-side Reynolds number */
  tubeSideReynolds: number;
  /** Tube-side friction factor */
  tubeSideFrictionFactor: number;
}

/** Geometry sizing result */
export interface GeometryResult {
  /** Selected tube spec */
  tubeSpec: TubeSpec;
  /** Tube material label */
  tubeMaterial: string;
  /** Tube material conductivity (W/m·K) */
  tubeMaterialConductivity: number;
  /** Tube pitch (mm) */
  tubePitch: number;
  /** Tube layout */
  tubeLayout: TubeLayout;
  /** Number of tube passes */
  tubePasses: number;
  /** Effective tube length (m) */
  tubeLength: number;
  /** Required clean area (m²) */
  requiredArea: number;
  /** Actual area provided (m²) */
  actualArea: number;
  /** Excess area (%) */
  excessArea: number;
  /** Required tube count (fractional) */
  requiredTubeCount: number;
  /** Actual tube count (rounded, divisible by passes) */
  actualTubeCount: number;
  /** Bundle diameter (mm) */
  bundleDiameter: number;
  /** Selected standard shell ID (mm) */
  shellID: number;
  /** Bundle-to-shell clearance (mm) */
  bundleClearance: number;
  /** Tube-side flow area per pass (m²) */
  tubeSideFlowArea: number;
  /** Shell-side cross-flow area (m²) */
  shellSideFlowArea: number;
}

/** Complete result of the iterative design */
export interface IterativeHXResult {
  /** Whether the iteration converged */
  converged: boolean;
  /** Number of iterations performed */
  iterationCount: number;

  /** Heat duty breakdown */
  heatDuty: HeatDutyResult;

  /** LMTD calculation result */
  lmtdResult: LMTDResultSummary;

  /** Final overall HTC and resistance breakdown */
  htcResult: OverallHTCResult;

  /** Final tube-side HTC (W/m²·K) */
  tubeSideHTC: number;
  /** Final shell-side HTC (W/m²·K) */
  shellSideHTC: number;

  /** Geometry sizing result */
  geometry: GeometryResult;

  /** Velocity and pressure drop */
  velocity: VelocityResult;

  /** Full iteration history */
  iterations: IterationStep[];

  /** Design warnings */
  warnings: string[];
}
