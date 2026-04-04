/**
 * Single Tube Analysis Calculator Tests
 *
 * Tests for single horizontal tube analysis with vapour condensing inside
 * and spray water evaporating on the outside. Covers:
 * - Input validation (geometry, temperatures, flows, salinity)
 * - Heat transfer coefficient calculations (condensation + evaporation)
 * - Overall U-value and heat/mass balance
 * - Wetting analysis
 * - Quick-select material helpers
 * - Edge cases (pure water, extreme flows)
 */

// Mock @vapour/constants — must be before imports
jest.mock('@vapour/constants', () => ({
  getSeawaterDensity: jest.fn((salinity: number, temp: number) => {
    return 1000 + salinity * 0.0008 - (temp - 20) * 0.3;
  }),
  getSeawaterViscosity: jest.fn((_salinity: number, temp: number) => {
    return 0.001 * Math.exp(-0.02 * (temp - 20));
  }),
  getSeawaterSpecificHeat: jest.fn((_salinity: number, _temp: number) => {
    return 3.95;
  }),
  getSeawaterThermalConductivity: jest.fn((_salinity: number, _temp: number) => {
    return 0.63;
  }),
  getBoilingPointElevation: jest.fn((salinity: number, _temp: number) => {
    return salinity * 0.000015 + 0.2;
  }),
  getLatentHeat: jest.fn((temp: number) => {
    return 2500 - 2.4 * temp;
  }),
  getDensityLiquid: jest.fn((temp: number) => {
    return 1000 - (temp - 20) * 0.3;
  }),
  getDensityVapor: jest.fn((temp: number) => {
    return 0.05 + temp * 0.003;
  }),
}));

import {
  calculateSingleTube,
  validateSingleTubeInput,
  getDefaultWallThickness,
  getQuickSelectConductivity,
} from './singleTubeCalculator';
import type { SingleTubeInput } from '@vapour/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidInput(overrides: Partial<SingleTubeInput> = {}): SingleTubeInput {
  return {
    tubeOD: 25.4,
    wallThickness: 1.0,
    tubeLength: 1.2,
    tubeMaterial: 'Aluminium 5052',
    wallConductivity: 138,
    vapourTemperature: 55,
    vapourPressure: 157,
    vapourFlowRate: 0.1,
    sprayFluidType: 'SEAWATER',
    sprayTemperature: 35,
    spraySalinity: 35000,
    sprayFlowRate: 0.2,
    ...overrides,
  };
}

// ===========================================================================
// validateSingleTubeInput
// ===========================================================================

describe('validateSingleTubeInput', () => {
  it('returns no errors for valid input', () => {
    const result = validateSingleTubeInput(makeValidInput());
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects tube OD <= 0', () => {
    const result = validateSingleTubeInput(makeValidInput({ tubeOD: 0 }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /OD/i.test(e))).toBe(true);
  });

  it('rejects wall thickness >= tube radius', () => {
    const result = validateSingleTubeInput(makeValidInput({ tubeOD: 25.4, wallThickness: 13 }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /wall thickness/i.test(e))).toBe(true);
  });

  it('rejects vapour temperature <= 0', () => {
    const result = validateSingleTubeInput(makeValidInput({ vapourTemperature: -5 }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /vapour temperature/i.test(e))).toBe(true);
  });

  it('rejects vapour temperature > 200', () => {
    const result = validateSingleTubeInput(makeValidInput({ vapourTemperature: 250 }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /vapour temperature/i.test(e))).toBe(true);
  });

  it('rejects negative spray flow rate', () => {
    const result = validateSingleTubeInput(makeValidInput({ sprayFlowRate: -1 }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /spray flow/i.test(e))).toBe(true);
  });

  it('rejects negative vapour flow rate', () => {
    const result = validateSingleTubeInput(makeValidInput({ vapourFlowRate: -0.5 }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /vapour flow/i.test(e))).toBe(true);
  });

  it('rejects spray temperature >= vapour temperature', () => {
    const result = validateSingleTubeInput(
      makeValidInput({ vapourTemperature: 55, sprayTemperature: 55 })
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /spray temperature/i.test(e))).toBe(true);
  });

  it('rejects negative salinity', () => {
    const result = validateSingleTubeInput(makeValidInput({ spraySalinity: -100 }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /salinity/i.test(e))).toBe(true);
  });

  it('rejects salinity above 120000 ppm', () => {
    const result = validateSingleTubeInput(makeValidInput({ spraySalinity: 150000 }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => /salinity/i.test(e))).toBe(true);
  });

  it('issues warning for missing material name', () => {
    const result = validateSingleTubeInput(makeValidInput({ tubeMaterial: '' }));
    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// calculateSingleTube
// ===========================================================================

describe('calculateSingleTube', () => {
  const result = calculateSingleTube(makeValidInput());

  it('produces positive condensation HTC (inside film)', () => {
    expect(result.insideFilm.htc).toBeGreaterThan(0);
  });

  it('produces positive evaporation HTC (outside film)', () => {
    expect(result.outsideFilm.htc).toBeGreaterThan(0);
  });

  it('produces positive overall U-value', () => {
    expect(result.overallHTC).toBeGreaterThan(0);
  });

  it('has positive effective delta-T', () => {
    expect(result.effectiveDeltaT).toBeGreaterThan(0);
  });

  it('computes positive heat duty', () => {
    expect(result.heatMassBalance.heatDuty).toBeGreaterThan(0);
  });

  it('has positive inside film Reynolds number', () => {
    expect(result.insideFilm.reynoldsNumber).toBeGreaterThan(0);
  });

  it('has positive outside film Reynolds number', () => {
    expect(result.outsideFilm.reynoldsNumber).toBeGreaterThan(0);
  });

  it('calculates wetting rate', () => {
    expect(result.wettingRate).toBeGreaterThan(0);
    expect(result.minimumWettingRate).toBeGreaterThan(0);
    expect(result.wettingRatio).toBeGreaterThan(0);
  });

  it('has a wetting status string', () => {
    expect(['excellent', 'good', 'marginal', 'poor']).toContain(result.wettingStatus);
  });

  it('computes brine salinity out > feed salinity when evaporation occurs', () => {
    expect(result.heatMassBalance.brineOutSalinity).toBeGreaterThan(35000);
  });

  it('has all expected top-level result fields', () => {
    expect(result.tubeID).toBeDefined();
    expect(result.outerSurfaceArea).toBeGreaterThan(0);
    expect(result.innerSurfaceArea).toBeGreaterThan(0);
    expect(result.wallConductivity).toBe(138);
    expect(result.wallResistance).toBeGreaterThan(0);
    expect(result.boilingPointElevation).toBeGreaterThan(0);
    expect(result.requiredArea).toBeGreaterThan(0);
    expect(result.designArea).toBeGreaterThan(result.requiredArea);
  });

  it('has consistent heat/mass balance (condensation and evaporation latent heats)', () => {
    const { heatDuty, vapourCondensed, latentHeatCondensation } = result.heatMassBalance;
    // Q = m_condensed * hfg_condensation
    const qFromCondensate = vapourCondensed * latentHeatCondensation;
    expect(qFromCondensate).toBeCloseTo(heatDuty, 1);
  });

  it('throws for invalid input', () => {
    expect(() => calculateSingleTube(makeValidInput({ tubeOD: -1 }))).toThrow(/invalid input/i);
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('calculateSingleTube edge cases', () => {
  it('handles pure water spray (salinity = 0)', () => {
    const result = calculateSingleTube(
      makeValidInput({ spraySalinity: 0, sprayFluidType: 'PURE_WATER' })
    );
    expect(result.overallHTC).toBeGreaterThan(0);
    expect(result.heatMassBalance.brineOutSalinity).toBe(0);
    expect(result.boilingPointElevation).toBe(0);
  });

  it('handles very high spray flow rate without error', () => {
    const result = calculateSingleTube(makeValidInput({ sprayFlowRate: 5.0 }));
    expect(result.wettingRatio).toBeGreaterThan(1);
    expect(result.wettingStatus).toBe('excellent');
  });

  it('handles very low spray flow rate (poor wetting)', () => {
    const result = calculateSingleTube(makeValidInput({ sprayFlowRate: 0.001 }));
    expect(result.wettingRatio).toBeLessThan(2);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('condensation HTC is higher than evaporation HTC for typical conditions', () => {
    const result = calculateSingleTube(makeValidInput());
    // Nusselt condensation typically gives higher HTC than Chun-Seban evaporation
    expect(result.insideFilm.htc).toBeGreaterThan(result.outsideFilm.htc);
  });
});

// ===========================================================================
// getDefaultWallThickness
// ===========================================================================

describe('getDefaultWallThickness', () => {
  it('returns 1.0 mm for Aluminium 5052', () => {
    expect(getDefaultWallThickness('Aluminium 5052')).toBe(1.0);
  });

  it('returns 0.4 mm for Titanium SB 338 Gr 2', () => {
    expect(getDefaultWallThickness('Titanium SB 338 Gr 2')).toBe(0.4);
  });

  it('returns 0.7 mm for Cu-Ni 90/10', () => {
    expect(getDefaultWallThickness('Cu-Ni 90/10')).toBe(0.7);
  });

  it('returns default 1.0 mm for unknown material', () => {
    expect(getDefaultWallThickness('Unknown Alloy')).toBe(1.0);
  });
});

// ===========================================================================
// getQuickSelectConductivity
// ===========================================================================

describe('getQuickSelectConductivity', () => {
  it('returns 138 for Aluminium 5052', () => {
    expect(getQuickSelectConductivity('Aluminium 5052')).toBe(138);
  });

  it('returns 22 for Titanium SB 338 Gr 2', () => {
    expect(getQuickSelectConductivity('Titanium SB 338 Gr 2')).toBe(22);
  });

  it('returns 16 for SS 316L', () => {
    expect(getQuickSelectConductivity('SS 316L')).toBe(16);
  });

  it('returns null for unknown material', () => {
    expect(getQuickSelectConductivity('Unobtanium')).toBeNull();
  });
});
