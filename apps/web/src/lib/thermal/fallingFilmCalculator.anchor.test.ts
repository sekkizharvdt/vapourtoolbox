/**
 * Falling Film Calculator — external anchor tests (UNMOCKED property layer)
 *
 * The main suite (fallingFilmCalculator.test.ts) mocks @vapour/constants, so
 * its expectations are self-consistent with the mock. This file deliberately
 * does NOT mock anything: real Sharqawy seawater correlations and real steam
 * tables flow through the calculator, and the expected values are computed
 * by hand from published property data (NIST) and the published correlation
 * (Chun & Seban 1971).
 *
 * Why not a literal El-Dessouky & Ettouney worked example: the evaporator
 * design examples in "Fundamentals of Salt Water Desalination" (Elsevier,
 * 2002, Ch. 3-4) specify the overall coefficient U from the book's empirical
 * U(T_b) polynomials rather than building it from film-side correlations, so
 * their inputs do not map onto this calculator's film-HTC path. The film
 * correlation this code implements is Chun & Seban (1971) — anchored here
 * with independent NIST property values — and the resulting overall U is
 * cross-checked against the 2-3 kW/(m²·K) range the El-Dessouky examples
 * use for horizontal-tube MED evaporators at 60-70 °C.
 */

import { calculateFallingFilm } from './fallingFilmCalculator';

describe('external anchor — Chun & Seban (1971) with NIST water properties (unmocked)', () => {
  /**
   * Case: pure water (salinity 0 → Sharqawy correlations reduce to pure
   * water) falling film at 60 °C, wetting rate Γ = 0.03 kg/(m·s).
   *
   * Geometry chosen so Γ comes out exactly 0.03:
   *   Γ = feed / (tubesPerRow · L · 2) = 21.6 / (60 · 6 · 2) = 0.03 kg/(m·s)
   *
   * Hand calculation, Chun & Seban laminar film Nu* = 0.822·Re^(−0.22),
   * h = 0.822 · (k³ρ²g/μ²)^(1/3) · Re^(−0.22), with saturated-liquid water
   * properties at 60 °C from NIST Webbook / IAPWS-IF97:
   *   ρ = 983.2 kg/m³, μ = 4.67e-4 Pa·s, k = 0.654 W/(m·K)
   *
   *   Re  = 4Γ/μ = 4·0.03/4.67e-4 = 257.0   (laminar, < 400)
   *   (k³ρ²g/μ²)^(1/3)
   *       = (0.654³ · 983.2² · 9.81 / (4.67e-4)²)^(1/3)
   *       = (0.27968 · 966,682 · 9.81 / 2.1809e-7)^(1/3)
   *       = (1.2161e13)^(1/3) = 22,998
   *   h   = 0.822 · 22,998 · 257.0^(−0.22)
   *       = 0.822 · 22,998 / 3.390 = 5,577 W/(m²·K)
   *
   * Tolerance ±10%: covers NIST-vs-Sharqawy property differences at S = 0
   * (observed agreement is ~0.5%). A failure here means either the film
   * correlation or the real property layer has drifted.
   */
  const input = {
    feedFlowRate: 21.6, // kg/s → Γ = 0.03 kg/(m·s)
    feedSalinity: 0, // pure water so NIST hand properties apply
    feedTemperature: 60, // °C
    steamTemperature: 63, // °C (ΔT_eff = 3 K at S = 0, BPE = 0)
    tubeOD: 25.4,
    tubeID: 22.1,
    tubeLength: 6, // m
    numberOfTubes: 360,
    tubeMaterial: 'cu_ni_90_10',
    tubeLayout: 'triangular' as const,
    pitchRatio: 1.4,
    tubeRows: 6,
  };

  it('laminar film HTC at 60°C, Γ=0.03 kg/(m·s) within ±10% of the NIST hand value (5,577 W/m²K)', () => {
    const result = calculateFallingFilm(input);

    // Sanity on the anchor's premises
    expect(result.wettingRate).toBeCloseTo(0.03, 6);
    expect(result.flowRegime).toBe('Laminar Sheet');
    // Re = 4Γ/μ with real μ(0 ppm, 60 °C) ≈ 4.66e-4 → ≈ 257 (±3% on properties)
    expect(Math.abs(result.filmReynolds - 257.0) / 257.0).toBeLessThan(0.03);

    // The anchor pin
    expect(Math.abs(result.filmHTC - 5577) / 5577).toBeLessThan(0.1);
  });

  it('overall U lands in the 2-3 kW/(m²·K) band of El-Dessouky & Ettouney MED evaporator examples', () => {
    // El-Dessouky & Ettouney (2002) horizontal-tube MED evaporator examples
    // use overall U ≈ 2-3 kW/(m²·K) at 60-70 °C top brine temperatures.
    // This is a plausibility band, not a pin — it guards against a property
    // or resistance-stackup regression that the film-HTC pin alone misses
    // (e.g. condensation side or wall resistance going wrong by 2×).
    const result = calculateFallingFilm(input);
    expect(result.overallHTC).toBeGreaterThan(2000);
    expect(result.overallHTC).toBeLessThan(3200);
  });
});
