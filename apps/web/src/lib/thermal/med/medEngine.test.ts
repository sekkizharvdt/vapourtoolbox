/**
 * MED Engine Tests
 *
 * Validates the engine with physical expectations:
 * - Steam in → distillate out, GOR is a result
 * - More effects = higher GOR
 * - Preheaters increase GOR and output
 * - Each preheater has different LMTD
 * - Condensate routing to downstream effects
 */

import { calculateMED, type MEDEngineInput } from './medEngine';

// BARC-like configuration: 0.79 T/h steam @ 57°C, 6 effects
const BARC_INPUT: MEDEngineInput = {
  steamFlow: 790, // kg/hr
  steamTemperature: 57,
  numberOfEffects: 6,
  seawaterInletTemp: 30,
  seawaterSalinity: 35000,
  maxBrineSalinity: 59500, // CF = 1.7
  condenserApproach: 4,
};

describe('MED Engine — Basic cascade', () => {
  const result = calculateMED(BARC_INPUT);

  it('converges', () => {
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThan(15);
  });

  it('produces 6 effects', () => {
    expect(result.effects).toHaveLength(6);
  });

  it('GOR is positive and reasonable for 6 effects', () => {
    expect(result.performance.gor).toBeGreaterThan(3);
    expect(result.performance.gor).toBeLessThan(10);
  });

  it('net distillate is positive', () => {
    expect(result.performance.netDistillate).toBeGreaterThan(0);
  });

  it('effect temperatures decrease monotonically', () => {
    for (let i = 1; i < result.effects.length; i++) {
      expect(result.effects[i]!.temperature).toBeLessThan(result.effects[i - 1]!.temperature);
    }
  });

  it('each effect produces vapor', () => {
    for (const eff of result.effects) {
      expect(eff.totalVaporOut.flow).toBeGreaterThan(0);
    }
  });

  it('brine accumulates through effects', () => {
    const lastBrine = result.effects[5]!.totalBrineOut.flow;
    const firstBrine = result.effects[0]!.totalBrineOut.flow;
    expect(lastBrine).toBeGreaterThan(firstBrine);
  });

  it('distillate accumulates on tube side', () => {
    const lastDist = result.effects[5]!.distillateOut.flow;
    const firstDist = result.effects[0]!.distillateOut.flow;
    expect(lastDist).toBeGreaterThan(firstDist);
  });

  it('final condenser has seawater flow', () => {
    expect(result.finalCondenser.seawaterIn.flow).toBeGreaterThan(0);
  });

  it('seawater intake > feed water (includes cooling water)', () => {
    expect(result.performance.seawaterIntake).toBeGreaterThan(result.performance.totalFeedWater);
  });

  it('specific thermal energy is in reasonable range', () => {
    expect(result.performance.specificThermalEnergy_kWh).toBeGreaterThan(40);
    expect(result.performance.specificThermalEnergy_kWh).toBeLessThan(200);
  });
});

describe('MED Engine — More effects = higher GOR', () => {
  const result4 = calculateMED({ ...BARC_INPUT, numberOfEffects: 4 });
  const result6 = calculateMED({ ...BARC_INPUT, numberOfEffects: 6 });
  const result8 = calculateMED({ ...BARC_INPUT, numberOfEffects: 8 });

  it('GOR increases with effect count', () => {
    expect(result6.performance.gor).toBeGreaterThan(result4.performance.gor);
    expect(result8.performance.gor).toBeGreaterThan(result6.performance.gor);
  });

  it('distillate increases with effect count', () => {
    expect(result6.performance.netDistillate).toBeGreaterThan(result4.performance.netDistillate);
    expect(result8.performance.netDistillate).toBeGreaterThan(result6.performance.netDistillate);
  });

  it('steam flow is the same for all (it is the INPUT)', () => {
    // The engine takes steam flow as given — it doesn't change
    expect(result4.effects[0]!.vaporIn.flow).toBeCloseTo(790, 0);
    expect(result6.effects[0]!.vaporIn.flow).toBeCloseTo(790, 0);
    expect(result8.effects[0]!.vaporIn.flow).toBeCloseTo(790, 0);
  });
});

describe('MED Engine — Preheaters increase GOR', () => {
  const noPH = calculateMED({ ...BARC_INPUT });
  const withPH = calculateMED({
    ...BARC_INPUT,
    preheaterEffects: [2, 4], // PH on effects 2 and 4
  });

  it('preheaters produce higher GOR', () => {
    expect(withPH.performance.gor).toBeGreaterThan(noPH.performance.gor);
  });

  it('preheaters produce more distillate', () => {
    expect(withPH.performance.netDistillate).toBeGreaterThan(noPH.performance.netDistillate);
  });

  it('each preheater is individually sized', () => {
    expect(withPH.preheaters).toHaveLength(2);

    const ph1 = withPH.preheaters[0]!;
    const ph2 = withPH.preheaters[1]!;

    // Different vapor temperatures (from different effects)
    expect(ph1.vaporTemp).not.toBeCloseTo(ph2.vaporTemp, 0);

    // Different LMTDs (different vapor temps, different SW inlet temps)
    expect(ph1.lmtd).not.toBeCloseTo(ph2.lmtd, 0);

    // Both have positive duty
    expect(ph1.duty).toBeGreaterThan(0);
    expect(ph2.duty).toBeGreaterThan(0);
  });

  it('preheater raises feed temperature', () => {
    // With preheaters, the feed water temp should be higher than condenser outlet
    const condenserOutlet = BARC_INPUT.condenserOutletTemp ?? BARC_INPUT.seawaterInletTemp + 5;
    const lastPH = withPH.preheaters[withPH.preheaters.length - 1]!;
    expect(lastPH.swOutletTemp).toBeGreaterThan(condenserOutlet);
  });

  it('each preheater has condensate routed to a downstream effect', () => {
    for (const ph of withPH.preheaters) {
      expect(ph.condensateToEffect).toBeGreaterThan(ph.effectNumber);
      expect(ph.condensateToEffect).toBeLessThanOrEqual(BARC_INPUT.numberOfEffects);
    }
  });
});

describe('MED Engine — Temperature profile', () => {
  const result = calculateMED(BARC_INPUT);

  it('has entry for each effect', () => {
    expect(result.temperatureProfile).toHaveLength(6);
  });

  it('BPE is positive for all effects', () => {
    for (const tp of result.temperatureProfile) {
      expect(tp.bpe).toBeGreaterThan(0);
    }
  });

  it('working ΔT is positive for all effects', () => {
    for (const tp of result.temperatureProfile) {
      expect(tp.workingDeltaT).toBeGreaterThan(0);
    }
  });

  it('pressure decreases through effects', () => {
    for (let i = 1; i < result.temperatureProfile.length; i++) {
      expect(result.temperatureProfile[i]!.pressure).toBeLessThan(
        result.temperatureProfile[i - 1]!.pressure
      );
    }
  });
});
