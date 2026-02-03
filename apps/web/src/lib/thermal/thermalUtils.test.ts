/**
 * Thermal Utilities Tests
 */

import {
  GRAVITY,
  ATM_PRESSURE_BAR,
  tonHrToKgS,
  kgSToTonHr,
  tonHrToM3S,
  barToHead,
  headToBar,
  mH2OToBar,
  barToMH2O,
} from './thermalUtils';

describe('Thermal Utilities', () => {
  describe('Constants', () => {
    it('should have correct gravitational acceleration', () => {
      expect(GRAVITY).toBe(9.81);
    });

    it('should have correct atmospheric pressure', () => {
      expect(ATM_PRESSURE_BAR).toBe(1.01325);
    });
  });

  describe('tonHrToKgS', () => {
    it('should convert 1 ton/hr to kg/s', () => {
      // 1 ton/hr = 1000 kg / 3600 s = 0.2778 kg/s
      expect(tonHrToKgS(1)).toBeCloseTo(0.2778, 3);
    });

    it('should convert 36 ton/hr to 10 kg/s', () => {
      expect(tonHrToKgS(36)).toBeCloseTo(10, 10);
    });

    it('should handle zero', () => {
      expect(tonHrToKgS(0)).toBe(0);
    });
  });

  describe('kgSToTonHr', () => {
    it('should convert 1 kg/s to ton/hr', () => {
      // 1 kg/s = 3600 kg/hr = 3.6 ton/hr
      expect(kgSToTonHr(1)).toBeCloseTo(3.6, 10);
    });

    it('should be inverse of tonHrToKgS', () => {
      const original = 42.5;
      expect(kgSToTonHr(tonHrToKgS(original))).toBeCloseTo(original, 10);
    });
  });

  describe('tonHrToM3S', () => {
    it('should convert ton/hr to m³/s for water', () => {
      // 36 ton/hr at 1000 kg/m³ = 10 kg/s / 1000 = 0.01 m³/s
      expect(tonHrToM3S(36, 1000)).toBeCloseTo(0.01, 10);
    });

    it('should account for density differences', () => {
      const flowWater = tonHrToM3S(36, 1000);
      const flowSeawater = tonHrToM3S(36, 1025);
      expect(flowSeawater).toBeLessThan(flowWater);
    });
  });

  describe('barToHead', () => {
    it('should convert 1 bar to head for water', () => {
      // 1 bar = 100000 Pa / (1000 × 9.81) = 10.194 m
      const head = barToHead(1, 1000);
      expect(head).toBeCloseTo(10.194, 2);
    });

    it('should give higher head for lighter fluids', () => {
      const headWater = barToHead(1, 1000);
      const headSeawater = barToHead(1, 1025);
      expect(headWater).toBeGreaterThan(headSeawater);
    });

    it('should scale linearly with pressure', () => {
      const head1 = barToHead(1, 1000);
      const head2 = barToHead(2, 1000);
      expect(head2).toBeCloseTo(head1 * 2, 10);
    });
  });

  describe('headToBar', () => {
    it('should be inverse of barToHead', () => {
      const pressure = 2.5;
      const density = 1025;
      const head = barToHead(pressure, density);
      expect(headToBar(head, density)).toBeCloseTo(pressure, 10);
    });

    it('should convert 10.33m water to approximately 1 atm', () => {
      const bar = headToBar(10.33, 1000);
      expect(bar).toBeCloseTo(1.01325, 1);
    });
  });

  describe('mH2OToBar / barToMH2O (backward compatibility)', () => {
    it('should default to density 1000', () => {
      expect(mH2OToBar(10.194)).toBeCloseTo(1.0, 2);
      expect(barToMH2O(1.0)).toBeCloseTo(10.194, 2);
    });

    it('should accept custom density', () => {
      const head = barToMH2O(1.0, 1025);
      expect(mH2OToBar(head, 1025)).toBeCloseTo(1.0, 10);
    });

    it('should match barToHead/headToBar with default density', () => {
      expect(mH2OToBar(5)).toBeCloseTo(headToBar(5, 1000), 10);
      expect(barToMH2O(1)).toBeCloseTo(barToHead(1, 1000), 10);
    });
  });
});
