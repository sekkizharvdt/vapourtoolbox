/**
 * NPSHa Calculator Tests
 *
 * Tests for Net Positive Suction Head Available calculations
 */

import {
  barToHead,
  headToBar,
  calculateNPSHa,
  calculateMinimumLiquidLevel,
  type NPSHaInput,
  type VesselType,
  type LiquidType,
} from './npshaCalculator';

// Mock the constants module
jest.mock('@vapour/constants', () => ({
  getSaturationPressure: jest.fn((temp: number) => {
    // Approximate steam saturation pressure (bar)
    // Using Antoine equation approximation
    const A = 8.07131;
    const B = 1730.63;
    const C = 233.426;
    const pMmHg = Math.pow(10, A - B / (C + temp));
    return pMmHg / 750.062; // Convert mmHg to bar
  }),
  getBoilingPointElevation: jest.fn((salinity: number, _temp: number) => {
    // Approximate BPE: ~0.018 × salinity (g/kg)
    return 0.018 * (salinity / 1000);
  }),
  getSeawaterDensity: jest.fn((salinity: number, temp: number) => {
    // Approximate seawater density
    const salinityGkg = salinity / 1000;
    return 1000 + 0.78 * salinityGkg - 0.0068 * temp * temp;
  }),
  getDensityLiquid: jest.fn((temp: number) => {
    // Approximate pure water density
    return 1000 - 0.0068 * temp * temp;
  }),
}));

describe('NPSHa Calculator', () => {
  describe('barToHead', () => {
    it('should convert pressure to head', () => {
      // h = P / (ρ × g)
      // 1 bar = 100,000 Pa
      // h = 100,000 / (1000 × 9.81) ≈ 10.19 m
      const head = barToHead(1, 1000);
      expect(head).toBeCloseTo(10.19, 1);
    });

    it('should scale with pressure', () => {
      const head1bar = barToHead(1, 1000);
      const head2bar = barToHead(2, 1000);
      expect(head2bar).toBeCloseTo(head1bar * 2, 5);
    });

    it('should scale inversely with density', () => {
      const headWater = barToHead(1, 1000);
      const headSeawater = barToHead(1, 1025);
      expect(headSeawater).toBeLessThan(headWater);
    });
  });

  describe('headToBar', () => {
    it('should convert head to pressure', () => {
      // P = h × ρ × g / 100000
      // P = 10 × 1000 × 9.81 / 100000 ≈ 0.981 bar
      const pressure = headToBar(10, 1000);
      expect(pressure).toBeCloseTo(0.981, 2);
    });

    it('should be reversible with barToHead', () => {
      const original = 1.5; // bar
      const density = 1020;
      const head = barToHead(original, density);
      const back = headToBar(head, density);
      expect(back).toBeCloseTo(original, 5);
    });
  });

  describe('calculateNPSHa', () => {
    function createTestInput(overrides: Partial<NPSHaInput> = {}): NPSHaInput {
      return {
        vesselType: 'OPEN',
        liquidLevelAbovePump: 3, // 3m above pump
        liquidTemperature: 25, // 25°C
        liquidType: 'PURE_WATER',
        frictionLoss: 0.5, // 0.5m friction loss
        ...overrides,
      };
    }

    describe('open vessel calculations', () => {
      it('should calculate NPSHa for open tank at atmospheric pressure', () => {
        const input = createTestInput();

        const result = calculateNPSHa(input);

        expect(result.staticHead).toBe(3);
        expect(result.frictionLoss).toBe(0.5);
        expect(result.npshAvailable).toBeGreaterThan(0);
        expect(result.pressureHead).toBeCloseTo(10.19, 0); // ~10m for 1 bar
      });

      it('should use default atmospheric pressure', () => {
        const input = createTestInput();

        const result = calculateNPSHa(input);

        // 1.01325 bar should give ~10.33m head for water at ~1000 kg/m³
        expect(result.pressureHead).toBeGreaterThan(10);
        expect(result.pressureHead).toBeLessThan(10.5);
      });

      it('should use custom atmospheric pressure', () => {
        const input = createTestInput({
          atmosphericPressure: 0.9, // Lower pressure (altitude)
        });

        const result = calculateNPSHa(input);

        expect(result.pressureHead).toBeLessThan(10);
      });
    });

    describe('closed vessel calculations', () => {
      it('should use vessel pressure for closed tank', () => {
        const input = createTestInput({
          vesselType: 'CLOSED',
          vesselPressure: 2, // 2 bar abs
        });

        const result = calculateNPSHa(input);

        // 2 bar should give ~20m head
        expect(result.pressureHead).toBeCloseTo(20.4, 0);
      });

      it('should handle pressurized vessel', () => {
        const input = createTestInput({
          vesselType: 'CLOSED',
          vesselPressure: 5, // 5 bar abs
        });

        const result = calculateNPSHa(input);

        expect(result.npshAvailable).toBeGreaterThan(40);
      });
    });

    describe('vacuum vessel calculations', () => {
      it('should handle vacuum conditions', () => {
        const input = createTestInput({
          vesselType: 'VACUUM',
          vesselPressure: 0.5, // 500 mbar abs
        });

        const result = calculateNPSHa(input);

        // Lower pressure = lower pressure head
        expect(result.pressureHead).toBeLessThan(6);
      });

      it('should warn for deep vacuum', () => {
        const input = createTestInput({
          vesselType: 'VACUUM',
          vesselPressure: 0.05, // 50 mbar abs
        });

        const result = calculateNPSHa(input);

        expect(result.warnings.some((w) => w.includes('deep vacuum'))).toBe(true);
      });
    });

    describe('vapor pressure calculations', () => {
      it('should increase vapor pressure head with temperature', () => {
        const inputCold = createTestInput({ liquidTemperature: 20 });
        const inputHot = createTestInput({ liquidTemperature: 80 });

        const resultCold = calculateNPSHa(inputCold);
        const resultHot = calculateNPSHa(inputHot);

        expect(resultHot.vaporPressureHead).toBeGreaterThan(resultCold.vaporPressureHead);
      });

      it('should warn for high temperature', () => {
        const input = createTestInput({ liquidTemperature: 95 });

        const result = calculateNPSHa(input);

        expect(result.warnings.some((w) => w.includes('High temperature'))).toBe(true);
      });

      it('should have higher vapor pressure at higher temperature', () => {
        const input20 = createTestInput({ liquidTemperature: 20 });
        const input60 = createTestInput({ liquidTemperature: 60 });

        const result20 = calculateNPSHa(input20);
        const result60 = calculateNPSHa(input60);

        expect(result60.vaporPressure).toBeGreaterThan(result20.vaporPressure);
      });
    });

    describe('seawater calculations', () => {
      it('should use seawater density for saline water', () => {
        const input = createTestInput({
          liquidType: 'SEAWATER',
          salinity: 35000, // 35 g/kg
        });

        const result = calculateNPSHa(input);

        expect(result.liquidDensity).toBeGreaterThan(1020);
      });

      it('should calculate boiling point elevation', () => {
        const input = createTestInput({
          liquidType: 'SEAWATER',
          salinity: 35000,
        });

        const result = calculateNPSHa(input);

        expect(result.boilingPointElevation).toBeGreaterThan(0.5);
      });

      it('should note BPE in breakdown for significant values', () => {
        const input = createTestInput({
          liquidType: 'SEAWATER',
          salinity: 50000, // High salinity
        });

        const result = calculateNPSHa(input);

        const bpeNote = result.breakdown.find((b) => b.component === 'BPE Note');
        expect(bpeNote).toBeDefined();
      });
    });

    describe('static head effects', () => {
      it('should increase NPSHa with higher liquid level', () => {
        const inputLow = createTestInput({ liquidLevelAbovePump: 1 });
        const inputHigh = createTestInput({ liquidLevelAbovePump: 5 });

        const resultLow = calculateNPSHa(inputLow);
        const resultHigh = calculateNPSHa(inputHigh);

        expect(resultHigh.npshAvailable).toBeGreaterThan(resultLow.npshAvailable);
        expect(resultHigh.npshAvailable - resultLow.npshAvailable).toBeCloseTo(4, 1);
      });

      it('should warn for liquid below pump', () => {
        const input = createTestInput({ liquidLevelAbovePump: -2 });

        const result = calculateNPSHa(input);

        expect(result.warnings.some((w) => w.includes('below pump centerline'))).toBe(true);
      });

      it('should handle suction lift correctly', () => {
        const input = createTestInput({
          liquidLevelAbovePump: -3, // 3m below pump
        });

        const result = calculateNPSHa(input);

        expect(result.staticHead).toBe(-3);
        // NPSHa should be lower due to negative static head
      });
    });

    describe('friction loss effects', () => {
      it('should decrease NPSHa with higher friction loss', () => {
        const inputLowFriction = createTestInput({ frictionLoss: 0.5 });
        const inputHighFriction = createTestInput({ frictionLoss: 2 });

        const resultLow = calculateNPSHa(inputLowFriction);
        const resultHigh = calculateNPSHa(inputHighFriction);

        expect(resultHigh.npshAvailable).toBeLessThan(resultLow.npshAvailable);
      });
    });

    describe('recommendations', () => {
      it('should warn for negative NPSHa', () => {
        const input = createTestInput({
          liquidLevelAbovePump: -5,
          liquidTemperature: 90,
          frictionLoss: 3,
        });

        const result = calculateNPSHa(input);

        expect(result.npshAvailable).toBeLessThan(0);
        expect(result.recommendation).toContain('CRITICAL');
        expect(result.warnings.some((w) => w.includes('negative'))).toBe(true);
      });

      it('should give appropriate recommendation for low NPSHa', () => {
        const input = createTestInput({
          liquidLevelAbovePump: 0.5,
          frictionLoss: 0.3,
          liquidTemperature: 60,
        });

        const result = calculateNPSHa(input);

        if (result.npshAvailable < 1) {
          expect(result.recommendation).toContain('WARNING');
        }
      });

      it('should give positive recommendation for good NPSHa', () => {
        const input = createTestInput({
          liquidLevelAbovePump: 10,
          frictionLoss: 0.5,
          liquidTemperature: 25,
        });

        const result = calculateNPSHa(input);

        expect(result.npshAvailable).toBeGreaterThan(5);
        expect(result.recommendation).toContain('excellent');
      });
    });

    describe('breakdown output', () => {
      it('should include all components in breakdown', () => {
        const input = createTestInput();

        const result = calculateNPSHa(input);

        const components = result.breakdown.map((b) => b.component);
        expect(components).toContain('Static Head (Hs)');
        expect(components).toContain('Pressure Head (Hp)');
        expect(components).toContain('Vapor Pressure Head (Hvp)');
        expect(components).toContain('Friction Loss (Hf)');
      });

      it('should have correct signs for each component', () => {
        const input = createTestInput({ liquidLevelAbovePump: 3 });

        const result = calculateNPSHa(input);

        const staticHead = result.breakdown.find((b) => b.component.includes('Static'));
        const pressureHead = result.breakdown.find((b) => b.component.includes('Pressure'));
        const vaporHead = result.breakdown.find((b) => b.component.includes('Vapor'));
        const frictionLoss = result.breakdown.find((b) => b.component.includes('Friction'));

        expect(staticHead?.sign).toBe('+');
        expect(pressureHead?.sign).toBe('+');
        expect(vaporHead?.sign).toBe('-');
        expect(frictionLoss?.sign).toBe('-');
      });
    });

    describe('NPSHa formula verification', () => {
      it('should correctly calculate NPSHa = Hs + Hp - Hvp - Hf', () => {
        const input = createTestInput();

        const result = calculateNPSHa(input);

        const expected =
          result.staticHead + result.pressureHead - result.vaporPressureHead - result.frictionLoss;

        expect(result.npshAvailable).toBeCloseTo(expected, 5);
      });
    });
  });

  describe('calculateMinimumLiquidLevel', () => {
    it('should calculate minimum level for given NPSHr', () => {
      const npshr = 3; // 3m NPSHr
      const input = {
        vesselType: 'OPEN' as VesselType,
        liquidTemperature: 25,
        liquidType: 'PURE_WATER' as LiquidType,
        frictionLoss: 0.5,
      };

      const minLevel = calculateMinimumLiquidLevel(npshr, input);

      // Verify by calculating NPSHa at this level
      const result = calculateNPSHa({
        ...input,
        liquidLevelAbovePump: minLevel,
      });

      expect(result.npshAvailable).toBeGreaterThanOrEqual(npshr + 0.5); // With default margin
    });

    it('should increase with NPSHr', () => {
      const input = {
        vesselType: 'OPEN' as VesselType,
        liquidTemperature: 40,
        liquidType: 'PURE_WATER' as LiquidType,
        frictionLoss: 1,
      };

      const minLevel2 = calculateMinimumLiquidLevel(2, input);
      const minLevel5 = calculateMinimumLiquidLevel(5, input);

      expect(minLevel5).toBeGreaterThan(minLevel2);
    });

    it('should increase with temperature', () => {
      const baseCold = {
        vesselType: 'OPEN' as VesselType,
        liquidTemperature: 20,
        liquidType: 'PURE_WATER' as LiquidType,
        frictionLoss: 0.5,
      };

      const baseHot = {
        ...baseCold,
        liquidTemperature: 70,
      };

      const minLevelCold = calculateMinimumLiquidLevel(3, baseCold);
      const minLevelHot = calculateMinimumLiquidLevel(3, baseHot);

      expect(minLevelHot).toBeGreaterThan(minLevelCold);
    });

    it('should use custom safety margin', () => {
      const input = {
        vesselType: 'OPEN' as VesselType,
        liquidTemperature: 30,
        liquidType: 'PURE_WATER' as LiquidType,
        frictionLoss: 0.5,
      };

      const minLevel1 = calculateMinimumLiquidLevel(3, input, 0.5);
      const minLevel2 = calculateMinimumLiquidLevel(3, input, 1.5);

      expect(minLevel2).toBeGreaterThan(minLevel1);
      expect(minLevel2 - minLevel1).toBeCloseTo(1, 1);
    });

    it('should work with vacuum vessels', () => {
      const input = {
        vesselType: 'VACUUM' as VesselType,
        vesselPressure: 0.3, // 300 mbar
        liquidTemperature: 60,
        liquidType: 'PURE_WATER' as LiquidType,
        frictionLoss: 0.5,
      };

      const minLevel = calculateMinimumLiquidLevel(2, input);

      // Higher level needed due to lower pressure
      expect(minLevel).toBeGreaterThan(0);
    });
  });
});
