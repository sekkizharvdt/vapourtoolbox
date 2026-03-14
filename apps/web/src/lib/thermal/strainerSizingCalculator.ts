/**
 * Strainer Sizing Calculator
 *
 * Calculates mesh size selection and pressure drop for Y-type and bucket-type
 * strainers at clean and 50% clogged conditions.
 *
 * Methodology:
 * - Pressure drop through strainer body: ΔP_body = K_body × ρ × v² / 2
 * - Pressure drop through screen: ΔP_screen = K_screen × ρ × v_screen² / 2
 * - At 50% clog: effective open area halved → screen velocity doubles → ΔP_screen × 4
 * - Total ΔP = ΔP_body + ΔP_screen
 *
 * References: Crane TP-410, manufacturer catalogues
 */

import { SCHEDULE_40_PIPES, type PipeVariant } from './pipeService';

// ============================================================================
// Types
// ============================================================================

export type StrainerType = 'y_type' | 'bucket_type';

export type FluidType =
  | 'seawater'
  | 'brine'
  | 'dm_water'
  | 'condensate'
  | 'cooling_water'
  | 'custom';

export interface StrainerSizingInput {
  /** Fluid type for mesh recommendation */
  fluidType: FluidType;
  /** Volumetric flow rate in m³/hr */
  flowRate: number;
  /** Line size — NPS string (e.g., "2", "3", "4") */
  lineSize: string;
  /** Strainer type */
  strainerType: StrainerType;
  /** Fluid density in kg/m³ */
  fluidDensity: number;
  /** Fluid dynamic viscosity in cP (mPa·s) */
  fluidViscosity: number;
  /** Fluid temperature in °C (informational) */
  fluidTemperature?: number;
  /** Override mesh size — index into STANDARD_MESH_SIZES (if undefined, uses recommendation) */
  meshIndex?: number;
}

/** A single row in the mesh comparison table */
export interface MeshComparisonEntry {
  mesh: MeshSize;
  meshIndex: number;
  isSelected: boolean;
  isRecommended: boolean;
  screenVelocityClean: number;
  totalPressureDropClean: number;
  totalPressureDropClogged: number;
}

export interface StrainerSizingResult {
  /** Recommended mesh size in mm */
  meshSizeMm: number;
  /** Mesh size description */
  meshDescription: string;
  /** Equivalent mesh number (openings per inch) */
  meshNumber: number;
  /** Screen open area ratio (fraction, typically 0.3–0.5) */
  screenOpenAreaRatio: number;
  /** Whether this is the recommended mesh or a user override */
  isRecommendedMesh: boolean;
  /** Index of the selected mesh in STANDARD_MESH_SIZES */
  selectedMeshIndex: number;
  /** Comparison table: selected mesh ± 2 neighbors */
  meshComparison: MeshComparisonEntry[];
  /** Pipe inner diameter in mm */
  pipeIdMm: number;
  /** Pipe flow area in mm² */
  pipeAreaMm2: number;
  /** Velocity in pipe in m/s */
  pipeVelocity: number;
  /** Strainer body K factor */
  bodyKFactor: number;
  /** Strainer screen area in mm² (basket/screen area) */
  screenAreaMm2: number;
  /** Effective open area (clean) in mm² */
  effectiveOpenAreaClean: number;
  /** Velocity through screen (clean) in m/s */
  screenVelocityClean: number;
  /** Body pressure drop in bar */
  bodyPressureDrop: number;
  /** Screen pressure drop (clean) in bar */
  screenPressureDropClean: number;
  /** Total pressure drop (clean) in bar */
  totalPressureDropClean: number;
  /** Velocity through screen (50% clogged) in m/s */
  screenVelocityClogged: number;
  /** Screen pressure drop (50% clogged) in bar */
  screenPressureDropClogged: number;
  /** Total pressure drop (50% clogged) in bar */
  totalPressureDropClogged: number;
  /** Reynolds number in pipe */
  reynoldsNumber: number;
  /** Strainer type used */
  strainerType: StrainerType;
  /** NPS used */
  lineSize: string;
  /** Warnings */
  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Strainer type labels */
export const STRAINER_TYPE_LABELS: Record<StrainerType, string> = {
  y_type: 'Y-Type Strainer',
  bucket_type: 'Bucket-Type Strainer',
};

/** Fluid type labels */
export const FLUID_TYPE_LABELS: Record<FluidType, string> = {
  seawater: 'Seawater',
  brine: 'Brine (MED/MSF Reject)',
  dm_water: 'DM Water / Condensate Return',
  condensate: 'Steam Condensate',
  cooling_water: 'Cooling Water',
  custom: 'Custom',
};

/**
 * Strainer body K factors (resistance coefficients)
 * Based on Crane TP-410 and manufacturer data
 */
const BODY_K_FACTORS: Record<StrainerType, number> = {
  y_type: 2.0,
  bucket_type: 5.0,
};

/**
 * Screen area ratio relative to pipe area.
 * Bucket strainers have larger screen baskets.
 * Y-type strainers have smaller screens relative to pipe.
 */
const SCREEN_AREA_RATIOS: Record<StrainerType, number> = {
  y_type: 2.0, // screen area ≈ 2× pipe area
  bucket_type: 4.0, // screen area ≈ 4× pipe area
};

/**
 * Screen loss coefficient for flow through mesh
 * Based on typical wire mesh screen data
 */
const SCREEN_K_FACTOR = 1.5;

/**
 * Standard wire mesh sizes — from coarsest to finest.
 * Data from standard mesh tables (ASTM E11 / ISO 565).
 */
export interface MeshSize {
  /** Mesh opening in mm */
  openingMm: number;
  /** Mesh number (openings per inch) */
  meshNumber: number;
  /** Screen open area ratio (fraction) */
  openAreaRatio: number;
  /** Human-readable label */
  label: string;
}

export const STANDARD_MESH_SIZES: MeshSize[] = [
  { openingMm: 6.3, meshNumber: 3, openAreaRatio: 0.56, label: '6.3 mm — Mesh #3 (Very Coarse)' },
  { openingMm: 4.0, meshNumber: 5, openAreaRatio: 0.49, label: '4.0 mm — Mesh #5 (Coarse)' },
  { openingMm: 3.35, meshNumber: 6, openAreaRatio: 0.47, label: '3.35 mm — Mesh #6 (Coarse)' },
  {
    openingMm: 2.0,
    meshNumber: 10,
    openAreaRatio: 0.4,
    label: '2.0 mm — Mesh #10 (Medium-Coarse)',
  },
  { openingMm: 1.5, meshNumber: 14, openAreaRatio: 0.35, label: '1.5 mm — Mesh #14 (Medium)' },
  { openingMm: 1.0, meshNumber: 18, openAreaRatio: 0.35, label: '1.0 mm — Mesh #18 (Medium-Fine)' },
  { openingMm: 0.8, meshNumber: 20, openAreaRatio: 0.33, label: '0.8 mm — Mesh #20 (Fine)' },
  { openingMm: 0.5, meshNumber: 30, openAreaRatio: 0.3, label: '0.5 mm — Mesh #30 (Fine)' },
  { openingMm: 0.25, meshNumber: 60, openAreaRatio: 0.27, label: '0.25 mm — Mesh #60 (Very Fine)' },
  {
    openingMm: 0.15,
    meshNumber: 100,
    openAreaRatio: 0.24,
    label: '0.15 mm — Mesh #100 (Ultra Fine)',
  },
];

/**
 * Recommended mesh size index (into STANDARD_MESH_SIZES) by fluid type.
 */
const RECOMMENDED_MESH_INDEX: Record<FluidType, number> = {
  seawater: 4, // 1.5 mm — Mesh #14
  brine: 4, // 1.5 mm — Mesh #14
  dm_water: 7, // 0.5 mm — Mesh #30
  condensate: 6, // 0.8 mm — Mesh #20
  cooling_water: 3, // 2.0 mm — Mesh #10
  custom: 5, // 1.0 mm — Mesh #18
};

/** Get the recommended mesh index for a fluid type */
export function getRecommendedMeshIndex(fluidType: FluidType): number {
  return RECOMMENDED_MESH_INDEX[fluidType];
}

// ============================================================================
// Main Calculation
// ============================================================================

export function calculateStrainerSizing(input: StrainerSizingInput): StrainerSizingResult {
  const { fluidType, flowRate, lineSize, strainerType, fluidDensity, fluidViscosity } = input;

  // Validate inputs
  if (flowRate <= 0) throw new Error('Flow rate must be positive');
  if (fluidDensity <= 0) throw new Error('Fluid density must be positive');
  if (fluidViscosity <= 0) throw new Error('Fluid viscosity must be positive');

  // Look up pipe
  const pipe = findPipe(lineSize);
  if (!pipe) throw new Error(`Pipe size NPS ${lineSize} not found in Schedule 40 data`);

  const warnings: string[] = [];

  // Resolve mesh: user override or recommendation
  const recommendedIdx = RECOMMENDED_MESH_INDEX[fluidType];
  const selectedIdx = Math.min(
    Math.max(0, input.meshIndex ?? recommendedIdx),
    STANDARD_MESH_SIZES.length - 1
  );
  const mesh = STANDARD_MESH_SIZES[selectedIdx]!;
  const isRecommendedMesh = selectedIdx === recommendedIdx;

  // Flow conversion: m³/hr → m³/s
  const flowM3s = flowRate / 3600;

  // Pipe flow area in m²
  const pipeAreaM2 = pipe.area_mm2 / 1e6;

  // Pipe velocity (m/s)
  const pipeVelocity = flowM3s / pipeAreaM2;

  // Reynolds number: Re = ρ × v × D / μ
  // μ in Pa·s = cP / 1000
  const dynamicViscosityPaS = fluidViscosity / 1000;
  const pipeIdM = pipe.id_mm / 1000;
  const reynoldsNumber = (fluidDensity * pipeVelocity * pipeIdM) / dynamicViscosityPaS;

  // Body K factor
  const bodyKFactor = BODY_K_FACTORS[strainerType];

  // Body pressure drop: ΔP = K × ρ × v² / 2 (Pa), convert to bar
  const bodyPressureDropPa = (bodyKFactor * fluidDensity * Math.pow(pipeVelocity, 2)) / 2;
  const bodyPressureDrop = bodyPressureDropPa / 1e5;

  // Screen area
  const screenAreaRatio = SCREEN_AREA_RATIOS[strainerType];
  const screenAreaMm2 = pipe.area_mm2 * screenAreaRatio;
  const effectiveOpenAreaClean = screenAreaMm2 * mesh.openAreaRatio;
  const effectiveOpenAreaCleanM2 = effectiveOpenAreaClean / 1e6;

  // Screen velocity (clean)
  const screenVelocityClean = flowM3s / effectiveOpenAreaCleanM2;

  // Screen pressure drop (clean): ΔP = K_screen × ρ × v_screen² / 2
  const screenDpCleanPa = (SCREEN_K_FACTOR * fluidDensity * Math.pow(screenVelocityClean, 2)) / 2;
  const screenPressureDropClean = screenDpCleanPa / 1e5;

  // Total clean
  const totalPressureDropClean = bodyPressureDrop + screenPressureDropClean;

  // 50% clogged: open area halved → velocity doubles
  const screenVelocityClogged = screenVelocityClean * 2;
  const screenDpCloggedPa =
    (SCREEN_K_FACTOR * fluidDensity * Math.pow(screenVelocityClogged, 2)) / 2;
  const screenPressureDropClogged = screenDpCloggedPa / 1e5;

  // Total 50% clogged
  const totalPressureDropClogged = bodyPressureDrop + screenPressureDropClogged;

  // Build mesh comparison: selected ± 2 neighbors
  const meshComparison = buildMeshComparison(
    selectedIdx,
    recommendedIdx,
    flowM3s,
    screenAreaMm2,
    bodyPressureDrop,
    fluidDensity
  );

  // Warnings
  if (pipeVelocity > 3.0) {
    warnings.push(
      `Pipe velocity (${pipeVelocity.toFixed(2)} m/s) exceeds 3.0 m/s — consider larger line size`
    );
  }
  if (pipeVelocity < 0.3) {
    warnings.push(
      `Pipe velocity (${pipeVelocity.toFixed(2)} m/s) is very low — check flow rate and line size`
    );
  }
  if (totalPressureDropClogged > 1.0) {
    warnings.push(
      `Pressure drop at 50% clog (${totalPressureDropClogged.toFixed(3)} bar) exceeds 1.0 bar — consider larger strainer or coarser mesh`
    );
  }
  if (totalPressureDropClean > 0.5) {
    warnings.push(
      `Clean pressure drop (${totalPressureDropClean.toFixed(3)} bar) exceeds 0.5 bar — review sizing`
    );
  }
  if (strainerType === 'y_type' && parseFloat(lineSize) > 8) {
    warnings.push(
      'Y-type strainers are typically used for line sizes up to 8" — consider bucket-type for larger sizes'
    );
  }

  return {
    meshSizeMm: mesh.openingMm,
    meshDescription: mesh.label,
    meshNumber: mesh.meshNumber,
    screenOpenAreaRatio: mesh.openAreaRatio,
    isRecommendedMesh,
    selectedMeshIndex: selectedIdx,
    meshComparison,
    pipeIdMm: pipe.id_mm,
    pipeAreaMm2: pipe.area_mm2,
    pipeVelocity: round4(pipeVelocity),
    bodyKFactor,
    screenAreaMm2: round2(screenAreaMm2),
    effectiveOpenAreaClean: round2(effectiveOpenAreaClean),
    screenVelocityClean: round4(screenVelocityClean),
    bodyPressureDrop: round4(bodyPressureDrop),
    screenPressureDropClean: round4(screenPressureDropClean),
    totalPressureDropClean: round4(totalPressureDropClean),
    screenVelocityClogged: round4(screenVelocityClogged),
    screenPressureDropClogged: round4(screenPressureDropClogged),
    totalPressureDropClogged: round4(totalPressureDropClogged),
    reynoldsNumber: Math.round(reynoldsNumber),
    strainerType,
    lineSize,
    warnings,
  };
}

/** Build comparison rows for the selected mesh ± 2 neighbors */
function buildMeshComparison(
  selectedIdx: number,
  recommendedIdx: number,
  flowM3s: number,
  screenAreaMm2: number,
  bodyPressureDrop: number,
  fluidDensity: number
): MeshComparisonEntry[] {
  const startIdx = Math.max(0, selectedIdx - 2);
  const endIdx = Math.min(STANDARD_MESH_SIZES.length - 1, selectedIdx + 2);

  const entries: MeshComparisonEntry[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    const m = STANDARD_MESH_SIZES[i]!;
    const openAreaM2 = (screenAreaMm2 * m.openAreaRatio) / 1e6;
    const vClean = flowM3s / openAreaM2;
    const screenDpClean = (SCREEN_K_FACTOR * fluidDensity * Math.pow(vClean, 2)) / 2 / 1e5;
    const screenDpClogged = (SCREEN_K_FACTOR * fluidDensity * Math.pow(vClean * 2, 2)) / 2 / 1e5;

    entries.push({
      mesh: m,
      meshIndex: i,
      isSelected: i === selectedIdx,
      isRecommended: i === recommendedIdx,
      screenVelocityClean: round4(vClean),
      totalPressureDropClean: round4(bodyPressureDrop + screenDpClean),
      totalPressureDropClogged: round4(bodyPressureDrop + screenDpClogged),
    });
  }
  return entries;
}

// ============================================================================
// Helpers
// ============================================================================

function findPipe(nps: string): PipeVariant | undefined {
  return SCHEDULE_40_PIPES.find((p) => p.nps === nps);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Get available NPS options from Schedule 40 pipe data */
export function getAvailableLineSizes(): string[] {
  return SCHEDULE_40_PIPES.map((p) => p.nps);
}
