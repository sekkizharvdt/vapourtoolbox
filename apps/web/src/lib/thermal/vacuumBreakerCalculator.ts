/**
 * Vacuum Breaker Sizing Calculator
 *
 * Three calculation modes for MED thermal desalination plants:
 *
 * 1. MANUAL_VALVE — Size a manually-operated valve to equalize pressure
 *    within a specified time. Uses bisection to find the required orifice area.
 *
 * 2. DIAPHRAGM_ANALYSIS — Given a burst diaphragm DN size, compute the
 *    pressure equalization profile, total time, and peak pressure rise rate.
 *
 * 3. DIAPHRAGM_DESIGN — Given a maximum allowable pressure rise rate
 *    (to protect tubes with rubber grommets from mechanical disturbance),
 *    find the largest diaphragm that stays within the limit.
 *
 * All modes use isentropic compressible flow theory with 500-step
 * time-stepping integration (choked → subsonic transition).
 *
 * Reference: HEI Tech Sheet #131, HEI 2629, ISO 9300.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ratio of specific heats for air */
const GAMMA = 1.4;

/** Specific gas constant for air (J/(kg·K)) */
const R_AIR = 287.058;

/** Standard atmospheric pressure (Pa) */
const P_ATM = 101325;

/** Critical pressure ratio for air — choked flow below this ratio */
const CRITICAL_RATIO = Math.pow(2 / (GAMMA + 1), GAMMA / (GAMMA - 1)); // ≈ 0.528

/** Cd for a burst diaphragm (sharp-edged orifice) */
const DIAPHRAGM_CD = 0.6;

/** Choked mass flux: P1 × sqrt(γ/(R·T1)) × [2/(γ+1)]^((γ+1)/(2(γ-1))) */
function chokedMassFlux(P1: number, T1: number): number {
  const term = Math.pow(2 / (GAMMA + 1), (GAMMA + 1) / (2 * (GAMMA - 1)));
  return P1 * term * Math.sqrt(GAMMA / (R_AIR * T1));
}

/** Subsonic mass flux through orifice at a given pressure ratio P2/P1 */
function subsonicMassFlux(P1: number, T1: number, pressureRatio: number): number {
  const r = pressureRatio;
  const term1 = Math.pow(r, 2 / GAMMA);
  const term2 = Math.pow(r, (GAMMA + 1) / GAMMA);
  const bracket = ((2 * GAMMA) / (GAMMA - 1)) * (term1 - term2);
  return P1 * Math.sqrt(bracket / (R_AIR * T1));
}

// ---------------------------------------------------------------------------
// Standard DN sizes
// ---------------------------------------------------------------------------

export interface DNValveSize {
  dn: number;
  nps: string;
  boreArea: number; // cm²
}

export const STANDARD_DN_SIZES: DNValveSize[] = [
  { dn: 15, nps: '1/2"', boreArea: 1.77 },
  { dn: 20, nps: '3/4"', boreArea: 3.14 },
  { dn: 25, nps: '1"', boreArea: 4.91 },
  { dn: 32, nps: '1-1/4"', boreArea: 8.04 },
  { dn: 40, nps: '1-1/2"', boreArea: 12.57 },
  { dn: 50, nps: '2"', boreArea: 19.63 },
  { dn: 65, nps: '2-1/2"', boreArea: 33.18 },
  { dn: 80, nps: '3"', boreArea: 50.27 },
  { dn: 100, nps: '4"', boreArea: 78.54 },
  { dn: 125, nps: '5"', boreArea: 122.72 },
  { dn: 150, nps: '6"', boreArea: 176.71 },
  { dn: 200, nps: '8"', boreArea: 314.16 },
  { dn: 250, nps: '10"', boreArea: 490.87 },
  { dn: 300, nps: '12"', boreArea: 706.86 },
  { dn: 350, nps: '14"', boreArea: 962.11 },
  { dn: 400, nps: '16"', boreArea: 1256.64 },
  { dn: 450, nps: '18"', boreArea: 1590.43 },
  { dn: 500, nps: '20"', boreArea: 1963.5 },
  { dn: 600, nps: '24"', boreArea: 2827.43 },
];

// ---------------------------------------------------------------------------
// Valve type presets (for MANUAL_VALVE mode)
// ---------------------------------------------------------------------------

export type ValveType = 'GLOBE' | 'BUTTERFLY' | 'BALL' | 'SHARP_ORIFICE';

export const VALVE_TYPE_LABELS: Record<ValveType, string> = {
  GLOBE: 'Globe Valve',
  BUTTERFLY: 'Butterfly Valve',
  BALL: 'Ball Valve',
  SHARP_ORIFICE: 'Sharp-edged Orifice',
};

export const VALVE_CD: Record<ValveType, number> = {
  GLOBE: 0.65,
  BUTTERFLY: 0.8,
  BALL: 0.85,
  SHARP_ORIFICE: 0.6,
};

// ---------------------------------------------------------------------------
// Calculation mode
// ---------------------------------------------------------------------------

export type CalculationMode = 'MANUAL_VALVE' | 'DIAPHRAGM_ANALYSIS' | 'DIAPHRAGM_DESIGN';

export const MODE_LABELS: Record<CalculationMode, string> = {
  MANUAL_VALVE: 'Manual Valve — Size for Target Time',
  DIAPHRAGM_ANALYSIS: 'Burst Diaphragm — Analyse Given Size',
  DIAPHRAGM_DESIGN: 'Burst Diaphragm — Design for Max Rise Rate',
};

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface TimeStep {
  time: number; // seconds
  pressure: number; // mbar abs
  massFlowRate: number; // kg/s
  pressureRiseRate: number; // mbar/s
  regime: 'choked' | 'subsonic';
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

interface BaseInput {
  totalVolume: number; // m³
  numberOfBreakers: number;
  operatingPressureMbar: number; // lowest operating vacuum pressure (mbar abs)
  ambientTemperature: number; // °C
}

export interface ManualValveInput extends BaseInput {
  mode: 'MANUAL_VALVE';
  equalizationTimeMin: number;
  valveType: ValveType;
}

export interface DiaphragmAnalysisInput extends BaseInput {
  mode: 'DIAPHRAGM_ANALYSIS';
  burstPressureMbar: number; // burst pressure (mbar abs)
  selectedDN: number; // user-selected DN size (mm)
}

export interface DiaphragmDesignInput extends BaseInput {
  mode: 'DIAPHRAGM_DESIGN';
  burstPressureMbar: number;
  maxPressureRiseRate: number; // mbar/s — limit to protect tubes
}

export type VacuumBreakerInput = ManualValveInput | DiaphragmAnalysisInput | DiaphragmDesignInput;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

interface BaseResult {
  mode: CalculationMode;
  volumePerBreaker: number; // m³
  airMassRequired: number; // kg
  numberOfBreakers: number;
  dischargeCoefficient: number;
  criticalPressureRatio: number;
  transitionPressureMbar: number;
  chokedFluxPerCd: number; // kg/(s·m²)
  selectedValve: DNValveSize;
  pressureProfile: TimeStep[];
  equalizationTimeSec: number; // actual time to reach ~99% atmospheric
  peakPressureRiseRate: number; // mbar/s — max dP/dt in the profile
  warnings: string[];
}

export interface ManualValveResult extends BaseResult {
  mode: 'MANUAL_VALVE';
  requiredOrificeArea: number; // cm²
  requiredOrificeDiameter: number; // mm
  averageMassFlowRate: number; // kg/s
  targetEqualizationTimeMin: number;
}

export interface DiaphragmAnalysisResult extends BaseResult {
  mode: 'DIAPHRAGM_ANALYSIS';
  burstPressureMbar: number;
}

export interface DiaphragmDesignResult extends BaseResult {
  mode: 'DIAPHRAGM_DESIGN';
  burstPressureMbar: number;
  maxAllowedRiseRate: number; // mbar/s (the constraint)
}

export type VacuumBreakerResult =
  | ManualValveResult
  | DiaphragmAnalysisResult
  | DiaphragmDesignResult;

// ---------------------------------------------------------------------------
// Simulation engine (shared across all modes)
// ---------------------------------------------------------------------------

const NUM_STEPS = 500;

interface SimResult {
  finalPressure: number;
  profile: TimeStep[];
  equalizationTimeSec: number;
  peakRiseRate: number;
}

function simulate(
  areaM2: number,
  Cd: number,
  P2_initial: number, // Pa
  P1: number, // Pa
  T1: number, // K
  volumePerBreaker: number,
  totalTimeSec: number
): SimResult {
  const dt = totalTimeSec / NUM_STEPS;
  const targetPressure = P1 * 0.99;
  let P2 = P2_initial;
  let equalizationTimeSec = totalTimeSec;
  let equalized = false;
  let peakRiseRate = 0;
  const profile: TimeStep[] = [];

  for (let i = 0; i <= NUM_STEPS; i++) {
    const t = i * dt;
    const ratio = P2 / P1;
    let massFlux: number;
    let regime: 'choked' | 'subsonic';

    if (ratio <= CRITICAL_RATIO) {
      massFlux = chokedMassFlux(P1, T1);
      regime = 'choked';
    } else {
      massFlux = subsonicMassFlux(P1, T1, ratio);
      regime = 'subsonic';
    }

    const mdot = Cd * areaM2 * massFlux;
    const riseRate = (mdot * R_AIR * T1) / (volumePerBreaker * 100); // mbar/s

    if (riseRate > peakRiseRate) peakRiseRate = riseRate;

    // Record every 10th step (≈50 points) + first and last
    if (i % 10 === 0 || i === NUM_STEPS) {
      profile.push({
        time: Math.round(t * 10) / 10,
        pressure: Math.round((P2 / 100) * 100) / 100, // Pa → mbar
        massFlowRate: Math.round(mdot * 10000) / 10000,
        pressureRiseRate: Math.round(riseRate * 1000) / 1000,
        regime,
      });
    }

    if (!equalized && P2 >= targetPressure) {
      equalizationTimeSec = t;
      equalized = true;
    }

    if (i < NUM_STEPS) {
      const dP = (mdot * R_AIR * T1 * dt) / volumePerBreaker;
      P2 = Math.min(P2 + dP, P1);
    }
  }

  return { finalPressure: P2, profile, equalizationTimeSec, peakRiseRate };
}

// ---------------------------------------------------------------------------
// Shared validation & derived values
// ---------------------------------------------------------------------------

function validateBase(input: BaseInput) {
  if (input.totalVolume <= 0) throw new Error('Total volume must be positive');
  if (input.numberOfBreakers < 1) throw new Error('Number of breakers must be at least 1');
  if (input.operatingPressureMbar <= 0) throw new Error('Operating pressure must be positive');
  if (input.operatingPressureMbar >= 1013.25)
    throw new Error('Operating pressure must be below atmospheric (1013.25 mbar)');
  if (input.ambientTemperature < -20 || input.ambientTemperature > 60)
    throw new Error('Ambient temperature must be between -20°C and 60°C');
}

function deriveBase(input: BaseInput) {
  const volumePerBreaker = input.totalVolume / input.numberOfBreakers;
  const T1 = input.ambientTemperature + 273.15;
  const P1 = P_ATM;
  const P2_initial = input.operatingPressureMbar * 100; // mbar → Pa
  const airMassRequired = ((P1 - P2_initial) * volumePerBreaker) / (R_AIR * T1);
  const transitionPressureMbar = Math.round(CRITICAL_RATIO * P1) / 100; // Pa → mbar
  const chokedFlux = chokedMassFlux(P1, T1);
  return {
    volumePerBreaker,
    T1,
    P1,
    P2_initial,
    airMassRequired,
    transitionPressureMbar,
    chokedFlux,
  };
}

function selectDN(requiredAreaCm2: number): DNValveSize {
  const largestDN = STANDARD_DN_SIZES[STANDARD_DN_SIZES.length - 1]!;
  return STANDARD_DN_SIZES.find((v) => v.boreArea >= requiredAreaCm2) ?? largestDN;
}

function tubeWarning(peakRate: number): string | null {
  if (peakRate > 50) {
    return `Peak pressure rise rate (${peakRate.toFixed(1)} mbar/s) is very high. Risk of mechanical disturbance to tubes with rubber grommets.`;
  }
  if (peakRate > 10) {
    return `Peak pressure rise rate (${peakRate.toFixed(1)} mbar/s) is elevated. Verify tube retention is adequate for this rate.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Mode 1: MANUAL_VALVE
// ---------------------------------------------------------------------------

function calculateManualValve(input: ManualValveInput): ManualValveResult {
  validateBase(input);
  if (input.equalizationTimeMin <= 0) throw new Error('Equalization time must be positive');

  const Cd = VALVE_CD[input.valveType];
  const {
    volumePerBreaker,
    T1,
    P1,
    P2_initial,
    airMassRequired,
    transitionPressureMbar,
    chokedFlux,
  } = deriveBase(input);
  const equalizationTimeSec = input.equalizationTimeMin * 60;
  const targetPressure = P1 * 0.99;
  const warnings: string[] = [];

  // Bisection to find required area
  let areaLow = 1e-8;
  let areaHigh = 10.0;

  const testMax = simulate(areaHigh, Cd, P2_initial, P1, T1, volumePerBreaker, equalizationTimeSec);
  if (testMax.finalPressure < targetPressure) {
    throw new Error('Cannot find suitable area — check inputs');
  }

  for (let iter = 0; iter < 50; iter++) {
    const areaMid = (areaLow + areaHigh) / 2;
    const result = simulate(areaMid, Cd, P2_initial, P1, T1, volumePerBreaker, equalizationTimeSec);
    if (result.finalPressure >= targetPressure) {
      areaHigh = areaMid;
    } else {
      areaLow = areaMid;
    }
  }

  const requiredAreaM2 = areaHigh;
  const requiredAreaCm2 = Math.round(requiredAreaM2 * 1e4 * 100) / 100;
  const requiredDiameterMm = Math.round(Math.sqrt((4 * requiredAreaM2) / Math.PI) * 1000 * 10) / 10;

  const selectedValve = selectDN(requiredAreaCm2);
  const largestDN = STANDARD_DN_SIZES[STANDARD_DN_SIZES.length - 1]!;
  if (requiredAreaCm2 > largestDN.boreArea) {
    warnings.push(
      `Required orifice area (${requiredAreaCm2} cm²) exceeds DN ${largestDN.dn}. Consider more breakers or longer time.`
    );
  }

  // Final profile with actual valve bore
  const actualAreaM2 = selectedValve.boreArea / 1e4;
  const finalSim = simulate(
    actualAreaM2,
    Cd,
    P2_initial,
    P1,
    T1,
    volumePerBreaker,
    equalizationTimeSec
  );

  if (input.operatingPressureMbar < 50) {
    warnings.push('Very deep vacuum (< 50 mbar abs). Ensure vessel is rated for full vacuum.');
  }
  if (input.equalizationTimeMin > 120) {
    warnings.push('Equalization time exceeds 2 hours. Verify this is acceptable.');
  }
  const tw = tubeWarning(finalSim.peakRiseRate);
  if (tw) warnings.push(tw);

  return {
    mode: 'MANUAL_VALVE',
    volumePerBreaker: Math.round(volumePerBreaker * 100) / 100,
    airMassRequired: Math.round(airMassRequired * 1000) / 1000,
    numberOfBreakers: input.numberOfBreakers,
    dischargeCoefficient: Cd,
    criticalPressureRatio: Math.round(CRITICAL_RATIO * 1000) / 1000,
    transitionPressureMbar,
    chokedFluxPerCd: Math.round(chokedFlux * 100) / 100,
    selectedValve,
    pressureProfile: finalSim.profile,
    equalizationTimeSec: Math.round(finalSim.equalizationTimeSec * 10) / 10,
    peakPressureRiseRate: Math.round(finalSim.peakRiseRate * 1000) / 1000,
    requiredOrificeArea: requiredAreaCm2,
    requiredOrificeDiameter: requiredDiameterMm,
    averageMassFlowRate: Math.round((airMassRequired / equalizationTimeSec) * 10000) / 10000,
    targetEqualizationTimeMin: input.equalizationTimeMin,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Mode 2: DIAPHRAGM_ANALYSIS
// ---------------------------------------------------------------------------

function calculateDiaphragmAnalysis(input: DiaphragmAnalysisInput): DiaphragmAnalysisResult {
  validateBase(input);
  if (input.burstPressureMbar <= 0) throw new Error('Burst pressure must be positive');
  if (input.burstPressureMbar >= 1013.25)
    throw new Error('Burst pressure must be below atmospheric (1013.25 mbar)');

  const Cd = DIAPHRAGM_CD;
  const { volumePerBreaker, T1, P1, airMassRequired, transitionPressureMbar, chokedFlux } =
    deriveBase(input);
  const P2_burst = input.burstPressureMbar * 100; // mbar → Pa
  const warnings: string[] = [];

  // Find the selected DN size from user input
  const selectedValve = STANDARD_DN_SIZES.find((v) => v.dn === input.selectedDN);
  if (!selectedValve) throw new Error(`DN ${input.selectedDN} is not a standard size`);

  const areaM2 = selectedValve.boreArea / 1e4;

  // Simulate for a generous total time and find when equalization happens
  // Start with 2 hours, if not enough double until it works
  let totalTimeSec = 7200;
  let sim = simulate(areaM2, Cd, P2_burst, P1, T1, volumePerBreaker, totalTimeSec);
  while (sim.finalPressure < P1 * 0.99 && totalTimeSec < 86400) {
    totalTimeSec *= 2;
    sim = simulate(areaM2, Cd, P2_burst, P1, T1, volumePerBreaker, totalTimeSec);
  }

  if (input.operatingPressureMbar < 50) {
    warnings.push('Very deep vacuum (< 50 mbar abs). Ensure vessel is rated for full vacuum.');
  }
  if (input.burstPressureMbar >= input.operatingPressureMbar) {
    warnings.push(
      `Burst pressure (${input.burstPressureMbar} mbar) is at or above operating vacuum (${input.operatingPressureMbar} mbar). Diaphragm will burst during normal operation.`
    );
  }
  const tw = tubeWarning(sim.peakRiseRate);
  if (tw) warnings.push(tw);

  return {
    mode: 'DIAPHRAGM_ANALYSIS',
    volumePerBreaker: Math.round(volumePerBreaker * 100) / 100,
    airMassRequired: Math.round(airMassRequired * 1000) / 1000,
    numberOfBreakers: input.numberOfBreakers,
    dischargeCoefficient: Cd,
    criticalPressureRatio: Math.round(CRITICAL_RATIO * 1000) / 1000,
    transitionPressureMbar,
    chokedFluxPerCd: Math.round(chokedFlux * 100) / 100,
    selectedValve,
    pressureProfile: sim.profile,
    equalizationTimeSec: Math.round(sim.equalizationTimeSec * 10) / 10,
    peakPressureRiseRate: Math.round(sim.peakRiseRate * 1000) / 1000,
    burstPressureMbar: input.burstPressureMbar,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Mode 3: DIAPHRAGM_DESIGN
// ---------------------------------------------------------------------------

function calculateDiaphragmDesign(input: DiaphragmDesignInput): DiaphragmDesignResult {
  validateBase(input);
  if (input.burstPressureMbar <= 0) throw new Error('Burst pressure must be positive');
  if (input.burstPressureMbar >= 1013.25)
    throw new Error('Burst pressure must be below atmospheric (1013.25 mbar)');
  if (input.maxPressureRiseRate <= 0) throw new Error('Max pressure rise rate must be positive');

  const Cd = DIAPHRAGM_CD;
  const { volumePerBreaker, T1, P1, airMassRequired, transitionPressureMbar, chokedFlux } =
    deriveBase(input);
  const P2_burst = input.burstPressureMbar * 100;
  const warnings: string[] = [];

  // The peak rise rate occurs at the start (choked flow, maximum ΔP).
  // dP/dt = Cd × A × massFlux × R × T / V (in Pa/s), convert to mbar/s.
  // For choked flow: massFlux = chokedMassFlux(P1, T1)
  // So: peakRate_mbar = Cd × A × chokedFlux × R_AIR × T1 / (V × 100)
  // Solve for A: A = maxRate × V × 100 / (Cd × chokedFlux × R_AIR × T1)

  const maxRatePaPerS = input.maxPressureRiseRate * 100; // mbar/s → Pa/s
  const requiredAreaM2 =
    (maxRatePaPerS * volumePerBreaker) / (Cd * chokedMassFlux(P1, T1) * R_AIR * T1);
  const requiredAreaCm2 = Math.round(requiredAreaM2 * 1e4 * 100) / 100;

  // Find the largest DN that doesn't exceed the required area
  let selectedValve: DNValveSize | undefined;
  for (let i = STANDARD_DN_SIZES.length - 1; i >= 0; i--) {
    if (STANDARD_DN_SIZES[i]!.boreArea <= requiredAreaCm2) {
      selectedValve = STANDARD_DN_SIZES[i]!;
      break;
    }
  }
  if (!selectedValve) {
    selectedValve = STANDARD_DN_SIZES[0]!;
    warnings.push(
      `Even the smallest DN (${selectedValve.dn}) exceeds the max rise rate. Consider increasing volume or relaxing the constraint.`
    );
  }

  // Simulate with actual valve
  const areaM2 = selectedValve.boreArea / 1e4;
  let totalTimeSec = 7200;
  let sim = simulate(areaM2, Cd, P2_burst, P1, T1, volumePerBreaker, totalTimeSec);
  while (sim.finalPressure < P1 * 0.99 && totalTimeSec < 86400) {
    totalTimeSec *= 2;
    sim = simulate(areaM2, Cd, P2_burst, P1, T1, volumePerBreaker, totalTimeSec);
  }

  if (input.operatingPressureMbar < 50) {
    warnings.push('Very deep vacuum (< 50 mbar abs). Ensure vessel is rated for full vacuum.');
  }
  if (input.burstPressureMbar >= input.operatingPressureMbar) {
    warnings.push(
      `Burst pressure (${input.burstPressureMbar} mbar) is at or above operating vacuum (${input.operatingPressureMbar} mbar). Diaphragm will burst during normal operation.`
    );
  }
  const tw = tubeWarning(sim.peakRiseRate);
  if (tw) warnings.push(tw);

  return {
    mode: 'DIAPHRAGM_DESIGN',
    volumePerBreaker: Math.round(volumePerBreaker * 100) / 100,
    airMassRequired: Math.round(airMassRequired * 1000) / 1000,
    numberOfBreakers: input.numberOfBreakers,
    dischargeCoefficient: Cd,
    criticalPressureRatio: Math.round(CRITICAL_RATIO * 1000) / 1000,
    transitionPressureMbar,
    chokedFluxPerCd: Math.round(chokedFlux * 100) / 100,
    selectedValve,
    pressureProfile: sim.profile,
    equalizationTimeSec: Math.round(sim.equalizationTimeSec * 10) / 10,
    peakPressureRiseRate: Math.round(sim.peakRiseRate * 1000) / 1000,
    burstPressureMbar: input.burstPressureMbar,
    maxAllowedRiseRate: input.maxPressureRiseRate,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function calculateVacuumBreaker(input: VacuumBreakerInput): VacuumBreakerResult {
  switch (input.mode) {
    case 'MANUAL_VALVE':
      return calculateManualValve(input);
    case 'DIAPHRAGM_ANALYSIS':
      return calculateDiaphragmAnalysis(input);
    case 'DIAPHRAGM_DESIGN':
      return calculateDiaphragmDesign(input);
  }
}
