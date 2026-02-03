/**
 * Thermal Utilities
 *
 * Shared constants and conversion functions used across thermal calculators.
 * Centralizes duplicated logic from pressure drop, NPSHa, heat duty,
 * and flash chamber calculators.
 */

// ============================================================================
// Constants
// ============================================================================

/** Gravitational acceleration (m/s²) */
export const GRAVITY = 9.81;

/** Standard atmospheric pressure (bar) */
export const ATM_PRESSURE_BAR = 1.01325;

// ============================================================================
// Flow Rate Conversions
// ============================================================================

/**
 * Convert mass flow rate from ton/hr to kg/s
 *
 * @param tonHr - Mass flow rate in metric tons per hour
 * @returns Mass flow rate in kg/s
 */
export function tonHrToKgS(tonHr: number): number {
  return (tonHr * 1000) / 3600;
}

/**
 * Convert mass flow rate from kg/s to ton/hr
 *
 * @param kgS - Mass flow rate in kg/s
 * @returns Mass flow rate in metric tons per hour
 */
export function kgSToTonHr(kgS: number): number {
  return (kgS * 3600) / 1000;
}

/**
 * Convert mass flow rate from ton/hr to volumetric flow in m³/s
 *
 * @param tonHr - Mass flow rate in metric tons per hour
 * @param density - Fluid density in kg/m³
 * @returns Volumetric flow rate in m³/s
 */
export function tonHrToM3S(tonHr: number, density: number): number {
  return tonHrToKgS(tonHr) / density;
}

// ============================================================================
// Pressure-Head Conversions
// ============================================================================

/**
 * Convert pressure in bar to head in meters of liquid
 *
 * h = P / (ρ × g)
 *
 * @param pressureBar - Pressure in bar
 * @param density - Liquid density in kg/m³
 * @returns Head in meters
 */
export function barToHead(pressureBar: number, density: number): number {
  return (pressureBar * 100000) / (density * GRAVITY);
}

/**
 * Convert head in meters of liquid to pressure in bar
 *
 * P = ρ × g × h
 *
 * @param headM - Head in meters
 * @param density - Liquid density in kg/m³
 * @returns Pressure in bar
 */
export function headToBar(headM: number, density: number): number {
  return (headM * density * GRAVITY) / 100000;
}

/**
 * Convert pressure head from m H₂O to bar
 *
 * Backward-compatible wrapper around headToBar with default density.
 *
 * @param headM - Pressure head in meters of water
 * @param density - Fluid density in kg/m³ (default: 1000 for water)
 * @returns Pressure in bar
 */
export function mH2OToBar(headM: number, density: number = 1000): number {
  return headToBar(headM, density);
}

/**
 * Convert pressure from bar to m H₂O
 *
 * Backward-compatible wrapper around barToHead with default density.
 *
 * @param pressureBar - Pressure in bar
 * @param density - Fluid density in kg/m³ (default: 1000 for water)
 * @returns Pressure head in meters of water
 */
export function barToMH2O(pressureBar: number, density: number = 1000): number {
  return barToHead(pressureBar, density);
}
