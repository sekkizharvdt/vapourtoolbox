/**
 * Vacuum Breaker Sizing Calculator
 *
 * Sizes vacuum breaker valves for MED thermal desalination plants using
 * compressible flow theory based on the HEI Standards for Steam Surface
 * Condensers approach (HEI Tech Sheet #131 / HEI 2629).
 *
 * Methodology:
 * 1. Calculate the mass of air required to equalize pressure from operating
 *    vacuum to atmospheric pressure within the vessel volume.
 * 2. Determine the required mass flow rate based on the equalization time.
 * 3. Use isentropic compressible flow equations (choked and subsonic) to
 *    size the orifice area.
 * 4. A time-stepping integration is used for accuracy since the downstream
 *    pressure rises as air enters, transitioning from choked to subsonic flow.
 * 5. Select the next standard DN valve size.
 *
 * Reference: HEI Standards for Steam Surface Condensers, Isentropic
 * compressible flow through orifices (ISO 9300).
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

/** Choked flow function constant: sqrt(gamma/R) × (2/(gamma+1))^((gamma+1)/(2(gamma-1))) */
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
// Standard DN valve sizes with orifice areas
// ---------------------------------------------------------------------------

export interface DNValveSize {
  dn: number; // Nominal diameter (mm)
  nps: string; // Nominal pipe size (inches)
  boreArea: number; // Bore area (cm²)
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
// Discharge coefficient presets
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
// Input / Output Types
// ---------------------------------------------------------------------------

export interface VacuumBreakerInput {
  /** Total volume of all effects (m³) */
  totalVolume: number;
  /** Number of vacuum breakers (volume is split equally) */
  numberOfBreakers: number;
  /** Operating vacuum pressure (kPa absolute) */
  operatingPressureKPa: number;
  /** Allowable pressure equalization time (minutes) */
  equalizationTimeMin: number;
  /** Ambient air temperature (°C) */
  ambientTemperature: number;
  /** Valve type (determines Cd) */
  valveType: ValveType;
  /** Custom discharge coefficient (overrides valve type if provided) */
  customCd?: number;
}

export interface TimeStep {
  /** Time (seconds) */
  time: number;
  /** Vessel pressure (kPa abs) */
  pressure: number;
  /** Instantaneous mass flow rate (kg/s) */
  massFlowRate: number;
  /** Flow regime at this step */
  regime: 'choked' | 'subsonic';
}

export interface VacuumBreakerResult {
  /** Volume per breaker (m³) */
  volumePerBreaker: number;
  /** Total air mass required per breaker (kg) */
  airMassRequired: number;
  /** Average mass flow rate per breaker (kg/s) */
  averageMassFlowRate: number;
  /** Required orifice area per breaker (cm²) */
  requiredOrificeArea: number;
  /** Required orifice diameter (mm) */
  requiredOrificeDiameter: number;
  /** Selected DN valve size */
  selectedValve: DNValveSize;
  /** Discharge coefficient used */
  dischargeCoefficient: number;
  /** Operating pressure (kPa abs) */
  operatingPressureKPa: number;
  /** Equalization time (minutes) */
  equalizationTimeMin: number;
  /** Number of breakers */
  numberOfBreakers: number;
  /** Critical pressure ratio */
  criticalPressureRatio: number;
  /** Pressure at which flow transitions from choked to subsonic (kPa abs) */
  transitionPressureKPa: number;
  /** Choked mass flux at atmospheric conditions (kg/(s·m²)) per unit Cd */
  chokedFluxPerCd: number;
  /** Pressure equalization profile (time-stepping) */
  pressureProfile: TimeStep[];
  /** Warnings */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

export function calculateVacuumBreaker(input: VacuumBreakerInput): VacuumBreakerResult {
  const {
    totalVolume,
    numberOfBreakers,
    operatingPressureKPa,
    equalizationTimeMin,
    ambientTemperature,
    valveType,
    customCd,
  } = input;

  const warnings: string[] = [];

  // Validate inputs
  if (totalVolume <= 0) throw new Error('Total volume must be positive');
  if (numberOfBreakers < 1) throw new Error('Number of breakers must be at least 1');
  if (operatingPressureKPa <= 0) throw new Error('Operating pressure must be positive');
  if (operatingPressureKPa >= 101.325)
    throw new Error('Operating pressure must be below atmospheric (101.325 kPa)');
  if (equalizationTimeMin <= 0) throw new Error('Equalization time must be positive');
  if (ambientTemperature < -20 || ambientTemperature > 60) {
    throw new Error('Ambient temperature must be between -20°C and 60°C');
  }

  const Cd = customCd ?? VALVE_CD[valveType];
  if (Cd <= 0 || Cd > 1) throw new Error('Discharge coefficient must be between 0 and 1');

  const volumePerBreaker = totalVolume / numberOfBreakers;
  const T1 = ambientTemperature + 273.15; // K
  const P1 = P_ATM; // Pa (atmospheric — upstream)
  const P2_initial = operatingPressureKPa * 1000; // Pa (vessel — downstream)
  const equalizationTimeSec = equalizationTimeMin * 60;

  // Total air mass to fill one breaker's volume from vacuum to atmospheric
  const airMassRequired = ((P1 - P2_initial) * volumePerBreaker) / (R_AIR * T1);
  const averageMassFlowRate = airMassRequired / equalizationTimeSec;

  // Critical pressure ratio and transition pressure
  const transitionPressurePa = CRITICAL_RATIO * P1;
  const transitionPressureKPa = transitionPressurePa / 1000;

  // Choked mass flux (per unit area, per unit Cd)
  const chokedFlux = chokedMassFlux(P1, T1);

  // Time-stepping integration to find required area
  // We iterate: guess area → simulate pressure rise → check if equalization
  // happens within the required time. Use bisection.

  const NUM_STEPS = 500;
  const dt = equalizationTimeSec / NUM_STEPS;
  const targetPressure = P1 * 0.99; // 99% of atmospheric = considered equalized

  // Function to simulate pressure equalization for a given area
  function simulate(area: number): { finalPressure: number; profile: TimeStep[] } {
    let P2 = P2_initial;
    const profile: TimeStep[] = [];

    for (let i = 0; i <= NUM_STEPS; i++) {
      const t = i * dt;
      const ratio = P2 / P1;
      let massFlux: number;
      let regime: 'choked' | 'subsonic';

      if (ratio <= CRITICAL_RATIO) {
        // Choked flow
        massFlux = chokedMassFlux(P1, T1);
        regime = 'choked';
      } else {
        // Subsonic flow
        massFlux = subsonicMassFlux(P1, T1, ratio);
        regime = 'subsonic';
      }

      const mdot = Cd * area * massFlux;

      // Record every 10th step for the profile (50 points)
      if (i % 10 === 0 || i === NUM_STEPS) {
        profile.push({
          time: Math.round(t * 10) / 10,
          pressure: Math.round((P2 / 1000) * 100) / 100, // kPa
          massFlowRate: Math.round(mdot * 10000) / 10000,
          regime,
        });
      }

      if (i < NUM_STEPS) {
        // Pressure rise: dP = mdot * R * T / V * dt
        const dP = (mdot * R_AIR * T1 * dt) / volumePerBreaker;
        P2 = Math.min(P2 + dP, P1);
      }
    }

    return { finalPressure: P2, profile };
  }

  // Bisection to find the required area
  let areaLow = 1e-8; // m² (very small)
  let areaHigh = 10.0; // m² (very large)

  // First check if even the maximum area is insufficient (shouldn't happen)
  const testMax = simulate(areaHigh);
  if (testMax.finalPressure < targetPressure) {
    throw new Error('Cannot find suitable area — check inputs');
  }

  // Bisection — 50 iterations gives precision of ~10^-15 * initial range
  for (let iter = 0; iter < 50; iter++) {
    const areaMid = (areaLow + areaHigh) / 2;
    const result = simulate(areaMid);
    if (result.finalPressure >= targetPressure) {
      areaHigh = areaMid;
    } else {
      areaLow = areaMid;
    }
  }

  const requiredAreaM2 = areaHigh;
  const requiredAreaCm2 = Math.round(requiredAreaM2 * 1e4 * 100) / 100; // m² to cm², 2 dp
  const requiredDiameterMm = Math.round(Math.sqrt((4 * requiredAreaM2) / Math.PI) * 1000 * 10) / 10;

  // Select the next standard DN valve size
  // In the simulation: mdot = Cd * A * massFlux, so A is the geometric area.
  // requiredAreaM2 is the geometric area. Valve bore area should be >= requiredAreaCm2.
  const largestDN = STANDARD_DN_SIZES[STANDARD_DN_SIZES.length - 1]!;
  const selectedValve: DNValveSize =
    STANDARD_DN_SIZES.find((v) => v.boreArea >= requiredAreaCm2) ?? largestDN;

  if (requiredAreaCm2 > largestDN.boreArea) {
    warnings.push(
      `Required orifice area (${requiredAreaCm2} cm²) exceeds the largest standard DN size (DN ${largestDN.dn}). Consider using multiple smaller valves or increasing equalization time.`
    );
  }

  // Generate the final pressure profile with the selected valve's actual bore area
  const actualAreaM2 = selectedValve.boreArea / 1e4; // cm² to m²
  const finalSim = simulate(actualAreaM2);

  // Add warnings for specific conditions
  if (operatingPressureKPa < 5) {
    warnings.push('Very deep vacuum (< 5 kPa abs). Ensure vessel is rated for full vacuum.');
  }
  if (equalizationTimeMin > 120) {
    warnings.push(
      'Equalization time exceeds 2 hours. Verify this is acceptable for the application.'
    );
  }

  return {
    volumePerBreaker: Math.round(volumePerBreaker * 100) / 100,
    airMassRequired: Math.round(airMassRequired * 1000) / 1000,
    averageMassFlowRate: Math.round(averageMassFlowRate * 10000) / 10000,
    requiredOrificeArea: requiredAreaCm2,
    requiredOrificeDiameter: requiredDiameterMm,
    selectedValve,
    dischargeCoefficient: Cd,
    operatingPressureKPa,
    equalizationTimeMin,
    numberOfBreakers,
    criticalPressureRatio: Math.round(CRITICAL_RATIO * 1000) / 1000,
    transitionPressureKPa: Math.round(transitionPressureKPa * 100) / 100,
    chokedFluxPerCd: Math.round(chokedFlux * 100) / 100,
    pressureProfile: finalSim.profile,
    warnings,
  };
}
