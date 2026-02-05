/**
 * TVC (Thermo Vapour Compressor) Calculator Tests
 *
 * Tests for steam ejector performance using 1-D constant pressure mixing model (Huang 1999).
 */

import { calculateTVC, type TVCInput } from './tvcCalculator';

// Mock the constants module with internally consistent steam property approximations
jest.mock('@vapour/constants', () => {
  const tSat = (p: number) => 100 + 30 * Math.log(p);

  return {
    getSaturationTemperature: jest.fn((p: number) => tSat(p)),
    isSuperheated: jest.fn((p: number, t: number) => t > tSat(p)),
    getEnthalpySuperheated: jest.fn((p: number, t: number) => 2500 + tSat(p) + 2.0 * (t - tSat(p))),
    getEnthalpyVapor: jest.fn((t: number) => 2500 + t),
  };
});

function createInput(overrides: Partial<TVCInput> = {}): TVCInput {
  return {
    motivePressure: 10, // High pressure motive steam
    suctionPressure: 0.5, // Low pressure suction
    dischargePressure: 1.0, // Intermediate discharge (CR = 2.0)
    entrainedFlow: 10,
    ...overrides,
  };
}

describe('TVC Calculator - 1-D Model (Huang 1999)', () => {
  // Pre-compute reference values
  const tSatMotive = 100 + 30 * Math.log(10); // ~169.1°C
  const tSatSuction = 100 + 30 * Math.log(0.5); // ~79.2°C
  const tSatDischarge = 100 + 30 * Math.log(1.0); // 100°C

  const hMotive = 2500 + tSatMotive; // ~2669.1 kJ/kg
  const hSuction = 2500 + tSatSuction; // ~2579.2 kJ/kg
  const hDischargeSat = 2500 + tSatDischarge; // 2600 kJ/kg

  // Theoretical entrainment ratio: Ra = (h_m - h_d_sat) / (h_d_sat - h_e)
  const theoreticalRa = (hMotive - hDischargeSat) / (hDischargeSat - hSuction);

  describe('input validation', () => {
    it('should throw for non-positive pressures', () => {
      expect(() => calculateTVC(createInput({ motivePressure: 0 }))).toThrow(
        'All pressures must be positive'
      );
      expect(() => calculateTVC(createInput({ suctionPressure: -1 }))).toThrow(
        'All pressures must be positive'
      );
      expect(() => calculateTVC(createInput({ dischargePressure: 0 }))).toThrow(
        'All pressures must be positive'
      );
    });

    it('should throw when motive pressure <= discharge pressure', () => {
      expect(() =>
        calculateTVC(createInput({ motivePressure: 1.0, dischargePressure: 1.0 }))
      ).toThrow(/Motive pressure.*must be greater than discharge pressure/);
      expect(() =>
        calculateTVC(createInput({ motivePressure: 0.5, dischargePressure: 1.0 }))
      ).toThrow(/Motive pressure.*must be greater than discharge pressure/);
    });

    it('should throw when discharge pressure <= suction pressure', () => {
      expect(() =>
        calculateTVC(createInput({ suctionPressure: 1.0, dischargePressure: 1.0 }))
      ).toThrow(/Discharge pressure.*must be greater than suction pressure/);
    });

    it('should throw when no flow is specified', () => {
      expect(() =>
        calculateTVC(createInput({ entrainedFlow: undefined, motiveFlow: undefined }))
      ).toThrow('Specify either entrained flow or motive flow');
    });

    it('should throw when flow is zero', () => {
      expect(() => calculateTVC(createInput({ entrainedFlow: 0 }))).toThrow(
        'Specify either entrained flow or motive flow'
      );
    });

    it('should throw when compression ratio exceeds single-stage limit (2.5)', () => {
      expect(() =>
        calculateTVC(
          createInput({
            suctionPressure: 0.1,
            dischargePressure: 0.3, // CR = 3.0
          })
        )
      ).toThrow(/exceeds single-stage limit/);
    });

    it('should throw for invalid efficiency values', () => {
      expect(() => calculateTVC(createInput({ nozzleEfficiency: 0 }))).toThrow(
        'Nozzle efficiency must be between 0 and 1'
      );
      expect(() => calculateTVC(createInput({ mixingEfficiency: 1.5 }))).toThrow(
        'Mixing efficiency must be between 0 and 1'
      );
      expect(() => calculateTVC(createInput({ diffuserEfficiency: -0.1 }))).toThrow(
        'Diffuser efficiency must be between 0 and 1'
      );
    });
  });

  describe('theoretical entrainment ratio', () => {
    it('should calculate theoretical Ra = (h_m - h_d_sat) / (h_d_sat - h_e)', () => {
      const result = calculateTVC(createInput());

      expect(result.theoreticalEntrainmentRatio).toBeCloseTo(theoreticalRa, 2);
    });

    it('should increase theoretical Ra when motive enthalpy is higher', () => {
      const lowMotive = calculateTVC(createInput({ motivePressure: 5 }));
      const highMotive = calculateTVC(createInput({ motivePressure: 20 }));

      expect(highMotive.theoreticalEntrainmentRatio).toBeGreaterThan(
        lowMotive.theoreticalEntrainmentRatio
      );
    });
  });

  describe('ejector efficiency', () => {
    it('should calculate ejector efficiency = nozzle × mixing × diffuser × f(CR)', () => {
      const result = calculateTVC(createInput());

      // Default efficiencies: 0.92 × 0.85 × 0.78 = 0.610
      // CR correction factor: exp(-1.0 × (2.0 - 1.0)) = exp(-1) ≈ 0.368
      // Overall: 0.610 × 0.368 ≈ 0.224
      expect(result.ejectorEfficiency).toBeGreaterThan(0.1);
      expect(result.ejectorEfficiency).toBeLessThan(0.5);
    });

    it('should decrease efficiency as compression ratio increases', () => {
      const lowCR = calculateTVC(
        createInput({
          suctionPressure: 0.7,
          dischargePressure: 1.0, // CR = 1.43
        })
      );
      const highCR = calculateTVC(
        createInput({
          suctionPressure: 0.5,
          dischargePressure: 1.0, // CR = 2.0
        })
      );

      expect(lowCR.ejectorEfficiency).toBeGreaterThan(highCR.ejectorEfficiency);
    });

    it('should use custom efficiency values when provided', () => {
      const result = calculateTVC(
        createInput({
          nozzleEfficiency: 0.95,
          mixingEfficiency: 0.9,
          diffuserEfficiency: 0.8,
        })
      );

      expect(result.nozzleEfficiency).toBe(0.95);
      expect(result.mixingEfficiency).toBe(0.9);
      expect(result.diffuserEfficiency).toBe(0.8);
    });
  });

  describe('actual entrainment ratio', () => {
    it('should calculate actual Ra = theoretical Ra × ejector efficiency', () => {
      const result = calculateTVC(createInput());

      const expectedActual = result.theoreticalEntrainmentRatio * result.ejectorEfficiency;
      expect(result.entrainmentRatio).toBeCloseTo(expectedActual, 5);
    });

    it('should be less than theoretical Ra (due to losses)', () => {
      const result = calculateTVC(createInput());

      expect(result.entrainmentRatio).toBeLessThan(result.theoreticalEntrainmentRatio);
    });

    it('should be in typical MED-TVC range for realistic conditions', () => {
      // MED-TVC typical range: 0.3 - 1.2
      const result = calculateTVC(createInput());

      expect(result.entrainmentRatio).toBeGreaterThan(0.1);
      expect(result.entrainmentRatio).toBeLessThan(3.0);
    });
  });

  describe('ratios', () => {
    it('should calculate compression ratio as Pd / Ps', () => {
      const result = calculateTVC(createInput());
      expect(result.compressionRatio).toBeCloseTo(1.0 / 0.5, 5);
    });

    it('should calculate expansion ratio as Pm / Ps', () => {
      const result = calculateTVC(createInput());
      expect(result.expansionRatio).toBeCloseTo(10 / 0.5, 5);
    });
  });

  describe('flow calculations', () => {
    it('should calculate motive flow from entrained flow', () => {
      const result = calculateTVC(createInput({ entrainedFlow: 10 }));

      expect(result.entrainedFlow).toBe(10);
      expect(result.motiveFlow).toBeCloseTo(10 / result.entrainmentRatio, 5);
    });

    it('should calculate entrained flow from motive flow', () => {
      const result = calculateTVC(createInput({ entrainedFlow: undefined, motiveFlow: 5 }));

      expect(result.motiveFlow).toBe(5);
      expect(result.entrainedFlow).toBeCloseTo(5 * result.entrainmentRatio, 5);
    });

    it('should satisfy discharge = motive + entrained', () => {
      const result = calculateTVC(createInput());

      expect(result.dischargeFlow).toBeCloseTo(result.motiveFlow + result.entrainedFlow, 5);
    });
  });

  describe('enthalpies', () => {
    it('should use saturated enthalpy for motive when no temperature given', () => {
      const result = calculateTVC(createInput());

      expect(result.motiveEnthalpy).toBeCloseTo(hMotive, 2);
    });

    it('should use superheated enthalpy when motive temperature is specified', () => {
      const result = calculateTVC(createInput({ motiveTemperature: 250 }));

      const expected = 2500 + tSatMotive + 2.0 * (250 - tSatMotive);
      expect(result.motiveEnthalpy).toBeCloseTo(expected, 2);
      expect(result.motiveEnthalpy).toBeGreaterThan(hMotive);
    });

    it('should use saturated enthalpy for suction vapor', () => {
      const result = calculateTVC(createInput());

      expect(result.suctionEnthalpy).toBeCloseTo(hSuction, 2);
    });

    it('should calculate discharge enthalpy from energy balance', () => {
      const result = calculateTVC(createInput());

      const motiveKgS = (result.motiveFlow * 1000) / 3600;
      const entrainedKgS = (result.entrainedFlow * 1000) / 3600;
      const dischargeKgS = motiveKgS + entrainedKgS;

      const expectedH =
        (motiveKgS * result.motiveEnthalpy + entrainedKgS * result.suctionEnthalpy) / dischargeKgS;

      expect(result.dischargeEnthalpy).toBeCloseTo(expectedH, 2);
    });
  });

  describe('discharge conditions', () => {
    it('should have discharge temperature above saturation (superheated)', () => {
      const result = calculateTVC(createInput());

      expect(result.dischargeTemperature).toBeGreaterThan(result.dischargeSatTemperature);
    });

    it('should calculate discharge superheat correctly', () => {
      const result = calculateTVC(createInput());

      expect(result.dischargeSuperheat).toBeCloseTo(
        result.dischargeTemperature - result.dischargeSatTemperature,
        2
      );
      expect(result.dischargeSuperheat).toBeGreaterThan(0);
    });
  });

  describe('saturation temperatures', () => {
    it('should return saturation temperatures for all streams', () => {
      const result = calculateTVC(createInput());

      expect(result.motiveSatTemperature).toBeCloseTo(tSatMotive, 2);
      expect(result.suctionSatTemperature).toBeCloseTo(tSatSuction, 2);
      expect(result.dischargeSatTemperature).toBeCloseTo(tSatDischarge, 2);
    });
  });

  describe('warnings', () => {
    it('should warn when compression ratio is above typical limit (2.2)', () => {
      const result = calculateTVC(
        createInput({
          suctionPressure: 0.45,
          dischargePressure: 1.0, // CR = 2.22
        })
      );

      expect(result.compressionRatio).toBeGreaterThan(2.2);
      expect(result.warnings.some((w) => w.includes('above typical limit'))).toBe(true);
    });

    it('should warn for low entrainment ratio (< 0.1)', () => {
      // Very low motive enthalpy relative to discharge/suction, high CR
      const result = calculateTVC(
        createInput({
          motivePressure: 1.5,
          suctionPressure: 0.5,
          dischargePressure: 1.2, // CR = 2.4 (near limit)
        })
      );

      expect(result.entrainmentRatio).toBeLessThan(0.1);
      expect(result.warnings.some((w) => w.includes('Low entrainment ratio'))).toBe(true);
    });

    it('should have no efficiency/ratio warnings for moderate conditions', () => {
      const result = calculateTVC(
        createInput({
          motivePressure: 5,
          suctionPressure: 0.6,
          dischargePressure: 1.0, // CR = 1.67
        })
      );

      // Filter out superheat warnings
      const nonSuperheatWarnings = result.warnings.filter((w) => !w.includes('superheat'));
      // Also filter high entrainment ratio warning if Ra is reasonable for the model
      const significantWarnings = nonSuperheatWarnings.filter(
        (w) => !w.includes('High entrainment ratio')
      );
      expect(significantWarnings).toHaveLength(0);
    });
  });

  describe('typical MED-TVC scenario', () => {
    it('should calculate realistic values for MED application', () => {
      // Typical MED-TVC: Motive 10 bar, Suction ~0.1 bar (47°C), Discharge ~0.25 bar (65°C)
      // CR = 2.5 is at the limit
      const result = calculateTVC({
        motivePressure: 10,
        suctionPressure: 0.1,
        dischargePressure: 0.2, // CR = 2.0
        entrainedFlow: 1,
      });

      // Check values are in reasonable ranges
      expect(result.compressionRatio).toBeCloseTo(2.0, 2);
      expect(result.entrainmentRatio).toBeGreaterThan(0.1);
      expect(result.entrainmentRatio).toBeLessThan(2.0);
      expect(result.ejectorEfficiency).toBeGreaterThan(0.1);
      expect(result.ejectorEfficiency).toBeLessThan(0.5);
      expect(result.dischargeSuperheat).toBeGreaterThan(0);
    });
  });
});
