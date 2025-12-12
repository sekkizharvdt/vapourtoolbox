/**
 * Steam Tables Calculator Types
 */

export type SteamMode = 'saturation' | 'subcooled' | 'superheated';
export type LookupMode = 'temperature' | 'pressure';
export type PressureUnit = 'bar' | 'mbar' | 'kgcm2g' | 'mH2O';

export interface SaturationResult {
  temperature: number;
  pressure: number;
  enthalpyLiquid: number;
  enthalpyVapor: number;
  latentHeat: number;
  densityLiquid: number;
  densityVapor: number;
  specificVolumeLiquid: number;
  specificVolumeVapor: number;
}

export interface SubcooledResult {
  temperature: number;
  pressure: number;
  subcooling: number;
  enthalpy: number;
  density: number;
  specificVolume: number;
  specificHeat: number;
  speedOfSound: number;
  internalEnergy: number;
  entropy: number;
}

export interface SuperheatedResult {
  temperature: number;
  pressure: number;
  superheat: number;
  enthalpy: number;
  density: number;
  specificVolume: number;
  specificHeat: number;
  speedOfSound: number;
  internalEnergy: number;
  entropy: number;
}
