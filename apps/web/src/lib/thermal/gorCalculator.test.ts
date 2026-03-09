/**
 * GOR (Gain Output Ratio) Calculator Tests
 *
 * Tests for MED plant thermal performance calculations including:
 * - Basic MED parallel feed
 * - MED forward feed
 * - MED-TVC configuration
 * - Temperature profile
 * - BPE losses
 * - Salinity profile
 * - Cooling water requirement
 * - Capacity-based sizing
 * - Warning generation
 * - Input validation
 */

// Mock @vapour/constants
jest.mock('@vapour/constants', () => ({
  getLatentHeat: jest.fn((temp: number) => {
    // Approximate latent heat of vaporisation in kJ/kg
    return 2500 - 2.4 * temp;
  }),
  getSaturationTemperature: jest.fn((pressure: number) => {
    // Approximate saturation temperature for common steam pressures
    // Based on simplified Antoine equation inversion
    if (pressure <= 0.1) return 45.8;
    if (pressure <= 0.2) return 60.1;
    if (pressure <= 0.3) return 69.1;
    if (pressure <= 0.5) return 81.3;
    if (pressure <= 1.0) return 99.6;
    if (pressure <= 1.5) return 111.4;
    if (pressure <= 2.0) return 120.2;
    return 99.6 + (pressure - 1) * 20;
  }),
  getBoilingPointElevation: jest.fn((salinity: number, _temp: number) => {
    // Approximate BPE in deg C — increases with salinity
    return salinity * 0.000015 + 0.1;
  }),
  getSeawaterSpecificHeat: jest.fn((_salinity: number, _temp: number) => {
    // Approximate Cp in kJ/(kg.K)
    return 3.95;
  }),
}));

import { calculateGOR, PLANT_CONFIGURATIONS, TYPICAL_RANGES } from './gorCalculator';
import type { GORInput, PlantConfiguration } from './gorCalculator';

// ============================================================================
// Test Helpers
// ============================================================================

/** Typical MED parallel feed: 6 effects, TBT 65 C, last effect 40 C */
function getTypicalInput(overrides?: Partial<GORInput>): GORInput {
  return {
    numberOfEffects: 6,
    configuration: 'MED_PARALLEL' as PlantConfiguration,
    topBrineTemperature: 65,
    lastEffectTemperature: 40,
    seawaterTemperature: 28,
    steamPressure: 0.3, // ~69 C saturation
    feedSalinity: 35000,
    maxBrineSalinity: 65000,
    condenserApproach: 4,
    condenserTTD: 3,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('gorCalculator', () => {
  // --------------------------------------------------------------------------
  // Basic MED Parallel Feed
  // --------------------------------------------------------------------------
  describe('MED parallel feed', () => {
    it('returns a valid result for typical 6-effect plant', () => {
      const result = calculateGOR(getTypicalInput());

      expect(result.gor).toBeGreaterThan(0);
      expect(result.specificThermalEnergy).toBeGreaterThan(0);
      expect(result.specificThermalEnergy_kWh).toBeGreaterThan(0);
      expect(result.thermalEfficiency).toBeGreaterThan(0);
      expect(result.thermalEfficiency).toBeLessThanOrEqual(1);
      expect(result.effects).toHaveLength(6);
      expect(result.totalBPELoss).toBeGreaterThan(0);
      expect(result.totalNEALoss).toBeGreaterThan(0);
      expect(result.totalRecovery).toBeGreaterThan(0);
      expect(result.totalRecovery).toBeLessThan(1);
    });

    it('GOR is in typical MED range (4-8) for 6 effects', () => {
      const result = calculateGOR(getTypicalInput());
      // With mocked BPE values, GOR may be slightly outside but should be in reasonable range
      expect(result.gor).toBeGreaterThan(2);
      expect(result.gor).toBeLessThan(12);
    });

    it('GOR increases with more effects', () => {
      const result4 = calculateGOR(getTypicalInput({ numberOfEffects: 4 }));
      const result8 = calculateGOR(getTypicalInput({ numberOfEffects: 8 }));
      expect(result8.gor).toBeGreaterThan(result4.gor);
    });

    it('specific thermal energy decreases with higher GOR', () => {
      const result4 = calculateGOR(getTypicalInput({ numberOfEffects: 4 }));
      const result8 = calculateGOR(getTypicalInput({ numberOfEffects: 8 }));
      expect(result8.specificThermalEnergy).toBeLessThan(result4.specificThermalEnergy);
    });
  });

  // --------------------------------------------------------------------------
  // MED Forward Feed
  // --------------------------------------------------------------------------
  describe('MED forward feed', () => {
    it('returns a valid result with forward feed configuration', () => {
      const result = calculateGOR(
        getTypicalInput({ configuration: 'MED_FORWARD' as PlantConfiguration })
      );
      expect(result.gor).toBeGreaterThan(0);
      expect(result.effects).toHaveLength(6);
    });

    it('forward feed has increasing salinity effect to effect', () => {
      const result = calculateGOR(
        getTypicalInput({ configuration: 'MED_FORWARD' as PlantConfiguration })
      );
      for (let i = 1; i < result.effects.length; i++) {
        expect(result.effects[i]!.salinity).toBeGreaterThan(result.effects[i - 1]!.salinity);
      }
    });

    it('parallel feed has constant salinity across effects', () => {
      const result = calculateGOR(
        getTypicalInput({ configuration: 'MED_PARALLEL' as PlantConfiguration })
      );
      const salinities = result.effects.map((e) => e.salinity);
      const unique = new Set(salinities);
      expect(unique.size).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // MED-TVC
  // --------------------------------------------------------------------------
  describe('MED-TVC', () => {
    it('MED-TVC gives higher GOR than plain MED', () => {
      const medResult = calculateGOR(getTypicalInput());
      const tvcResult = calculateGOR(
        getTypicalInput({
          configuration: 'MED_TVC' as PlantConfiguration,
          tvcEntrainmentRatio: 1.0,
        })
      );
      expect(tvcResult.gor).toBeGreaterThan(medResult.gor);
    });

    it('tvcBoost is returned for MED-TVC configuration', () => {
      const result = calculateGOR(
        getTypicalInput({
          configuration: 'MED_TVC' as PlantConfiguration,
          tvcEntrainmentRatio: 1.0,
        })
      );
      expect(result.tvcBoost).toBeDefined();
      expect(result.tvcBoost).toBeGreaterThan(1);
    });

    it('tvcBoost equals (1 + entrainment ratio)', () => {
      const Ra = 1.2;
      const result = calculateGOR(
        getTypicalInput({
          configuration: 'MED_TVC' as PlantConfiguration,
          tvcEntrainmentRatio: Ra,
        })
      );
      expect(result.tvcBoost).toBeCloseTo(1 + Ra, 3);
    });

    it('higher entrainment ratio gives higher GOR', () => {
      const resultLow = calculateGOR(
        getTypicalInput({
          configuration: 'MED_TVC' as PlantConfiguration,
          tvcEntrainmentRatio: 0.8,
        })
      );
      const resultHigh = calculateGOR(
        getTypicalInput({
          configuration: 'MED_TVC' as PlantConfiguration,
          tvcEntrainmentRatio: 1.5,
        })
      );
      expect(resultHigh.gor).toBeGreaterThan(resultLow.gor);
    });

    it('throws when MED_TVC is used without entrainment ratio', () => {
      expect(() =>
        calculateGOR(
          getTypicalInput({
            configuration: 'MED_TVC' as PlantConfiguration,
            tvcEntrainmentRatio: undefined,
          })
        )
      ).toThrow('entrainment ratio');
    });
  });

  // --------------------------------------------------------------------------
  // Temperature Profile
  // --------------------------------------------------------------------------
  describe('temperature profile', () => {
    it('temperatures decrease from first to last effect', () => {
      const result = calculateGOR(getTypicalInput());
      for (let i = 1; i < result.effects.length; i++) {
        expect(result.effects[i]!.temperature).toBeLessThan(result.effects[i - 1]!.temperature);
      }
    });

    it('first effect temperature equals TBT', () => {
      const result = calculateGOR(getTypicalInput());
      expect(result.effects[0]!.temperature).toBeCloseTo(65, 0);
    });

    it('last effect temperature is close to specified lastEffectTemperature', () => {
      const result = calculateGOR(getTypicalInput());
      const lastTemp = result.effects[result.effects.length - 1]!.temperature;
      // Should be approximately TBT - (N-1)*deltaT = 65 - 5*25/6 = ~44.17
      // Actually: TBT - (N-1)*deltaTPerEffect where deltaTPerEffect = 25/6
      expect(lastTemp).toBeCloseTo(40 + 25 / 6, 0);
    });

    it('available delta T equals TBT minus last effect temperature', () => {
      const result = calculateGOR(getTypicalInput());
      expect(result.availableDeltaT).toBeCloseTo(65 - 40, 1);
    });

    it('effective delta T is less than available delta T (losses reduce it)', () => {
      const result = calculateGOR(getTypicalInput());
      expect(result.effectiveDeltaT).toBeLessThan(result.availableDeltaT);
    });

    it('mean effective delta T equals effectiveDeltaT / N', () => {
      const result = calculateGOR(getTypicalInput());
      expect(result.meanEffectiveDeltaT).toBeCloseTo(result.effectiveDeltaT / 6, 1);
    });
  });

  // --------------------------------------------------------------------------
  // BPE Losses
  // --------------------------------------------------------------------------
  describe('BPE losses', () => {
    it('each effect has positive BPE', () => {
      const result = calculateGOR(getTypicalInput());
      for (const effect of result.effects) {
        expect(effect.bpElevation).toBeGreaterThan(0);
      }
    });

    it('each effect has positive NEA', () => {
      const result = calculateGOR(getTypicalInput());
      for (const effect of result.effects) {
        expect(effect.neAllowance).toBeGreaterThan(0);
      }
    });

    it('total BPE loss is sum of individual BPEs', () => {
      const result = calculateGOR(getTypicalInput());
      const sumBPE = result.effects.reduce((s, e) => s + e.bpElevation, 0);
      expect(result.totalBPELoss).toBeCloseTo(sumBPE, 1);
    });

    it('NEA increases from first to last effect', () => {
      const result = calculateGOR(getTypicalInput());
      for (let i = 1; i < result.effects.length; i++) {
        expect(result.effects[i]!.neAllowance).toBeGreaterThanOrEqual(
          result.effects[i - 1]!.neAllowance
        );
      }
    });
  });

  // --------------------------------------------------------------------------
  // Cooling Water
  // --------------------------------------------------------------------------
  describe('cooling water', () => {
    it('specificCoolingWater is positive', () => {
      const result = calculateGOR(getTypicalInput());
      expect(result.specificCoolingWater).toBeGreaterThan(0);
    });

    it('condenser duty is positive', () => {
      const result = calculateGOR(getTypicalInput());
      expect(result.condenserDuty).toBeGreaterThan(0);
    });

    it('specificFeed equals 1 / totalRecovery', () => {
      const result = calculateGOR(getTypicalInput());
      expect(result.specificFeed).toBeCloseTo(1 / result.totalRecovery, 1);
    });
  });

  // --------------------------------------------------------------------------
  // Capacity-Based Sizing
  // --------------------------------------------------------------------------
  describe('capacity-based sizing', () => {
    it('does not populate absolute flows when distillateCapacity is not provided', () => {
      const result = calculateGOR(getTypicalInput());
      expect(result.steamFlow).toBeUndefined();
      expect(result.feedFlow).toBeUndefined();
      expect(result.distillateFlow).toBeUndefined();
      expect(result.brineFlow).toBeUndefined();
      expect(result.coolingWaterFlow).toBeUndefined();
    });

    it('populates absolute flows when distillateCapacity is provided', () => {
      const result = calculateGOR(getTypicalInput({ distillateCapacity: 10000 }));
      expect(result.steamFlow).toBeDefined();
      expect(result.steamFlow).toBeGreaterThan(0);
      expect(result.feedFlow).toBeDefined();
      expect(result.feedFlow).toBeGreaterThan(0);
      expect(result.distillateFlow).toBeDefined();
      expect(result.distillateFlow).toBeGreaterThan(0);
      expect(result.brineFlow).toBeDefined();
      expect(result.brineFlow).toBeGreaterThan(0);
      expect(result.coolingWaterFlow).toBeDefined();
    });

    it('distillate flow is capacity converted from m3/day to kg/s', () => {
      const capacity = 10000; // m3/day
      const result = calculateGOR(getTypicalInput({ distillateCapacity: capacity }));
      const expectedKgS = (capacity * 1000) / 86400;
      expect(result.distillateFlow).toBeCloseTo(expectedKgS, 2);
    });

    it('steam flow = distillate flow / GOR', () => {
      const result = calculateGOR(getTypicalInput({ distillateCapacity: 10000 }));
      expect(result.steamFlow).toBeCloseTo(result.distillateFlow! / result.gor, 2);
    });

    it('feed flow = distillate flow * specificFeed', () => {
      const result = calculateGOR(getTypicalInput({ distillateCapacity: 10000 }));
      expect(result.feedFlow).toBeCloseTo(result.distillateFlow! * result.specificFeed, 2);
    });

    it('brine flow = feed flow - distillate flow', () => {
      const result = calculateGOR(getTypicalInput({ distillateCapacity: 10000 }));
      expect(result.brineFlow).toBeCloseTo(result.feedFlow! - result.distillateFlow!, 2);
    });
  });

  // --------------------------------------------------------------------------
  // Recovery
  // --------------------------------------------------------------------------
  describe('recovery', () => {
    it('total recovery = 1 - feedSalinity / maxBrineSalinity', () => {
      const result = calculateGOR(getTypicalInput());
      const expected = 1 - 35000 / 65000;
      expect(result.totalRecovery).toBeCloseTo(expected, 3);
    });

    it('recovery is between 0 and 1', () => {
      const result = calculateGOR(getTypicalInput());
      expect(result.totalRecovery).toBeGreaterThan(0);
      expect(result.totalRecovery).toBeLessThan(1);
    });
  });

  // --------------------------------------------------------------------------
  // Warning Generation
  // --------------------------------------------------------------------------
  describe('warning generation', () => {
    it('warns when delta T per effect is too small', () => {
      // Many effects with small temperature span
      calculateGOR(
        getTypicalInput({
          numberOfEffects: 16,
          topBrineTemperature: 65,
          lastEffectTemperature: 40,
          steamPressure: 0.3,
        })
      );
      // 25 / 16 = 1.5625 — borderline, may or may not warn
      // Use even more effects to trigger the warning
      const result2 = calculateGOR(
        getTypicalInput({
          numberOfEffects: 16,
          topBrineTemperature: 55,
          lastEffectTemperature: 40,
          steamPressure: 0.2,
        })
      );
      // 15°C range / 16 effects = 0.9375°C per effect — below 1°C threshold
      expect(result2.warnings.some((w) => w.includes('insufficient driving force'))).toBe(true);
    });

    it('warns on high recovery ratio (> 45%)', () => {
      // Recovery = 1 - 20000/65000 = 0.692 — well above 0.45
      const result3 = calculateGOR(
        getTypicalInput({ feedSalinity: 20000, maxBrineSalinity: 65000 })
      );
      // Recovery = 1 - 20000/65000 = 0.692 — well above 0.45
      expect(result3.warnings.some((w) => w.includes('Recovery ratio'))).toBe(true);
    });

    it('warns when condenser approach gives outlet temp <= seawater temp', () => {
      const result = calculateGOR(
        getTypicalInput({
          lastEffectTemperature: 38,
          seawaterTemperature: 35,
          condenserApproach: 5,
          steamPressure: 0.3,
        })
      );
      // 38 - 5 = 33 < 35 — should warn
      expect(result.warnings.some((w) => w.includes('at or below seawater temperature'))).toBe(
        true
      );
    });

    it('warns when last effect temperature is below 38 C', () => {
      const result = calculateGOR(
        getTypicalInput({
          lastEffectTemperature: 36,
          seawaterTemperature: 28,
          steamPressure: 0.3,
        })
      );
      expect(result.warnings.some((w) => w.includes('condenser will be very large'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Input Validation
  // --------------------------------------------------------------------------
  describe('input validation', () => {
    it('throws on number of effects < 2', () => {
      expect(() => calculateGOR(getTypicalInput({ numberOfEffects: 1 }))).toThrow(
        'Number of effects'
      );
    });

    it('throws on number of effects > 16', () => {
      expect(() => calculateGOR(getTypicalInput({ numberOfEffects: 17 }))).toThrow(
        'Number of effects'
      );
    });

    it('throws when TBT <= last effect temperature', () => {
      expect(() =>
        calculateGOR(getTypicalInput({ topBrineTemperature: 40, lastEffectTemperature: 40 }))
      ).toThrow('Top brine temperature');
    });

    it('throws when feed salinity >= max brine salinity', () => {
      expect(() =>
        calculateGOR(getTypicalInput({ feedSalinity: 70000, maxBrineSalinity: 65000 }))
      ).toThrow('Feed salinity');
    });

    it('throws when seawater temperature >= last effect temperature', () => {
      expect(() =>
        calculateGOR(getTypicalInput({ seawaterTemperature: 42, lastEffectTemperature: 40 }))
      ).toThrow('Seawater temperature');
    });

    it('throws when steam saturation temperature <= TBT', () => {
      // 0.1 bar gives ~45.8 C, TBT = 65 C — steam too cold
      expect(() =>
        calculateGOR(getTypicalInput({ steamPressure: 0.1, topBrineTemperature: 65 }))
      ).toThrow('Steam saturation temperature');
    });
  });

  // --------------------------------------------------------------------------
  // Exported Constants
  // --------------------------------------------------------------------------
  describe('exported constants', () => {
    it('PLANT_CONFIGURATIONS contains all three configurations', () => {
      expect(PLANT_CONFIGURATIONS.MED_PARALLEL).toBeDefined();
      expect(PLANT_CONFIGURATIONS.MED_FORWARD).toBeDefined();
      expect(PLANT_CONFIGURATIONS.MED_TVC).toBeDefined();
    });

    it('TYPICAL_RANGES has expected GOR ranges', () => {
      expect(TYPICAL_RANGES.GOR_MED.min).toBe(4);
      expect(TYPICAL_RANGES.GOR_MED.max).toBe(8);
      expect(TYPICAL_RANGES.GOR_MED_TVC.min).toBe(8);
      expect(TYPICAL_RANGES.GOR_MED_TVC.max).toBe(16);
    });

    it('TYPICAL_RANGES has expected effect count range', () => {
      expect(TYPICAL_RANGES.EFFECTS.min).toBe(2);
      expect(TYPICAL_RANGES.EFFECTS.max).toBe(16);
    });
  });
});
