/**
 * Engineering Reference Data
 *
 * Standard reference values for heat exchanger and pump design.
 * Sources: TEMA Standards, Perry's Chemical Engineers' Handbook,
 * Kern's Process Heat Transfer.
 */

// ============================================================================
// Fouling Factors
// ============================================================================

/**
 * TEMA fouling resistances (m²·K/W)
 *
 * Reference: TEMA Standards, Table RGP-T-2.4
 */
export const FOULING_FACTORS: Record<string, { value: number; description: string }> = {
  // Water services
  seawater_below_50C: {
    value: 0.000088,
    description: 'Seawater below 50°C (velocity > 1 m/s)',
  },
  seawater_above_50C: {
    value: 0.000176,
    description: 'Seawater above 50°C (velocity > 1 m/s)',
  },
  treated_cooling_water: {
    value: 0.000176,
    description: 'Treated cooling tower water',
  },
  untreated_cooling_water: {
    value: 0.000352,
    description: 'Untreated cooling water',
  },
  boiler_feedwater: {
    value: 0.000088,
    description: 'Boiler feedwater (treated)',
  },
  distilled_water: {
    value: 0.000088,
    description: 'Distilled or DM water',
  },
  river_water: {
    value: 0.000352,
    description: 'River water (minimum)',
  },

  // Steam services
  steam_clean: {
    value: 0.0000088,
    description: 'Clean steam (no oil)',
  },
  steam_with_oil: {
    value: 0.000176,
    description: 'Steam with oil traces',
  },
  steam_exhaust: {
    value: 0.000088,
    description: 'Exhaust steam (oil-free)',
  },

  // Process fluids
  refrigerant: {
    value: 0.000176,
    description: 'Refrigerant liquids',
  },
  hydraulic_fluid: {
    value: 0.000176,
    description: 'Hydraulic fluid',
  },
  fuel_oil: {
    value: 0.000528,
    description: 'Fuel oil (#2)',
  },
  heavy_fuel_oil: {
    value: 0.000881,
    description: 'Heavy fuel oil (#6)',
  },

  // Gases
  air_clean: {
    value: 0.000176,
    description: 'Clean air',
  },
  flue_gas: {
    value: 0.000528,
    description: 'Flue gas',
  },
};

// ============================================================================
// Tube Material Properties
// ============================================================================

/**
 * Thermal conductivity of common tube materials (W/m·K)
 *
 * Reference: Perry's Chemical Engineers' Handbook, Table 10-42
 */
export const TUBE_CONDUCTIVITY: Record<string, { value: number; description: string }> = {
  carbon_steel: {
    value: 50,
    description: 'Carbon steel (ASTM A179/A214)',
  },
  stainless_304: {
    value: 16,
    description: 'Stainless steel 304/304L',
  },
  stainless_316: {
    value: 16,
    description: 'Stainless steel 316/316L',
  },
  duplex_2205: {
    value: 19,
    description: 'Duplex stainless 2205',
  },
  copper: {
    value: 385,
    description: 'Copper (C12200)',
  },
  copper_nickel_90_10: {
    value: 45,
    description: '90/10 Copper-Nickel (C70600)',
  },
  copper_nickel_70_30: {
    value: 29,
    description: '70/30 Copper-Nickel (C71500)',
  },
  admiralty_brass: {
    value: 111,
    description: 'Admiralty brass (C44300)',
  },
  aluminium_brass: {
    value: 100,
    description: 'Aluminium brass (C68700)',
  },
  titanium: {
    value: 22,
    description: 'Titanium Grade 2',
  },
  inconel_625: {
    value: 10,
    description: 'Inconel 625',
  },
};

// ============================================================================
// Standard Tube Dimensions
// ============================================================================

/**
 * Standard tube dimensions for heat exchangers
 *
 * Common BWG (Birmingham Wire Gauge) sizes per TEMA
 */
export interface StandardTube {
  /** Outer diameter in mm */
  od_mm: number;
  /** Wall thickness in mm */
  wall_mm: number;
  /** Inner diameter in mm (calculated) */
  id_mm: number;
  /** Display name */
  name: string;
  /** BWG gauge number */
  bwg: number;
}

export const STANDARD_TUBES: StandardTube[] = [
  // 3/4" OD (19.05mm)
  { od_mm: 19.05, wall_mm: 1.65, id_mm: 15.75, name: '3/4" OD × 16 BWG', bwg: 16 },
  { od_mm: 19.05, wall_mm: 2.11, id_mm: 14.83, name: '3/4" OD × 14 BWG', bwg: 14 },
  { od_mm: 19.05, wall_mm: 2.77, id_mm: 13.51, name: '3/4" OD × 12 BWG', bwg: 12 },

  // 1" OD (25.4mm)
  { od_mm: 25.4, wall_mm: 1.65, id_mm: 22.1, name: '1" OD × 16 BWG', bwg: 16 },
  { od_mm: 25.4, wall_mm: 2.11, id_mm: 21.18, name: '1" OD × 14 BWG', bwg: 14 },
  { od_mm: 25.4, wall_mm: 2.77, id_mm: 19.86, name: '1" OD × 12 BWG', bwg: 12 },

  // 1-1/4" OD (31.75mm)
  { od_mm: 31.75, wall_mm: 1.65, id_mm: 28.45, name: '1-1/4" OD × 16 BWG', bwg: 16 },
  { od_mm: 31.75, wall_mm: 2.11, id_mm: 27.53, name: '1-1/4" OD × 14 BWG', bwg: 14 },
  { od_mm: 31.75, wall_mm: 2.77, id_mm: 26.21, name: '1-1/4" OD × 12 BWG', bwg: 12 },

  // 1-1/2" OD (38.1mm)
  { od_mm: 38.1, wall_mm: 1.65, id_mm: 34.8, name: '1-1/2" OD × 16 BWG', bwg: 16 },
  { od_mm: 38.1, wall_mm: 2.11, id_mm: 33.88, name: '1-1/2" OD × 14 BWG', bwg: 14 },
  { od_mm: 38.1, wall_mm: 2.77, id_mm: 32.56, name: '1-1/2" OD × 12 BWG', bwg: 12 },
  { od_mm: 38.1, wall_mm: 3.4, id_mm: 31.3, name: '1-1/2" OD × 10 BWG', bwg: 10 },
];

/**
 * Standard tube lengths per TEMA (meters)
 */
export const STANDARD_TUBE_LENGTHS: number[] = [
  2.438, // 8 ft
  3.048, // 10 ft
  3.658, // 12 ft
  4.877, // 16 ft
  6.096, // 20 ft
];

// ============================================================================
// Tube Layout
// ============================================================================

/**
 * Standard tube pitch ratios (pitch / OD)
 *
 * Minimum pitch = 1.25 × OD per TEMA
 */
export const TUBE_PITCH: Record<string, { ratio: number; angle: number; description: string }> = {
  triangular_30: {
    ratio: 1.25,
    angle: 30,
    description: '30° Triangular (most common, best heat transfer)',
  },
  triangular_60: {
    ratio: 1.25,
    angle: 60,
    description: '60° Rotated triangular',
  },
  square_90: {
    ratio: 1.25,
    angle: 90,
    description: '90° Square (allows mechanical cleaning)',
  },
  rotated_square_45: {
    ratio: 1.25,
    angle: 45,
    description: '45° Rotated square',
  },
};
