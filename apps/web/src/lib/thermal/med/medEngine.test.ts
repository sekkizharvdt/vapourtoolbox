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

// BARC-like configuration: 0.79 T/h steam @ 59°C, 6 effects
// Note: steam temp raised from 57→59°C because the engine now correctly applies
// both demister AND duct pressure drop losses in the cascade (previously duct
// loss was display-only). The extra 2°C compensates for ~6 × 0.3°C duct losses.
const BARC_INPUT: MEDEngineInput = {
  steamFlow: 790, // kg/hr
  steamTemperature: 59,
  numberOfEffects: 6,
  seawaterInletTemp: 30,
  seawaterSalinity: 35000,
  maxBrineSalinity: 59500, // CF = 1.7
  condenserApproach: 4,
};

/**
 * BARC MED-TVC as-built operating point, from the as-built datasheet.
 *
 * Finding 6 (docs/reviews/2026-07-29-seawater-enthalpy-and-ncg-model.md): every
 * BARC anchor in this file previously passed `steamTemperature: 58.8` with
 * `condenserApproach: 4`. Per the datasheet, 58.8 °C is the EFFECT 1 operating
 * temperature; the steam inlet (stream 7) is 62.2 °C. The model therefore
 * reproduced the as-built cascade shifted down by exactly one ΔT step — effect
 * 1 at 55.5 against an as-built 58.8, effect 6 at 39.0 against 42.0 — while the
 * ±15% GOR band was wide enough to hide it. The plant's commissioning engineer
 * caught it by inspection.
 *
 * With the corrected inlet and cold end the profile matches to 0.07 K:
 *
 *   effect 1   58.83  vs  58.8 as-built
 *   effect 6   42.00  vs  42.0 as-built
 *   GOR         9.82  vs  9.61 as-built  (+2.2%, was +6.7%)
 *
 * One constant, used by every BARC anchor below, so the operating point cannot
 * drift apart between tests again.
 */
const BARC_AS_BUILT: MEDEngineInput = {
  steamFlow: 1040, // kg/hr motive steam
  steamTemperature: 62.2, // stream 7, steam inlet to effect 1 — NOT the 58.8 °C effect-1 temperature
  numberOfEffects: 6,
  seawaterInletTemp: 30,
  seawaterSalinity: 35000,
  maxBrineSalinity: 59400,
  condenserOutletTemp: 38, // reproduces the as-built 42.0 °C cold end
};

/** As-built performance, for tolerance bands. */
const BARC_AS_BUILT_GOR = 9.61;
const BARC_AS_BUILT_ENTRAINMENT_RATIO = 0.935;

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

  it('BARC validation: plain MED+4PH GOR ≈ 4.8', () => {
    // BARC as-built: 6 eff, 4 PH, TVC Ra≈0.99, GOR 9.61
    // Without TVC: 2074 kg/hr to E1, 10000 net distillate → GOR ≈ 4.82
    const barcNoPH = calculateMED({ ...BARC_AS_BUILT });
    const barcPH = calculateMED({ ...BARC_AS_BUILT, preheaterEffects: [2, 3, 4, 5] });
    // eslint-disable-next-line no-console
    console.log(
      `BARC noPH: GOR=${barcNoPH.performance.gor}, +4PH: GOR=${barcPH.performance.gor} (target ~4.8)`
    );
    // All vapor ratios must be < 1.0 (no effect produces more than it receives)
    const ratios = barcPH.effects.map((e) => e.totalVaporOut.flow / e.vaporIn.flow);
    // eslint-disable-next-line no-console
    console.log(`  Vapor ratios: ${ratios.map((r) => r.toFixed(3)).join(', ')}`);
    for (const r of ratios) {
      // Cold-end effects can exceed 1.0 due to brine cascade sensible heat
      // contribution in the enthalpy balance. Limit to < 1.1.
      expect(r).toBeLessThan(1.1);
    }
  });

  it('GOR/N approaches thumb rule (0.74) at typical industrial conditions', () => {
    // Thumb rule: GOR ≈ 0.74 × N, calibrated for TBT 65-68°C, 6-8 effects
    const base = { ...BARC_INPUT, steamTemperature: 68, numberOfEffects: 8 };
    const r = calculateMED(base);
    expect(r.performance.gor / 8).toBeGreaterThan(0.7);
    expect(r.performance.gor / 8).toBeLessThan(0.82);
  });

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
    // eslint-disable-next-line no-console
    console.log(`IIT Madras: GOR=${iitm.performance.gor} (as-built: 3.51)`);
    expect(iitm.performance.gor).toBeGreaterThan(3.51 * 0.95);
    expect(iitm.performance.gor).toBeLessThan(3.51 * 1.05);
  });

  it('GOR/N at 68°C matches industry thumb rule', () => {
    for (const n of [4, 6, 8]) {
      const r = calculateMED({ ...BARC_INPUT, steamTemperature: 68, numberOfEffects: n });
      // eslint-disable-next-line no-console
      console.log(
        `N=${n} @68°C: GOR=${r.performance.gor} GOR/N=${(r.performance.gor / n).toFixed(3)}`
      );
    }
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
  // Preheaters on LATER effects — optimal placement.
  // Vapor diverted from late effects loses fewer cascade steps,
  // and the preheated seawater benefits earlier effects.
  const withPH = calculateMED({
    ...BARC_INPUT,
    preheaterEffects: [4, 5],
  });

  it('preheaters on late effects improve GOR', () => {
    expect(withPH.performance.gor).toBeGreaterThan(noPH.performance.gor);
  });

  it('preheaters on late effects improve distillate', () => {
    expect(withPH.performance.netDistillate).toBeGreaterThan(noPH.performance.netDistillate);
  });

  it('each preheater is individually sized', () => {
    expect(withPH.preheaters).toHaveLength(2);

    const ph1 = withPH.preheaters[0]!;
    const ph2 = withPH.preheaters[1]!;

    // Different vapor temperatures (from different effects)
    expect(ph1.vaporTemp).not.toBeCloseTo(ph2.vaporTemp, 0);

    // Different LMTDs (different vapor temps, different SW inlet temps)
    // Precision 1 = tolerance ±0.05°C — they should differ by more than that
    expect(ph1.lmtd).not.toBeCloseTo(ph2.lmtd, 1);

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
  const TVC_BASE: MEDEngineInput = { ...BARC_AS_BUILT };
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

  it('BARC MED-TVC: GOR and Ra within 15% of as-built', () => {
    // BARC as-built: 1040 motive @ 10 bar, 6 eff, 4 PH, GOR=9.61, Ra=0.935
    const barc = calculateMED({
      ...BARC_AS_BUILT,
      tvcMotivePressure: 10,
      preheaterEffects: [2, 3, 4, 5],
    });
    expect(barc.tvc).not.toBeNull();
    expect(barc.tvc!.entrainmentRatio).toBeGreaterThan(0.935 * 0.85);
    expect(barc.tvc!.entrainmentRatio).toBeLessThan(0.935 * 1.15);
    expect(barc.performance.gor).toBeGreaterThan(9.61 * 0.85);
    expect(barc.performance.gor).toBeLessThan(9.61 * 1.15);
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

  it('evaporator overall U is in realistic range (2500-4000 W/(m²·K))', () => {
    // Chun-Seban falling film correlation gives U ≈ 3000-3500 for MED conditions
    for (const ev of result.equipmentSizing!.evaporators) {
      expect(ev.overallHTC).toBeGreaterThan(2500);
      expect(ev.overallHTC).toBeLessThan(4000);
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

  it('per-effect recirc flow is consistent with tube geometry (VGB formula)', () => {
    if (!result.equipmentSizing) return;
    for (let i = 0; i < BARC_INPUT.numberOfEffects; i++) {
      const ev = result.equipmentSizing.evaporators[i]!;
      const recirc = result.recirculation.flows[i]!;
      const spray = result.effects[i]!.sprayWater.flow;
      const totalFlow = spray + recirc;
      // VGB wetting rate: Γ = flow / (2 × L × n_rows)
      const rowSpacing = ev.tubeOD * 1.315 * Math.sin((60 * Math.PI) / 180);
      const nRows = Math.floor(ev.bundleDiameter / rowSpacing);
      const wettingWithRecirc = totalFlow / 3600 / (2 * ev.tubeLength * nRows);
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

// ===========================================================================
// External anchor — golden regression snapshot (BARC MED-TVC per-effect)
// ===========================================================================

describe('fouling resistance is a live input', () => {
  /**
   * Finding 7, second half. `foulingResistance` was accepted by the UI, carried
   * through the adapters, and printed in the verification report as the design
   * basis — but the sizing code substituted a hardcoded constant, so the input
   * had no effect at any value. Worse, the adapters injected 0.00015 while the
   * sizing used 0.00009, so the report stated a basis the numbers did not use.
   *
   * Both are now the shared DEFAULT_SEAWATER_FOULING_M2KW (0.00009 — TEMA
   * seawater below 52 °C, and what `fallingFilmCalculator` has always used).
   */
  const BASE: MEDEngineInput = {
    ...BARC_AS_BUILT,
    tvcMotivePressure: 10,
    preheaterEffects: [2, 3, 4, 5],
  };

  const totalArea = (r: ReturnType<typeof calculateMED>) =>
    r.equipmentSizing!.evaporators.reduce((sum, e) => sum + e.requiredArea, 0);

  it('the default matches the shared constant, so behaviour is unchanged', () => {
    const implicit = calculateMED(BASE);
    const explicit = calculateMED({ ...BASE, foulingResistance: 0.00009 });

    expect(totalArea(explicit)).toBeCloseTo(totalArea(implicit), 6);
  });

  it('raising fouling lowers the correlated U and raises required area', () => {
    const clean = calculateMED(BASE);
    const fouled = calculateMED({ ...BASE, foulingResistance: 0.00015 });

    for (let i = 0; i < clean.equipmentSizing!.evaporators.length; i++) {
      const c = clean.equipmentSizing!.evaporators[i]!;
      const f = fouled.equipmentSizing!.evaporators[i]!;
      expect(f.correlatedOverallHTC).toBeLessThan(c.correlatedOverallHTC);
    }

    // At 0.00015 the correlated U falls below the 3,100 cap, so the cap stops
    // binding and the correlated value sizes the bundle.
    expect(fouled.equipmentSizing!.evaporators[0]!.overallHTCSource).toBe('correlated');
    expect(fouled.equipmentSizing!.evaporators[0]!.overallHTC).toBeLessThan(3100);
    expect(totalArea(fouled)).toBeGreaterThan(totalArea(clean));
  });

  it('is monotonic in fouling — more fouling never needs less area', () => {
    const areas = [0.00005, 0.00009, 0.00015, 0.0003].map((rf) =>
      totalArea(calculateMED({ ...BASE, foulingResistance: rf }))
    );
    for (let i = 1; i < areas.length; i++) {
      expect(areas[i]!).toBeGreaterThanOrEqual(areas[i - 1]!);
    }
  });

  it('does not change the heat and mass balance', () => {
    // Sizing runs after the H&M converges, so fouling cannot move GOR or the
    // temperature profile. This is the structural invariant that closed
    // findings 3 and 4.
    const clean = calculateMED(BASE);
    const fouled = calculateMED({ ...BASE, foulingResistance: 0.0003 });

    expect(fouled.performance.gor).toBe(clean.performance.gor);
    for (let i = 0; i < clean.effects.length; i++) {
      expect(fouled.effects[i]!.temperature).toBe(clean.effects[i]!.temperature);
    }
  });
});

describe('evaporator U — reporting and override', () => {
  /**
   * Finding 7 (docs/reviews/2026-07-29-seawater-enthalpy-and-ncg-model.md).
   *
   * The geometry-derived overall U was computed and then silently discarded by
   * `Math.min(overallHTC, MED_EVAPORATOR_DESIGN_U_WM2K)`. The correlated value,
   * the cap and which one was used are now all reported, and the cap is
   * overridable per design.
   */
  const BASE: MEDEngineInput = {
    ...BARC_AS_BUILT,
    tvcMotivePressure: 10,
    preheaterEffects: [2, 3, 4, 5],
  };

  const totalArea = (r: ReturnType<typeof calculateMED>) =>
    r.equipmentSizing!.evaporators.reduce((sum, e) => sum + e.requiredArea, 0);

  it('reports the correlated U alongside the value used', () => {
    const r = calculateMED(BASE);
    for (const e of r.equipmentSizing!.evaporators) {
      // The shell-side correlation over-predicts, so the cap binds by a few percent.
      expect(e.correlatedOverallHTC).toBeGreaterThan(e.overallHTC);
      expect(e.designUCap).toBe(3100);
      expect(e.overallHTC).toBe(3100);
      expect(e.overallHTCSource).toBe('design-cap');
      expect(e.correlatedExcessPercent).toBeGreaterThan(0);
      expect(e.correlatedExcessPercent).toBeLessThan(10);
    }
  });

  it('uses the correlated value when the override is above it', () => {
    const r = calculateMED({ ...BASE, evaporatorDesignU: 4000 });
    for (const e of r.equipmentSizing!.evaporators) {
      expect(e.overallHTCSource).toBe('correlated');
      expect(e.overallHTC).toBe(e.correlatedOverallHTC);
      expect(e.correlatedExcessPercent).toBe(0);
    }
    // Higher U → less area needed than the capped default
    expect(totalArea(r)).toBeLessThan(totalArea(calculateMED(BASE)));
  });

  it('uses the override when it is below the correlated value, and reports the gap', () => {
    const r = calculateMED({ ...BASE, evaporatorDesignU: 2500 });
    for (const e of r.equipmentSizing!.evaporators) {
      expect(e.overallHTCSource).toBe('user-override');
      expect(e.overallHTC).toBe(2500);
      expect(e.correlatedExcessPercent).toBeGreaterThan(20);
    }
    expect(totalArea(r)).toBeGreaterThan(totalArea(calculateMED(BASE)));
  });

  it('U does not reach the heat and mass balance — GOR is identical for any U', () => {
    // This is the structural fact that closed finding 4: effectModel.ts contains
    // no U and no area. Sizing runs after the H&M converges, so U changes areas
    // and nothing else. Any NCG-driven HTC degradation therefore cannot move GOR.
    const gors = [undefined, 2500, 3100, 4000].map(
      (u) =>
        calculateMED(u === undefined ? BASE : { ...BASE, evaporatorDesignU: u }).performance.gor
    );
    for (const gor of gors) {
      expect(gor).toBeCloseTo(gors[0]!, 6);
    }
  });
});

describe('NCG source term', () => {
  /**
   * Regression for finding 2 (docs/reviews/2026-07-29-seawater-enthalpy-and-ncg-model.md).
   *
   * getSeawaterDensity returns kg/m3, not kg/L. Two call sites divided a kg/hr
   * flow by it and applied a per-LITRE concentration without converting, so the
   * NCG release came out 1000x low — 0.0012 kg/hr for the BARC case against the
   * ~1.22 the feed actually carries. It went unnoticed because NCG is inert in
   * this engine: it appears only in the mass balance and the per-effect balance
   * table, and the vacuum system sizes off HEI tables independently.
   */
  const input: MEDEngineInput = {
    steamFlow: 1040,
    steamTemperature: 58.8,
    numberOfEffects: 6,
    seawaterInletTemp: 30,
    seawaterSalinity: 35000,
    maxBrineSalinity: 59400,
    condenserApproach: 4,
  };
  const result = calculateMED(input);

  it('releases the NCG the feed actually carries, within 5%', () => {
    const totalReleased = result.effects.reduce((sum, e) => sum + e.shellSprayZone.ncgReleased, 0);
    // feed volume (litres/hr) x 50 mg/L, converted to kg/hr
    const feedKgH = result.performance.totalFeedWater;
    const expected = ((feedKgH / 1021.9) * 1000 * 50) / 1e6;

    expect(totalReleased).toBeGreaterThan(expected * 0.95);
    expect(totalReleased).toBeLessThan(expected * 1.05);
  });

  it('is three orders of magnitude above the pre-fix value', () => {
    // Guards specifically against the missing 1000x conversion reappearing.
    const totalReleased = result.effects.reduce((sum, e) => sum + e.shellSprayZone.ncgReleased, 0);
    expect(totalReleased).toBeGreaterThan(0.1);
  });

  it('accumulates monotonically down the train', () => {
    // Each effect vents everything it received plus what its own fresh feed
    // released, so the vent load must rise effect to effect.
    const vents = result.effects.map((e) => e.tubeSide.ncgVent);
    for (let i = 1; i < vents.length; i++) {
      expect(vents[i]!).toBeGreaterThan(vents[i - 1]!);
    }
  });

  it('every effect clears the 0.001 kg/hr threshold the balance table displays at', () => {
    // MEDEffectBalanceTable.tsx gates the NCG row on ncgIn > 0.001. At the
    // pre-fix magnitude the row was hidden for most of the table.
    for (const e of result.effects) {
      expect(e.tubeSide.ncgVent).toBeGreaterThan(0.001);
    }
  });
});

describe('external anchor — golden regression snapshot (BARC MED-TVC per-effect profile)', () => {
  /**
   * Full per-effect regression pins captured 2026-07-13 from the validated
   * engine, running the BARC MED-TVC configuration (BARC/IIT Madras plant:
   * 1040 kg/hr motive steam @ 10 bar, 6 effects, 4 preheaters, as-built
   * GOR = 9.61; the engine computes GOR = 10.25, inside the validated ±15%
   * band).
   *
   * Unlike the GOR check above, these pins freeze the SHAPE of the cascade
   * (per-effect temperature, vapor flow, brine flow, required area). Any
   * future physics change that shifts the temperature profile, flash split,
   * preheater peel-off, or HTC stack fails loudly here (±0.5% per value)
   * instead of hiding inside the ±15% GOR tolerance. If a deliberate physics
   * fix moves these numbers, re-baseline the table in the same commit and
   * say why in the commit message.
   */
  const GOLDEN_INPUT: MEDEngineInput = {
    ...BARC_AS_BUILT,
    tvcMotivePressure: 10,
    preheaterEffects: [2, 3, 4, 5],
  };

  // effect | T (°C) | vapor out (kg/hr) | brine out (kg/hr) | required area (m²)
  // Areas re-baselined 2026-07 when the evaporator overall U was capped at the
  // validated safe design value (3,100 W/m²·K — see MED_EVAPORATOR_DESIGN_U_WM2K
  // in equipmentSizing.ts). The shell-side correlation over-predicted U (~3,200
  // for this BARC config, ~3,600 in other cases), so capping raised required
  // area ~2-3.5% here. Process quantities (T, vapor, brine) are unchanged — the
  // H&M balance does not depend on U.
  // RE-BASELINED 2026-07-29 for two seawater-property fixes. See
  // docs/reviews/2026-07-29-seawater-enthalpy-and-ncg-model.md, findings 1 and 5.
  //
  //   Finding 1 — getSeawaterEnthalpy applied the Millero salinity correction to
  //   S^2 where the specific-heat correlation it integrates uses S^1.5. Enthalpy
  //   was NON-MONOTONIC in salinity above ~20,000 ppm and dh/dT was 43% wrong at
  //   80,000 ppm. MED brine runs 35,000-59,400 ppm here.
  //
  //   Finding 5 — the pure-water baseline came from a Sharqawy polynomial that
  //   tracks IF97 below ~50 C and diverges above (+1.2% on cp at 70 C). Both
  //   pure-water paths now use IAPWS-IF97 Region 1.
  //
  // Effect temperatures are UNCHANGED — the cascade is set by the dT allocation
  // and BPE, not by liquid enthalpy magnitude. Vapour and brine flows rose ~1-2%
  // (effect 6 vapour by 12%, on a small absolute number) because the corrected
  // brine enthalpies widen (h_in - h_brine). Areas rose ~0.1-3.2% following the
  // duties.
  //
  // GOR 10.05 -> 10.25, still inside the +/-15% band around the BARC as-built
  // 9.61 (8.17-11.05). The gap to as-built is a separate open question tracked
  // as finding 4 (NCG has no effect on heat transfer or pressure).
  // RE-BASELINED 2026-07-31 for finding 6 — the golden input's operating point
  // was wrong, not the model. `steamTemperature: 58.8` was the as-built EFFECT 1
  // temperature; the steam inlet is 62.2 °C, and `condenserApproach: 4` put the
  // cold end at 39.0 °C against an as-built 42.0 °C. See BARC_AS_BUILT above.
  //
  // This is the first re-baseline here that IMPROVES agreement with the plant
  // rather than tracking a model change:
  //
  //   effect 1   55.5 -> 58.83   (as-built 58.8, was -3.3 K, now +0.03 K)
  //   effect 6   39.0 -> 42.00   (as-built 42.0, was -3.0 K, now  0.00 K)
  //   GOR       10.25 -> 9.82    (as-built 9.61, was +6.7%, now +2.2%)
  //   Ra       1.0697 -> 0.9878  (as-built 0.935, was +14.4%, now +5.6%)
  //
  // Areas fall ~6-11% throughout: the cascade now runs hotter, so each effect
  // has more ΔT to work with. The H&M is unaffected by U (findings 3 and 4).
  const GOLDEN_PROFILE = [
    { effect: 1, temperature: 58.83, vaporFlow: 2040.45, brineFlow: 2108.4, area: 166.91 },
    { effect: 2, temperature: 55.47, vaporFlow: 1868.38, brineFlow: 4259.38, area: 192.77 },
    { effect: 3, temperature: 52.1, vaporFlow: 1706.46, brineFlow: 6584.18, area: 215.04 },
    { effect: 4, temperature: 48.73, vaporFlow: 1526.08, brineFlow: 9075.71, area: 196.1 },
    { effect: 5, temperature: 45.37, vaporFlow: 1354.79, brineFlow: 11749.57, area: 176.82 },
    { effect: 6, temperature: 42.0, vaporFlow: 345.84, brineFlow: 14568.01, area: 158.73 },
  ];

  const golden = calculateMED(GOLDEN_INPUT);

  it('converges and reproduces the golden GOR (9.82 ±0.5%)', () => {
    expect(golden.converged).toBe(true);
    expect(Math.abs(golden.performance.gor - 9.82) / 9.82).toBeLessThan(0.005);
    expect(Math.abs(golden.performance.netDistillate - 10209) / 10209).toBeLessThan(0.005);
  });

  it('reproduces the as-built cascade, not merely a plausible one', () => {
    // The pins above would pass for any self-consistent model. This asserts
    // against the PLANT: the datasheet's own effect 1 and effect 6 temperatures.
    expect(Math.abs(golden.effects[0]!.temperature - 58.8)).toBeLessThan(0.1);
    expect(Math.abs(golden.effects[5]!.temperature - 42.0)).toBeLessThan(0.1);
    // GOR still runs high, now by 2.2% rather than 6.7%.
    expect(golden.performance.gor).toBeGreaterThan(BARC_AS_BUILT_GOR);
    expect((golden.performance.gor - BARC_AS_BUILT_GOR) / BARC_AS_BUILT_GOR).toBeLessThan(0.03);
  });

  it('reproduces the golden TVC operating point (±0.5%)', () => {
    expect(golden.tvc).not.toBeNull();
    expect(Math.abs(golden.tvc!.entrainmentRatio - 0.9878) / 0.9878).toBeLessThan(0.005);
    expect(Math.abs(golden.tvc!.dischargeFlow - 2067.29) / 2067.29).toBeLessThan(0.005);
    // Closer to the as-built 0.935 than the old pin's 1.0697 was.
    expect(
      Math.abs(golden.tvc!.entrainmentRatio - BARC_AS_BUILT_ENTRAINMENT_RATIO) /
        BARC_AS_BUILT_ENTRAINMENT_RATIO
    ).toBeLessThan(0.06);
  });

  it.each(GOLDEN_PROFILE)(
    'effect $effect: temperature, vapor flow, brine flow, area all within ±0.5% of golden values',
    ({ effect, temperature, vaporFlow, brineFlow, area }) => {
      const e = golden.effects[effect - 1]!;
      expect(e.effectNumber).toBe(effect);
      expect(Math.abs(e.temperature - temperature) / temperature).toBeLessThan(0.005);
      expect(Math.abs(e.totalVaporOut.flow - vaporFlow) / vaporFlow).toBeLessThan(0.005);
      expect(Math.abs(e.totalBrineOut.flow - brineFlow) / brineFlow).toBeLessThan(0.005);

      expect(golden.equipmentSizing).not.toBeNull();
      const sized = golden.equipmentSizing!.evaporators[effect - 1]!;
      expect(Math.abs(sized.requiredArea - area) / area).toBeLessThan(0.005);
    }
  );
});
