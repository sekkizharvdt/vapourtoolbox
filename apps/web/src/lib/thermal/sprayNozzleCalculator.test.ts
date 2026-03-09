/**
 * Spray Nozzle Calculator — Unit Tests
 */

import {
  selectSprayNozzles,
  calculateFlowAtPressure,
  interpolateSprayAngle,
  calculateCoverage,
  calculateNozzleLayout,
  getOrderingModel,
  flowToLpm,
  lpmToFlowUnit,
  NOZZLE_CATEGORIES,
  NOZZLE_CATEGORY_LABELS,
  type NozzleCategory,
  type SprayNozzleInput,
  type NozzleLayoutInput,
} from './sprayNozzleCalculator';

// ── Constants ────────────────────────────────────────────────────────────────

describe('Constants', () => {
  it('NOZZLE_CATEGORIES has all four categories', () => {
    const keys = Object.keys(NOZZLE_CATEGORIES) as NozzleCategory[];
    expect(keys).toContain('full_cone_circular');
    expect(keys).toContain('full_cone_wide');
    expect(keys).toContain('full_cone_square');
    expect(keys).toContain('hollow_cone_circular');
  });

  it('each category has nozzles and metadata', () => {
    for (const key of Object.keys(NOZZLE_CATEGORIES) as NozzleCategory[]) {
      const config = NOZZLE_CATEGORIES[key];
      expect(config.nozzles.length).toBeGreaterThan(0);
      expect(config.flowExponent).toBeGreaterThan(0);
      expect(config.ratedPressure).toBeGreaterThan(0);
      expect(config.anglePressures).toHaveLength(3);
      expect(config.seriesName).toBeTruthy();
    }
  });

  it('NOZZLE_CATEGORY_LABELS has labels for all categories', () => {
    for (const key of Object.keys(NOZZLE_CATEGORIES) as NozzleCategory[]) {
      expect(NOZZLE_CATEGORY_LABELS[key]).toBeTruthy();
    }
  });

  it('every nozzle entry has valid fields', () => {
    for (const key of Object.keys(NOZZLE_CATEGORIES) as NozzleCategory[]) {
      for (const nozzle of NOZZLE_CATEGORIES[key].nozzles) {
        expect(nozzle.capacitySize).toBeTruthy();
        expect(nozzle.orificeDia).toBeGreaterThan(0);
        expect(nozzle.ratedFlow).toBeGreaterThan(0);
        expect(nozzle.angleAtLow).toBeGreaterThan(0);
        expect(nozzle.angleAtMid).toBeGreaterThan(0);
        expect(nozzle.angleAtHigh).toBeGreaterThan(0);
      }
    }
  });
});

// ── calculateFlowAtPressure ──────────────────────────────────────────────────

describe('calculateFlowAtPressure', () => {
  it('flow at rated pressure equals rated flow', () => {
    const result = calculateFlowAtPressure(10, 3, 3, 0.5);
    expect(result).toBeCloseTo(10, 2);
  });

  it('higher pressure → higher flow', () => {
    const low = calculateFlowAtPressure(10, 3, 1, 0.5);
    const high = calculateFlowAtPressure(10, 3, 6, 0.5);
    expect(high).toBeGreaterThan(low);
  });

  it('follows square root law for exponent 0.5', () => {
    // Q = 10 × (6/3)^0.5 = 10 × √2 ≈ 14.14
    const result = calculateFlowAtPressure(10, 3, 6, 0.5);
    expect(result).toBeCloseTo(10 * Math.sqrt(2), 2);
  });

  it('handles zero pressure gracefully', () => {
    const result = calculateFlowAtPressure(10, 3, 0, 0.5);
    expect(result).toBe(0);
  });
});

// ── interpolateSprayAngle ────────────────────────────────────────────────────

describe('interpolateSprayAngle', () => {
  const nozzle = {
    capacitySize: 'TEST',
    inletConn: '1/4',
    orificeDia: 5,
    maxFreePassage: 3,
    ratedFlow: 10,
    angleAtLow: 50,
    angleAtMid: 65,
    angleAtHigh: 70,
  };

  it('returns low angle at low pressure', () => {
    const angle = interpolateSprayAngle(nozzle, 0.5, [0.5, 1.5, 3]);
    expect(angle).toBe(50);
  });

  it('returns high angle at high pressure', () => {
    const angle = interpolateSprayAngle(nozzle, 3, [0.5, 1.5, 3]);
    expect(angle).toBe(70);
  });

  it('interpolates between low and mid', () => {
    const angle = interpolateSprayAngle(nozzle, 1.0, [0.5, 1.5, 3]);
    expect(angle).toBeGreaterThan(50);
    expect(angle).toBeLessThan(65);
  });

  it('interpolates between mid and high', () => {
    const angle = interpolateSprayAngle(nozzle, 2.0, [0.5, 1.5, 3]);
    expect(angle).toBeGreaterThan(65);
    expect(angle).toBeLessThan(70);
  });
});

// ── calculateCoverage ────────────────────────────────────────────────────────

describe('calculateCoverage', () => {
  it('wider angle → larger coverage', () => {
    const narrow = calculateCoverage(30, 500);
    const wide = calculateCoverage(90, 500);
    expect(wide).toBeGreaterThan(narrow);
  });

  it('greater distance → larger coverage', () => {
    const near = calculateCoverage(60, 300);
    const far = calculateCoverage(60, 600);
    expect(far).toBeGreaterThan(near);
  });

  it('zero angle → zero coverage', () => {
    expect(calculateCoverage(0, 500)).toBeCloseTo(0, 2);
  });

  it('90° at 500mm → 1000mm diameter', () => {
    // coverage = 2 × 500 × tan(45°) = 1000
    expect(calculateCoverage(90, 500)).toBeCloseTo(1000, 0);
  });
});

// ── getOrderingModel ─────────────────────────────────────────────────────────

describe('getOrderingModel', () => {
  it('returns a non-empty string', () => {
    for (const key of Object.keys(NOZZLE_CATEGORIES) as NozzleCategory[]) {
      const nozzle = NOZZLE_CATEGORIES[key].nozzles[0]!;
      const model = getOrderingModel(nozzle, key);
      expect(model).toBeTruthy();
      expect(typeof model).toBe('string');
    }
  });
});

// ── flowToLpm / lpmToFlowUnit ────────────────────────────────────────────────

describe('flow unit conversions', () => {
  it('lpm passthrough', () => {
    expect(flowToLpm(10, 'lpm')).toBe(10);
    expect(lpmToFlowUnit(10, 'lpm')).toBe(10);
  });

  it('kg_hr to lpm and back', () => {
    // 60 kg/hr = 1 lpm (assuming water)
    const lpm = flowToLpm(60, 'kg_hr');
    expect(lpm).toBeCloseTo(1, 1);
    const backToKgHr = lpmToFlowUnit(1, 'kg_hr');
    expect(backToKgHr).toBeCloseTo(60, 0);
  });

  it('ton_hr to lpm and back', () => {
    // 1 ton/hr = 1000/60 ≈ 16.67 lpm
    const lpm = flowToLpm(1, 'ton_hr');
    expect(lpm).toBeCloseTo(16.67, 0);
  });
});

// ── selectSprayNozzles ───────────────────────────────────────────────────────

describe('selectSprayNozzles', () => {
  const baseInput: SprayNozzleInput = {
    category: 'full_cone_circular',
    requiredFlow: 5,
    operatingPressure: 2,
  };

  it('returns matches within tolerance', () => {
    const result = selectSprayNozzles(baseInput);
    expect(result.matches.length).toBeGreaterThan(0);

    for (const match of result.matches) {
      expect(Math.abs(match.deviationPercent)).toBeLessThanOrEqual(25); // default ±25%
    }
  });

  it('returns correct category and pressure', () => {
    const result = selectSprayNozzles(baseInput);
    expect(result.category).toBe('full_cone_circular');
    expect(result.operatingPressure).toBe(2);
  });

  it('divides flow by number of nozzles', () => {
    const result = selectSprayNozzles({ ...baseInput, numberOfNozzles: 4 });
    expect(result.flowPerNozzle).toBeCloseTo(5 / 4, 2);
    expect(result.numberOfNozzles).toBe(4);
  });

  it('stricter tolerance → fewer matches', () => {
    const wide = selectSprayNozzles({ ...baseInput, tolerance: 0.5 });
    const tight = selectSprayNozzles({ ...baseInput, tolerance: 0.05 });
    expect(wide.matches.length).toBeGreaterThanOrEqual(tight.matches.length);
  });

  it('throws for zero flow', () => {
    expect(() => selectSprayNozzles({ ...baseInput, requiredFlow: 0 })).toThrow();
  });

  it('throws for zero pressure', () => {
    expect(() => selectSprayNozzles({ ...baseInput, operatingPressure: 0 })).toThrow();
  });

  it('matches include spray angle and model', () => {
    const result = selectSprayNozzles(baseInput);
    if (result.matches.length > 0) {
      const match = result.matches[0]!;
      expect(match.sprayAngle).toBeGreaterThan(0);
      expect(match.flowAtPressure).toBeGreaterThan(0);
      expect(match.modelNumber).toBeTruthy();
    }
  });

  it('works for all four categories', () => {
    const categories: NozzleCategory[] = [
      'full_cone_circular',
      'full_cone_wide',
      'full_cone_square',
      'hollow_cone_circular',
    ];
    for (const cat of categories) {
      const result = selectSprayNozzles({
        category: cat,
        requiredFlow: 3,
        operatingPressure: 2,
        tolerance: 0.5,
      });
      expect(result.category).toBe(cat);
      // Not all categories may have matches for 3 lpm, but the function should not throw
    }
  });
});

// ── calculateNozzleLayout ────────────────────────────────────────────────────

describe('calculateNozzleLayout', () => {
  const baseInput: NozzleLayoutInput = {
    category: 'full_cone_circular',
    totalFlow: 50,
    operatingPressure: 2,
    bundleLength: 2000,
    bundleWidth: 1000,
  };

  it('returns layout matches', () => {
    const result = calculateNozzleLayout(baseInput);
    expect(result.matches.length).toBeGreaterThanOrEqual(0);
    expect(result.category).toBe('full_cone_circular');
    expect(result.operatingPressure).toBe(2);
    expect(result.bundleLength).toBe(2000);
    expect(result.bundleWidth).toBe(1000);
  });

  it('matches have correct structure', () => {
    const result = calculateNozzleLayout(baseInput);
    if (result.matches.length > 0) {
      const match = result.matches[0]!;
      expect(match.totalNozzles).toBeGreaterThan(0);
      expect(match.nozzlesAlongLength).toBeGreaterThan(0);
      expect(match.rowsAcrossWidth).toBeGreaterThan(0);
      expect(match.derivedHeight).toBeGreaterThan(0);
      expect(match.coverageDiameter).toBeGreaterThan(0);
      expect(match.pitchAlongLength).toBeGreaterThan(0);
    }
  });

  it('throws for invalid dimensions', () => {
    expect(() => calculateNozzleLayout({ ...baseInput, bundleLength: 0 })).toThrow();
    expect(() => calculateNozzleLayout({ ...baseInput, bundleWidth: 0 })).toThrow();
    expect(() => calculateNozzleLayout({ ...baseInput, totalFlow: 0 })).toThrow();
  });

  it('derived height respects min/max bounds', () => {
    const result = calculateNozzleLayout({
      ...baseInput,
      minHeight: 400,
      maxHeight: 600,
    });
    for (const match of result.matches) {
      expect(match.derivedHeight).toBeGreaterThanOrEqual(400);
      expect(match.derivedHeight).toBeLessThanOrEqual(600);
    }
  });
});
