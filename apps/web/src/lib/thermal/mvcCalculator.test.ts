/**
 * MVC (Mechanical Vapour Compressor) Calculator Tests
 *
 * Tests for isentropic vapor compression calculations including
 * bisection solvers, power calculations, and efficiency corrections.
 */

import { calculateMVC, type MVCInput } from './mvcCalculator';

// Mock the constants module with internally consistent steam property approximations.
// These are simple functions chosen so that:
// - Entropy and enthalpy are monotonically increasing with temperature
// - Properties at saturation are consistent between functions
// - Bisection solvers converge reliably
jest.mock('@vapour/constants', () => {
  const tSat = (p: number) => 100 + 30 * Math.log(p);

  return {
    getSaturationTemperature: jest.fn((p: number) => tSat(p)),
    isSuperheated: jest.fn((p: number, t: number) => t > tSat(p)),
    getEnthalpySuperheated: jest.fn((p: number, t: number) => 2500 + tSat(p) + 2.0 * (t - tSat(p))),
    getEntropySuperheated: jest.fn(
      (p: number, t: number) => 7.5 - 0.5 * Math.log(p) + 0.005 * (t - tSat(p))
    ),
    getSpecificVolumeSuperheated: jest.fn(
      (p: number, t: number) => (0.461 * (t + 273.15)) / (p * 100)
    ),
  };
});

function createInput(overrides: Partial<MVCInput> = {}): MVCInput {
  return {
    suctionPressure: 0.5,
    dischargePressure: 1.0,
    flowRate: 10,
    ...overrides,
  };
}

describe('MVC Calculator', () => {
  // Pre-compute reference value for default suction pressure
  const tSatSuction = 100 + 30 * Math.log(0.5); // ≈ 79.21

  describe('input validation', () => {
    it('should throw for non-positive pressures', () => {
      expect(() => calculateMVC(createInput({ suctionPressure: 0 }))).toThrow(
        'Pressures must be positive'
      );
      expect(() => calculateMVC(createInput({ dischargePressure: -1 }))).toThrow(
        'Pressures must be positive'
      );
    });

    it('should throw when discharge <= suction', () => {
      expect(() => calculateMVC(createInput({ suctionPressure: 1, dischargePressure: 1 }))).toThrow(
        /Discharge pressure.*must be greater than suction pressure/
      );
      expect(() => calculateMVC(createInput({ suctionPressure: 2, dischargePressure: 1 }))).toThrow(
        /Discharge pressure.*must be greater than suction pressure/
      );
    });

    it('should throw for non-positive flow rate', () => {
      expect(() => calculateMVC(createInput({ flowRate: 0 }))).toThrow(
        'Flow rate must be positive'
      );
    });

    it('should throw for isentropic efficiency out of range', () => {
      expect(() => calculateMVC(createInput({ isentropicEfficiency: 0 }))).toThrow(
        'Isentropic efficiency must be between 0 and 1'
      );
      expect(() => calculateMVC(createInput({ isentropicEfficiency: 1.1 }))).toThrow(
        'Isentropic efficiency must be between 0 and 1'
      );
    });

    it('should throw for mechanical efficiency out of range', () => {
      expect(() => calculateMVC(createInput({ mechanicalEfficiency: 0 }))).toThrow(
        'Mechanical efficiency must be between 0 and 1'
      );
      expect(() => calculateMVC(createInput({ mechanicalEfficiency: 1.5 }))).toThrow(
        'Mechanical efficiency must be between 0 and 1'
      );
    });

    it('should throw when suction temperature is not superheated', () => {
      expect(() => calculateMVC(createInput({ suctionTemperature: 50 }))).toThrow(
        /Suction temperature.*must be above saturation/
      );
    });
  });

  describe('default parameters', () => {
    it('should use Tsat + 0.5 for saturated vapor when no suction temperature given', () => {
      const result = calculateMVC(createInput());

      // Reported suctionTemperature is Tsat (not Tsat+0.5)
      expect(result.suctionTemperature).toBeCloseTo(tSatSuction, 1);
    });

    it('should use default isentropic efficiency 0.75', () => {
      const result = calculateMVC(createInput());
      expect(result.isentropicEfficiency).toBe(0.75);
    });

    it('should use default mechanical efficiency 0.95', () => {
      const result = calculateMVC(createInput());
      expect(result.mechanicalEfficiency).toBe(0.95);
    });

    it('should accept custom efficiencies', () => {
      const result = calculateMVC(
        createInput({ isentropicEfficiency: 0.8, mechanicalEfficiency: 0.9 })
      );
      expect(result.isentropicEfficiency).toBe(0.8);
      expect(result.mechanicalEfficiency).toBe(0.9);
    });
  });

  describe('compression calculations', () => {
    it('should calculate compression ratio', () => {
      const result = calculateMVC(createInput());
      expect(result.compressionRatio).toBeCloseTo(1.0 / 0.5, 5);
    });

    it('should have isentropic power < shaft power', () => {
      const result = calculateMVC(createInput());

      expect(result.isentropicPower).toBeGreaterThan(0);
      expect(result.shaftPower).toBeGreaterThan(result.isentropicPower);
    });

    it('should have shaft power < electrical power', () => {
      const result = calculateMVC(createInput());

      expect(result.electricalPower).toBeGreaterThan(result.shaftPower);
      expect(result.electricalPower).toBeCloseTo(result.shaftPower / 0.95, 1);
    });

    it('should calculate specific energy as electrical / flowRate', () => {
      const result = calculateMVC(createInput());

      expect(result.specificEnergy).toBeCloseTo(result.electricalPower / 10, 2);
    });

    it('should calculate positive volumetric flow at suction', () => {
      const result = calculateMVC(createInput());

      expect(result.volumetricFlowSuction).toBeGreaterThan(0);
    });
  });

  describe('thermodynamic state', () => {
    it('should have discharge temperature > suction temperature', () => {
      const result = calculateMVC(createInput());

      expect(result.dischargeTemperatureActual).toBeGreaterThan(result.suctionTemperature);
      expect(result.dischargeTemperatureIsentropic).toBeGreaterThan(result.suctionTemperature);
    });

    it('should have actual discharge temperature > isentropic discharge temperature', () => {
      const result = calculateMVC(createInput());

      // Due to inefficiency, actual work > isentropic work → higher temperature
      expect(result.dischargeTemperatureActual).toBeGreaterThan(
        result.dischargeTemperatureIsentropic
      );
    });

    it('should have actual enthalpy > isentropic enthalpy', () => {
      const result = calculateMVC(createInput());

      expect(result.dischargeEnthalpyActual).toBeGreaterThan(result.dischargeEnthalpyIsentropic);
    });

    it('should satisfy h_actual = h_in + (h_is - h_in) / eta_is', () => {
      const result = calculateMVC(createInput());

      const expectedH =
        result.suctionEnthalpy +
        (result.dischargeEnthalpyIsentropic - result.suctionEnthalpy) / 0.75;

      expect(result.dischargeEnthalpyActual).toBeCloseTo(expectedH, 1);
    });

    it('should return suction entropy', () => {
      const result = calculateMVC(createInput());

      expect(result.suctionEntropy).toBeGreaterThan(0);
    });

    it('should accept superheated suction temperature', () => {
      const superheatedT = tSatSuction + 20;
      const result = calculateMVC(createInput({ suctionTemperature: superheatedT }));

      expect(result.suctionTemperature).toBeCloseTo(superheatedT, 1);
    });
  });

  describe('power relationships', () => {
    it('should increase power with higher compression ratio', () => {
      const lowCR = calculateMVC(createInput({ dischargePressure: 0.8 }));
      const highCR = calculateMVC(createInput({ dischargePressure: 1.5 }));

      expect(highCR.shaftPower).toBeGreaterThan(lowCR.shaftPower);
    });

    it('should increase power with higher flow rate', () => {
      const lowFlow = calculateMVC(createInput({ flowRate: 5 }));
      const highFlow = calculateMVC(createInput({ flowRate: 20 }));

      expect(highFlow.shaftPower).toBeGreaterThan(lowFlow.shaftPower);
      // Power should scale linearly with flow
      expect(highFlow.shaftPower / lowFlow.shaftPower).toBeCloseTo(4, 1);
    });

    it('should increase shaft power with lower isentropic efficiency', () => {
      const highEta = calculateMVC(createInput({ isentropicEfficiency: 0.85 }));
      const lowEta = calculateMVC(createInput({ isentropicEfficiency: 0.65 }));

      expect(lowEta.shaftPower).toBeGreaterThan(highEta.shaftPower);
    });

    it('should have equal specific energy regardless of flow rate', () => {
      const flow5 = calculateMVC(createInput({ flowRate: 5 }));
      const flow20 = calculateMVC(createInput({ flowRate: 20 }));

      expect(flow5.specificEnergy).toBeCloseTo(flow20.specificEnergy, 1);
    });
  });

  describe('warnings', () => {
    it('should warn for high compression ratio (> 3)', () => {
      // CR = 2.0/0.5 = 4
      const result = calculateMVC(createInput({ suctionPressure: 0.5, dischargePressure: 2.0 }));

      expect(result.compressionRatio).toBe(4);
      expect(result.warnings.some((w) => w.includes('compression ratio'))).toBe(true);
    });

    it('should warn for low isentropic efficiency (< 0.6)', () => {
      const result = calculateMVC(createInput({ isentropicEfficiency: 0.55 }));

      expect(result.warnings.some((w) => w.includes('Low isentropic efficiency'))).toBe(true);
    });

    it('should warn for high isentropic efficiency (> 0.85)', () => {
      const result = calculateMVC(createInput({ isentropicEfficiency: 0.9 }));

      expect(result.warnings.some((w) => w.includes('High isentropic efficiency'))).toBe(true);
    });

    it('should have no warnings for default parameters', () => {
      const result = calculateMVC(createInput());

      // CR = 2, eta_is = 0.75: no warnings expected
      expect(result.compressionRatio).toBeLessThanOrEqual(3);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
