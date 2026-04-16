/**
 * MED Shell Geometry — Tube Bundle Layout in Lateral Half-Circle Shells
 *
 * Pure geometric calculations for:
 * - Counting tubes that fit in a given shell ID (lateral half-circle layout)
 * - Finding minimum shell ID for a required tube count
 * - Maximum tubes per transverse row (for wetting rate calculations)
 *
 * Also includes quick-estimate utility functions used during iterative design:
 * - satPressureMbar: Buck equation saturation pressure
 * - estimateU: resistance-based overall HTC for falling film evaporator
 *
 * These functions have zero coupling to the H&M balance — they depend only
 * on tube geometry constants from @vapour/constants.
 */

import { MED_TUBE_GEOMETRY } from '@vapour/constants';

// ============================================================================
// Saturation Pressure (quick estimate)
// ============================================================================

/**
 * Saturation pressure from temperature using Buck equation.
 * Quick estimate for iterative design — not for final H&M balance
 * (use getSaturationPressure from @vapour/constants for that).
 */
export function satPressureMbar(tempC: number): number {
  const P_kPa = 0.61121 * Math.exp((18.678 - tempC / 234.5) * (tempC / (257.14 + tempC)));
  return P_kPa * 10; // kPa to mbar
}

// ============================================================================
// Overall HTC Estimate
// ============================================================================

/**
 * Estimate overall HTC for falling film evaporator (W/m²·K).
 *
 * Resistance-based estimation calibrated against as-built projects:
 *   BARC Ti 0.4mm:  U ≈ 3,000 W/m²·K @ 58°C (validated within 0.1%)
 *   Case 6 Al 1mm:  U ≈ 2,800–3,550 W/m²·K
 *   Campiche:       U ≈ 2,082 W/m²·K (condenser, not evaporator)
 */
export function estimateU(tempC: number, _od: number, wallThk: number, kWall: number): number {
  const Rwall = wallThk / 1000 / kWall;
  const hCond = 10000 + 100 * (tempC - 40);
  const Rcond = 1 / hCond;
  const hEvap = 15000 + 100 * (tempC - 40);
  const Revap = 1 / hEvap;
  const Rfouling = 0.00015; // m²·K/W (TEMA standard for seawater)
  const Rtotal = Rcond + Revap + Rfouling + Rwall;
  const U = 1 / Rtotal;
  return Math.max(2400, Math.min(3500, U));
}

// ============================================================================
// Shell Geometry — Tube Count
// ============================================================================

/**
 * Count lateral tubes in a half-circle shell, accounting for internal clearances.
 *
 * Shell cross-section layout (vertical, left half = tubes, right half = vapour):
 *   Top:    Spray nozzle zone (200mm min above top tube row)
 *   Middle: Tube bundle (lateral half-circle)
 *   Bottom: Drainage clearance (250mm min below bottom tube row)
 */
export function countLateralTubes(
  shellID: number,
  _tubeOD: number,
  pitch: number,
  withVapourLanes: boolean
): number {
  const tubeHoleDia = MED_TUBE_GEOMETRY.tubeHoleDiameter;
  const edgeClearance = MED_TUBE_GEOMETRY.edgeClearance;
  const tubeHoleR = tubeHoleDia / 2;
  const rowSpacing = pitch * Math.sin((60 * Math.PI) / 180);
  const shellR = shellID / 2;
  const maxR = shellR - edgeClearance - tubeHoleR;

  const drainageClearanceMM = 250;
  const sprayZoneMM = 200;

  const yMax = maxR - sprayZoneMM;
  const yMin = -maxR + drainageClearanceMM;

  if (yMax <= yMin) return 0;

  let total = 0;
  let rowIndex = 0;

  for (let y = yMax; y >= yMin; y -= rowSpacing) {
    const isStaggered = rowIndex % 2 === 1;
    const xOffset = isStaggered ? pitch / 2 : 0;
    const chord = maxR * maxR - y * y;
    if (chord < 0) {
      rowIndex++;
      continue;
    }
    const halfChord = Math.sqrt(chord);
    const xMin = -halfChord;
    const xMax = tubeHoleR;
    const startX = Math.ceil((xMin - xOffset) / pitch) * pitch + xOffset;

    for (let x = startX; x <= xMax; x += pitch) {
      if (x * x + y * y <= maxR * maxR) total++;
    }
    rowIndex++;
  }

  return withVapourLanes ? Math.round(total * 0.85) : total;
}

// ============================================================================
// Shell Geometry — Minimum Shell ID
// ============================================================================

/**
 * Find the minimum shell ID that fits at least `requiredTubes` in a lateral bundle.
 * Searches from 800mm upward in 50mm increments, then refines to 10mm.
 */
export function findMinShellID(
  requiredTubes: number,
  tubeOD: number,
  pitch: number,
  withVapourLanes: boolean
): number {
  let shellID = 800;
  while (shellID <= 6000) {
    const count = countLateralTubes(shellID, tubeOD, pitch, withVapourLanes);
    if (count >= requiredTubes) break;
    shellID += 50;
  }
  shellID -= 50;
  while (shellID <= 6000) {
    const count = countLateralTubes(shellID, tubeOD, pitch, withVapourLanes);
    if (count >= requiredTubes) return shellID;
    shellID += 10;
  }
  return shellID;
}

// ============================================================================
// Shell Geometry — Max Tubes Per Row
// ============================================================================

/** Get max tubes per transverse row for wetting rate calculation */
export function getMaxTubesPerRow(shellID: number, pitch: number): number {
  const tubeHoleDia = MED_TUBE_GEOMETRY.tubeHoleDiameter;
  const edgeClearance = MED_TUBE_GEOMETRY.edgeClearance;
  const maxR = shellID / 2 - edgeClearance - tubeHoleDia / 2;
  return Math.floor(maxR / pitch) + 1;
}

// ============================================================================
// Shell Geometry — Vapour Path (Demister + Duct)
// ============================================================================

export interface VaporPathGeometry {
  /** Demister elevation above shell centre in mm */
  demisterElevation: number;
  /** Demister chord width in the free (right) semicircle in mm */
  demisterChordWidth: number;
  /** Demister pad area (tubeLength × chordWidth) in m² */
  demisterArea: number;
  /** Actual vapor velocity through demister pad in m/s */
  demisterVelocity: number;
  /** Steam flow area — cutout in tubesheet (right semicircle segment) in m² */
  steamFlowArea: number;
  /** Vapor velocity through the steam flow area cutout in m/s */
  steamFlowVelocity: number;
}

/**
 * Compute demister and steam flow area (vapour duct) geometry for a
 * lateral MED evaporator shell.
 *
 * In the tubesheet end-view, tubes fill the LEFT semicircle and the
 * RIGHT semicircle is the free side for vapour collection:
 *
 * ```
 *          ___________
 *        /  STEAM FLOW \    ← cutout in tubesheet (right semicircle segment)
 *       / T  AREA       \
 *      | T T ~~DEMIST~~  |  ← horizontal pad, width = right half chord
 *      | T T T   spray → |  ← spray nozzle on free side
 *      | T T T T         |
 *      | T T T T   FREE  |  ← free side (vapour collection)
 *      | T T T    SIDE   |
 *       \ T T           /
 *        \____________/
 *      ← tubes → ← free →
 * ```
 *
 * - Demister width = right-half chord: √(R² − y²) at demister elevation
 * - Steam flow area = right semicircle segment above (demister + pad + clearance)
 *     A = [R²·arccos(y/R) − y·√(R²−y²)] / 2
 *
 * The demister elevation is optimised per-effect from Souders-Brown
 * target loading, constrained to leave enough area above for the
 * steam flow cutout.
 *
 * @param shellID_mm   Shell inner diameter in mm (from findMinShellID)
 * @param tubeLength_m Tube length in m (demister spans this length)
 * @param vaporVolFlow Vapor volumetric flow in m³/s
 * @param rhoV         Vapor density in kg/m³ (for Souders-Brown)
 * @param rhoL         Liquid density in kg/m³ (for Souders-Brown)
 * @param padThickness Demister pad thickness in mm (default 150)
 * @param ductClearance Clearance between demister top and cutout bottom in mm (default 100)
 * @param designMargin Fraction of Souders-Brown Vmax for target velocity (default 0.50)
 */
export function computeVaporPathGeometry(
  shellID_mm: number,
  tubeLength_m: number,
  vaporVolFlow: number,
  rhoV: number,
  rhoL: number,
  padThickness = 150,
  ductClearance = 100,
  designMargin = 0.5
): VaporPathGeometry {
  const R = shellID_mm / 2; // shell radius in mm

  // ---- Find demister elevation that satisfies BOTH constraints: ----
  //   1. Demister velocity ≤ designMargin × Souders-Brown Vmax
  //   2. Steam flow velocity ≤ TARGET_STEAM_FLOW_VELOCITY
  // Both improve (decrease) as the demister goes lower, so the binding
  // constraint is whichever requires the demister to be lowest.
  const K_SB = 0.107; // wire mesh, horizontal
  const vMax = K_SB * Math.sqrt(Math.max((rhoL - rhoV) / rhoV, 0));
  const vDemTarget = designMargin * vMax;
  const TARGET_STEAM_FLOW_VELOCITY = 30; // m/s — target for tubesheet cutout

  // Constraint 1: from Souders-Brown target on demister
  const requiredDemArea = vDemTarget > 0 ? vaporVolFlow / vDemTarget : 0;
  const requiredChord_mm = tubeLength_m > 0 ? (requiredDemArea / tubeLength_m) * 1000 : 0;
  let y_from_sb: number;
  if (requiredChord_mm >= R) {
    y_from_sb = 0;
  } else {
    y_from_sb = Math.sqrt(R * R - requiredChord_mm * requiredChord_mm);
  }

  // Constraint 2: from target steam flow velocity
  // Find y_duct where right-semicircle segment area = Q / V_target
  const requiredSteamArea_mm2 =
    TARGET_STEAM_FLOW_VELOCITY > 0
      ? (vaporVolFlow / TARGET_STEAM_FLOW_VELOCITY) * 1e6 // m² → mm²
      : 0;
  // Bisection: find y_duct where segment area = requiredSteamArea_mm2
  let y_duct_from_steam = 0;
  if (requiredSteamArea_mm2 > 0) {
    let lo = 0,
      hi = R;
    for (let iter = 0; iter < 30; iter++) {
      const mid = (lo + hi) / 2;
      const ratio = Math.min(mid / R, 1);
      const segArea =
        (R * R * Math.acos(ratio) - mid * Math.sqrt(Math.max(R * R - mid * mid, 0))) / 2;
      if (segArea > requiredSteamArea_mm2) {
        lo = mid; // area too big → move y up
      } else {
        hi = mid; // area too small → move y down
      }
    }
    y_duct_from_steam = (lo + hi) / 2;
  }
  const y_from_steam = Math.max(0, y_duct_from_steam - padThickness - ductClearance);

  // Use the LOWER elevation (more conservative — satisfies both constraints)
  let y_dem = Math.min(y_from_sb, y_from_steam);
  y_dem = Math.max(y_dem, 0); // must be above centreline

  // Actual right-half chord width at computed elevation
  const demisterChordWidth = Math.sqrt(Math.max(R * R - y_dem * y_dem, 0)); // mm
  const demisterArea = tubeLength_m * (demisterChordWidth / 1000); // m²
  const demisterVelocity = demisterArea > 0 ? vaporVolFlow / demisterArea : 0;

  // ---- Steam flow area: right semicircle segment above (demister top + clearance) ----
  // Cutout in tubesheet for vapor to pass into the vapour box of the next effect.
  //   A = [R²·arccos(y_d/R) − y_d·√(R²−y_d²)] / 2
  const y_duct = y_dem + padThickness + ductClearance; // mm from centre

  let steamFlowArea: number;
  if (y_duct >= R) {
    steamFlowArea = 0;
  } else {
    const ratio = Math.min(y_duct / R, 1);
    steamFlowArea =
      (R * R * Math.acos(ratio) - y_duct * Math.sqrt(Math.max(R * R - y_duct * y_duct, 0))) /
      (2 * 1e6); // mm² → m² (divide by 2 for right semicircle only)
  }

  const steamFlowVelocity = steamFlowArea > 0 ? vaporVolFlow / steamFlowArea : 0;

  return {
    demisterElevation: y_dem,
    demisterChordWidth,
    demisterArea,
    demisterVelocity,
    steamFlowArea,
    steamFlowVelocity,
  };
}
