/**
 * Bought-Out Items Helper Functions
 *
 * Utility functions for working with bought-out components in BOMs.
 * Bought-out items are materials with materialType: 'BOUGHT_OUT_COMPONENT'
 */

import { MaterialCategory, MaterialType } from '@vapour/types';

/**
 * Check if a MaterialCategory is a bought-out item category
 */
export function isBoughtOutCategory(category: MaterialCategory): boolean {
  const boughtOutCategories: MaterialCategory[] = [
    // Valves
    MaterialCategory.VALVE_GATE,
    MaterialCategory.VALVE_GLOBE,
    MaterialCategory.VALVE_BALL,
    MaterialCategory.VALVE_BUTTERFLY,
    MaterialCategory.VALVE_CHECK,
    MaterialCategory.VALVE_OTHER,
    // Pumps
    MaterialCategory.PUMP_CENTRIFUGAL,
    MaterialCategory.PUMP_POSITIVE_DISPLACEMENT,
    // Instruments
    MaterialCategory.INSTRUMENT_PRESSURE_GAUGE,
    MaterialCategory.INSTRUMENT_TEMPERATURE_SENSOR,
    MaterialCategory.INSTRUMENT_FLOW_METER,
    MaterialCategory.INSTRUMENT_LEVEL_TRANSMITTER,
    MaterialCategory.INSTRUMENT_CONTROL_VALVE,
    MaterialCategory.INSTRUMENT_OTHER,
    // Other bought-out items
    MaterialCategory.FLANGES,
    MaterialCategory.GASKETS,
    MaterialCategory.MOTORS,
    MaterialCategory.STRAINERS,
    MaterialCategory.SEPARATORS,
    MaterialCategory.ELECTRICAL,
  ];

  return boughtOutCategories.includes(category);
}

/**
 * Get bought-out categories grouped by type
 */
export function getBoughtOutCategoriesByType(): Record<string, MaterialCategory[]> {
  return {
    Valves: [
      MaterialCategory.VALVE_GATE,
      MaterialCategory.VALVE_GLOBE,
      MaterialCategory.VALVE_BALL,
      MaterialCategory.VALVE_BUTTERFLY,
      MaterialCategory.VALVE_CHECK,
      MaterialCategory.VALVE_OTHER,
    ],
    Pumps: [MaterialCategory.PUMP_CENTRIFUGAL, MaterialCategory.PUMP_POSITIVE_DISPLACEMENT],
    Instruments: [
      MaterialCategory.INSTRUMENT_PRESSURE_GAUGE,
      MaterialCategory.INSTRUMENT_TEMPERATURE_SENSOR,
      MaterialCategory.INSTRUMENT_FLOW_METER,
      MaterialCategory.INSTRUMENT_LEVEL_TRANSMITTER,
      MaterialCategory.INSTRUMENT_CONTROL_VALVE,
      MaterialCategory.INSTRUMENT_OTHER,
    ],
    Other: [
      MaterialCategory.FLANGES,
      MaterialCategory.GASKETS,
      MaterialCategory.MOTORS,
      MaterialCategory.STRAINERS,
      MaterialCategory.SEPARATORS,
      MaterialCategory.ELECTRICAL,
    ],
  };
}

/**
 * Get all bought-out categories as a flat array
 */
export function getAllBoughtOutCategories(): MaterialCategory[] {
  return [
    // Valves
    MaterialCategory.VALVE_GATE,
    MaterialCategory.VALVE_GLOBE,
    MaterialCategory.VALVE_BALL,
    MaterialCategory.VALVE_BUTTERFLY,
    MaterialCategory.VALVE_CHECK,
    MaterialCategory.VALVE_OTHER,
    // Pumps
    MaterialCategory.PUMP_CENTRIFUGAL,
    MaterialCategory.PUMP_POSITIVE_DISPLACEMENT,
    // Instruments
    MaterialCategory.INSTRUMENT_PRESSURE_GAUGE,
    MaterialCategory.INSTRUMENT_TEMPERATURE_SENSOR,
    MaterialCategory.INSTRUMENT_FLOW_METER,
    MaterialCategory.INSTRUMENT_LEVEL_TRANSMITTER,
    MaterialCategory.INSTRUMENT_CONTROL_VALVE,
    MaterialCategory.INSTRUMENT_OTHER,
    // Other
    MaterialCategory.FLANGES,
    MaterialCategory.GASKETS,
    MaterialCategory.MOTORS,
    MaterialCategory.STRAINERS,
    MaterialCategory.SEPARATORS,
    MaterialCategory.ELECTRICAL,
  ];
}

/**
 * Check if a MaterialType is bought-out
 */
export function isBoughtOutType(materialType: MaterialType): boolean {
  return materialType === 'BOUGHT_OUT_COMPONENT';
}

/**
 * Get the type group for a bought-out category (for UI organization)
 */
export function getBoughtOutTypeGroup(category: MaterialCategory): string | null {
  if (
    [
      MaterialCategory.VALVE_GATE,
      MaterialCategory.VALVE_GLOBE,
      MaterialCategory.VALVE_BALL,
      MaterialCategory.VALVE_BUTTERFLY,
      MaterialCategory.VALVE_CHECK,
      MaterialCategory.VALVE_OTHER,
    ].includes(category)
  ) {
    return 'Valves';
  }

  if (
    [MaterialCategory.PUMP_CENTRIFUGAL, MaterialCategory.PUMP_POSITIVE_DISPLACEMENT].includes(
      category
    )
  ) {
    return 'Pumps';
  }

  if (
    [
      MaterialCategory.INSTRUMENT_PRESSURE_GAUGE,
      MaterialCategory.INSTRUMENT_TEMPERATURE_SENSOR,
      MaterialCategory.INSTRUMENT_FLOW_METER,
      MaterialCategory.INSTRUMENT_LEVEL_TRANSMITTER,
      MaterialCategory.INSTRUMENT_CONTROL_VALVE,
      MaterialCategory.INSTRUMENT_OTHER,
    ].includes(category)
  ) {
    return 'Instruments';
  }

  if (
    [
      MaterialCategory.FLANGES,
      MaterialCategory.GASKETS,
      MaterialCategory.MOTORS,
      MaterialCategory.STRAINERS,
      MaterialCategory.SEPARATORS,
      MaterialCategory.ELECTRICAL,
    ].includes(category)
  ) {
    return 'Other';
  }

  return null;
}
