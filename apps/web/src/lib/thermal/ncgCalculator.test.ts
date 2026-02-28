/**
 * NCG Properties Calculator Tests
 *
 * Tests for:
 *   - dissolvedGasContent  — Weiss (1970) dissolved gas correlations
 *   - calculateNCGProperties — mixture thermophysical properties
 *     • Composition & partial pressures (Dalton's law)
 *     • Density & specific volume (ideal gas)
 *     • Enthalpy (mass-weighted)
 *     • Specific heats & heat capacity ratio
 *     • Transport properties (Wilke / Wassiljewa mixing rules)
 *     • Flow breakdown for all three input modes
 *     • Error handling
 */

import { dissolvedGasContent, calculateNCGProperties } from './ncgCalculator';

// ── Mock @vapour/constants ────────────────────────────────────────────────────
//
// IAPWS-IF97 reference values used for the mock:
//   getSaturationPressure(40)  = 0.073844 bar
//   getSaturationPressure(60)  = 0.199209 bar
//   getSaturationPressure(100) = 1.01418  bar
//   getEnthalpyVapor(40)       = 2574.4   kJ/kg
//   getEnthalpyVapor(60)       = 2609.7   kJ/kg
//   getEnthalpyVapor(100)      = 2675.6   kJ/kg

jest.mock('@vapour/constants', () => ({
  getSaturationPressure: jest.fn((tempC: number) => {
    // Antoine-like fit: accurate enough for unit tests
    if (tempC <= 40) return 0.073844;
    if (tempC <= 60) return 0.199209;
    if (tempC <= 100) return 1.01418;
    return 1.01418;
  }),
  getEnthalpyVapor: jest.fn((tempC: number) => {
    if (tempC <= 40) return 2574.4;
    if (tempC <= 60) return 2609.7;
    if (tempC <= 100) return 2675.6;
    return 2675.6;
  }),
}));

// ── Physical constants for manual verification ────────────────────────────────

const M_AIR = 28.97; // g/mol
const M_H2O = 18.015; // g/mol
const R_UNIV = 8.314; // J/(mol·K)

// ── dissolvedGasContent ───────────────────────────────────────────────────────

describe('dissolvedGasContent', () => {
  it('returns positive O₂ and N₂ concentrations at 25 °C, 35 g/kg', () => {
    const result = dissolvedGasContent(25, 35);
    expect(result.o2MlL).toBeGreaterThan(0);
    expect(result.n2MlL).toBeGreaterThan(0);
    expect(result.o2MgL).toBeGreaterThan(0);
    expect(result.n2MgL).toBeGreaterThan(0);
  });

  it('O₂ at 25 °C, 35 g/kg is close to Weiss (1970) reference (~5.0 mL/L)', () => {
    const result = dissolvedGasContent(25, 35);
    expect(result.o2MlL).toBeGreaterThan(4.5);
    expect(result.o2MlL).toBeLessThan(5.5);
  });

  it('N₂ at 25 °C, 35 g/kg is close to Weiss (1970) reference (~8.8 mL/L)', () => {
    const result = dissolvedGasContent(25, 35);
    expect(result.n2MlL).toBeGreaterThan(8.0);
    expect(result.n2MlL).toBeLessThan(10.0);
  });

  it('dissolved gas decreases as temperature increases', () => {
    const low = dissolvedGasContent(10, 35);
    const high = dissolvedGasContent(30, 35);
    expect(low.o2MlL).toBeGreaterThan(high.o2MlL);
    expect(low.n2MlL).toBeGreaterThan(high.n2MlL);
  });

  it('dissolved gas decreases as salinity increases (salting-out effect)', () => {
    const fresh = dissolvedGasContent(25, 0);
    const saline = dissolvedGasContent(25, 35);
    expect(fresh.o2MlL).toBeGreaterThan(saline.o2MlL);
    expect(fresh.n2MlL).toBeGreaterThan(saline.n2MlL);
  });

  it('converts mL/L to mg/L correctly using STP density', () => {
    const result = dissolvedGasContent(25, 35);
    // O₂: 1 mL(STP) = 32/22.414 mg = 1.4276 mg
    expect(result.o2MgL).toBeCloseTo(result.o2MlL * (32 / 22.414), 3);
    // N₂: 1 mL(STP) = 28.014/22.414 mg = 1.2499 mg
    expect(result.n2MgL).toBeCloseTo(result.n2MlL * (28.014 / 22.414), 3);
  });

  it('totalGasMgL equals o2MgL + n2MgL', () => {
    const result = dissolvedGasContent(25, 35);
    expect(result.totalGasMgL).toBeCloseTo(result.o2MgL + result.n2MgL, 6);
  });

  it('extrapolated = false when T is within Weiss valid range (0–36 °C)', () => {
    expect(dissolvedGasContent(20, 35).extrapolated).toBe(false);
    expect(dissolvedGasContent(0, 35).extrapolated).toBe(false);
    expect(dissolvedGasContent(36, 35).extrapolated).toBe(false);
  });

  it('extrapolated = true when T is outside Weiss valid range', () => {
    expect(dissolvedGasContent(40, 35).extrapolated).toBe(true);
    expect(dissolvedGasContent(-1, 35).extrapolated).toBe(true);
  });

  it('uses the provided salinity in the returned info', () => {
    const result = dissolvedGasContent(20, 42);
    expect(result.salinityGkg).toBe(42);
  });
});

// ── calculateNCGProperties — helper ──────────────────────────────────────────

/**
 * Shared base: T = 40 °C, P_sat = 0.073844 bar, NCG PP = 0.075 bar
 * P_total = 0.073844 + 0.075 = 0.148844 bar
 */
const BASE_T = 40;
const P_SAT = 0.073844; // mocked value at 40 °C
const NCG_PP = 0.075; // bar
const P_TOTAL = P_SAT + NCG_PP;

function baseResult() {
  return calculateNCGProperties({
    mode: 'dry_ncg',
    temperatureC: BASE_T,
    pressureBar: NCG_PP,
    useSatPressure: true,
    dryNcgFlowKgH: 10,
  });
}

// ── Partial pressures & composition ──────────────────────────────────────────

describe('calculateNCGProperties — partial pressures', () => {
  it('sets total pressure to P_sat + NCG_PP when useSatPressure = true', () => {
    const r = baseResult();
    expect(r.totalPressureBar).toBeCloseTo(P_TOTAL, 5);
  });

  it('sets total pressure to the entered value when useSatPressure = false', () => {
    const r = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: BASE_T,
      pressureBar: 0.15,
      useSatPressure: false,
    });
    expect(r.totalPressureBar).toBeCloseTo(0.15, 5);
  });

  it('water vapour partial pressure equals P_sat when P_total > P_sat', () => {
    const r = baseResult();
    expect(r.waterVapourPartialPressureBar).toBeCloseTo(P_SAT, 5);
  });

  it('NCG partial pressure equals P_total - P_sat', () => {
    const r = baseResult();
    expect(r.ncgPartialPressureBar).toBeCloseTo(NCG_PP, 5);
  });

  it("mole fractions are derived from Dalton's law", () => {
    const r = baseResult();
    const yW_expected = P_SAT / P_TOTAL;
    const yNCG_expected = NCG_PP / P_TOTAL;
    expect(r.waterVapourMoleFrac).toBeCloseTo(yW_expected, 5);
    expect(r.ncgMoleFrac).toBeCloseTo(yNCG_expected, 5);
  });

  it('mole fractions sum to 1', () => {
    const r = baseResult();
    expect(r.waterVapourMoleFrac + r.ncgMoleFrac).toBeCloseTo(1.0, 6);
  });

  it('mass fractions sum to 1', () => {
    const r = baseResult();
    expect(r.waterVapourMassFrac + r.ncgMassFrac).toBeCloseTo(1.0, 6);
  });

  it('mixture molar mass is between M_H2O and M_AIR', () => {
    const r = baseResult();
    expect(r.mixMolarMass).toBeGreaterThan(M_H2O);
    expect(r.mixMolarMass).toBeLessThan(M_AIR);
  });

  it('mixture molar mass matches manual calculation', () => {
    const r = baseResult();
    const yW = P_SAT / P_TOTAL;
    const yNCG = NCG_PP / P_TOTAL;
    const M_expected = yW * M_H2O + yNCG * M_AIR;
    expect(r.mixMolarMass).toBeCloseTo(M_expected, 4);
  });
});

// ── Density & specific volume ─────────────────────────────────────────────────

describe('calculateNCGProperties — density & specific volume', () => {
  it('density × specificVolume = 1 (reciprocal relationship)', () => {
    const r = baseResult();
    expect(r.density * r.specificVolume).toBeCloseTo(1.0, 6);
  });

  it('density matches ideal gas law: ρ = PM/(RT)', () => {
    const r = baseResult();
    const TK = BASE_T + 273.15;
    const M_mix = r.mixMolarMass * 1e-3; // kg/mol
    const P_Pa = P_TOTAL * 1e5; // Pa
    const rho_expected = (P_Pa * M_mix) / (R_UNIV * TK);
    expect(r.density).toBeCloseTo(rho_expected, 3);
  });

  it('density is lower than air at same pressure (water vapour dilutes molar mass)', () => {
    // Pure air at 40 °C, 0.15 bar: ρ = P*M/(RT)
    const TK = BASE_T + 273.15;
    const rho_air = (P_TOTAL * 1e5 * M_AIR * 1e-3) / (R_UNIV * TK);
    const r = baseResult();
    expect(r.density).toBeLessThan(rho_air);
  });

  it('density increases with higher total pressure', () => {
    const low = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: 40,
      pressureBar: 0.05,
      useSatPressure: true,
    });
    const high = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: 40,
      pressureBar: 0.2,
      useSatPressure: true,
    });
    expect(high.density).toBeGreaterThan(low.density);
  });
});

// ── Enthalpy ──────────────────────────────────────────────────────────────────

describe('calculateNCGProperties — enthalpy', () => {
  it('vapour enthalpy comes from the mocked IAPWS function', () => {
    const r = baseResult();
    expect(r.vaporEnthalpy).toBeCloseTo(2574.4, 1); // mocked value at 40 °C
  });

  it('air enthalpy = Cp_air × T_C', () => {
    const r = baseResult();
    expect(r.airEnthalpy).toBeCloseTo(1.005 * BASE_T, 3);
  });

  it('mixture enthalpy is mass-weighted average of vapour and air enthalpies', () => {
    const r = baseResult();
    const h_expected = r.waterVapourMassFrac * r.vaporEnthalpy + r.ncgMassFrac * r.airEnthalpy;
    expect(r.specificEnthalpy).toBeCloseTo(h_expected, 4);
  });

  it('mixture enthalpy is between air and vapour enthalpies', () => {
    const r = baseResult();
    const h_min = Math.min(r.vaporEnthalpy, r.airEnthalpy);
    const h_max = Math.max(r.vaporEnthalpy, r.airEnthalpy);
    expect(r.specificEnthalpy).toBeGreaterThan(h_min);
    expect(r.specificEnthalpy).toBeLessThan(h_max);
  });
});

// ── Specific heats ─────────────────────────────────────────────────────────────

describe('calculateNCGProperties — specific heats', () => {
  it('Cp_mix is between Cp_air (1.005) and Cp_vapor (1.872)', () => {
    const r = baseResult();
    expect(r.cpMix).toBeGreaterThan(1.005);
    expect(r.cpMix).toBeLessThan(1.872);
  });

  it('Cv_mix < Cp_mix (Cp > Cv for all ideal gases)', () => {
    const r = baseResult();
    expect(r.cvMix).toBeLessThan(r.cpMix);
  });

  it('gammaMix = cpMix / cvMix', () => {
    const r = baseResult();
    expect(r.gammaMix).toBeCloseTo(r.cpMix / r.cvMix, 6);
  });

  it('gamma is between 1.33 (steam) and 1.40 (diatomic air)', () => {
    const r = baseResult();
    expect(r.gammaMix).toBeGreaterThan(1.33);
    expect(r.gammaMix).toBeLessThan(1.41);
  });

  it('Cp_mix approaches Cp_air when NCG fraction dominates', () => {
    // Very high NCG partial pressure → most of mixture is air
    const r = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: BASE_T,
      pressureBar: 5.0, // much greater than P_sat → y_NCG ≈ 1
      useSatPressure: true,
    });
    expect(r.cpMix).toBeCloseTo(1.005, 1);
  });
});

// ── Transport properties ──────────────────────────────────────────────────────

describe('calculateNCGProperties — transport properties', () => {
  it('dynamic viscosity is in the expected range for gas mixtures at 40 °C (10–20 μPa·s)', () => {
    const r = baseResult();
    const mu_uPas = r.dynamicViscosityPas * 1e6;
    expect(mu_uPas).toBeGreaterThan(10);
    expect(mu_uPas).toBeLessThan(20);
  });

  it('thermal conductivity is in the expected range at 40 °C (20–35 mW/(m·K))', () => {
    const r = baseResult();
    const lam_mW = r.thermalConductivityWmK * 1000;
    expect(lam_mW).toBeGreaterThan(20);
    expect(lam_mW).toBeLessThan(35);
  });

  it('Prandtl number is in the expected range for gas mixtures (0.6–0.9)', () => {
    const r = baseResult();
    const Pr = (r.cpMix * 1000 * r.dynamicViscosityPas) / r.thermalConductivityWmK;
    expect(Pr).toBeGreaterThan(0.6);
    expect(Pr).toBeLessThan(0.9);
  });

  it('viscosity increases with temperature (gas behaviour)', () => {
    // Both temperatures use the same mocked P_sat (≤40 °C → 0.073844 bar), so
    // the mixture composition stays constant and only the transport correlations vary.
    const low = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: 20,
      pressureBar: NCG_PP,
      useSatPressure: true,
    });
    const high = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: 35,
      pressureBar: NCG_PP,
      useSatPressure: true,
    });
    expect(high.dynamicViscosityPas).toBeGreaterThan(low.dynamicViscosityPas);
  });
});

// ── Flow breakdown — dry NCG mode ─────────────────────────────────────────────

describe('calculateNCGProperties — dry NCG flow mode', () => {
  const DRY_FLOW = 10; // kg/h

  it('reports the entered dry NCG flow', () => {
    const r = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      dryNcgFlowKgH: DRY_FLOW,
    });
    expect(r.dryNcgFlowKgH).toBeCloseTo(DRY_FLOW, 6);
  });

  it('water vapour flow is proportional to xWater/xNCG', () => {
    const r = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      dryNcgFlowKgH: DRY_FLOW,
    });
    const expected = DRY_FLOW * (r.waterVapourMassFrac / r.ncgMassFrac);
    expect(r.waterVapourFlowKgH).toBeCloseTo(expected, 4);
  });

  it('total flow = dry NCG + water vapour', () => {
    const r = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      dryNcgFlowKgH: DRY_FLOW,
    });
    expect(r.totalFlowKgH).toBeCloseTo((r.dryNcgFlowKgH ?? 0) + (r.waterVapourFlowKgH ?? 0), 4);
  });

  it('volumetric flow = total mass flow × specific volume', () => {
    const r = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      dryNcgFlowKgH: DRY_FLOW,
    });
    expect(r.volumetricFlowM3h).toBeCloseTo((r.totalFlowKgH ?? 0) * r.specificVolume, 4);
  });

  it('flow fields are null when no flow rate is provided', () => {
    const r = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      // no dryNcgFlowKgH
    });
    expect(r.dryNcgFlowKgH).toBeNull();
    expect(r.waterVapourFlowKgH).toBeNull();
    expect(r.totalFlowKgH).toBeNull();
    expect(r.volumetricFlowM3h).toBeNull();
  });
});

// ── Flow breakdown — wet NCG mode ─────────────────────────────────────────────

describe('calculateNCGProperties — wet NCG flow mode', () => {
  const WET_FLOW = 50; // kg/h

  it('dry NCG + water vapour = total wet flow', () => {
    const r = calculateNCGProperties({
      mode: 'wet_ncg',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      wetNcgFlowKgH: WET_FLOW,
    });
    const sum = (r.dryNcgFlowKgH ?? 0) + (r.waterVapourFlowKgH ?? 0);
    expect(sum).toBeCloseTo(WET_FLOW, 4);
  });

  it('splits according to mass fractions', () => {
    const r = calculateNCGProperties({
      mode: 'wet_ncg',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      wetNcgFlowKgH: WET_FLOW,
    });
    expect(r.dryNcgFlowKgH).toBeCloseTo(WET_FLOW * r.ncgMassFrac, 4);
    expect(r.waterVapourFlowKgH).toBeCloseTo(WET_FLOW * r.waterVapourMassFrac, 4);
  });

  it('dry + wet results are consistent when both modes use the same flow', () => {
    // Dry NCG mode with 5 kg/h dry should give the same mixture props as
    // wet NCG mode with the equivalent total flow.
    const dryFlow = 5;
    const rDry = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      dryNcgFlowKgH: dryFlow,
    });

    // Use the total from dry mode as wet input
    const wetTotal = rDry.totalFlowKgH!;
    const rWet = calculateNCGProperties({
      mode: 'wet_ncg',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      wetNcgFlowKgH: wetTotal,
    });

    expect(rWet.dryNcgFlowKgH).toBeCloseTo(dryFlow, 3);
    expect(rWet.totalFlowKgH).toBeCloseTo(wetTotal, 4);
  });
});

// ── Flow breakdown — seawater mode ───────────────────────────────────────────

describe('calculateNCGProperties — seawater flow mode', () => {
  it('populates seawaterInfo', () => {
    const r = calculateNCGProperties({
      mode: 'seawater',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      seawaterFlowM3h: 1000,
      seawaterTempC: 25,
      salinityGkg: 35,
    });
    expect(r.seawaterInfo).toBeDefined();
    expect(r.seawaterInfo?.gasTempC).toBe(25);
    expect(r.seawaterInfo?.salinityGkg).toBe(35);
  });

  it('dry NCG flow scales linearly with seawater flow', () => {
    const small = calculateNCGProperties({
      mode: 'seawater',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      seawaterFlowM3h: 500,
      seawaterTempC: 25,
      salinityGkg: 35,
    });
    const large = calculateNCGProperties({
      mode: 'seawater',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      seawaterFlowM3h: 1000,
      seawaterTempC: 25,
      salinityGkg: 35,
    });
    expect(large.dryNcgFlowKgH).toBeCloseTo((small.dryNcgFlowKgH ?? 0) * 2, 4);
  });

  it('NCG dry mass flow matches manual calculation (Q × totalGasMgL × 1e-3)', () => {
    const Q = 1000; // m³/h
    const r = calculateNCGProperties({
      mode: 'seawater',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      seawaterFlowM3h: Q,
      seawaterTempC: 25,
      salinityGkg: 35,
    });
    const expected = r.seawaterInfo!.totalGasMgL * Q * 1e-3;
    expect(r.dryNcgFlowKgH).toBeCloseTo(expected, 6);
  });

  it('seawater info is absent in dry NCG mode', () => {
    const r = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      dryNcgFlowKgH: 10,
    });
    expect(r.seawaterInfo).toBeUndefined();
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('calculateNCGProperties — error handling', () => {
  it('throws when temperature is below 0 °C', () => {
    expect(() =>
      calculateNCGProperties({
        mode: 'dry_ncg',
        temperatureC: -5,
        pressureBar: 0.1,
        useSatPressure: false,
      })
    ).toThrow(/temperature/i);
  });

  it('throws when temperature exceeds 350 °C', () => {
    expect(() =>
      calculateNCGProperties({
        mode: 'dry_ncg',
        temperatureC: 400,
        pressureBar: 10,
        useSatPressure: false,
      })
    ).toThrow(/temperature/i);
  });

  it('throws when pressure is zero or negative', () => {
    expect(() =>
      calculateNCGProperties({
        mode: 'dry_ncg',
        temperatureC: 40,
        pressureBar: 0,
        useSatPressure: false,
      })
    ).toThrow(/pressure/i);
  });

  it('throws when total pressure is below P_sat (useSatPressure = false)', () => {
    // At 40 °C, P_sat = 0.073844 bar — setting total to 0.05 bar is invalid
    expect(() =>
      calculateNCGProperties({
        mode: 'dry_ncg',
        temperatureC: 40,
        pressureBar: 0.05,
        useSatPressure: false,
      })
    ).toThrow();
  });

  it('does NOT throw when useSatPressure = true with any positive NCG PP', () => {
    // useSatPressure adds NCG PP on top of P_sat, so total > P_sat always
    expect(() =>
      calculateNCGProperties({
        mode: 'dry_ncg',
        temperatureC: 40,
        pressureBar: 0.001,
        useSatPressure: true,
      })
    ).not.toThrow();
  });
});

// ── Flow breakdown — split flows mode ─────────────────────────────────────────

describe('calculateNCGProperties — split flows mode', () => {
  // At 40 °C, P_sat = 0.073844 bar (mocked).
  // With 10 kg/h dry NCG and 80 kg/h water vapour:
  //   n_NCG = 10/28.97, n_H2O = 80/18.015
  //   y_H2O = n_H2O / (n_NCG + n_H2O)
  //   P_total = P_sat / y_H2O
  const M_NCG = 10;
  const M_VAP = 80;
  const nNCG = M_NCG / M_AIR;
  const nH2O = M_VAP / M_H2O;
  const yH2O_expected = nH2O / (nNCG + nH2O);
  const P_TOTAL_DERIVED = P_SAT / yH2O_expected;

  function splitResult() {
    return calculateNCGProperties({
      mode: 'split_flows',
      temperatureC: BASE_T,
      dryNcgFlowKgH: M_NCG,
      vapourFlowKgH: M_VAP,
    });
  }

  it('derives total pressure from flow rates via Dalton\u2019s law', () => {
    const r = splitResult();
    expect(r.totalPressureBar).toBeCloseTo(P_TOTAL_DERIVED, 5);
  });

  it('water vapour partial pressure equals P_sat', () => {
    const r = splitResult();
    expect(r.waterVapourPartialPressureBar).toBeCloseTo(P_SAT, 5);
  });

  it('NCG partial pressure = P_total - P_sat', () => {
    const r = splitResult();
    expect(r.ncgPartialPressureBar).toBeCloseTo(P_TOTAL_DERIVED - P_SAT, 5);
  });

  it('mole fractions match the ratio of molar flows', () => {
    const r = splitResult();
    expect(r.waterVapourMoleFrac).toBeCloseTo(yH2O_expected, 5);
    expect(r.ncgMoleFrac).toBeCloseTo(1 - yH2O_expected, 5);
  });

  it('flow fields echo the input values', () => {
    const r = splitResult();
    expect(r.dryNcgFlowKgH).toBeCloseTo(M_NCG, 6);
    expect(r.waterVapourFlowKgH).toBeCloseTo(M_VAP, 6);
    expect(r.totalFlowKgH).toBeCloseTo(M_NCG + M_VAP, 6);
  });

  it('volumetric flow = total mass flow × specific volume', () => {
    const r = splitResult();
    expect(r.volumetricFlowM3h).toBeCloseTo((r.totalFlowKgH ?? 0) * r.specificVolume, 4);
  });

  it('mixture properties are consistent with dry_ncg mode at same composition', () => {
    // If we enter the same dry NCG flow and let dry_ncg mode compute vapour from T & P,
    // then feed that vapour back as split_flows, the mixture props should agree.
    const rDry = calculateNCGProperties({
      mode: 'dry_ncg',
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true,
      dryNcgFlowKgH: M_NCG,
    });
    const rSplit = calculateNCGProperties({
      mode: 'split_flows',
      temperatureC: BASE_T,
      dryNcgFlowKgH: rDry.dryNcgFlowKgH!,
      vapourFlowKgH: rDry.waterVapourFlowKgH!,
    });
    expect(rSplit.totalPressureBar).toBeCloseTo(rDry.totalPressureBar, 4);
    expect(rSplit.density).toBeCloseTo(rDry.density, 4);
    expect(rSplit.cpMix).toBeCloseTo(rDry.cpMix, 6);
    expect(rSplit.dynamicViscosityPas).toBeCloseTo(rDry.dynamicViscosityPas, 9);
  });

  it('throws when water vapour flow is zero', () => {
    expect(() =>
      calculateNCGProperties({
        mode: 'split_flows',
        temperatureC: BASE_T,
        dryNcgFlowKgH: 10,
        vapourFlowKgH: 0,
      })
    ).toThrow(/water vapour flow/i);
  });

  it('throws when water vapour flow is negative', () => {
    expect(() =>
      calculateNCGProperties({
        mode: 'split_flows',
        temperatureC: BASE_T,
        dryNcgFlowKgH: 10,
        vapourFlowKgH: -5,
      })
    ).toThrow(/water vapour flow/i);
  });

  it('throws when NCG flow is negative', () => {
    expect(() =>
      calculateNCGProperties({
        mode: 'split_flows',
        temperatureC: BASE_T,
        dryNcgFlowKgH: -1,
        vapourFlowKgH: 50,
      })
    ).toThrow(/NCG flow/i);
  });

  it('zero NCG flow is valid (pure steam) — P_total equals P_sat', () => {
    const r = calculateNCGProperties({
      mode: 'split_flows',
      temperatureC: BASE_T,
      dryNcgFlowKgH: 0,
      vapourFlowKgH: 50,
    });
    expect(r.ncgMoleFrac).toBeCloseTo(0, 6);
    expect(r.totalPressureBar).toBeCloseTo(P_SAT, 5);
  });
});

// ── Consistency checks across modes ──────────────────────────────────────────

describe('calculateNCGProperties — mixture property consistency', () => {
  it('mixture properties are independent of input mode (same T and P)', () => {
    const common = {
      temperatureC: BASE_T,
      pressureBar: NCG_PP,
      useSatPressure: true as const,
    };

    const rDry = calculateNCGProperties({ ...common, mode: 'dry_ncg', dryNcgFlowKgH: 10 });
    const rWet = calculateNCGProperties({ ...common, mode: 'wet_ncg', wetNcgFlowKgH: 50 });
    const rSW = calculateNCGProperties({
      ...common,
      mode: 'seawater',
      seawaterFlowM3h: 1000,
      seawaterTempC: 25,
      salinityGkg: 35,
    });
    // split_flows at the same composition (use flows from rDry to reconstruct T & P)
    const rSplit = calculateNCGProperties({
      mode: 'split_flows',
      temperatureC: BASE_T,
      dryNcgFlowKgH: rDry.dryNcgFlowKgH!,
      vapourFlowKgH: rDry.waterVapourFlowKgH!,
    });

    // Mixture properties should be identical regardless of flow input mode
    expect(rDry.density).toBeCloseTo(rWet.density, 6);
    expect(rDry.density).toBeCloseTo(rSW.density, 6);
    expect(rDry.density).toBeCloseTo(rSplit.density, 4);
    expect(rDry.cpMix).toBeCloseTo(rWet.cpMix, 6);
    expect(rDry.gammaMix).toBeCloseTo(rSW.gammaMix, 6);
    expect(rDry.dynamicViscosityPas).toBeCloseTo(rWet.dynamicViscosityPas, 9);
  });

  it('saturation pressure is exposed correctly in the result', () => {
    const r = baseResult();
    expect(r.satPressureBar).toBeCloseTo(P_SAT, 5);
  });

  it('result temperature matches input temperature', () => {
    const r = baseResult();
    expect(r.temperatureC).toBe(BASE_T);
  });
});
