/**
 * Thermal Expansion Calculator Tests
 *
 * Verifies free-expansion ΔL and restrained thermal-stress calculations for
 * the four supported engineering materials.
 */

import {
  calculateThermalExpansion,
  type ThermalExpansionInput,
} from './thermalExpansionCalculator';

function baseInput(overrides: Partial<ThermalExpansionInput> = {}): ThermalExpansionInput {
  return {
    materialKey: 'carbon_steel',
    length: 1000, // 1 m
    installationTemperature: 20,
    operatingTemperature: 100,
    constraintMode: 'free',
    ...overrides,
  };
}

describe('Thermal Expansion Calculator', () => {
  describe('input validation', () => {
    it('rejects non-positive length', () => {
      expect(() => calculateThermalExpansion(baseInput({ length: 0 }))).toThrow(/length/i);
      expect(() => calculateThermalExpansion(baseInput({ length: -1 }))).toThrow(/length/i);
    });

    it('rejects non-finite temperatures', () => {
      expect(() => calculateThermalExpansion(baseInput({ installationTemperature: NaN }))).toThrow(
        /installation/i
      );
      expect(() =>
        calculateThermalExpansion(baseInput({ operatingTemperature: Infinity }))
      ).toThrow(/operating/i);
    });

    it('rejects unknown material', () => {
      expect(() => calculateThermalExpansion(baseInput({ materialKey: 'unobtanium' }))).toThrow(
        /Unknown material/i
      );
    });
  });

  describe('free expansion — carbon steel', () => {
    // CS: α_mean(100) = 11.7 × 10⁻⁶ /°C from 20 °C → δ/L = 11.7e-6 × 80 = 9.36e-4
    // ΔL on 1000 mm = 0.936 mm
    it('matches ASM tabulated mean α at 100 °C', () => {
      const r = calculateThermalExpansion(baseInput());
      expect(r.materialLabel).toBe('Carbon Steel');
      expect(r.deltaT).toBe(80);
      expect(r.alphaMeanInstallation).toBeCloseTo(11.0, 5); // T=20 row
      expect(r.alphaMeanOperating).toBeCloseTo(11.7, 5); // T=100 row
      expect(r.deltaL).toBeCloseTo(0.936, 3);
      expect(r.thermalStrain_mmPerM).toBeCloseTo(0.936, 3);
      expect(r.thermalStrainPct).toBeCloseTo(0.0936, 4);
    });

    it('produces negative ΔL when cooling below installation T', () => {
      const r = calculateThermalExpansion(
        baseInput({ installationTemperature: 100, operatingTemperature: 20 })
      );
      expect(r.deltaT).toBe(-80);
      expect(r.deltaL).toBeLessThan(0);
      expect(r.deltaL).toBeCloseTo(-0.936, 3);
    });

    it('returns zero ΔL when T_install = T_op (uses α at that temperature)', () => {
      const r = calculateThermalExpansion(
        baseInput({ installationTemperature: 100, operatingTemperature: 100 })
      );
      expect(r.deltaT).toBe(0);
      expect(r.deltaL).toBeCloseTo(0, 9);
      // α_eff should fall back to α at that temperature, not blow up.
      expect(r.alphaEffective).toBeCloseTo(11.7, 5);
    });
  });

  describe('free expansion — other materials', () => {
    it('stainless 304 expands ~50% more than carbon steel', () => {
      const cs = calculateThermalExpansion(baseInput());
      const ss = calculateThermalExpansion(baseInput({ materialKey: 'stainless_304' }));
      // 17.2 / 11.7 ≈ 1.47
      expect(ss.deltaL / cs.deltaL).toBeGreaterThan(1.4);
      expect(ss.deltaL / cs.deltaL).toBeLessThan(1.55);
    });

    it('aluminium 5052 — α_mean(100) ≈ 23.8 × 10⁻⁶ /°C', () => {
      const r = calculateThermalExpansion(baseInput({ materialKey: 'aluminium_5052' }));
      expect(r.alphaMeanOperating).toBeCloseTo(23.8, 5);
      // δ/L = 23.8e-6 × 80 = 1.904e-3 → ΔL = 1.904 mm
      expect(r.deltaL).toBeCloseTo(1.904, 3);
    });

    it('titanium Gr 2 — lowest α of the four materials', () => {
      const r = calculateThermalExpansion(baseInput({ materialKey: 'titanium_sb338_gr2' }));
      expect(r.alphaMeanOperating).toBeCloseTo(8.8, 5);
      expect(r.deltaL).toBeCloseTo(0.704, 3); // 8.8e-6 × 80 × 1000
    });

    it('SS 316 — α_mean(100) ≈ 16.5 × 10⁻⁶ /°C (slightly less than 304)', () => {
      const r316 = calculateThermalExpansion(baseInput({ materialKey: 'stainless_316' }));
      const r304 = calculateThermalExpansion(baseInput({ materialKey: 'stainless_304' }));
      expect(r316.alphaMeanOperating).toBeCloseTo(16.5, 5);
      // δ/L = 16.5e-6 × 80 = 1.320e-3 → ΔL = 1.320 mm
      expect(r316.deltaL).toBeCloseTo(1.32, 3);
      // 316 expands slightly less than 304 at 100 °C (16.5 vs 17.2)
      expect(r316.deltaL).toBeLessThan(r304.deltaL);
    });

    it('Duplex 2205 — α_mean(100) ≈ 13.5 × 10⁻⁶ /°C (between CS and austenitic SS)', () => {
      const cs = calculateThermalExpansion(baseInput());
      const dx = calculateThermalExpansion(baseInput({ materialKey: 'duplex_2205' }));
      const ss = calculateThermalExpansion(baseInput({ materialKey: 'stainless_304' }));
      expect(dx.alphaMeanOperating).toBeCloseTo(13.5, 5);
      // δ/L = 13.5e-6 × 80 = 1.080e-3 → ΔL = 1.080 mm
      expect(dx.deltaL).toBeCloseTo(1.08, 3);
      // Duplex sits between carbon steel and 304 in expansion
      expect(dx.deltaL).toBeGreaterThan(cs.deltaL);
      expect(dx.deltaL).toBeLessThan(ss.deltaL);
    });

    it('Duplex 2205 — warns above 300 °C operating limit', () => {
      const r = calculateThermalExpansion(
        baseInput({ materialKey: 'duplex_2205', operatingTemperature: 400 })
      );
      expect(r.warnings.some((w) => /outside the tabulated range/.test(w))).toBe(true);
    });
  });

  describe('temperature-dependent α', () => {
    // When T_install ≠ 20 °C, α_eff must differ from a naive α_mean(T_op).
    it('α_eff differs from α_mean(T_op) when T_install ≠ 20 °C', () => {
      // CS from 100 °C to 300 °C
      // δ/L (20→300) = 12.6e-6 × 280 = 3.528e-3
      // δ/L (20→100) = 11.7e-6 × 80  = 0.936e-3
      // ΔL/L₀ = 2.592e-3 over ΔT = 200 → α_eff = 12.96 × 10⁻⁶
      const r = calculateThermalExpansion(
        baseInput({ installationTemperature: 100, operatingTemperature: 300 })
      );
      expect(r.alphaMeanOperating).toBeCloseTo(12.6, 5);
      expect(r.alphaEffective).toBeCloseTo(12.96, 2);
      expect(r.deltaL).toBeCloseTo(2.592, 3);
    });

    it('warns when temperature is outside tabulated range', () => {
      // Al 5052 range is 20–300 °C
      const r = calculateThermalExpansion(
        baseInput({ materialKey: 'aluminium_5052', operatingTemperature: 400 })
      );
      expect(r.warnings.some((w) => /outside the tabulated range/.test(w))).toBe(true);
    });
  });

  describe('restrained thermal stress', () => {
    // σ = E × α_eff × ΔT
    // CS at 100 °C: E ≈ 203 GPa, α_eff(20→100) = 11.7e-6, ΔT = 80
    //   σ = 203 000 MPa × 11.7e-6 × 80 = 190 MPa
    it('carbon steel 20 → 100 °C restrained ≈ 190 MPa', () => {
      const r = calculateThermalExpansion(baseInput({ constraintMode: 'restrained' }));
      expect(r.EOperating).toBeCloseTo(203, 1);
      expect(r.thermalStress).toBeCloseTo(190, 0);
    });

    it('stress is independent of length', () => {
      const short = calculateThermalExpansion(
        baseInput({ length: 100, constraintMode: 'restrained' })
      );
      const long = calculateThermalExpansion(
        baseInput({ length: 10000, constraintMode: 'restrained' })
      );
      expect(short.thermalStress).toBeCloseTo(long.thermalStress, 6);
    });

    it('flags yield exceedance — SS 304 20 → 400 °C', () => {
      // SS 304: E(400) ≈ 167 GPa, α_eff ≈ 18.7e-6, ΔT = 380
      //   σ ≈ 167 000 × 18.7e-6 × 380 ≈ 1187 MPa  ≫ yield (~120 MPa)
      const r = calculateThermalExpansion(
        baseInput({
          materialKey: 'stainless_304',
          operatingTemperature: 400,
          constraintMode: 'restrained',
        })
      );
      expect(r.thermalStress).toBeGreaterThan(1000);
      expect(r.yieldStrength).not.toBeNull();
      expect(r.yieldUtilisation).not.toBeNull();
      expect(r.yieldUtilisation!).toBeGreaterThan(1);
      expect(r.warnings.some((w) => /exceeds yield/i.test(w))).toBe(true);
    });

    it('reports both ΔL and stress even in free mode', () => {
      const r = calculateThermalExpansion(baseInput({ constraintMode: 'free' }));
      // Free mode still computes the "would-be" stress so designers can
      // decide whether to add an expansion joint.
      expect(r.deltaL).toBeGreaterThan(0);
      expect(r.thermalStress).toBeGreaterThan(0);
    });
  });

  describe('cooling — sign convention', () => {
    it('produces a negative stress (tensile) when cooling a restrained member', () => {
      const r = calculateThermalExpansion(
        baseInput({
          installationTemperature: 200,
          operatingTemperature: 20,
          constraintMode: 'restrained',
        })
      );
      expect(r.deltaT).toBe(-180);
      expect(r.thermalStress).toBeLessThan(0); // tensile on cooling
    });
  });
});
