/**
 * Heat Transfer Coefficient Correlations
 *
 * Provides calculation functions for heat transfer coefficients used in
 * condenser, evaporator, heat exchanger, and MED design.
 *
 * References:
 * - Dittus-Boelter correlation (tube-side forced convection)
 * - Nusselt film condensation (shell-side condensation)
 * - Kern method (shell-side forced convection for liquid-liquid)
 * - Mostinski correlation (pool/nucleate boiling)
 * - Overall HTC from composite thermal resistance
 *
 * Sources: Perry's Chemical Engineers' Handbook, Kern's Process Heat Transfer,
 *          Mostinski (1963), Stephan & Abdelsalam (1980)
 */

// ============================================================================
// Types
// ============================================================================

/** Result of Prandtl number calculation */
export interface PrandtlResult {
  /** Prandtl number (dimensionless) */
  prandtlNumber: number;
}

/** Result of Dittus-Boelter correlation */
export interface DittusBoelterResult {
  /** Nusselt number (dimensionless) */
  nusseltNumber: number;
}

/** Input for tube-side HTC calculation */
export interface TubeSideHTCInput {
  /** Fluid density in kg/m³ */
  density: number;
  /** Flow velocity in m/s */
  velocity: number;
  /** Tube inner diameter in m */
  diameter: number;
  /** Dynamic viscosity in Pa·s */
  viscosity: number;
  /** Specific heat in kJ/(kg·K) */
  specificHeat: number;
  /** Thermal conductivity in W/(m·K) */
  conductivity: number;
  /** Whether the fluid is being heated or cooled */
  isHeating: boolean;
}

/** Result of tube-side HTC calculation */
export interface TubeSideHTCResult {
  /** Heat transfer coefficient in W/(m²·K) */
  htc: number;
  /** Reynolds number */
  reynoldsNumber: number;
  /** Prandtl number */
  prandtlNumber: number;
  /** Nusselt number */
  nusseltNumber: number;
}

/** Input for Nusselt film condensation */
export interface NusseltCondensationInput {
  /** Liquid density in kg/m³ */
  liquidDensity: number;
  /** Vapor density in kg/m³ */
  vaporDensity: number;
  /** Latent heat of vaporization in kJ/kg */
  latentHeat: number;
  /** Liquid thermal conductivity in W/(m·K) */
  liquidConductivity: number;
  /** Liquid dynamic viscosity in Pa·s */
  liquidViscosity: number;
  /** Characteristic dimension in m (tube length for vertical, tube OD for horizontal) */
  dimension: number;
  /** Temperature difference between saturation and surface in °C */
  deltaT: number;
  /** Tube orientation */
  orientation: 'vertical' | 'horizontal';
}

/** Result of condensation HTC calculation */
export interface CondensationHTCResult {
  /** Heat transfer coefficient in W/(m²·K) */
  htc: number;
}

/** Input for Kern shell-side HTC calculation (liquid-liquid cross-flow) */
export interface KernShellSideInput {
  /** Shell-side fluid density in kg/m³ */
  density: number;
  /** Shell-side cross-flow velocity in m/s */
  velocity: number;
  /** Tube outer diameter in m */
  tubeOD: number;
  /** Tube pitch in m */
  tubePitch: number;
  /** Tube layout: 'triangular' or 'square' */
  tubeLayout: 'triangular' | 'square';
  /** Dynamic viscosity in Pa·s */
  viscosity: number;
  /** Specific heat in kJ/(kg·K) */
  specificHeat: number;
  /** Thermal conductivity in W/(m·K) */
  conductivity: number;
}

/** Result of Kern shell-side HTC calculation */
export interface KernShellSideResult {
  /** Heat transfer coefficient in W/(m²·K) */
  htc: number;
  /** Shell-side equivalent diameter in m */
  equivalentDiameter: number;
  /** Shell-side Reynolds number */
  reynoldsNumber: number;
  /** Shell-side Prandtl number */
  prandtlNumber: number;
}

/** Input for Mostinski pool boiling HTC calculation */
export interface MostinskiBoilingInput {
  /** Heat flux in W/m² */
  heatFlux: number;
  /** Saturation pressure in bar (absolute) */
  saturationPressure: number;
}

/** Result of Mostinski boiling HTC calculation */
export interface MostinskiBoilingResult {
  /** Heat transfer coefficient in W/(m²·K) */
  htc: number;
  /** Reduced pressure P/P_c */
  reducedPressure: number;
  /** Pressure correction factor F_p */
  pressureFactor: number;
}

/** Input for overall HTC calculation */
export interface OverallHTCInput {
  /** Tube-side HTC in W/(m²·K) */
  tubeSideHTC: number;
  /** Shell-side HTC in W/(m²·K) */
  shellSideHTC: number;
  /** Tube outer diameter in m */
  tubeOD: number;
  /** Tube inner diameter in m */
  tubeID: number;
  /** Tube wall thermal conductivity in W/(m·K) */
  tubeWallConductivity: number;
  /** Tube-side fouling resistance in m²·K/W */
  tubeSideFouling: number;
  /** Shell-side fouling resistance in m²·K/W */
  shellSideFouling: number;
}

/** Result of overall HTC calculation */
export interface OverallHTCResult {
  /** Overall HTC based on outer surface area in W/(m²·K) */
  overallHTC: number;
  /** Individual thermal resistances in m²·K/W */
  resistances: {
    /** Tube-side convection resistance (referenced to OD) */
    tubeSide: number;
    /** Tube-side fouling resistance (referenced to OD) */
    tubeSideFouling: number;
    /** Tube wall conduction resistance */
    tubeWall: number;
    /** Shell-side fouling resistance */
    shellSideFouling: number;
    /** Shell-side convection resistance */
    shellSide: number;
    /** Total resistance */
    total: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Gravitational acceleration (m/s²) */
const GRAVITY = 9.81;

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate Prandtl number
 *
 * Pr = Cp × μ / k
 *
 * @param specificHeat - Specific heat capacity in kJ/(kg·K)
 * @param viscosity - Dynamic viscosity in Pa·s
 * @param conductivity - Thermal conductivity in W/(m·K)
 * @returns Prandtl number result
 */
export function calculatePrandtlNumber(
  specificHeat: number,
  viscosity: number,
  conductivity: number
): PrandtlResult {
  // Convert Cp from kJ/(kg·K) to J/(kg·K) for dimensional consistency
  const cpJoules = specificHeat * 1000;
  return {
    prandtlNumber: (cpJoules * viscosity) / conductivity,
  };
}

/**
 * Calculate Reynolds number for tube flow
 *
 * Re = ρ × v × D / μ
 *
 * @param density - Fluid density in kg/m³
 * @param velocity - Flow velocity in m/s
 * @param diameter - Tube inner diameter in m
 * @param viscosity - Dynamic viscosity in Pa·s
 * @returns Reynolds number (dimensionless)
 */
export function calculateTubeReynoldsNumber(
  density: number,
  velocity: number,
  diameter: number,
  viscosity: number
): number {
  return (density * velocity * diameter) / viscosity;
}

/**
 * Calculate Nusselt number using Dittus-Boelter correlation
 *
 * Nu = 0.023 × Re^0.8 × Pr^n
 * where n = 0.4 for heating, n = 0.3 for cooling
 *
 * Valid for:
 * - Re > 10,000 (fully turbulent)
 * - 0.6 < Pr < 160
 * - L/D > 10
 *
 * @param reynoldsNumber - Reynolds number
 * @param prandtlNumber - Prandtl number
 * @param isHeating - true if fluid is being heated, false if cooled
 * @returns Nusselt number result
 */
export function calculateDittusBoelter(
  reynoldsNumber: number,
  prandtlNumber: number,
  isHeating: boolean
): DittusBoelterResult {
  const n = isHeating ? 0.4 : 0.3;
  const nusseltNumber = 0.023 * Math.pow(reynoldsNumber, 0.8) * Math.pow(prandtlNumber, n);

  return { nusseltNumber };
}

/**
 * Calculate tube-side heat transfer coefficient
 *
 * Composite calculation: Re → Pr → Nu → h
 * h = Nu × k / D
 *
 * @param input - Tube-side HTC input parameters
 * @returns Tube-side HTC result with intermediate values
 */
export function calculateTubeSideHTC(input: TubeSideHTCInput): TubeSideHTCResult {
  const { density, velocity, diameter, viscosity, specificHeat, conductivity, isHeating } = input;

  // Reynolds number
  const reynoldsNumber = calculateTubeReynoldsNumber(density, velocity, diameter, viscosity);

  // Prandtl number
  const { prandtlNumber } = calculatePrandtlNumber(specificHeat, viscosity, conductivity);

  // Nusselt number via Dittus-Boelter
  const { nusseltNumber } = calculateDittusBoelter(reynoldsNumber, prandtlNumber, isHeating);

  // Heat transfer coefficient: h = Nu × k / D
  const htc = (nusseltNumber * conductivity) / diameter;

  return {
    htc,
    reynoldsNumber,
    prandtlNumber,
    nusseltNumber,
  };
}

/**
 * Calculate condensation HTC using Nusselt film condensation theory
 *
 * Vertical tube:
 *   h = 0.943 × [ρ_l × (ρ_l - ρ_v) × g × hfg × k³ / (μ × L × ΔT)]^0.25
 *
 * Horizontal tube:
 *   h = 0.725 × [ρ_l × (ρ_l - ρ_v) × g × hfg × k³ / (μ × D × ΔT)]^0.25
 *
 * @param input - Condensation calculation input
 * @returns Condensation HTC result
 */
export function calculateNusseltCondensation(
  input: NusseltCondensationInput
): CondensationHTCResult {
  const {
    liquidDensity,
    vaporDensity,
    latentHeat,
    liquidConductivity,
    liquidViscosity,
    dimension,
    deltaT,
    orientation,
  } = input;

  // Convert latent heat from kJ/kg to J/kg
  const hfgJoules = latentHeat * 1000;

  // Coefficient: 0.943 for vertical, 0.725 for horizontal
  const C = orientation === 'vertical' ? 0.943 : 0.725;

  // Ensure deltaT > 0 to avoid division by zero
  const safeDeltaT = Math.max(deltaT, 0.1);

  // Nusselt condensation formula
  const numerator =
    liquidDensity *
    (liquidDensity - vaporDensity) *
    GRAVITY *
    hfgJoules *
    Math.pow(liquidConductivity, 3);

  const denominator = liquidViscosity * dimension * safeDeltaT;

  const htc = C * Math.pow(numerator / denominator, 0.25);

  return { htc };
}

/**
 * Calculate shell-side equivalent diameter for Kern method
 *
 * Triangular pitch:
 *   De = 4 × (P_t² × √3/4 − π×D_o²/8) / (π×D_o/2)
 *
 * Square pitch:
 *   De = 4 × (P_t² − π×D_o²/4) / (π×D_o)
 *
 * @param tubeOD - Tube outer diameter in m
 * @param tubePitch - Tube pitch in m
 * @param layout - Tube layout pattern
 * @returns Equivalent diameter in m
 */
export function calculateShellEquivalentDiameter(
  tubeOD: number,
  tubePitch: number,
  layout: 'triangular' | 'square'
): number {
  if (layout === 'triangular') {
    // Triangular pitch: flow area between 3 tubes
    const flowArea = (tubePitch * tubePitch * Math.sqrt(3)) / 4 - (Math.PI * tubeOD * tubeOD) / 8;
    const wettedPerimeter = (Math.PI * tubeOD) / 2;
    return (4 * flowArea) / wettedPerimeter;
  } else {
    // Square pitch: flow area in unit cell
    const flowArea = tubePitch * tubePitch - (Math.PI * tubeOD * tubeOD) / 4;
    const wettedPerimeter = Math.PI * tubeOD;
    return (4 * flowArea) / wettedPerimeter;
  }
}

/**
 * Calculate shell-side HTC using Kern method
 *
 * Nu = 0.36 × Re^0.55 × Pr^(1/3)
 * h = Nu × k / De
 *
 * Valid for Re > 2000 (turbulent cross-flow over tube banks).
 * Reference: Kern's Process Heat Transfer, Chapter 7
 *
 * @param input - Shell-side HTC input parameters
 * @returns Shell-side HTC result with intermediate values
 */
export function calculateKernShellSideHTC(input: KernShellSideInput): KernShellSideResult {
  const {
    density,
    velocity,
    tubeOD,
    tubePitch,
    tubeLayout,
    viscosity,
    specificHeat,
    conductivity,
  } = input;

  // Equivalent diameter
  const De = calculateShellEquivalentDiameter(tubeOD, tubePitch, tubeLayout);

  // Reynolds number based on equivalent diameter
  const reynoldsNumber = (density * velocity * De) / viscosity;

  // Prandtl number
  const { prandtlNumber } = calculatePrandtlNumber(specificHeat, viscosity, conductivity);

  // Kern correlation: Nu = 0.36 × Re^0.55 × Pr^(1/3)
  const nusseltNumber = 0.36 * Math.pow(reynoldsNumber, 0.55) * Math.pow(prandtlNumber, 1 / 3);

  const htc = (nusseltNumber * conductivity) / De;

  return {
    htc,
    equivalentDiameter: De,
    reynoldsNumber,
    prandtlNumber,
  };
}

/**
 * Calculate pool boiling HTC using Mostinski correlation
 *
 * h = 0.00417 × P_c^0.69 × q^0.7 × F_p
 *
 * where:
 *   P_c = critical pressure (bar)
 *   q = heat flux (W/m²)
 *   F_p = 1.8 × P_r^0.17 + 4 × P_r^1.2 + 10 × P_r^10
 *   P_r = P / P_c (reduced pressure)
 *
 * For water: P_c = 220.64 bar
 *
 * Valid for pool/nucleate boiling. Simple empirical correlation that
 * requires only pressure and heat flux — no surface tension or contact angle.
 *
 * Reference: Mostinski (1963), cited in Perry's 9th Ed. §5-8
 *
 * @param input - Boiling HTC input parameters
 * @returns Boiling HTC result
 */
export function calculateMostinskiBoiling(input: MostinskiBoilingInput): MostinskiBoilingResult {
  const { heatFlux, saturationPressure } = input;

  // Critical pressure of water in kPa (Mostinski correlation uses kPa for P_c)
  const P_CRITICAL_WATER_KPA = 22064; // kPa
  const P_CRITICAL_WATER_BAR = 220.64; // bar

  const Pr = saturationPressure / P_CRITICAL_WATER_BAR;

  // Pressure correction factor (dimensionless — uses reduced pressure)
  const Fp = 1.8 * Math.pow(Pr, 0.17) + 4 * Math.pow(Pr, 1.2) + 10 * Math.pow(Pr, 10);

  // Mostinski correlation: h = 0.00417 × P_c^0.69 × q^0.7 × F_p
  // P_c in kPa, q in W/m², h in W/(m²·K)
  const htc = 0.00417 * Math.pow(P_CRITICAL_WATER_KPA, 0.69) * Math.pow(heatFlux, 0.7) * Fp;

  return {
    htc,
    reducedPressure: Pr,
    pressureFactor: Fp,
  };
}

/**
 * Calculate overall heat transfer coefficient from composite thermal resistance
 *
 * Based on outer tube area:
 * 1/U_o = (1/h_i)×(D_o/D_i) + R_fi×(D_o/D_i) + D_o×ln(D_o/D_i)/(2×k_w) + R_fo + 1/h_o
 *
 * @param input - Overall HTC calculation input
 * @returns Overall HTC result with resistance breakdown
 */
export function calculateOverallHTC(input: OverallHTCInput): OverallHTCResult {
  const {
    tubeSideHTC,
    shellSideHTC,
    tubeOD,
    tubeID,
    tubeWallConductivity,
    tubeSideFouling,
    shellSideFouling,
  } = input;

  const diameterRatio = tubeOD / tubeID;

  // Individual resistances (all referenced to outer surface area)
  const rTubeSide = (1 / tubeSideHTC) * diameterRatio;
  const rTubeSideFouling = tubeSideFouling * diameterRatio;
  const rTubeWall = (tubeOD * Math.log(tubeOD / tubeID)) / (2 * tubeWallConductivity);
  const rShellSideFouling = shellSideFouling;
  const rShellSide = 1 / shellSideHTC;

  const totalResistance = rTubeSide + rTubeSideFouling + rTubeWall + rShellSideFouling + rShellSide;

  const overallHTC = 1 / totalResistance;

  return {
    overallHTC,
    resistances: {
      tubeSide: rTubeSide,
      tubeSideFouling: rTubeSideFouling,
      tubeWall: rTubeWall,
      shellSideFouling: rShellSideFouling,
      shellSide: rShellSide,
      total: totalResistance,
    },
  };
}
