/**
 * Demister / Mist Eliminator Sizing Calculator
 *
 * Sizes demisters using the Souders-Brown correlation, calculates velocity-based
 * pressure drop, and estimates brine carryover for thermal desalination
 * applications.
 *
 * References:
 *   - GPSA Engineering Data Book, 13th ed., Section 7
 *   - Koch-Otto York Demister Design Guidelines
 *   - Perry's Chemical Engineers' Handbook, Sec. 14
 *   - El-Dessouky & Ettouney, "Fundamentals of Salt Water Desalination", 2002
 *   - Sterman, L.S., "On the Theory of Steam Separation", 1958
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type DemisterType = 'wire_mesh' | 'wire_mesh_hc' | 'vane' | 'structured';
export type DemisterOrientation = 'horizontal' | 'vertical';
export type VesselGeometry = 'circular' | 'rectangular';
export type FluidInputMode = 'saturation' | 'manual';

// ── Constants ────────────────────────────────────────────────────────────────

/** Souders-Brown K factors (m/s) by type and orientation */
const K_FACTORS: Record<DemisterType, Record<DemisterOrientation, number>> = {
  wire_mesh: { horizontal: 0.107, vertical: 0.076 },
  wire_mesh_hc: { horizontal: 0.14, vertical: 0.1 },
  vane: { horizontal: 0.15, vertical: 0.1 },
  structured: { horizontal: 0.12, vertical: 0.08 },
};

/** Reference pressure drop ranges (Pa) — for validation/comparison only */
const PRESSURE_DROP: Record<DemisterType, { min: number; max: number }> = {
  wire_mesh: { min: 25, max: 100 },
  wire_mesh_hc: { min: 50, max: 150 },
  vane: { min: 100, max: 500 },
  structured: { min: 50, max: 200 },
};

/**
 * Pressure drop model: ΔP = C × (t / t_ref) × ρ_V × V^n
 *
 * Coefficients calibrated against Koch-Otto York and GPSA data.
 * t_ref is the standard pad thickness for each type.
 */
const DP_MODEL: Record<DemisterType, { C: number; n: number; tRef_mm: number }> = {
  wire_mesh: { C: 170, n: 1.8, tRef_mm: 150 },
  wire_mesh_hc: { C: 130, n: 1.8, tRef_mm: 150 },
  vane: { C: 350, n: 2.0, tRef_mm: 50 },
  structured: { C: 200, n: 1.9, tRef_mm: 150 },
};

/** Default pad thickness (mm) by demister type */
export const DEFAULT_PAD_THICKNESS: Record<DemisterType, number> = {
  wire_mesh: 150,
  wire_mesh_hc: 150,
  vane: 50,
  structured: 150,
};

/**
 * Demister separation efficiency model.
 * nominal = efficiency at 60-90% loading.
 * Efficiency degrades at very low loading (poor drainage)
 * and very high loading (re-entrainment / flooding).
 */
const DEMISTER_EFFICIENCY: Record<DemisterType, { nominal: number; minDroplet_um: number }> = {
  wire_mesh: { nominal: 0.995, minDroplet_um: 10 },
  wire_mesh_hc: { nominal: 0.99, minDroplet_um: 15 },
  vane: { nominal: 0.985, minDroplet_um: 20 },
  structured: { nominal: 0.998, minDroplet_um: 5 },
};

/** Human-readable labels */
export const DEMISTER_TYPE_LABELS: Record<DemisterType, string> = {
  wire_mesh: 'Standard Wire Mesh (Koch-Otto York style)',
  wire_mesh_hc: 'High-Capacity Wire Mesh',
  vane: 'Vane / Chevron Pack',
  structured: 'Structured Packing',
};

// ── Input / Output types ─────────────────────────────────────────────────────

export interface CarryoverInput {
  /** Brine / liquid TDS (ppm) — salinity of the liquid from which vapor is generated */
  brineSalinity: number;
  /**
   * Primary entrainment ratio (kg liquid / kg vapor) before the demister.
   * If not provided, an estimate is calculated from vapor loading using
   * a simplified Sterman-type correlation.
   */
  primaryEntrainment?: number;
}

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
  /** Pad thickness (mm) — defaults to standard thickness for the type */
  padThickness?: number;
  /** Optional carryover estimation for desalination applications */
  carryover?: CarryoverInput;
}

export interface CarryoverResult {
  /** Primary entrainment ratio (kg liquid / kg vapor) before demister */
  primaryEntrainment: number;
  /** Whether the primary entrainment was user-supplied or estimated */
  primaryEntrainmentSource: 'user' | 'estimated';
  /** Demister separation efficiency at design conditions (0–1) */
  demisterEfficiency: number;
  /** Net carryover ratio after demister (kg liquid / kg vapor) */
  netCarryover: number;
  /** Net carryover mass flow rate (kg/s) */
  carryoverMassFlow: number;
  /** Net carryover as ppm of vapor mass flow */
  carryoverPPM: number;
  /** Estimated distillate TDS (ppm) from brine carryover */
  distillateTDS: number;
  /** Quality assessment based on distillate TDS */
  qualityAssessment: 'excellent' | 'good' | 'marginal' | 'poor';
  /** Warnings about operating conditions affecting carryover */
  warnings: string[];
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
  /** Pad thickness used (mm) */
  padThickness: number;
  /** Calculated pressure drop (Pa) — velocity-based model */
  pressureDrop: number;
  /** Reference pressure drop range for the demister type (Pa) */
  pressureDropRange: { min: number; max: number };
  /** Actual loading = V_actual / V_max (dimensionless, 0–1) */
  loadingFraction: number;
  /** Status: 'ok' | 'high' | 'low' */
  loadingStatus: 'ok' | 'high' | 'low';
  /** Brine carryover estimation (present only if carryover input was provided) */
  carryover?: CarryoverResult;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Estimate primary entrainment from vapor loading fraction using a
 * simplified power-law model consistent with Sterman (1958) observations.
 *
 * At typical design load (80% V_max): ~0.5% entrainment
 * At flood point (100% V_max): ~3% entrainment
 * At low load (40% V_max): ~0.05% entrainment
 */
function estimatePrimaryEntrainment(loadingFraction: number): number {
  // E₀ = 0.018 × (loading)^3.5
  // Gives: 0.40 → 0.04%, 0.80 → 0.52%, 1.00 → 1.8%, 1.10 → 2.8%
  return 0.018 * Math.pow(Math.max(loadingFraction, 0.01), 3.5);
}

/**
 * Calculate demister separation efficiency as a function of loading.
 *
 * Efficiency is at its nominal (best) value between 40-90% loading.
 * Below 40%: efficiency degrades due to insufficient inertia for droplet capture.
 * Above 90%: efficiency degrades due to re-entrainment / flooding.
 */
function calculateDemisterEfficiency(demisterType: DemisterType, loadingFraction: number): number {
  const { nominal } = DEMISTER_EFFICIENCY[demisterType];

  if (loadingFraction >= 0.4 && loadingFraction <= 0.9) {
    return nominal;
  }

  if (loadingFraction < 0.4) {
    // Below 40%: efficiency degrades linearly to 80% of nominal at 10% loading
    const factor = 0.8 + 0.2 * (loadingFraction / 0.4);
    return nominal * factor;
  }

  // Above 90%: efficiency degrades — re-entrainment onset
  // At 100% loading: 90% of nominal, at 120%: 60% of nominal
  const excessLoading = (loadingFraction - 0.9) / 0.3; // 0 at 90%, 1 at 120%
  const factor = Math.max(0.3, 1 - 0.4 * excessLoading);
  return nominal * factor;
}

/**
 * Calculate velocity-based pressure drop through the demister pad.
 */
function calculatePressureDrop(
  demisterType: DemisterType,
  vaporDensity: number,
  designVelocity: number,
  padThickness_mm: number
): number {
  const model = DP_MODEL[demisterType];
  const thicknessRatio = padThickness_mm / model.tRef_mm;
  return model.C * thicknessRatio * vaporDensity * Math.pow(designVelocity, model.n);
}

/**
 * Assess distillate quality based on TDS.
 *
 * Thresholds from MED/MSF desalination practice:
 *   - < 5 ppm: excellent (typical for well-designed MED)
 *   - < 15 ppm: good
 *   - < 25 ppm: marginal (may need polishing)
 *   - ≥ 25 ppm: poor (demister upgrade or re-design needed)
 */
function assessDistillateQuality(tds: number): CarryoverResult['qualityAssessment'] {
  if (tds < 5) return 'excellent';
  if (tds < 15) return 'good';
  if (tds < 25) return 'marginal';
  return 'poor';
}

// ── Main calculation ─────────────────────────────────────────────────────────

export function calculateDemisterSizing(input: DemisterInput): DemisterResult {
  const { vaporMassFlow, vaporDensity, liquidDensity, demisterType, orientation, designMargin } =
    input;

  // ── Validation ──

  if (vaporMassFlow <= 0) throw new Error('Vapor mass flow must be positive');
  if (vaporDensity <= 0) throw new Error('Vapor density must be positive');
  if (liquidDensity <= vaporDensity)
    throw new Error('Liquid density must be greater than vapor density');
  if (designMargin <= 0 || designMargin > 1)
    throw new Error('Design margin must be between 0 and 1');

  const padThickness = input.padThickness ?? DEFAULT_PAD_THICKNESS[demisterType];
  if (padThickness <= 0) throw new Error('Pad thickness must be positive');

  // ── Souders-Brown sizing ──

  const kFactor = K_FACTORS[demisterType][orientation];
  const maxVelocity = kFactor * Math.sqrt((liquidDensity - vaporDensity) / vaporDensity);
  const designVelocity = maxVelocity * designMargin;

  const vaporVolumetricFlow = vaporMassFlow / vaporDensity;
  const requiredArea = vaporVolumetricFlow / designVelocity;

  const loadingFraction = designMargin;
  const loadingStatus: DemisterResult['loadingStatus'] =
    designMargin > 0.9 ? 'high' : designMargin < 0.4 ? 'low' : 'ok';

  // ── Geometry ──

  let vesselDiameter: number | undefined;
  let rectangleHeight: number | undefined;

  if (input.geometry === 'circular') {
    vesselDiameter = Math.sqrt((4 * requiredArea) / Math.PI);
  } else if (input.geometry === 'rectangular' && input.rectangleWidth && input.rectangleWidth > 0) {
    rectangleHeight = requiredArea / input.rectangleWidth;
  }

  // ── Pressure drop ──

  const pressureDrop = calculatePressureDrop(
    demisterType,
    vaporDensity,
    designVelocity,
    padThickness
  );
  const pressureDropRange = PRESSURE_DROP[demisterType];

  // ── Carryover estimation (optional) ──

  let carryover: CarryoverResult | undefined;

  if (input.carryover) {
    const { brineSalinity, primaryEntrainment: userEntrainment } = input.carryover;

    if (brineSalinity < 0) throw new Error('Brine salinity must be non-negative');

    const warnings: string[] = [];

    // Primary entrainment
    const primaryEntrainmentSource: CarryoverResult['primaryEntrainmentSource'] =
      userEntrainment !== undefined ? 'user' : 'estimated';
    const primaryEntrainment =
      userEntrainment !== undefined ? userEntrainment : estimatePrimaryEntrainment(loadingFraction);

    if (primaryEntrainment < 0 || primaryEntrainment > 1) {
      throw new Error('Primary entrainment must be between 0 and 1');
    }

    // Demister efficiency
    const demisterEfficiency = calculateDemisterEfficiency(demisterType, loadingFraction);

    if (loadingFraction > 1.0) {
      warnings.push(
        'Vapor velocity exceeds V_max — demister is flooded. ' +
          'Expect severe re-entrainment and poor separation.'
      );
    } else if (loadingFraction > 0.9) {
      warnings.push(
        'Loading above 90% of V_max — demister efficiency is degraded. ' +
          'Consider reducing velocity or using a larger demister.'
      );
    } else if (loadingFraction < 0.4) {
      warnings.push(
        'Loading below 40% of V_max — low inertial separation. ' +
          'Fine droplets may not be captured effectively.'
      );
    }

    // Net carryover
    const netCarryover = primaryEntrainment * (1 - demisterEfficiency);
    const carryoverMassFlow = netCarryover * vaporMassFlow;
    const carryoverPPM = netCarryover * 1e6;

    // Distillate TDS: brine carried over mixes with pure vapor
    // distillateTDS = (carryoverMassFlow × brineSalinity) / (vaporMassFlow + carryoverMassFlow)
    // Since carryoverMassFlow << vaporMassFlow, simplify:
    const distillateTDS = netCarryover * brineSalinity;

    const qualityAssessment = assessDistillateQuality(distillateTDS);

    if (qualityAssessment === 'poor') {
      warnings.push(
        `Predicted distillate TDS (${distillateTDS.toFixed(1)} ppm) exceeds 25 ppm. ` +
          'Consider a higher-efficiency demister type or reducing entrainment at source.'
      );
    } else if (qualityAssessment === 'marginal') {
      warnings.push(
        `Predicted distillate TDS (${distillateTDS.toFixed(1)} ppm) is marginal (15–25 ppm). ` +
          'Distillate polishing may be required.'
      );
    }

    if (brineSalinity > 100000) {
      warnings.push(
        'Brine salinity exceeds 100,000 ppm — verify that the concentration factor ' +
          'is within safe limits to avoid scaling.'
      );
    }

    carryover = {
      primaryEntrainment,
      primaryEntrainmentSource,
      demisterEfficiency,
      netCarryover,
      carryoverMassFlow,
      carryoverPPM,
      distillateTDS,
      qualityAssessment,
      warnings,
    };
  }

  return {
    kFactor,
    maxVelocity,
    designVelocity,
    vaporVolumetricFlow,
    requiredArea,
    vesselDiameter,
    rectangleHeight,
    padThickness,
    pressureDrop,
    pressureDropRange,
    loadingFraction,
    loadingStatus,
    carryover,
  };
}

// ── Carryover comparison across demister types ──────────────────────────────

export interface CarryoverComparisonRow {
  /** Demister type label (or "No Demister") */
  label: string;
  /** Demister type key (null for "no demister") */
  type: DemisterType | null;
  /** Separation efficiency at the given loading (0 for no demister) */
  efficiency: number;
  /** Net carryover ratio (kg liquid / kg vapor) */
  netCarryover: number;
  /** Predicted distillate TDS (ppm) */
  distillateTDS: number;
  /** Quality assessment */
  qualityAssessment: CarryoverResult['qualityAssessment'];
  /** Minimum captured droplet size (µm) */
  minDroplet_um: number | null;
}

/**
 * Compare distillate TDS across all demister types (and without a demister)
 * at the same operating conditions.
 *
 * Primary entrainment is independent of demister type (it originates at the
 * boiling surface). Only the demister separation efficiency differs.
 */
export function calculateCarryoverComparison(
  primaryEntrainment: number,
  brineSalinity: number,
  loadingFraction: number
): CarryoverComparisonRow[] {
  const ALL_TYPES: DemisterType[] = ['wire_mesh', 'wire_mesh_hc', 'vane', 'structured'];

  // No demister baseline
  const noDemisterTDS = primaryEntrainment * brineSalinity;
  const rows: CarryoverComparisonRow[] = [
    {
      label: 'No Demister',
      type: null,
      efficiency: 0,
      netCarryover: primaryEntrainment,
      distillateTDS: noDemisterTDS,
      qualityAssessment: assessDistillateQuality(noDemisterTDS),
      minDroplet_um: null,
    },
  ];

  for (const type of ALL_TYPES) {
    const eff = calculateDemisterEfficiency(type, loadingFraction);
    const net = primaryEntrainment * (1 - eff);
    const tds = net * brineSalinity;

    rows.push({
      label: DEMISTER_TYPE_LABELS[type],
      type,
      efficiency: eff,
      netCarryover: net,
      distillateTDS: tds,
      qualityAssessment: assessDistillateQuality(tds),
      minDroplet_um: DEMISTER_EFFICIENCY[type].minDroplet_um,
    });
  }

  return rows;
}

// ── Exports for UI / tests ───────────────────────────────────────────────────

export {
  K_FACTORS as DEMISTER_K_FACTORS,
  PRESSURE_DROP as DEMISTER_PRESSURE_DROP,
  DEMISTER_EFFICIENCY,
  DP_MODEL,
  estimatePrimaryEntrainment,
  calculateDemisterEfficiency,
};
