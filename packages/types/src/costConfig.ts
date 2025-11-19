/**
 * Cost Configuration Types
 * Phase 4: Costing Configuration (Overhead, Contingency, Profit)
 *
 * Defines configurable indirect costs and profit margins that are applied
 * on top of direct costs (material + fabrication + service) to calculate
 * final BOM total cost.
 */

import { Timestamp } from 'firebase/firestore';
import { TimestampFields, Money } from './common';

/**
 * Overhead Applicability
 * Determines which cost components overhead applies to
 */
export type OverheadApplicability = 'MATERIAL' | 'FABRICATION' | 'SERVICE' | 'ALL';

/**
 * Overhead Applicability Labels
 */
export const OVERHEAD_APPLICABILITY_LABELS: Record<OverheadApplicability, string> = {
  MATERIAL: 'Material Cost Only',
  FABRICATION: 'Fabrication Cost Only',
  SERVICE: 'Service Cost Only',
  ALL: 'All Direct Costs',
};

/**
 * Overhead Configuration
 */
export interface OverheadConfig {
  enabled: boolean;
  ratePercent: number; // e.g., 15 for 15%
  description?: string;
  applicableTo: OverheadApplicability;
}

/**
 * Contingency Configuration
 * Buffer for material price fluctuations and unknowns
 */
export interface ContingencyConfig {
  enabled: boolean;
  ratePercent: number; // e.g., 10 for 10%
  description?: string;
}

/**
 * Profit Configuration
 */
export interface ProfitConfig {
  enabled: boolean;
  ratePercent: number; // e.g., 20 for 20%
  description?: string;
}

/**
 * Labor Rates (for reference/documentation only, not used in calculations)
 * Service costs have their own independent rates from Phase 3
 */
export interface LaborRates {
  engineerHourlyRate: Money;
  draftsmanHourlyRate: Money;
  fitterHourlyRate: Money;
  welderHourlyRate: Money;
  supervisorHourlyRate: Money;
}

/**
 * Fabrication Rates (for reference/documentation only)
 * Actual fabrication costs calculated in Phase 1 shape calculator
 */
export interface FabricationRates {
  cuttingRatePerMeter: Money;
  weldingRatePerMeter: Money;
  formingRatePerSqMeter: Money;
  machiningRatePerHour: Money;
  assemblyRatePerUnit: Money;
}

/**
 * Cost Configuration
 * Entity-level configuration for overhead, contingency, and profit margins
 */
export interface CostConfiguration extends TimestampFields {
  id: string;
  entityId: string; // Multi-tenant: Each company has its own config

  // Indirect Cost Components
  overhead: OverheadConfig;
  contingency: ContingencyConfig;
  profit: ProfitConfig;

  // Reference Rates (informational, not used in calculations)
  laborRates?: LaborRates;
  fabricationRates?: FabricationRates;

  // Metadata
  name?: string; // Optional name for the configuration
  description?: string;

  // Status
  isActive: boolean;
  effectiveFrom: Timestamp; // When this config becomes active

  // Audit
  createdBy: string;
  updatedBy: string;
}

/**
 * Create Cost Configuration Input
 */
export interface CreateCostConfigurationInput {
  entityId: string;
  overhead: OverheadConfig;
  contingency: ContingencyConfig;
  profit: ProfitConfig;
  laborRates?: LaborRates;
  fabricationRates?: FabricationRates;
  name?: string;
  description?: string;
  effectiveFrom?: Timestamp; // Optional, defaults to now
}

/**
 * Update Cost Configuration Input
 */
export interface UpdateCostConfigurationInput {
  overhead?: OverheadConfig;
  contingency?: ContingencyConfig;
  profit?: ProfitConfig;
  laborRates?: LaborRates;
  fabricationRates?: FabricationRates;
  name?: string;
  description?: string;
  isActive?: boolean;
}

/**
 * Cost Calculation Breakdown
 * Detailed breakdown showing how total cost was calculated
 */
export interface CostCalculationBreakdown {
  // Direct Costs
  materialCost: Money;
  fabricationCost: Money;
  serviceCost: Money;
  totalDirectCost: Money;

  // Overhead Calculation
  overheadEnabled: boolean;
  overheadRate: number; // Percentage
  overheadAppliedTo: OverheadApplicability;
  overheadBaseCost: Money; // The cost overhead was applied to
  overheadAmount: Money;

  // Contingency Calculation
  contingencyEnabled: boolean;
  contingencyRate: number; // Percentage
  contingencyBaseCost: Money; // Direct + Overhead
  contingencyAmount: Money;

  // Subtotal (before profit)
  subtotal: Money; // Direct + Overhead + Contingency

  // Profit Calculation
  profitEnabled: boolean;
  profitRate: number; // Percentage
  profitBaseCost: Money; // Subtotal
  profitAmount: Money;

  // Final Total
  totalCost: Money; // Subtotal + Profit

  // Config Reference
  costConfigId?: string;
  costConfigName?: string;
  calculatedAt: Timestamp;
}

/**
 * Default Labor Rates
 * Used when creating new cost configurations
 */
export const DEFAULT_LABOR_RATES: Record<string, number> = {
  engineer: 0,
  draftsman: 0,
  fitter: 0,
  welder: 0,
  supervisor: 0,
};

/**
 * Default Fabrication Rates
 * Used when creating new cost configurations
 */
export const DEFAULT_FABRICATION_RATES: Record<string, number> = {
  cutting: 0,
  welding: 0,
  forming: 0,
  machining: 0,
  assembly: 0,
};

/**
 * Default Overhead Configuration
 */
export const DEFAULT_OVERHEAD_CONFIG: OverheadConfig = {
  enabled: false,
  ratePercent: 0,
  description: '',
  applicableTo: 'ALL',
};

/**
 * Default Contingency Configuration
 */
export const DEFAULT_CONTINGENCY_CONFIG: ContingencyConfig = {
  enabled: false,
  ratePercent: 0,
  description: '',
};

/**
 * Default Profit Configuration
 */
export const DEFAULT_PROFIT_CONFIG: ProfitConfig = {
  enabled: false,
  ratePercent: 0,
  description: '',
};
