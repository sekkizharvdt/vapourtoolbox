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

describe('h and cp are independent published fits, and disagree by a known amount', () => {
  /**
   * These are NOT an exact integral pair, and the test must not pretend they are.
   *
   * Enthalpy is Sharqawy Eq. (43), fitted to Bromley et al. (1970). Specific heat
   * is Eq. (9), reproducing Jamieson et al. (1969). Different datasets, different
   * fits, and they disagree on `dh/dT` versus `cp` by up to ~2.2% at the corner
   * of the declared box. Using both is what the MIT library and the wider
   * literature do; making them consistent would mean overriding one with the
   * other and departing from the published correlations.
   *
   * The superseded home-grown pair WAS an exact integral pair — and was wrong,
   * because it integrated a Millero cp form whose own pure-water baseline
   * diverged above 50 °C. Self-consistency was never the property worth having.
   *
   * So this test does four things instead of asserting a tight bound:
   *   1. catches gross errors anywhere in the box (the S^2 defect gave 43%)
   *   2. holds a tighter bound in the envelope the plant actually runs in
   *   3. PINS the known disagreement, so it can neither grow silently nor be
   *      "fixed" by someone quietly re-deriving one correlation from the other
   *   4. confirms the gap comes from salinity, not the pure-water baseline
   */
  const deviationPercent = (salinity: number, tempC: number): number => {
    const eps = 0.01;
    const numericalDerivative =
      (getSeawaterEnthalpy(salinity, tempC + eps) - getSeawaterEnthalpy(salinity, tempC - eps)) /
      (2 * eps);
    const cp = getSeawaterSpecificHeat(salinity, tempC);
    return ((numericalDerivative - cp) / cp) * 100;
  };

  const maxOver = (salinities: number[], temps: number[]): number =>
    Math.max(...salinities.flatMap((s) => temps.map((t) => Math.abs(deviationPercent(s, t)))));

  const range = (from: number, to: number, step: number): number[] => {
    const out: number[] = [];
    for (let x = from; x <= to; x += step) out.push(x);
    return out;
  };

  /** Where MED effects and the flash chamber actually operate. */
  const DESIGN_TEMPS = range(30, 70, 2);
  const DESIGN_SALINITIES = range(0, 60000, 5000);

  /** The full box the fixture set exercises, out to last-effect brine. */
  const FIXTURE_TEMPS = range(30, 90, 2);
  const FIXTURE_SALINITIES = range(0, 120000, 5000);

  it('agrees to better than 0.6% where the plant operates', () => {
    // Measured 0.430% at 60 g/kg, 56 C. Both correlations claim +/-1.5%, so
    // agreement well inside that is the most that can be asked of them.
    expect(maxOver(DESIGN_SALINITIES, DESIGN_TEMPS)).toBeLessThan(0.6);
  });

  it('never diverges grossly anywhere in the declared box', () => {
    // The finding-1 S^2 defect produced 43% here. A 3% ceiling catches that
    // class of error while allowing the real inter-correlation gap.
    expect(maxOver(FIXTURE_SALINITIES, FIXTURE_TEMPS)).toBeLessThan(3);
  });

  it('pins the known worst-case disagreement so it stays visible', () => {
    // 2.234% at 120 g/kg, 90 C — the hot, concentrated corner. Bracketed rather
    // than bounded: if this DROPS below 1.5% someone has re-derived one
    // correlation from the other, which is a change of source, not an
    // improvement. Both directions should fail loudly.
    const worst = maxOver(FIXTURE_SALINITIES, FIXTURE_TEMPS);
    expect(worst).toBeGreaterThan(1.5);
    expect(worst).toBeLessThan(2.6);
  });

  it('the gap is driven by salinity, not by the pure-water baseline', () => {
    // At S = 0 both reduce to the IF97 baseline, so any residual there is the
    // saturation-line term only (~0.09% at 100 C), not a correlation mismatch.
    expect(maxOver([0], FIXTURE_TEMPS)).toBeLessThan(0.15);
  });
});

describe('validity range is enforced, not silently extrapolated', () => {
  it('rejects salinity outside 0–120,000 ppm', () => {
    expect(() => getSeawaterEnthalpy(-1, 50)).toThrow();
    expect(() => getSeawaterEnthalpy(120001, 50)).toThrow();
    expect(() => getSeawaterSpecificHeat(120001, 50)).toThrow();
  });

  it("rejects temperature outside each correlation's OWN envelope", () => {
    // The two correlations have different declared ranges, and the code must not
    // paper over that. Eq. (43) for enthalpy is 10-120 C; Eq. (9) for cp is
    // 0-180 C. Silently extrapolating either is what the superseded home-grown
    // integral did.
    expect(() => getSeawaterEnthalpy(35000, 9.9)).toThrow(/10-120/);
    expect(() => getSeawaterEnthalpy(35000, 120.1)).toThrow(/10-120/);
    expect(() => getSeawaterEnthalpy(35000, -1)).toThrow();
    expect(() => getSeawaterEnthalpy(35000, 181)).toThrow();

    expect(getSeawaterSpecificHeat(35000, 9.9)).toBeGreaterThan(0);
    expect(getSeawaterSpecificHeat(35000, 150)).toBeGreaterThan(0);
    expect(() => getSeawaterSpecificHeat(35000, 181)).toThrow();
    expect(() => getSeawaterSpecificHeat(35000, -1)).toThrow();
  });
});
