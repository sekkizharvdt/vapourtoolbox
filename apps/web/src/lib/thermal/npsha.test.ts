/**
 * NPSHa balance — the shared primitive.
 *
 * These tests pin the behaviours the two callers depend on, in particular the
 * ones a consolidation could quietly change: the sign convention, that nothing
 * is clamped, and that the terms come back untouched alongside the sum.
 */

import { computeNPSHa, npshMargin } from './npsha';

describe('computeNPSHa', () => {
  it('sums the four heads with the documented signs', () => {
    const { npsha } = computeNPSHa({
      staticHead: 4,
      pressureHead: 2.1,
      vaporPressureHead: 2.0,
      frictionLoss: 0.5,
    });

    // 4 + 2.1 − 2.0 − 0.5
    expect(npsha).toBeCloseTo(3.6, 10);
  });

  it('returns the terms unchanged alongside the result', () => {
    const terms = {
      staticHead: 3.2,
      pressureHead: 2.04,
      vaporPressureHead: 2.04,
      frictionLoss: 0.35,
    };

    expect(computeNPSHa(terms)).toEqual({ ...terms, npsha: 2.85 });
  });

  it('collapses to staticHead − frictionLoss for a saturated vessel', () => {
    // A flash chamber holds liquid at its own saturation temperature, so the
    // vessel pressure and the vapour pressure are the same number.
    const saturated = 2.0387;
    const { npsha } = computeNPSHa({
      staticHead: 4,
      pressureHead: saturated,
      vaporPressureHead: saturated,
      frictionLoss: 0.5,
    });

    expect(npsha).toBeCloseTo(4 - 0.5, 10);
  });

  it('reports a negative NPSHa rather than clamping it', () => {
    // Pump above the liquid: a suction lift. The calculation must say the pump
    // will cavitate, not floor the number at zero — a clamp published as a
    // physical result is indistinguishable from a real one downstream.
    const { npsha } = computeNPSHa({
      staticHead: -1.5,
      pressureHead: 2.0,
      vaporPressureHead: 2.0,
      frictionLoss: 0.5,
    });

    expect(npsha).toBeCloseTo(-2.0, 10);
    expect(npsha).toBeLessThan(0);
  });

  it('is linear in the friction term', () => {
    // NPSHa moves metre for metre with friction, which is why the flash
    // chamber's flat 0.5 m estimate is worth making an explicit input.
    const base = { staticHead: 4, pressureHead: 2, vaporPressureHead: 2 };
    const low = computeNPSHa({ ...base, frictionLoss: 0.5 }).npsha;
    const high = computeNPSHa({ ...base, frictionLoss: 1.5 }).npsha;

    expect(low - high).toBeCloseTo(1.0, 10);
  });
});

describe('npshMargin', () => {
  it('is available minus required', () => {
    expect(npshMargin(3.6, 2.5)).toBeCloseTo(1.1, 10);
  });

  it('goes negative when the pump needs more than the process offers', () => {
    expect(npshMargin(1.2, 2.5)).toBeCloseTo(-1.3, 10);
  });
});
