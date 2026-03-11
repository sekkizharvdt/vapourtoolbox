/**
 * MED Plant Design Constants
 *
 * Shared constants for Multi-Effect Distillation plant design calculations.
 *
 * References:
 * - El-Dessouky, H.T. & Ettouney, H.M. (2002) "Fundamentals of Salt Water
 *   Desalination," Elsevier
 * - Darwish, M.A. & El-Dessouky, H.T. (1996) "The heat recovery thermal
 *   vapour-compression desalting system," Applied Thermal Engineering
 */

// ============================================================================
// Tube Material Thermal Conductivities
// ============================================================================

/**
 * Thermal conductivity of tube materials in W/(m·K)
 */
export const MED_TUBE_CONDUCTIVITY: Record<string, number> = {
  titanium: 21,
  al_brass: 100,
  cu_ni_90_10: 45,
  cu_ni_70_30: 29,
  al_alloy: 160,
  ss_316l: 16,
  duplex_2205: 19,
};

/**
 * Tube material display labels
 */
export const MED_TUBE_MATERIAL_LABELS: Record<string, string> = {
  titanium: 'Titanium Gr.2',
  al_brass: 'Aluminium Brass',
  cu_ni_90_10: 'Cu-Ni 90/10',
  cu_ni_70_30: 'Cu-Ni 70/30',
  al_alloy: 'Aluminium Alloy',
  ss_316l: 'SS 316L',
  duplex_2205: 'Duplex 2205',
};

// ============================================================================
// Temperature Loss Correlations
// ============================================================================

/**
 * Non-equilibrium allowance (NEA) in °C.
 *
 * NEA accounts for the temperature loss because the brine leaving an effect
 * is not at the equilibrium boiling point — it flashes but doesn't reach
 * full equilibrium. Increases towards the cold end of the plant.
 *
 * Empirical correlation from El-Dessouky & Ettouney (2002), Chapter 6.
 * NEA ≈ 0.33 × (ΔT_per_effect / effect_temp_C) × correction
 *
 * For simplicity in the solver, we use a linear interpolation:
 *   NEA = NEA_HOT + (NEA_COLD - NEA_HOT) × (effectIndex / (N - 1))
 */
export const NEA_HOT_END = 0.2; // °C — hot end (effect 1)
export const NEA_COLD_END = 0.5; // °C — cold end (last effect)

/**
 * Temperature loss due to pressure drop across demisters and vapour ducts
 * in °C. This is approximately constant per effect.
 *
 * Typical value from El-Dessouky & Ettouney (2002): 0.1–0.3°C
 */
export const DELTA_T_PRESSURE_DROP = 0.15; // °C per effect

/**
 * Fraction of last-effect vapor lost as vent (NCG + water vapor carry-over).
 * Typically 2–5% of last effect vapor production.
 */
export const VENT_FRACTION = 0.03;

// ============================================================================
// Design Limits
// ============================================================================

/**
 * Validation limits for MED plant inputs
 */
export const MED_PLANT_LIMITS = {
  numberOfEffects: { min: 2, max: 16 },
  capacity: { min: 0.5, max: 1000, unit: 'T/h' },
  gorTarget: { min: 2, max: 16 },
  steamPressure: { min: 0.05, max: 10, unit: 'bar abs' },
  topBrineTemp: { min: 45, max: 75, unit: '°C' },
  brineConcentrationFactor: { min: 1.2, max: 2.0 },
  condenserApproachTemp: { min: 1.5, max: 5.0, unit: '°C' },
  seawaterSalinity: { min: 20000, max: 50000, unit: 'ppm' },
  foulingFactor: { min: 0.00005, max: 0.0005, unit: 'm²·°C/W' },
} as const;

/**
 * Maximum working ΔT per effect — above this, over-boiling occurs
 * (El-Dessouky & Ettouney, 2002)
 */
export const MAX_WORKING_DELTA_T = 5.5; // °C

// ============================================================================
// Solver Configuration
// ============================================================================

/**
 * Solver convergence settings
 */
export const MED_SOLVER_CONFIG = {
  /** Maximum iterations for the outer (steam flow) convergence loop */
  maxIterations: 50,
  /** Convergence tolerance for capacity match (fraction) */
  capacityTolerance: 0.001, // 0.1%
  /** Convergence tolerance for mass balance per effect (kg/hr) */
  massBalanceTolerance: 1.0, // kg/hr
  /** Convergence tolerance for energy balance (%) */
  energyBalanceTolerance: 0.5, // %
  /** Under-relaxation factor for steam flow updates */
  relaxationFactor: 0.7,
} as const;

// ============================================================================
// Default Input Values
// ============================================================================

/**
 * Default MED plant inputs — based on Case 6.xlsx (8-effect MED, 5 T/h)
 */
export const DEFAULT_MED_PLANT_INPUTS = {
  plantType: 'MED' as const,
  feedArrangement: 'PARALLEL' as const,
  numberOfEffects: 8,
  preheaters: [] as { effectNumber: number; vaporFlow: number }[],

  capacity: 5,
  gorTarget: 6,

  steamPressure: 0.173,
  steamTemperature: 57.3,

  seawaterInletTemp: 30,
  seawaterDischargeTemp: 35,
  seawaterSalinity: 35000,

  topBrineTemp: 55.1,
  brineConcentrationFactor: 1.5,
  condenserApproachTemp: 2.6,
  distillateTemp: 37.6,
  condensateExtraction: 'FINAL_CONDENSER' as const,
  foulingFactor: 0.00015,

  evaporatorTubes: {
    od: 25.4,
    thickness: 1.0,
    length: 1.2,
    material: 'titanium' as const,
  },
  condenserTubes: {
    od: 17,
    thickness: 0.4,
    length: 4.0,
    material: 'titanium' as const,
  },
};
