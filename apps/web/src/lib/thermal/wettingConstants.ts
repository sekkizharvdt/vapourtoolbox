/**
 * Falling-film wetting rate design limits — single source of truth (rule 32).
 *
 * Γ_min = 0.03 kg/(m·s) is the company's validated minimum wetting rate for
 * horizontal-tube falling-film evaporators. It is validated against real MED
 * plant operating data and enforced by the MED designer
 * (`med/equipmentSizing.ts`). It governs the wetting status in ALL
 * falling-film calculators (falling film, single tube, MED designer).
 *
 * The El-Dessouky & Ettouney (2002) correlation
 * Γ_min = 0.11 (μ² / ρσ)^(1/3) ≈ 2.4×10⁻⁴ kg/(m·s) is the THEORETICAL
 * film-breakdown minimum — the point at which a film physically ruptures,
 * not a usable design value. It is ~100× more permissive than the validated
 * limit and must only ever be reported as an informational output
 * (`wettingRateTheoreticalMin`), never used to grade wetting adequacy.
 *
 * Do NOT change these values without re-validating against plant data.
 */

/** Validated minimum wetting rate in kg/(m·s) — governing design limit */
export const MIN_WETTING_RATE_DESIGN = 0.03;

/** Design target wetting rate in kg/(m·s) — 1.5× the validated minimum */
export const WETTING_RATE_DESIGN_TARGET = MIN_WETTING_RATE_DESIGN * 1.5;
