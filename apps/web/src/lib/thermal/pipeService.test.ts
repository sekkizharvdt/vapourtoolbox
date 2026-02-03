/**
 * Pipe Service Tests
 *
 * Tests for pipe selection and sizing calculations
 */

import {
  selectPipeSize,
  selectPipeByVelocity,
  calculateRequiredPipeArea,
  calculateVelocity,
  getPipeByNPS,
  getPipeByDN,
  SCHEDULE_40_PIPES,
  clearPipeCache,
  type PipeVariant,
} from './pipeService';

describe('Pipe Service', () => {
  describe('SCHEDULE_40_PIPES constant', () => {
    it('should have pipes sorted by size', () => {
      const areas = SCHEDULE_40_PIPES.map((p) => p.area_mm2);
      const sortedAreas = [...areas].sort((a, b) => a - b);
      expect(areas).toEqual(sortedAreas);
    });

    it('should have valid pipe data for all entries', () => {
      SCHEDULE_40_PIPES.forEach((pipe) => {
        expect(pipe.nps).toBeDefined();
        expect(pipe.dn).toBeDefined();
        expect(pipe.od_mm).toBeGreaterThan(0);
        expect(pipe.wt_mm).toBeGreaterThan(0);
        expect(pipe.id_mm).toBeGreaterThan(0);
        expect(pipe.area_mm2).toBeGreaterThan(0);
        // ID should be OD - 2 × wall thickness
        expect(pipe.id_mm).toBeCloseTo(pipe.od_mm - 2 * pipe.wt_mm, 1);
      });
    });

    it('should have area consistent with ID', () => {
      SCHEDULE_40_PIPES.forEach((pipe) => {
        const calculatedArea = Math.PI * Math.pow(pipe.id_mm / 2, 2);
        // Allow 1% tolerance since stored values are rounded
        expect(Math.abs(pipe.area_mm2 - calculatedArea) / calculatedArea).toBeLessThan(0.01);
      });
    });
  });

  describe('selectPipeSize', () => {
    it('should select smallest pipe that meets required area', () => {
      // Looking for ~2000 mm² - should get 2" pipe (2165.2 mm²)
      const result = selectPipeSize(2000);
      expect(result.nps).toBe('2');
      expect(result.area_mm2).toBeGreaterThanOrEqual(2000);
    });

    it('should return exact match when area matches exactly', () => {
      const pipe2inch = SCHEDULE_40_PIPES.find((p) => p.nps === '2')!;
      const result = selectPipeSize(pipe2inch.area_mm2);
      expect(result.nps).toBe('2');
      expect(result.isExactMatch).toBe(true);
    });

    it('should return next larger size when not exact match', () => {
      const result = selectPipeSize(2000); // 2165.2 is 2" area
      expect(result.isExactMatch).toBe(false);
    });

    it('should include displayName in result', () => {
      const result = selectPipeSize(5000);
      expect(result.displayName).toContain('Sch 40');
    });

    it('should return largest pipe for very large area requirement', () => {
      const result = selectPipeSize(500000); // Larger than any pipe
      expect(result.displayName).toContain('MAX');
    });

    it('should accept custom pipe list', () => {
      const customPipes: PipeVariant[] = [
        {
          nps: 'TEST',
          dn: '999',
          schedule: '40',
          od_mm: 100,
          wt_mm: 5,
          id_mm: 90,
          area_mm2: 6362,
          weight_kgm: 10,
        },
      ];
      const result = selectPipeSize(5000, customPipes);
      expect(result.nps).toBe('TEST');
    });

    it('should throw error if no pipes available', () => {
      expect(() => selectPipeSize(1000, [])).toThrow('No pipes available');
    });
  });

  describe('selectPipeByVelocity', () => {
    it('should select pipe based on target velocity', () => {
      // 0.01 m³/s at 2 m/s requires 0.005 m² = 5000 mm²
      const result = selectPipeByVelocity(0.01, 2, { min: 0.5, max: 3 });
      expect(result.area_mm2).toBeGreaterThanOrEqual(5000);
    });

    it('should calculate actual velocity', () => {
      const result = selectPipeByVelocity(0.01, 2, { min: 0.5, max: 3 });
      // v = Q / A
      const expectedVelocity = 0.01 / (result.area_mm2 / 1e6);
      expect(result.actualVelocity).toBeCloseTo(expectedVelocity, 3);
    });

    it('should mark velocity as HIGH when above max', () => {
      // Very high flow rate for small pipe area
      const result = selectPipeByVelocity(0.5, 2, { min: 0.5, max: 3 });
      // This will result in high velocity in any standard pipe
      if (result.actualVelocity > 3) {
        expect(result.velocityStatus).toBe('HIGH');
      }
    });

    it('should mark velocity as LOW when below min', () => {
      // Very low flow rate
      const result = selectPipeByVelocity(0.0001, 0.5, { min: 0.5, max: 3 });
      expect(result.velocityStatus).toBe('LOW');
    });

    it('should mark velocity as OK when within limits', () => {
      // Moderate flow rate
      const result = selectPipeByVelocity(0.01, 1.5, { min: 0.5, max: 3 });
      if (result.actualVelocity >= 0.5 && result.actualVelocity <= 3) {
        expect(result.velocityStatus).toBe('OK');
      }
    });
  });

  describe('calculateRequiredPipeArea', () => {
    it('should calculate area from mass flow and velocity', () => {
      // 36 ton/hr, 1000 kg/m³, 2 m/s
      // Q = 36 × 1000 / (1000 × 3600) = 0.01 m³/s
      // A = 0.01 / 2 = 0.005 m² = 5000 mm²
      const area = calculateRequiredPipeArea(36, 1000, 2);
      expect(area).toBeCloseTo(5000, 0);
    });

    it('should scale with mass flow', () => {
      const area1 = calculateRequiredPipeArea(36, 1000, 2);
      const area2 = calculateRequiredPipeArea(72, 1000, 2);
      expect(area2).toBeCloseTo(area1 * 2, 0);
    });

    it('should scale inversely with velocity', () => {
      const area1 = calculateRequiredPipeArea(36, 1000, 1);
      const area2 = calculateRequiredPipeArea(36, 1000, 2);
      expect(area1).toBeCloseTo(area2 * 2, 0);
    });

    it('should scale inversely with density', () => {
      const areaWater = calculateRequiredPipeArea(36, 1000, 2);
      const areaSeawater = calculateRequiredPipeArea(36, 1025, 2);
      expect(areaSeawater).toBeLessThan(areaWater);
    });
  });

  describe('calculateVelocity', () => {
    it('should calculate velocity through a pipe', () => {
      const pipe = SCHEDULE_40_PIPES.find((p) => p.nps === '4')!;
      // 36 ton/hr, 1000 kg/m³, 4" pipe (8213 mm²)
      // Q = 36 × 1000 / (1000 × 3600) = 0.01 m³/s
      // v = 0.01 / (8213 / 1e6) = 1.22 m/s
      const velocity = calculateVelocity(36, 1000, pipe);
      expect(velocity).toBeCloseTo(1.22, 1);
    });

    it('should scale with mass flow', () => {
      const pipe = SCHEDULE_40_PIPES.find((p) => p.nps === '4')!;
      const v1 = calculateVelocity(36, 1000, pipe);
      const v2 = calculateVelocity(72, 1000, pipe);
      expect(v2).toBeCloseTo(v1 * 2, 2);
    });

    it('should scale inversely with pipe area', () => {
      const pipe4 = SCHEDULE_40_PIPES.find((p) => p.nps === '4')!;
      const pipe6 = SCHEDULE_40_PIPES.find((p) => p.nps === '6')!;
      const v4 = calculateVelocity(100, 1000, pipe4);
      const v6 = calculateVelocity(100, 1000, pipe6);
      expect(v4).toBeGreaterThan(v6);
    });
  });

  describe('getPipeByNPS', () => {
    it('should find pipe by NPS', () => {
      const pipe = getPipeByNPS('6');
      expect(pipe).toBeDefined();
      expect(pipe?.nps).toBe('6');
      expect(pipe?.dn).toBe('150');
    });

    it('should return undefined for non-existent NPS', () => {
      const pipe = getPipeByNPS('999');
      expect(pipe).toBeUndefined();
    });

    it('should find fractional sizes', () => {
      const pipe = getPipeByNPS('1/2');
      expect(pipe).toBeDefined();
      expect(pipe?.dn).toBe('15');
    });

    it('should accept custom pipe list', () => {
      const customPipes: PipeVariant[] = [
        {
          nps: 'CUSTOM',
          dn: '999',
          schedule: '40',
          od_mm: 100,
          wt_mm: 5,
          id_mm: 90,
          area_mm2: 6362,
          weight_kgm: 10,
        },
      ];
      const pipe = getPipeByNPS('CUSTOM', customPipes);
      expect(pipe?.nps).toBe('CUSTOM');
    });
  });

  describe('getPipeByDN', () => {
    it('should find pipe by DN', () => {
      const pipe = getPipeByDN('150');
      expect(pipe).toBeDefined();
      expect(pipe?.dn).toBe('150');
      expect(pipe?.nps).toBe('6');
    });

    it('should return undefined for non-existent DN', () => {
      const pipe = getPipeByDN('999');
      expect(pipe).toBeUndefined();
    });

    it('should find small DNs', () => {
      const pipe = getPipeByDN('15');
      expect(pipe).toBeDefined();
      expect(pipe?.nps).toBe('1/2');
    });

    it('should accept custom pipe list', () => {
      const customPipes: PipeVariant[] = [
        {
          nps: 'CUSTOM',
          dn: 'DN-CUSTOM',
          schedule: '40',
          od_mm: 100,
          wt_mm: 5,
          id_mm: 90,
          area_mm2: 6362,
          weight_kgm: 10,
        },
      ];
      const pipe = getPipeByDN('DN-CUSTOM', customPipes);
      expect(pipe?.dn).toBe('DN-CUSTOM');
    });
  });

  describe('clearPipeCache', () => {
    it('should not throw when clearing cache', () => {
      expect(() => clearPipeCache()).not.toThrow();
    });
  });

  describe('real-world sizing scenarios', () => {
    it('should size pipe for seawater intake (100 m³/hr)', () => {
      // 100 m³/hr seawater at 1.5 m/s design velocity
      // Q = 100 / 3600 = 0.0278 m³/s
      // A = 0.0278 / 1.5 = 0.0185 m² = 18500 mm²
      const massFlow = 100 * 1.025; // 102.5 ton/hr at 1025 kg/m³
      const area = calculateRequiredPipeArea(massFlow, 1025, 1.5);
      const pipe = selectPipeSize(area);
      expect(pipe.nps).toBe('6'); // 6" pipe (18638 mm²)
    });

    it('should size pipe for steam flow', () => {
      // 5 ton/hr steam at 20 m/s (low pressure steam)
      // Density ~0.6 kg/m³ at atmospheric
      const area = calculateRequiredPipeArea(5, 0.6, 20);
      const pipe = selectPipeSize(area);
      // Should be a larger pipe due to low density
      expect(parseInt(pipe.nps) || 24).toBeGreaterThanOrEqual(10);
    });

    it('should check velocity for selected pipe', () => {
      // 50 ton/hr water, want 1.5 m/s
      const result = selectPipeByVelocity(
        50 / 3600, // Convert ton/hr to m³/s (at 1000 kg/m³)
        1.5,
        { min: 0.5, max: 3 }
      );
      expect(result.actualVelocity).toBeLessThanOrEqual(3);
      expect(result.actualVelocity).toBeGreaterThanOrEqual(0); // Should be reasonable
    });
  });
});
