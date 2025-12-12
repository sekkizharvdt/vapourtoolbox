/**
 * Heat Duty Calculator Types
 */

export type CalculationMode = 'sensible' | 'latent' | 'lmtd';

export interface SensibleHeatResult {
  heatDuty: number;
  specificHeat: number;
  deltaT: number;
  isHeating: boolean;
  massFlowKgS: number;
}

export interface LatentHeatResult {
  heatDuty: number;
  latentHeat: number;
  massFlowKgS: number;
  process: 'EVAPORATION' | 'CONDENSATION';
}

export interface LMTDResult {
  lmtd: number;
  correctedLMTD: number;
  correctionFactor: number;
  deltaT1: number;
  deltaT2: number;
  flowArrangement: string;
  warnings: string[];
}
