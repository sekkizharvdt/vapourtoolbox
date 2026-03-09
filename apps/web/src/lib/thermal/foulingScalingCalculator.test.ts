/**
 * Fouling and Scaling Prediction Calculator Tests
 *
 * Tests for scaling and fouling prediction calculations including:
 * - CaSO4 solubility model
 * - CaSO4 saturation index
 * - Langelier Saturation Index (LSI)
 * - Mg(OH)2 risk evaluation
 * - Recommended fouling resistance
 * - Max TBT determination (with and without antiscalant)
 * - Warning generation
 * - Input validation
 */

import {
  calculateFoulingScaling,
  getCaSO4Solubility,
  getCaSO4BrineConcentration,
  getCaSO4SaturationIndex,
  calculateLSI,
  evaluateMgOH2Risk,
  getRecommendedFouling,
  STANDARD_SEAWATER_CHEMISTRY,
  SCALING_THRESHOLDS,
} from './foulingScalingCalculator';
import type { FoulingScalingInput } from './foulingScalingCalculator';

// ============================================================================
// Test Helpers
// ============================================================================

/** Standard seawater at typical MED temperature range */
function getStandardInput(overrides?: Partial<FoulingScalingInput>): FoulingScalingInput {
  return {
    feedSalinity: 35000,
    calciumConcentration: 420,
    sulfateConcentration: 2700,
    bicarbonateAlkalinity: 140,
    magnesiumConcentration: 1290,
    pH: 8.1,
    temperatureMin: 40,
    temperatureMax: 70,
    temperatureSteps: 7,
    concentrationFactor: 1.5,
    antiscalantDosed: false,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('foulingScalingCalculator', () => {
  // --------------------------------------------------------------------------
  // CaSO4 Solubility Model
  // --------------------------------------------------------------------------
  describe('getCaSO4Solubility', () => {
    it('returns positive solubility for standard seawater temperatures', () => {
      for (let t = 40; t <= 70; t += 5) {
        const sol = getCaSO4Solubility(t, 35000);
        expect(sol).toBeGreaterThan(0);
      }
    });

    it('uses gypsum correlation below 40 deg C', () => {
      const sol30 = getCaSO4Solubility(30, 35000);
      const sol35 = getCaSO4Solubility(35, 35000);
      // Both should be positive
      expect(sol30).toBeGreaterThan(0);
      expect(sol35).toBeGreaterThan(0);
    });

    it('uses anhydrite correlation at and above 40 deg C', () => {
      const sol40 = getCaSO4Solubility(40, 35000);
      const sol50 = getCaSO4Solubility(50, 35000);
      expect(sol40).toBeGreaterThan(0);
      expect(sol50).toBeGreaterThan(0);
    });

    it('solubility decreases with increasing temperature (inverse solubility)', () => {
      const sol50 = getCaSO4Solubility(50, 35000);
      const sol60 = getCaSO4Solubility(60, 35000);
      const sol70 = getCaSO4Solubility(70, 35000);
      // CaSO4 has inverse solubility — decreases with temperature (above ~40 C)
      expect(sol60).toBeLessThan(sol50);
      expect(sol70).toBeLessThan(sol60);
    });

    it('higher salinity increases solubility (ionic strength effect)', () => {
      const solLow = getCaSO4Solubility(60, 20000);
      const solHigh = getCaSO4Solubility(60, 50000);
      expect(solHigh).toBeGreaterThan(solLow);
    });

    it('never returns less than 10 mg/L (floor)', () => {
      // Very extreme conditions
      const sol = getCaSO4Solubility(120, 1000);
      expect(sol).toBeGreaterThanOrEqual(10);
    });
  });

  // --------------------------------------------------------------------------
  // CaSO4 Brine Concentration
  // --------------------------------------------------------------------------
  describe('getCaSO4BrineConcentration', () => {
    it('scales linearly with concentration factor', () => {
      const conc1 = getCaSO4BrineConcentration(420, 1.0);
      const conc2 = getCaSO4BrineConcentration(420, 2.0);
      expect(conc2).toBeCloseTo(conc1 * 2, 4);
    });

    it('converts Ca2+ to CaSO4 equivalent using molar mass ratio', () => {
      const conc = getCaSO4BrineConcentration(420, 1.0);
      // 420 * 136.14 / 40.08 = 420 * 3.397 = ~1426.7
      expect(conc).toBeCloseTo(420 * (136.14 / 40.08), 0);
    });
  });

  // --------------------------------------------------------------------------
  // CaSO4 Saturation Index
  // --------------------------------------------------------------------------
  describe('getCaSO4SaturationIndex', () => {
    it('returns ratio of brine concentration to solubility', () => {
      const si = getCaSO4SaturationIndex(1000, 2000);
      expect(si).toBeCloseTo(0.5, 6);
    });

    it('returns > 1 when supersaturated', () => {
      const si = getCaSO4SaturationIndex(3000, 2000);
      expect(si).toBeGreaterThan(1);
    });

    it('returns Infinity when solubility is zero', () => {
      const si = getCaSO4SaturationIndex(1000, 0);
      expect(si).toBe(Infinity);
    });

    it('CaSO4 saturation index increases with temperature for standard seawater', () => {
      const brineCaSO4 = getCaSO4BrineConcentration(420, 1.5);
      const si50 = getCaSO4SaturationIndex(brineCaSO4, getCaSO4Solubility(50, 52500));
      const si70 = getCaSO4SaturationIndex(brineCaSO4, getCaSO4Solubility(70, 52500));
      // Higher temp => lower solubility => higher SI
      expect(si70).toBeGreaterThan(si50);
    });
  });

  // --------------------------------------------------------------------------
  // LSI Calculation
  // --------------------------------------------------------------------------
  describe('calculateLSI', () => {
    it('returns a number for typical seawater conditions', () => {
      const lsi = calculateLSI(8.1, 52500, 60, 630, 210);
      expect(typeof lsi).toBe('number');
      expect(isFinite(lsi)).toBe(true);
    });

    it('positive LSI for concentrated seawater at elevated temperature', () => {
      // Concentrated seawater (CF=1.5) at 65 deg C — should tend towards positive LSI
      const lsi = calculateLSI(8.1, 52500, 65, 630, 210);
      // With high Ca and alkalinity, LSI should be positive (scaling tendency)
      expect(lsi).toBeGreaterThan(0);
    });

    it('lower pH reduces LSI (less scaling tendency)', () => {
      const lsiHigh = calculateLSI(8.5, 52500, 60, 630, 210);
      const lsiLow = calculateLSI(7.0, 52500, 60, 630, 210);
      expect(lsiLow).toBeLessThan(lsiHigh);
    });

    it('higher temperature affects LSI through the B factor', () => {
      const lsi40 = calculateLSI(8.1, 52500, 40, 630, 210);
      const lsi70 = calculateLSI(8.1, 52500, 70, 630, 210);
      // B changes with temperature; both should be finite
      expect(isFinite(lsi40)).toBe(true);
      expect(isFinite(lsi70)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Mg(OH)2 Risk
  // --------------------------------------------------------------------------
  describe('evaluateMgOH2Risk', () => {
    it('returns false at typical MED conditions (60 deg C, pH 8.1)', () => {
      expect(evaluateMgOH2Risk(60, 8.1, 1935)).toBe(false);
    });

    it('returns false when temperature is below 70 deg C even with high pH', () => {
      expect(evaluateMgOH2Risk(65, 9.5, 2000)).toBe(false);
    });

    it('returns true at high temperature, high pH, and high Mg', () => {
      // T > 70, pH > critical, Mg > 500
      expect(evaluateMgOH2Risk(80, 9.5, 2000)).toBe(true);
    });

    it('returns false when Mg is low even at high temp and pH', () => {
      expect(evaluateMgOH2Risk(80, 9.5, 300)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Recommended Fouling
  // --------------------------------------------------------------------------
  describe('getRecommendedFouling', () => {
    it('returns 0.00025 for SI > 1.0 (heavy fouling)', () => {
      expect(getRecommendedFouling(60, 1.1)).toBe(0.00025);
    });

    it('returns 0.00015 for SI > 0.7 (moderate fouling)', () => {
      expect(getRecommendedFouling(60, 0.8)).toBe(0.00015);
    });

    it('returns 0.00012 for high-temp with low SI', () => {
      expect(getRecommendedFouling(70, 0.5)).toBe(0.00012);
    });

    it('returns 0.00009 for clean service (low temp, low SI)', () => {
      expect(getRecommendedFouling(50, 0.3)).toBe(0.00009);
    });
  });

  // --------------------------------------------------------------------------
  // Max TBT Determination
  // --------------------------------------------------------------------------
  describe('max TBT determination', () => {
    it('maxTBT_noAntiscalant is within the evaluated temperature range', () => {
      const result = calculateFoulingScaling(getStandardInput());
      expect(result.maxTBT_noAntiscalant).toBeGreaterThanOrEqual(40);
      expect(result.maxTBT_noAntiscalant).toBeLessThanOrEqual(70);
    });

    it('maxTBT_withAntiscalant is >= maxTBT_noAntiscalant when antiscalant is dosed', () => {
      const result = calculateFoulingScaling(getStandardInput({ antiscalantDosed: true }));
      expect(result.maxTBT_withAntiscalant).toBeGreaterThanOrEqual(result.maxTBT_noAntiscalant);
    });

    it('antiscalant effect increases allowable TBT', () => {
      const withoutAS = calculateFoulingScaling(getStandardInput({ antiscalantDosed: false }));
      const withAS = calculateFoulingScaling(
        getStandardInput({ antiscalantDosed: true, antiscalantEfficiency: 0.85 })
      );
      expect(withAS.maxTBT_withAntiscalant).toBeGreaterThanOrEqual(withoutAS.maxTBT_noAntiscalant);
    });

    it('higher concentration factor reduces max TBT (more scaling)', () => {
      const lowCF = calculateFoulingScaling(getStandardInput({ concentrationFactor: 1.3 }));
      const highCF = calculateFoulingScaling(getStandardInput({ concentrationFactor: 2.0 }));
      expect(highCF.maxTBT_noAntiscalant).toBeLessThanOrEqual(lowCF.maxTBT_noAntiscalant);
    });
  });

  // --------------------------------------------------------------------------
  // Main Calculator — Standard Seawater
  // --------------------------------------------------------------------------
  describe('calculateFoulingScaling — standard seawater', () => {
    it('returns a valid result for standard seawater at typical MED temperatures', () => {
      const result = calculateFoulingScaling(getStandardInput());

      expect(result.scalingProfile).toHaveLength(7);
      expect(result.brineConcentration).toBe(52500);
      expect(result.brineCaSO4).toBeGreaterThan(0);
      expect(result.dominantScalant).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('scaling profile temperatures span the specified range', () => {
      const result = calculateFoulingScaling(getStandardInput());
      const temps = result.scalingProfile.map((p) => p.temperature);
      expect(temps[0]).toBeCloseTo(40, 0);
      expect(temps[temps.length - 1]).toBeCloseTo(70, 0);
    });

    it('CaSO4 saturation index increases with temperature in the profile', () => {
      const result = calculateFoulingScaling(getStandardInput());
      const profile = result.scalingProfile;
      for (let i = 1; i < profile.length; i++) {
        expect(profile[i]!.CaSO4_saturationIndex).toBeGreaterThanOrEqual(
          profile[i - 1]!.CaSO4_saturationIndex - 0.001 // tiny tolerance for rounding
        );
      }
    });

    it('brine CaSO4 concentration is the same at all temperature steps', () => {
      const result = calculateFoulingScaling(getStandardInput());
      const concs = result.scalingProfile.map((p) => p.CaSO4_brineConcentration);
      const unique = new Set(concs);
      expect(unique.size).toBe(1);
    });

    it('each point has a valid CaSO4 status', () => {
      const result = calculateFoulingScaling(getStandardInput());
      for (const point of result.scalingProfile) {
        expect(['safe', 'warning', 'critical']).toContain(point.CaSO4_status);
      }
    });

    it('each point has a valid CaCO3 status', () => {
      const result = calculateFoulingScaling(getStandardInput());
      for (const point of result.scalingProfile) {
        expect(['safe', 'warning', 'scaling']).toContain(point.CaCO3_status);
      }
    });
  });

  // --------------------------------------------------------------------------
  // High Concentration Factor
  // --------------------------------------------------------------------------
  describe('high concentration factor', () => {
    it('increases brine CaSO4 concentration', () => {
      const lowCF = calculateFoulingScaling(getStandardInput({ concentrationFactor: 1.3 }));
      const highCF = calculateFoulingScaling(getStandardInput({ concentrationFactor: 2.0 }));
      expect(highCF.brineCaSO4).toBeGreaterThan(lowCF.brineCaSO4);
    });

    it('increases scaling risk at all temperatures', () => {
      const lowCF = calculateFoulingScaling(getStandardInput({ concentrationFactor: 1.3 }));
      const highCF = calculateFoulingScaling(getStandardInput({ concentrationFactor: 2.0 }));
      // Compare SI at the same temperature index
      for (let i = 0; i < lowCF.scalingProfile.length; i++) {
        expect(highCF.scalingProfile[i]!.CaSO4_saturationIndex).toBeGreaterThan(
          lowCF.scalingProfile[i]!.CaSO4_saturationIndex
        );
      }
    });
  });

  // --------------------------------------------------------------------------
  // Warning Generation
  // --------------------------------------------------------------------------
  describe('warning generation', () => {
    it('warns on high calcium concentration', () => {
      const result = calculateFoulingScaling(getStandardInput({ calciumConcentration: 900 }));
      expect(result.warnings.some((w) => w.includes('Very high calcium'))).toBe(true);
    });

    it('warns on low calcium concentration', () => {
      const result = calculateFoulingScaling(getStandardInput({ calciumConcentration: 50 }));
      expect(result.warnings.some((w) => w.includes('Low calcium'))).toBe(true);
    });

    it('warns on high sulfate concentration', () => {
      const result = calculateFoulingScaling(getStandardInput({ sulfateConcentration: 6000 }));
      expect(result.warnings.some((w) => w.includes('Very high sulfate'))).toBe(true);
    });

    it('warns on elevated pH', () => {
      const result = calculateFoulingScaling(getStandardInput({ pH: 8.8 }));
      expect(result.warnings.some((w) => w.includes('Elevated feed pH'))).toBe(true);
    });

    it('warns on high concentration factor', () => {
      const result = calculateFoulingScaling(getStandardInput({ concentrationFactor: 2.5 }));
      expect(result.warnings.some((w) => w.includes('High concentration factor'))).toBe(true);
    });

    it('warns when operating above 70 C without antiscalant', () => {
      const result = calculateFoulingScaling(
        getStandardInput({ temperatureMax: 75, antiscalantDosed: false })
      );
      expect(
        result.warnings.some((w) => w.includes('above 70') && w.includes('without antiscalant'))
      ).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Input Validation
  // --------------------------------------------------------------------------
  describe('input validation', () => {
    it('throws on salinity <= 0', () => {
      expect(() => calculateFoulingScaling(getStandardInput({ feedSalinity: 0 }))).toThrow();
    });

    it('throws on salinity > 200000', () => {
      expect(() => calculateFoulingScaling(getStandardInput({ feedSalinity: 250000 }))).toThrow();
    });

    it('throws on calcium <= 0', () => {
      expect(() =>
        calculateFoulingScaling(getStandardInput({ calciumConcentration: 0 }))
      ).toThrow();
    });

    it('throws on sulfate <= 0', () => {
      expect(() =>
        calculateFoulingScaling(getStandardInput({ sulfateConcentration: 0 }))
      ).toThrow();
    });

    it('throws on bicarbonate <= 0', () => {
      expect(() =>
        calculateFoulingScaling(getStandardInput({ bicarbonateAlkalinity: 0 }))
      ).toThrow();
    });

    it('throws on magnesium <= 0', () => {
      expect(() =>
        calculateFoulingScaling(getStandardInput({ magnesiumConcentration: 0 }))
      ).toThrow();
    });

    it('throws on pH outside 6-10', () => {
      expect(() => calculateFoulingScaling(getStandardInput({ pH: 5 }))).toThrow();
      expect(() => calculateFoulingScaling(getStandardInput({ pH: 11 }))).toThrow();
    });

    it('throws on temperatureMin >= temperatureMax', () => {
      expect(() =>
        calculateFoulingScaling(getStandardInput({ temperatureMin: 70, temperatureMax: 70 }))
      ).toThrow();
    });

    it('throws on concentration factor outside 1-3', () => {
      expect(() =>
        calculateFoulingScaling(getStandardInput({ concentrationFactor: 0.5 }))
      ).toThrow();
      expect(() =>
        calculateFoulingScaling(getStandardInput({ concentrationFactor: 3.5 }))
      ).toThrow();
    });

    it('throws on temperature steps < 2', () => {
      expect(() => calculateFoulingScaling(getStandardInput({ temperatureSteps: 1 }))).toThrow();
    });

    it('throws on antiscalant efficiency outside 0-1', () => {
      expect(() =>
        calculateFoulingScaling(
          getStandardInput({ antiscalantDosed: true, antiscalantEfficiency: 1.5 })
        )
      ).toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Exported Constants
  // --------------------------------------------------------------------------
  describe('exported constants', () => {
    it('STANDARD_SEAWATER_CHEMISTRY has expected values', () => {
      expect(STANDARD_SEAWATER_CHEMISTRY.calcium).toBe(420);
      expect(STANDARD_SEAWATER_CHEMISTRY.sulfate).toBe(2700);
      expect(STANDARD_SEAWATER_CHEMISTRY.salinity).toBe(35000);
      expect(STANDARD_SEAWATER_CHEMISTRY.pH).toBe(8.1);
    });

    it('SCALING_THRESHOLDS has correct values', () => {
      expect(SCALING_THRESHOLDS.CaSO4_SAFE).toBe(0.7);
      expect(SCALING_THRESHOLDS.CaSO4_WARNING).toBe(0.85);
      expect(SCALING_THRESHOLDS.CaSO4_CRITICAL).toBe(1.0);
      expect(SCALING_THRESHOLDS.LSI_SCALING).toBe(0.5);
    });
  });
});
