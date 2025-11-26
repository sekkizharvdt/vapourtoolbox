/**
 * Centralized Fabrication Cost Rates Configuration
 *
 * Default fabrication rates for shape calculations.
 * These can be overridden at shape-level or runtime.
 *
 * All rates are in INR (Indian Rupees)
 */

export interface FabricationRates {
  /** Cost per meter for cutting operations (laser, plasma, waterjet, etc.) */
  cuttingCostPerMeter: number;

  /** Cost per meter for edge preparation (beveling, grinding, etc.) */
  edgePreparationCostPerMeter: number;

  /** Cost per meter for welding (base rate, adjusted by thickness) */
  weldingCostPerMeter: number;

  /** Cost per square meter for surface treatment (painting, coating, blasting) */
  surfaceTreatmentCostPerSqm: number;

  /** Base fabrication cost (setup, handling) */
  baseCost?: number;

  /** Cost per kg for weight-based fabrication */
  costPerKg?: number;

  /** Labor rate per hour */
  laborRatePerHour?: number;
}

/**
 * Global default fabrication rates
 *
 * These are baseline rates used when no shape-specific or user-provided rates exist.
 * Update these values to reflect current market rates.
 */
export const DEFAULT_FABRICATION_RATES: FabricationRates = {
  // Cutting rates (per meter)
  cuttingCostPerMeter: 50, // ₹50/m - Laser/plasma cutting

  // Edge preparation rates (per meter)
  edgePreparationCostPerMeter: 100, // ₹100/m - Beveling, grinding

  // Welding rates (per meter, base rate)
  weldingCostPerMeter: 500, // ₹500/m - SMAW/GMAW welding (adjusted by thickness)

  // Surface treatment rates (per square meter)
  surfaceTreatmentCostPerSqm: 50, // ₹50/m² - Primer/paint application

  // Optional base costs
  baseCost: 0, // No default base cost
  costPerKg: 0, // No default weight-based cost
  laborRatePerHour: 500, // ₹500/hour - Standard labor rate
};

/**
 * Material-specific rate adjustments (multipliers)
 *
 * Some materials require different fabrication approaches.
 * These multipliers adjust the default rates.
 */
export const MATERIAL_RATE_MULTIPLIERS: Record<string, Partial<FabricationRates>> = {
  // Stainless steel requires slower cutting, more careful edge prep
  'stainless-steel': {
    cuttingCostPerMeter: 80, // Higher cutting cost
    edgePreparationCostPerMeter: 150, // More careful edge prep
    weldingCostPerMeter: 800, // TIG welding typically required
  },

  // Aluminum is easier to cut but requires different welding
  aluminum: {
    cuttingCostPerMeter: 40, // Easier to cut
    weldingCostPerMeter: 600, // TIG welding
  },

  // Carbon steel (baseline, same as default)
  'carbon-steel': {
    // Uses defaults
  },
};

/**
 * Shape-category-specific rate adjustments
 *
 * Some shape categories have special fabrication requirements.
 */
export const SHAPE_CATEGORY_RATE_MULTIPLIERS: Record<string, Partial<FabricationRates>> = {
  // Pressure vessel components require higher quality fabrication
  'pressure-vessel': {
    weldingCostPerMeter: 800, // X-ray quality welds
    edgePreparationCostPerMeter: 150, // Precise beveling
    baseCost: 5000, // Setup and inspection
  },

  // Heat exchanger components
  'heat-exchanger': {
    weldingCostPerMeter: 700, // High quality welds
    baseCost: 3000, // Setup cost
  },

  // Standard plates and profiles
  plates: {
    // Uses defaults
  },
};

/**
 * Get fabrication rates with priority resolution
 *
 * Priority order:
 * 1. User-provided rates (runtime override)
 * 2. Shape-specific rates (from shape definition)
 * 3. Category-specific adjustments
 * 4. Material-specific adjustments
 * 5. Global defaults
 *
 * @param options - Rate resolution options
 * @returns Resolved fabrication rates
 */
export function resolveFabricationRates(options: {
  userRates?: Partial<FabricationRates>;
  shapeRates?: Partial<FabricationRates>;
  shapeCategory?: string;
  materialType?: string;
}): FabricationRates {
  const { userRates, shapeRates, shapeCategory, materialType } = options;

  // Start with defaults
  let rates = { ...DEFAULT_FABRICATION_RATES };

  // Apply material-specific adjustments
  if (materialType && MATERIAL_RATE_MULTIPLIERS[materialType]) {
    rates = { ...rates, ...MATERIAL_RATE_MULTIPLIERS[materialType] };
  }

  // Apply category-specific adjustments
  if (shapeCategory && SHAPE_CATEGORY_RATE_MULTIPLIERS[shapeCategory]) {
    rates = { ...rates, ...SHAPE_CATEGORY_RATE_MULTIPLIERS[shapeCategory] };
  }

  // Apply shape-specific rates
  if (shapeRates) {
    rates = { ...rates, ...shapeRates };
  }

  // Apply user-provided rates (highest priority)
  if (userRates) {
    rates = { ...rates, ...userRates };
  }

  return rates;
}

/**
 * Helper to get just the essential rates (for backward compatibility)
 */
export function getDefaultRates(): Pick<
  FabricationRates,
  | 'cuttingCostPerMeter'
  | 'edgePreparationCostPerMeter'
  | 'weldingCostPerMeter'
  | 'surfaceTreatmentCostPerSqm'
> {
  return {
    cuttingCostPerMeter: DEFAULT_FABRICATION_RATES.cuttingCostPerMeter,
    edgePreparationCostPerMeter: DEFAULT_FABRICATION_RATES.edgePreparationCostPerMeter,
    weldingCostPerMeter: DEFAULT_FABRICATION_RATES.weldingCostPerMeter,
    surfaceTreatmentCostPerSqm: DEFAULT_FABRICATION_RATES.surfaceTreatmentCostPerSqm,
  };
}
