/**
 * Direct tests for the single-effect thermodynamic model.
 *
 * Tests the tube-side / shell-side separation, NCG tracking,
 * brine flash zone, and mass/energy balance closure for individual effects.
 */

import { calculateEffect, getNEA, makeStream, type EffectInput } from './effectModel';

// ============================================================================
// Helper — build a typical Effect 1 input (steam to first effect, no cascade)
// ============================================================================

function makeEffect1Input(overrides?: Partial<EffectInput>): EffectInput {
  return {
    index: 0,
    totalEffects: 8,
    effectTemp: 55.0, // °C — pure-water saturation temp
    steamTemp: 57.3, // °C — motive steam

    // Tube side
    vaporInFlow: 833, // kg/hr (motive steam)
    distillateInFlow: 0,
    distillateInTemp: 0,
    ncgInFlow: 0.05, // kg/hr NCG in motive steam
    preheaterCondensateInFlow: 0,
    preheaterCondensateInTemp: 0,

    // Shell side spray
    seawaterSprayFlow: 1875, // kg/hr
    seawaterSprayTemp: 35, // °C
    seawaterSalinity: 35000, // ppm
    recircBrineFlow: 0,
    recircBrineTemp: 40,
    recircBrineSalinity: 52500,

    // Shell side flash (none for effect 1)
    cascadedBrineFlow: 0,
    cascadedBrineTemp: 0,
    cascadedBrineSalinity: 0,

    preheater: null,
    brineConcentrationFactor: 1.5,
    ...overrides,
  };
}

// ============================================================================
// Helper — build a typical Effect 3 input (mid-plant, with cascade)
// ============================================================================

function makeEffect3Input(overrides?: Partial<EffectInput>): EffectInput {
  return {
    index: 2,
    totalEffects: 8,
    effectTemp: 49.0,
    steamTemp: 51.5, // vapor from effect 2

    // Tube side
    vaporInFlow: 620, // kg/hr (vapor from effect 2 demister)
    distillateInFlow: 1300, // kg/hr (accumulated distillate)
    distillateInTemp: 51.0,
    ncgInFlow: 0.15, // kg/hr accumulated NCG
    preheaterCondensateInFlow: 0,
    preheaterCondensateInTemp: 0,

    // Shell side spray
    seawaterSprayFlow: 1875,
    seawaterSprayTemp: 38,
    seawaterSalinity: 35000,
    recircBrineFlow: 0,
    recircBrineTemp: 40,
    recircBrineSalinity: 52500,

    // Shell side flash (brine from effects 1+2)
    cascadedBrineFlow: 3500,
    cascadedBrineTemp: 51.0,
    cascadedBrineSalinity: 48000,

    preheater: null,
    brineConcentrationFactor: 1.5,
    ...overrides,
  };
}

// ============================================================================
// NEA Interpolation
// ============================================================================

describe('getNEA', () => {
  it('returns hot-end value for first effect', () => {
    expect(getNEA(0, 8)).toBeCloseTo(0.2, 2);
  });

  it('returns cold-end value for last effect', () => {
    expect(getNEA(7, 8)).toBeCloseTo(0.5, 2);
  });

  it('interpolates linearly for mid effects', () => {
    const nea = getNEA(3, 8);
    expect(nea).toBeGreaterThan(0.2);
    expect(nea).toBeLessThan(0.5);
  });

  it('returns hot-end for single effect', () => {
    expect(getNEA(0, 1)).toBeCloseTo(0.2, 2);
  });
});

// ============================================================================
// makeStream
// ============================================================================

describe('makeStream', () => {
  it('computes energy correctly', () => {
    const stream = makeStream('Test', 'VAPOR', 3600, 60, 2600, 0);
    // energy = flow * enthalpy / 3600 = 3600 * 2600 / 3600 = 2600 kW
    expect(stream.energy).toBeCloseTo(2600, 0);
  });

  it('stores all fields', () => {
    const stream = makeStream('Brine', 'BRINE', 1000, 55, 230, 52500);
    expect(stream.label).toBe('Brine');
    expect(stream.fluid).toBe('BRINE');
    expect(stream.flow).toBe(1000);
    expect(stream.temperature).toBe(55);
    expect(stream.enthalpy).toBe(230);
    expect(stream.salinity).toBe(52500);
  });
});

// ============================================================================
// Effect 1 — Tube Side
// ============================================================================

describe('calculateEffect — Effect 1 (tube side)', () => {
  const result = calculateEffect(makeEffect1Input());

  it('tube side vapor in matches input steam flow', () => {
    expect(result.tubeSide.vaporIn.flow).toBe(833);
    expect(result.tubeSide.vaporIn.fluid).toBe('STEAM');
  });

  it('tube side has no distillate in for effect 1', () => {
    expect(result.tubeSide.distillateIn).toBeNull();
  });

  it('tube side condensate out > 0', () => {
    expect(result.tubeSide.condensateOut.flow).toBeGreaterThan(0);
  });

  it('carrier steam is ~1% of vapor in', () => {
    expect(result.tubeSide.carrierSteam).toBeCloseTo(833 * 0.01, 1);
  });

  it('tube side releases positive heat to shell', () => {
    expect(result.tubeSide.heatReleased).toBeGreaterThan(0);
  });

  it('tube side has no distillate flash (effect 1)', () => {
    expect(result.tubeSide.distillateFlashVapor).toBe(0);
  });

  it('NCG vent equals NCG in (all vented to shell)', () => {
    expect(result.tubeSide.ncgVent).toBeCloseTo(0.05, 3);
  });
});

// ============================================================================
// Effect 1 — Shell Side Spray Zone
// ============================================================================

describe('calculateEffect — Effect 1 (shell spray zone)', () => {
  const result = calculateEffect(makeEffect1Input());

  it('seawater in matches input', () => {
    expect(result.shellSprayZone.seawaterIn.flow).toBe(1875);
    expect(result.shellSprayZone.seawaterIn.fluid).toBe('SEAWATER');
  });

  it('no recirc brine for this test', () => {
    expect(result.shellSprayZone.recircBrineIn.flow).toBe(0);
  });

  it('heat absorbed is positive', () => {
    expect(result.shellSprayZone.heatAbsorbed).toBeGreaterThan(0);
  });

  it('sensible heat is positive (heating spray to saturation)', () => {
    expect(result.shellSprayZone.sensibleHeat).toBeGreaterThan(0);
  });

  it('vapor produced is positive', () => {
    expect(result.shellSprayZone.vaporProduced.flow).toBeGreaterThan(0);
  });

  it('brine out = spray in - vapor produced (approximately)', () => {
    const sprayIn =
      result.shellSprayZone.seawaterIn.flow + result.shellSprayZone.recircBrineIn.flow;
    const brineOut = result.shellSprayZone.brineOut.flow;
    const vaporOut = result.shellSprayZone.vaporProduced.flow;
    expect(brineOut + vaporOut).toBeCloseTo(sprayIn, -1); // within ~10 kg/hr
  });

  it('NCG released is small but positive', () => {
    expect(result.shellSprayZone.ncgReleased).toBeGreaterThan(0);
    expect(result.shellSprayZone.ncgReleased).toBeLessThan(1); // < 1 kg/hr
  });
});

// ============================================================================
// Effect 1 — Shell Side Flash Zone (should be empty)
// ============================================================================

describe('calculateEffect — Effect 1 (shell flash zone)', () => {
  const result = calculateEffect(makeEffect1Input());

  it('no cascaded brine for effect 1', () => {
    expect(result.shellFlashZone.brineIn).toBeNull();
  });

  it('no flash vapor for effect 1', () => {
    expect(result.shellFlashZone.flashVapor).toBeNull();
  });

  it('flash fraction is 0', () => {
    expect(result.shellFlashZone.flashFraction).toBe(0);
  });
});

// ============================================================================
// Effect 3 — With Cascade (tube side distillate flash + shell side brine flash)
// ============================================================================

describe('calculateEffect — Effect 3 (with cascade)', () => {
  const result = calculateEffect(makeEffect3Input());

  it('tube side has distillate in from previous effects', () => {
    expect(result.tubeSide.distillateIn).not.toBeNull();
    expect(result.tubeSide.distillateIn!.flow).toBe(1300);
  });

  it('distillate flashes at lower pressure', () => {
    // Effect temp (49°C) < distillate temp (51°C) → some flash
    expect(result.tubeSide.distillateFlashVapor).toBeGreaterThan(0);
    expect(result.tubeSide.distillateFlashVapor).toBeLessThan(100); // small fraction
  });

  it('condensate out includes previous distillate + new condensate', () => {
    expect(result.tubeSide.condensateOut.flow).toBeGreaterThan(1300); // at least the incoming distillate
  });

  it('shell flash zone has cascaded brine', () => {
    expect(result.shellFlashZone.brineIn).not.toBeNull();
    expect(result.shellFlashZone.brineIn!.flow).toBe(3500);
  });

  it('flash zone is zero (brine merged into spray zone)', () => {
    // Cascaded brine is blended with spray in the combined shell model.
    // No separate flash vapor — energy is handled in the overall heat balance.
    expect(result.shellFlashZone.flashFraction).toBe(0);
  });
});

// ============================================================================
// Combined Outputs
// ============================================================================

describe('calculateEffect — combined outputs', () => {
  const result1 = calculateEffect(makeEffect1Input());
  const result3 = calculateEffect(makeEffect3Input());

  it('total vapor out combines spray + flash (distillate flash re-condenses in shell)', () => {
    const sprayVapor = result3.shellSprayZone.vaporProduced.flow;
    const flashVapor = result3.shellFlashZone.flashVapor?.flow ?? 0;
    // distillateFlashVapor is NOT included — it re-condenses on the spray film
    // and its latent heat is already counted in Q_distFlashToShell → sprayVaporProduced
    expect(result3.totalVaporOut.flow).toBeCloseTo(sprayVapor + flashVapor, 0);
  });

  it('total brine out combines spray brine + flash brine', () => {
    const sprayBrine = result3.shellSprayZone.brineOut.flow;
    const flashBrine = result3.shellFlashZone.brineOut?.flow ?? 0;
    expect(result3.totalBrineOut.flow).toBeCloseTo(sprayBrine + flashBrine, 0);
  });

  it('distillate out equals tube side condensate out', () => {
    expect(result3.distillateOut.flow).toBe(result3.tubeSide.condensateOut.flow);
  });

  it('backward-compatible fields match', () => {
    expect(result1.vaporIn).toBe(result1.tubeSide.vaporIn);
    expect(result1.sprayWater).toBe(result1.shellSprayZone.seawaterIn);
    expect(result1.vaporOut).toBe(result1.totalVaporOut);
    expect(result1.brineOut).toBe(result1.totalBrineOut);
  });
});

// ============================================================================
// Mass & Energy Balance
// ============================================================================

describe('calculateEffect — balance checks', () => {
  const result1 = calculateEffect(makeEffect1Input());
  const result3 = calculateEffect(makeEffect3Input());

  it('effect 1 mass balance error is small (< 1% of input)', () => {
    const totalIn = 833 + 1875; // steam + seawater
    expect(Math.abs(result1.massBalance)).toBeLessThan(totalIn * 0.01);
  });

  it('effect 3 mass balance error is small', () => {
    const totalIn = 620 + 1300 + 1875 + 3500; // vapor + dist + SW + cascade
    expect(Math.abs(result3.massBalance)).toBeLessThan(totalIn * 0.01);
  });

  it('effect 1 energy balance error < 5%', () => {
    expect(result1.energyBalanceError).toBeLessThan(5);
  });

  it('effect 3 energy balance error < 5%', () => {
    expect(result3.energyBalanceError).toBeLessThan(5);
  });

  it('heat transferred is positive for both effects', () => {
    expect(result1.heatTransferred).toBeGreaterThan(0);
    expect(result3.heatTransferred).toBeGreaterThan(0);
  });
});

// ============================================================================
// Temperature & Pressure
// ============================================================================

describe('calculateEffect — thermodynamic properties', () => {
  const result = calculateEffect(makeEffect1Input());

  it('BPE is positive', () => {
    expect(result.bpe).toBeGreaterThan(0);
    expect(result.bpe).toBeLessThan(2); // typical range 0.3-1.5°C
  });

  it('NEA is positive for first effect', () => {
    expect(result.nea).toBeCloseTo(0.2, 1);
  });

  it('pressure is positive (bar abs)', () => {
    expect(result.pressure).toBeGreaterThan(0);
    expect(result.pressure).toBeLessThan(1); // sub-atmospheric for MED
  });

  it('effective ΔT is steam temp - brine boiling temp', () => {
    const expected = 57.3 - (55.0 + result.bpe);
    expect(result.effectiveDeltaT).toBeCloseTo(expected, 1);
  });
});

// ============================================================================
// With Brine Recirculation
// ============================================================================

describe('calculateEffect — with recirculation', () => {
  const result = calculateEffect(
    makeEffect1Input({
      recircBrineFlow: 1000,
      recircBrineTemp: 42,
      recircBrineSalinity: 52500,
    })
  );

  it('recirc brine appears in spray zone', () => {
    expect(result.shellSprayZone.recircBrineIn.flow).toBe(1000);
  });

  it('total spray is seawater + recirc', () => {
    const totalSpray =
      result.shellSprayZone.seawaterIn.flow + result.shellSprayZone.recircBrineIn.flow;
    expect(totalSpray).toBe(1875 + 1000);
  });

  it('sensible heat increases with more spray to heat', () => {
    const resultNoRecirc = calculateEffect(makeEffect1Input());
    expect(result.shellSprayZone.sensibleHeat).toBeGreaterThan(
      resultNoRecirc.shellSprayZone.sensibleHeat
    );
  });
});

// ============================================================================
// With Preheater
// ============================================================================

describe('calculateEffect — with preheater', () => {
  const result = calculateEffect(
    makeEffect1Input({
      preheater: { effectNumber: 1, vaporFlow: 50 },
    })
  );

  it('vapor to preheater is diverted', () => {
    expect(result.vaporToPreheater).not.toBeNull();
    expect(result.vaporToPreheater!.flow).toBe(50);
  });

  it('total vapor out is reduced by preheater diversion', () => {
    const resultNoPH = calculateEffect(makeEffect1Input());
    expect(result.totalVaporOut.flow).toBeCloseTo(resultNoPH.totalVaporOut.flow - 50, 0);
  });
});

// ============================================================================
// With Preheater Condensate (Feature 1: condensate routing)
// ============================================================================

describe('calculateEffect — with preheater condensate', () => {
  const result = calculateEffect(
    makeEffect3Input({
      preheaterCondensateInFlow: 200, // 200 kg/hr from upstream preheater
      preheaterCondensateInTemp: 52, // at upstream effect's vapor temp
    })
  );
  const resultNoCond = calculateEffect(makeEffect3Input());

  it('preheater condensate increases tube side mass in', () => {
    expect(result.tubeSide.massIn).toBeGreaterThan(resultNoCond.tubeSide.massIn);
    expect(result.tubeSide.massIn - resultNoCond.tubeSide.massIn).toBeCloseTo(200, 0);
  });

  it('condensate out includes preheater condensate', () => {
    expect(result.tubeSide.condensateOut.flow).toBeGreaterThan(
      resultNoCond.tubeSide.condensateOut.flow
    );
  });

  it('preheater condensate flashes at lower pressure (small amount)', () => {
    // PH condensate at 52°C entering effect at 49°C → some flash
    // The flash vapor is added to distillateFlashVapor
    expect(result.tubeSide.distillateFlashVapor).toBeGreaterThan(
      resultNoCond.tubeSide.distillateFlashVapor
    );
  });

  it('energy balance still closes (< 5%)', () => {
    expect(result.energyBalanceError).toBeLessThan(5);
  });

  it('mass balance error is small', () => {
    const totalIn = 620 + 1300 + 200 + 1875 + 3500; // vapor + dist + PH cond + SW + cascade
    expect(Math.abs(result.massBalance)).toBeLessThan(totalIn * 0.01);
  });
});
