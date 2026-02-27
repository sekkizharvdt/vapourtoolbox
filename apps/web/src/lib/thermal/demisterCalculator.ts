/**
 * Demister / Mist Eliminator Sizing Calculator
 *
 * Sizes demisters using the Souders-Brown correlation.
 * K-factor table from GPSA Engineering Data Book / Koch-Otto York data.
 *
 * References:
 *   - GPSA Engineering Data Book, 13th ed., Section 7
 *   - Koch-Otto York Demister Design Guidelines
 *   - Perry's Chemical Engineers' Handbook, Sec. 14
 */

// ── K-factor table ────────────────────────────────────────────────────────────

export type DemisterType = 'wire_mesh' | 'wire_mesh_hc' | 'vane' | 'structured';
export type DemisterOrientation = 'horizontal' | 'vertical';
export type VesselGeometry = 'circular' | 'rectangular';
export type FluidInputMode = 'saturation' | 'manual';

/** Souders-Brown K factors (m/s) by type and orientation */
const K_FACTORS: Record<DemisterType, Record<DemisterOrientation, number>> = {
  wire_mesh: { horizontal: 0.107, vertical: 0.076 },
  wire_mesh_hc: { horizontal: 0.14, vertical: 0.1 },
  vane: { horizontal: 0.15, vertical: 0.1 },
  structured: { horizontal: 0.12, vertical: 0.08 },
};

/** Estimated pressure drop ranges (Pa) */
const PRESSURE_DROP: Record<DemisterType, { min: number; max: number }> = {
  wire_mesh: { min: 25, max: 100 },
  wire_mesh_hc: { min: 50, max: 150 },
  vane: { min: 100, max: 500 },
  structured: { min: 50, max: 200 },
};

/** Human-readable labels */
export const DEMISTER_TYPE_LABELS: Record<DemisterType, string> = {
  wire_mesh: 'Standard Wire Mesh (Koch-Otto York style)',
  wire_mesh_hc: 'High-Capacity Wire Mesh',
  vane: 'Vane / Chevron Pack',
  structured: 'Structured Packing',
};

// ── Input / Output types ──────────────────────────────────────────────────────

export interface DemisterInput {
  /** Vapor mass flow rate (kg/s) */
  vaporMassFlow: number;
  /** Vapor density ρ_V (kg/m³) */
  vaporDensity: number;
  /** Liquid density ρ_L (kg/m³) */
  liquidDensity: number;
  /** Demister pad type */
  demisterType: DemisterType;
  /** Pad/vessel orientation */
  orientation: DemisterOrientation;
  /** Design margin as fraction of V_max (0–1, default 0.80) */
  designMargin: number;
  /** Vessel geometry (for diameter/dimension output) */
  geometry: VesselGeometry;
  /** Rectangle width (m) — only used when geometry = 'rectangular' */
  rectangleWidth?: number;
}

export interface DemisterResult {
  /** Souders-Brown K coefficient used (m/s) */
  kFactor: number;
  /** Maximum allowable vapor velocity V_max (m/s) */
  maxVelocity: number;
  /** Design vapor velocity = V_max × designMargin (m/s) */
  designVelocity: number;
  /** Vapor volumetric flow rate (m³/s) */
  vaporVolumetricFlow: number;
  /** Required demister cross-sectional area (m²) */
  requiredArea: number;
  /** Minimum vessel diameter for circular vessel (m) */
  vesselDiameter?: number;
  /** Required height for rectangular vessel with given width (m) */
  rectangleHeight?: number;
  /** Estimated pressure drop lower bound (Pa) */
  pressureDropMin: number;
  /** Estimated pressure drop upper bound (Pa) */
  pressureDropMax: number;
  /** Actual loading = V_actual / V_max (dimensionless, 0–1) */
  loadingFraction: number;
  /** Status: 'ok' | 'high' | 'low' */
  loadingStatus: 'ok' | 'high' | 'low';
}

// ── Calculation ───────────────────────────────────────────────────────────────

export function calculateDemisterSizing(input: DemisterInput): DemisterResult {
  const { vaporMassFlow, vaporDensity, liquidDensity, demisterType, orientation, designMargin } =
    input;

  if (vaporMassFlow <= 0) throw new Error('Vapor mass flow must be positive');
  if (vaporDensity <= 0) throw new Error('Vapor density must be positive');
  if (liquidDensity <= vaporDensity)
    throw new Error('Liquid density must be greater than vapor density');
  if (designMargin <= 0 || designMargin > 1)
    throw new Error('Design margin must be between 0 and 1');

  // Souders-Brown: V_max = K × √((ρ_L − ρ_V) / ρ_V)
  const kFactor = K_FACTORS[demisterType][orientation];
  const maxVelocity = kFactor * Math.sqrt((liquidDensity - vaporDensity) / vaporDensity);
  const designVelocity = maxVelocity * designMargin;

  // Volumetric vapor flow
  const vaporVolumetricFlow = vaporMassFlow / vaporDensity;

  // Required area
  const requiredArea = vaporVolumetricFlow / designVelocity;

  // Actual loading at design condition
  const loadingFraction = designMargin; // by definition, equals the margin
  const loadingStatus: DemisterResult['loadingStatus'] =
    designMargin > 0.9 ? 'high' : designMargin < 0.4 ? 'low' : 'ok';

  // Geometry outputs
  let vesselDiameter: number | undefined;
  let rectangleHeight: number | undefined;

  if (input.geometry === 'circular') {
    vesselDiameter = Math.sqrt((4 * requiredArea) / Math.PI);
  } else if (input.geometry === 'rectangular' && input.rectangleWidth && input.rectangleWidth > 0) {
    rectangleHeight = requiredArea / input.rectangleWidth;
  }

  const dp = PRESSURE_DROP[demisterType];

  return {
    kFactor,
    maxVelocity,
    designVelocity,
    vaporVolumetricFlow,
    requiredArea,
    vesselDiameter,
    rectangleHeight,
    pressureDropMin: dp.min,
    pressureDropMax: dp.max,
    loadingFraction,
    loadingStatus,
  };
}

export { K_FACTORS as DEMISTER_K_FACTORS, PRESSURE_DROP as DEMISTER_PRESSURE_DROP };
