/**
 * Strainer Sizing Calculator Tests
 *
 * Tests for mesh size selection, pressure drop calculations for Y-type and
 * bucket-type strainers at clean and 50% clogged conditions. Covers:
 * - Pressure drop calculations (body, screen, clogged)
 * - Mesh recommendation by fluid type
 * - Available line sizes
 * - Different strainer types (K-factor differences)
 * - Edge cases (extreme flows, mesh override)
 */

import {
  calculateStrainerSizing,
  getRecommendedMeshIndex,
  getAvailableLineSizes,
  STANDARD_MESH_SIZES,
  type StrainerSizingInput,
} from './strainerSizingCalculator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidInput(overrides: Partial<StrainerSizingInput> = {}): StrainerSizingInput {
  return {
    fluidType: 'seawater',
    flowRate: 50,
    lineSize: '4',
    strainerType: 'y_type',
    fluidDensity: 1025,
    fluidViscosity: 1.0,
    ...overrides,
  };
}

// ===========================================================================
// calculateStrainerSizing — basic results
// ===========================================================================

describe('calculateStrainerSizing', () => {
  const result = calculateStrainerSizing(makeValidInput());

  it('has body pressure drop > 0', () => {
    expect(result.bodyPressureDrop).toBeGreaterThan(0);
  });

  it('has screen pressure drop (clean) > 0', () => {
    expect(result.screenPressureDropClean).toBeGreaterThan(0);
  });

  it('clogged pressure drop is 4x screen clean pressure drop', () => {
    // At 50% clog velocity doubles -> dP = 4x screen dP
    expect(result.screenPressureDropClogged).toBeCloseTo(result.screenPressureDropClean * 4, 3);
  });

  it('total clean pressure drop < 1 bar for normal conditions', () => {
    expect(result.totalPressureDropClean).toBeLessThan(1);
  });

  it('total clogged > total clean', () => {
    expect(result.totalPressureDropClogged).toBeGreaterThan(result.totalPressureDropClean);
  });

  it('has mesh comparison with multiple entries', () => {
    expect(result.meshComparison.length).toBeGreaterThanOrEqual(3);
  });

  it('marks recommended mesh in comparison', () => {
    const recommended = result.meshComparison.filter((m) => m.isRecommended);
    expect(recommended.length).toBe(1);
  });

  it('marks selected mesh in comparison', () => {
    const selected = result.meshComparison.filter((m) => m.isSelected);
    expect(selected.length).toBe(1);
  });

  it('has positive pipe velocity', () => {
    expect(result.pipeVelocity).toBeGreaterThan(0);
  });

  it('has positive Reynolds number', () => {
    expect(result.reynoldsNumber).toBeGreaterThan(0);
  });

  it('returns the correct strainer type and line size', () => {
    expect(result.strainerType).toBe('y_type');
    expect(result.lineSize).toBe('4');
  });
});

// ===========================================================================
// getRecommendedMeshIndex
// ===========================================================================

describe('getRecommendedMeshIndex', () => {
  it('seawater returns mesh #14 (1.5 mm, index 4)', () => {
    const idx = getRecommendedMeshIndex('seawater');
    expect(idx).toBe(4);
    expect(STANDARD_MESH_SIZES[idx]!.meshNumber).toBe(14);
  });

  it('brine returns same as seawater (index 4)', () => {
    expect(getRecommendedMeshIndex('brine')).toBe(getRecommendedMeshIndex('seawater'));
  });

  it('condensate returns finer mesh than seawater', () => {
    const seaIdx = getRecommendedMeshIndex('seawater');
    const condIdx = getRecommendedMeshIndex('condensate');
    // Higher index = finer mesh
    expect(condIdx).toBeGreaterThan(seaIdx);
  });

  it('dm_water returns finest recommendation', () => {
    const dmIdx = getRecommendedMeshIndex('dm_water');
    const condIdx = getRecommendedMeshIndex('condensate');
    expect(dmIdx).toBeGreaterThanOrEqual(condIdx);
  });

  it('cooling_water returns coarser mesh than seawater', () => {
    const cwIdx = getRecommendedMeshIndex('cooling_water');
    const swIdx = getRecommendedMeshIndex('seawater');
    expect(cwIdx).toBeLessThan(swIdx);
  });
});

// ===========================================================================
// getAvailableLineSizes
// ===========================================================================

describe('getAvailableLineSizes', () => {
  const sizes = getAvailableLineSizes();

  it('returns an array of standard sizes', () => {
    expect(Array.isArray(sizes)).toBe(true);
    expect(sizes.length).toBeGreaterThan(5);
  });

  it('includes common sizes', () => {
    expect(sizes).toContain('2');
    expect(sizes).toContain('3');
    expect(sizes).toContain('4');
    expect(sizes).toContain('6');
  });
});

// ===========================================================================
// Different strainer types
// ===========================================================================

describe('strainer type differences', () => {
  const yResult = calculateStrainerSizing(makeValidInput({ strainerType: 'y_type' }));
  const bucketResult = calculateStrainerSizing(makeValidInput({ strainerType: 'bucket_type' }));

  it('bucket type has higher body K-factor than y-type', () => {
    expect(bucketResult.bodyKFactor).toBeGreaterThan(yResult.bodyKFactor);
  });

  it('bucket type has higher body pressure drop', () => {
    expect(bucketResult.bodyPressureDrop).toBeGreaterThan(yResult.bodyPressureDrop);
  });

  it('bucket type has larger screen area (lower screen velocity)', () => {
    expect(bucketResult.screenAreaMm2).toBeGreaterThan(yResult.screenAreaMm2);
    expect(bucketResult.screenVelocityClean).toBeLessThan(yResult.screenVelocityClean);
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('edge cases', () => {
  it('handles very high flow rate (200 m3/hr)', () => {
    const result = calculateStrainerSizing(makeValidInput({ flowRate: 200 }));
    expect(result.pipeVelocity).toBeGreaterThan(0);
    expect(result.totalPressureDropClean).toBeGreaterThan(0);
    // High flow should generate a velocity warning
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('handles very low flow rate (1 m3/hr)', () => {
    const result = calculateStrainerSizing(makeValidInput({ flowRate: 1 }));
    expect(result.pipeVelocity).toBeGreaterThan(0);
    // Very low flow may round to 0 at 4 decimal places — just check it does not throw
    expect(result.totalPressureDropClean).toBeGreaterThanOrEqual(0);
  });

  it('accepts mesh override index', () => {
    const overrideIdx = 8; // Mesh #60 (very fine)
    const result = calculateStrainerSizing(makeValidInput({ meshIndex: overrideIdx }));
    expect(result.selectedMeshIndex).toBe(overrideIdx);
    expect(result.isRecommendedMesh).toBe(false);
    expect(result.meshNumber).toBe(STANDARD_MESH_SIZES[overrideIdx]!.meshNumber);
  });

  it('clamps mesh override to valid range', () => {
    const result = calculateStrainerSizing(makeValidInput({ meshIndex: 999 }));
    expect(result.selectedMeshIndex).toBe(STANDARD_MESH_SIZES.length - 1);
  });

  it('custom fluid type uses medium-fine mesh default', () => {
    const result = calculateStrainerSizing(makeValidInput({ fluidType: 'custom' }));
    const expectedIdx = getRecommendedMeshIndex('custom');
    expect(result.selectedMeshIndex).toBe(expectedIdx);
    expect(result.isRecommendedMesh).toBe(true);
  });
});

// ===========================================================================
// Input validation
// ===========================================================================

describe('input validation', () => {
  it('throws for zero flow rate', () => {
    expect(() => calculateStrainerSizing(makeValidInput({ flowRate: 0 }))).toThrow(/flow rate/i);
  });

  it('throws for negative density', () => {
    expect(() => calculateStrainerSizing(makeValidInput({ fluidDensity: -1 }))).toThrow(/density/i);
  });

  it('throws for zero viscosity', () => {
    expect(() => calculateStrainerSizing(makeValidInput({ fluidViscosity: 0 }))).toThrow(
      /viscosity/i
    );
  });

  it('throws for unknown line size', () => {
    expect(() => calculateStrainerSizing(makeValidInput({ lineSize: '999' }))).toThrow(
      /not found/i
    );
  });
});
