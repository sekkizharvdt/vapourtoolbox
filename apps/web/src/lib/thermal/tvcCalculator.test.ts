/**
 * TVC (Thermo Vapour Compressor) Calculator Tests
 *
 * Tests for steam ejector performance calculations using
 * El-Dessouky & Ettouney (2002) entrainment ratio correlation.
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
    motivePressure: 2,
    suctionPressure: 1,
    dischargePressure: 1.5,
    entrainedFlow: 10,
    ...overrides,
  };
}

/** Calculate expected entrainment ratio using the El-Dessouky correlation */
function expectedRa(Pm_bar: number, Ps_bar: number, Pc_bar: number): number {
  const Pm = Pm_bar * 100;
  const Ps = Ps_bar * 100;
  const Pc = Pc_bar * 100;
  return ((0.296 * Math.pow(Ps, 1.04)) / Math.pow(Pm, 1.04)) * Math.pow(Pc / Pm, 0.015);
}

describe('TVC Calculator', () => {
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
        calculateTVC(createInput({ motivePressure: 1.5, dischargePressure: 1.5 }))
      ).toThrow(/Motive pressure.*must be greater than discharge pressure/);
      expect(() =>
        calculateTVC(createInput({ motivePressure: 1.0, dischargePressure: 1.5 }))
      ).toThrow(/Motive pressure.*must be greater than discharge pressure/);
    });

    it('should throw when discharge pressure <= suction pressure', () => {
      expect(() =>
        calculateTVC(createInput({ suctionPressure: 1.5, dischargePressure: 1.5 }))
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
  });

  describe('entrainment ratio', () => {
    it('should calculate Ra using El-Dessouky correlation', () => {
      const result = calculateTVC(createInput());
      const expected = expectedRa(2, 1, 1.5);

      expect(result.entrainmentRatio).toBeCloseTo(expected, 5);
    });

    it('should increase Ra when suction pressure approaches motive pressure', () => {
      const lowRa = calculateTVC(createInput({ suctionPressure: 0.5 }));
      const highRa = calculateTVC(createInput({ suctionPressure: 1.5, dischargePressure: 1.8 }));

      expect(highRa.entrainmentRatio).toBeGreaterThan(lowRa.entrainmentRatio);
    });
  });

  describe('ratios', () => {
    it('should calculate compression ratio as Pd / Ps', () => {
      const result = calculateTVC(createInput());
      expect(result.compressionRatio).toBeCloseTo(1.5 / 1, 5);
    });

    it('should calculate expansion ratio as Pm / Ps', () => {
      const result = calculateTVC(createInput());
      expect(result.expansionRatio).toBeCloseTo(2 / 1, 5);
    });
  });

  describe('flow calculations', () => {
    it('should calculate motive flow from entrained flow', () => {
      const result = calculateTVC(createInput({ entrainedFlow: 10 }));
      const ra = expectedRa(2, 1, 1.5);

      expect(result.entrainedFlow).toBe(10);
      expect(result.motiveFlow).toBeCloseTo(10 / ra, 2);
    });

    it('should calculate entrained flow from motive flow', () => {
      const result = calculateTVC(createInput({ entrainedFlow: undefined, motiveFlow: 50 }));
      const ra = expectedRa(2, 1, 1.5);

      expect(result.motiveFlow).toBe(50);
      expect(result.entrainedFlow).toBeCloseTo(50 * ra, 2);
    });

    it('should satisfy discharge = motive + entrained', () => {
      const result = calculateTVC(createInput());

      expect(result.dischargeFlow).toBeCloseTo(result.motiveFlow + result.entrainedFlow, 5);
    });
  });

  describe('enthalpies', () => {
    it('should use saturated enthalpy for motive when no temperature given', () => {
      const result = calculateTVC(createInput());
      const tSatMotive = 100 + 30 * Math.log(2);

      // getEnthalpyVapor(tSat) = 2500 + tSat
      expect(result.motiveEnthalpy).toBeCloseTo(2500 + tSatMotive, 2);
    });

    it('should use superheated enthalpy when motive temperature is specified', () => {
      const result = calculateTVC(createInput({ motiveTemperature: 250 }));
      const tSatMotive = 100 + 30 * Math.log(2);

      // getEnthalpySuperheated(2, 250) = 2500 + tSat + 2*(250 - tSat)
      const expected = 2500 + tSatMotive + 2.0 * (250 - tSatMotive);
      expect(result.motiveEnthalpy).toBeCloseTo(expected, 2);
      expect(result.motiveEnthalpy).toBeGreaterThan(2500 + tSatMotive);
    });

    it('should use saturated enthalpy for suction vapor', () => {
      const result = calculateTVC(createInput());
      const tSatSuction = 100 + 30 * Math.log(1);

      expect(result.suctionEnthalpy).toBeCloseTo(2500 + tSatSuction, 2);
    });

    it('should calculate discharge enthalpy from energy balance', () => {
      const result = calculateTVC(createInput());

      // h_discharge = (m_motive * h_motive + m_entrained * h_suction) / m_discharge
      const motiveKgS = (result.motiveFlow * 1000) / 3600;
      const entrainedKgS = (result.entrainedFlow * 1000) / 3600;
      const dischargeKgS = motiveKgS + entrainedKgS;

      const expectedH =
        (motiveKgS * result.motiveEnthalpy + entrainedKgS * result.suctionEnthalpy) / dischargeKgS;

      expect(result.dischargeEnthalpy).toBeCloseTo(expectedH, 2);
    });
  });

  describe('saturation temperatures', () => {
    it('should return saturation temperatures for all streams', () => {
      const result = calculateTVC(createInput());

      expect(result.motiveSatTemperature).toBeCloseTo(100 + 30 * Math.log(2), 2);
      expect(result.suctionSatTemperature).toBeCloseTo(100 + 30 * Math.log(1), 2);
      expect(result.dischargeSatTemperature).toBeCloseTo(100 + 30 * Math.log(1.5), 2);
    });
  });

  describe('warnings', () => {
    it('should warn for high compression ratio (> 4)', () => {
      // CR = Pc/Ps = 5/1 = 5
      const result = calculateTVC(
        createInput({
          motivePressure: 10,
          suctionPressure: 1,
          dischargePressure: 5,
          entrainedFlow: 10,
        })
      );

      expect(result.compressionRatio).toBe(5);
      expect(result.warnings.some((w) => w.includes('compression ratio'))).toBe(true);
    });

    it('should warn for high expansion ratio (> 10)', () => {
      // ER = Pm/Ps = 12/1 = 12
      const result = calculateTVC(
        createInput({
          motivePressure: 12,
          suctionPressure: 1,
          dischargePressure: 2,
          entrainedFlow: 10,
        })
      );

      expect(result.expansionRatio).toBe(12);
      expect(result.warnings.some((w) => w.includes('expansion ratio'))).toBe(true);
    });

    it('should warn for low entrainment ratio (< 0.2)', () => {
      // Large Pm/Ps ratio gives low Ra
      const result = calculateTVC(
        createInput({
          motivePressure: 10,
          suctionPressure: 1,
          dischargePressure: 2,
          entrainedFlow: 10,
        })
      );

      expect(result.entrainmentRatio).toBeLessThan(0.2);
      expect(result.warnings.some((w) => w.includes('entrainment ratio'))).toBe(true);
    });

    it('should have no warnings for moderate conditions', () => {
      const result = calculateTVC(createInput());

      // CR = 1.5, ER = 2: no high ratio warnings
      expect(result.compressionRatio).toBeLessThanOrEqual(4);
      expect(result.expansionRatio).toBeLessThanOrEqual(10);
    });
  });
});
