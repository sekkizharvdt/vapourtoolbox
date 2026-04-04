import { getViscosityLiquid, getThermalConductivityLiquid } from '@vapour/constants';

describe('Pure water transport properties', () => {
  describe('getViscosityLiquid', () => {
    // NIST reference values for saturated liquid water
    it('20°C ≈ 1.002e-3 Pa·s', () => {
      expect(getViscosityLiquid(20)).toBeCloseTo(1.002e-3, 4);
    });
    it('40°C ≈ 6.53e-4 Pa·s', () => {
      expect(getViscosityLiquid(40)).toBeCloseTo(6.53e-4, 4);
    });
    it('60°C ≈ 4.66e-4 Pa·s', () => {
      expect(getViscosityLiquid(60)).toBeCloseTo(4.66e-4, 4);
    });
    it('80°C ≈ 3.55e-4 Pa·s', () => {
      expect(getViscosityLiquid(80)).toBeCloseTo(3.55e-4, 4);
    });
    it('throws for out-of-range', () => {
      expect(() => getViscosityLiquid(-5)).toThrow();
      expect(() => getViscosityLiquid(200)).toThrow();
    });
  });

  describe('getThermalConductivityLiquid', () => {
    // NIST reference values
    it('20°C ≈ 0.598 W/(m·K)', () => {
      expect(getThermalConductivityLiquid(20)).toBeCloseTo(0.598, 2);
    });
    it('40°C ≈ 0.631 W/(m·K)', () => {
      expect(getThermalConductivityLiquid(40)).toBeCloseTo(0.631, 2);
    });
    it('60°C ≈ 0.651 W/(m·K)', () => {
      expect(getThermalConductivityLiquid(60)).toBeCloseTo(0.651, 2);
    });
    it('80°C ≈ 0.663 W/(m·K)', () => {
      expect(getThermalConductivityLiquid(80)).toBeCloseTo(0.663, 2);
    });
    it('throws for out-of-range', () => {
      expect(() => getThermalConductivityLiquid(-5)).toThrow();
      expect(() => getThermalConductivityLiquid(200)).toThrow();
    });
  });
});
