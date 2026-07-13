/**
 * MVC Calculator — external anchor tests (UNMOCKED property layer)
 *
 * The main suite (mvcCalculator.test.ts) mocks @vapour/constants, so it can
 * never catch a steam-table regression. This file does NOT mock anything:
 * the real IF97 Region-2 implementation flows through the calculator, and
 * the expected specific energy is hand-computed from published IAPWS-IF97
 * steam-table values along the code's own thermodynamic path definition
 * (isentropic enthalpy rise ÷ η_is ÷ η_mech ÷ mass).
 */

import { calculateMVC } from './mvcCalculator';

describe('external anchor — IAPWS-IF97 steam tables (Cengel & Boles), unmocked', () => {
  /**
   * Case: 0.5 bar → 1.0 bar (CR = 2), 10 t/hr, η_is = 0.75, η_mech = 0.95.
   * Chosen because BOTH end states sit on published table pressures
   * (Cengel & Boles, "Thermodynamics: An Engineering Approach", 8th ed.,
   * Tables A-5 and A-6; values are IAPWS-IF97):
   *
   *   A-5, sat @ 50 kPa:  Tsat = 81.32 °C, h_g = 2645.2 kJ/kg, s_g = 7.5931 kJ/(kg·K)
   *   A-6, 0.1 MPa, 100 °C: h = 2675.8, s = 7.3611
   *   A-6, 0.1 MPa, 150 °C: h = 2776.6, s = 7.6148
   *
   * Hand path (matches the code's definition: suction = Tsat + 0.5 K):
   *   T1  = 81.82 °C; with cp_vap ≈ 1.95 kJ/(kg·K) near saturation at 0.5 bar
   *   h1  = 2645.2 + 1.95·0.5                     = 2646.2 kJ/kg
   *   s1  = 7.5931 + 1.95·ln(355.0/354.5)         = 7.5959 kJ/(kg·K)
   *   Isentropic to 1.0 bar, interpolate A-6 on s:
   *     x   = (7.5959 − 7.3611)/(7.6148 − 7.3611) = 0.9253
   *     T2s = 100 + 50·0.9253 = 146.3 °C
   *     h2s = 2675.8 + 0.9253·(2776.6 − 2675.8)   = 2769.1 kJ/kg
   *   Δh_s = 2769.1 − 2646.2                      = 122.9 kJ/kg
   *   Δh   = 122.9 / 0.75                         = 163.9 kJ/kg
   *   w_el = 163.9 / 0.95                         = 172.5 kJ/kg
   *   SEC  = 172.5 / 3.6                          = 47.9 kWh/ton
   *
   * (CR = 2 / ΔT_boil ≈ 18 K is deliberately above the usual MVC operating
   * band so the isentropic rise is big enough to interpolate accurately
   * from 50-K table steps; the typical-band case is checked separately
   * below.) Pin ±3%: the hand value's own uncertainty (linear s/h
   * interpolation over 50 K + cp of slight superheat) is ≈ ±1%.
   */
  it('0.5→1.0 bar, 10 t/hr, η_is 0.75, η_mech 0.95: SEC within ±3% of hand value 47.9 kWh/ton', () => {
    const result = calculateMVC({
      suctionPressure: 0.5,
      dischargePressure: 1.0,
      flowRate: 10,
      isentropicEfficiency: 0.75,
      mechanicalEfficiency: 0.95,
    });

    // Premise checks against the tables (loose — these validate the real
    // steam-table layer, not the compressor math):
    expect(Math.abs(result.suctionTemperature - 81.32)).toBeLessThan(0.3); // Tsat(0.5 bar)
    expect(Math.abs(result.suctionEnthalpy - 2646.2)).toBeLessThan(5); // kJ/kg
    expect(Math.abs(result.suctionEntropy - 7.5959)).toBeLessThan(0.01); // kJ/(kg·K)
    expect(Math.abs(result.dischargeEnthalpyIsentropic - 2769.1)).toBeLessThan(8); // kJ/kg

    // The anchor pin: specific energy vs the hand steam-table value
    expect(Math.abs(result.specificEnergy - 47.9) / 47.9).toBeLessThan(0.03);
  });

  it('typical MVC duty (60°C suction, CR 1.2) lands in the textbook 8-15 kWh/m³ band', () => {
    // Textbook MVC specific energy for seawater service is ~8-15 kWh/m³
    // (El-Dessouky & Ettouney 2002, Ch. 8 single-effect MVC; ΔT_boil 4-8 K,
    // CR ≈ 1.2-1.5). 0.20 → 0.24 bar: Tsat 60.1 → 64.3 °C, CR = 1.2.
    // Distillate density ≈ 1 t/m³, so kWh/ton ≈ kWh/m³.
    const result = calculateMVC({
      suctionPressure: 0.2,
      dischargePressure: 0.24,
      flowRate: 10,
    });
    expect(result.compressionRatio).toBeCloseTo(1.2, 5);
    expect(result.specificEnergy).toBeGreaterThan(8);
    expect(result.specificEnergy).toBeLessThan(15);
  });
});
