/**
 * Spray Nozzle Selection Calculator
 *
 * Selects spray nozzles from the Spraying Systems Co. CAT75HYD catalogue
 * based on required flow rate, operating pressure, and nozzle type.
 *
 * Nozzle types supported:
 *   - Full Cone Circular (FullJet G/H standard angle)
 *   - Full Cone Wide (FullJet G-W/H-W wide angle)
 *   - Full Cone Square (FullJet G-SQ/H-SQ standard, H-WSQ/HH-WSQ wide)
 *   - Hollow Cone Circular (WhirlJet AX/BX standard angle)
 *
 * Flow rate scaling uses the catalogue flow exponent relationship:
 *   Q₁/Q₂ = (P₁/P₂)ⁿ
 *
 * Reference:
 *   Spraying Systems Co., Industrial Hydraulic Spray Products,
 *   Catalogue 75-HYD (Metric), Section A5 — Capacity and Specific Gravity.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type NozzleCategory =
  | 'full_cone_circular'
  | 'full_cone_wide'
  | 'full_cone_square'
  | 'hollow_cone_circular';

export interface NozzleEntry {
  /** Catalogue capacity size, e.g. '10', '25W', '14WSQ' */
  capacitySize: string;
  /** Inlet connection size in inches, e.g. '1/4', '1/2' */
  inletConn: string;
  /** Nominal orifice diameter (mm) */
  orificeDia: number;
  /** Maximum free passage diameter (mm) */
  maxFreePassage: number;
  /** Flow rate at rated pressure (lpm) */
  ratedFlow: number;
  /** Spray angle at low pressure (°) */
  angleAtLow: number;
  /** Spray angle at mid pressure (°) */
  angleAtMid: number;
  /** Spray angle at high pressure (°) */
  angleAtHigh: number;
  /** Per-nozzle flow exponent override (e.g. WSQ uses 0.44 vs SQ 0.46) */
  flowExponent?: number;
  /** Per-nozzle angle pressures override [low, mid, high] in bar */
  anglePressures?: [number, number, number];
}

export interface NozzleCategoryConfig {
  label: string;
  description: string;
  /** Flow exponent n for Q₁/Q₂ = (P₁/P₂)ⁿ */
  flowExponent: number;
  /** Pressure at which ratedFlow is specified (bar) */
  ratedPressure: number;
  /** Pressures at which spray angles are measured [low, mid, high] (bar) */
  anglePressures: [number, number, number];
  /** Model series name */
  seriesName: string;
  /** Nozzle entries */
  nozzles: NozzleEntry[];
}

export interface SprayNozzleInput {
  category: NozzleCategory;
  /** Total required flow rate (lpm) */
  requiredFlow: number;
  /** Operating pressure (bar) */
  operatingPressure: number;
  /** Number of nozzles to divide flow across (default 1) */
  numberOfNozzles?: number;
  /** Spray distance from nozzle to target (mm) — for coverage calculation */
  sprayDistance?: number;
  /** Tolerance for flow matching as fraction (default 0.25 = ±25%) */
  tolerance?: number;
}

export interface NozzleMatch {
  nozzle: NozzleEntry;
  /** Calculated flow rate at operating pressure (lpm) */
  flowAtPressure: number;
  /** Interpolated spray angle at operating pressure (°) */
  sprayAngle: number;
  /** Spray coverage diameter/side at given distance (mm), if distance provided */
  coverage?: number;
  /** Deviation from required flow per nozzle (%) */
  deviationPercent: number;
  /** Catalogue ordering model designation (e.g. '1HH-WSQ-130') */
  modelNumber: string;
}

export interface SprayNozzleResult {
  matches: NozzleMatch[];
  category: NozzleCategory;
  operatingPressure: number;
  /** Flow required per nozzle (lpm) */
  flowPerNozzle: number;
  numberOfNozzles: number;
}

// ── Layout Types ──────────────────────────────────────────────────────────────

export interface NozzleLayoutInput {
  category: NozzleCategory;
  /** Total required flow rate (lpm) */
  totalFlow: number;
  /** Operating pressure (bar) */
  operatingPressure: number;
  /** Tube bundle length (mm) — nozzles are arrayed along this dimension */
  bundleLength: number;
  /** Tube bundle width (mm) — one nozzle covers this via derived height */
  bundleWidth: number;
  /** Target spray height (mm) — nozzles closest to this height ranked first (default 500) */
  targetHeight?: number;
  /** Minimum acceptable derived spray height (mm, default 300) */
  minHeight?: number;
  /** Maximum acceptable derived spray height (mm, default 800) */
  maxHeight?: number;
  /** Overshoot margin per side (mm) — spray extends past bundle edge (default 50) */
  overshootMargin?: number;
  /** Minimum overlap between adjacent nozzle coverages as fraction (default 0.15 = 15%) */
  minOverlap?: number;
  /** Flow tolerance for matching (default 0.25 = ±25%) */
  tolerance?: number;
}

export interface NozzleLayoutMatch {
  nozzle: NozzleEntry;
  /** Flow this nozzle delivers at operating pressure (lpm) */
  flowAtPressure: number;
  /** Interpolated spray angle at operating pressure (°) */
  sprayAngle: number;
  /** Derived spray height where nozzle coverage meets required width (mm) */
  derivedHeight: number;
  /** Coverage diameter/side at derived height (mm) */
  coverageDiameter: number;
  /** Effective pitch between nozzle centres along length (mm) */
  pitchAlongLength: number;
  /** Effective pitch between rows across width (mm) — 0 if single row */
  pitchAcrossWidth: number;
  /** Number of nozzles along the bundle length */
  nozzlesAlongLength: number;
  /** Number of rows across the bundle width (1 = single row) */
  rowsAcrossWidth: number;
  /** Total number of nozzles = nozzlesAlongLength × rowsAcrossWidth */
  totalNozzles: number;
  /** Required flow per nozzle = totalFlow / totalNozzles (lpm) */
  requiredFlowPerNozzle: number;
  /** Deviation of actual nozzle flow from required flow per nozzle (%) */
  deviationPercent: number;
  /** Actual overlap along length (%) */
  actualOverlapLength: number;
  /** Actual overlap across width between rows (%) — 0 if single row */
  actualOverlapWidth: number;
  /** Total spray coverage along length (mm) — outer edge to outer edge */
  totalCoverageLength: number;
  /** Deviation of derived height from target height (mm) */
  heightDeviation: number;
  /** Percentage of total spray that falls outside the bundle area (%) */
  wastedFlowPercent: number;
  /** Absolute wasted flow (lpm) — spray falling outside the bundle */
  wastedFlowLpm: number;
  /** Catalogue ordering model designation (e.g. '1HH-WSQ-130') */
  modelNumber: string;
}

export interface NozzleLayoutResult {
  matches: NozzleLayoutMatch[];
  category: NozzleCategory;
  operatingPressure: number;
  bundleLength: number;
  bundleWidth: number;
  targetHeight: number;
  minHeight: number;
  maxHeight: number;
  overshootMargin: number;
  minOverlap: number;
  totalFlow: number;
}

// ── Catalogue Data ───────────────────────────────────────────────────────────
//
// Extracted from Spraying Systems Co. CAT75HYD (Metric).
// Each entry: { capacitySize, inletConn, orificeDia, maxFreePassage, ratedFlow,
//               angleAtLow, angleAtMid, angleAtHigh }

// -- Full Cone Circular (FullJet G/H — Standard Angle) --
// Rated pressure: 3 bar, flow exponent: 0.46
// Spray angles at: 0.5 bar (low), 1.5 bar (mid), 6 bar (high)
const FULL_CONE_CIRCULAR: NozzleEntry[] = [
  // 1/8" connection
  {
    capacitySize: '1',
    inletConn: '1/8',
    orificeDia: 0.79,
    maxFreePassage: 0.64,
    ratedFlow: 0.74,
    angleAtLow: 58,
    angleAtMid: 53,
    angleAtHigh: 46,
  },
  {
    capacitySize: '1.5',
    inletConn: '1/8',
    orificeDia: 1.2,
    maxFreePassage: 0.64,
    ratedFlow: 1.1,
    angleAtLow: 52,
    angleAtMid: 65,
    angleAtHigh: 59,
  },
  {
    capacitySize: '2',
    inletConn: '1/8',
    orificeDia: 1.2,
    maxFreePassage: 1.0,
    ratedFlow: 1.5,
    angleAtLow: 43,
    angleAtMid: 50,
    angleAtHigh: 46,
  },
  {
    capacitySize: '3',
    inletConn: '1/8',
    orificeDia: 1.5,
    maxFreePassage: 1.0,
    ratedFlow: 2.2,
    angleAtLow: 52,
    angleAtMid: 65,
    angleAtHigh: 59,
  },
  {
    capacitySize: '3.5',
    inletConn: '1/8',
    orificeDia: 1.6,
    maxFreePassage: 1.3,
    ratedFlow: 2.6,
    angleAtLow: 43,
    angleAtMid: 50,
    angleAtHigh: 46,
  },
  {
    capacitySize: '3.9',
    inletConn: '1/8',
    orificeDia: 2.0,
    maxFreePassage: 1.0,
    ratedFlow: 2.9,
    angleAtLow: 77,
    angleAtMid: 84,
    angleAtHigh: 79,
  },
  {
    capacitySize: '5',
    inletConn: '1/8',
    orificeDia: 2.0,
    maxFreePassage: 1.3,
    ratedFlow: 3.7,
    angleAtLow: 52,
    angleAtMid: 65,
    angleAtHigh: 59,
  },
  {
    capacitySize: '6.1',
    inletConn: '1/8',
    orificeDia: 2.3,
    maxFreePassage: 1.3,
    ratedFlow: 4.5,
    angleAtLow: 69,
    angleAtMid: 74,
    angleAtHigh: 68,
  },
  // 1/4" connection
  {
    capacitySize: '6.5',
    inletConn: '1/4',
    orificeDia: 2.4,
    maxFreePassage: 1.6,
    ratedFlow: 4.8,
    angleAtLow: 45,
    angleAtMid: 50,
    angleAtHigh: 46,
  },
  {
    capacitySize: '10',
    inletConn: '1/4',
    orificeDia: 3.2,
    maxFreePassage: 1.6,
    ratedFlow: 7.5,
    angleAtLow: 58,
    angleAtMid: 67,
    angleAtHigh: 61,
  },
  {
    capacitySize: '12.5',
    inletConn: '1/4',
    orificeDia: 3.2,
    maxFreePassage: 1.6,
    ratedFlow: 9.3,
    angleAtLow: 69,
    angleAtMid: 74,
    angleAtHigh: 68,
  },
  // 3/8" connection
  {
    capacitySize: '9.5',
    inletConn: '3/8',
    orificeDia: 2.6,
    maxFreePassage: 2.4,
    ratedFlow: 7.1,
    angleAtLow: 45,
    angleAtMid: 50,
    angleAtHigh: 46,
  },
  {
    capacitySize: '15',
    inletConn: '3/8',
    orificeDia: 3.6,
    maxFreePassage: 2.4,
    ratedFlow: 11.2,
    angleAtLow: 64,
    angleAtMid: 67,
    angleAtHigh: 61,
  },
  {
    capacitySize: '20',
    inletConn: '3/8',
    orificeDia: 4.0,
    maxFreePassage: 2.8,
    ratedFlow: 14.5,
    angleAtLow: 76,
    angleAtMid: 80,
    angleAtHigh: 73,
  },
  {
    capacitySize: '22',
    inletConn: '3/8',
    orificeDia: 4.5,
    maxFreePassage: 2.8,
    ratedFlow: 16.4,
    angleAtLow: 87,
    angleAtMid: 90,
    angleAtHigh: 82,
  },
  // 1/2" connection
  {
    capacitySize: '16',
    inletConn: '1/2',
    orificeDia: 3.5,
    maxFreePassage: 3.2,
    ratedFlow: 11.9,
    angleAtLow: 48,
    angleAtMid: 50,
    angleAtHigh: 46,
  },
  {
    capacitySize: '25',
    inletConn: '1/2',
    orificeDia: 4.6,
    maxFreePassage: 3.2,
    ratedFlow: 18.6,
    angleAtLow: 64,
    angleAtMid: 67,
    angleAtHigh: 61,
  },
  {
    capacitySize: '32',
    inletConn: '1/2',
    orificeDia: 5.2,
    maxFreePassage: 3.6,
    ratedFlow: 24,
    angleAtLow: 72,
    angleAtMid: 75,
    angleAtHigh: 68,
  },
  {
    capacitySize: '40',
    inletConn: '1/2',
    orificeDia: 6.2,
    maxFreePassage: 3.6,
    ratedFlow: 29,
    angleAtLow: 88,
    angleAtMid: 91,
    angleAtHigh: 83,
  },
  {
    capacitySize: '50',
    inletConn: '1/2',
    orificeDia: 6.7,
    maxFreePassage: 4.0,
    ratedFlow: 37,
    angleAtLow: 91,
    angleAtMid: 94,
    angleAtHigh: 86,
  },
  // 3/4" connection
  {
    capacitySize: '2.5',
    inletConn: '3/4',
    orificeDia: 4.9,
    maxFreePassage: 4.4,
    ratedFlow: 22,
    angleAtLow: 48,
    angleAtMid: 50,
    angleAtHigh: 46,
  },
  {
    capacitySize: '4.0',
    inletConn: '3/4',
    orificeDia: 6.4,
    maxFreePassage: 4.4,
    ratedFlow: 35,
    angleAtLow: 67,
    angleAtMid: 70,
    angleAtHigh: 63,
  },
  {
    capacitySize: '7.0',
    inletConn: '3/4',
    orificeDia: 9.5,
    maxFreePassage: 5.2,
    ratedFlow: 61,
    angleAtLow: 89,
    angleAtMid: 92,
    angleAtHigh: 84,
  },
  // 1" connection
  {
    capacitySize: '4.2',
    inletConn: '1',
    orificeDia: 6.0,
    maxFreePassage: 5.6,
    ratedFlow: 37,
    angleAtLow: 48,
    angleAtMid: 50,
    angleAtHigh: 46,
  },
  {
    capacitySize: '7.0',
    inletConn: '1',
    orificeDia: 8.3,
    maxFreePassage: 5.6,
    ratedFlow: 61,
    angleAtLow: 67,
    angleAtMid: 68,
    angleAtHigh: 62,
  },
  {
    capacitySize: '8.0',
    inletConn: '1',
    orificeDia: 9.5,
    maxFreePassage: 5.6,
    ratedFlow: 70,
    angleAtLow: 72,
    angleAtMid: 81,
    angleAtHigh: 82,
  },
  {
    capacitySize: '10',
    inletConn: '1',
    orificeDia: 11.9,
    maxFreePassage: 5.6,
    ratedFlow: 88,
    angleAtLow: 78,
    angleAtMid: 90,
    angleAtHigh: 94,
  },
  {
    capacitySize: '12',
    inletConn: '1',
    orificeDia: 11.9,
    maxFreePassage: 6.4,
    ratedFlow: 105,
    angleAtLow: 89,
    angleAtMid: 92,
    angleAtHigh: 84,
  },
  // 1-1/4" connection
  {
    capacitySize: '6',
    inletConn: '1-1/4',
    orificeDia: 7.4,
    maxFreePassage: 6.4,
    ratedFlow: 53,
    angleAtLow: 48,
    angleAtMid: 50,
    angleAtHigh: 44,
  },
  {
    capacitySize: '10',
    inletConn: '1-1/4',
    orificeDia: 9.6,
    maxFreePassage: 6.4,
    ratedFlow: 88,
    angleAtLow: 64,
    angleAtMid: 67,
    angleAtHigh: 58,
  },
  {
    capacitySize: '12',
    inletConn: '1-1/4',
    orificeDia: 10.7,
    maxFreePassage: 6.4,
    ratedFlow: 105,
    angleAtLow: 66,
    angleAtMid: 70,
    angleAtHigh: 60,
  },
  {
    capacitySize: '14',
    inletConn: '1-1/4',
    orificeDia: 12.3,
    maxFreePassage: 6.4,
    ratedFlow: 123,
    angleAtLow: 77,
    angleAtMid: 80,
    angleAtHigh: 70,
  },
  {
    capacitySize: '16',
    inletConn: '1-1/4',
    orificeDia: 12.7,
    maxFreePassage: 7.9,
    ratedFlow: 140,
    angleAtLow: 73,
    angleAtMid: 76,
    angleAtHigh: 66,
  },
  {
    capacitySize: '20',
    inletConn: '1-1/4',
    orificeDia: 15.1,
    maxFreePassage: 7.9,
    ratedFlow: 175,
    angleAtLow: 90,
    angleAtMid: 93,
    angleAtHigh: 81,
  },
  // 1-1/2" connection
  {
    capacitySize: '10',
    inletConn: '1-1/2',
    orificeDia: 9.5,
    maxFreePassage: 8.7,
    ratedFlow: 88,
    angleAtLow: 48,
    angleAtMid: 50,
    angleAtHigh: 44,
  },
  {
    capacitySize: '16',
    inletConn: '1-1/2',
    orificeDia: 12.7,
    maxFreePassage: 8.7,
    ratedFlow: 140,
    angleAtLow: 72,
    angleAtMid: 74,
    angleAtHigh: 64,
  },
  {
    capacitySize: '20',
    inletConn: '1-1/2',
    orificeDia: 14.3,
    maxFreePassage: 8.7,
    ratedFlow: 175,
    angleAtLow: 74,
    angleAtMid: 76,
    angleAtHigh: 66,
  },
  {
    capacitySize: '30',
    inletConn: '1-1/2',
    orificeDia: 18.3,
    maxFreePassage: 10.3,
    ratedFlow: 263,
    angleAtLow: 91,
    angleAtMid: 94,
    angleAtHigh: 82,
  },
  // 2" connection
  {
    capacitySize: '17',
    inletConn: '2',
    orificeDia: 12.7,
    maxFreePassage: 11.1,
    ratedFlow: 149,
    angleAtLow: 49,
    angleAtMid: 50,
    angleAtHigh: 44,
  },
  {
    capacitySize: '30',
    inletConn: '2',
    orificeDia: 17.3,
    maxFreePassage: 11.1,
    ratedFlow: 263,
    angleAtLow: 72,
    angleAtMid: 74,
    angleAtHigh: 64,
  },
  {
    capacitySize: '35',
    inletConn: '2',
    orificeDia: 19.2,
    maxFreePassage: 11.1,
    ratedFlow: 307,
    angleAtLow: 75,
    angleAtMid: 77,
    angleAtHigh: 68,
  },
  {
    capacitySize: '40',
    inletConn: '2',
    orificeDia: 21.0,
    maxFreePassage: 11.1,
    ratedFlow: 351,
    angleAtLow: 78,
    angleAtMid: 80,
    angleAtHigh: 70,
  },
  {
    capacitySize: '50',
    inletConn: '2',
    orificeDia: 23.8,
    maxFreePassage: 14.3,
    ratedFlow: 439,
    angleAtLow: 83,
    angleAtMid: 85,
    angleAtHigh: 75,
  },
  {
    capacitySize: '60',
    inletConn: '2',
    orificeDia: 28.6,
    maxFreePassage: 14.3,
    ratedFlow: 526,
    angleAtLow: 98,
    angleAtMid: 100,
    angleAtHigh: 86,
  },
  // 2-1/2" connection
  {
    capacitySize: '25',
    inletConn: '2-1/2',
    orificeDia: 15.1,
    maxFreePassage: 14.3,
    ratedFlow: 219,
    angleAtLow: 49,
    angleAtMid: 50,
    angleAtHigh: 44,
  },
  {
    capacitySize: '50',
    inletConn: '2-1/2',
    orificeDia: 22.2,
    maxFreePassage: 14.3,
    ratedFlow: 439,
    angleAtLow: 72,
    angleAtMid: 74,
    angleAtHigh: 64,
  },
  {
    capacitySize: '60',
    inletConn: '2-1/2',
    orificeDia: 24.6,
    maxFreePassage: 14.3,
    ratedFlow: 526,
    angleAtLow: 76,
    angleAtMid: 78,
    angleAtHigh: 68,
  },
  {
    capacitySize: '70',
    inletConn: '2-1/2',
    orificeDia: 28.6,
    maxFreePassage: 14.3,
    ratedFlow: 614,
    angleAtLow: 79,
    angleAtMid: 82,
    angleAtHigh: 72,
  },
  {
    capacitySize: '80',
    inletConn: '2-1/2',
    orificeDia: 28.6,
    maxFreePassage: 17.5,
    ratedFlow: 702,
    angleAtLow: 86,
    angleAtMid: 88,
    angleAtHigh: 77,
  },
  {
    capacitySize: '90',
    inletConn: '2-1/2',
    orificeDia: 30.2,
    maxFreePassage: 17.5,
    ratedFlow: 790,
    angleAtLow: 95,
    angleAtMid: 97,
    angleAtHigh: 84,
  },
  // 3" connection
  {
    capacitySize: '42',
    inletConn: '3',
    orificeDia: 19.1,
    maxFreePassage: 17.5,
    ratedFlow: 368,
    angleAtLow: 49,
    angleAtMid: 50,
    angleAtHigh: 44,
  },
  {
    capacitySize: '80',
    inletConn: '3',
    orificeDia: 27.8,
    maxFreePassage: 17.5,
    ratedFlow: 702,
    angleAtLow: 81,
    angleAtMid: 84,
    angleAtHigh: 73,
  },
  {
    capacitySize: '90',
    inletConn: '3',
    orificeDia: 30.2,
    maxFreePassage: 17.5,
    ratedFlow: 790,
    angleAtLow: 86,
    angleAtMid: 89,
    angleAtHigh: 77,
  },
  {
    capacitySize: '100',
    inletConn: '3',
    orificeDia: 32.5,
    maxFreePassage: 17.5,
    ratedFlow: 877,
    angleAtLow: 92,
    angleAtMid: 95,
    angleAtHigh: 83,
  },
  {
    capacitySize: '110',
    inletConn: '3',
    orificeDia: 33.3,
    maxFreePassage: 18.2,
    ratedFlow: 965,
    angleAtLow: 86,
    angleAtMid: 89,
    angleAtHigh: 77,
  },
  {
    capacitySize: '120',
    inletConn: '3',
    orificeDia: 34.9,
    maxFreePassage: 20.6,
    ratedFlow: 1053,
    angleAtLow: 102,
    angleAtMid: 105,
    angleAtHigh: 89,
  },
  // 4" connection
  {
    capacitySize: '160',
    inletConn: '4',
    orificeDia: 42.9,
    maxFreePassage: 19.1,
    ratedFlow: 1404,
    angleAtLow: 87,
    angleAtMid: 90,
    angleAtHigh: 70,
  },
  {
    capacitySize: '180',
    inletConn: '4',
    orificeDia: 47.2,
    maxFreePassage: 22.2,
    ratedFlow: 1579,
    angleAtLow: 92,
    angleAtMid: 95,
    angleAtHigh: 83,
  },
  {
    capacitySize: '200',
    inletConn: '4',
    orificeDia: 50.8,
    maxFreePassage: 25.4,
    ratedFlow: 1755,
    angleAtLow: 97,
    angleAtMid: 100,
    angleAtHigh: 87,
  },
  {
    capacitySize: '210',
    inletConn: '4',
    orificeDia: 54.8,
    maxFreePassage: 25.4,
    ratedFlow: 1842,
    angleAtLow: 102,
    angleAtMid: 105,
    angleAtHigh: 91,
  },
  // 5" connection
  {
    capacitySize: '250',
    inletConn: '5',
    orificeDia: 47.6,
    maxFreePassage: 28.6,
    ratedFlow: 2193,
    angleAtLow: 89,
    angleAtMid: 91,
    angleAtHigh: 80,
  },
  {
    capacitySize: '280',
    inletConn: '5',
    orificeDia: 52.8,
    maxFreePassage: 28.6,
    ratedFlow: 2456,
    angleAtLow: 93,
    angleAtMid: 96,
    angleAtHigh: 84,
  },
  {
    capacitySize: '320',
    inletConn: '5',
    orificeDia: 68.3,
    maxFreePassage: 34.9,
    ratedFlow: 2807,
    angleAtLow: 97,
    angleAtMid: 100,
    angleAtHigh: 87,
  },
  {
    capacitySize: '330',
    inletConn: '5',
    orificeDia: 72.2,
    maxFreePassage: 34.9,
    ratedFlow: 2895,
    angleAtLow: 102,
    angleAtMid: 105,
    angleAtHigh: 91,
  },
  // 6" connection
  {
    capacitySize: '350',
    inletConn: '6',
    orificeDia: 61.1,
    maxFreePassage: 41.3,
    ratedFlow: 3070,
    angleAtLow: 87,
    angleAtMid: 90,
    angleAtHigh: 78,
  },
  {
    capacitySize: '400',
    inletConn: '6',
    orificeDia: 69.1,
    maxFreePassage: 41.3,
    ratedFlow: 3509,
    angleAtLow: 92,
    angleAtMid: 95,
    angleAtHigh: 83,
  },
  {
    capacitySize: '450',
    inletConn: '6',
    orificeDia: 77,
    maxFreePassage: 44.5,
    ratedFlow: 3948,
    angleAtLow: 97,
    angleAtMid: 100,
    angleAtHigh: 87,
  },
  {
    capacitySize: '480',
    inletConn: '6',
    orificeDia: 81.8,
    maxFreePassage: 44.5,
    ratedFlow: 4211,
    angleAtLow: 102,
    angleAtMid: 105,
    angleAtHigh: 91,
  },
  // 8" connection
  {
    capacitySize: '500',
    inletConn: '8',
    orificeDia: 69.9,
    maxFreePassage: 47.6,
    ratedFlow: 4386,
    angleAtLow: 78,
    angleAtMid: 80,
    angleAtHigh: 70,
  },
  {
    capacitySize: '600',
    inletConn: '8',
    orificeDia: 80.2,
    maxFreePassage: 47.6,
    ratedFlow: 5264,
    angleAtLow: 86,
    angleAtMid: 88,
    angleAtHigh: 77,
  },
  {
    capacitySize: '700',
    inletConn: '8',
    orificeDia: 91.3,
    maxFreePassage: 47.6,
    ratedFlow: 6141,
    angleAtLow: 92,
    angleAtMid: 95,
    angleAtHigh: 83,
  },
  {
    capacitySize: '800',
    inletConn: '8',
    orificeDia: 102,
    maxFreePassage: 57.2,
    ratedFlow: 7018,
    angleAtLow: 102,
    angleAtMid: 105,
    angleAtHigh: 91,
  },
  {
    capacitySize: '900',
    inletConn: '8',
    orificeDia: 124,
    maxFreePassage: 57.2,
    ratedFlow: 7895,
    angleAtLow: 106,
    angleAtMid: 110,
    angleAtHigh: 96,
  },
  // 10" connection
  {
    capacitySize: '800',
    inletConn: '10',
    orificeDia: 85.1,
    maxFreePassage: 63.5,
    ratedFlow: 7018,
    angleAtLow: 78,
    angleAtMid: 80,
    angleAtHigh: 70,
  },
  {
    capacitySize: '1000',
    inletConn: '10',
    orificeDia: 101,
    maxFreePassage: 63.5,
    ratedFlow: 8773,
    angleAtLow: 86,
    angleAtMid: 89,
    angleAtHigh: 77,
  },
  {
    capacitySize: '1200',
    inletConn: '10',
    orificeDia: 122,
    maxFreePassage: 66.7,
    ratedFlow: 10527,
    angleAtLow: 97,
    angleAtMid: 100,
    angleAtHigh: 87,
  },
  {
    capacitySize: '1300',
    inletConn: '10',
    orificeDia: 135,
    maxFreePassage: 66.7,
    ratedFlow: 11404,
    angleAtLow: 103,
    angleAtMid: 106,
    angleAtHigh: 92,
  },
];

// -- Full Cone Wide (FullJet G-W/H-W — Wide Angle) --
// Rated pressure: 3 bar, flow exponent: 0.44
// Spray angles at: 0.4 bar (low), 0.7 bar (mid), 6 bar (high)
const FULL_CONE_WIDE: NozzleEntry[] = [
  // 1/8" connection
  {
    capacitySize: '1.5W',
    inletConn: '1/8',
    orificeDia: 1.2,
    maxFreePassage: 0.64,
    ratedFlow: 1.1,
    angleAtLow: 120,
    angleAtMid: 120,
    angleAtHigh: 86,
  },
  {
    capacitySize: '2.8W',
    inletConn: '1/8',
    orificeDia: 1.6,
    maxFreePassage: 1.0,
    ratedFlow: 2.0,
    angleAtLow: 120,
    angleAtMid: 120,
    angleAtHigh: 102,
  },
  {
    capacitySize: '4.3W',
    inletConn: '1/8',
    orificeDia: 2.0,
    maxFreePassage: 1.0,
    ratedFlow: 3.1,
    angleAtLow: 120,
    angleAtMid: 120,
    angleAtHigh: 102,
  },
  {
    capacitySize: '5.6W',
    inletConn: '1/8',
    orificeDia: 2.4,
    maxFreePassage: 1.0,
    ratedFlow: 4.0,
    angleAtLow: 120,
    angleAtMid: 120,
    angleAtHigh: 102,
  },
  {
    capacitySize: '8W',
    inletConn: '1/8',
    orificeDia: 2.4,
    maxFreePassage: 1.3,
    ratedFlow: 6.0,
    angleAtLow: 120,
    angleAtMid: 120,
    angleAtHigh: 103,
  },
  // 1/4" connection
  {
    capacitySize: '10W',
    inletConn: '1/4',
    orificeDia: 2.8,
    maxFreePassage: 1.3,
    ratedFlow: 7.5,
    angleAtLow: 112,
    angleAtMid: 120,
    angleAtHigh: 103,
  },
  {
    capacitySize: '12W',
    inletConn: '1/4',
    orificeDia: 3.2,
    maxFreePassage: 1.3,
    ratedFlow: 8.9,
    angleAtLow: 114,
    angleAtMid: 120,
    angleAtHigh: 103,
  },
  {
    capacitySize: '14W',
    inletConn: '1/4',
    orificeDia: 3.6,
    maxFreePassage: 1.6,
    ratedFlow: 10.2,
    angleAtLow: 114,
    angleAtMid: 120,
    angleAtHigh: 103,
  },
  // 3/8" connection
  {
    capacitySize: '17W',
    inletConn: '3/8',
    orificeDia: 4.0,
    maxFreePassage: 1.6,
    ratedFlow: 12.3,
    angleAtLow: 114,
    angleAtMid: 120,
    angleAtHigh: 103,
  },
  {
    capacitySize: '20W',
    inletConn: '3/8',
    orificeDia: 4.4,
    maxFreePassage: 2.4,
    ratedFlow: 14.5,
    angleAtLow: 114,
    angleAtMid: 120,
    angleAtHigh: 104,
  },
  {
    capacitySize: '24W',
    inletConn: '3/8',
    orificeDia: 4.8,
    maxFreePassage: 2.4,
    ratedFlow: 17.3,
    angleAtLow: 114,
    angleAtMid: 120,
    angleAtHigh: 104,
  },
  {
    capacitySize: '27W',
    inletConn: '3/8',
    orificeDia: 5.2,
    maxFreePassage: 2.8,
    ratedFlow: 19.5,
    angleAtLow: 114,
    angleAtMid: 120,
    angleAtHigh: 106,
  },
  // 1/2" connection
  {
    capacitySize: '30W',
    inletConn: '1/2',
    orificeDia: 5.6,
    maxFreePassage: 2.8,
    ratedFlow: 22,
    angleAtLow: 114,
    angleAtMid: 120,
    angleAtHigh: 108,
  },
  {
    capacitySize: '35W',
    inletConn: '1/2',
    orificeDia: 6.0,
    maxFreePassage: 3.2,
    ratedFlow: 25,
    angleAtLow: 114,
    angleAtMid: 120,
    angleAtHigh: 108,
  },
  {
    capacitySize: '40W',
    inletConn: '1/2',
    orificeDia: 6.4,
    maxFreePassage: 3.2,
    ratedFlow: 29,
    angleAtLow: 114,
    angleAtMid: 120,
    angleAtHigh: 108,
  },
  {
    capacitySize: '45W',
    inletConn: '1/2',
    orificeDia: 6.4,
    maxFreePassage: 3.6,
    ratedFlow: 33,
    angleAtLow: 114,
    angleAtMid: 120,
    angleAtHigh: 110,
  },
  {
    capacitySize: '50W',
    inletConn: '1/2',
    orificeDia: 6.7,
    maxFreePassage: 4.0,
    ratedFlow: 37,
    angleAtLow: 114,
    angleAtMid: 120,
    angleAtHigh: 112,
  },
  // 3/4" connection
  {
    capacitySize: '6W',
    inletConn: '3/4',
    orificeDia: 9.9,
    maxFreePassage: 4.4,
    ratedFlow: 51,
    angleAtLow: 115,
    angleAtMid: 120,
    angleAtHigh: 112,
  },
  // 1" connection
  {
    capacitySize: '11W',
    inletConn: '1',
    orificeDia: 13.1,
    maxFreePassage: 5.6,
    ratedFlow: 93,
    angleAtLow: 117,
    angleAtMid: 120,
    angleAtHigh: 117,
  },
  // 1-1/4" connection
  {
    capacitySize: '16W',
    inletConn: '1-1/4',
    orificeDia: 15.5,
    maxFreePassage: 6.4,
    ratedFlow: 135,
    angleAtLow: 118,
    angleAtMid: 121,
    angleAtHigh: 119,
  },
  // 1-1/2" connection
  {
    capacitySize: '24W',
    inletConn: '1-1/2',
    orificeDia: 18.3,
    maxFreePassage: 10.3,
    ratedFlow: 203,
    angleAtLow: 119,
    angleAtMid: 124,
    angleAtHigh: 119,
  },
  // 2" connection
  {
    capacitySize: '47W',
    inletConn: '2',
    orificeDia: 25.0,
    maxFreePassage: 11.1,
    ratedFlow: 398,
    angleAtLow: 120,
    angleAtMid: 124,
    angleAtHigh: 119,
  },
  // 2-1/2" connection
  {
    capacitySize: '70W',
    inletConn: '2-1/2',
    orificeDia: 31.8,
    maxFreePassage: 14.3,
    ratedFlow: 592,
    angleAtLow: 120,
    angleAtMid: 125,
    angleAtHigh: 119,
  },
  // 3" connection
  {
    capacitySize: '95W',
    inletConn: '3',
    orificeDia: 34.9,
    maxFreePassage: 17.5,
    ratedFlow: 803,
    angleAtLow: 120,
    angleAtMid: 125,
    angleAtHigh: 119,
  },
  // 4" connection
  {
    capacitySize: '188W',
    inletConn: '4',
    orificeDia: 50.8,
    maxFreePassage: 20.6,
    ratedFlow: 1590,
    angleAtLow: 120,
    angleAtMid: 125,
    angleAtHigh: 119,
  },
];

// -- Full Cone Square (FullJet G-SQ/H-SQ standard + H-WSQ/HH-WSQ wide) --
// Standard square (SQ): rated pressure 3 bar, flow exponent 0.46, angles at [0.5, 1.5, 6] bar
// Wide square (WSQ): rated pressure 3 bar, flow exponent 0.44, angles at [0.4, 0.7, 6] bar
// Category defaults are for SQ (0.46, [0.5, 1.5, 6]); WSQ entries carry per-nozzle overrides
// Spray angles at: 0.5 bar (low), 1.5 bar (mid), 6 bar (high) — standard
//                  0.4 bar (low), 0.7 bar (mid), 6 bar (high) — wide square
const FULL_CONE_SQUARE: NozzleEntry[] = [
  // Wide Square (WSQ) — smaller sizes, rated at 3 bar
  {
    capacitySize: '14WSQ',
    inletConn: '1/4',
    orificeDia: 3.6,
    maxFreePassage: 1.6,
    ratedFlow: 10.1,
    angleAtLow: 99,
    angleAtMid: 101,
    angleAtHigh: 93,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '17WSQ',
    inletConn: '3/8',
    orificeDia: 4.0,
    maxFreePassage: 1.6,
    ratedFlow: 12.3,
    angleAtLow: 99,
    angleAtMid: 101,
    angleAtHigh: 93,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '20WSQ',
    inletConn: '3/8',
    orificeDia: 4.4,
    maxFreePassage: 2.4,
    ratedFlow: 14.5,
    angleAtLow: 104,
    angleAtMid: 110,
    angleAtHigh: 94,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '24WSQ',
    inletConn: '3/8',
    orificeDia: 4.8,
    maxFreePassage: 2.4,
    ratedFlow: 17.4,
    angleAtLow: 104,
    angleAtMid: 110,
    angleAtHigh: 94,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '27WSQ',
    inletConn: '3/8',
    orificeDia: 5.2,
    maxFreePassage: 2.8,
    ratedFlow: 19.5,
    angleAtLow: 104,
    angleAtMid: 110,
    angleAtHigh: 98,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '30WSQ',
    inletConn: '1/2',
    orificeDia: 5.6,
    maxFreePassage: 2.8,
    ratedFlow: 22,
    angleAtLow: 104,
    angleAtMid: 110,
    angleAtHigh: 102,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '35WSQ',
    inletConn: '1/2',
    orificeDia: 6.0,
    maxFreePassage: 3.2,
    ratedFlow: 25,
    angleAtLow: 104,
    angleAtMid: 110,
    angleAtHigh: 102,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '40WSQ',
    inletConn: '1/2',
    orificeDia: 6.4,
    maxFreePassage: 3.2,
    ratedFlow: 29,
    angleAtLow: 104,
    angleAtMid: 110,
    angleAtHigh: 102,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '45WSQ',
    inletConn: '1/2',
    orificeDia: 6.4,
    maxFreePassage: 3.6,
    ratedFlow: 33,
    angleAtLow: 104,
    angleAtMid: 110,
    angleAtHigh: 102,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '50WSQ',
    inletConn: '1/2',
    orificeDia: 6.7,
    maxFreePassage: 4.0,
    ratedFlow: 36,
    angleAtLow: 104,
    angleAtMid: 110,
    angleAtHigh: 102,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '71WSQ',
    inletConn: '3/4',
    orificeDia: 9.9,
    maxFreePassage: 4.4,
    ratedFlow: 51,
    angleAtLow: 105,
    angleAtMid: 110,
    angleAtHigh: 102,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '130WSQ',
    inletConn: '1',
    orificeDia: 13.1,
    maxFreePassage: 5.6,
    ratedFlow: 94,
    angleAtLow: 107,
    angleAtMid: 110,
    angleAtHigh: 107,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '190WSQ',
    inletConn: '1-1/4',
    orificeDia: 15.5,
    maxFreePassage: 6.4,
    ratedFlow: 137,
    angleAtLow: 108,
    angleAtMid: 111,
    angleAtHigh: 109,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '290WSQ',
    inletConn: '1-1/2',
    orificeDia: 18.3,
    maxFreePassage: 10.3,
    ratedFlow: 210,
    angleAtLow: 109,
    angleAtMid: 114,
    angleAtHigh: 109,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '560WSQ',
    inletConn: '2',
    orificeDia: 25,
    maxFreePassage: 11.1,
    ratedFlow: 405,
    angleAtLow: 110,
    angleAtMid: 114,
    angleAtHigh: 109,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '830WSQ',
    inletConn: '2-1/2',
    orificeDia: 31.8,
    maxFreePassage: 14.3,
    ratedFlow: 600,
    angleAtLow: 110,
    angleAtMid: 115,
    angleAtHigh: 109,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  {
    capacitySize: '1070WSQ',
    inletConn: '3',
    orificeDia: 34.8,
    maxFreePassage: 17.5,
    ratedFlow: 774,
    angleAtLow: 110,
    angleAtMid: 115,
    angleAtHigh: 109,
    flowExponent: 0.44,
    anglePressures: [0.4, 0.7, 6] as [number, number, number],
  },
  // Standard Square (SQ) — larger sizes, rated at 3 bar
  {
    capacitySize: '177SQ',
    inletConn: '1-1/4',
    orificeDia: 12.7,
    maxFreePassage: 6.4,
    ratedFlow: 132,
    angleAtLow: 78,
    angleAtMid: 80,
    angleAtHigh: 73,
  },
  {
    capacitySize: '230SQ',
    inletConn: '1-1/2',
    orificeDia: 14.3,
    maxFreePassage: 8.7,
    ratedFlow: 171,
    angleAtLow: 73,
    angleAtMid: 77,
    angleAtHigh: 70,
  },
  {
    capacitySize: '290SQ',
    inletConn: '2',
    orificeDia: 15.5,
    maxFreePassage: 11.1,
    ratedFlow: 216,
    angleAtLow: 66,
    angleAtMid: 70,
    angleAtHigh: 64,
  },
  {
    capacitySize: '360SQ',
    inletConn: '2',
    orificeDia: 17.4,
    maxFreePassage: 11.1,
    ratedFlow: 268,
    angleAtLow: 70,
    angleAtMid: 74,
    angleAtHigh: 67,
  },
  {
    capacitySize: '480SQ',
    inletConn: '2',
    orificeDia: 21,
    maxFreePassage: 11.1,
    ratedFlow: 357,
    angleAtLow: 79,
    angleAtMid: 82,
    angleAtHigh: 74,
  },
  {
    capacitySize: '490SQ',
    inletConn: '2-1/2',
    orificeDia: 19.8,
    maxFreePassage: 14.3,
    ratedFlow: 365,
    angleAtLow: 62,
    angleAtMid: 67,
    angleAtHigh: 61,
  },
  {
    capacitySize: '590SQ',
    inletConn: '2-1/2',
    orificeDia: 22.2,
    maxFreePassage: 14.3,
    ratedFlow: 439,
    angleAtLow: 75,
    angleAtMid: 78,
    angleAtHigh: 71,
  },
  {
    capacitySize: '950SQ',
    inletConn: '2-1/2',
    orificeDia: 28.6,
    maxFreePassage: 17.5,
    ratedFlow: 707,
    angleAtLow: 81,
    angleAtMid: 84,
    angleAtHigh: 76,
  },
  {
    capacitySize: '2980SQ',
    inletConn: '5',
    orificeDia: 47.6,
    maxFreePassage: 28.6,
    ratedFlow: 2219,
    angleAtLow: 89,
    angleAtMid: 91,
    angleAtHigh: 83,
  },
  {
    capacitySize: '5690SQ',
    inletConn: '6',
    orificeDia: 81.8,
    maxFreePassage: 44.5,
    ratedFlow: 4236,
    angleAtLow: 102,
    angleAtMid: 105,
    angleAtHigh: 95,
  },
];

// -- Hollow Cone Circular (WhirlJet AX/BX — Standard Angle) --
// Rated pressure: 0.7 bar, flow exponent: 0.50
// Spray angles at: 0.7 bar (low), 1.5 bar (mid), 6 bar (high)
const HOLLOW_CONE_CIRCULAR: NozzleEntry[] = [
  // 1/8" connection
  {
    capacitySize: '0.5',
    inletConn: '1/8',
    orificeDia: 1.2,
    maxFreePassage: 0.79,
    ratedFlow: 0.19,
    angleAtLow: 39,
    angleAtMid: 58,
    angleAtHigh: 69,
  },
  {
    capacitySize: '1',
    inletConn: '1/8',
    orificeDia: 1.6,
    maxFreePassage: 1.6,
    ratedFlow: 0.38,
    angleAtLow: 41,
    angleAtMid: 64,
    angleAtHigh: 76,
  },
  {
    capacitySize: '2',
    inletConn: '1/8',
    orificeDia: 2.0,
    maxFreePassage: 2.0,
    ratedFlow: 0.76,
    angleAtLow: 52,
    angleAtMid: 61,
    angleAtHigh: 69,
  },
  {
    capacitySize: '3',
    inletConn: '1/8',
    orificeDia: 2.4,
    maxFreePassage: 2.4,
    ratedFlow: 1.1,
    angleAtLow: 52,
    angleAtMid: 64,
    angleAtHigh: 77,
  },
  {
    capacitySize: '5',
    inletConn: '1/8',
    orificeDia: 3.2,
    maxFreePassage: 3.2,
    ratedFlow: 1.9,
    angleAtLow: 56,
    angleAtMid: 67,
    angleAtHigh: 76,
  },
  {
    capacitySize: '8',
    inletConn: '1/8',
    orificeDia: 4.0,
    maxFreePassage: 4.0,
    ratedFlow: 3.1,
    angleAtLow: 56,
    angleAtMid: 65,
    angleAtHigh: 70,
  },
  {
    capacitySize: '10',
    inletConn: '1/8',
    orificeDia: 4.4,
    maxFreePassage: 4.4,
    ratedFlow: 3.8,
    angleAtLow: 55,
    angleAtMid: 65,
    angleAtHigh: 72,
  },
  // 1/4" connection
  {
    capacitySize: '1',
    inletConn: '1/4',
    orificeDia: 1.6,
    maxFreePassage: 1.6,
    ratedFlow: 0.38,
    angleAtLow: 47,
    angleAtMid: 53,
    angleAtHigh: 67,
  },
  {
    capacitySize: '2',
    inletConn: '1/4',
    orificeDia: 2.0,
    maxFreePassage: 2.0,
    ratedFlow: 0.76,
    angleAtLow: 56,
    angleAtMid: 62,
    angleAtHigh: 71,
  },
  {
    capacitySize: '3',
    inletConn: '1/4',
    orificeDia: 2.4,
    maxFreePassage: 2.4,
    ratedFlow: 1.1,
    angleAtLow: 51,
    angleAtMid: 65,
    angleAtHigh: 78,
  },
  {
    capacitySize: '5',
    inletConn: '1/4',
    orificeDia: 3.6,
    maxFreePassage: 3.6,
    ratedFlow: 1.9,
    angleAtLow: 63,
    angleAtMid: 73,
    angleAtHigh: 79,
  },
  {
    capacitySize: '8',
    inletConn: '1/4',
    orificeDia: 4.0,
    maxFreePassage: 4.0,
    ratedFlow: 3.1,
    angleAtLow: 61,
    angleAtMid: 69,
    angleAtHigh: 73,
  },
  {
    capacitySize: '10',
    inletConn: '1/4',
    orificeDia: 4.8,
    maxFreePassage: 4.4,
    ratedFlow: 3.8,
    angleAtLow: 63,
    angleAtMid: 70,
    angleAtHigh: 74,
  },
  {
    capacitySize: '15',
    inletConn: '1/4',
    orificeDia: 5.9,
    maxFreePassage: 5.2,
    ratedFlow: 5.7,
    angleAtLow: 63,
    angleAtMid: 71,
    angleAtHigh: 72,
  },
  // 3/8" connection
  {
    capacitySize: '5',
    inletConn: '3/8',
    orificeDia: 3.6,
    maxFreePassage: 3.2,
    ratedFlow: 1.9,
    angleAtLow: 64,
    angleAtMid: 73,
    angleAtHigh: 79,
  },
  {
    capacitySize: '8',
    inletConn: '3/8',
    orificeDia: 4.4,
    maxFreePassage: 4.0,
    ratedFlow: 3.1,
    angleAtLow: 62,
    angleAtMid: 70,
    angleAtHigh: 74,
  },
  {
    capacitySize: '10',
    inletConn: '3/8',
    orificeDia: 5.2,
    maxFreePassage: 4.4,
    ratedFlow: 3.8,
    angleAtLow: 64,
    angleAtMid: 72,
    angleAtHigh: 75,
  },
  {
    capacitySize: '15',
    inletConn: '3/8',
    orificeDia: 5.9,
    maxFreePassage: 5.6,
    ratedFlow: 5.7,
    angleAtLow: 64,
    angleAtMid: 72,
    angleAtHigh: 74,
  },
  {
    capacitySize: '20',
    inletConn: '3/8',
    orificeDia: 7.1,
    maxFreePassage: 6.4,
    ratedFlow: 7.6,
    angleAtLow: 63,
    angleAtMid: 70,
    angleAtHigh: 74,
  },
  {
    capacitySize: '25',
    inletConn: '3/8',
    orificeDia: 7.5,
    maxFreePassage: 7.5,
    ratedFlow: 9.5,
    angleAtLow: 63,
    angleAtMid: 70,
    angleAtHigh: 74,
  },
  {
    capacitySize: '30',
    inletConn: '3/8',
    orificeDia: 8.3,
    maxFreePassage: 7.9,
    ratedFlow: 11.4,
    angleAtLow: 63,
    angleAtMid: 70,
    angleAtHigh: 74,
  },
  // 1/2" connection
  {
    capacitySize: '25',
    inletConn: '1/2',
    orificeDia: 9.5,
    maxFreePassage: 6.4,
    ratedFlow: 9.5,
    angleAtLow: 63,
    angleAtMid: 66,
    angleAtHigh: 71,
  },
  {
    capacitySize: '30',
    inletConn: '1/2',
    orificeDia: 9.5,
    maxFreePassage: 7.5,
    ratedFlow: 11.4,
    angleAtLow: 67,
    angleAtMid: 71,
    angleAtHigh: 75,
  },
  {
    capacitySize: '40',
    inletConn: '1/2',
    orificeDia: 9.5,
    maxFreePassage: 9.1,
    ratedFlow: 15.3,
    angleAtLow: 72,
    angleAtMid: 76,
    angleAtHigh: 78,
  },
  {
    capacitySize: '50',
    inletConn: '1/2',
    orificeDia: 9.5,
    maxFreePassage: 11.1,
    ratedFlow: 19.1,
    angleAtLow: 74,
    angleAtMid: 79,
    angleAtHigh: 82,
  },
  {
    capacitySize: '60',
    inletConn: '1/2',
    orificeDia: 9.5,
    maxFreePassage: 13.1,
    ratedFlow: 23,
    angleAtLow: 77,
    angleAtMid: 82,
    angleAtHigh: 86,
  },
  // 3/4" connection
  {
    capacitySize: '40',
    inletConn: '3/4',
    orificeDia: 12.7,
    maxFreePassage: 7.9,
    ratedFlow: 15.3,
    angleAtLow: 70,
    angleAtMid: 73,
    angleAtHigh: 74,
  },
  {
    capacitySize: '50',
    inletConn: '3/4',
    orificeDia: 12.7,
    maxFreePassage: 9.5,
    ratedFlow: 19.1,
    angleAtLow: 72,
    angleAtMid: 75,
    angleAtHigh: 77,
  },
  {
    capacitySize: '60',
    inletConn: '3/4',
    orificeDia: 12.7,
    maxFreePassage: 11.1,
    ratedFlow: 23,
    angleAtLow: 74,
    angleAtMid: 76,
    angleAtHigh: 79,
  },
  {
    capacitySize: '70',
    inletConn: '3/4',
    orificeDia: 12.7,
    maxFreePassage: 12.7,
    ratedFlow: 27,
    angleAtLow: 76,
    angleAtMid: 79,
    angleAtHigh: 83,
  },
  {
    capacitySize: '80',
    inletConn: '3/4',
    orificeDia: 12.7,
    maxFreePassage: 14.3,
    ratedFlow: 31,
    angleAtLow: 78,
    angleAtMid: 82,
    angleAtHigh: 84,
  },
  {
    capacitySize: '90',
    inletConn: '3/4',
    orificeDia: 12.7,
    maxFreePassage: 14.7,
    ratedFlow: 34,
    angleAtLow: 81,
    angleAtMid: 84,
    angleAtHigh: 84,
  },
  {
    capacitySize: '100',
    inletConn: '3/4',
    orificeDia: 12.7,
    maxFreePassage: 15.9,
    ratedFlow: 38,
    angleAtLow: 83,
    angleAtMid: 86,
    angleAtHigh: 86,
  },
  {
    capacitySize: '110',
    inletConn: '3/4',
    orificeDia: 12.7,
    maxFreePassage: 17.1,
    ratedFlow: 42,
    angleAtLow: 85,
    angleAtMid: 88,
    angleAtHigh: 88,
  },
  {
    capacitySize: '120',
    inletConn: '3/4',
    orificeDia: 12.7,
    maxFreePassage: 18.3,
    ratedFlow: 46,
    angleAtLow: 87,
    angleAtMid: 90,
    angleAtHigh: 90,
  },
];

// ── Category Configurations ──────────────────────────────────────────────────

export const NOZZLE_CATEGORIES: Record<NozzleCategory, NozzleCategoryConfig> = {
  full_cone_circular: {
    label: 'Full Cone — Circular',
    description:
      'FullJet G/H standard spray angle. Solid cone-shaped spray pattern with round impact area.',
    flowExponent: 0.46,
    ratedPressure: 3,
    anglePressures: [0.5, 1.5, 6],
    seriesName: 'FullJet G/H',
    nozzles: FULL_CONE_CIRCULAR,
  },
  full_cone_wide: {
    label: 'Full Cone — Wide',
    description: 'FullJet G-W/H-W wide spray angle (112°–125°). Wide cone for maximum coverage.',
    flowExponent: 0.44,
    ratedPressure: 3,
    anglePressures: [0.4, 0.7, 6],
    seriesName: 'FullJet G-W/H-W',
    nozzles: FULL_CONE_WIDE,
  },
  full_cone_square: {
    label: 'Full Cone — Square',
    description:
      'FullJet SQ/WSQ square spray pattern. Square impact area for uniform matrix coverage.',
    flowExponent: 0.46,
    ratedPressure: 3,
    anglePressures: [0.5, 1.5, 6],
    seriesName: 'FullJet SQ/WSQ',
    nozzles: FULL_CONE_SQUARE,
  },
  hollow_cone_circular: {
    label: 'Hollow Cone — Circular',
    description:
      'WhirlJet AX/BX standard spray angle. Hollow cone with fine atomisation at low pressures.',
    flowExponent: 0.5,
    ratedPressure: 0.7,
    anglePressures: [0.7, 1.5, 6],
    seriesName: 'WhirlJet AX/BX',
    nozzles: HOLLOW_CONE_CIRCULAR,
  },
};

// ── Ordering Model Number ────────────────────────────────────────────────────

/**
 * Parse a fractional-inch connection string to a numeric value.
 * Handles: '1/4' → 0.25, '3/4' → 0.75, '1' → 1, '1-1/4' → 1.25, '2-1/2' → 2.5
 */
function parseConnectionInches(conn: string): number {
  if (conn.includes('-')) {
    const [whole, frac] = conn.split('-');
    return parseInt(whole!) + parseConnectionInches(frac!);
  }
  if (conn.includes('/')) {
    const [num, den] = conn.split('/');
    return parseInt(num!) / parseInt(den!);
  }
  return parseFloat(conn);
}

/**
 * Get the catalogue ordering model designation for a nozzle.
 *
 * Format: {conn}{bodyType}-{capacityNumber}
 * Example: 1HH-WSQ-130 for a 130WSQ nozzle with 1" male connection
 *
 * Body type is determined by category + connection size:
 *   Full Cone Circular: HH (≤3/4"), H (≥1")
 *   Full Cone Wide: HH-W (≤3/4"), H-W (≥1")
 *   Full Cone Square SQ: HH-SQ (≤1"), H-SQ (>1")
 *   Full Cone Wide Square WSQ: HH-WSQ (≤1"), H-WSQ (>1")
 *   Hollow Cone: BX (all sizes)
 *
 * Material code is not included — user selects at ordering time.
 */
export function getOrderingModel(nozzle: NozzleEntry, category: NozzleCategory): string {
  const conn = nozzle.inletConn;
  const connInches = parseConnectionInches(conn);

  let bodyType: string;
  switch (category) {
    case 'full_cone_circular':
      bodyType = connInches >= 1.0 ? 'H' : 'HH';
      break;
    case 'full_cone_wide':
      bodyType = connInches >= 1.0 ? 'H-W' : 'HH-W';
      break;
    case 'full_cone_square':
      if (nozzle.capacitySize.endsWith('WSQ')) {
        bodyType = connInches > 1.0 ? 'H-WSQ' : 'HH-WSQ';
      } else {
        bodyType = connInches > 1.0 ? 'H-SQ' : 'HH-SQ';
      }
      break;
    case 'hollow_cone_circular':
      bodyType = 'BX';
      break;
  }

  // Capacity number = strip suffix (body type already encodes SQ/WSQ/W)
  const capNum = nozzle.capacitySize.replace(/WSQ$|SQ$|W$/, '');

  return `${conn}${bodyType}-${capNum}`;
}

// ── Calculations ─────────────────────────────────────────────────────────────

/**
 * Calculate nozzle flow at any pressure using flow exponent relationship.
 *
 * Q = Q_rated × (P / P_rated)^n
 */
export function calculateFlowAtPressure(
  ratedFlow: number,
  ratedPressure: number,
  operatingPressure: number,
  flowExponent: number
): number {
  return ratedFlow * Math.pow(operatingPressure / ratedPressure, flowExponent);
}

/**
 * Interpolate spray angle at operating pressure from three data points.
 * Uses linear interpolation between the nearest two points.
 */
export function interpolateSprayAngle(
  nozzle: NozzleEntry,
  operatingPressure: number,
  anglePressures: [number, number, number]
): number {
  const [pLow, pMid, pHigh] = anglePressures;
  const aLow = nozzle.angleAtLow;
  const aMid = nozzle.angleAtMid;
  const aHigh = nozzle.angleAtHigh;

  if (operatingPressure <= pLow) return aLow;
  if (operatingPressure >= pHigh) return aHigh;

  // Find which segment we're in
  if (operatingPressure <= pMid) {
    // Between low and mid
    const t = (operatingPressure - pLow) / (pMid - pLow);
    return aLow + t * (aMid - aLow);
  } else {
    // Between mid and high
    const t = (operatingPressure - pMid) / (pHigh - pMid);
    return aMid + t * (aHigh - aMid);
  }
}

/**
 * Calculate spray coverage (diameter for circular, side length for square)
 * at a given distance from the nozzle orifice.
 *
 * coverage = 2 × distance × tan(angle / 2)
 */
export function calculateCoverage(sprayAngle: number, sprayDistance: number): number {
  const halfAngleRad = ((sprayAngle / 2) * Math.PI) / 180;
  return 2 * sprayDistance * Math.tan(halfAngleRad);
}

/**
 * Select matching spray nozzles from the catalogue.
 *
 * Given a required flow rate, operating pressure, and nozzle category,
 * finds nozzles whose flow at the operating pressure is within the
 * specified tolerance of the required flow.
 */
export function selectSprayNozzles(input: SprayNozzleInput): SprayNozzleResult {
  const {
    category,
    requiredFlow,
    operatingPressure,
    numberOfNozzles = 1,
    sprayDistance,
    tolerance = 0.25,
  } = input;

  if (requiredFlow <= 0) throw new Error('Required flow must be positive');
  if (operatingPressure <= 0) throw new Error('Operating pressure must be positive');
  if (numberOfNozzles < 1) throw new Error('Number of nozzles must be at least 1');

  const config = NOZZLE_CATEGORIES[category];
  const flowPerNozzle = requiredFlow / numberOfNozzles;

  const matches: NozzleMatch[] = [];

  for (const nozzle of config.nozzles) {
    const exponent = nozzle.flowExponent ?? config.flowExponent;
    const pressures = nozzle.anglePressures ?? config.anglePressures;

    const flowAtPressure = calculateFlowAtPressure(
      nozzle.ratedFlow,
      config.ratedPressure,
      operatingPressure,
      exponent
    );

    const deviation = (flowAtPressure - flowPerNozzle) / flowPerNozzle;
    const deviationPercent = deviation * 100;

    if (Math.abs(deviation) <= tolerance) {
      const sprayAngle = interpolateSprayAngle(nozzle, operatingPressure, pressures);

      const coverage =
        sprayDistance !== undefined && sprayDistance > 0
          ? calculateCoverage(sprayAngle, sprayDistance)
          : undefined;

      matches.push({
        nozzle,
        flowAtPressure: Math.round(flowAtPressure * 100) / 100,
        sprayAngle: Math.round(sprayAngle * 10) / 10,
        coverage: coverage !== undefined ? Math.round(coverage * 10) / 10 : undefined,
        deviationPercent: Math.round(deviationPercent * 10) / 10,
        modelNumber: getOrderingModel(nozzle, category),
      });
    }
  }

  // Sort by absolute deviation (closest match first)
  matches.sort((a, b) => Math.abs(a.deviationPercent) - Math.abs(b.deviationPercent));

  return {
    matches,
    category,
    operatingPressure,
    flowPerNozzle: Math.round(flowPerNozzle * 100) / 100,
    numberOfNozzles,
  };
}

/**
 * Calculate nozzle layout for a rectangular tube bundle.
 *
 * For each nozzle, DERIVES the spray height so that one nozzle covers the
 * bundle width (plus overshoot margin for full wetting). Nozzles are then
 * arrayed along the bundle length with the specified minimum overlap.
 *
 * Algorithm:
 * 1. targetCoverage = bundleWidth + 2 × overshootMargin
 * 2. derivedHeight = targetCoverage / (2 × tan(angle/2))
 * 3. Skip if derivedHeight outside [minHeight, maxHeight]
 * 4. nozzlesAlongLength = ceil(bundleLength / maxPitch), single row across width
 * 5. Flow check: nozzle flow vs totalFlow / totalNozzles
 * 6. Sort by height proximity to target, then by flow deviation
 */
export function calculateNozzleLayout(input: NozzleLayoutInput): NozzleLayoutResult {
  const {
    category,
    totalFlow,
    operatingPressure,
    bundleLength,
    bundleWidth,
    targetHeight = 500,
    minHeight = 300,
    maxHeight = 800,
    overshootMargin = 50,
    minOverlap = 0.15,
    tolerance = 0.25,
  } = input;

  if (totalFlow <= 0) throw new Error('Total flow must be positive');
  if (operatingPressure <= 0) throw new Error('Operating pressure must be positive');
  if (bundleLength <= 0) throw new Error('Bundle length must be positive');
  if (bundleWidth <= 0) throw new Error('Bundle width must be positive');
  if (minOverlap < 0 || minOverlap >= 1) throw new Error('Overlap must be between 0 and 1');

  const config = NOZZLE_CATEGORIES[category];
  const matches: NozzleLayoutMatch[] = [];

  for (const nozzle of config.nozzles) {
    const exponent = nozzle.flowExponent ?? config.flowExponent;
    const pressures = nozzle.anglePressures ?? config.anglePressures;

    const flowAtPressure = calculateFlowAtPressure(
      nozzle.ratedFlow,
      config.ratedPressure,
      operatingPressure,
      exponent
    );

    const sprayAngle = interpolateSprayAngle(nozzle, operatingPressure, pressures);
    if (sprayAngle <= 0) continue;

    const halfAngleRad = ((sprayAngle / 2) * Math.PI) / 180;
    const tanHalf = Math.tan(halfAngleRad);
    if (tanHalf <= 0) continue;

    // Try 1 row, then 2, 3, etc. — stop when derived height drops below minHeight
    for (let rows = 1; rows <= 10; rows++) {
      // Each row covers: bundleWidth / rows + overshoot on the outer edges
      // With overlap between adjacent rows (same minOverlap fraction)
      const coveragePerRow =
        rows === 1
          ? bundleWidth + 2 * overshootMargin
          : bundleWidth / rows + (overshootMargin * 2) / rows + (bundleWidth / rows) * minOverlap;

      // Derive height so one nozzle covers coveragePerRow
      const derivedHeight = coveragePerRow / (2 * tanHalf);

      // If below minHeight even at 1 row, skip this nozzle entirely
      if (derivedHeight < minHeight) break;
      // If above maxHeight, try more rows
      if (derivedHeight > maxHeight) continue;

      const coverageDiameter = Math.round(coveragePerRow * 10) / 10;

      // Array nozzles along the bundle length
      const maxPitch = coveragePerRow * (1 - minOverlap);
      if (maxPitch <= 0) continue;

      const nozzlesAlongLength = Math.max(1, Math.ceil(bundleLength / maxPitch));
      const totalNozzles = nozzlesAlongLength * rows;

      // Pitch along length
      const pitchAlongLength =
        nozzlesAlongLength > 1 ? bundleLength / nozzlesAlongLength : bundleLength;

      // Pitch across width
      const pitchAcrossWidth = rows > 1 ? bundleWidth / rows : 0;

      // Overlap along length
      const actualOverlapLength =
        coveragePerRow > 0
          ? Math.round((1 - pitchAlongLength / coveragePerRow) * 100 * 10) / 10
          : 0;

      // Overlap across width
      const actualOverlapWidth =
        rows > 1 && coveragePerRow > 0
          ? Math.round((1 - pitchAcrossWidth / coveragePerRow) * 100 * 10) / 10
          : 0;

      // Total spray coverage along length (outer edge to outer edge)
      const totalCoverageLength =
        nozzlesAlongLength > 1
          ? pitchAlongLength * (nozzlesAlongLength - 1) + coveragePerRow
          : coveragePerRow;

      // Total coverage across width
      const totalCoverageWidth =
        rows > 1 ? pitchAcrossWidth * (rows - 1) + coveragePerRow : coveragePerRow;

      // Overspray — spray outside the bundle footprint
      const totalCoverageArea = totalCoverageLength * totalCoverageWidth;
      const bundleArea = bundleLength * bundleWidth;
      const wastedFraction =
        totalCoverageArea > 0 ? Math.max(0, 1 - bundleArea / totalCoverageArea) : 0;

      // Flow check
      const actualTotalFlow = flowAtPressure * totalNozzles;
      const requiredFlowPerNozzle = totalFlow / totalNozzles;
      const deviation = (flowAtPressure - requiredFlowPerNozzle) / requiredFlowPerNozzle;
      const wastedFlowLpm = Math.round(actualTotalFlow * wastedFraction * 100) / 100;
      const wastedFlowPercent = Math.round(wastedFraction * 1000) / 10;

      if (Math.abs(deviation) <= tolerance) {
        matches.push({
          nozzle,
          flowAtPressure: Math.round(flowAtPressure * 100) / 100,
          sprayAngle: Math.round(sprayAngle * 10) / 10,
          derivedHeight: Math.round(derivedHeight),
          coverageDiameter,
          pitchAlongLength: Math.round(pitchAlongLength * 10) / 10,
          pitchAcrossWidth: Math.round(pitchAcrossWidth * 10) / 10,
          nozzlesAlongLength,
          rowsAcrossWidth: rows,
          totalNozzles,
          requiredFlowPerNozzle: Math.round(requiredFlowPerNozzle * 100) / 100,
          deviationPercent: Math.round(deviation * 1000) / 10,
          actualOverlapLength,
          actualOverlapWidth,
          totalCoverageLength: Math.round(totalCoverageLength * 10) / 10,
          heightDeviation: Math.round(derivedHeight - targetHeight),
          wastedFlowPercent,
          wastedFlowLpm,
          modelNumber: getOrderingModel(nozzle, category),
        });
      }

      // Found a valid match at this row count — don't try more rows for same nozzle
      // (lower row counts are preferred)
      if (derivedHeight >= minHeight && derivedHeight <= maxHeight) break;
    }
  }

  // Sort by height proximity to target first, then by flow deviation
  matches.sort((a, b) => {
    const heightDiff = Math.abs(a.heightDeviation) - Math.abs(b.heightDeviation);
    if (Math.abs(heightDiff) > 10) return heightDiff; // 10mm tolerance band
    return Math.abs(a.deviationPercent) - Math.abs(b.deviationPercent);
  });

  return {
    matches,
    category,
    operatingPressure,
    bundleLength,
    bundleWidth,
    targetHeight,
    minHeight,
    maxHeight,
    overshootMargin,
    minOverlap,
    totalFlow,
  };
}

/** Human-readable category labels */
export const NOZZLE_CATEGORY_LABELS: Record<NozzleCategory, string> = {
  full_cone_circular: 'Full Cone — Circular',
  full_cone_wide: 'Full Cone — Wide',
  full_cone_square: 'Full Cone — Square',
  hollow_cone_circular: 'Hollow Cone — Circular',
};

// ── Flow Rate Units ─────────────────────────────────────────────────────────

export type FlowUnit = 'lpm' | 'kg_hr' | 'ton_hr';

export const FLOW_UNIT_LABELS: Record<FlowUnit, string> = {
  lpm: 'lpm',
  kg_hr: 'kg/hr',
  ton_hr: 'ton/hr',
};

/** Convert from display unit to lpm (assumes water density ≈ 1 kg/L) */
export function flowToLpm(value: number, unit: FlowUnit): number {
  switch (unit) {
    case 'lpm':
      return value;
    case 'kg_hr':
      return value / 60; // kg/hr ÷ 60 = lpm (at 1 kg/L)
    case 'ton_hr':
      return (value * 1000) / 60; // ton/hr × 1000 / 60 = lpm
  }
}

/** Convert from lpm to display unit (assumes water density ≈ 1 kg/L) */
export function lpmToFlowUnit(lpm: number, unit: FlowUnit): number {
  switch (unit) {
    case 'lpm':
      return Math.round(lpm * 100) / 100;
    case 'kg_hr':
      return Math.round(lpm * 60 * 100) / 100;
    case 'ton_hr':
      return Math.round(((lpm * 60) / 1000) * 1000) / 1000;
  }
}

// ── Bill of Materials ───────────────────────────────────────────────────────

/** Standard pipe dimensions (Schedule 40, ASME B36.10) */
interface PipeDimension {
  nps: string; // Nominal Pipe Size (inches)
  dn: number; // DN (mm)
  od: number; // Outside diameter (mm)
  wall: number; // Wall thickness (mm)
  id: number; // Inside diameter (mm)
}

const PIPE_SCHEDULE_40: PipeDimension[] = [
  { nps: '1/2', dn: 15, od: 21.3, wall: 2.77, id: 15.8 },
  { nps: '3/4', dn: 20, od: 26.7, wall: 2.87, id: 20.9 },
  { nps: '1', dn: 25, od: 33.4, wall: 3.38, id: 26.6 },
  { nps: '1-1/4', dn: 32, od: 42.2, wall: 3.56, id: 35.1 },
  { nps: '1-1/2', dn: 40, od: 48.3, wall: 3.68, id: 40.9 },
  { nps: '2', dn: 50, od: 60.3, wall: 3.91, id: 52.5 },
  { nps: '2-1/2', dn: 65, od: 73.0, wall: 5.16, id: 62.7 },
  { nps: '3', dn: 80, od: 88.9, wall: 5.49, id: 77.9 },
  { nps: '4', dn: 100, od: 114.3, wall: 6.02, id: 102.3 },
  { nps: '6', dn: 150, od: 168.3, wall: 7.11, id: 154.1 },
];

/** BSP male thread outside diameter (mm) for nozzle inlet connection sizes */
const BSP_THREAD_OD: Record<string, number> = {
  '1/8': 9.7,
  '1/4': 13.2,
  '3/8': 16.7,
  '1/2': 20.9,
  '3/4': 26.4,
  '1': 33.2,
  '1-1/4': 41.9,
  '1-1/2': 47.8,
  '2': 59.6,
  '2-1/2': 75.2,
};

/** Weldolet body OD (approximate) — slightly larger than the BSP thread OD */
const WELDOLET_BODY_OD: Record<string, number> = {
  '1/8': 16,
  '1/4': 21,
  '3/8': 25,
  '1/2': 30,
  '3/4': 38,
  '1': 48,
  '1-1/4': 57,
  '1-1/2': 64,
  '2': 76,
  '2-1/2': 92,
};

export interface BomItem {
  item: string;
  description: string;
  size: string;
  quantity: number;
  material: string;
  notes: string;
}

/**
 * Generate a bill of materials for the nozzle assembly.
 *
 * All Spraying Systems FullJet/WhirlJet nozzles use BSP male pipe threads.
 * Assembly: nozzle screws into a female-threaded weldolet welded to the header pipe.
 * Each nozzle penetrates the shell through a flanged pipe (ID > weldolet body OD).
 */
export function generateNozzleBom(
  nozzle: NozzleEntry,
  category: NozzleCategory,
  totalNozzles: number
): BomItem[] {
  const modelNumber = getOrderingModel(nozzle, category);
  const conn = nozzle.inletConn;
  const threadOd = BSP_THREAD_OD[conn] ?? 0;
  const weldoletOd = WELDOLET_BODY_OD[conn] ?? threadOd * 1.4;

  // Find minimum pipe that clears the weldolet body OD
  const nozzlePipe = PIPE_SCHEDULE_40.find((p) => p.id > weldoletOd);
  // Header pipe: one size larger than nozzle connection (minimum)
  const headerPipe = PIPE_SCHEDULE_40.find((p) => p.id > (nozzlePipe ? nozzlePipe.od : weldoletOd));

  const items: BomItem[] = [
    {
      item: 'Spray Nozzle',
      description: `${NOZZLE_CATEGORIES[category].seriesName} ${modelNumber}`,
      size: `${conn}" BSP male`,
      quantity: totalNozzles,
      material: 'SS 316 (specify at order)',
      notes: 'Spraying Systems Co.',
    },
    {
      item: 'Weldolet',
      description: `Threadolet / weldolet, female BSP ${conn}"`,
      size: `${conn}" × ${headerPipe ? headerPipe.nps + '"' : 'header'}`,
      quantity: totalNozzles,
      material: 'ASTM A182 F316',
      notes: `Female thread to receive nozzle (thread OD ${threadOd} mm)`,
    },
  ];

  if (headerPipe) {
    items.push({
      item: 'Header Pipe',
      description: `Sch 40 pipe, NPS ${headerPipe.nps}" (DN${headerPipe.dn})`,
      size: `OD ${headerPipe.od} mm × ID ${headerPipe.id} mm`,
      quantity: 1,
      material: 'ASTM A312 TP316',
      notes: 'Cut to length per layout',
    });
  }

  if (nozzlePipe) {
    items.push({
      item: 'Shell Nozzle Pipe',
      description: `Sch 40 pipe, NPS ${nozzlePipe.nps}" (DN${nozzlePipe.dn})`,
      size: `OD ${nozzlePipe.od} mm × ID ${nozzlePipe.id} mm`,
      quantity: totalNozzles,
      material: 'ASTM A312 TP316',
      notes: `ID ${nozzlePipe.id} mm clears weldolet body OD ${weldoletOd} mm`,
    });

    items.push({
      item: 'Shell Flange (Custom)',
      description: `Weld-neck flange, NPS ${nozzlePipe.nps}" (DN${nozzlePipe.dn})`,
      size: `Bore ${nozzlePipe.id} mm`,
      quantity: totalNozzles,
      material: 'ASTM A182 F316',
      notes: 'Custom machined — welded to shell; mating flange on nozzle pipe',
    });

    items.push({
      item: 'Counter Flange',
      description: `Slip-on or weld-neck flange, NPS ${nozzlePipe.nps}" (DN${nozzlePipe.dn})`,
      size: `Bore ${nozzlePipe.id} mm`,
      quantity: totalNozzles,
      material: 'ASTM A182 F316',
      notes: 'Mates with shell flange — welded to nozzle pipe',
    });

    items.push({
      item: 'Gasket',
      description: `Spiral wound gasket, NPS ${nozzlePipe.nps}" (DN${nozzlePipe.dn})`,
      size: `Class 150, DN${nozzlePipe.dn}`,
      quantity: totalNozzles,
      material: 'SS 316 / graphite fill',
      notes: 'ASME B16.20',
    });
  }

  return items;
}
