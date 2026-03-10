/**
 * Iterative Heat Exchanger Design Engine
 *
 * Integrates heat duty, LMTD, HTC correlations, and geometric sizing
 * into a single convergent design loop.
 *
 * Supports three exchanger types:
 *   CONDENSER:    Shell-side condensation (Nusselt) + tube-side forced convection (Dittus-Boelter)
 *   EVAPORATOR:   Shell-side pool boiling (Mostinski) + tube-side forced convection (Dittus-Boelter)
 *   LIQUID_LIQUID: Shell-side cross-flow (Kern) + tube-side forced convection (Dittus-Boelter)
 *
 * Algorithm:
 *   1. Calculate Q from process conditions
 *   2. Calculate LMTD from temperature profile
 *   3. Assume initial U from typical values
 *   4. Loop:
 *      a. A_required = Q / (U x LMTD)
 *      b. Size geometry (tube count, bundle, shell)
 *      c. Calculate tube-side velocity and HTC (Dittus-Boelter)
 *      d. Calculate shell-side HTC (Nusselt / Mostinski / Kern)
 *      e. Calculate U from composite resistance
 *      f. Check convergence; if not converged, relax U and repeat
 *   5. Return complete design with iteration history
 *
 * References:
 *   - Kern's Process Heat Transfer (bundle diameter, overall HTC, shell-side HTC)
 *   - TEMA Standards (tube geometry, shell sizing)
 *   - Dittus-Boelter (tube-side forced convection)
 *   - Nusselt film condensation (shell-side condensation)
 *   - Mostinski (1963) (pool boiling)
 */

import { getSaturationPressure } from '@vapour/constants';
import { getFluidProperties, getSaturationProperties } from './fluidProperties';
import type { FluidProperties, SaturationFluidProperties } from './fluidProperties';
import {
  calculateSensibleHeat,
  calculateLatentHeat,
  calculateLMTD,
  TYPICAL_HTC,
} from './heatDutyCalculator';
import {
  calculateTubeSideHTC,
  calculateNusseltCondensation,
  calculateKernShellSideHTC,
  calculateMostinskiBoiling,
  calculateOverallHTC,
} from './heatTransfer';
import type { OverallHTCResult } from './heatTransfer';
import {
  sizeHeatExchanger,
  calculateTubeSideVelocity,
  calculateShellSideVelocity,
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
  ShellSideCondensing,
  ShellSideSensible,
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

/** Typical initial U for condenser design (W/m2K) */
const INITIAL_U_CONDENSER = TYPICAL_HTC.steam_to_water?.typical ?? 2500;

// ============================================================================
// Type Guards
// ============================================================================

function isShellSideSensible(s: IterativeHXInput['shellSide']): s is ShellSideSensible {
  return 'inletTemp' in s;
}

function asCondensing(s: IterativeHXInput['shellSide']): ShellSideCondensing {
  return s as ShellSideCondensing;
}

// ============================================================================
// Main Design Function
// ============================================================================

/**
 * Run the iterative heat exchanger design.
 *
 * Supports CONDENSER, EVAPORATOR, and LIQUID_LIQUID types.
 * Returns a complete design with iteration history.
 *
 * @param input - Complete design input
 * @returns Design result with convergence status and all intermediate data
 * @throws Error if input validation fails
 */
export function designHeatExchanger(input: IterativeHXInput): IterativeHXResult {
  // -- Validation --
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

  // -- Step 1: Calculate heat duty --
  const heatDuty = calculateHeatDutyDispatch(exchangerType, tubeSide, shellSide, warnings);

  // -- Step 2: Calculate LMTD --
  const lmtdResult = calculateLMTDDispatch(
    exchangerType,
    tubeSide,
    shellSide,
    flowArrangement,
    warnings
  );

  if (lmtdResult.correctedLMTD <= 0) {
    throw new Error('Invalid temperature profile \u2014 LMTD is zero or negative');
  }

  // -- Step 3: Get fluid properties at operating conditions --
  const tubeMeanTemp = (tubeSide.inletTemp + tubeSide.outletTemp) / 2;
  const tubeProps = getFluidProperties(tubeSide.fluid, tubeMeanTemp, tubeSide.salinity);

  // Shell-side fluid properties (type-dependent)
  const satProps =
    exchangerType === 'CONDENSER' || exchangerType === 'EVAPORATOR'
      ? getSaturationProperties(asCondensing(shellSide).saturationTemp)
      : null;

  const shellProps = isShellSideSensible(shellSide)
    ? getFluidProperties(
        shellSide.fluid,
        (shellSide.inletTemp + shellSide.outletTemp) / 2,
        shellSide.salinity
      )
    : null;

  // -- Step 4: Initial U assumption --
  let assumedU = getInitialU(exchangerType);

  // -- Step 5: Iterative design loop --
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

    // d. Calculate shell-side HTC (type-dependent)
    const shellSideHTC = calculateShellSideHTCDispatch(
      exchangerType,
      {
        satProps,
        shellProps,
        tubeODm: tubeSpec.od_mm / 1000,
        orientation: tubeOrientation,
        tubeMeanTemp,
        shellSide,
        currentU: assumedU,
        tubeSideHTC,
        sizing,
        heatDutyKW: heatDuty.heatDutyKW,
        tubeGeometry,
      },
      warnings,
      i
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

    // g. Under-relaxation: U_new = alpha x U_calc + (1-alpha) x U_assumed
    assumedU = relaxationFactor * calculatedU + (1 - relaxationFactor) * assumedU;
  }

  if (!converged) {
    warnings.push(
      `Design did not converge after ${maxIterations} iterations. ` +
        `Final relative error: ${(iterations[iterations.length - 1]!.relativeError * 100).toFixed(1)}%. ` +
        'Results are approximate.'
    );
  }

  // -- Step 6: Assemble final result --
  const sizing = finalSizingResult!;
  const tubeIDm = tubeSpec.id_mm / 1000;

  const pressureDrop = estimateTubeSidePressureDrop(
    finalVelocity,
    tubeIDm,
    tubeGeometry.tubeLength,
    tubeGeometry.tubePasses,
    tubeProps.density,
    tubeProps.viscosity
  );

  addVelocityWarnings(finalVelocity, warnings);

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
// Internal: Heat Duty Dispatch
// ============================================================================

function calculateHeatDutyDispatch(
  exchangerType: IterativeHXInput['exchangerType'],
  tubeSide: IterativeHXInput['tubeSide'],
  shellSide: IterativeHXInput['shellSide'],
  warnings: string[]
): HeatDutyResult {
  switch (exchangerType) {
    case 'CONDENSER':
      return calculateHeatDutyForCondenser(tubeSide, asCondensing(shellSide), warnings);
    case 'EVAPORATOR':
      return calculateHeatDutyForEvaporator(tubeSide, asCondensing(shellSide), warnings);
    case 'LIQUID_LIQUID':
      return calculateHeatDutyForLiquidLiquid(tubeSide, shellSide as ShellSideSensible, warnings);
  }
}

/**
 * Heat duty for condenser: primary = tube-side sensible, cross-check with shell latent.
 */
function calculateHeatDutyForCondenser(
  tubeSide: IterativeHXInput['tubeSide'],
  shellSide: ShellSideCondensing,
  warnings: string[]
): HeatDutyResult {
  const sensible = calculateSensibleHeat({
    fluidType: tubeSide.fluid === 'CONDENSATE' ? 'PURE_WATER' : tubeSide.fluid,
    salinity: tubeSide.salinity,
    massFlowRate: tubeSide.massFlowRate,
    inletTemperature: tubeSide.inletTemp,
    outletTemperature: tubeSide.outletTemp,
  });

  const latent = calculateLatentHeat({
    massFlowRate: shellSide.massFlowRate,
    temperature: shellSide.saturationTemp,
    process: 'CONDENSATION',
  });

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

/**
 * Heat duty for evaporator: primary = tube-side sensible (hot fluid cooled),
 * cross-check with shell-side latent (boiling).
 */
function calculateHeatDutyForEvaporator(
  tubeSide: IterativeHXInput['tubeSide'],
  shellSide: ShellSideCondensing,
  warnings: string[]
): HeatDutyResult {
  const sensible = calculateSensibleHeat({
    fluidType: tubeSide.fluid === 'CONDENSATE' ? 'PURE_WATER' : tubeSide.fluid,
    salinity: tubeSide.salinity,
    massFlowRate: tubeSide.massFlowRate,
    inletTemperature: tubeSide.inletTemp,
    outletTemperature: tubeSide.outletTemp,
  });

  // For evaporator, tube-side fluid is being cooled, so Q is negative from calculateSensibleHeat
  // We use absolute value
  const qTube = Math.abs(sensible.heatDuty);

  const latent = calculateLatentHeat({
    massFlowRate: shellSide.massFlowRate,
    temperature: shellSide.saturationTemp,
    process: 'EVAPORATION',
  });

  const discrepancy = Math.abs(qTube - latent.heatDuty) / qTube;
  if (discrepancy > 0.1) {
    warnings.push(
      `Heat duty mismatch: tube-side Q = ${qTube.toFixed(0)} kW, ` +
        `shell-side Q = ${latent.heatDuty.toFixed(0)} kW ` +
        `(${(discrepancy * 100).toFixed(1)}% difference). ` +
        'Check flow rates and temperatures for consistency.'
    );
  }

  return {
    heatDutyKW: qTube,
    method: 'SENSIBLE',
    specificHeat: sensible.specificHeat,
    massFlowKgS: sensible.massFlowKgS,
  };
}

/**
 * Heat duty for liquid-liquid: primary = tube-side sensible, cross-check with shell sensible.
 */
function calculateHeatDutyForLiquidLiquid(
  tubeSide: IterativeHXInput['tubeSide'],
  shellSide: ShellSideSensible,
  warnings: string[]
): HeatDutyResult {
  const tubeSensible = calculateSensibleHeat({
    fluidType: tubeSide.fluid === 'CONDENSATE' ? 'PURE_WATER' : tubeSide.fluid,
    salinity: tubeSide.salinity,
    massFlowRate: tubeSide.massFlowRate,
    inletTemperature: tubeSide.inletTemp,
    outletTemperature: tubeSide.outletTemp,
  });

  const shellSensible = calculateSensibleHeat({
    fluidType: shellSide.fluid === 'CONDENSATE' ? 'PURE_WATER' : shellSide.fluid,
    salinity: shellSide.salinity,
    massFlowRate: shellSide.massFlowRate,
    inletTemperature: shellSide.inletTemp,
    outletTemperature: shellSide.outletTemp,
  });

  const qTube = Math.abs(tubeSensible.heatDuty);
  const qShell = Math.abs(shellSensible.heatDuty);
  const discrepancy = Math.abs(qTube - qShell) / Math.max(qTube, qShell);
  if (discrepancy > 0.1) {
    warnings.push(
      `Heat duty mismatch: tube-side Q = ${qTube.toFixed(0)} kW, ` +
        `shell-side Q = ${qShell.toFixed(0)} kW ` +
        `(${(discrepancy * 100).toFixed(1)}% difference). ` +
        'Check flow rates and temperatures for energy balance.'
    );
  }

  return {
    heatDutyKW: qTube,
    method: 'SENSIBLE',
    specificHeat: tubeSensible.specificHeat,
    massFlowKgS: tubeSensible.massFlowKgS,
  };
}

// ============================================================================
// Internal: LMTD Dispatch
// ============================================================================

function calculateLMTDDispatch(
  exchangerType: IterativeHXInput['exchangerType'],
  tubeSide: IterativeHXInput['tubeSide'],
  shellSide: IterativeHXInput['shellSide'],
  flowArrangement: IterativeHXInput['flowArrangement'],
  warnings: string[]
): LMTDResultSummary {
  switch (exchangerType) {
    case 'CONDENSER': {
      // Hot side isothermal (condensation at saturation temperature)
      const ss = asCondensing(shellSide);
      return calculateLMTDGeneric(
        ss.saturationTemp,
        ss.saturationTemp,
        tubeSide.inletTemp,
        tubeSide.outletTemp,
        flowArrangement,
        warnings
      );
    }
    case 'EVAPORATOR': {
      // Cold side (shell) isothermal (boiling at saturation temperature)
      // Hot side = tube (being cooled): inlet is hot, outlet is cooler
      const ss = asCondensing(shellSide);
      return calculateLMTDGeneric(
        tubeSide.inletTemp, // hot inlet (tube in)
        tubeSide.outletTemp, // hot outlet (tube out)
        ss.saturationTemp, // cold inlet (shell boiling)
        ss.saturationTemp, // cold outlet (shell boiling)
        flowArrangement,
        warnings
      );
    }
    case 'LIQUID_LIQUID': {
      // Both sides sensible heat — standard two-stream LMTD
      const ss = shellSide as ShellSideSensible;
      // Determine which is the hot side and which is cold
      const shellMean = (ss.inletTemp + ss.outletTemp) / 2;
      const tubeMean = (tubeSide.inletTemp + tubeSide.outletTemp) / 2;
      if (shellMean >= tubeMean) {
        // Shell is hot side
        return calculateLMTDGeneric(
          ss.inletTemp,
          ss.outletTemp,
          tubeSide.inletTemp,
          tubeSide.outletTemp,
          flowArrangement,
          warnings
        );
      } else {
        // Tube is hot side
        return calculateLMTDGeneric(
          tubeSide.inletTemp,
          tubeSide.outletTemp,
          ss.inletTemp,
          ss.outletTemp,
          flowArrangement,
          warnings
        );
      }
    }
  }
}

function calculateLMTDGeneric(
  hotInlet: number,
  hotOutlet: number,
  coldInlet: number,
  coldOutlet: number,
  flowArrangement: IterativeHXInput['flowArrangement'],
  warnings: string[]
): LMTDResultSummary {
  const lmtd = calculateLMTD({
    hotInlet,
    hotOutlet,
    coldInlet,
    coldOutlet,
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
// Internal: Shell-Side HTC Dispatch
// ============================================================================

interface ShellSideHTCContext {
  satProps: SaturationFluidProperties | null;
  shellProps: FluidProperties | null;
  tubeODm: number;
  orientation: IterativeHXInput['tubeOrientation'];
  tubeMeanTemp: number;
  shellSide: IterativeHXInput['shellSide'];
  currentU: number;
  tubeSideHTC: number;
  sizing: ReturnType<typeof sizeHeatExchanger>;
  heatDutyKW: number;
  tubeGeometry: IterativeHXInput['tubeGeometry'];
}

function calculateShellSideHTCDispatch(
  exchangerType: IterativeHXInput['exchangerType'],
  ctx: ShellSideHTCContext,
  warnings: string[],
  iteration: number
): number {
  switch (exchangerType) {
    case 'CONDENSER':
      return calculateShellSideHTCForCondenser(ctx);
    case 'EVAPORATOR':
      return calculateShellSideHTCForEvaporator(ctx, warnings, iteration);
    case 'LIQUID_LIQUID':
      return calculateShellSideHTCForLiquidLiquid(ctx, warnings, iteration);
  }
}

/**
 * Shell-side HTC for condenser: Nusselt film condensation with wall temperature estimation.
 */
function calculateShellSideHTCForCondenser(ctx: ShellSideHTCContext): number {
  const { satProps, tubeODm, orientation, tubeMeanTemp, shellSide, currentU, tubeSideHTC } = ctx;
  const ss = asCondensing(shellSide);

  if (!satProps) {
    throw new Error('Saturation properties required for condenser');
  }

  // Estimate wall temperature
  let wallTemp: number;
  if (tubeSideHTC > 0 && currentU > 0) {
    const fraction = Math.min(0.9, currentU / tubeSideHTC);
    wallTemp = ss.saturationTemp - fraction * (ss.saturationTemp - tubeMeanTemp);
  } else {
    wallTemp = (ss.saturationTemp + tubeMeanTemp) / 2;
  }

  const deltaT = Math.max(ss.saturationTemp - wallTemp, 0.1);

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

/**
 * Shell-side HTC for evaporator: Mostinski pool boiling correlation.
 *
 * The Mostinski correlation depends on heat flux q = Q/A, which changes
 * with each iteration as the area is resized.
 */
function calculateShellSideHTCForEvaporator(
  ctx: ShellSideHTCContext,
  warnings: string[],
  iteration: number
): number {
  const { shellSide, sizing, heatDutyKW } = ctx;
  const ss = asCondensing(shellSide);

  // Get saturation pressure from temperature
  const satPressureBar = getSaturationPressure(ss.saturationTemp);

  // Heat flux based on current actual area
  const actualArea = sizing.actualArea;
  const heatFluxW = (heatDutyKW * 1000) / actualArea; // W/m2

  if (heatFluxW <= 0) {
    if (iteration === 0) {
      warnings.push('Heat flux is zero or negative — cannot calculate boiling HTC.');
    }
    return 500; // fallback
  }

  const { htc } = calculateMostinskiBoiling({
    heatFlux: heatFluxW,
    saturationPressure: satPressureBar,
  });

  return htc;
}

/**
 * Shell-side HTC for liquid-liquid: Kern method (cross-flow over tube bank).
 */
function calculateShellSideHTCForLiquidLiquid(
  ctx: ShellSideHTCContext,
  warnings: string[],
  iteration: number
): number {
  const { shellProps, tubeODm, shellSide, sizing, tubeGeometry } = ctx;

  if (!shellProps || !isShellSideSensible(shellSide)) {
    throw new Error('Shell-side fluid properties required for liquid-liquid');
  }

  const shellMassFlowKgS = tonHrToKgS(shellSide.massFlowRate);
  const shellVelocity = calculateShellSideVelocity(
    shellMassFlowKgS,
    shellProps.density,
    sizing.shellSideFlowArea
  );

  if (shellVelocity < MIN_VELOCITY) {
    if (iteration === 0) {
      warnings.push(
        `Shell-side velocity is very low (${shellVelocity.toFixed(3)} m/s). ` +
          'Consider adjusting baffle spacing or shell geometry.'
      );
    }
    return 300; // fallback
  }

  const pitchRatio = tubeGeometry.pitchRatio ?? 1.25;
  const tubePitchM = tubeODm * pitchRatio;

  const { htc } = calculateKernShellSideHTC({
    density: shellProps.density,
    velocity: shellVelocity,
    tubeOD: tubeODm,
    tubePitch: tubePitchM,
    tubeLayout: tubeGeometry.tubeLayout === 'square' ? 'square' : 'triangular',
    viscosity: shellProps.viscosity,
    specificHeat: shellProps.specificHeat,
    conductivity: shellProps.thermalConductivity,
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
        'Risk of fouling. Consider more tube passes or smaller tubes. Target: 1.0\u20132.5 m/s.'
    );
  } else if (velocity > 3.0) {
    warnings.push(
      `Tube-side velocity is high (${velocity.toFixed(2)} m/s). ` +
        'Risk of erosion and high pressure drop. Consider fewer tube passes or larger tubes. Target: 1.0\u20132.5 m/s.'
    );
  }
}

// ============================================================================
// Internal: Validation
// ============================================================================

function validateInput(input: IterativeHXInput): void {
  const { exchangerType, tubeSide, shellSide, tubeGeometry } = input;

  if (tubeSide.massFlowRate <= 0) {
    throw new Error('Tube-side mass flow rate must be positive');
  }

  if (isShellSideSensible(shellSide)) {
    // Liquid-liquid validation
    if (exchangerType !== 'LIQUID_LIQUID') {
      throw new Error('ShellSideSensible input is only valid for LIQUID_LIQUID exchanger type');
    }
    if (shellSide.massFlowRate <= 0) {
      throw new Error('Shell-side mass flow rate must be positive');
    }
  } else {
    // Condensing/boiling validation
    const ss = shellSide as ShellSideCondensing;
    if (ss.massFlowRate <= 0) {
      throw new Error('Shell-side mass flow rate must be positive');
    }

    if (exchangerType === 'CONDENSER') {
      // Condenser: tube-side cold fluid is heated
      if (tubeSide.inletTemp >= ss.saturationTemp) {
        throw new Error(
          'Tube-side inlet temperature must be below shell-side saturation temperature'
        );
      }
      if (tubeSide.outletTemp >= ss.saturationTemp) {
        throw new Error(
          'Tube-side outlet temperature must be below shell-side saturation temperature'
        );
      }
      if (tubeSide.outletTemp <= tubeSide.inletTemp) {
        throw new Error(
          'Tube-side outlet temperature must be greater than inlet temperature (cooling water is heated)'
        );
      }
    } else if (exchangerType === 'EVAPORATOR') {
      // Evaporator: tube-side hot fluid is cooled, shell-side boils
      if (tubeSide.outletTemp <= ss.saturationTemp) {
        // Tube outlet must be above shell boiling temp for heat transfer
        // (with some approach temperature allowed)
      }
      if (tubeSide.inletTemp <= ss.saturationTemp) {
        throw new Error(
          'Tube-side inlet temperature must be above shell-side saturation temperature for evaporator'
        );
      }
      if (tubeSide.outletTemp >= tubeSide.inletTemp) {
        throw new Error(
          'Tube-side outlet temperature must be less than inlet temperature (hot fluid is cooled in evaporator)'
        );
      }
    }
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
  const materialEntry = TUBE_MATERIALS[tubeGeometry.tubeMaterial];
  if (!materialEntry) {
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
