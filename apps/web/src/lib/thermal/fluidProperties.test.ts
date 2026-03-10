/**
 * Fluid Property Resolver — Unit Tests
 *
 * Validates property values against published reference data:
 * - Pure water at 25°C and 60°C (NIST/engineering handbooks)
 * - Seawater at 35000 ppm, 25°C (Sharqawy 2010)
 * - Saturation properties (steam tables cross-check)
 */

import {
  getFluidProperties,
  getSaturationProperties,
  getSteamTableLiquidDensity,
} from './fluidProperties';

describe('getFluidProperties', () => {
  describe('pure water at 25°C', () => {
    const props = getFluidProperties('PURE_WATER', 25);

    it('density ≈ 997 kg/m³', () => {
      expect(props.density).toBeCloseTo(997, 0);
    });

    it('specific heat ≈ 4.18 kJ/(kg·K)', () => {
      expect(props.specificHeat).toBeCloseTo(4.18, 1);
    });

    it('viscosity ≈ 0.00089 Pa·s', () => {
      expect(props.viscosity).toBeCloseTo(0.00089, 4);
    });

    it('thermal conductivity ≈ 0.607 W/(m·K)', () => {
      expect(props.thermalConductivity).toBeCloseTo(0.607, 1);
    });
  });

  describe('pure water at 60°C', () => {
    const props = getFluidProperties('PURE_WATER', 60);

    it('density ≈ 983 kg/m³', () => {
      expect(props.density).toBeCloseTo(983, 0);
    });

    it('viscosity ≈ 0.00047 Pa·s', () => {
      expect(props.viscosity).toBeCloseTo(0.00047, 4);
    });

    it('thermal conductivity ≈ 0.65 W/(m·K)', () => {
      expect(props.thermalConductivity).toBeCloseTo(0.65, 1);
    });
  });

  describe('condensate at 40°C', () => {
    const props = getFluidProperties('CONDENSATE', 40);

    it('returns same values as PURE_WATER at same temperature', () => {
      const pureWater = getFluidProperties('PURE_WATER', 40);
      expect(props.density).toBe(pureWater.density);
      expect(props.specificHeat).toBe(pureWater.specificHeat);
      expect(props.viscosity).toBe(pureWater.viscosity);
      expect(props.thermalConductivity).toBe(pureWater.thermalConductivity);
    });
  });

  describe('seawater at 35000 ppm, 25°C', () => {
    const props = getFluidProperties('SEAWATER', 25, 35000);

    it('density ≈ 1023 kg/m³', () => {
      expect(props.density).toBeCloseTo(1023, 0);
    });

    it('specific heat ≈ 3.99 kJ/(kg·K) (lower than pure water)', () => {
      expect(props.specificHeat).toBeCloseTo(3.99, 1);
    });

    it('viscosity > pure water viscosity', () => {
      const pureWater = getFluidProperties('PURE_WATER', 25);
      expect(props.viscosity).toBeGreaterThan(pureWater.viscosity);
    });

    it('all properties are positive and finite', () => {
      expect(props.density).toBeGreaterThan(0);
      expect(props.specificHeat).toBeGreaterThan(0);
      expect(props.viscosity).toBeGreaterThan(0);
      expect(props.thermalConductivity).toBeGreaterThan(0);
      expect(isFinite(props.density)).toBe(true);
      expect(isFinite(props.specificHeat)).toBe(true);
      expect(isFinite(props.viscosity)).toBe(true);
      expect(isFinite(props.thermalConductivity)).toBe(true);
    });
  });

  describe('SEAWATER ignores default salinity=0 when salinity provided', () => {
    it('SEAWATER at 0 ppm matches PURE_WATER', () => {
      const sw0 = getFluidProperties('SEAWATER', 30, 0);
      const pw = getFluidProperties('PURE_WATER', 30);
      expect(sw0.density).toBe(pw.density);
      expect(sw0.specificHeat).toBe(pw.specificHeat);
    });
  });

  describe('temperature range coverage', () => {
    it('works at 5°C (cold seawater intake)', () => {
      const props = getFluidProperties('SEAWATER', 5, 35000);
      expect(props.density).toBeGreaterThan(1020);
      expect(props.viscosity).toBeGreaterThan(0.001); // Cold water is more viscous
    });

    it('works at 90°C (hot brine)', () => {
      const props = getFluidProperties('SEAWATER', 90, 70000);
      expect(props.density).toBeGreaterThan(0);
      expect(props.viscosity).toBeGreaterThan(0);
    });
  });
});

describe('getSaturationProperties', () => {
  describe('at 60°C (typical MED effect)', () => {
    const sat = getSaturationProperties(60);

    it('liquid density ≈ 983 kg/m³', () => {
      expect(sat.density).toBeCloseTo(983, 0);
    });

    it('latent heat ≈ 2358 kJ/kg', () => {
      expect(sat.latentHeat).toBeCloseTo(2358, -1);
    });

    it('vapor density is small (< 1 kg/m³)', () => {
      expect(sat.vaporDensity).toBeGreaterThan(0);
      expect(sat.vaporDensity).toBeLessThan(1);
    });

    it('includes liquid-phase transport properties', () => {
      expect(sat.viscosity).toBeGreaterThan(0);
      expect(sat.thermalConductivity).toBeGreaterThan(0);
      expect(sat.specificHeat).toBeGreaterThan(0);
    });
  });

  describe('at 100°C (atmospheric)', () => {
    const sat = getSaturationProperties(100);

    it('latent heat ≈ 2257 kJ/kg', () => {
      expect(sat.latentHeat).toBeCloseTo(2257, -1);
    });

    it('vapor density ≈ 0.6 kg/m³', () => {
      expect(sat.vaporDensity).toBeCloseTo(0.6, 0);
    });
  });
});

describe('getSteamTableLiquidDensity', () => {
  it('at 25°C ≈ 997 kg/m³ (cross-check with Sharqawy at S=0)', () => {
    const steamTableDensity = getSteamTableLiquidDensity(25);
    const sharqawyDensity = getFluidProperties('PURE_WATER', 25).density;
    // Both should be close (different correlations, same physical quantity)
    expect(Math.abs(steamTableDensity - sharqawyDensity)).toBeLessThan(3);
  });
});
