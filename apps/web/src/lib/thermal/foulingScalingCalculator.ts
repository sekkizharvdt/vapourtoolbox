/**
 * Fouling and Scaling Prediction Calculator
 *
 * Predicts scaling tendency in MED/MSF thermal desalination plants
 * at various operating temperatures. Evaluates three primary scale-forming species:
 * - CaSO4 (Calcium Sulfate) — inverse solubility, limits TBT
 * - CaCO3 (Calcium Carbonate) — controlled by pH and antiscalant
 * - Mg(OH)2 (Magnesium Hydroxide) — forms at high T and high pH
 *
 * References:
 * - El-Dessouky & Ettouney, "Fundamentals of Salt Water Desalination" (2002)
 * - Ostroff & Metler (1966) — CaSO4 solubility in seawater
 * - Marshall & Slusher (1966) — CaSO4 solubility vs temperature
 * - Langelier (1936) — Saturation Index for CaCO3
 */

// ============================================================================
// Constants
// ============================================================================

/** Standard seawater chemistry for default/reference values */
export const STANDARD_SEAWATER_CHEMISTRY = {
  calcium: 420, // mg/L Ca2+
  sulfate: 2700, // mg/L SO42-
  bicarbonate: 140, // mg/L as CaCO3
  magnesium: 1290, // mg/L Mg2+
  pH: 8.1,
  salinity: 35000, // ppm TDS
};

/** Scaling index thresholds for CaSO4 and LSI */
export const SCALING_THRESHOLDS = {
  CaSO4_SAFE: 0.7,
  CaSO4_WARNING: 0.85,
  CaSO4_CRITICAL: 1.0,
  LSI_SCALING: 0.5,
  LSI_WARNING: 0.0,
};

/** Molar masses (g/mol) */
const MOLAR_MASS = {
  Ca: 40.08,
  SO4: 96.06,
  CaSO4: 136.14,
  CaCO3: 100.08,
};

/** Default antiscalant efficiency when dosed but efficiency not specified */
const DEFAULT_ANTISCALANT_EFFICIENCY = 0.85;

// ============================================================================
// Types
// ============================================================================

export interface FoulingScalingInput {
  // Water chemistry
  feedSalinity: number; // ppm TDS
  calciumConcentration: number; // mg/L as Ca2+
  sulfateConcentration: number; // mg/L as SO42-
  bicarbonateAlkalinity: number; // mg/L as CaCO3
  magnesiumConcentration: number; // mg/L as Mg2+
  pH: number; // feed pH

  // Operating range
  temperatureMin: number; // deg C — minimum temperature to evaluate
  temperatureMax: number; // deg C — maximum temperature to evaluate
  temperatureSteps: number; // number of evaluation points

  // Concentration
  concentrationFactor: number; // brine concentration factor (typically 1.3-1.8 for MED)

  // Optional
  antiscalantDosed: boolean; // whether antiscalant is used
  antiscalantEfficiency?: number; // 0-1, fraction of scaling potential neutralised
}

export interface ScalingPoint {
  temperature: number; // deg C
  CaSO4_solubility: number; // mg/L as CaSO4
  CaSO4_brineConcentration: number; // mg/L as CaSO4 in brine
  CaSO4_saturationIndex: number; // >1 = supersaturated
  CaSO4_status: 'safe' | 'warning' | 'critical';
  LSI: number; // Langelier Saturation Index
  CaCO3_status: 'safe' | 'warning' | 'scaling';
  MgOH2_risk: boolean;
  recommendedFouling: number; // m2.K/W
}

export interface FoulingScalingResult {
  // Per-temperature results
  scalingProfile: ScalingPoint[];

  // Summary
  maxTBT_noAntiscalant: number; // deg C — max temp without antiscalant
  maxTBT_withAntiscalant: number; // deg C — max temp with antiscalant

  // Brine properties
  brineConcentration: number; // ppm TDS
  brineCaSO4: number; // mg/L as CaSO4
  brineLSI_at_maxTBT: number; // LSI at the recommended TBT

  // Dominant scaling species at max temperature
  dominantScalant: 'CaSO4' | 'CaCO3' | 'MgOH2' | 'none';

  // Warnings
  warnings: string[];
}

// ============================================================================
// Validation
// ============================================================================

function validateInput(input: FoulingScalingInput): string[] {
  const errors: string[] = [];

  if (input.feedSalinity <= 0 || input.feedSalinity > 200000) {
    errors.push('Feed salinity must be between 0 and 200,000 ppm TDS.');
  }
  if (input.calciumConcentration <= 0) {
    errors.push('Calcium concentration must be greater than 0 mg/L.');
  }
  if (input.sulfateConcentration <= 0) {
    errors.push('Sulfate concentration must be greater than 0 mg/L.');
  }
  if (input.bicarbonateAlkalinity <= 0) {
    errors.push('Bicarbonate alkalinity must be greater than 0 mg/L as CaCO3.');
  }
  if (input.magnesiumConcentration <= 0) {
    errors.push('Magnesium concentration must be greater than 0 mg/L.');
  }
  if (input.pH < 6 || input.pH > 10) {
    errors.push('pH must be between 6.0 and 10.0.');
  }
  if (input.temperatureMin < 20 || input.temperatureMin > 120) {
    errors.push('Minimum temperature must be between 20 and 120 deg C.');
  }
  if (input.temperatureMax < 20 || input.temperatureMax > 120) {
    errors.push('Maximum temperature must be between 20 and 120 deg C.');
  }
  if (input.temperatureMin >= input.temperatureMax) {
    errors.push('Minimum temperature must be less than maximum temperature.');
  }
  if (input.temperatureSteps < 2 || input.temperatureSteps > 50) {
    errors.push('Temperature steps must be between 2 and 50.');
  }
  if (input.concentrationFactor < 1 || input.concentrationFactor > 3) {
    errors.push('Concentration factor must be between 1.0 and 3.0.');
  }
  if (
    input.antiscalantDosed &&
    input.antiscalantEfficiency !== undefined &&
    (input.antiscalantEfficiency < 0 || input.antiscalantEfficiency > 1)
  ) {
    errors.push('Antiscalant efficiency must be between 0 and 1.');
  }

  return errors;
}

// ============================================================================
// Chemistry Warnings
// ============================================================================

function getChemistryWarnings(input: FoulingScalingInput): string[] {
  const warnings: string[] = [];

  if (input.calciumConcentration > 800) {
    warnings.push(
      `Very high calcium concentration (${input.calciumConcentration} mg/L). ` +
        'Standard seawater is ~420 mg/L. Verify feed water analysis.'
    );
  }
  if (input.calciumConcentration < 100) {
    warnings.push(
      `Low calcium concentration (${input.calciumConcentration} mg/L). ` +
        'This may indicate pre-treated or brackish water.'
    );
  }
  if (input.sulfateConcentration > 5000) {
    warnings.push(
      `Very high sulfate concentration (${input.sulfateConcentration} mg/L). ` +
        'Standard seawater is ~2700 mg/L. CaSO4 scaling risk is elevated.'
    );
  }
  if (input.pH < 7.0) {
    warnings.push(
      `Low feed pH (${input.pH}). Acidic conditions reduce CaCO3 scaling ` +
        'but may cause corrosion.'
    );
  }
  if (input.pH > 8.5) {
    warnings.push(
      `Elevated feed pH (${input.pH}). CaCO3 and Mg(OH)2 scaling risk ` + 'is increased.'
    );
  }
  if (input.feedSalinity > 50000) {
    warnings.push(
      `High feed salinity (${input.feedSalinity} ppm). ` +
        'Gulf/Arabian Sea brine rejection operations may need special antiscalant dosing.'
    );
  }
  if (input.concentrationFactor > 2.0) {
    warnings.push(
      `High concentration factor (${input.concentrationFactor}). ` +
        'Brine will be highly concentrated — verify scaling indices carefully.'
    );
  }
  if (input.temperatureMax > 70 && !input.antiscalantDosed) {
    warnings.push(
      'Operating above 70 deg C without antiscalant. CaSO4 scaling is likely. ' +
        'Consider antiscalant dosing or reducing TBT.'
    );
  }

  return warnings;
}

// ============================================================================
// CaSO4 Solubility Model
// ============================================================================

/**
 * Calculate CaSO4 solubility in mg/L as CaSO4 at a given temperature.
 *
 * Uses separate correlations for gypsum (T < 40 deg C) and anhydrite (T >= 40 deg C).
 * Based on El-Dessouky & Ettouney approximations for pure water, then corrected
 * for ionic strength (salinity).
 *
 * @param tempC — temperature in deg C
 * @param tdsPpm — total dissolved solids in ppm
 * @returns CaSO4 solubility in mg/L as CaSO4
 */
export function getCaSO4Solubility(tempC: number, tdsPpm: number): number {
  let solubilityPure: number;

  if (tempC < 40) {
    // Gypsum phase (CaSO4.2H2O)
    solubilityPure = 2090 - 8.8 * tempC + 0.062 * tempC * tempC;
  } else {
    // Anhydrite phase (CaSO4)
    solubilityPure = 2320 - 15.2 * tempC + 0.042 * tempC * tempC;
  }

  // Ionic strength correction: in saline water, solubility increases due to
  // activity coefficient effects (partially offset by common-ion effect).
  // Normalised to standard seawater at 35,000 ppm.
  const salinityCorrection = 1 + 0.3 * (tdsPpm / 35000);

  return Math.max(solubilityPure * salinityCorrection, 10); // floor at 10 mg/L
}

/**
 * Calculate CaSO4 concentration in brine, expressed as mg/L CaSO4.
 *
 * Converts from Ca2+ concentration to CaSO4 equivalent using molar mass ratio.
 */
export function getCaSO4BrineConcentration(
  calciumMgL: number,
  concentrationFactor: number
): number {
  const caBrine = calciumMgL * concentrationFactor;
  // Convert Ca2+ to CaSO4 equivalent: CaSO4/Ca = 136.14/40.08
  return caBrine * (MOLAR_MASS.CaSO4 / MOLAR_MASS.Ca);
}

/**
 * Calculate CaSO4 saturation index.
 *
 * SI > 1.0 means supersaturated (scaling risk).
 */
export function getCaSO4SaturationIndex(
  brineConcentrationCaSO4: number,
  solubilityCaSO4: number
): number {
  if (solubilityCaSO4 <= 0) return Infinity;
  return brineConcentrationCaSO4 / solubilityCaSO4;
}

// ============================================================================
// CaCO3 Langelier Saturation Index (LSI)
// ============================================================================

/**
 * Calculate the Langelier Saturation Index (LSI) at given conditions.
 *
 * LSI = pH_actual - pH_s
 * where pH_s = (9.3 + A + B) - (C + D)
 *
 * @param pH — actual pH
 * @param tdsMgL — TDS in mg/L
 * @param tempC — temperature in deg C
 * @param calciumMgL — calcium in mg/L as Ca2+
 * @param alkalinityMgL — alkalinity in mg/L as CaCO3
 * @returns LSI value (positive = scaling, negative = corrosive)
 */
export function calculateLSI(
  pH: number,
  tdsMgL: number,
  tempC: number,
  calciumMgL: number,
  alkalinityMgL: number
): number {
  // Clamp TDS to avoid log of non-positive
  const tds = Math.max(tdsMgL, 1);
  const tempK = tempC + 273.15;

  // A: ionic strength factor
  const A = (Math.log10(tds) - 1) / 10;

  // B: temperature factor
  const B = -13.12 * Math.log10(tempK) + 34.55;

  // C: calcium hardness factor (convert Ca2+ to mg/L as CaCO3)
  // Ca as CaCO3 = Ca_mg_L * (100.08 / 40.08) = Ca_mg_L * 2.497
  const caAsCaCO3 = Math.max(calciumMgL * 2.497, 1);
  const C = Math.log10(caAsCaCO3) - 0.4;

  // D: alkalinity factor
  const alk = Math.max(alkalinityMgL, 1);
  const D = Math.log10(alk);

  const pHs = 9.3 + A + B - (C + D);
  return round4(pH - pHs);
}

// ============================================================================
// Mg(OH)2 Scaling Risk
// ============================================================================

/**
 * Evaluate Mg(OH)2 precipitation risk.
 *
 * Mg(OH)2 forms at high temperature, high pH, and high Mg concentration.
 * The critical pH decreases as temperature increases.
 */
export function evaluateMgOH2Risk(tempC: number, pH: number, magnesiumBrineMgL: number): boolean {
  // Critical pH for Mg(OH)2 precipitation — lower at higher temperatures
  const pHCritical = 9.0 + 0.02 * (70 - tempC);
  return pH > pHCritical && magnesiumBrineMgL > 500 && tempC > 70;
}

// ============================================================================
// Recommended Fouling Resistance
// ============================================================================

/**
 * Determine recommended fouling resistance (m2.K/W) based on temperature
 * and CaSO4 saturation index.
 */
export function getRecommendedFouling(tempC: number, SI_CaSO4: number): number {
  if (SI_CaSO4 > 1.0) return 0.00025; // heavy fouling expected
  if (SI_CaSO4 > 0.7) return 0.00015; // moderate fouling
  if (tempC > 65) return 0.00012; // high-temp operation
  return 0.00009; // clean service (standard MED)
}

// ============================================================================
// Status Helpers
// ============================================================================

function getCaSO4Status(si: number): 'safe' | 'warning' | 'critical' {
  if (si >= SCALING_THRESHOLDS.CaSO4_CRITICAL) return 'critical';
  if (si >= SCALING_THRESHOLDS.CaSO4_WARNING) return 'warning';
  return 'safe';
}

function getCaCO3Status(lsi: number): 'safe' | 'warning' | 'scaling' {
  if (lsi >= SCALING_THRESHOLDS.LSI_SCALING) return 'scaling';
  if (lsi >= SCALING_THRESHOLDS.LSI_WARNING) return 'warning';
  return 'safe';
}

// ============================================================================
// Max TBT Determination
// ============================================================================

/**
 * Find the maximum allowable Top Brine Temperature by interpolating where the
 * CaSO4 saturation index crosses the threshold.
 *
 * Uses fine 0.1 deg C steps for accuracy.
 */
function findMaxTBT(
  input: FoulingScalingInput,
  siThreshold: number,
  tempMin: number,
  tempMax: number
): number {
  const brineTDS = input.feedSalinity * input.concentrationFactor;
  const brineCaSO4 = getCaSO4BrineConcentration(
    input.calciumConcentration,
    input.concentrationFactor
  );

  // Scan from max down to min in fine steps
  const step = 0.1;
  for (let t = tempMax; t >= tempMin; t -= step) {
    const solubility = getCaSO4Solubility(t, brineTDS);
    const si = getCaSO4SaturationIndex(brineCaSO4, solubility);
    if (si < siThreshold) {
      return round1(t);
    }
  }

  // If even the minimum temperature exceeds threshold, return tempMin
  return tempMin;
}

// ============================================================================
// Rounding Helpers
// ============================================================================

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ============================================================================
// Main Calculator
// ============================================================================

/**
 * Calculate fouling and scaling predictions across a temperature range.
 *
 * @param input — water chemistry, operating conditions, and concentration factor
 * @returns scaling profile, maximum TBT values, and warnings
 */
export function calculateFoulingScaling(input: FoulingScalingInput): FoulingScalingResult {
  // Validate
  const validationErrors = validateInput(input);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid input:\n${validationErrors.join('\n')}`);
  }

  const warnings = getChemistryWarnings(input);

  const antiscalantEfficiency = input.antiscalantDosed
    ? (input.antiscalantEfficiency ?? DEFAULT_ANTISCALANT_EFFICIENCY)
    : 0;

  // Brine properties
  const brineTDS = input.feedSalinity * input.concentrationFactor;
  const brineCaSO4 = getCaSO4BrineConcentration(
    input.calciumConcentration,
    input.concentrationFactor
  );
  const brineCa = input.calciumConcentration * input.concentrationFactor;
  const brineAlk = input.bicarbonateAlkalinity * input.concentrationFactor;
  const brineMg = input.magnesiumConcentration * input.concentrationFactor;

  // Generate temperature steps
  const tempStep = (input.temperatureMax - input.temperatureMin) / (input.temperatureSteps - 1);
  const temperatures: number[] = [];
  for (let i = 0; i < input.temperatureSteps; i++) {
    temperatures.push(round1(input.temperatureMin + i * tempStep));
  }

  // Calculate scaling profile
  const scalingProfile: ScalingPoint[] = temperatures.map((t) => {
    const solubility = getCaSO4Solubility(t, brineTDS);
    const si = getCaSO4SaturationIndex(brineCaSO4, solubility);
    const lsi = calculateLSI(input.pH, brineTDS, t, brineCa, brineAlk);
    const mgRisk = evaluateMgOH2Risk(t, input.pH, brineMg);
    const fouling = getRecommendedFouling(t, si);

    return {
      temperature: t,
      CaSO4_solubility: round2(solubility),
      CaSO4_brineConcentration: round2(brineCaSO4),
      CaSO4_saturationIndex: round4(si),
      CaSO4_status: getCaSO4Status(si),
      LSI: lsi,
      CaCO3_status: getCaCO3Status(lsi),
      MgOH2_risk: mgRisk,
      recommendedFouling: fouling,
    };
  });

  // Max TBT without antiscalant: SI < 0.8 (safety margin)
  const maxTBT_noAntiscalant = findMaxTBT(input, 0.8, input.temperatureMin, input.temperatureMax);

  // Max TBT with antiscalant: antiscalant allows operation at higher SI
  // Threshold = 1.0 * (1 + efficiency * 0.5)
  const antiscalantThreshold = 1.0 * (1 + antiscalantEfficiency * 0.5);
  const maxTBT_withAntiscalant = findMaxTBT(
    input,
    antiscalantThreshold,
    input.temperatureMin,
    input.temperatureMax
  );

  // LSI at the recommended TBT (use the no-antiscalant TBT as the baseline)
  const recommendedTBT = input.antiscalantDosed ? maxTBT_withAntiscalant : maxTBT_noAntiscalant;
  const brineLSI_at_maxTBT = calculateLSI(input.pH, brineTDS, recommendedTBT, brineCa, brineAlk);

  // Determine dominant scalant at the maximum evaluated temperature
  const maxTempPoint = scalingProfile[scalingProfile.length - 1] as ScalingPoint | undefined;
  const dominantScalant = maxTempPoint ? determineDominantScalant(maxTempPoint) : ('none' as const);

  // Add TBT-specific warnings
  if (maxTBT_noAntiscalant <= input.temperatureMin) {
    warnings.push(
      'CaSO4 is supersaturated even at the minimum evaluated temperature. ' +
        'Consider lowering the concentration factor or reducing feed calcium/sulfate.'
    );
  }
  if (brineLSI_at_maxTBT > SCALING_THRESHOLDS.LSI_SCALING) {
    warnings.push(
      `CaCO3 scaling tendency (LSI = ${round2(brineLSI_at_maxTBT)}) at the recommended TBT. ` +
        'Consider acid dosing or CO2 injection to lower pH.'
    );
  }
  if (maxTempPoint && maxTempPoint.MgOH2_risk) {
    warnings.push(
      'Mg(OH)2 precipitation risk at maximum temperature. ' +
        'Occurs above 70 deg C with high pH and high magnesium concentration.'
    );
  }

  return {
    scalingProfile,
    maxTBT_noAntiscalant,
    maxTBT_withAntiscalant,
    brineConcentration: round2(brineTDS),
    brineCaSO4: round2(brineCaSO4),
    brineLSI_at_maxTBT: round4(brineLSI_at_maxTBT),
    dominantScalant,
    warnings,
  };
}

/**
 * Determine which scaling species is the dominant concern at a given point.
 */
function determineDominantScalant(point: ScalingPoint): 'CaSO4' | 'CaCO3' | 'MgOH2' | 'none' {
  // Priority: CaSO4 (most common TBT limiter) > CaCO3 > Mg(OH)2
  if (point.CaSO4_status === 'critical') return 'CaSO4';
  if (point.CaCO3_status === 'scaling') return 'CaCO3';
  if (point.MgOH2_risk) return 'MgOH2';
  if (point.CaSO4_status === 'warning') return 'CaSO4';
  if (point.CaCO3_status === 'warning') return 'CaCO3';
  return 'none';
}
