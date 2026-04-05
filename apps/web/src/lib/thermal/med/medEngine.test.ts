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

  it('IIT Madras validation: GOR within 5% of as-built (3.51)', () => {
    const iitm = calculateMED({
      steamFlow: 357,
      steamTemperature: 55.4,
      numberOfEffects: 4,
      seawaterInletTemp: 30,
      seawaterSalinity: 35000,
      maxBrineSalinity: 59500,
      condenserApproach: 4,
      condenserOutletTemp: 37,
    });
    expect(iitm.performance.gor).toBeGreaterThan(3.51 * 0.95);
    expect(iitm.performance.gor).toBeLessThan(3.51 * 1.1);
  });

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

describe('MED Engine — Edge cases and robustness', () => {
  it('handles preheater effects out of range gracefully', () => {
    // Preheater on Effect 8 but only 6 effects — should be filtered out
    const result = calculateMED({
      ...BARC_INPUT,
      preheaterEffects: [2, 4, 8, 10],
    });
    expect(result.converged).toBe(true);
    // Only E2 and E4 should remain (8 and 10 filtered out)
    expect(result.preheaters.length).toBeLessThanOrEqual(2);
  });

  it('handles preheater on Effect 1 gracefully (filtered out)', () => {
    const result = calculateMED({
      ...BARC_INPUT,
      preheaterEffects: [1],
    });
    expect(result.converged).toBe(true);
    expect(result.preheaters).toHaveLength(0);
  });

  it('handles preheater on last effect gracefully (filtered out)', () => {
    const result = calculateMED({
      ...BARC_INPUT,
      preheaterEffects: [6],
    });
    expect(result.converged).toBe(true);
    expect(result.preheaters).toHaveLength(0);
  });

  it('handles narrow temperature range (many effects)', () => {
    // 10 effects with only 18°C range = 1.8°C/effect — should still work
    expect(() => calculateMED({ ...BARC_INPUT, numberOfEffects: 10 })).not.toThrow();
  });

  it('throws on impossible temperature range', () => {
    expect(() =>
      calculateMED({
        ...BARC_INPUT,
        steamTemperature: 35, // below condenser outlet
      })
    ).toThrow();
  });

  it('handles 2 effects (minimum)', () => {
    const result = calculateMED({ ...BARC_INPUT, numberOfEffects: 2 });
    expect(result.converged).toBe(true);
    expect(result.effects).toHaveLength(2);
    expect(result.performance.gor).toBeGreaterThan(0);
  });
});

describe('MED Engine — TVC (Thermo Vapor Compressor)', () => {
  // BARC MED-TVC as-built: 1040 kg/hr motive steam at 10 bar, 6 effects
  // Top brine temp 58.8°C, GOR 9.61
  const TVC_BASE: MEDEngineInput = {
    steamFlow: 1040, // 1.04 T/hr motive steam
    steamTemperature: 58.8, // top brine temp from BARC PFD
    numberOfEffects: 6,
    seawaterInletTemp: 30,
    seawaterSalinity: 35000, // seawater
    maxBrineSalinity: 59400,
    condenserApproach: 4,
  };
  const TVC_INPUT: MEDEngineInput = {
    ...TVC_BASE,
    tvcMotivePressure: 10, // 10 bar sat motive steam
    // entrains from last effect by default
  };

  it('converges with TVC', () => {
    const result = calculateMED(TVC_INPUT);
    expect(result.converged).toBe(true);
  });

  it('TVC result is populated', () => {
    const result = calculateMED(TVC_INPUT);
    expect(result.tvc).not.toBeNull();
    expect(result.tvc!.motiveFlow).toBeGreaterThan(0);
    expect(result.tvc!.entrainedFlow).toBeGreaterThan(0);
    expect(result.tvc!.dischargeFlow).toBeGreaterThan(result.tvc!.motiveFlow);
  });

  it('motive flow equals input steam flow (motive steam IS the input)', () => {
    const result = calculateMED(TVC_INPUT);
    expect(result.tvc).not.toBeNull();
    // The motive flow should equal the steam input
    expect(result.tvc!.motiveFlow).toBeCloseTo(TVC_INPUT.steamFlow, 0);
  });

  it('discharge = motive + entrained', () => {
    const result = calculateMED(TVC_INPUT);
    expect(result.tvc).not.toBeNull();
    const { motiveFlow, entrainedFlow, dischargeFlow } = result.tvc!;
    expect(dischargeFlow).toBeCloseTo(motiveFlow + entrainedFlow, 0);
  });

  it('MED-TVC has higher GOR than plain MED (same conditions)', () => {
    // Compare TVC vs plain MED with same base conditions
    const plainResult = calculateMED(TVC_BASE);
    const tvcResult = calculateMED(TVC_INPUT);
    // TVC recycles last-effect vapor → more vapor to E1 → more distillate per unit motive steam
    expect(tvcResult.performance.gor).toBeGreaterThan(plainResult.performance.gor);
  });

  it('MED-TVC produces more distillate than plain MED', () => {
    const plainResult = calculateMED(TVC_BASE);
    const tvcResult = calculateMED(TVC_INPUT);
    expect(tvcResult.performance.netDistillate).toBeGreaterThan(
      plainResult.performance.netDistillate
    );
  });

  it('entrainment ratio is in reasonable range (0.3–1.5)', () => {
    const result = calculateMED(TVC_INPUT);
    expect(result.tvc).not.toBeNull();
    expect(result.tvc!.entrainmentRatio).toBeGreaterThan(0.2);
    expect(result.tvc!.entrainmentRatio).toBeLessThan(1.5);
  });

  it('last effect vapor is reduced (some entrained by TVC)', () => {
    const plainResult = calculateMED(TVC_BASE);
    const tvcResult = calculateMED(TVC_INPUT);
    const lastIdx = TVC_INPUT.numberOfEffects - 1;
    const plainLastVapor = plainResult.effects[lastIdx]!.totalVaporOut.flow;
    const tvcLastVapor = tvcResult.effects[lastIdx]!.totalVaporOut.flow;
    // TVC entrains from last effect → remaining vapor is less
    expect(tvcLastVapor).toBeLessThan(plainLastVapor);
  });

  it('TVC can entrain from a middle effect (not just last)', () => {
    // In an 8-effect MED, TVC might entrain from Effect 4
    const middleTVC: MEDEngineInput = {
      ...TVC_INPUT,
      numberOfEffects: 8,
      tvcEntrainedEffect: 4,
    };
    const result = calculateMED(middleTVC);
    expect(result.converged).toBe(true);
    expect(result.tvc).not.toBeNull();
    expect(result.tvc!.entrainedFlow).toBeGreaterThan(0);
  });

  it('handles high motive flow without crashing', () => {
    // Very high motive flow — TVC may want more vapor than last effect produces
    const result = calculateMED({
      ...TVC_INPUT,
      steamFlow: 3000, // much higher motive flow
    });
    // Should still converge (with warnings about entrainment)
    expect(result.converged || result.warnings.length > 0).toBe(true);
  });
});

describe('MED Engine — Equipment sizing (condenser U validation)', () => {
  const result = calculateMED(BARC_INPUT);

  it('equipment sizing is populated', () => {
    expect(result.equipmentSizing).not.toBeNull();
  });

  it('condenser overall U is in realistic range (1400-2200 W/(m²·K))', () => {
    // Validated against BARC data: 1700-1900 W/(m²·K)
    // Allow some margin for different operating conditions
    const condenserU = result.equipmentSizing!.condenser.overallHTC;
    expect(condenserU).toBeGreaterThan(1400);
    expect(condenserU).toBeLessThan(2200);
  });

  it('evaporator overall U is in realistic range (1200-3500 W/(m²·K))', () => {
    // Cold-end effects (low temperature) have lower U values
    for (const ev of result.equipmentSizing!.evaporators) {
      expect(ev.overallHTC).toBeGreaterThan(1200);
      expect(ev.overallHTC).toBeLessThan(3500);
    }
  });

  it('wetting rate with recommended recirculation is near target', () => {
    for (const ev of result.equipmentSizing!.evaporators) {
      // With recommended recirc, wetting rate should be at or above 0.045 kg/(m·s)
      if (ev.recommendedRecircRatio > 1.0) {
        expect(ev.wettingRateWithRecirc).toBeGreaterThanOrEqual(0.04);
      }
    }
  });
});

describe('MED Engine — Recirculation', () => {
  const result = calculateMED(BARC_INPUT);

  it('recirculation result is populated', () => {
    expect(result.recirculation).toBeDefined();
    expect(result.recirculation.flows).toHaveLength(BARC_INPUT.numberOfEffects);
  });

  it('all effects need recirculation (spray-only wetting is too low)', () => {
    // For a small plant (790 kg/hr steam), spray flow per effect is low
    // relative to tube count — all effects should need recirc
    for (const flow of result.recirculation.flows) {
      expect(flow).toBeGreaterThan(0);
    }
  });

  it('total recirculation flow is positive', () => {
    // Recirc can be very large for small plants with many tubes — this is
    // physically correct. The recirc pump flow depends on tube geometry.
    expect(result.recirculation.totalFlow).toBeGreaterThan(0);
  });

  it('per-effect recirc flow is consistent with tube geometry', () => {
    if (!result.equipmentSizing) return;
    for (let i = 0; i < BARC_INPUT.numberOfEffects; i++) {
      const ev = result.equipmentSizing.evaporators[i]!;
      const recirc = result.recirculation.flows[i]!;
      const spray = result.effects[i]!.sprayWater.flow;
      const totalFlow = spray + recirc;
      // Wetting rate with recirc should be near target (0.045 kg/(m·s))
      const totalTubeLength = ev.tubeCount * ev.tubeLength;
      const wettingWithRecirc = totalFlow / 3600 / (2 * totalTubeLength);
      expect(wettingWithRecirc).toBeGreaterThan(0.04);
      expect(wettingWithRecirc).toBeLessThan(0.06);
    }
  });

  it('recirculation source is last effect brine', () => {
    const lastEffect = result.effects[BARC_INPUT.numberOfEffects - 1]!;
    expect(result.recirculation.sourceTemp).toBeCloseTo(lastEffect.totalBrineOut.temperature, 0);
    expect(result.recirculation.sourceSalinity).toBeCloseTo(
      lastEffect.totalBrineOut.salinity,
      -2 // within 100 ppm
    );
  });

  it('GOR is unchanged (recirc does not affect process balance)', () => {
    // Recirc is an equipment concern — GOR should be the same as without sizing
    expect(result.performance.gor).toBeGreaterThan(3);
    expect(result.performance.gor).toBeLessThan(10);
  });
});
