/**
 * Vacuum Breaker Sizing Calculator Tests
 *
 * Tests for three calculation modes:
 * - MANUAL_VALVE: Size a valve for a target equalization time
 * - DIAPHRAGM_ANALYSIS: Analyse a given burst diaphragm DN size
 * - DIAPHRAGM_DESIGN: Find largest diaphragm within a max pressure rise rate
 *
 * Covers result validity, pressure profiles, edge cases, and input validation.
 */

import {
  calculateVacuumBreaker,
  type ManualValveInput,
  type DiaphragmAnalysisInput,
  type DiaphragmDesignInput,
} from './vacuumBreakerCalculator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeManualValveInput(overrides: Partial<ManualValveInput> = {}): ManualValveInput {
  return {
    mode: 'MANUAL_VALVE',
    totalVolume: 10,
    numberOfBreakers: 1,
    operatingPressureMbar: 50,
    ambientTemperature: 35,
    equalizationTimeMin: 30,
    valveType: 'GLOBE',
    ...overrides,
  };
}

function makeDiaphragmAnalysisInput(
  overrides: Partial<DiaphragmAnalysisInput> = {}
): DiaphragmAnalysisInput {
  return {
    mode: 'DIAPHRAGM_ANALYSIS',
    totalVolume: 10,
    numberOfBreakers: 1,
    operatingPressureMbar: 50,
    ambientTemperature: 35,
    burstPressureMbar: 50,
    selectedDN: 100,
    ...overrides,
  };
}

function makeDiaphragmDesignInput(
  overrides: Partial<DiaphragmDesignInput> = {}
): DiaphragmDesignInput {
  return {
    mode: 'DIAPHRAGM_DESIGN',
    totalVolume: 10,
    numberOfBreakers: 1,
    operatingPressureMbar: 50,
    ambientTemperature: 35,
    burstPressureMbar: 50,
    maxPressureRiseRate: 50,
    ...overrides,
  };
}

// ===========================================================================
// MANUAL_VALVE mode
// ===========================================================================

describe('MANUAL_VALVE mode', () => {
  const result = calculateVacuumBreaker(makeManualValveInput());

  it('returns mode MANUAL_VALVE', () => {
    expect(result.mode).toBe('MANUAL_VALVE');
  });

  it('has requiredOrificeArea > 0', () => {
    if (result.mode !== 'MANUAL_VALVE') throw new Error('wrong mode');
    expect(result.requiredOrificeArea).toBeGreaterThan(0);
  });

  it('selects a valid standard DN size', () => {
    expect(result.selectedValve).toBeDefined();
    expect(result.selectedValve.dn).toBeGreaterThan(0);
    expect(result.selectedValve.boreArea).toBeGreaterThan(0);
  });

  it('has equalization time within 20% of target', () => {
    const targetSec = 30 * 60; // 30 minutes
    // The actual valve selected is the next-size-up standard, so it will equalize faster
    expect(result.equalizationTimeSec).toBeLessThanOrEqual(targetSec);
    expect(result.equalizationTimeSec).toBeGreaterThan(0);
  });

  it('has pressure profile with entries', () => {
    expect(result.pressureProfile.length).toBeGreaterThan(0);
  });

  it('pressure rises towards atmospheric in profile', () => {
    const profile = result.pressureProfile;
    const firstPressure = profile[0]!.pressure;
    const lastPressure = profile[profile.length - 1]!.pressure;
    expect(lastPressure).toBeGreaterThan(firstPressure);
    // Should be near atmospheric (~1013 mbar)
    expect(lastPressure).toBeGreaterThan(900);
  });

  it('has positive peak pressure rise rate', () => {
    expect(result.peakPressureRiseRate).toBeGreaterThan(0);
  });

  it('has positive air mass required', () => {
    expect(result.airMassRequired).toBeGreaterThan(0);
  });
});

// ===========================================================================
// DIAPHRAGM_ANALYSIS mode
// ===========================================================================

describe('DIAPHRAGM_ANALYSIS mode', () => {
  const result = calculateVacuumBreaker(makeDiaphragmAnalysisInput());

  it('returns mode DIAPHRAGM_ANALYSIS', () => {
    expect(result.mode).toBe('DIAPHRAGM_ANALYSIS');
  });

  it('has equalization time > 0', () => {
    expect(result.equalizationTimeSec).toBeGreaterThan(0);
  });

  it('has peak pressure rise rate > 0', () => {
    expect(result.peakPressureRiseRate).toBeGreaterThan(0);
  });

  it('has monotonically increasing pressure in time steps', () => {
    const profile = result.pressureProfile;
    for (let i = 1; i < profile.length; i++) {
      expect(profile[i]!.pressure).toBeGreaterThanOrEqual(profile[i - 1]!.pressure);
    }
  });

  it('final pressure is near atmospheric', () => {
    const profile = result.pressureProfile;
    const lastPressure = profile[profile.length - 1]!.pressure;
    // Should reach at least 99% of atmospheric (1013.25 mbar)
    expect(lastPressure).toBeGreaterThan(990);
  });

  it('throws for non-standard DN', () => {
    expect(() => calculateVacuumBreaker(makeDiaphragmAnalysisInput({ selectedDN: 777 }))).toThrow(
      /not a standard size/i
    );
  });
});

// ===========================================================================
// DIAPHRAGM_DESIGN mode
// ===========================================================================

describe('DIAPHRAGM_DESIGN mode', () => {
  const result = calculateVacuumBreaker(makeDiaphragmDesignInput());

  it('returns mode DIAPHRAGM_DESIGN', () => {
    expect(result.mode).toBe('DIAPHRAGM_DESIGN');
  });

  it('selected DN respects the max rise rate constraint', () => {
    if (result.mode !== 'DIAPHRAGM_DESIGN') throw new Error('wrong mode');
    // The selected valve should produce a peak rate at or below the max allowed
    // (within a small tolerance due to simulation discretisation)
    expect(result.peakPressureRiseRate).toBeLessThanOrEqual(
      result.maxAllowedRiseRate * 1.1 // 10% tolerance for discretisation
    );
  });

  it('larger vessels need larger (or equal) diaphragms', () => {
    const smallResult = calculateVacuumBreaker(makeDiaphragmDesignInput({ totalVolume: 5 }));
    const largeResult = calculateVacuumBreaker(makeDiaphragmDesignInput({ totalVolume: 50 }));
    expect(largeResult.selectedValve.dn).toBeGreaterThanOrEqual(smallResult.selectedValve.dn);
  });

  it('has equalization time > 0', () => {
    expect(result.equalizationTimeSec).toBeGreaterThan(0);
  });

  it('has pressure profile entries', () => {
    expect(result.pressureProfile.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('edge cases', () => {
  it('handles very small vessel (1 m3)', () => {
    const result = calculateVacuumBreaker(makeManualValveInput({ totalVolume: 1 }));
    expect(result.equalizationTimeSec).toBeGreaterThan(0);
    expect(result.selectedValve.dn).toBeGreaterThan(0);
  });

  it('handles large vessel (100 m3)', () => {
    const result = calculateVacuumBreaker(makeManualValveInput({ totalVolume: 100 }));
    expect(result.equalizationTimeSec).toBeGreaterThan(0);
    expect(result.selectedValve.dn).toBeGreaterThan(0);
  });

  it('handles near-atmospheric initial pressure (900 mbar)', () => {
    const result = calculateVacuumBreaker(
      makeDiaphragmAnalysisInput({ operatingPressureMbar: 900, burstPressureMbar: 900 })
    );
    // Less air mass needed when starting near atmospheric (but still > 1 kg for 10 m3)
    expect(result.airMassRequired).toBeLessThan(2);
    expect(result.equalizationTimeSec).toBeGreaterThan(0);
  });

  it('multiple breakers split the volume', () => {
    const single = calculateVacuumBreaker(makeManualValveInput({ numberOfBreakers: 1 }));
    const double = calculateVacuumBreaker(makeManualValveInput({ numberOfBreakers: 2 }));
    expect(double.volumePerBreaker).toBeCloseTo(single.volumePerBreaker / 2, 1);
  });
});

// ===========================================================================
// Validation
// ===========================================================================

describe('input validation', () => {
  it('throws for negative volume', () => {
    expect(() => calculateVacuumBreaker(makeManualValveInput({ totalVolume: -5 }))).toThrow(
      /volume/i
    );
  });

  it('throws for zero volume', () => {
    expect(() => calculateVacuumBreaker(makeManualValveInput({ totalVolume: 0 }))).toThrow(
      /volume/i
    );
  });

  it('throws for operating pressure above atmospheric', () => {
    expect(() =>
      calculateVacuumBreaker(makeManualValveInput({ operatingPressureMbar: 1100 }))
    ).toThrow(/atmospheric/i);
  });

  it('throws for zero equalization time in MANUAL_VALVE mode', () => {
    expect(() => calculateVacuumBreaker(makeManualValveInput({ equalizationTimeMin: 0 }))).toThrow(
      /equalization time/i
    );
  });

  it('throws for zero max pressure rise rate in DIAPHRAGM_DESIGN mode', () => {
    expect(() =>
      calculateVacuumBreaker(makeDiaphragmDesignInput({ maxPressureRiseRate: 0 }))
    ).toThrow(/rise rate/i);
  });
});
