/**
 * Input Adapter — MEDDesignerInput → MEDPlantInputs
 *
 * Translates the designer's user-facing input format into the core solver's
 * input format. The designer uses steamFlow + targetGOR as the primary inputs,
 * while the core solver uses capacity as the target to converge on.
 *
 * Also resolves all optional defaults and derives intermediate values
 * (TBT, concentration factor, tube specs) that the core solver needs.
 */

import { getBoilingPointElevation, getSaturationPressure } from '@vapour/constants';
import type { MEDPlantInputs, TubeMaterial } from '@vapour/types';
import type { MEDDesignerInput, MEDScenarioRow } from './designerTypes';

// ============================================================================
// Default Resolution
// ============================================================================

/** All resolved defaults from a MEDDesignerInput — used throughout the pipeline */
export interface ResolvedDesignerInputs {
  input: MEDDesignerInput;
  swSalinity: number;
  maxBrineSalinity: number;
  condenserApproach: number;
  condenserSWOutlet: number;
  shellID: number;
  tubeOD: number;
  tubeWall: number;
  kWall: number;
  tubeMaterialName: string;
  pitch: number;
  availableLengths: number[];
  designMargin: number;
  NEA: number;
  demLoss: number;
  pdLoss: number;
  minGamma: number;
  includeRecirc: boolean;
  shellThkMM: number;
  tubeSheetThkMM: number;
  tubeSheetAccessMM: number;
  /** Last effect vapour temperature (condenser inlet) */
  lastEffectVapourT: number;
  /** Total temperature range: steam → last effect vapour */
  totalRangeDT: number;
  /** Average BPE + NEA + demister + duct losses per effect */
  avgLossPerEffect: number;
  /** Number of effects (resolved — user override or auto-selected) */
  nEff: number;
  /** Resolved defaults record for echoing in result */
  resolvedDefaults: Record<string, number | string | boolean>;
}

/**
 * Resolve all defaults and derive intermediate values from designer input.
 * This is the shared first step of the pipeline — both scenario analysis
 * and the core solver consume these resolved values.
 */
export function resolveDesignerDefaults(
  input: MEDDesignerInput,
  scenarios: MEDScenarioRow[]
): ResolvedDesignerInputs {
  const swSalinity = input.seawaterSalinity ?? 35000;
  const maxBrineSalinity = input.maxBrineSalinity ?? 65000;
  const condenserApproach = input.condenserApproach ?? 4;
  const condenserSWOutlet = input.condenserSWOutlet ?? input.seawaterTemperature + 5;
  const shellID = input.shellID ?? 1800;
  const tubeOD = input.tubeOD ?? 25.4;
  const tubeWall = input.tubeWallThickness ?? 1.0;
  const kWall = input.tubeConductivity ?? 138;
  const tubeMaterialName = input.tubeMaterialName ?? 'Al 5052';
  const pitch = input.tubePitch ?? 33.4;
  const availableLengths = input.availableTubeLengths ?? [0.8, 1.0, 1.2, 1.5];
  const designMargin = input.designMargin ?? 0.15;
  const NEA = input.NEA ?? 0.25;
  const demLoss = input.demisterLoss ?? 0.15;
  const pdLoss = input.pressureDropLoss ?? 0.3;
  const minGamma = input.minimumWettingRate ?? 0.035;
  const includeRecirc = input.includeBrineRecirculation ?? true;
  const shellThkMM = input.shellThickness ?? 8;
  const tubeSheetThkMM = input.tubeSheetThickness ?? 8;
  const tubeSheetAccessMM = input.tubeSheetAccess ?? 750;

  const lastEffectVapourT = condenserSWOutlet + condenserApproach;
  const totalRangeDT = input.steamTemperature - lastEffectVapourT;

  // Average losses per effect for scenario analysis
  const avgBrineS = (swSalinity + maxBrineSalinity) / 2;
  const avgTemp = (input.steamTemperature + lastEffectVapourT) / 2;
  const avgBPE = getBoilingPointElevation(avgBrineS, avgTemp);
  const avgLossPerEffect = avgBPE + NEA + demLoss + pdLoss;

  // Resolve number of effects
  let nEff: number;
  if (input.numberOfEffects) {
    nEff = input.numberOfEffects;
  } else {
    const feasible = scenarios.filter((s) => s.feasible);
    if (feasible.length === 0) {
      const best = scenarios.reduce((a, b) => (a.achievableGOR > b.achievableGOR ? a : b));
      nEff = best.effects;
    } else {
      const best = feasible.reduce((a, b) => (a.achievableGOR > b.achievableGOR ? a : b));
      nEff = best.effects;
    }
  }

  const resolvedDefaults: Record<string, number | string | boolean> = {
    seawaterSalinity: swSalinity,
    maxBrineSalinity,
    condenserApproach,
    condenserSWOutlet,
    shellID,
    tubeOD,
    tubeWallThickness: tubeWall,
    tubeConductivity: kWall,
    tubeMaterialName,
    tubePitch: pitch,
    designMargin,
    NEA,
    demisterLoss: demLoss,
    pressureDropLoss: pdLoss,
  };

  return {
    input,
    swSalinity,
    maxBrineSalinity,
    condenserApproach,
    condenserSWOutlet,
    shellID,
    tubeOD,
    tubeWall,
    kWall,
    tubeMaterialName,
    pitch,
    availableLengths,
    designMargin,
    NEA,
    demLoss,
    pdLoss,
    minGamma,
    includeRecirc,
    shellThkMM,
    tubeSheetThkMM,
    tubeSheetAccessMM,
    lastEffectVapourT,
    totalRangeDT,
    avgLossPerEffect,
    nEff,
    resolvedDefaults,
  };
}

// ============================================================================
// MEDDesignerInput → MEDPlantInputs
// ============================================================================

/**
 * Map tube material name to TubeMaterial enum value.
 * The designer uses free-form strings; the core solver uses an enum.
 */
function mapTubeMaterial(name: string): TubeMaterial {
  const lower = name.toLowerCase();
  if (lower.includes('titanium') || lower.includes('ti')) return 'titanium';
  if (lower.includes('al') && lower.includes('brass')) return 'al_brass';
  if (lower.includes('cu') && lower.includes('90')) return 'cu_ni_90_10';
  if (lower.includes('cu') && lower.includes('70')) return 'cu_ni_70_30';
  if (lower.includes('al')) return 'al_alloy';
  if (lower.includes('316')) return 'ss_316l';
  if (lower.includes('duplex') || lower.includes('2205')) return 'duplex_2205';
  return 'al_alloy'; // default for Al 5052
}

/**
 * Convert resolved designer inputs to MEDPlantInputs for the core solver.
 *
 * Key translations:
 * - capacity = steamFlow × targetGOR (approximate — solver will iterate to match)
 * - steamPressure = getSaturationPressure(steamTemperature)
 * - topBrineTemp derived from temperature profile (steam temp minus first-effect working ΔT)
 * - brineConcentrationFactor = maxBrineSalinity / seawaterSalinity
 */
export function toMEDPlantInputs(resolved: ResolvedDesignerInputs): MEDPlantInputs {
  const { input, swSalinity, maxBrineSalinity, condenserApproach, condenserSWOutlet } = resolved;

  // Capacity estimate: steamFlow × targetGOR
  // The core solver will iterate steam flow to converge on this capacity
  const capacity = input.steamFlow * input.targetGOR;

  // Steam pressure from saturation temperature
  const steamPressure = getSaturationPressure(input.steamTemperature);

  // TBT: derive from temperature profile
  // uniformWorkDT = totalRange / nEff - avgLoss
  // TBT = steamTemp - uniformWorkDT
  const uniformWorkDT = resolved.totalRangeDT / resolved.nEff - resolved.avgLossPerEffect;
  const topBrineTemp = input.steamTemperature - Math.max(uniformWorkDT, 0.5);

  // Concentration factor
  const brineConcentrationFactor = maxBrineSalinity / swSalinity;

  // Max tube length from available lengths
  const maxTubeLength = Math.max(...resolved.availableLengths);

  // Map tube material
  const tubeMaterial = mapTubeMaterial(resolved.tubeMaterialName);

  // Preheaters: raise the effective seawater discharge temperature
  // Each preheater uses vapor from an intermediate effect to heat the feed,
  // reducing sensible heat duty in the effects → more energy for evaporation → higher GOR.
  // The feed temperature rise is approximately 3-5°C per preheater.
  const numPH = input.numberOfPreheaters ?? 0;
  const phTempRise = numPH > 0 ? Math.min((topBrineTemp - condenserSWOutlet) * 0.7, numPH * 4) : 0;
  const effectiveSWDischargeTemp = condenserSWOutlet + phTempRise;

  return {
    plantType: 'MED',
    numberOfEffects: resolved.nEff,
    preheaters: [], // Preheaters handled separately by designer (not by core solver preheater chain)

    capacity,
    gorTarget: input.targetGOR,

    steamPressure,
    steamTemperature: input.steamTemperature,

    seawaterInletTemp: input.seawaterTemperature,
    seawaterDischargeTemp: effectiveSWDischargeTemp,
    seawaterSalinity: swSalinity,

    topBrineTemp,
    brineConcentrationFactor,
    condenserApproachTemp: condenserApproach,
    distillateTemp: condenserSWOutlet - 2, // distillate cooled to near condenser outlet
    condensateExtraction: 'FINAL_CONDENSER',
    foulingFactor: input.foulingResistance ?? 0.00015,

    evaporatorTubes: {
      od: resolved.tubeOD,
      thickness: resolved.tubeWall,
      length: maxTubeLength,
      material: tubeMaterial,
    },
    condenserTubes: {
      od: 17, // Ti standard
      thickness: 0.4,
      length: input.tiTubeLength ?? 2.1,
      material: 'titanium',
    },

    // Recirculation is handled by the result adapter (composeDesignerEffects)
    // using the designer's minGamma approach, not by the core solver.
    // Setting false here prevents the solver's rough tube-count-based estimate.
    brineRecirculation: false,
  };
}
