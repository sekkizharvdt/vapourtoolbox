/**
 * Gas Mixture Property Tests
 *
 * The checks that matter here are the ones an engineer can verify by hand or
 * against a published figure, because the failure mode of this module is a
 * plausible number rather than a crash.
 */

import {
  GAS_COMPONENTS,
  calculateGasMixtureProperties,
  componentCpMolar,
  componentViscosity,
  resolveBiogasComposition,
  wilkeViscosityMixture,
  wassiljewaConductivityMixture,
  type GasComponent,
} from './gasMixture';

/** A typical digester gas, dry basis: 60% CH₄, 39.8% CO₂, 2000 ppmv H₂S */
const TYPICAL_BIOGAS = {
  methaneMolPercent: 60,
  carbonDioxideMolPercent: 39.8,
  hydrogenSulphide: 2000,
  hydrogenSulphideUnit: 'PPMV' as const,
  basis: 'DRY' as const,
};

describe('gas mixture properties', () => {
  describe('molar mass', () => {
    it('should match a hand-calculated weighted sum', () => {
      // 0.60 × 16.043 + 0.40 × 44.01 = 9.626 + 17.604 = 27.23 g/mol
      const props = calculateGasMixtureProperties({
        moleFractions: { CH4: 0.6, CO2: 0.4 },
        temperatureC: 25,
        pressureMbar: 1013.25,
      });
      expect(props.molarMassGmol).toBeCloseTo(27.23, 2);
    });

    it('should sit between the pure component values', () => {
      const props = calculateGasMixtureProperties({
        moleFractions: { CH4: 0.6, CO2: 0.4 },
        temperatureC: 25,
        pressureMbar: 1013.25,
      });
      expect(props.molarMassGmol).toBeGreaterThan(GAS_COMPONENTS.CH4.molarMassGmol);
      expect(props.molarMassGmol).toBeLessThan(GAS_COMPONENTS.CO2.molarMassGmol);
    });
  });

  describe('density', () => {
    it('should be near 1.15 kg/m³ for 60/40 biogas at ambient', () => {
      // ρ = PM/RT = 101325 × 0.02723 / (8.314 × 298.15) = 1.113 kg/m³
      const props = calculateGasMixtureProperties({
        moleFractions: { CH4: 0.6, CO2: 0.4 },
        temperatureC: 25,
        pressureMbar: 1013.25,
      });
      expect(props.density).toBeCloseTo(1.113, 2);
    });

    it('should be roughly three orders of magnitude below water', () => {
      // The specific failure this guards: a gas stream stored at 1000 kg/m³.
      const props = calculateGasMixtureProperties({
        moleFractions: { CH4: 0.6, CO2: 0.4 },
        temperatureC: 38,
        pressureMbar: 1050,
      });
      expect(props.density).toBeGreaterThan(0.5);
      expect(props.density).toBeLessThan(2);
    });

    it('should follow the ideal gas law in pressure and temperature', () => {
      const base = calculateGasMixtureProperties({
        moleFractions: { CH4: 1 },
        temperatureC: 25,
        pressureMbar: 1000,
      });
      const doubled = calculateGasMixtureProperties({
        moleFractions: { CH4: 1 },
        temperatureC: 25,
        pressureMbar: 2000,
      });
      expect(doubled.density / base.density).toBeCloseTo(2, 6);
    });
  });

  describe('heat capacity and isentropic exponent', () => {
    it('should give methane a k near 1.31', () => {
      const props = calculateGasMixtureProperties({
        moleFractions: { CH4: 1 },
        temperatureC: 25,
        pressureMbar: 1013.25,
      });
      // Published k for methane at 25 °C is 1.304
      expect(props.isentropicExponent).toBeCloseTo(1.3, 1);
    });

    it('should give carbon dioxide a k near 1.29', () => {
      const props = calculateGasMixtureProperties({
        moleFractions: { CO2: 1 },
        temperatureC: 25,
        pressureMbar: 1013.25,
      });
      // Published k for CO₂ at 25 °C is 1.289
      expect(props.isentropicExponent).toBeCloseTo(1.29, 1);
    });

    it('should keep Cv below Cp by exactly R', () => {
      const props = calculateGasMixtureProperties({
        moleFractions: { CH4: 0.6, CO2: 0.4 },
        temperatureC: 25,
        pressureMbar: 1013.25,
      });
      const molarMassKg = props.molarMassGmol / 1000;
      const diffMolar =
        (props.specificHeat - props.specificHeatConstantVolume) * molarMassKg * 1000;
      expect(diffMolar).toBeCloseTo(8.314, 3);
    });
  });

  describe('viscosity and conductivity mixing', () => {
    it('should return the pure value for a single component', () => {
      const mu = wilkeViscosityMixture({ CH4: 1 }, 25);
      expect(mu).toBeCloseTo(GAS_COMPONENTS.CH4.viscosity25C, 12);

      const lam = wassiljewaConductivityMixture({ CO2: 1 }, 25);
      expect(lam).toBeCloseTo(GAS_COMPONENTS.CO2.conductivity25C, 12);
    });

    it('should ignore components present at zero', () => {
      const withZero = wilkeViscosityMixture({ CH4: 1, CO2: 0, H2S: 0 }, 25);
      const without = wilkeViscosityMixture({ CH4: 1 }, 25);
      expect(withZero).toBeCloseTo(without, 12);
    });

    it('should land between the pure component viscosities', () => {
      const mu = wilkeViscosityMixture({ CH4: 0.6, CO2: 0.4 }, 25);
      expect(mu).toBeGreaterThan(GAS_COMPONENTS.CH4.viscosity25C);
      expect(mu).toBeLessThan(GAS_COMPONENTS.CO2.viscosity25C);
    });

    it('should not be a simple mole-weighted average — that is the point of Wilke', () => {
      const mu = wilkeViscosityMixture({ CH4: 0.6, CO2: 0.4 }, 25);
      const naive = 0.6 * GAS_COMPONENTS.CH4.viscosity25C + 0.4 * GAS_COMPONENTS.CO2.viscosity25C;
      expect(Math.abs(mu - naive)).toBeGreaterThan(1e-8);
    });

    it('should rise with temperature, unlike a liquid', () => {
      expect(componentViscosity('CH4', 60)).toBeGreaterThan(componentViscosity('CH4', 20));
    });
  });

  describe('heating value', () => {
    it('should give pure methane about 50 MJ/kg', () => {
      const props = calculateGasMixtureProperties({
        moleFractions: { CH4: 1 },
        temperatureC: 25,
        pressureMbar: 1013.25,
      });
      // 802.3 kJ/mol ÷ 16.043 g/mol = 50.0 MJ/kg
      expect(props.lowerHeatingValueMJkg).toBeCloseTo(50.0, 1);
    });

    it('should give 60% biogas about 21–22 MJ/Nm³', () => {
      // Published figure for 60% methane biogas is ~21.5 MJ/Nm³
      const props = calculateGasMixtureProperties({
        moleFractions: { CH4: 0.6, CO2: 0.4 },
        temperatureC: 25,
        pressureMbar: 1013.25,
      });
      expect(props.lowerHeatingValueMJNm3).toBeGreaterThan(20);
      expect(props.lowerHeatingValueMJNm3).toBeLessThan(23);
    });

    it('should treat carbon dioxide as inert', () => {
      const props = calculateGasMixtureProperties({
        moleFractions: { CO2: 1 },
        temperatureC: 25,
        pressureMbar: 1013.25,
      });
      expect(props.lowerHeatingValueMJkg).toBe(0);
    });
  });

  describe('H₂S partial pressure', () => {
    it('should convert 2000 ppmv at atmospheric to about 2 mbar', () => {
      const props = calculateGasMixtureProperties({
        moleFractions: { CH4: 0.6, CO2: 0.398, H2S: 0.002 },
        temperatureC: 25,
        pressureMbar: 1000,
      });
      expect(props.h2sPartialPressureMbar).toBeCloseTo(2, 6);
    });
  });
});

describe('resolveBiogasComposition', () => {
  it('should convert ppmv to a mole fraction', () => {
    const r = resolveBiogasComposition(TYPICAL_BIOGAS, 38, 1050);
    // 2000 ppmv = 0.2 mol% of the dry gas
    expect(r.enteredDryTotalPercent).toBeCloseTo(100, 6);
    expect(r.wasNormalised).toBe(false);
  });

  it('should normalise an analysis that does not sum to 100 and say so', () => {
    // A real analysis reporting 2.5% N₂, which this register does not carry
    const r = resolveBiogasComposition(
      { ...TYPICAL_BIOGAS, methaneMolPercent: 58, carbonDioxideMolPercent: 39.3 },
      38,
      1050
    );
    expect(r.wasNormalised).toBe(true);
    expect(r.enteredDryTotalPercent).toBeCloseTo(97.5, 6);
    expect(r.warnings.join(' ')).toMatch(/normalised/i);

    const sum = (Object.values(r.moleFractions) as number[]).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
  });

  it('should add saturation water to a dry analysis', () => {
    const dryOnly = resolveBiogasComposition(
      { ...TYPICAL_BIOGAS, saturatedAtStreamTemperature: false },
      38,
      1050
    );
    const saturated = resolveBiogasComposition(
      { ...TYPICAL_BIOGAS, saturatedAtStreamTemperature: true },
      38,
      1050
    );

    expect(dryOnly.waterMolPercent).toBe(0);
    // Saturation pressure at 38 °C is ~66 mbar; against 1050 mbar that is ~6.3%
    expect(saturated.waterMolPercent).toBeGreaterThan(5);
    expect(saturated.waterMolPercent).toBeLessThan(8);

    const sum = (Object.values(saturated.moleFractions) as number[]).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
  });

  it('should make the wet gas lighter than the dry gas', () => {
    // Water at 18 g/mol displaces a mixture near 27, so molar mass falls. This
    // is the 2–3% that goes straight into the density and then the line size.
    const dryOnly = resolveBiogasComposition(
      { ...TYPICAL_BIOGAS, saturatedAtStreamTemperature: false },
      38,
      1050
    );
    const saturated = resolveBiogasComposition(
      { ...TYPICAL_BIOGAS, saturatedAtStreamTemperature: true },
      38,
      1050
    );

    const dryProps = calculateGasMixtureProperties({
      moleFractions: dryOnly.moleFractions,
      temperatureC: 38,
      pressureMbar: 1050,
    });
    const wetProps = calculateGasMixtureProperties({
      moleFractions: saturated.moleFractions,
      temperatureC: 38,
      pressureMbar: 1050,
    });

    expect(wetProps.molarMassGmol).toBeLessThan(dryProps.molarMassGmol);
    const shift = (dryProps.molarMassGmol - wetProps.molarMassGmol) / dryProps.molarMassGmol;
    expect(shift).toBeGreaterThan(0.015);
    expect(shift).toBeLessThan(0.035);
  });

  it('should not add water to an analysis already reported wet', () => {
    const r = resolveBiogasComposition(
      { ...TYPICAL_BIOGAS, basis: 'WET', saturatedAtStreamTemperature: true },
      38,
      1050
    );
    expect(r.waterMolPercent).toBe(0);
  });

  it('should accept H₂S entered as a percentage', () => {
    const ppm = resolveBiogasComposition(TYPICAL_BIOGAS, 38, 1050);
    const pct = resolveBiogasComposition(
      { ...TYPICAL_BIOGAS, hydrogenSulphide: 0.2, hydrogenSulphideUnit: 'MOL_PERCENT' },
      38,
      1050
    );
    // 2000 ppmv and 0.2 mol% are the same gas — the unit is the trap, since
    // reading one as the other is a factor of 10,000.
    expect(pct.moleFractions.H2S).toBeCloseTo(ppm.moleFractions.H2S, 9);
  });

  it('should refuse a stream below its saturation temperature', () => {
    // 60 °C saturates at ~199 mbar; at 150 mbar the gas cannot exist as a gas
    expect(() =>
      resolveBiogasComposition({ ...TYPICAL_BIOGAS, saturatedAtStreamTemperature: true }, 60, 150)
    ).toThrow(/saturation pressure/i);
  });

  it('should refuse an empty composition rather than divide by zero', () => {
    expect(() =>
      resolveBiogasComposition(
        {
          methaneMolPercent: 0,
          carbonDioxideMolPercent: 0,
          hydrogenSulphide: 0,
          hydrogenSulphideUnit: 'PPMV',
          basis: 'DRY',
        },
        38,
        1050
      )
    ).toThrow(/empty/i);
  });
});

describe('component data sanity', () => {
  it('should have a plausible Cp for every component', () => {
    for (const key of Object.keys(GAS_COMPONENTS) as GasComponent[]) {
      const cp = componentCpMolar(key, 25);
      // Every polyatomic gas here sits well above the monatomic 5/2 R = 20.8
      expect(cp).toBeGreaterThan(25);
      expect(cp).toBeLessThan(60);
    }
  });

  it('should keep Cp rising with temperature', () => {
    for (const key of Object.keys(GAS_COMPONENTS) as GasComponent[]) {
      expect(componentCpMolar(key, 80)).toBeGreaterThan(componentCpMolar(key, 20));
    }
  });
});
