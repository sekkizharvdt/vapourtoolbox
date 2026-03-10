/**
 * Unified Fluid Property Resolver
 *
 * Provides a single interface for fetching all thermophysical properties
 * needed for heat exchanger design. Wraps seawater correlations (Sharqawy)
 * and steam table lookups.
 *
 * For pure water and condensate, uses seawater correlations at S=0 ppm,
 * which are mathematically identical to the pure water correlations in
 * the Sharqawy framework.
 *
 * References:
 * - Sharqawy, Lienhard & Zubair (2010) — seawater thermophysical properties
 * - IAPWS-IF97 via steamTables — saturation properties
 */

import {
  getSeawaterDensity,
  getSeawaterSpecificHeat,
  getSeawaterViscosity,
  getSeawaterThermalConductivity,
  getDensityLiquid,
  getDensityVapor,
  getLatentHeat,
} from '@vapour/constants';

// ============================================================================
// Types
// ============================================================================

/** Fluid types supported by the property resolver */
export type FluidType = 'SEAWATER' | 'PURE_WATER' | 'CONDENSATE';

/** Complete set of thermophysical properties for HTC calculations */
export interface FluidProperties {
  /** Density in kg/m³ */
  density: number;
  /** Specific heat capacity in kJ/(kg·K) */
  specificHeat: number;
  /** Dynamic viscosity in Pa·s */
  viscosity: number;
  /** Thermal conductivity in W/(m·K) */
  thermalConductivity: number;
}

/** Properties specific to a condensing/evaporating fluid at saturation */
export interface SaturationFluidProperties extends FluidProperties {
  /** Latent heat of vaporization in kJ/kg */
  latentHeat: number;
  /** Saturated vapor density in kg/m³ */
  vaporDensity: number;
}

// ============================================================================
// Property Resolver
// ============================================================================

/**
 * Get thermophysical properties for a liquid fluid at a given temperature.
 *
 * For SEAWATER: uses Sharqawy correlations with given salinity.
 * For PURE_WATER / CONDENSATE: uses Sharqawy correlations at S=0 ppm.
 *
 * @param fluid - Fluid type
 * @param tempC - Temperature in °C
 * @param salinity - Salinity in ppm (required for SEAWATER, ignored otherwise)
 * @returns Complete fluid properties
 */
export function getFluidProperties(
  fluid: FluidType,
  tempC: number,
  salinity: number = 0
): FluidProperties {
  const s = fluid === 'SEAWATER' ? salinity : 0;

  return {
    density: getSeawaterDensity(s, tempC),
    specificHeat: getSeawaterSpecificHeat(s, tempC),
    viscosity: getSeawaterViscosity(s, tempC),
    thermalConductivity: getSeawaterThermalConductivity(s, tempC),
  };
}

/**
 * Get properties for a fluid at saturation conditions (for condensation/evaporation).
 *
 * Returns liquid-phase properties plus latent heat and vapor density from
 * the steam tables. Used for shell-side condensation or evaporation calculations.
 *
 * @param tempC - Saturation temperature in °C
 * @returns Saturation fluid properties (liquid-phase + latent heat + vapor density)
 */
export function getSaturationProperties(tempC: number): SaturationFluidProperties {
  // Liquid-phase properties at saturation temperature (pure water condensate)
  const liquid = getFluidProperties('CONDENSATE', tempC);

  return {
    ...liquid,
    latentHeat: getLatentHeat(tempC),
    vaporDensity: getDensityVapor(tempC),
  };
}

/**
 * Get liquid density from steam tables (saturated liquid).
 * Useful for cross-checking with Sharqawy at S=0.
 *
 * @param tempC - Temperature in °C
 * @returns Density in kg/m³
 */
export function getSteamTableLiquidDensity(tempC: number): number {
  return getDensityLiquid(tempC);
}
