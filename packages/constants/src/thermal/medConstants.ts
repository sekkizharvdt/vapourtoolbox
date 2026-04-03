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

/**
 * Carrier steam fraction — fraction of tube-side vapor flow used as carrier
 * steam to sweep NCGs from the tube side vent.
 *
 * Typical range: 0.5–1.5% (El-Dessouky & Ettouney, 2002).
 * Design value: 1% of vapor flow entering the tube side.
 */
export const CARRIER_STEAM_FRACTION = 0.01;

/**
 * Total dissolved gas content in seawater including bicarbonate decomposition.
 *
 * Physically dissolved gases (O₂ + N₂) at 25°C, 35 g/kg ≈ 18–20 mg/L.
 * Bicarbonate decomposition (2 HCO₃⁻ → CO₂ + CO₃²⁻ + H₂O) at MED
 * temperatures (>60°C) releases an additional 25–40 mg/L of CO₂.
 *
 * Conservative total: ~50 mg/L of seawater feed.
 *
 * Reference: CADAFE design — O₂ 1.8 + N₂ 4.2 + CO₂ 20 + leakage 6 = 32 kg/h
 * for ~104 T/h plant → ~40–50 mg per litre of feed.
 */
export const TOTAL_DISSOLVED_GAS_MG_PER_LITRE = 50;

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
// Rognoni Reference Values
// ============================================================================

/**
 * Reference assumptions from Dr. Marco Rognoni's MED design methodology.
 *
 * These are typical fixed values used in the original Excel model (Case 6.xlsx).
 * The application computes values from first-principles correlations — these
 * references allow engineers to compare computed vs. Rognoni assumptions.
 */
export const ROGNONI_REFERENCE = {
  /** Evaporator overall HTC — Rognoni uses a fixed U per effect (W/(m²·K))
   *  Typically 2000–3000 depending on effect temperature */
  evaporatorOverallHTC: {
    hotEnd: 2800, // W/(m²·K) — effects 1–3 (high temp, TBT ~55–65°C)
    midRange: 2500, // W/(m²·K) — effects 4–6 (mid temp)
    coldEnd: 2200, // W/(m²·K) — effects 7+ (low temp, ~38–42°C)
  },
  /** Falling film evaporation HTC — Rognoni fixed value (W/(m²·K)) */
  fallingFilmHTC: 3000,
  /** Tube-side condensation HTC — Rognoni fixed value (W/(m²·K)) */
  condensationHTC: 6000,
  /** Wetting rate — Rognoni typical design value (kg/(m·s)) */
  wettingRate: 0.06,
  /** Minimum wetting rate — Rognoni threshold (kg/(m·s)) */
  minimumWettingRate: 0.03,
  /** Condenser overall HTC — Rognoni fixed value (W/(m²·K)) */
  condenserOverallHTC: 3000,
  /** Preheater overall HTC — Rognoni fixed value (W/(m²·K)) */
  preheaterOverallHTC: 2500,
  /** Fouling resistance — seawater side (m²·K/W) */
  foulingSeawater: 0.00009,
  /** Fouling resistance — distillate side (m²·K/W) */
  foulingDistillate: 0.00005,
  /** Design area margin (fraction over required area) */
  designMargin: 0.15,
  /** Tube pitch ratio — Rognoni uses 1.3× OD triangular */
  pitchRatio: 1.3,
  /** Condenser design velocity (m/s) */
  condenserTubeVelocity: 1.8,
} as const;

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
