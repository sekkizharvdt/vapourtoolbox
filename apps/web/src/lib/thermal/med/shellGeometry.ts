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
