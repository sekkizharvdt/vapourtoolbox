/**
 * Iterative Heat Exchanger Design Engine
 *
 * Integrates heat duty, LMTD, HTC correlations (Dittus-Boelter + Nusselt),
 * and geometric sizing into a single convergent design loop.
 *
 * Algorithm:
 *   1. Calculate Q from process conditions
 *   2. Calculate LMTD from temperature profile
 *   3. Assume initial U from typical values
 *   4. Loop:
 *      a. A_required = Q / (U × LMTD)
 *      b. Size geometry (tube count, bundle, shell)
 *      c. Calculate tube-side velocity and HTC (Dittus-Boelter)
 *      d. Estimate wall temperature, calculate shell-side HTC (Nusselt)
 *      e. Calculate U from composite resistance
 *      f. Check convergence; if not converged, relax U and repeat
 *   5. Return complete design with iteration history
 *
 * References:
 *   - Kern's Process Heat Transfer (bundle diameter, overall HTC)
 *   - TEMA Standards (tube geometry, shell sizing)
 *   - Dittus-Boelter (tube-side forced convection)
 *   - Nusselt film condensation (shell-side)
 */

import { getFluidProperties, getSaturationProperties } from './fluidProperties';
import type { SaturationFluidProperties } from './fluidProperties';
import {
  calculateSensibleHeat,
  calculateLatentHeat,
  calculateLMTD,
  TYPICAL_HTC,
} from './heatDutyCalculator';
import {
  calculateTubeSideHTC,
  calculateNusseltCondensation,
  calculateOverallHTC,
} from './heatTransfer';
import type { OverallHTCResult } from './heatTransfer';
import {
  sizeHeatExchanger,
  calculateTubeSideVelocity,
  estimateTubeSidePressureDrop,
  STANDARD_TUBES,
  TUBE_MATERIALS,
} from './heatExchangerSizing';
import { tonHrToKgS } from './thermalUtils';
import type {
  IterativeHXInput,
  IterativeHXResult,
  IterationStep,
  HeatDutyResult,
  LMTDResultSummary,
  VelocityResult,
  GeometryResult,
} from './iterativeHXDesign.types';

// ============================================================================
// Constants
// ============================================================================

/** Default convergence tolerance (fraction) */
const DEFAULT_TOLERANCE = 0.05;

/** Default maximum iterations */
const DEFAULT_MAX_ITERATIONS = 20;

/** Default under-relaxation factor */
const DEFAULT_RELAXATION = 0.7;

/** Minimum velocity for meaningful HTC calculation (m/s) */
const MIN_VELOCITY = 0.1;

/** Typical initial U for condenser design (W/m²·K) */
const INITIAL_U_CONDENSER = TYPICAL_HTC.steam_to_water?.typical ?? 2500;

// ============================================================================
// Main Design Function
// ============================================================================

/**
 * Run the iterative heat exchanger design.
 *
 * Currently supports CONDENSER type only (shell-side condensation + tube-side
 * forced convection). Returns a complete design with iteration history.
 *
 * @param input - Complete design input
 * @returns Design result with convergence status and all intermediate data
 * @throws Error if input validation fails
 */
export function designHeatExchanger(input: IterativeHXInput): IterativeHXResult {
  // ── Validation ─────────────────────────────────────────────────────────
  validateInput(input);

  const {
    exchangerType,
    tubeSide,
    shellSide,
    flowArrangement,
    tubeOrientation,
    tubeGeometry,
    fouling,
    convergenceTolerance = DEFAULT_TOLERANCE,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    relaxationFactor = DEFAULT_RELAXATION,
  } = input;

  const warnings: string[] = [];

  // ── Step 1: Calculate heat duty ────────────────────────────────────────
  const heatDuty = calculateHeatDutyForCondenser(tubeSide, shellSide, warnings);

  // ── Step 2: Calculate LMTD ─────────────────────────────────────────────
  const lmtdResult = calculateLMTDForCondenser(tubeSide, shellSide, flowArrangement, warnings);

  if (lmtdResult.correctedLMTD <= 0) {
    throw new Error('Invalid temperature profile — LMTD is zero or negative');
  }

  // ── Step 3: Get fluid properties at operating conditions ───────────────
  const tubeMeanTemp = (tubeSide.inletTemp + tubeSide.outletTemp) / 2;
  const tubeProps = getFluidProperties(tubeSide.fluid, tubeMeanTemp, tubeSide.salinity);
  const satProps = getSaturationProperties(shellSide.saturationTemp);

  // ── Step 4: Initial U assumption ───────────────────────────────────────
  let assumedU = getInitialU(exchangerType);

  // ── Step 5: Iterative design loop ──────────────────────────────────────
  const iterations: IterationStep[] = [];
  let converged = false;
  let finalHtcResult: OverallHTCResult | null = null;
  let finalTubeSideHTC = 0;
  let finalShellSideHTC = 0;
  let finalSizingResult = null as ReturnType<typeof sizeHeatExchanger> | null;
  let finalVelocity = 0;

  const tubeSpec = STANDARD_TUBES[tubeGeometry.tubeSpecIndex];
  if (!tubeSpec) {
    throw new Error(`Invalid tube spec index: ${tubeGeometry.tubeSpecIndex}`);
  }
  const material = TUBE_MATERIALS[tubeGeometry.tubeMaterial];
  if (!material) {
    throw new Error(`Invalid tube material: ${tubeGeometry.tubeMaterial}`);
  }

  const tubeSideMassFlowKgS = tonHrToKgS(tubeSide.massFlowRate);

  for (let i = 0; i < maxIterations; i++) {
    // a. Size the exchanger with current assumed U
    const sizing = sizeHeatExchanger({
      heatDutyKW: heatDuty.heatDutyKW,
      lmtd: lmtdResult.correctedLMTD,
      overallHTC: assumedU,
      tubeSpecIndex: tubeGeometry.tubeSpecIndex,
      tubeMaterial: tubeGeometry.tubeMaterial,
      tubeLayout: tubeGeometry.tubeLayout,
      pitchRatio: tubeGeometry.pitchRatio,
      tubePasses: tubeGeometry.tubePasses,
      tubeLength: tubeGeometry.tubeLength,
    });

    // b. Calculate tube-side velocity
    const velocity = calculateTubeSideVelocity(
      tubeSideMassFlowKgS,
      tubeProps.density,
      sizing.tubeSideFlowArea
    );

    // c. Calculate tube-side HTC (Dittus-Boelter)
    const tubeIDm = tubeSpec.id_mm / 1000;
    const isHeating = tubeSide.outletTemp > tubeSide.inletTemp;

    let tubeSideHTC: number;
    if (velocity < MIN_VELOCITY) {
      // Very low velocity — use a conservative minimum HTC
      tubeSideHTC = 500;
      if (i === 0) {
        warnings.push(
          `Tube-side velocity is very low (${velocity.toFixed(3)} m/s). ` +
            'Consider fewer tube passes or smaller tubes.'
        );
      }
    } else {
      const htcResult = calculateTubeSideHTC({
        density: tubeProps.density,
        velocity,
        diameter: tubeIDm,
        viscosity: tubeProps.viscosity,
        specificHeat: tubeProps.specificHeat,
        conductivity: tubeProps.thermalConductivity,
        isHeating,
      });
      tubeSideHTC = htcResult.htc;
    }

    // d. Estimate wall temperature and calculate shell-side HTC (Nusselt)
    const shellSideHTC = calculateShellSideHTCForCondenser(
      satProps,
      tubeSpec.od_mm / 1000,
      tubeOrientation,
      tubeMeanTemp,
      shellSide.saturationTemp,
      assumedU,
      tubeSideHTC
    );

    // e. Calculate overall U from composite resistance
    const htcResult = calculateOverallHTC({
      tubeSideHTC,
      shellSideHTC,
      tubeOD: tubeSpec.od_mm / 1000,
      tubeID: tubeIDm,
      tubeWallConductivity: material.conductivity,
      tubeSideFouling: fouling.tubeSide,
      shellSideFouling: fouling.shellSide,
    });

    const calculatedU = htcResult.overallHTC;
    const relativeError = Math.abs(calculatedU - assumedU) / calculatedU;

    // Record iteration
    iterations.push({
      iteration: i + 1,
      assumedU: round2(assumedU),
      calculatedU: round2(calculatedU),
      requiredArea: sizing.requiredArea,
      tubeCount: sizing.actualTubeCount,
      tubeSideVelocity: round3(velocity),
      tubeSideHTC: round1(tubeSideHTC),
      shellSideHTC: round1(shellSideHTC),
      relativeError: round4(relativeError),
    });

    // Store final results
    finalHtcResult = htcResult;
    finalTubeSideHTC = tubeSideHTC;
    finalShellSideHTC = shellSideHTC;
    finalSizingResult = sizing;
    finalVelocity = velocity;

    // f. Check convergence
    if (relativeError < convergenceTolerance) {
      converged = true;
      break;
    }

    // g. Under-relaxation: U_new = α × U_calc + (1-α) × U_assumed
    assumedU = relaxationFactor * calculatedU + (1 - relaxationFactor) * assumedU;
  }

  if (!converged) {
    warnings.push(
      `Design did not converge after ${maxIterations} iterations. ` +
        `Final relative error: ${(iterations[iterations.length - 1]!.relativeError * 100).toFixed(1)}%. ` +
        'Results are approximate.'
    );
  }

  // ── Step 6: Assemble final result ──────────────────────────────────────
  const sizing = finalSizingResult!;
  const tubeIDm = tubeSpec.id_mm / 1000;

  // Calculate pressure drop at final velocity
  const pressureDrop = estimateTubeSidePressureDrop(
    finalVelocity,
    tubeIDm,
    tubeGeometry.tubeLength,
    tubeGeometry.tubePasses,
    tubeProps.density,
    tubeProps.viscosity
  );

  // Velocity warnings
  addVelocityWarnings(finalVelocity, warnings);

  // Add sizing warnings from the final iteration
  for (const w of sizing.warnings) {
    if (!warnings.includes(w)) {
      warnings.push(w);
    }
  }

  const geometry: GeometryResult = {
    tubeSpec,
    tubeMaterial: tubeGeometry.tubeMaterial,
    tubeMaterialConductivity: material.conductivity,
    tubePitch: sizing.tubePitch,
    tubeLayout: tubeGeometry.tubeLayout,
    tubePasses: tubeGeometry.tubePasses,
    tubeLength: tubeGeometry.tubeLength,
    requiredArea: sizing.requiredArea,
    actualArea: sizing.actualArea,
    excessArea: sizing.excessArea,
    requiredTubeCount: sizing.requiredTubeCount,
    actualTubeCount: sizing.actualTubeCount,
    bundleDiameter: sizing.bundleDiameter,
    shellID: sizing.shellID,
    bundleClearance: sizing.bundleClearance,
    tubeSideFlowArea: sizing.tubeSideFlowArea,
    shellSideFlowArea: sizing.shellSideFlowArea,
  };

  const velocityResult: VelocityResult = {
    tubeSideVelocity: round3(finalVelocity),
    tubeSidePressureDrop: pressureDrop.pressureDrop,
    tubeSideReynolds: pressureDrop.reynoldsNumber,
    tubeSideFrictionFactor: round6(pressureDrop.frictionFactor),
  };

  return {
    converged,
    iterationCount: iterations.length,
    heatDuty,
    lmtdResult,
    htcResult: finalHtcResult!,
    tubeSideHTC: round1(finalTubeSideHTC),
    shellSideHTC: round1(finalShellSideHTC),
    geometry,
    velocity: velocityResult,
    iterations,
    warnings,
  };
}

// ============================================================================
// Internal: Heat Duty Calculation
// ============================================================================

/**
 * Calculate heat duty for a condenser configuration.
 *
 * Uses the tube-side sensible heat (Q = m·Cp·ΔT) as the primary calculation.
 * Cross-checks with shell-side latent heat if both are available.
 */
function calculateHeatDutyForCondenser(
  tubeSide: IterativeHXInput['tubeSide'],
  shellSide: IterativeHXInput['shellSide'],
  warnings: string[]
): HeatDutyResult {
  // Primary: tube-side sensible heat
  const sensible = calculateSensibleHeat({
    fluidType: tubeSide.fluid === 'CONDENSATE' ? 'PURE_WATER' : tubeSide.fluid,
    salinity: tubeSide.salinity,
    massFlowRate: tubeSide.massFlowRate,
    inletTemperature: tubeSide.inletTemp,
    outletTemperature: tubeSide.outletTemp,
  });

  // Cross-check: shell-side latent heat
  const latent = calculateLatentHeat({
    massFlowRate: shellSide.massFlowRate,
    temperature: shellSide.saturationTemp,
    process: 'CONDENSATION',
  });

  // Warn if tube-side and shell-side duties differ by more than 10%
  const discrepancy = Math.abs(sensible.heatDuty - latent.heatDuty) / sensible.heatDuty;
  if (discrepancy > 0.1) {
    warnings.push(
      `Heat duty mismatch: tube-side Q = ${sensible.heatDuty.toFixed(0)} kW, ` +
        `shell-side Q = ${latent.heatDuty.toFixed(0)} kW ` +
        `(${(discrepancy * 100).toFixed(1)}% difference). ` +
        'Check flow rates and temperatures for consistency.'
    );
  }

  return {
    heatDutyKW: sensible.heatDuty,
    method: 'SENSIBLE',
    specificHeat: sensible.specificHeat,
    massFlowKgS: sensible.massFlowKgS,
  };
}

// ============================================================================
// Internal: LMTD Calculation
// ============================================================================

/**
 * Calculate LMTD for a condenser.
 *
 * For a condenser, the hot side is isothermal (saturation temperature)
 * at both inlet and outlet.
 */
function calculateLMTDForCondenser(
  tubeSide: IterativeHXInput['tubeSide'],
  shellSide: IterativeHXInput['shellSide'],
  flowArrangement: IterativeHXInput['flowArrangement'],
  warnings: string[]
): LMTDResultSummary {
  const lmtd = calculateLMTD({
    hotInlet: shellSide.saturationTemp,
    hotOutlet: shellSide.saturationTemp, // isothermal condensation
    coldInlet: tubeSide.inletTemp,
    coldOutlet: tubeSide.outletTemp,
    flowArrangement,
  });

  for (const w of lmtd.warnings) {
    warnings.push(w);
  }

  return {
    lmtd: lmtd.lmtd,
    correctionFactor: lmtd.correctionFactor,
    correctedLMTD: lmtd.correctedLMTD,
    deltaT1: lmtd.deltaT1,
    deltaT2: lmtd.deltaT2,
  };
}

// ============================================================================
// Internal: Shell-Side HTC for Condenser
// ============================================================================

/**
 * Calculate shell-side condensation HTC with wall temperature estimation.
 *
 * The Nusselt film condensation correlation requires the ΔT between
 * saturation temperature and tube wall temperature. The wall temperature
 * depends on the overall HTC, creating a circular dependency that is
 * resolved within the main iteration loop.
 *
 * Wall temperature estimate:
 *   T_wall ≈ T_sat - (h_o / U) × (T_sat - T_cold_bulk)
 *
 * On the first iteration we don't have h_o yet, so we use a simple estimate:
 *   T_wall ≈ (T_sat + T_cold_bulk) / 2
 */
function calculateShellSideHTCForCondenser(
  satProps: SaturationFluidProperties,
  tubeODm: number,
  orientation: IterativeHXInput['tubeOrientation'],
  tubeBulkTemp: number,
  satTemp: number,
  currentU: number,
  tubeSideHTC: number
): number {
  // Estimate wall temperature
  // For a first-order estimate: T_wall = T_sat - (U/h_i) × (T_sat - T_bulk)
  // This accounts for the tube-side resistance reducing the wall temp
  let wallTemp: number;
  if (tubeSideHTC > 0 && currentU > 0) {
    // Fraction of total ΔT on the shell side
    const fraction = Math.min(0.9, currentU / tubeSideHTC);
    wallTemp = satTemp - fraction * (satTemp - tubeBulkTemp);
  } else {
    wallTemp = (satTemp + tubeBulkTemp) / 2;
  }

  const deltaT = Math.max(satTemp - wallTemp, 0.1);

  const { htc } = calculateNusseltCondensation({
    liquidDensity: satProps.density,
    vaporDensity: satProps.vaporDensity,
    latentHeat: satProps.latentHeat,
    liquidConductivity: satProps.thermalConductivity,
    liquidViscosity: satProps.viscosity,
    dimension: tubeODm,
    deltaT,
    orientation,
  });

  return htc;
}

// ============================================================================
// Internal: Initial U Estimate
// ============================================================================

function getInitialU(exchangerType: IterativeHXInput['exchangerType']): number {
  switch (exchangerType) {
    case 'CONDENSER':
      return INITIAL_U_CONDENSER;
    case 'EVAPORATOR':
      return TYPICAL_HTC.boiling_water?.typical ?? 3000;
    case 'LIQUID_LIQUID':
      return TYPICAL_HTC.water_to_water?.typical ?? 1500;
  }
}

// ============================================================================
// Internal: Velocity Warnings
// ============================================================================

function addVelocityWarnings(velocity: number, warnings: string[]): void {
  if (velocity < 0.5) {
    warnings.push(
      `Tube-side velocity is low (${velocity.toFixed(2)} m/s). ` +
        'Risk of fouling. Consider more tube passes or smaller tubes. Target: 1.0–2.5 m/s.'
    );
  } else if (velocity > 3.0) {
    warnings.push(
      `Tube-side velocity is high (${velocity.toFixed(2)} m/s). ` +
        'Risk of erosion and high pressure drop. Consider fewer tube passes or larger tubes. Target: 1.0–2.5 m/s.'
    );
  }
}

// ============================================================================
// Internal: Validation
// ============================================================================

function validateInput(input: IterativeHXInput): void {
  const { exchangerType, tubeSide, shellSide, tubeGeometry } = input;

  if (exchangerType !== 'CONDENSER') {
    throw new Error(
      `Exchanger type '${exchangerType}' is not yet supported. Only 'CONDENSER' is available.`
    );
  }

  if (tubeSide.massFlowRate <= 0) {
    throw new Error('Tube-side mass flow rate must be positive');
  }
  if (shellSide.massFlowRate <= 0) {
    throw new Error('Shell-side mass flow rate must be positive');
  }
  if (tubeSide.inletTemp >= shellSide.saturationTemp) {
    throw new Error('Tube-side inlet temperature must be below shell-side saturation temperature');
  }
  if (tubeSide.outletTemp >= shellSide.saturationTemp) {
    throw new Error('Tube-side outlet temperature must be below shell-side saturation temperature');
  }
  if (tubeSide.outletTemp <= tubeSide.inletTemp) {
    throw new Error(
      'Tube-side outlet temperature must be greater than inlet temperature (cooling water is heated)'
    );
  }
  if (tubeGeometry.tubeLength <= 0) {
    throw new Error('Tube length must be positive');
  }
  if (![1, 2, 4, 6].includes(tubeGeometry.tubePasses)) {
    throw new Error('Tube passes must be 1, 2, 4, or 6');
  }

  const tubeSpec = STANDARD_TUBES[tubeGeometry.tubeSpecIndex];
  if (!tubeSpec) {
    throw new Error(`Invalid tube spec index: ${tubeGeometry.tubeSpecIndex}`);
  }
  const material = TUBE_MATERIALS[tubeGeometry.tubeMaterial];
  if (!material) {
    throw new Error(`Invalid tube material: ${tubeGeometry.tubeMaterial}`);
  }
}

// ============================================================================
// Utility
// ============================================================================

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
