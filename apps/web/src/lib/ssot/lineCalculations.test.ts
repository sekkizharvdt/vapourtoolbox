/**
 * Line Calculations Tests for SSOT
 *
 * Tests for pipe sizing calculations:
 * - Inner diameter from flow and velocity
 * - Velocity from flow and diameter
 * - Line input enrichment
 */

import {
  calculateInnerDiameter,
  calculateVelocity,
  enrichLineInput,
  DEFAULT_DESIGN_VELOCITY,
} from './lineCalculations';
import type { ProcessLineInput } from '@vapour/types';

// Helper to create a minimal valid ProcessLineInput for testing
function createTestInput(overrides: Partial<ProcessLineInput> = {}): ProcessLineInput {
  return {
    lineNumber: 'TEST-001',
    fluid: 'SEA WATER',
    inputDataTag: 'TEST',
    flowRateKgS: 0,
    density: 1000,
    designVelocity: 1.5,
    selectedID: 0,
    ...overrides,
  };
}

describe('Line Calculations', () => {
  describe('calculateInnerDiameter', () => {
    it('should calculate correct diameter for typical water flow', () => {
      // Water at 100 kg/s, 1000 kg/m³ density, 1.5 m/s velocity
      const flowRateKgS = 100;
      const density = 1000;
      const velocity = 1.5;

      const diameter = calculateInnerDiameter(flowRateKgS, density, velocity);

      // Q = 100/1000 = 0.1 m³/s
      // A = 0.1/1.5 = 0.0667 m²
      // D = sqrt(4 × 0.0667 / π) = 0.291 m = 291 mm
      expect(diameter).toBeCloseTo(291, 0);
    });

    it('should return larger diameter for lower velocity', () => {
      const flowRateKgS = 50;
      const density = 1000;

      const diameterLowVelocity = calculateInnerDiameter(flowRateKgS, density, 1.0);
      const diameterHighVelocity = calculateInnerDiameter(flowRateKgS, density, 2.0);

      expect(diameterLowVelocity).toBeGreaterThan(diameterHighVelocity);
    });

    it('should return larger diameter for higher flow rate', () => {
      const density = 1000;
      const velocity = 1.5;

      const diameterLowFlow = calculateInnerDiameter(10, density, velocity);
      const diameterHighFlow = calculateInnerDiameter(100, density, velocity);

      expect(diameterHighFlow).toBeGreaterThan(diameterLowFlow);
    });

    it('should handle low density fluids (gases)', () => {
      // Air at 10 kg/s, 1.2 kg/m³ density, 20 m/s velocity
      const flowRateKgS = 10;
      const density = 1.2;
      const velocity = 20;

      const diameter = calculateInnerDiameter(flowRateKgS, density, velocity);

      // Q = 10/1.2 = 8.33 m³/s
      // A = 8.33/20 = 0.417 m²
      // D = sqrt(4 × 0.417 / π) = 0.728 m = 728 mm
      expect(diameter).toBeCloseTo(728, 0);
    });

    it('should handle small flow rates', () => {
      // Small flow: 1 kg/s at standard water conditions
      const diameter = calculateInnerDiameter(1, 1000, 1.5);

      // D = sqrt(4 × (1/1000/1.5) / π) = 29.1 mm
      expect(diameter).toBeCloseTo(29.1, 0);
    });

    it('should scale correctly with flow rate squared', () => {
      const density = 1000;
      const velocity = 1.5;

      const d1 = calculateInnerDiameter(1, density, velocity);
      const d4 = calculateInnerDiameter(4, density, velocity);

      // D ∝ √Q, so if Q quadruples, D doubles
      expect(d4 / d1).toBeCloseTo(2, 1);
    });
  });

  describe('calculateVelocity', () => {
    it('should calculate correct velocity for typical conditions', () => {
      // Water at 100 kg/s, 1000 kg/m³ density, 300 mm diameter
      const flowRateKgS = 100;
      const density = 1000;
      const innerDiameterMm = 300;

      const velocity = calculateVelocity(flowRateKgS, density, innerDiameterMm);

      // A = π × (0.3)² / 4 = 0.0707 m²
      // Q = 100/1000 = 0.1 m³/s
      // V = 0.1/0.0707 = 1.41 m/s
      expect(velocity).toBeCloseTo(1.41, 1);
    });

    it('should return higher velocity for smaller diameter', () => {
      const flowRateKgS = 50;
      const density = 1000;

      const velocitySmallPipe = calculateVelocity(flowRateKgS, density, 100);
      const velocityLargePipe = calculateVelocity(flowRateKgS, density, 200);

      expect(velocitySmallPipe).toBeGreaterThan(velocityLargePipe);
    });

    it('should scale with inverse square of diameter', () => {
      const flowRateKgS = 100;
      const density = 1000;

      const v1 = calculateVelocity(flowRateKgS, density, 100);
      const v2 = calculateVelocity(flowRateKgS, density, 200);

      // V ∝ 1/D², so if D doubles, V quarters
      expect(v1 / v2).toBeCloseTo(4, 1);
    });

    it('should be inverse of calculateInnerDiameter', () => {
      const flowRateKgS = 50;
      const density = 1000;
      const targetVelocity = 2.0;

      // Calculate diameter for given velocity
      const diameter = calculateInnerDiameter(flowRateKgS, density, targetVelocity);

      // Calculate velocity back from that diameter
      const actualVelocity = calculateVelocity(flowRateKgS, density, diameter);

      expect(actualVelocity).toBeCloseTo(targetVelocity, 2);
    });
  });

  describe('enrichLineInput', () => {
    it('should calculate both ID and velocity', () => {
      const input = createTestInput({
        flowRateKgS: 10,
        density: 1000,
        designVelocity: 1.5,
        selectedID: 100, // 100 mm
      });

      const result = enrichLineInput(input);

      // Should have calculated ID
      expect(result.calculatedID).toBeCloseTo(92.1, 0);
      // Should have actual velocity (higher than design since selected > calculated)
      expect(result.actualVelocity).toBeDefined();
      expect(result.actualVelocity).toBeLessThan(1.5);
    });

    it('should use default design velocity when not specified', () => {
      const input = createTestInput({
        flowRateKgS: 10,
        density: 1000,
        designVelocity: undefined as unknown as number, // Force undefined
        selectedID: 100,
      });

      const result = enrichLineInput(input);

      expect(result.designVelocity).toBe(DEFAULT_DESIGN_VELOCITY);
      expect(result.calculatedID).toBeDefined();
    });

    it('should skip calculation when flowRateKgS is missing', () => {
      const input = createTestInput({
        flowRateKgS: undefined as unknown as number,
        density: 1000,
        designVelocity: 1.5,
        selectedID: 100,
      });

      const result = enrichLineInput(input);

      expect(result.calculatedID).toBeUndefined();
      expect(result.actualVelocity).toBeUndefined();
    });

    it('should skip calculation when density is missing', () => {
      const input = createTestInput({
        flowRateKgS: 10,
        density: undefined as unknown as number,
        designVelocity: 1.5,
        selectedID: 100,
      });

      const result = enrichLineInput(input);

      expect(result.calculatedID).toBeUndefined();
    });

    it('should skip calculation when density is zero or negative', () => {
      const inputZero = createTestInput({
        flowRateKgS: 10,
        density: 0,
        selectedID: 100,
      });
      const inputNeg = createTestInput({
        flowRateKgS: 10,
        density: -1,
        selectedID: 100,
      });

      expect(enrichLineInput(inputZero).calculatedID).toBeUndefined();
      expect(enrichLineInput(inputNeg).calculatedID).toBeUndefined();
    });

    it('should only calculate ID when selectedID is not provided', () => {
      const input = createTestInput({
        flowRateKgS: 10,
        density: 1000,
        designVelocity: 1.5,
        selectedID: 0, // Zero selectedID should be treated as not provided
      });

      const result = enrichLineInput(input);

      expect(result.calculatedID).toBeDefined();
      expect(result.actualVelocity).toBeUndefined();
    });

    it('should skip ID calculation when flowRateKgS is zero', () => {
      const input = createTestInput({
        flowRateKgS: 0,
        density: 1000,
        designVelocity: 1.5,
        selectedID: 100,
      });

      const result = enrichLineInput(input);

      // calculatedID stays undefined since flow is 0
      expect(result.calculatedID).toBeUndefined();
    });

    it('should preserve other input fields', () => {
      const input = createTestInput({
        flowRateKgS: 10,
        density: 1000,
        designVelocity: 1.5,
        selectedID: 100,
        pipeSize: 'DN100',
        schedule: '40S',
      });

      const result = enrichLineInput(input);

      expect(result.pipeSize).toBe('DN100');
      expect(result.schedule).toBe('40S');
    });
  });

  describe('DEFAULT_DESIGN_VELOCITY', () => {
    it('should be a reasonable value for liquid process lines', () => {
      // Typical liquid velocities are 1-3 m/s
      expect(DEFAULT_DESIGN_VELOCITY).toBeGreaterThanOrEqual(1);
      expect(DEFAULT_DESIGN_VELOCITY).toBeLessThanOrEqual(3);
    });
  });

  describe('Real-world scenarios', () => {
    it('should size seawater feed line correctly', () => {
      // 1000 m³/hr seawater at 1025 kg/m³
      const massFlow = (1000 * 1025) / 3600; // kg/s
      const diameter = calculateInnerDiameter(massFlow, 1025, 2.0);

      // Should be around 400-450 mm
      expect(diameter).toBeGreaterThan(400);
      expect(diameter).toBeLessThan(500);
    });

    it('should size distillate line correctly', () => {
      // 100 m³/hr pure water at 1000 kg/m³
      const massFlow = (100 * 1000) / 3600; // kg/s
      const diameter = calculateInnerDiameter(massFlow, 1000, 1.5);

      // Should be around 150 mm
      expect(diameter).toBeGreaterThan(130);
      expect(diameter).toBeLessThan(170);
    });

    it('should calculate velocity check for selected pipe', () => {
      // Given DN150 (150 mm ID), check if velocity is acceptable
      const massFlow = 30; // kg/s
      const density = 1000;
      const selectedID = 150; // mm

      const velocity = calculateVelocity(massFlow, density, selectedID);

      // Velocity should be around 1.7 m/s (acceptable for liquids)
      expect(velocity).toBeGreaterThan(1.5);
      expect(velocity).toBeLessThan(2.0);
    });
  });
});
