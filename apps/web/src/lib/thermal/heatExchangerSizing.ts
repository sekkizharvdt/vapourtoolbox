/**
 * Heat Exchanger Sizing Calculator
 *
 * Combines heat duty, heat transfer coefficients, and mechanical geometry
 * to size shell-and-tube heat exchangers.
 *
 * Design flow:
 *   1. Define heat duty (Q) — sensible, latent, or combined
 *   2. Calculate LMTD from temperature profile
 *   3. Determine overall HTC (U) — from correlations or user input
 *   4. Calculate required area: A = Q / (U × LMTD)
 *   5. Select tube geometry and calculate tube count, length, shell diameter
 *
 * References:
 *   - TEMA Standards (Tubular Exchanger Manufacturers Association)
 *   - Kern's Process Heat Transfer
 *   - Perry's Chemical Engineers' Handbook, 9th Edition
 */

import { calculateHeatExchangerArea } from './heatDutyCalculator';

// ── Standard Tube Data (TEMA / ASTM) ─────────────────────────────────────────

export interface TubeSpec {
  /** Tube outer diameter (mm) */
  od_mm: number;
  /** BWG (Birmingham Wire Gauge) */
  bwg: number;
  /** Wall thickness (mm) */
  wall_mm: number;
  /** Tube inner diameter (mm) — calculated */
  id_mm: number;
  /** Outer surface area per unit length (m²/m) */
  outerAreaPerM: number;
  /** Inner cross-sectional area (m²) */
  innerFlowArea: number;
}

/**
 * Standard tube sizes for shell-and-tube heat exchangers.
 * OD in mm, BWG gauge, wall thickness in mm.
 * Common in MED condensers, preheaters, and general process HX.
 */
export const STANDARD_TUBES: TubeSpec[] = [
  // 3/4" OD (19.05 mm) — most common in MED
  { od_mm: 19.05, bwg: 14, wall_mm: 2.11, id_mm: 14.83, outerAreaPerM: 0, innerFlowArea: 0 },
  { od_mm: 19.05, bwg: 16, wall_mm: 1.65, id_mm: 15.75, outerAreaPerM: 0, innerFlowArea: 0 },
  { od_mm: 19.05, bwg: 18, wall_mm: 1.24, id_mm: 16.56, outerAreaPerM: 0, innerFlowArea: 0 },
  { od_mm: 19.05, bwg: 20, wall_mm: 0.89, id_mm: 17.27, outerAreaPerM: 0, innerFlowArea: 0 },
  // 1" OD (25.4 mm)
  { od_mm: 25.4, bwg: 12, wall_mm: 2.77, id_mm: 19.86, outerAreaPerM: 0, innerFlowArea: 0 },
  { od_mm: 25.4, bwg: 14, wall_mm: 2.11, id_mm: 21.18, outerAreaPerM: 0, innerFlowArea: 0 },
  { od_mm: 25.4, bwg: 16, wall_mm: 1.65, id_mm: 22.1, outerAreaPerM: 0, innerFlowArea: 0 },
  // 1.25" OD (31.75 mm)
  { od_mm: 31.75, bwg: 12, wall_mm: 2.77, id_mm: 26.21, outerAreaPerM: 0, innerFlowArea: 0 },
  { od_mm: 31.75, bwg: 14, wall_mm: 2.11, id_mm: 27.53, outerAreaPerM: 0, innerFlowArea: 0 },
  // 1.5" OD (38.1 mm)
  { od_mm: 38.1, bwg: 12, wall_mm: 2.77, id_mm: 32.56, outerAreaPerM: 0, innerFlowArea: 0 },
  { od_mm: 38.1, bwg: 14, wall_mm: 2.11, id_mm: 33.88, outerAreaPerM: 0, innerFlowArea: 0 },
].map((t) => ({
  ...t,
  id_mm: t.od_mm - 2 * t.wall_mm,
  outerAreaPerM: Math.PI * (t.od_mm / 1000),
  innerFlowArea: (Math.PI / 4) * Math.pow((t.od_mm - 2 * t.wall_mm) / 1000, 2),
}));

/** Tube material options with thermal conductivity (W/m·K) */
export const TUBE_MATERIALS: Record<string, { label: string; conductivity: number }> = {
  cuNi_90_10: { label: 'Cu-Ni 90/10', conductivity: 45 },
  cuNi_70_30: { label: 'Cu-Ni 70/30', conductivity: 29 },
  titanium: { label: 'Titanium Gr.2', conductivity: 22 },
  ss_316L: { label: 'SS 316L', conductivity: 16 },
  admiralty: { label: 'Admiralty Brass', conductivity: 111 },
  carbon_steel: { label: 'Carbon Steel', conductivity: 50 },
  duplex_2205: { label: 'Duplex 2205', conductivity: 19 },
};

// ── Tube Layout ──────────────────────────────────────────────────────────────

export type TubeLayout = 'triangular' | 'square' | 'rotated_triangular' | 'rotated_square';

export const TUBE_LAYOUT_LABELS: Record<TubeLayout, string> = {
  triangular: 'Triangular (30°)',
  square: 'Square (90°)',
  rotated_triangular: 'Rotated Triangular (60°)',
  rotated_square: 'Rotated Square (45°)',
};

/**
 * Minimum pitch-to-OD ratio per TEMA.
 * Triangular: 1.25 × OD (most compact, best heat transfer, not cleanable)
 * Square: 1.25 × OD (cleanable, allows mechanical cleaning lanes)
 */
export const MIN_PITCH_RATIO: Record<TubeLayout, number> = {
  triangular: 1.25,
  square: 1.25,
  rotated_triangular: 1.25,
  rotated_square: 1.25,
};

/**
 * Tube count constant (CTP) — fraction of shell area occupied by tubes.
 * Accounts for tube sheet thickness, pass partition lanes, etc.
 * Reference: Kern's Process Heat Transfer.
 */
export const TUBE_COUNT_CONSTANT: Record<number, number> = {
  1: 0.93, // 1 tube pass
  2: 0.9, // 2 tube passes
  4: 0.85, // 4 tube passes
  6: 0.8, // 6 tube passes
};

/**
 * Tube layout constant (CL) — packing efficiency.
 * Triangular layout is denser than square.
 */
export const LAYOUT_CONSTANT: Record<TubeLayout, number> = {
  triangular: 0.866, // sin(60°)
  rotated_triangular: 0.866,
  square: 1.0,
  rotated_square: 1.0,
};

// ── Standard Shell Sizes (TEMA) ──────────────────────────────────────────────

/** Standard shell inner diameters in mm (TEMA pipe-size and rolled-plate shells) */
export const STANDARD_SHELL_IDS_MM: number[] = [
  // Pipe shells (NPS → ID in mm, approximate)
  154, // 6"
  203, // 8"
  254, // 10"
  305, // 12"
  337, // 14"
  387, // 16"
  438, // 18"
  489, // 20"
  540, // 22"
  591, // 24"
  // Rolled-plate shells
  635, // 25"
  686, // 27"
  737, // 29"
  787, // 31"
  838, // 33"
  889, // 35"
  940, // 37"
  991, // 39"
  1067, // 42"
  1143, // 45"
  1219, // 48"
  1372, // 54"
  1524, // 60"
];

// ── Input / Output Types ─────────────────────────────────────────────────────

export interface HeatExchangerInput {
  /** Required heat duty (kW) */
  heatDutyKW: number;
  /** Corrected LMTD (°C) */
  lmtd: number;
  /** Overall heat transfer coefficient (W/m²·K) */
  overallHTC: number;
  /** Design fouling margin (fraction, e.g. 0.15 for 15% excess area) */
  foulingMargin?: number;

  // Tube geometry
  /** Selected tube spec index (into STANDARD_TUBES) */
  tubeSpecIndex: number;
  /** Tube material key (into TUBE_MATERIALS) */
  tubeMaterial: string;
  /** Tube layout pattern */
  tubeLayout: TubeLayout;
  /** Pitch-to-OD ratio (≥ 1.25 per TEMA) */
  pitchRatio?: number;
  /** Number of tube passes */
  tubePasses: number;
  /** Effective tube length (m) — between tube sheets */
  tubeLength: number;
}

export interface HeatExchangerResult {
  // Area
  /** Required clean heat transfer area (m²) */
  requiredArea: number;
  /** Design area including fouling margin (m²) */
  designArea: number;
  /** Fouling margin applied (fraction) */
  foulingMargin: number;

  // Tube geometry
  /** Selected tube specification */
  tubeSpec: TubeSpec;
  /** Tube material */
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

  // Tube count
  /** Required number of tubes (from area) */
  requiredTubeCount: number;
  /** Actual tube count (rounded up) */
  actualTubeCount: number;
  /** Actual heat transfer area (m²) — from actual tube count */
  actualArea: number;
  /** Excess area (%) */
  excessArea: number;

  // Shell
  /** Minimum shell inner diameter (mm) — from tube bundle */
  minShellID: number;
  /** Selected standard shell ID (mm) — next standard size up */
  shellID: number;
  /** Bundle diameter (mm) — Db */
  bundleDiameter: number;
  /** Bundle-to-shell clearance (mm) */
  bundleClearance: number;

  // Derived
  /** Tube-side flow area per pass (m²) */
  tubeSideFlowArea: number;
  /** Shell-side flow area (m²) — approximate cross-flow area */
  shellSideFlowArea: number;
  /** Tube-side velocity for given mass flow (m/s) — if provided */
  tubeSideVelocity?: number;

  /** Warnings */
  warnings: string[];
}

// ── Main Sizing Calculation ──────────────────────────────────────────────────

export function sizeHeatExchanger(input: HeatExchangerInput): HeatExchangerResult {
  const {
    heatDutyKW,
    lmtd,
    overallHTC,
    foulingMargin = 0.15,
    tubeSpecIndex,
    tubeMaterial,
    tubeLayout,
    pitchRatio: userPitchRatio,
    tubePasses,
    tubeLength,
  } = input;

  const warnings: string[] = [];

  // ── Validation ─────────────────────────────────────────────────────────
  if (heatDutyKW <= 0) throw new Error('Heat duty must be positive');
  if (lmtd <= 0) throw new Error('LMTD must be positive');
  if (overallHTC <= 0) throw new Error('Overall HTC must be positive');
  if (tubeLength <= 0) throw new Error('Tube length must be positive');
  if (![1, 2, 4, 6].includes(tubePasses)) throw new Error('Tube passes must be 1, 2, 4, or 6');

  const tubeSpec = STANDARD_TUBES[tubeSpecIndex];
  if (!tubeSpec) throw new Error(`Invalid tube spec index: ${tubeSpecIndex}`);

  const material = TUBE_MATERIALS[tubeMaterial];
  if (!material) throw new Error(`Invalid tube material: ${tubeMaterial}`);

  // ── Required area ──────────────────────────────────────────────────────
  const requiredArea = calculateHeatExchangerArea(heatDutyKW, overallHTC, lmtd);
  const designArea = requiredArea * (1 + foulingMargin);

  // ── Tube count from area ───────────────────────────────────────────────
  const areaPerTube = tubeSpec.outerAreaPerM * tubeLength; // m² per tube
  const requiredTubeCount = designArea / areaPerTube;
  const actualTubeCount = Math.ceil(requiredTubeCount);

  // Ensure tube count is divisible by number of passes
  const adjustedTubeCount =
    actualTubeCount % tubePasses === 0
      ? actualTubeCount
      : actualTubeCount + (tubePasses - (actualTubeCount % tubePasses));

  const actualArea = adjustedTubeCount * areaPerTube;
  const excessArea = ((actualArea - requiredArea) / requiredArea) * 100;

  // ── Tube pitch ─────────────────────────────────────────────────────────
  const minPitchRatio = MIN_PITCH_RATIO[tubeLayout];
  const pitchRatio = Math.max(userPitchRatio ?? 1.25, minPitchRatio);
  const tubePitch = pitchRatio * tubeSpec.od_mm;

  if (pitchRatio < minPitchRatio) {
    warnings.push(
      `Pitch ratio ${pitchRatio} is below TEMA minimum ${minPitchRatio} for ${tubeLayout} layout.`
    );
  }

  // ── Bundle diameter (Db) ───────────────────────────────────────────────
  // Db = shell area occupied by tubes
  // Using: Nt = CTP × CL × (Db/Pt)² × (π/4)
  //   → Db = Pt × √(Nt / (CTP × CL × π/4))
  // From Kern/TEMA: Nt = (CTP / CL) × (π/4) × (Db / Pt)²
  // Solving for Db: Db = Pt × √(4 × Nt × CL / (π × CTP))
  // CL < 1 for triangular → denser packing → smaller Db
  const CTP = TUBE_COUNT_CONSTANT[tubePasses] ?? 0.85;
  const CL = LAYOUT_CONSTANT[tubeLayout];

  const bundleDiameter =
    (tubePitch / 1000) * Math.sqrt((4 * adjustedTubeCount * CL) / (Math.PI * CTP)) * 1000; // back to mm

  // ── Shell diameter ─────────────────────────────────────────────────────
  // Shell ID = Bundle diameter + clearance
  // Typical clearance: 12-25 mm for fixed tubesheet, 25-50 mm for floating head
  const clearance = bundleDiameter < 400 ? 12 : bundleDiameter < 800 ? 18 : 25;
  const minShellID = bundleDiameter + clearance;

  // Select next standard shell size
  let shellID = minShellID;
  for (const stdShell of STANDARD_SHELL_IDS_MM) {
    if (stdShell >= minShellID) {
      shellID = stdShell;
      break;
    }
  }
  // If larger than all standard sizes
  if (shellID < minShellID) {
    shellID = Math.ceil(minShellID / 25) * 25; // round to nearest 25mm
    warnings.push(
      `Shell diameter ${shellID} mm exceeds standard TEMA sizes. Custom fabrication required.`
    );
  }

  const bundleClearance = shellID - bundleDiameter;

  // ── Flow areas ─────────────────────────────────────────────────────────
  // Tube-side flow area per pass
  const tubeSideFlowArea = (adjustedTubeCount / tubePasses) * tubeSpec.innerFlowArea;

  // Shell-side cross-flow area (approximate, per Kern's method)
  // As = Ds × (Pt - OD) × Lb / Pt
  // where Lb = baffle spacing (assume 0.4 × shell ID as default)
  const shellIDm = shellID / 1000;
  const pitchM = tubePitch / 1000;
  const odM = tubeSpec.od_mm / 1000;
  const baffleSpacing = 0.4 * shellIDm; // default assumption
  const shellSideFlowArea = (shellIDm * (pitchM - odM) * baffleSpacing) / pitchM;

  // ── Warnings ───────────────────────────────────────────────────────────
  if (excessArea > 40) {
    warnings.push(
      `Excess area is ${excessArea.toFixed(0)}%. Consider shorter tubes or fewer tube passes.`
    );
  }
  if (bundleDiameter > shellID * 0.95) {
    warnings.push('Bundle diameter is very close to shell ID. Check clearance for installation.');
  }
  if (lmtd < 5) {
    warnings.push('Very low LMTD — exchanger will be large. Consider counter-current arrangement.');
  }
  if (adjustedTubeCount < tubePasses * 2) {
    warnings.push('Very few tubes per pass. Consider reducing tube passes.');
  }

  return {
    requiredArea: round2(requiredArea),
    designArea: round2(designArea),
    foulingMargin,

    tubeSpec,
    tubeMaterial,
    tubeMaterialConductivity: material.conductivity,
    tubePitch: round1(tubePitch),
    tubeLayout,
    tubePasses,
    tubeLength,

    requiredTubeCount: round1(requiredTubeCount),
    actualTubeCount: adjustedTubeCount,
    actualArea: round2(actualArea),
    excessArea: round1(excessArea),

    minShellID: round0(minShellID),
    shellID,
    bundleDiameter: round1(bundleDiameter),
    bundleClearance: round1(bundleClearance),

    tubeSideFlowArea: round6(tubeSideFlowArea),
    shellSideFlowArea: round6(shellSideFlowArea),

    warnings,
  };
}

// ── Tube-side velocity calculator ────────────────────────────────────────────

/**
 * Calculate tube-side velocity given a mass flow rate through the exchanger.
 *
 * v = m_dot / (ρ × A_flow_per_pass)
 */
export function calculateTubeSideVelocity(
  massFlowKgS: number,
  density: number,
  flowAreaPerPass: number
): number {
  if (flowAreaPerPass <= 0 || density <= 0) return 0;
  return massFlowKgS / (density * flowAreaPerPass);
}

/**
 * Calculate shell-side velocity given a mass flow rate.
 *
 * v = m_dot / (ρ × A_shell_crossflow)
 */
export function calculateShellSideVelocity(
  massFlowKgS: number,
  density: number,
  shellFlowArea: number
): number {
  if (shellFlowArea <= 0 || density <= 0) return 0;
  return massFlowKgS / (density * shellFlowArea);
}

// ── Pressure drop estimators (simplified) ────────────────────────────────────

/**
 * Tube-side pressure drop (simplified Kern method).
 *
 * ΔP_tube = (4f × L × Np / d_i + 4 × Np) × ρ × v² / 2
 *
 * f ≈ 0.079 × Re^(-0.25) for turbulent flow (Blasius)
 */
export function estimateTubeSidePressureDrop(
  velocity: number,
  tubeIDm: number,
  tubeLength: number,
  tubePasses: number,
  density: number,
  viscosity: number
): { pressureDrop: number; frictionFactor: number; reynoldsNumber: number } {
  const Re = (density * velocity * tubeIDm) / viscosity;
  const f = Re > 2300 ? 0.079 * Math.pow(Re, -0.25) : 16 / Re;

  // Friction loss + return loss (4 velocity heads per pass for return bends)
  const frictionLoss = (4 * f * tubeLength * tubePasses) / tubeIDm;
  const returnLoss = 4 * tubePasses;
  const pressureDrop = (frictionLoss + returnLoss) * 0.5 * density * velocity * velocity;

  return {
    pressureDrop: round0(pressureDrop), // Pa
    frictionFactor: f,
    reynoldsNumber: round0(Re),
  };
}

// ── Helper: find tube by OD and BWG ─────────────────────────────────────────

export function findTubeIndex(od_mm: number, bwg: number): number {
  return STANDARD_TUBES.findIndex((t) => t.od_mm === od_mm && t.bwg === bwg);
}

/** Get distinct OD values from standard tubes */
export function getDistinctODs(): number[] {
  return [...new Set(STANDARD_TUBES.map((t) => t.od_mm))];
}

/** Get BWG options for a given OD */
export function getBWGsForOD(od_mm: number): number[] {
  return STANDARD_TUBES.filter((t) => t.od_mm === od_mm).map((t) => t.bwg);
}

// ── Utility ──────────────────────────────────────────────────────────────────

function round0(n: number): number {
  return Math.round(n);
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
