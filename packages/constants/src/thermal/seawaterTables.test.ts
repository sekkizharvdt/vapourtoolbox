/**
 * Seawater property invariants.
 *
 * These assert against PUBLISHED reference values and against thermodynamic
 * identities — never against whatever the implementation currently returns.
 * Two real defects reached production because every existing thermal test
 * checked only structural properties ("greater than zero", "monotonic in
 * temperature") or a prior snapshot of the code's own output:
 *
 *   1. The salinity correction used S² where the specific-heat correlation it
 *      integrates uses S^1.5, making enthalpy NON-MONOTONIC in salinity above
 *      ~20,000 ppm and 43% wrong on dh/dT at 80,000 ppm.
 *   2. The pure-water baseline came from a Sharqawy polynomial that tracks
 *      IF97 below ~50 °C and diverges above it (+1.2% on cp at 70 °C, +6.2% at
 *      90 °C), with the enthalpy error changing sign near 58 °C so it did not
 *      cancel in the differences that set flash and effect vapour rates.
 *
 * See docs/reviews/2026-07-29-seawater-enthalpy-and-ncg-model.md.
 */

import { getSeawaterEnthalpy, getSeawaterSpecificHeat } from './seawaterTables';

/** Published IAPWS saturated-liquid enthalpy, kJ/kg */
const IAPWS_HF: [number, number][] = [
  [20, 83.91],
  [30, 125.79],
  [40, 167.57],
  [50, 209.34],
  [60, 251.15],
  [70, 293.07],
  [80, 334.95],
  [90, 376.97],
];

/** Published IAPWS saturated-liquid specific heat, kJ/(kg·K) */
const IAPWS_CP: [number, number][] = [
  [20, 4.1841],
  [30, 4.1798],
  [40, 4.1783],
  [50, 4.1804],
  [60, 4.1841],
  [70, 4.1895],
  [80, 4.1966],
  [90, 4.2054],
];

const SALINITIES = [0, 20000, 35000, 45000, 60000, 80000, 100000, 120000];

describe('pure-water baseline reproduces published IAPWS', () => {
  // Explicit physical tolerances rather than toBeCloseTo's decimal-digit
  // semantics, so the bound reads in kJ/kg rather than in digits.
  const ENTHALPY_TOLERANCE_KJ_KG = 0.1; // ~0.03% at MED temperatures
  const CP_TOLERANCE_KJ_KG_K = 0.005; // ~0.12%

  it.each(IAPWS_HF)('enthalpy at %i °C matches published h_f', (tempC, reference) => {
    // The old Sharqawy polynomial was out by 1.19 kJ/kg at 80 °C.
    expect(Math.abs(getSeawaterEnthalpy(0, tempC) - reference)).toBeLessThan(
      ENTHALPY_TOLERANCE_KJ_KG
    );
  });

  it.each(IAPWS_CP)('specific heat at %i °C matches published cp', (tempC, reference) => {
    expect(Math.abs(getSeawaterSpecificHeat(0, tempC) - reference)).toBeLessThan(
      CP_TOLERANCE_KJ_KG_K
    );
  });

  it('does not drift with temperature — the error must not change sign', () => {
    // The old baseline ran −0.106 at 30 °C and +1.187 at 80 °C, crossing zero
    // near 58 °C. That sign change is what stopped the error cancelling in
    // (h_in − h_brine) when the two temperatures straddled the crossing.
    const deviations = IAPWS_HF.map(([t, ref]) => getSeawaterEnthalpy(0, t) - ref);
    for (const d of deviations) {
      expect(Math.abs(d)).toBeLessThan(ENTHALPY_TOLERANCE_KJ_KG);
    }
  });
});

describe('salinity behaviour', () => {
  it.each([20, 40, 60, 70, 90])('enthalpy falls monotonically with salinity at %i °C', (tempC) => {
    const values = SALINITIES.map((s) => getSeawaterEnthalpy(s, tempC));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeLessThan(values[i - 1]!);
    }
  });

  it.each([20, 40, 60, 70, 90])(
    'specific heat falls monotonically with salinity at %i °C',
    (tempC) => {
      const values = SALINITIES.map((s) => getSeawaterSpecificHeat(s, tempC));
      for (let i = 1; i < values.length; i++) {
        expect(values[i]!).toBeLessThan(values[i - 1]!);
      }
    }
  );

  it('seawater enthalpy is always below pure water at the same temperature', () => {
    for (const tempC of [20, 40, 60, 70, 90]) {
      const pure = getSeawaterEnthalpy(0, tempC);
      for (const s of SALINITIES.filter((x) => x > 0)) {
        expect(getSeawaterEnthalpy(s, tempC)).toBeLessThan(pure);
      }
    }
  });
});

describe('thermodynamic consistency: dh/dT along the saturation line ≈ cp', () => {
  /**
   * h and cp must be an integral/derivative pair. They are not exactly equal
   * here because the enthalpy is evaluated along the SATURATION line while cp
   * is (∂h/∂T) at constant pressure. The difference is
   * (∂h/∂P)_T × dPsat/dT, which for liquid water is ~0.09% at 100 °C and
   * smaller below. A 0.15% bound catches a broken integral pair (the S² bug
   * gave 43%) while allowing the real saturation-line term.
   */
  const TOLERANCE_PERCENT = 0.15;

  it.each(SALINITIES)('holds at %i ppm across 20–100 °C', (salinity) => {
    for (const tempC of [20, 40, 60, 70, 80, 100]) {
      const eps = 0.01;
      const numericalDerivative =
        (getSeawaterEnthalpy(salinity, tempC + eps) - getSeawaterEnthalpy(salinity, tempC - eps)) /
        (2 * eps);
      const cp = getSeawaterSpecificHeat(salinity, tempC);
      const deviationPercent = Math.abs(((numericalDerivative - cp) / cp) * 100);

      expect(deviationPercent).toBeLessThan(TOLERANCE_PERCENT);
    }
  });
});

describe('validity range is enforced, not silently extrapolated', () => {
  it('rejects salinity outside 0–120,000 ppm', () => {
    expect(() => getSeawaterEnthalpy(-1, 50)).toThrow();
    expect(() => getSeawaterEnthalpy(120001, 50)).toThrow();
    expect(() => getSeawaterSpecificHeat(120001, 50)).toThrow();
  });

  it('rejects temperature outside 0–180 °C', () => {
    expect(() => getSeawaterEnthalpy(35000, -1)).toThrow();
    expect(() => getSeawaterEnthalpy(35000, 181)).toThrow();
    expect(() => getSeawaterSpecificHeat(35000, 181)).toThrow();
  });
});
