/**
 * Desuperheating Calculator Tests
 *
 * Tests for spray water requirement calculations using energy balance.
 */

import { calculateDesuperheating, type DesuperheatingInput } from './desuperheatingCalculator';

// Mock the constants module with internally consistent steam property approximations
jest.mock('@vapour/constants', () => {
  const tSat = (p: number) => 100 + 30 * Math.log(p);

  return {
    getSaturationTemperature: jest.fn((p: number) => tSat(p)),
    isSuperheated: jest.fn((p: number, t: number) => t > tSat(p)),
    getEnthalpySuperheated: jest.fn((p: number, t: number) => 2500 + tSat(p) + 2.0 * (t - tSat(p))),
    getEnthalpyVapor: jest.fn((t: number) => 2500 + t),
    getEnthalpyLiquid: jest.fn((t: number) => 4.18 * t),
  };
});

function createInput(overrides: Partial<DesuperheatingInput> = {}): DesuperheatingInput {
  return {
    steamPressure: 5,
    steamTemperature: 250,
    targetTemperature: 160,
    sprayWaterTemperature: 30,
    steamFlow: 10,
    ...overrides,
  };
}

describe('Desuperheating Calculator', () => {
  // Pre-compute reference values for default input (5 bar)
  const tSat5 = 100 + 30 * Math.log(5); // ≈ 148.28

  describe('input validation', () => {
    it('should throw for non-positive pressure', () => {
      expect(() => calculateDesuperheating(createInput({ steamPressure: 0 }))).toThrow(
        'Steam pressure must be positive'
      );
      expect(() => calculateDesuperheating(createInput({ steamPressure: -1 }))).toThrow(
        'Steam pressure must be positive'
      );
    });

    it('should throw when steam is not superheated', () => {
      expect(() => calculateDesuperheating(createInput({ steamTemperature: 100 }))).toThrow(
        /Steam must be superheated/
      );
    });

    it('should throw when target is below saturation', () => {
      expect(() => calculateDesuperheating(createInput({ targetTemperature: 50 }))).toThrow(
        /cannot be below saturation/
      );
    });

    it('should throw when target >= inlet temperature', () => {
      expect(() => calculateDesuperheating(createInput({ targetTemperature: 250 }))).toThrow(
        /must be below inlet temperature/
      );
      expect(() => calculateDesuperheating(createInput({ targetTemperature: 300 }))).toThrow(
        /must be below inlet temperature/
      );
    });

    it('should throw for non-positive steam flow', () => {
      expect(() => calculateDesuperheating(createInput({ steamFlow: 0 }))).toThrow(
        'Steam flow must be positive'
      );
      expect(() => calculateDesuperheating(createInput({ steamFlow: -5 }))).toThrow(
        'Steam flow must be positive'
      );
    });
  });

  describe('energy balance', () => {
    it('should calculate correct spray water flow', () => {
      const result = calculateDesuperheating(createInput());

      // h_steam = 2500 + tSat + 2*(250 - tSat) = 2500 + tSat + 2*101.72
      // h_target = 2500 + tSat + 2*(160 - tSat) = 2500 + tSat + 2*11.72
      // h_water = 4.18 * 30 = 125.4
      // ratio = (h_steam - h_target) / (h_target - h_water) = 2*(250-160) / (2500+tSat+23.44 - 125.4)
      // = 180 / (2500 + 148.28 + 23.44 - 125.4) = 180 / 2546.32
      const steamEnthalpy = 2500 + tSat5 + 2.0 * (250 - tSat5);
      const targetEnthalpy = 2500 + tSat5 + 2.0 * (160 - tSat5);
      const waterEnthalpy = 4.18 * 30;
      const expectedRatio = (steamEnthalpy - targetEnthalpy) / (targetEnthalpy - waterEnthalpy);

      expect(result.waterToSteamRatio).toBeCloseTo(expectedRatio, 4);
      expect(result.sprayWaterFlow).toBeCloseTo(10 * expectedRatio, 3);
    });

    it('should calculate correct total outlet flow', () => {
      const result = calculateDesuperheating(createInput());

      expect(result.totalOutletFlow).toBeCloseTo(
        result.steamEnthalpy > 0 ? 10 + result.sprayWaterFlow : 0,
        4
      );
      expect(result.totalOutletFlow).toBeGreaterThan(10);
    });

    it('should calculate correct heat removed', () => {
      const result = calculateDesuperheating(createInput());

      // heatRemoved = massFlowKgS * (h_steam - h_target)
      const massFlowKgS = (10 * 1000) / 3600;
      const expectedHeat = massFlowKgS * (result.steamEnthalpy - result.targetEnthalpy);
      expect(result.heatRemoved).toBeCloseTo(expectedHeat, 1);
    });

    it('should use saturated vapor enthalpy when target is at saturation', () => {
      // Set target to exactly Tsat so outletSuperheat = 0
      const result = calculateDesuperheating(createInput({ targetTemperature: tSat5 }));

      // When outletSuperheat ≤ 0.1, uses getEnthalpyVapor(tSat) = 2500 + tSat
      const expectedTargetEnthalpy = 2500 + tSat5;
      expect(result.targetEnthalpy).toBeCloseTo(expectedTargetEnthalpy, 2);
      expect(result.outletSuperheat).toBe(0);
    });

    it('should satisfy energy balance: m_steam × h_steam + m_water × h_water = m_total × h_target', () => {
      const result = calculateDesuperheating(createInput());

      const steamEnergy = 10 * result.steamEnthalpy;
      const waterEnergy = result.sprayWaterFlow * result.sprayWaterEnthalpy;
      const outletEnergy = result.totalOutletFlow * result.targetEnthalpy;

      expect(steamEnergy + waterEnergy).toBeCloseTo(outletEnergy, 1);
    });
  });

  describe('temperature analysis', () => {
    it('should calculate degrees of superheat', () => {
      const result = calculateDesuperheating(createInput());

      expect(result.degreesOfSuperheat).toBeCloseTo(250 - tSat5, 2);
    });

    it('should calculate outlet superheat', () => {
      const result = calculateDesuperheating(createInput());

      expect(result.outletSuperheat).toBeCloseTo(160 - tSat5, 2);
      expect(result.outletSuperheat).toBeGreaterThan(0);
    });

    it('should return zero outlet superheat when target is at saturation', () => {
      const result = calculateDesuperheating(createInput({ targetTemperature: tSat5 }));

      expect(result.outletSuperheat).toBe(0);
    });

    it('should return saturation temperature', () => {
      const result = calculateDesuperheating(createInput());

      expect(result.saturationTemperature).toBeCloseTo(tSat5, 2);
    });
  });

  describe('enthalpies', () => {
    it('should return correct steam enthalpy', () => {
      const result = calculateDesuperheating(createInput());
      const expected = 2500 + tSat5 + 2.0 * (250 - tSat5);
      expect(result.steamEnthalpy).toBeCloseTo(expected, 2);
    });

    it('should return correct spray water enthalpy', () => {
      const result = calculateDesuperheating(createInput());
      expect(result.sprayWaterEnthalpy).toBeCloseTo(4.18 * 30, 2);
    });
  });

  describe('warnings', () => {
    it('should warn when spray water is at or above saturation', () => {
      const result = calculateDesuperheating(createInput({ sprayWaterTemperature: 150 }));

      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings.some((w) => w.includes('at or above saturation'))).toBe(true);
    });

    it('should warn for high water-to-steam ratio', () => {
      // High superheat with near-saturation target
      const result = calculateDesuperheating(
        createInput({
          steamTemperature: 600,
          targetTemperature: Math.ceil(tSat5) + 1, // just above Tsat
        })
      );

      expect(result.waterToSteamRatio).toBeGreaterThan(0.3);
      expect(result.warnings.some((w) => w.includes('water-to-steam ratio'))).toBe(true);
    });

    it('should have no warnings for normal conditions', () => {
      const result = calculateDesuperheating(createInput());

      expect(result.warnings).toHaveLength(0);
    });
  });
});
