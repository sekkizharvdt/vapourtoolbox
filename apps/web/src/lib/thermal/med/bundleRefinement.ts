/**
 * Bundle Geometry Refinement
 *
 * Post-sizing step that runs the full tube bundle geometry engine
 * (OTL, clearances, vapour lanes) to validate and refine the TEMA-estimated
 * shell ID and tube count from equipment sizing.
 *
 * This is too slow for the H&M iteration loop but appropriate for the
 * final design stage where accurate geometry matters.
 */

import {
  calculateTubeBundleGeometry,
  estimateSprayZoneClearance,
  generateDefaultVapourLanes,
  type TubeBundleGeometryResult,
} from '../tubeBundleGeometry';
import type { MEDDesignerEffect } from './designerTypes';
import type { ResolvedDesignerInputs } from './inputAdapter';

/** Refined geometry for one evaporator effect */
export interface RefinedBundleGeometry {
  /** Shell ID needed to fit the required tubes (mm) */
  shellID: number;
  /** Geometry engine result */
  geometry: TubeBundleGeometryResult;
}

/**
 * Refine bundle geometry for all evaporator effects.
 *
 * For each effect:
 * 1. Start with the TEMA-estimated shell ID from equipment sizing
 * 2. Run the full geometry engine with OTL, bottom clearance, spray zone
 * 3. If actual tubes < required, increase shell ID and retry
 * 4. Return the refined shell ID and full geometry result
 *
 * @param effects Designer effect records (for tube count, tube length, vapour lanes)
 * @param sizing Equipment sizing results
 * @param resolved Resolved designer inputs (for pitch, tube OD, etc.)
 * @param sprayCoverageWidths Optional per-effect spray coverage width from nozzle selection (Phase 5)
 */
export function refineBundleGeometry(
  effects: MEDDesignerEffect[],
  resolved: ResolvedDesignerInputs,
  sprayCoverageWidths?: number[]
): RefinedBundleGeometry[] {
  const { tubeOD, pitch } = resolved;
  const results: RefinedBundleGeometry[] = [];

  for (let i = 0; i < effects.length; i++) {
    const eff = effects[i]!;
    // Use the effect's tube count (which includes user overrides from Step 2)
    const requiredTubes = eff.tubes;

    if (requiredTubes <= 0) {
      results.push({
        shellID: 0,
        geometry: emptyGeometry(),
      });
      continue;
    }

    // Start with the TEMA-estimated shell ID (from the effect's shellODmm minus wall thickness)
    const shellThk = resolved.shellThkMM;
    let shellID = eff.shellODmm - 2 * shellThk;

    // Estimate spray zone clearance from bundle width
    // For a half-circle bundle, width ≈ OTL radius
    const estimatedBundleWidth = (shellID - 100) / 2; // OTL radius
    const sprayZoneClear = estimateSprayZoneClearance(estimatedBundleWidth, 90);

    // Vapour lanes for effect 1 (typically 4 diagonal lanes)
    const vapourLanes = eff.hasVapourLanes
      ? generateDefaultVapourLanes(shellID / 2, 4, 57.9)
      : undefined;

    // Spray coverage clipping
    const maxTubeFieldWidth = sprayCoverageWidths?.[i];

    // Iteratively find the minimum shell ID that fits the required tubes
    const MAX_ITERATIONS = 10;
    let bestResult: TubeBundleGeometryResult | null = null;
    let bestShellID = shellID;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const result = calculateTubeBundleGeometry({
        shape: 'half_circle_left',
        shellID,
        tubeOD,
        pitch,
        sprayZoneClearance: sprayZoneClear,
        ...(vapourLanes && { vapourLanes }),
        ...(maxTubeFieldWidth !== undefined && { maxTubeFieldWidth }),
      });

      if (result.totalTubes >= requiredTubes) {
        bestResult = result;
        bestShellID = shellID;
        break;
      }

      // Not enough tubes — increase shell ID by 50mm and retry
      shellID += 50;

      // Safety: don't go beyond 5000mm
      if (shellID > 5000) {
        bestResult = result;
        bestShellID = shellID;
        break;
      }
    }

    if (!bestResult) {
      // Fallback: run once with current shell ID
      bestResult = calculateTubeBundleGeometry({
        shape: 'half_circle_left',
        shellID: bestShellID,
        tubeOD,
        pitch,
        sprayZoneClearance: sprayZoneClear,
        ...(vapourLanes && { vapourLanes }),
        ...(maxTubeFieldWidth !== undefined && { maxTubeFieldWidth }),
      });
    }

    results.push({
      shellID: bestShellID,
      geometry: bestResult,
    });
  }

  return results;
}

/**
 * Apply refined geometry back to designer effect records.
 * Mutates the effects array in place.
 */
export function applyRefinedGeometry(
  effects: MEDDesignerEffect[],
  refined: RefinedBundleGeometry[],
  shellThkMM: number
): void {
  for (let i = 0; i < effects.length; i++) {
    const ref = refined[i];
    if (!ref || ref.geometry.totalTubes === 0) continue;

    const eff = effects[i]!;
    const geo = ref.geometry;

    // Update shell OD from refined shell ID
    eff.shellODmm = Math.round(ref.shellID + 2 * shellThkMM);

    // Attach bundle geometry details
    eff.bundleGeometry = {
      otlDiameter: geo.otlDiameter,
      numberOfRows: geo.numberOfRows,
      actualTubeCount: geo.totalTubes,
      bundleWidthMM: geo.bundleWidthMM,
      bundleHeightMM: geo.bundleHeightMM,
      tubesRemovedByLanes: geo.tubesRemovedByLanes,
      bottomClearance: geo.bottomClearance,
      sprayZoneClearance: geo.sprayZoneClearance,
    };

    // Update drainage and spray clearance from actual geometry
    eff.drainageClearanceMM = geo.bottomClearance;
    eff.sprayNozzleSpaceMM = geo.sprayZoneClearance;
  }
}

function emptyGeometry(): TubeBundleGeometryResult {
  return {
    totalTubes: 0,
    rows: [],
    tubes: [],
    areaPerMeter: 0,
    bundleWidthMM: 0,
    bundleHeightMM: 0,
    numberOfRows: 0,
    otlDiameter: 0,
    bottomClearance: 0,
    sprayZoneClearance: 0,
    tubesRemovedByLanes: 0,
    tubesRemovedByExclusions: 0,
    warnings: [],
  };
}
