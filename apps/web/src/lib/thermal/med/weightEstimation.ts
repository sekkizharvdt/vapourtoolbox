/**
 * Weight Estimation for MED Plants
 *
 * Estimates dry and operating weights for evaporator shells (including tubes,
 * tube sheets, dished heads, water boxes, and internals), condensers, and
 * preheaters. Uses material densities for duplex SS, aluminium, and titanium.
 */

import type { ShellWeight, MEDWeightEstimate, MEDDesignerResult } from './designerTypes';

/** Material densities in kg/m³ */
const DENSITY = {
  duplex_ss: 7800, // UNS S32304
  al_5052: 2680,
  ti_gr2: 4510,
  ss_316l: 8000,
  water: 1000,
};

/** Material cost rates in USD/kg for budgetary estimation */
export const MATERIAL_COST_RATES: { [key: string]: number } = {
  duplex_ss: 8,
  al_5052: 6,
  ti_gr2: 30,
  ss_316l: 5,
  carbon_steel: 3,
};

/**
 * Weight of a 2:1 semi-ellipsoidal dished head (ASME standard)
 *
 * Approximate formula: W ≈ (π/4) × D² × t × ρ × K
 * where K ≈ 1.084 for 2:1 SE (accounts for knuckle region)
 *
 * @param diameterMM Inside diameter in mm
 * @param thicknessMM Thickness in mm
 * @param density Material density in kg/m³
 */
export function dishedHeadWeight(diameterMM: number, thicknessMM: number, density: number): number {
  const D = diameterMM / 1000; // m
  const t = thicknessMM / 1000; // m
  const K = 1.084; // 2:1 SE factor
  return (Math.PI / 4) * D * D * t * density * K;
}

/**
 * Estimate weight for a single evaporator shell
 */
export function estimateShellWeight(
  shellIDmm: number,
  shellLengthMM: number,
  shellThkMM: number,
  tubeSheetThkMM: number,
  tubes: number,
  tubeODmm: number,
  tubeWallMM: number,
  tubeLengthM: number,
  tubeDensity: number
): ShellWeight {
  const D = shellIDmm / 1000;
  const shellT = shellThkMM / 1000;
  const shellL = shellLengthMM / 1000;
  const tsT = tubeSheetThkMM / 1000;
  const tubeOD = tubeODmm / 1000;
  const tubeID = (tubeODmm - 2 * tubeWallMM) / 1000;
  const shellDensity = DENSITY.duplex_ss;

  // Cylindrical shell
  const shellOD = D + 2 * shellT;
  const shellWt = Math.PI * ((shellOD * shellOD - D * D) / 4) * shellL * shellDensity;

  // 2 × 2:1 SE dished heads
  const headWt = 2 * dishedHeadWeight(shellIDmm, shellThkMM, shellDensity);

  // 2 × tube sheets (flat circular plates with holes — approximate as solid)
  const tsWt = 2 * (Math.PI / 4) * D * D * tsT * shellDensity;

  // Tubes
  const tubeWt =
    tubes * (Math.PI / 4) * (tubeOD * tubeOD - tubeID * tubeID) * tubeLengthM * tubeDensity;

  // Water boxes (estimated as ~15% of shell weight)
  const wbWt = shellWt * 0.15;

  // Internals (demisters, spray pipes, baffles — ~10% of shell)
  const intWt = shellWt * 0.1;

  const total = shellWt + headWt + tsWt + tubeWt + wbWt + intWt;

  return {
    shell: Math.round(shellWt),
    dishedHeads: Math.round(headWt),
    tubeSheets: Math.round(tsWt),
    tubes: Math.round(tubeWt),
    waterBoxes: Math.round(wbWt),
    internals: Math.round(intWt),
    total: Math.round(total),
  };
}

/**
 * Estimate total plant weight
 */
export function estimatePlantWeight(
  result: MEDDesignerResult,
  shellThkMM: number = 8,
  tubeSheetThkMM: number = 8
): MEDWeightEstimate {
  const shellIDmm = result.inputs.shellID ?? 1800;
  const tubeOD = result.inputs.tubeOD ?? 25.4;
  const tubeWall = result.inputs.tubeWallThickness ?? 1.0;
  const tubeMat = (result.inputs.tubeMaterialName ?? 'Al 5052').toLowerCase();
  const tubeDensity = tubeMat.includes('ti') ? DENSITY.ti_gr2 : DENSITY.al_5052;

  const evaporatorShells: ShellWeight[] = result.effects.map((e) => {
    const shellLength = e.shellLengthMM; // includes tube + sheets + 2×750mm access
    return estimateShellWeight(
      shellIDmm,
      shellLength,
      shellThkMM,
      tubeSheetThkMM,
      e.tubes,
      tubeOD,
      tubeWall,
      e.tubeLength,
      tubeDensity
    );
  });

  // Condenser weight (rough estimate: area × 50 kg/m² for Ti S&T)
  const condenserWeight = Math.round(result.condenser.designArea * 50);

  // Preheaters weight (area × 60 kg/m² for small S&T)
  const preheatersWeight = Math.round(
    result.preheaters.reduce((sum, ph) => sum + ph.designArea, 0) * 60
  );

  const totalDry =
    evaporatorShells.reduce((sum, s) => sum + s.total, 0) + condenserWeight + preheatersWeight;

  // Operating weight: dry + water hold-up (~30% of shell volume)
  const shellVolume = result.effects.reduce((sum, e) => {
    const D = shellIDmm / 1000;
    const L = e.tubeLength + 0.2;
    return sum + (Math.PI / 4) * D * D * L * 0.3;
  }, 0);
  const waterHoldUp = shellVolume * DENSITY.water;
  const totalOperating = totalDry + waterHoldUp;

  return {
    evaporatorShells,
    condenserWeight,
    preheatersWeight,
    totalDryWeight: Math.round(totalDry),
    totalOperatingWeight: Math.round(totalOperating),
  };
}
