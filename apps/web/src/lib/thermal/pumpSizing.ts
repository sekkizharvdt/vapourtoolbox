/**
 * Pump Sizing Calculator
 *
 * Calculate total differential head, hydraulic power, and brake power
 * for centrifugal pump sizing.
 *
 * Equations:
 * - TDH = static_head + discharge_pressure_head - suction_pressure_head + friction_losses
 * - Hydraulic Power: P = Q × ρ × g × H
 * - Brake Power: BHP = Hydraulic Power / η_pump
 * - Motor Power: Motor = BHP / η_motor
 *
 * Reference: Hydraulic Institute Standards, Pump Handbook (Karassik)
 */

import { GRAVITY, barToHead, tonHrToM3S } from './thermalUtils';

// ============================================================================
// Types
// ============================================================================

/** Input parameters for pump sizing calculation */
export interface PumpSizingInput {
  /** Mass flow rate in ton/hr */
  flowRate: number;
  /** Fluid density in kg/m³ */
  fluidDensity: number;
  /** Suction piping friction loss in bar */
  suctionPressureDrop: number;
  /** Discharge piping friction loss in bar */
  dischargePressureDrop: number;
  /** Static head (elevation difference: discharge - suction) in m */
  staticHead: number;
  /** Discharge vessel pressure in bar abs */
  dischargeVesselPressure: number;
  /** Suction vessel pressure in bar abs */
  suctionVesselPressure: number;
  /** Pump efficiency (0-1, default 0.7) */
  pumpEfficiency?: number;
  /** Motor efficiency (0-1, default 0.95) */
  motorEfficiency?: number;
}

/** Result of pump sizing calculation */
export interface PumpSizingResult {
  /** Total differential head in m */
  totalDifferentialHead: number;
  /** Hydraulic power in kW */
  hydraulicPower: number;
  /** Brake power (shaft power) in kW */
  brakePower: number;
  /** Motor input power in kW */
  motorPower: number;
  /** Recommended standard motor size in kW */
  recommendedMotorKW: number;
  /** Velocity head component in m */
  velocityHead: number;
  /** Total differential pressure in bar */
  differentialPressure: number;
  /** Volumetric flow rate in m³/hr */
  volumetricFlowM3Hr: number;
  /** Pump efficiency used */
  pumpEfficiency: number;
  /** Motor efficiency used */
  motorEfficiency: number;
  /** Head breakdown */
  headBreakdown: {
    /** Static head in m */
    staticHead: number;
    /** Discharge pressure head in m */
    dischargePressureHead: number;
    /** Suction pressure head in m */
    suctionPressureHead: number;
    /** Discharge friction head in m */
    dischargeFrictionHead: number;
    /** Suction friction head in m */
    suctionFrictionHead: number;
  };
  /** Warnings */
  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Standard motor sizes (kW) per IEC 60034-1
 */
export const STANDARD_MOTOR_SIZES_KW: number[] = [
  0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3.0, 4.0, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90,
  110, 132, 160, 200, 250, 315, 355, 400, 450, 500, 560, 630, 710, 800, 900, 1000,
];

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate hydraulic power
 *
 * P = Q × ρ × g × H / 1000
 *
 * @param flowM3S - Volumetric flow rate in m³/s
 * @param density - Fluid density in kg/m³
 * @param head - Total differential head in m
 * @returns Hydraulic power in kW
 */
export function calculateHydraulicPower(flowM3S: number, density: number, head: number): number {
  return (flowM3S * density * GRAVITY * head) / 1000;
}

/**
 * Calculate brake power (shaft power)
 *
 * BHP = Hydraulic Power / η_pump
 *
 * @param hydraulicPower - Hydraulic power in kW
 * @param pumpEfficiency - Pump efficiency (0-1)
 * @returns Brake power in kW
 */
export function calculateBrakePower(hydraulicPower: number, pumpEfficiency: number): number {
  return hydraulicPower / pumpEfficiency;
}

/**
 * Select next standard motor size above required power
 *
 * @param requiredKW - Required motor power in kW
 * @returns Standard motor size in kW
 */
function selectMotorSize(requiredKW: number): number {
  for (const size of STANDARD_MOTOR_SIZES_KW) {
    if (size >= requiredKW) {
      return size;
    }
  }
  // If larger than any standard size, return the largest
  return STANDARD_MOTOR_SIZES_KW[STANDARD_MOTOR_SIZES_KW.length - 1] ?? requiredKW;
}

/**
 * Calculate total differential head and pump sizing
 *
 * TDH = (P_discharge - P_suction) / (ρ × g)
 *     + static_head
 *     + friction_losses / (ρ × g)
 *
 * @param input - Pump sizing input parameters
 * @returns Pump sizing result
 */
export function calculateTDH(input: PumpSizingInput): PumpSizingResult {
  const warnings: string[] = [];
  const pumpEfficiency = input.pumpEfficiency ?? 0.7;
  const motorEfficiency = input.motorEfficiency ?? 0.95;

  // Validate efficiency
  if (pumpEfficiency <= 0 || pumpEfficiency > 1) {
    throw new Error('Pump efficiency must be between 0 and 1');
  }
  if (motorEfficiency <= 0 || motorEfficiency > 1) {
    throw new Error('Motor efficiency must be between 0 and 1');
  }

  // Convert pressures and friction to head
  const dischargePressureHead = barToHead(input.dischargeVesselPressure, input.fluidDensity);
  const suctionPressureHead = barToHead(input.suctionVesselPressure, input.fluidDensity);
  const dischargeFrictionHead = barToHead(input.dischargePressureDrop, input.fluidDensity);
  const suctionFrictionHead = barToHead(input.suctionPressureDrop, input.fluidDensity);

  // Total differential head
  const totalDifferentialHead =
    input.staticHead +
    (dischargePressureHead - suctionPressureHead) +
    dischargeFrictionHead +
    suctionFrictionHead;

  // Flow conversion
  const flowM3S = tonHrToM3S(input.flowRate, input.fluidDensity);
  const volumetricFlowM3Hr = flowM3S * 3600;

  // Calculate velocity head (for reference)
  // Assuming a typical discharge pipe velocity of 2 m/s
  const velocityHead = 0; // Not included in TDH per HI standards

  // Power calculations
  const hydraulicPower = calculateHydraulicPower(
    flowM3S,
    input.fluidDensity,
    totalDifferentialHead
  );
  const brakePower = calculateBrakePower(hydraulicPower, pumpEfficiency);
  const motorPower = brakePower / motorEfficiency;
  const recommendedMotorKW = selectMotorSize(motorPower);

  // Differential pressure in bar
  const differentialPressure = (totalDifferentialHead * input.fluidDensity * GRAVITY) / 100000;

  // Warnings
  if (totalDifferentialHead < 0) {
    warnings.push('Negative TDH indicates gravity flow may be sufficient — verify pump is needed');
  }
  if (totalDifferentialHead > 200) {
    warnings.push('High TDH — consider multistage pump or splitting into multiple stages');
  }
  if (pumpEfficiency < 0.5) {
    warnings.push('Low pump efficiency — verify with manufacturer data');
  }

  return {
    totalDifferentialHead,
    hydraulicPower,
    brakePower,
    motorPower,
    recommendedMotorKW,
    velocityHead,
    differentialPressure,
    volumetricFlowM3Hr,
    pumpEfficiency,
    motorEfficiency,
    headBreakdown: {
      staticHead: input.staticHead,
      dischargePressureHead,
      suctionPressureHead,
      dischargeFrictionHead,
      suctionFrictionHead,
    },
    warnings,
  };
}
