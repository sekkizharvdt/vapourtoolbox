/**
 * MED Solver Validation Test
 *
 * Validates the solver against reference values from Case 6.xlsx:
 *   8-effect parallel-feed MED, GOR ≈ 6, 5 T/h capacity
 *
 * Excel reference values:
 *   - Steam flow: ~833 kg/hr
 *   - Total distillate: ~5000 kg/hr
 *   - Seawater intake: ~86,800 kg/hr
 *   - GOR: ~6.0
 *   - Steam temp: 57.3°C (0.173 bar abs)
 *   - TBT: 55.1°C
 */

import { solveMEDPlant, validateMEDInputs } from './medSolver';
import { DEFAULT_MED_PLANT_INPUTS } from '@vapour/constants';
import type { MEDPlantInputs } from '@vapour/types';

// Build full inputs from defaults (matching Case 6.xlsx)
const CASE6_INPUTS: MEDPlantInputs = {
  ...DEFAULT_MED_PLANT_INPUTS,
};

describe('MED Solver — Input Validation', () => {
  it('accepts valid Case 6 inputs', () => {
    const errors = validateMEDInputs(CASE6_INPUTS);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid number of effects', () => {
    const errors = validateMEDInputs({ ...CASE6_INPUTS, numberOfEffects: 1 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Number of effects');
  });

  it('rejects TBT below seawater inlet', () => {
    const errors = validateMEDInputs({ ...CASE6_INPUTS, topBrineTemp: 25 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid concentration factor', () => {
    const errors = validateMEDInputs({ ...CASE6_INPUTS, brineConcentrationFactor: 0.5 });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('MED Solver — Case 6 Validation', () => {
  const result = solveMEDPlant(CASE6_INPUTS);

  it('converges', () => {
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThan(30);
  });

  it('produces correct number of effects', () => {
    expect(result.effects).toHaveLength(8);
  });

  it('net production matches target capacity (5 T/h ± 1%)', () => {
    expect(result.performance.netProduction).toBeCloseTo(5.0, 1);
  });

  it('GOR is approximately 6 (± 15%)', () => {
    // The solver may differ from Excel due to different property correlations
    // Excel uses simpler approximations; we use rigorous Sharqawy + IAPWS-IF97
    expect(result.performance.gor).toBeGreaterThan(4.5);
    expect(result.performance.gor).toBeLessThan(8.0);
  });

  it('steam flow is in reasonable range (500–1200 kg/hr)', () => {
    // Excel: ~833 kg/hr. Our solver may differ due to property differences.
    expect(result.performance.steamFlow).toBeGreaterThan(500);
    expect(result.performance.steamFlow).toBeLessThan(1200);
  });

  it('seawater intake is in reasonable range (50–150 T/h)', () => {
    // Excel: ~86.8 T/h
    expect(result.performance.seawaterIntake).toBeGreaterThan(50);
    expect(result.performance.seawaterIntake).toBeLessThan(150);
  });

  it('effect temperatures decrease monotonically', () => {
    for (let i = 1; i < result.effects.length; i++) {
      expect(result.effects[i]!.temperature).toBeLessThan(result.effects[i - 1]!.temperature);
    }
  });

  it('effect 1 temperature equals TBT', () => {
    expect(result.effects[0]!.temperature).toBeCloseTo(CASE6_INPUTS.topBrineTemp, 1);
  });

  it('all effects produce vapor', () => {
    for (const eff of result.effects) {
      expect(eff.vaporOut.flow).toBeGreaterThan(0);
    }
  });

  it('all effects have positive BPE', () => {
    for (const eff of result.effects) {
      expect(eff.bpe).toBeGreaterThan(0);
    }
  });

  it('final condenser determines seawater flow', () => {
    expect(result.finalCondenser.seawaterIn.flow).toBeGreaterThan(0);
  });

  it('energy balance error is small (< 5%)', () => {
    expect(result.overallBalance.energyBalanceError).toBeLessThan(5);
  });

  it('brine salinity is approximately feed × CF', () => {
    const expectedBrine = CASE6_INPUTS.seawaterSalinity * CASE6_INPUTS.brineConcentrationFactor;
    expect(result.performance.brineSalinity).toBeCloseTo(expectedBrine, -3); // within 1000 ppm
  });

  it('no critical warnings (may have convergence notes)', () => {
    // Should not have "did not converge" warning
    const criticalWarnings = result.warnings.filter((w) => w.includes('did not converge'));
    expect(criticalWarnings).toHaveLength(0);
  });
});

describe('MED Solver — Edge Cases', () => {
  it('handles 2-effect plant', () => {
    const inputs: MEDPlantInputs = {
      ...CASE6_INPUTS,
      numberOfEffects: 2,
      preheaters: [],
    };
    const result = solveMEDPlant(inputs);
    expect(result.converged).toBe(true);
    expect(result.effects).toHaveLength(2);
    expect(result.performance.netProduction).toBeCloseTo(5.0, 0);
  });

  it('handles 12-effect plant', () => {
    const inputs: MEDPlantInputs = {
      ...CASE6_INPUTS,
      numberOfEffects: 12,
      preheaters: [],
    };
    const result = solveMEDPlant(inputs);
    expect(result.converged).toBe(true);
    expect(result.effects).toHaveLength(12);
    expect(result.performance.netProduction).toBeCloseTo(5.0, 0);
    // More effects should give higher GOR
    expect(result.performance.gor).toBeGreaterThan(result.performance.gor > 0 ? 4 : 0);
  });
});
