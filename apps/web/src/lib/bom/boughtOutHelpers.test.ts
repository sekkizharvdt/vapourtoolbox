/**
 * Bought-Out Items Helper Tests
 *
 * Tests for utility functions for working with bought-out components in BOMs.
 */

import { MaterialCategory } from '@vapour/types';
import {
  isBoughtOutCategory,
  getBoughtOutCategoriesByType,
  getAllBoughtOutCategories,
  isBoughtOutType,
  getBoughtOutTypeGroup,
} from './boughtOutHelpers';

describe('Bought-Out Helpers', () => {
  describe('isBoughtOutCategory', () => {
    describe('Valves', () => {
      it('should return true for VALVE_GATE', () => {
        expect(isBoughtOutCategory(MaterialCategory.VALVE_GATE)).toBe(true);
      });

      it('should return true for VALVE_GLOBE', () => {
        expect(isBoughtOutCategory(MaterialCategory.VALVE_GLOBE)).toBe(true);
      });

      it('should return true for VALVE_BALL', () => {
        expect(isBoughtOutCategory(MaterialCategory.VALVE_BALL)).toBe(true);
      });

      it('should return true for VALVE_BUTTERFLY', () => {
        expect(isBoughtOutCategory(MaterialCategory.VALVE_BUTTERFLY)).toBe(true);
      });

      it('should return true for VALVE_CHECK', () => {
        expect(isBoughtOutCategory(MaterialCategory.VALVE_CHECK)).toBe(true);
      });

      it('should return true for VALVE_OTHER', () => {
        expect(isBoughtOutCategory(MaterialCategory.VALVE_OTHER)).toBe(true);
      });
    });

    describe('Pumps', () => {
      it('should return true for PUMP_CENTRIFUGAL', () => {
        expect(isBoughtOutCategory(MaterialCategory.PUMP_CENTRIFUGAL)).toBe(true);
      });

      it('should return true for PUMP_POSITIVE_DISPLACEMENT', () => {
        expect(isBoughtOutCategory(MaterialCategory.PUMP_POSITIVE_DISPLACEMENT)).toBe(true);
      });
    });

    describe('Instruments', () => {
      it('should return true for INSTRUMENT_PRESSURE_GAUGE', () => {
        expect(isBoughtOutCategory(MaterialCategory.INSTRUMENT_PRESSURE_GAUGE)).toBe(true);
      });

      it('should return true for INSTRUMENT_TEMPERATURE_SENSOR', () => {
        expect(isBoughtOutCategory(MaterialCategory.INSTRUMENT_TEMPERATURE_SENSOR)).toBe(true);
      });

      it('should return true for INSTRUMENT_FLOW_METER', () => {
        expect(isBoughtOutCategory(MaterialCategory.INSTRUMENT_FLOW_METER)).toBe(true);
      });

      it('should return true for INSTRUMENT_LEVEL_TRANSMITTER', () => {
        expect(isBoughtOutCategory(MaterialCategory.INSTRUMENT_LEVEL_TRANSMITTER)).toBe(true);
      });

      it('should return true for INSTRUMENT_CONTROL_VALVE', () => {
        expect(isBoughtOutCategory(MaterialCategory.INSTRUMENT_CONTROL_VALVE)).toBe(true);
      });

      it('should return true for INSTRUMENT_OTHER', () => {
        expect(isBoughtOutCategory(MaterialCategory.INSTRUMENT_OTHER)).toBe(true);
      });
    });

    describe('Other bought-out items', () => {
      it('should return true for FLANGES', () => {
        expect(isBoughtOutCategory(MaterialCategory.FLANGES)).toBe(true);
      });

      it('should return true for GASKETS', () => {
        expect(isBoughtOutCategory(MaterialCategory.GASKETS)).toBe(true);
      });

      it('should return true for MOTORS', () => {
        expect(isBoughtOutCategory(MaterialCategory.MOTORS)).toBe(true);
      });

      it('should return true for STRAINERS', () => {
        expect(isBoughtOutCategory(MaterialCategory.STRAINERS)).toBe(true);
      });

      it('should return true for SEPARATORS', () => {
        expect(isBoughtOutCategory(MaterialCategory.SEPARATORS)).toBe(true);
      });

      it('should return true for ELECTRICAL', () => {
        expect(isBoughtOutCategory(MaterialCategory.ELECTRICAL)).toBe(true);
      });
    });

    describe('Non bought-out categories', () => {
      it('should return false for PLATES_STAINLESS_STEEL', () => {
        expect(isBoughtOutCategory(MaterialCategory.PLATES_STAINLESS_STEEL)).toBe(false);
      });

      it('should return false for PLATES_CARBON_STEEL', () => {
        expect(isBoughtOutCategory(MaterialCategory.PLATES_CARBON_STEEL)).toBe(false);
      });

      it('should return false for PIPES_STAINLESS_STEEL', () => {
        expect(isBoughtOutCategory(MaterialCategory.PIPES_STAINLESS_STEEL)).toBe(false);
      });

      it('should return false for FITTINGS_STAINLESS_STEEL', () => {
        expect(isBoughtOutCategory(MaterialCategory.FITTINGS_STAINLESS_STEEL)).toBe(false);
      });
    });
  });

  describe('getBoughtOutCategoriesByType', () => {
    it('should return object with Valves, Pumps, Instruments, and Other groups', () => {
      const result = getBoughtOutCategoriesByType();

      expect(result).toHaveProperty('Valves');
      expect(result).toHaveProperty('Pumps');
      expect(result).toHaveProperty('Instruments');
      expect(result).toHaveProperty('Other');
    });

    it('should have 6 valve categories', () => {
      const result = getBoughtOutCategoriesByType();

      expect(result.Valves).toHaveLength(6);
      expect(result.Valves).toContain(MaterialCategory.VALVE_GATE);
      expect(result.Valves).toContain(MaterialCategory.VALVE_GLOBE);
      expect(result.Valves).toContain(MaterialCategory.VALVE_BALL);
      expect(result.Valves).toContain(MaterialCategory.VALVE_BUTTERFLY);
      expect(result.Valves).toContain(MaterialCategory.VALVE_CHECK);
      expect(result.Valves).toContain(MaterialCategory.VALVE_OTHER);
    });

    it('should have 2 pump categories', () => {
      const result = getBoughtOutCategoriesByType();

      expect(result.Pumps).toHaveLength(2);
      expect(result.Pumps).toContain(MaterialCategory.PUMP_CENTRIFUGAL);
      expect(result.Pumps).toContain(MaterialCategory.PUMP_POSITIVE_DISPLACEMENT);
    });

    it('should have 6 instrument categories', () => {
      const result = getBoughtOutCategoriesByType();

      expect(result.Instruments).toHaveLength(6);
      expect(result.Instruments).toContain(MaterialCategory.INSTRUMENT_PRESSURE_GAUGE);
      expect(result.Instruments).toContain(MaterialCategory.INSTRUMENT_TEMPERATURE_SENSOR);
      expect(result.Instruments).toContain(MaterialCategory.INSTRUMENT_FLOW_METER);
      expect(result.Instruments).toContain(MaterialCategory.INSTRUMENT_LEVEL_TRANSMITTER);
      expect(result.Instruments).toContain(MaterialCategory.INSTRUMENT_CONTROL_VALVE);
      expect(result.Instruments).toContain(MaterialCategory.INSTRUMENT_OTHER);
    });

    it('should have 6 other categories', () => {
      const result = getBoughtOutCategoriesByType();

      expect(result.Other).toHaveLength(6);
      expect(result.Other).toContain(MaterialCategory.FLANGES);
      expect(result.Other).toContain(MaterialCategory.GASKETS);
      expect(result.Other).toContain(MaterialCategory.MOTORS);
      expect(result.Other).toContain(MaterialCategory.STRAINERS);
      expect(result.Other).toContain(MaterialCategory.SEPARATORS);
      expect(result.Other).toContain(MaterialCategory.ELECTRICAL);
    });
  });

  describe('getAllBoughtOutCategories', () => {
    it('should return 20 total categories', () => {
      const result = getAllBoughtOutCategories();

      expect(result).toHaveLength(20);
    });

    it('should include all valve categories', () => {
      const result = getAllBoughtOutCategories();

      expect(result).toContain(MaterialCategory.VALVE_GATE);
      expect(result).toContain(MaterialCategory.VALVE_GLOBE);
      expect(result).toContain(MaterialCategory.VALVE_BALL);
      expect(result).toContain(MaterialCategory.VALVE_BUTTERFLY);
      expect(result).toContain(MaterialCategory.VALVE_CHECK);
      expect(result).toContain(MaterialCategory.VALVE_OTHER);
    });

    it('should include all pump categories', () => {
      const result = getAllBoughtOutCategories();

      expect(result).toContain(MaterialCategory.PUMP_CENTRIFUGAL);
      expect(result).toContain(MaterialCategory.PUMP_POSITIVE_DISPLACEMENT);
    });

    it('should include all instrument categories', () => {
      const result = getAllBoughtOutCategories();

      expect(result).toContain(MaterialCategory.INSTRUMENT_PRESSURE_GAUGE);
      expect(result).toContain(MaterialCategory.INSTRUMENT_TEMPERATURE_SENSOR);
      expect(result).toContain(MaterialCategory.INSTRUMENT_FLOW_METER);
      expect(result).toContain(MaterialCategory.INSTRUMENT_LEVEL_TRANSMITTER);
      expect(result).toContain(MaterialCategory.INSTRUMENT_CONTROL_VALVE);
      expect(result).toContain(MaterialCategory.INSTRUMENT_OTHER);
    });

    it('should include all other categories', () => {
      const result = getAllBoughtOutCategories();

      expect(result).toContain(MaterialCategory.FLANGES);
      expect(result).toContain(MaterialCategory.GASKETS);
      expect(result).toContain(MaterialCategory.MOTORS);
      expect(result).toContain(MaterialCategory.STRAINERS);
      expect(result).toContain(MaterialCategory.SEPARATORS);
      expect(result).toContain(MaterialCategory.ELECTRICAL);
    });

    it('should not include non-bought-out categories', () => {
      const result = getAllBoughtOutCategories();

      expect(result).not.toContain(MaterialCategory.PLATES_STAINLESS_STEEL);
      expect(result).not.toContain(MaterialCategory.PIPES_CARBON_STEEL);
    });
  });

  describe('isBoughtOutType', () => {
    it('should return true for BOUGHT_OUT_COMPONENT', () => {
      expect(isBoughtOutType('BOUGHT_OUT_COMPONENT')).toBe(true);
    });

    it('should return false for RAW_MATERIAL', () => {
      expect(isBoughtOutType('RAW_MATERIAL')).toBe(false);
    });

    it('should return false for SEMI_FINISHED', () => {
      expect(isBoughtOutType('SEMI_FINISHED')).toBe(false);
    });

    it('should return false for FINISHED_GOODS', () => {
      expect(isBoughtOutType('FINISHED_GOODS')).toBe(false);
    });
  });

  describe('getBoughtOutTypeGroup', () => {
    describe('Valves group', () => {
      it('should return Valves for VALVE_GATE', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.VALVE_GATE)).toBe('Valves');
      });

      it('should return Valves for VALVE_GLOBE', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.VALVE_GLOBE)).toBe('Valves');
      });

      it('should return Valves for VALVE_BALL', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.VALVE_BALL)).toBe('Valves');
      });

      it('should return Valves for VALVE_BUTTERFLY', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.VALVE_BUTTERFLY)).toBe('Valves');
      });

      it('should return Valves for VALVE_CHECK', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.VALVE_CHECK)).toBe('Valves');
      });

      it('should return Valves for VALVE_OTHER', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.VALVE_OTHER)).toBe('Valves');
      });
    });

    describe('Pumps group', () => {
      it('should return Pumps for PUMP_CENTRIFUGAL', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.PUMP_CENTRIFUGAL)).toBe('Pumps');
      });

      it('should return Pumps for PUMP_POSITIVE_DISPLACEMENT', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.PUMP_POSITIVE_DISPLACEMENT)).toBe('Pumps');
      });
    });

    describe('Instruments group', () => {
      it('should return Instruments for INSTRUMENT_PRESSURE_GAUGE', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.INSTRUMENT_PRESSURE_GAUGE)).toBe(
          'Instruments'
        );
      });

      it('should return Instruments for INSTRUMENT_TEMPERATURE_SENSOR', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.INSTRUMENT_TEMPERATURE_SENSOR)).toBe(
          'Instruments'
        );
      });

      it('should return Instruments for INSTRUMENT_FLOW_METER', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.INSTRUMENT_FLOW_METER)).toBe('Instruments');
      });

      it('should return Instruments for INSTRUMENT_LEVEL_TRANSMITTER', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.INSTRUMENT_LEVEL_TRANSMITTER)).toBe(
          'Instruments'
        );
      });

      it('should return Instruments for INSTRUMENT_CONTROL_VALVE', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.INSTRUMENT_CONTROL_VALVE)).toBe(
          'Instruments'
        );
      });

      it('should return Instruments for INSTRUMENT_OTHER', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.INSTRUMENT_OTHER)).toBe('Instruments');
      });
    });

    describe('Other group', () => {
      it('should return Other for FLANGES', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.FLANGES)).toBe('Other');
      });

      it('should return Other for GASKETS', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.GASKETS)).toBe('Other');
      });

      it('should return Other for MOTORS', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.MOTORS)).toBe('Other');
      });

      it('should return Other for STRAINERS', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.STRAINERS)).toBe('Other');
      });

      it('should return Other for SEPARATORS', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.SEPARATORS)).toBe('Other');
      });

      it('should return Other for ELECTRICAL', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.ELECTRICAL)).toBe('Other');
      });
    });

    describe('Non bought-out categories', () => {
      it('should return null for PLATES_STAINLESS_STEEL', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.PLATES_STAINLESS_STEEL)).toBeNull();
      });

      it('should return null for PIPES_CARBON_STEEL', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.PIPES_CARBON_STEEL)).toBeNull();
      });

      it('should return null for FITTINGS_STAINLESS_STEEL', () => {
        expect(getBoughtOutTypeGroup(MaterialCategory.FITTINGS_STAINLESS_STEEL)).toBeNull();
      });
    });
  });

  describe('Consistency checks', () => {
    it('all categories from getAllBoughtOutCategories should be identified by isBoughtOutCategory', () => {
      const allCategories = getAllBoughtOutCategories();

      allCategories.forEach((category) => {
        expect(isBoughtOutCategory(category)).toBe(true);
      });
    });

    it('all categories from getBoughtOutCategoriesByType should be in getAllBoughtOutCategories', () => {
      const byType = getBoughtOutCategoriesByType();
      const all = getAllBoughtOutCategories();

      Object.values(byType)
        .flat()
        .forEach((category) => {
          expect(all).toContain(category);
        });
    });

    it('all bought-out categories should have a type group', () => {
      const allCategories = getAllBoughtOutCategories();

      allCategories.forEach((category) => {
        expect(getBoughtOutTypeGroup(category)).not.toBeNull();
      });
    });

    it('type group counts should match category counts', () => {
      const byType = getBoughtOutCategoriesByType();
      const totalByType =
        byType.Valves.length +
        byType.Pumps.length +
        byType.Instruments.length +
        byType.Other.length;

      expect(totalByType).toBe(getAllBoughtOutCategories().length);
    });
  });
});
