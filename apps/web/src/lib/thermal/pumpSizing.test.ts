/**
 * Pump Sizing Calculator Tests
 */

import {
  calculateTDH,
  calculateHydraulicPower,
  calculateBrakePower,
  STANDARD_MOTOR_SIZES_KW,
  type PumpSizingInput,
} from './pumpSizing';

describe('Pump Sizing', () => {
  describe('calculateHydraulicPower', () => {
    it('should calculate hydraulic power correctly', () => {
      // Q=0.01 m³/s, ρ=1000 kg/m³, H=50m
      // P = 0.01 × 1000 × 9.81 × 50 / 1000 = 4.905 kW
      const power = calculateHydraulicPower(0.01, 1000, 50);
      expect(power).toBeCloseTo(4.905, 2);
    });

    it('should scale linearly with flow', () => {
      const p1 = calculateHydraulicPower(0.01, 1000, 50);
      const p2 = calculateHydraulicPower(0.02, 1000, 50);
      expect(p2).toBeCloseTo(p1 * 2, 10);
    });

    it('should scale linearly with head', () => {
      const p1 = calculateHydraulicPower(0.01, 1000, 50);
      const p2 = calculateHydraulicPower(0.01, 1000, 100);
      expect(p2).toBeCloseTo(p1 * 2, 10);
    });
  });

  describe('calculateBrakePower', () => {
    it('should divide by pump efficiency', () => {
      const bhp = calculateBrakePower(10, 0.7);
      expect(bhp).toBeCloseTo(14.29, 1);
    });

    it('should equal hydraulic power at 100% efficiency', () => {
      const bhp = calculateBrakePower(10, 1.0);
      expect(bhp).toBe(10);
    });
  });

  describe('STANDARD_MOTOR_SIZES_KW', () => {
    it('should be sorted in ascending order', () => {
      for (let i = 1; i < STANDARD_MOTOR_SIZES_KW.length; i++) {
        expect(STANDARD_MOTOR_SIZES_KW[i]).toBeGreaterThan(STANDARD_MOTOR_SIZES_KW[i - 1]!);
      }
    });

    it('should include common sizes', () => {
      expect(STANDARD_MOTOR_SIZES_KW).toContain(7.5);
      expect(STANDARD_MOTOR_SIZES_KW).toContain(11);
      expect(STANDARD_MOTOR_SIZES_KW).toContain(22);
      expect(STANDARD_MOTOR_SIZES_KW).toContain(55);
      expect(STANDARD_MOTOR_SIZES_KW).toContain(110);
    });
  });

  describe('calculateTDH', () => {
    const baseInput: PumpSizingInput = {
      flowRate: 36, // ton/hr
      fluidDensity: 1000,
      suctionPressureDrop: 0.1, // bar
      dischargePressureDrop: 0.5, // bar
      staticHead: 10, // m
      dischargeVesselPressure: 1.01325, // bar abs (atmospheric)
      suctionVesselPressure: 1.01325, // bar abs (atmospheric)
      pumpEfficiency: 0.7,
      motorEfficiency: 0.95,
    };

    it('should calculate TDH for a basic case', () => {
      const result = calculateTDH(baseInput);

      // Static head: 10m
      // Discharge pressure head: ~10.33m (1 atm)
      // Suction pressure head: ~10.33m (1 atm)
      // Net pressure head: 0m
      // Suction friction: ~1.02m (0.1 bar)
      // Discharge friction: ~5.10m (0.5 bar)
      // Total: 10 + 0 + 1.02 + 5.10 ≈ 16.12m
      expect(result.totalDifferentialHead).toBeCloseTo(16.12, 0);
    });

    it('should increase TDH with higher discharge pressure', () => {
      const result1 = calculateTDH(baseInput);
      const result2 = calculateTDH({
        ...baseInput,
        dischargeVesselPressure: 3.0,
      });
      expect(result2.totalDifferentialHead).toBeGreaterThan(result1.totalDifferentialHead);
    });

    it('should decrease TDH with higher suction pressure', () => {
      const result1 = calculateTDH(baseInput);
      const result2 = calculateTDH({
        ...baseInput,
        suctionVesselPressure: 3.0,
      });
      expect(result2.totalDifferentialHead).toBeLessThan(result1.totalDifferentialHead);
    });

    it('should calculate power correctly', () => {
      const result = calculateTDH(baseInput);

      // Verify hydraulic power = Q × ρ × g × H / 1000
      const flowM3S = (36 * 1000) / (1000 * 3600);
      const expectedHydPower = (flowM3S * 1000 * 9.81 * result.totalDifferentialHead) / 1000;
      expect(result.hydraulicPower).toBeCloseTo(expectedHydPower, 2);

      // Brake power = hydraulic / pump_eff
      expect(result.brakePower).toBeCloseTo(result.hydraulicPower / 0.7, 2);

      // Motor power = brake / motor_eff
      expect(result.motorPower).toBeCloseTo(result.brakePower / 0.95, 2);
    });

    it('should recommend a standard motor size', () => {
      const result = calculateTDH(baseInput);
      expect(result.recommendedMotorKW).toBeGreaterThanOrEqual(result.motorPower);
      expect(STANDARD_MOTOR_SIZES_KW).toContain(result.recommendedMotorKW);
    });

    it('should provide head breakdown', () => {
      const result = calculateTDH(baseInput);
      expect(result.headBreakdown.staticHead).toBe(10);
      expect(result.headBreakdown.dischargeFrictionHead).toBeGreaterThan(0);
      expect(result.headBreakdown.suctionFrictionHead).toBeGreaterThan(0);
    });

    it('should warn on negative TDH', () => {
      const result = calculateTDH({
        ...baseInput,
        staticHead: -20,
        suctionPressureDrop: 0,
        dischargePressureDrop: 0,
      });
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('gravity flow');
    });

    it('should use default efficiencies', () => {
      const result = calculateTDH({
        ...baseInput,
        pumpEfficiency: undefined,
        motorEfficiency: undefined,
      });
      expect(result.pumpEfficiency).toBe(0.7);
      expect(result.motorEfficiency).toBe(0.95);
    });

    it('should throw on invalid pump efficiency', () => {
      expect(() => calculateTDH({ ...baseInput, pumpEfficiency: 0 })).toThrow();
      expect(() => calculateTDH({ ...baseInput, pumpEfficiency: 1.5 })).toThrow();
    });

    it('should handle vacuum suction vessel', () => {
      const result = calculateTDH({
        ...baseInput,
        suctionVesselPressure: 0.1, // 100 mbar vacuum
      });
      // Lower suction pressure → higher TDH
      const baseResult = calculateTDH(baseInput);
      expect(result.totalDifferentialHead).toBeGreaterThan(baseResult.totalDifferentialHead);
    });
  });
});
