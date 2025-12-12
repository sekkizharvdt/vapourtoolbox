/**
 * Pipe Sizing Calculator Types
 */

import type { PipeVariant } from '@/lib/thermal';

export type CalculationMode = 'size_by_flow' | 'check_velocity';
export type FlowUnit = 'tonhr' | 'kghr' | 'kgsec' | 'm3hr';
export type FluidType = 'water' | 'seawater' | 'steam' | 'custom';

export interface VelocityLimits {
  min: number;
  max: number;
  target: number;
}

export const DEFAULT_VELOCITY_LIMITS: Record<string, VelocityLimits> = {
  water_liquid: { min: 0.5, max: 3.0, target: 1.5 },
  seawater_liquid: { min: 0.5, max: 2.5, target: 1.5 },
  steam_vapor: { min: 15.0, max: 40.0, target: 25.0 },
  vacuum_vapor: { min: 20.0, max: 60.0, target: 35.0 },
};

export interface PipeAlternative extends PipeVariant {
  velocity: number;
  status: 'OK' | 'HIGH' | 'LOW';
}

export interface SizeByFlowResult {
  mode: 'size_by_flow';
  pipe: PipeVariant & { actualVelocity: number; velocityStatus: 'OK' | 'HIGH' | 'LOW' };
  velocity: number;
  velocityStatus: 'OK' | 'HIGH' | 'LOW';
  requiredArea: number;
  alternatives: PipeAlternative[];
}

export interface CheckVelocityResult {
  mode: 'check_velocity';
  pipe: PipeVariant;
  velocity: number;
  velocityStatus: 'OK' | 'HIGH' | 'LOW';
}

export type PipeSizingResult = SizeByFlowResult | CheckVelocityResult;
