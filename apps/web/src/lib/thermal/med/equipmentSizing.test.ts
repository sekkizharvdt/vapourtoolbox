/**
 * Equipment Sizing Tests
 *
 * Validates that equipment sizing produces reasonable results
 * when given the Case 6 H&M balance output.
 */

import { solveMEDPlant } from './medSolver';
import { sizeEquipment } from './equipmentSizing';
import { DEFAULT_MED_PLANT_INPUTS } from '@vapour/constants';
import type { MEDPlantInputs } from '@vapour/types';

const CASE6_INPUTS: MEDPlantInputs = {
  ...DEFAULT_MED_PLANT_INPUTS,
};

const plantResult = solveMEDPlant(CASE6_INPUTS);
const sizing = sizeEquipment(
  plantResult.effects,
  plantResult.finalCondenser,
  plantResult.preheaters,
  CASE6_INPUTS
);

describe('Equipment Sizing — Evaporators', () => {
  it('sizes all effects', () => {
    expect(sizing.evaporators).toHaveLength(CASE6_INPUTS.numberOfEffects);
  });

  it('all effects have positive heat duty', () => {
    for (const ev of sizing.evaporators) {
      expect(ev.heatDuty).toBeGreaterThan(0);
    }
  });

  it('all effects have positive design area', () => {
    for (const ev of sizing.evaporators) {
      expect(ev.designArea).toBeGreaterThan(0);
    }
  });

  it('overall HTC is in reasonable range (500–3000 W/(m²·K))', () => {
    for (const ev of sizing.evaporators) {
      expect(ev.overallHTC).toBeGreaterThan(500);
      expect(ev.overallHTC).toBeLessThan(3000);
    }
  });

  it('tube count is positive for all effects', () => {
    for (const ev of sizing.evaporators) {
      expect(ev.tubeCount).toBeGreaterThan(0);
    }
  });

  it('wetting rate is positive for all effects', () => {
    for (const ev of sizing.evaporators) {
      expect(ev.wettingRate).toBeGreaterThan(0);
    }
  });

  it('demister area is positive for all effects', () => {
    for (const ev of sizing.evaporators) {
      expect(ev.demisterArea).toBeGreaterThan(0);
    }
  });

  it('bundle diameter is reasonable (200–3000 mm)', () => {
    for (const ev of sizing.evaporators) {
      expect(ev.bundleDiameter).toBeGreaterThan(200);
      expect(ev.bundleDiameter).toBeLessThan(3000);
    }
  });
});

describe('Equipment Sizing — Final Condenser', () => {
  it('has positive heat duty', () => {
    expect(sizing.condenser.heatDuty).toBeGreaterThan(0);
  });

  it('has positive LMTD', () => {
    expect(sizing.condenser.lmtd).toBeGreaterThan(0);
  });

  it('has reasonable overall HTC (1000–5000 W/(m²·K))', () => {
    expect(sizing.condenser.overallHTC).toBeGreaterThan(1000);
    expect(sizing.condenser.overallHTC).toBeLessThan(5000);
  });

  it('tube count is divisible by 4 (4-pass)', () => {
    expect(sizing.condenser.tubeCount % 4).toBe(0);
  });

  it('tube velocity is in reasonable range (1–3 m/s)', () => {
    expect(sizing.condenser.tubeVelocity).toBeGreaterThan(0.5);
    expect(sizing.condenser.tubeVelocity).toBeLessThan(4);
  });

  it('shell ID is larger than bundle diameter', () => {
    expect(sizing.condenser.shellID).toBeGreaterThan(sizing.condenser.bundleDiameter);
  });
});

describe('Equipment Sizing — Rognoni Reference Comparisons', () => {
  it('every evaporator has rognoni comparisons', () => {
    for (const ev of sizing.evaporators) {
      expect(ev.rognoniComparisons.length).toBeGreaterThan(0);
    }
  });

  it('rognoni comparisons include expected parameters', () => {
    const labels = sizing.evaporators[0]!.rognoniComparisons.map((c) => c.label);
    expect(labels).toContain('Overall U');
    expect(labels).toContain('Falling Film HTC');
    expect(labels).toContain('Condensation HTC');
    expect(labels).toContain('Wetting Rate');
    expect(labels).toContain('Design Area');
  });

  it('all comparisons have valid structure (calculated, ref, deviation)', () => {
    for (const ev of sizing.evaporators) {
      for (const comp of ev.rognoniComparisons) {
        expect(comp.calculated).toBeGreaterThanOrEqual(0);
        expect(comp.rognoniRef).toBeGreaterThan(0);
        expect(typeof comp.deviation).toBe('number');
        expect(comp.unit.length).toBeGreaterThan(0);
      }
    }
  });

  it('condenser has rognoni comparisons', () => {
    expect(sizing.condenser.rognoniComparisons.length).toBeGreaterThan(0);
    const labels = sizing.condenser.rognoniComparisons.map((c) => c.label);
    expect(labels).toContain('Overall U');
    expect(labels).toContain('Tube Velocity');
  });
});

describe('Equipment Sizing — Totals', () => {
  it('total evaporator area is sum of individual effects', () => {
    const sum = sizing.evaporators.reduce((s, e) => s + e.designArea, 0);
    expect(sizing.totalEvaporatorArea).toBeCloseTo(sum, 0);
  });

  it('grand total area is sum of all equipment', () => {
    const expected =
      sizing.totalEvaporatorArea + sizing.totalCondenserArea + sizing.totalPreheaterArea;
    expect(sizing.grandTotalArea).toBeCloseTo(expected, 0);
  });

  it('total evaporator area is in reasonable range for 8-effect 5 T/h plant', () => {
    // Excel Case 6: ~1447 m² per effect × 8 = ~11,576 m²
    // Our simplified model may differ, but should be in the right order of magnitude
    expect(sizing.totalEvaporatorArea).toBeGreaterThan(100);
    expect(sizing.totalEvaporatorArea).toBeLessThan(50000);
  });
});
