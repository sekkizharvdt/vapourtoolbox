# Seawater Enthalpy & NCG Model — Findings and Remediation Plan

## Overview

Building the flash-chamber fixture set for the dynamic simulator required checking
`calculateFlashChamber` against an external reference for the first time. That check found
a seawater property bug; following it into the MED engine found three more defects in the
NCG model.

**Reviewed by**: Claude (AI-assisted review)
**Date**: July 29, 2026
**Scope**: `packages/constants/src/thermal/seawaterTables.ts`, `apps/web/src/lib/thermal/med/` (effectModel, medEngine), flash chamber calculator
**Trigger**: [dynamic simulator specification r2](../thermal/dynamic-simulator-specification-r2.md) §7.1 property verification

**Status:** **Findings 1, 2, 5, 6, 7 and 8 FIXED.** Findings 3 and 4 **CLOSED — will not be
done**, with structural reasons below. Findings 6, 7 and 8 emerged during the work.

**Finding 8 supersedes finding 1.** The salinity exponent finding 1 corrected belonged to a
home-grown correlation that should not have been there at all; the published Sharqawy Eq. (43)
and Eq. (9) now replace it. Finding 1 was a real fix to the wrong equation — worth recording,
because "we corrected it once already" is exactly what stops a second look.

**Why the existing tests did not catch any of this:** all 1,233 thermal tests assert either
structural properties ("greater than zero", "monotonic in temperature") or the engine's own
prior output. None compares against an independent physical reference. Finding 8 sharpens the
lesson: after findings 1 and 5 the suite DID assert against published IAPWS values and a
thermodynamic identity — and still could not see it, because the IAPWS pins probe only the
S = 0 limit where the salinity term vanishes, and a self-consistent home-grown pair satisfies
the integral identity by construction. **An invariant a wrong implementation satisfies
automatically is not evidence.** This is the exact
pattern CLAUDE.md rule 4 in the simulator repo was written against, and it caught something
on first contact.

| #   | Finding                                                          | Severity | Effect on GOR                       | Status                |
| --- | ---------------------------------------------------------------- | -------- | ----------------------------------- | --------------------- |
| 1   | Seawater enthalpy uses S² where cp uses S^1.5                    | HIGH     | 10.05 → 10.25                       | **FIXED**             |
| 2   | NCG release 1000× too small (units) — **two instances**          | MEDIUM   | none — NCG is inert                 | **FIXED**             |
| 3   | Carrier steam decoupled from NCG load                            | LOW      | none, and arguably shouldn't change | **CLOSED — won't do** |
| 4   | NCG has no effect on heat transfer / pressure                    | LOW      | **structurally cannot affect GOR**  | **CLOSED — won't do** |
| 5   | Pure-water enthalpy baseline disagrees with IAPWS, sign-changing | HIGH     | +0.02 on GOR; broke the rung-1 gate | **FIXED**             |
| 6   | BARC golden input mislabels effect-1 temp as the steam temp      | HIGH     | +6.7% → +2.2% once corrected        | **FIXED**             |
| 7   | Evaporator U capped at a constant; `foulingResistance` is dead   | MEDIUM   | none — U never reaches the H&M      | **FIXED**             |
| 8   | Seawater salinity terms were home-grown, not the published fits  | HIGH     | 9.82 → 9.83; up to 0.7% on a flash  | **FIXED**             |
| 9   | Flash chamber evaluated BPE at the feed, not the brine leaving   | MEDIUM   | none — MED already correct          | **FIXED**             |

Findings 1, 2 and 5 are fixed and independent of each other. Findings 3 and 4 are closed —
see their sections for the structural reasons, which are the substance of this review.

---

## Findings

### HIGH Priority

#### 1. Seawater Enthalpy Salinity Exponent

**Risk**: Every brine enthalpy in the MED train and flash chamber is wrong, increasingly so
with salinity. MED brine runs 49,000–76,000 ppm — squarely in the worst region.

**Detail**: `getSeawaterEnthalpy` applies the Millero correction coefficients to **S²**.
`getSeawaterSpecificHeat`, in the same file, applies **the same three coefficients**
(`1.7413e-4`, `4.1326e-6`, `8.3486e-8`) to **S^1.5**. Enthalpy is the temperature-integral
of specific heat, so the salinity exponent must carry through unchanged. Only the
temperature powers are integrated.

Evidence, all derived from internal consistency rather than recalled coefficients:

- Before the fix `h_sw` was **non-monotonic in salinity** — minimum near 20,000 ppm, then
  rising, exceeding pure water above ~40,000 ppm. Physically impossible.
- `dh/dT` disagreed with `cp` by **+7.4% at 35,000 ppm** and **+42.9% at 80,000 ppm** (70 °C).
- After the fix `dh/dT` matches `cp` to **0.0000%** across S = 0–120,000 ppm, T = 20–100 °C,
  and `h_sw` falls monotonically — −12.7 kJ/kg depression at 35 g/kg / 70 °C.
- `cp` is independently correct: 4.01 kJ/kg·K at 35,000 ppm is the textbook value.
- At S = 0 nothing changes, which is why pure water always agreed and the DM-water flash
  cases are unaffected.

**Impact**:

| Consumer                 | Change                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Flash chamber (seawater) | vapour rate **−5.7% to −11.8%**                                                       |
| Flash chamber (DM water) | unchanged                                                                             |
| MED engine               | GOR **10.05 → 10.230**; vapour +0.9–2.4%; brine +1.8–2.7%; **temperatures unchanged** |
| BARC golden pins         | 7 tests fail                                                                          |
| SSOT stream register     | all generated brine/feed enthalpies stale                                             |

**On the BARC anchor**: it is a hybrid, and the distinction matters for how much weight it
carries. The **GOR check is a genuine external anchor** (BARC/IIT Madras as-built GOR 9.61,
±15% band = 8.17–11.05; the fix gives 10.230, inside it). The **per-effect pins are the
engine's own output**, captured 2026-07-13. The pins did their job — they caught a physics
change loudly instead of letting it hide inside the ±15% GOR tolerance — but they cannot
say whether the change is an improvement. Only the `dh/dT == cp` argument can. The test's
own docstring prescribes the remedy: _"If a deliberate physics fix moves these numbers,
re-baseline the table in the same commit and say why in the commit message."_

#### 4. NCG Has No Effect on Heat Transfer or Pressure — **CLOSED, will not be done**

**Original premise**: adding NCG partial-pressure and blanketing effects would explain the
model running +6.5% above the BARC as-built GOR.

**Why it is closed.** Both halves are structurally incapable of affecting GOR in this
engine, and the bias they were meant to explain was mostly an input error (finding 6).

- **HTC degradation cannot do anything.** `equipmentSizing.ts` applies
  `Math.min(result.overallHTC, MED_EVAPORATOR_DESIGN_U_WM2K)` with the cap at 3,100
  W/m²·K, and its own comment records that the correlation _"over-predicts vs built-plant
  experience"_ — so the cap binds. Reducing the correlated HTC for blanketing moves the
  computed value closer to a cap it never crosses. **Verified empirically**: quadrupling
  `foulingResistance` from 0.00015 to 0.0006 leaves GOR (9.8200), effect-1 temperature
  (58.83 °C) and required area (166.91 m²) bit-identical. See finding 7.
- **`effectModel.ts` contains no `overallU` and no `requiredArea`.** The heat and mass
  balance runs on energy balance and the prescribed ΔT cascade; sizing runs afterwards. U
  is downstream of the H&M, not an input to it.
- **Partial pressure is negligible.** With the corrected NCG source (finding 2), the mole
  fraction at effect 6 is ~0.24 mol% → ~0.19 mbar → **~0.05 K** on saturation temperature,
  against a 3.35 K per-effect step.

**What replaces it.** After finding 6's input correction the residual gap is **+2.2%,
alongside a 0.07 K temperature match across all six effects**. Remaining candidates, none
of them NCG: the final-condenser vent, ambient heat loss (not modelled anywhere), the U cap
itself, and measurement uncertainty in the as-built 9.61. **Left documented rather than
absorbed into a coefficient.**

**Reopen if**: a second as-built case shows a similar bias in the same direction, or the U
cap is removed (finding 7) so HTC becomes load-bearing.

#### 5. Pure-Water Enthalpy Baseline Disagrees With IAPWS, and the Error Changes Sign

**Risk**: Flash and effect vapour rates come from a small difference between two large,
nearly-equal liquid enthalpies. A temperature-dependent baseline error does not cancel in
that difference when the two temperatures straddle its zero crossing, and the resulting
flow error is several times the enthalpy error.

**Found by**: the dynamic simulator session, reconciling the DM-water fixtures against
IAPWS-IF97 independently. Their measurements match this repo's exactly.

**Detail**: `getSeawaterEnthalpy(0, T)` is the Sharqawy pure-water cp integral, not IAPWS.
Against published saturated-liquid enthalpy:

| T °C | Published h_f | `getSeawaterEnthalpy(0,T)` | Δ          | `getEnthalpyLiquid(T)` | Δ      |
| ---- | ------------- | -------------------------- | ---------- | ---------------------- | ------ |
| 30   | 125.79        | 125.684                    | **−0.106** | 126.317                | +0.527 |
| 50   | 209.34        | 209.267                    | −0.073     | 210.603                | +1.262 |
| 60   | 251.15        | 251.175                    | **+0.025** | 252.834                | +1.684 |
| 70   | 293.07        | 293.360                    | **+0.290** | 295.133                | +2.063 |
| 80   | 334.95        | 336.137                    | +1.187     | 337.494                | +2.544 |

**The error crosses zero at ~58–60 °C**, and that decides whether a case reconciles:

| Case  | Inlet T / Δ    | Brine T / Δ       | Errors    | Flow error                        |
| ----- | -------------- | ----------------- | --------- | --------------------------------- |
| dm-02 | 42 °C / −0.10  | 36.16 °C / −0.106 | same side | **cancel** — reconciles to 0.085% |
| dm-01 | 70 °C / +0.290 | 60.06 °C / +0.001 | straddle  | **0.69%** — fails the 0.5% gate   |

0.289 kJ/kg residual on a 41.9 kJ/kg enthalpy difference is 0.69%, matching the 0.68% flow
error measured independently.

**A second defect in the same area**: `getEnthalpyLiquid` — the function _named_ as the
IAPWS one — is off by **+0.5 to +2.5 kJ/kg**, worse than the seawater path. Anything using
it as an IAPWS reference is using a wrong reference.

**Amplification** (from the simulator session's analysis, and why this matters more than
its size suggests). Flash rate is `m_v = W(h_in − h_b)/(h_v − h_b)`:

| Case  | Flash ΔT | h_in − h_b | Amplification | Enthalpy accuracy needed for a 0.5% flow gate |
| ----- | -------- | ---------- | ------------- | --------------------------------------------- |
| dm-01 | 9.9 K    | 41.9 kJ/kg | 7.0×          | 0.071%                                        |
| dm-02 | 5.8 K    | 24.4       | 7.2×          | 0.069%                                        |
| sw-04 | 4.4 K    | 20.0       | **16.0×**     | **0.031%**                                    |

At small flash ΔT the gate demands enthalpy agreement tighter than either implementation
carries.

**Two hypotheses from that session that do not hold**, recorded so they are not re-opened:

1. _"Inlet and outlet liquid enthalpy are not coming from the same function."_ Both come
   from `getSeawaterEnthalpy`. The asymmetry is temperature drift within one correlation.
2. _"A compressed-liquid correlation is being evaluated below the saturation line without a
   region check."_ `getSeawaterEnthalpy(salinity, tempC)` **takes no pressure argument**, so
   pressure never enters the enthalpy path. The `operating + 50 mbar` inlet pressure is
   still worth fixing on its own merits — a nominal line allowance stated below saturation
   in 5 of 6 fixture cases — but it does not cause this.

**Also not a bug**: outlet temperature identical at 0 / 35,000 / 45,000 ppm. That is the
_vapour_ row — pure-water Tsat at operating pressure, correctly salinity-independent. The
brine row does vary (60.059 / 60.459 / 60.588 °C).

### MEDIUM Priority

#### 2. NCG Source Is a Lumped Constant, Applied With a Units Error

**Risk**: Two problems compounding. The cascade is effectively zero because of a units
error, so any NCG-dependent physics added later (findings 3 and 4) would be sized against a
meaningless number. And the source term is a single lumped constant that cannot represent
the two release mechanisms, which behave completely differently.

**Decision 2026-07-29: replace the constant with computed physics** rather than repairing
it. That makes the units error, the mg/L-versus-ppm basis question, and the unreconciled
CADAFE derivation all moot at once.

**Detail**: `apps/web/src/lib/thermal/med/effectModel.ts`:

```ts
const seawaterDensity = getSeawaterDensity(seawaterSalinity, seawaterSprayTemp);
const seawaterVolumeLitres = seawaterSprayFlow / seawaterDensity; // litres/hr (density ≈ kg/L)
const ncgReleased = (seawaterVolumeLitres * TOTAL_DISSOLVED_GAS_MG_PER_LITRE) / 1e6;
```

`getSeawaterDensity` returns **kg/m³** (~1025), not kg/L. The expression yields **m³/h**, so
the variable named `Litres` holds cubic metres.

BARC case, 25,936 kg/h total feed:

| Quantity                  | Value       |
| ------------------------- | ----------- |
| Engine NCG, all 6 effects | 0.0012 kg/h |
| Expected at 50 mg/L       | 1.265 kg/h  |
| Ratio                     | **~1054×**  |

The cascade **shape is correct** — 0.0001 → 0.0003 → 0.0005 → 0.0007 → 0.0009 → 0.0012,
accumulating effect to effect, with fresh feed degassing in each effect and recirculated
brine treated as already deaerated. Only the magnitude is wrong.

This is the failure mode CLAUDE.md rule 1 in the simulator repo was written for: the unit
is in the name, the name is wrong, and nothing caught it.

**The two mechanisms are not interchangeable:**

| Component                  | Release mechanism                                                  | Temperature dependence                                                           | Modelable today?                                                      |
| -------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Dissolved air** (O₂, N₂) | Comes out of solution as soon as the feed flashes to effect vacuum | Solubility at **intake** conditions; release itself is complete and prompt       | **Yes** — `dissolvedGasContent()` already implements Weiss (1970)     |
| **CO₂** from bicarbonate   | Thermal decomposition, `2 HCO₃⁻ → CO₃²⁻ + CO₂ + H₂O`               | **Kinetic** — rate rises with temperature, extent also depends on residence time | **No** — needs alkalinity, carbonate equilibrium and sourced kinetics |

A single `mg/L` constant applied uniformly to every effect cannot express either one
correctly. Air release depends on intake conditions, not effect conditions. CO₂ release is
front-loaded into the hot end and is not complete at any MED temperature.

**What exists already.** `ncgCalculator.dissolvedGasContent(tempC, salinityGkg)` returns O₂
and N₂ separately in mg/L and mL(STP)/L from Weiss (1970), and sets an `extrapolated` flag
outside the 0–36 °C validity range instead of silently guessing. It is currently orphaned —
nothing in the MED path calls it. Wiring it in replaces the air half of the constant with
real physics and no new inputs. (It omits argon, ~1.6% of dissolved air by mass — acceptable,
worth a comment.)

**What does not exist.** The CO₂ half needs feed **total alkalinity**, the carbonate
equilibrium (pK₁, pK₂ as functions of T and S), and decomposition kinetics. None of that is
in the codebase, and the kinetics must be sourced rather than assumed — see the note on TBT
range in §Open Decisions.

**Superseded**: the earlier remedy of renaming to `seawaterVolumeM3` and converting. A
mass-basis or intake-basis computation removes the volume step altogether, so the m³/L
confusion cannot recur by construction.

#### 3. Carrier Steam Decoupled from NCG Load — **CLOSED, will not be done**

**Risk**: Carrier steam does not respond to the NCG it is meant to sweep, so it is
arbitrary in both directions.

**Detail**: `CARRIER_STEAM_FRACTION = 0.01` — a flat 1% of tube-side vapour flow, cited to
El-Dessouky & Ettouney (2002). For BARC that is 21.65 kg/h at effect 1 falling to 14.18 kg/h
at effect 6, regardless of NCG quantity.

Physically, carrier steam is sized to sweep the actual NCG at a design vent partial
pressure:

```
m_vapour / m_ncg = (P_sat / P_ncg) × (M_H2O / M_ncg)
```

**The molar mass is the NCG mixture's, not air's** — see the decision in §Open Decisions.
With CO₂ included at the CADAFE proportions the mean is **36.8 g/mol**, giving
`M_H2O/M_ncg = 0.489` against 0.622 for air alone. **A given partial pressure therefore
corresponds to ~21% more NCG mass, so ~21% less vapour is carried per kg of NCG.** Using
`M_air` here would over-state carryover.

At a vent designed for 10% NCG partial pressure the ratio is 4.4 (not 5.6), so sweeping
0.21 kg/h of NCG needs ~0.9 kg/h of carrier — against the 21.65 kg/h the flat 1% provides.

**Must preserve**: vapour vented from effect _i_ reports to effect _i+1_ and still becomes
distillate. Product is genuinely lost only at the **final condenser vent** to the vacuum
system. Any rework must keep this distinction.

**Why it is closed.** Two reasons:

1. **No observable effect.** `Q_carrierToShell` already returns the carrier steam's energy
   to the next effect's shell, so total energy is conserved either way — only the path
   changes. The magnitude is bounded by ~1% of vapour flow, and since U is capped
   (finding 7) the area consequence is absorbed too.
2. **The flat 1% is arguably the better engineering value.** It is El-Dessouky &
   Ettouney's design allowance for sweep steam. Real vents are deliberately oversized
   relative to the theoretical minimum sweep, so deriving carrier from the computed NCG
   load would be optimistic — a worse model dressed as a more rigorous one.

**Reopen if** the NCG load ever becomes load-bearing on performance, i.e. if finding 4 is
reopened.

---

### Findings that emerged during the work

#### 6. The BARC Golden Input Mislabels the Effect-1 Temperature as the Steam Temperature

**Risk**: the codebase's only external anchor is anchored to an operating point the plant
never ran at, and the GOR agreement it reports is partly manufactured.

**Found by**: the domain user, who commissioned the plant, observing that effect 1 ran above
60 °C — then supplying the as-built datasheet.

**Detail**: `GOLDEN_INPUT.steamTemperature = 58.8`. Per the as-built datasheet, 58.8 °C is
the **effect 1 operating temperature**; the steam inlet (stream 7) is **62.2 °C**. The model
therefore reproduced the as-built cascade shifted down by exactly one ΔT step:

| Effect     | As-built | Model @ 58.8  | Model @ 62.2 + `condenserOutletTemp: 38` |
| ---------- | -------- | ------------- | ---------------------------------------- |
| 1          | 58.8     | 55.5 (−3.3)   | **58.83 (+0.03)**                        |
| 6          | 42.0     | 39.0 (−3.0)   | **42.0 (0.00)**                          |
| max \|ΔT\| | —        | 3.3 K         | **0.07 K**                               |
| GOR        | 9.61     | 10.25 (+6.7%) | **9.82 (+2.2%)**                         |

A second input is also wrong: `condenserApproach: 4` puts the cold end at 39.0 °C against an
as-built 42.0 °C. `condenserOutletTemp: 38` reproduces it.

**How it survived**: the input had been **tuned to preserve an output**. The comment above
the basic BARC case reads _"steam temp raised from 57→59 °C because the engine now correctly
applies both demister AND duct pressure drop losses."_ Adjusting an input to keep a result
after a model change is backwards, and it is what let a 3.3 K profile error persist while
the GOR check passed.

**Consequence for this review**: finding 4's entire justification was the +6.5% bias. With
correct inputs that is +2.2% alongside a 0.07 K profile match — which is why finding 4 is
closed rather than merely deprioritised.

**FIXED 2026-07-31.** The golden input is corrected to 62.2 / 38 and the pins re-baselined.
The same mislabel was present in **four** places, not one — every test in `medEngine.test.ts`
claiming to validate against BARC passed `steamTemperature: 58.8` with `condenserApproach: 4`.
All four now share a single `BARC_AS_BUILT` constant, so the operating point cannot drift
apart between tests again.

This is the first re-baseline in that file that improves agreement with the **plant** rather
than tracking a model change:

| Quantity | Was    | Now    | As-built | Error was | Error now   |
| -------- | ------ | ------ | -------- | --------- | ----------- |
| Effect 1 | 55.5   | 58.83  | 58.8     | −3.3 K    | **+0.03 K** |
| Effect 6 | 39.0   | 42.00  | 42.0     | −3.0 K    | **0.00 K**  |
| GOR      | 10.25  | 9.82   | 9.61     | +6.7%     | **+2.2%**   |
| Ra       | 1.0697 | 0.9878 | 0.935    | +14.4%    | **+5.6%**   |

A new test asserts against the datasheet's own effect 1 and effect 6 temperatures directly,
so the anchor now checks the plant rather than merely being self-consistent.

#### 7. Evaporator U Is Capped at a Constant, and `foulingResistance` Does Nothing

**Risk**: an input the UI accepts and documents has no effect, and the geometry-derived heat
transfer coefficient is discarded without being reported.

**Detail**: `equipmentSizing.ts` computes an overall HTC from tube geometry, the Nusselt
tube-side correlation and the Chun-Seban shell-side correlation, then returns
`Math.min(result.overallHTC, MED_EVAPORATOR_DESIGN_U_WM2K)` with the cap at **3,100
W/m²·K** — the domain user's recommended as-designed value, reconciled against the Reference
Projects data. Because the correlation over-predicts, the cap binds in practice and the
correlated value is thrown away.

**Verified**: quadrupling `foulingResistance` (0.00015 → 0.0006) leaves GOR, effect
temperatures and required areas bit-identical.

**Planned change** (in progress): report the correlated U, the design cap and which was
used, and allow a per-design override — the same pattern `MEDDesignerInput` already uses for
`tubeLengthOverrides` and `shellIDOverrides`. That surfaces the geometry result for
engineering judgement instead of hiding it, and revives fouling resistance as a meaningful
input.

**FIXED 2026-07-31**, in two parts.

_Reporting_ — `correlatedOverallHTC`, `designUCap`, `overallHTCSource`
(`correlated` | `design-cap` | `user-override`) and `correlatedExcessPercent` are now on
every evaporator result, and the cap is overridable per design via `evaporatorDesignU`.

_Fouling_ — `foulingFactor` is now read by the sizing code, for the evaporator shell side and
the condenser/preheater tube side. The defect was worse than "the input does nothing": the
adapters injected **0.00015** while the sizing code hardcoded **0.00009**, and the
verification PDF printed the adapter's 0.00015 as "TEMA seawater standard" — a design basis
the numbers never used. 0.00015 is not a TEMA figure at all; TEMA seawater is 0.0005
hr·ft²·°F/Btu (**8.8e-5** SI) below 125 °F and 0.001 (1.76e-4) above, and MED effects run
35–70 °C.

Both now resolve to one shared `DEFAULT_SEAWATER_FOULING_M2KW = 0.00009` in
`packages/constants` — the same value `fallingFilmCalculator` has always used, so the MED
solver and the standalone calculator it wraps finally agree. **Default behaviour is
unchanged**, so no re-baseline was needed; the caution above did not apply once the defaults
were reconciled rather than switched.

The input is now live, and its magnitude is worth knowing: at the BARC geometry the
correlated U is **3,146 W/m²·K** at 0.00009 — 1.5% above the 3,100 cap, so the cap binds.
At 0.00015 it falls to **~2,650**, below the cap, so the cap stops binding and required area
rises ~17%. That is the real trade-off, and it is now the designer's to make explicitly
rather than something the code decided silently.

#### 8. The Seawater Salinity Terms Were Home-Grown, Not the Published Correlations

**Risk**: the property layer under every thermal calculator was internally self-consistent and
externally unanchored — the one failure mode findings 1 and 5 were supposed to have closed.

**Found by**: the dynamic-simulator session, cross-checking its own independent transcription
of Sharqawy et al. (2010) against this codebase — using the 90 °C cases that fixture v5 had
added days earlier. The disagreement did not exist inside the design envelope.

**Detail**: `getSeawaterEnthalpy` and `getSeawaterSpecificHeat` used a Millero-form pair
(`A·S + B·S^1.5`) with coefficients that appear in no cited source. They were a good-faith
reconstruction, and finding 1 had already corrected an exponent _within_ that reconstruction —
fixing the internal consistency of the wrong correlation. The published forms are **Eq. (43)**
for enthalpy (fitted to Bromley et al. 1970) and **Eq. (9)** for cp (Jamieson et al. 1969).

**Why it survived findings 1 and 5**: every test asserted either the IAPWS pure-water limit
(where the salinity term vanishes) or the `dh/dT ≈ cp` integral identity (which a
self-consistent home-grown pair satisfies _by construction_). The one property the tests
enforced hardest was the one property that could not detect the defect.

**The mechanism, and why the envelope mattered.** Fixture v6 makes it visible in one table —
same 35 g/kg feed, different flash widths:

| Case  | Flash | h_inlet     | h_outlet    | Vapour rate |
| ----- | ----- | ----------- | ----------- | ----------- |
| sw-01 | 9.5 K | −0.170%     | −0.181%     | **−0.137%** |
| sw-07 | 30 K  | **+0.149%** | **−0.132%** | **+0.707%** |

The salinity error **changes sign with temperature**. Over a short flash the inlet and outlet
errors are nearly equal and cancel in `h_in − h_out`; over 30 K they have opposite signs and
**add**. The vapour rate error is then larger than either enthalpy error. A grid covering only
the design envelope could not have found this, which is the argument for keeping sw-07 and
dm-03 permanently rather than until they pass.

The DM-water cases move by **0.000%** — the control that proves the change is confined to the
salinity term and the IF97 baseline from finding 5 is untouched.

**FIXED 2026-07-31.** Both salinity terms replaced with the published correlations, keeping the
IF97 pure-water baseline (Eq. 43 is written as `h_w + correction`, so this is its own
structure; for cp the salinity _difference_ is taken, since Jamieson's S = 0 limit is 4.1894
against IAPWS 4.1841). `getSeawaterEnthalpy` also narrows to Eq. (43)'s own **10–120 °C**
envelope while cp keeps Eq. (9)'s **0–180 °C** — the two no longer share one invented range.
That narrowing immediately surfaced four call sites asking for the enthalpy of a **zero-flow
stream** whose temperature defaults to 0 °C; they now go through one
`streamEnthalpyOrZero` helper, because evaluating a non-existent stream's enthalpy was the
error, not the range check that exposed it.

**A test invariant had to be given up, deliberately.** `dh/dT ≈ cp` was pinned at 0.15%. Eq.
(43) and Eq. (9) are independent fits to different datasets and disagree by up to **2.2%** at
120 g/kg / 90 °C — 0.43% inside the MED design envelope. The test now asserts a tight bound
where the plant runs, a 3% ceiling that still catches the 43% signature of finding 1, and
**brackets** the known gap from both sides, so it fails if the disagreement grows _or_ if
someone quietly re-derives one correlation from the other to make it vanish.

**Consequence for the simulator.** This codebase may use both because it uses cp only for
sensible duties and h only for stream enthalpies, never differentiating one to obtain the
other. **A dynamic energy balance cannot make that assumption** and should use the derivative
of Eq. (43), accepting a cp that is not Jamieson's — the opposite trade, and the reason the
two implementations should be expected to differ here rather than converge.

**Impact**: BARC GOR 9.82 → 9.83; effect temperatures unchanged to 0.01 K. Small here only
because BARC runs a narrow envelope.

**CONFIRMED by the simulator session, 2026-07-31.** Cross-checking their independent
transcription against v6:

| Metric                        | v5      | v6          |
| ----------------------------- | ------- | ----------- |
| sw-07 normalised residual     | 0.212%  | **0.0201%** |
| dm-03 (its pure-water twin)   | 0.0197% | 0.0197%     |
| sw-06 flow error              | −1.741% | **−0.300%** |
| worst absolute enthalpy error | +2.10%  | **−0.042%** |

sw-07 now sits on top of its pure-water twin, so nothing salinity-dependent remains in it.

**The residual that is left has a name and should stay.** It no longer trends with salinity —
0.002–0.003% across 0–115 g/kg at matched temperature — but does vary with temperature,
0.056%. A residual that depends on temperature and not salinity is a **pure-water baseline
difference**, which is exactly what it is: this codebase keeps IAPWS-IF97 and adds Eq. (43)'s
salinity correction, while the simulator uses Eq. (43) whole including Sharqawy's own `h_w`
polynomial, which is not IF97. **Neither side should change.** Adopting theirs here imports a
0.13% pure-water error to obtain the salt term; adopting ours there breaks their layer-1
agreement against the MIT published tables, which are generated from the library that uses
Sharqawy's `h_w`. It is permanent, understood, and an order of magnitude inside every gate.

**A second defect surfaced while landing this**, in `designPipeline.ts`. The plant electrical
summary computed `kWhPerM3` from **unrounded** power and net-distillate, then reported both
operands **rounded** — so the figure on the datasheet could not be reproduced from the other
two figures on the same datasheet, on every consumer row and on the total. The gap was
rounding-sized and had been sitting just inside the test tolerance; the GOR shift above pushed
it out. Operands are now rounded first and one reported denominator is shared by every row.
It is unrelated to the property work and was found only because a self-consistency assertion
existed — `totalKWhPerM3 ≈ totalPowerKW / netDistillateM3h` — which is the kind of test that
looks redundant until it isn't.

#### 9. Flash Chamber Evaluated BPE at the Feed Salinity, Not the Brine Leaving

**Risk**: the brine boiling point — and so the whole flash temperature — was understated in
proportion to how much the stream concentrated.

**Found by**: the dynamic-simulator session, **from the correlation coefficients this repo
published in fixture v7**. Three revisions of comparing outputs had left "BPE runs ~1% low"
open as an unexplained residual. Publishing `A` and `B` turned it into one script: their
coefficients reproduce ours to 0.003%, so the correlation was never the problem — and our
fixture BPE matched evaluation at the **feed** salinity to that same 0.003%, which is an
identification rather than a hypothesis.

**Detail**: `flashChamberCalculator.ts` computed `bpe = getBoilingPointElevation(feedSalinity,
satTempPure)` once, before solving. The brine leaving is more concentrated, and it is the
brine's salinity that sets its boiling point. The circularity was already recognised in that
function — it does a refinement pass for brine **enthalpy** at the outlet salinity — but BPE
was left out of the same pass.

**Magnitude**, reproduced here to 3-4 significant figures against their independent numbers:

| Case  | CF     | BPE shortfall | Brine T low by |
| ----- | ------ | ------------- | -------------- |
| sw-04 | 1.0025 | 0.28%         | 0.0016 K       |
| sw-06 | 1.0021 | 0.26%         | 0.0043 K       |
| sw-01 | 1.0160 | 1.73%         | 0.0059 K       |
| sw-07 | 1.0531 | 5.56%         | 0.0236 K       |
| sw-08 | 1.0483 | 5.63%         | **0.0713 K**   |

DM-water cases move 0.0000 K — the control.

**A rung-7 problem found at rung 1.** A flash chamber concentrates a few percent, so the error
stays small here. An MED effect runs CF 1.5-2.0, where the shortfall is **0.19 K** and
**0.42 K** — four times the simulator's gate before any compounding — and because BPE sets the
temperature cascade, it would propagate effect to effect rather than staying local. **The MED
engine was never affected**: `effectModel.ts` already evaluates BPE at
`seawaterSalinity × brineConcentrationFactor`. That is now pinned by a test with the two
candidate salinities far enough apart that it cannot pass by accident.

**FIXED 2026-07-31.** BPE joins brine enthalpy in a fixed-point iteration on brine salinity,
converged to 1e-9 relative. Four new anchor tests; all four fail against the old behaviour.

**Why 56 existing tests passed through it.** None asserted the brine temperature against an
independently computed BPE — they asserted structure, or the code's own prior output. Same
shape as finding 8.

**Two lessons, both general.**

1. **Publish coefficients, not just outputs.** An output diff tells you _whether_ two
   implementations differ; a transcription diff tells you _where_. This stayed open across
   three revisions under output comparison and closed in one script once the coefficients were
   visible. Worth doing in both directions — the same move would have caught finding 8 much
   sooner.
2. **A case added to widen coverage is worth more than the reason given for adding it.**
   `sw-08` was added as insurance against a _hypothetical future_ salinity-term divergence and
   paid for itself immediately on something unrelated. It is the only cell where a high
   concentration factor and a high BPE magnitude coincide, so it alone reached 71% of the gate
   while every other case stayed under 0.010 K.

---

## Action Items

### High (do first)

1. **Commit finding 1's fix** in `seawaterTables.ts`.
2. **Add the invariant test**: `dh/dT == cp` across S = 0–120,000 ppm, T = 20–100 °C. This is
   the check that would have caught it, and it needs no external data.
3. **Add a monotonicity test**: `h_sw` strictly decreasing in S at fixed T.
4. **Re-baseline the BARC golden profile** in `medEngine.test.ts`, per the test's own
   instructions, in the same commit with the reason.
5. **Decide the pure-water enthalpy baseline** (finding 5). The two liquid-enthalpy
   functions disagree with published IAPWS and with each other, and the seawater one changes
   sign at ~58–60 °C. Options, in preference order:
   - **Re-base `getSeawaterEnthalpy` on IAPWS** — `h_sw(S,T) = h_IAPWS(T) + Δh(S,T)` — so
     S = 0 is exact by construction and the salinity correction sits on top. Note this must
     be checked against the `dh/dT == cp` invariant from item 2; if the Sharqawy cp baseline
     also differs from IAPWS cp, both need rebasing together.
   - **Fix `getEnthalpyLiquid`** independently — it is the worse of the two and is the one
     callers will reach for expecting IAPWS.

   _Acceptance_: `getSeawaterEnthalpy(0,T)` within 0.02 kJ/kg of published h_f across
   30–80 °C, and the `dh/dT == cp` invariant still holds.

6. **Restate the rung-1 gate in the simulator spec** as ΔT-dependent, or gate on flash ΔT
   and enthalpy difference rather than absolute vapour flow. At 4.4 K flash ΔT the current
   0.5% flow tolerance implies 0.031% enthalpy agreement, which neither implementation
   carries. **This is a spec change, not a code change** — it belongs to the simulator
   session, and should follow item 5 so the gate is set against corrected properties.

### Medium — replace the NCG source with computed physics

7. **Wire `dissolvedGasContent()` into the MED path** for the air component. Compute
   O₂ + N₂ from **intake** temperature and salinity, convert once to a mass rate, and apply
   it as each effect's fresh feed flashes. Delete the air share of
   `TOTAL_DISSOLVED_GAS_MG_PER_LITRE`.
   _Acceptance_: air NCG ≈ 0.42 kg/h for the BARC feed (25,936 kg/h at 30 °C / 35 g/kg);
   **GOR must not move**, since NCG is still inert until item 14; the `extrapolated` flag is
   surfaced as a warning, not swallowed (rule 3).
8. **Carry NCG as a composition, not a lumped mass.** `dissolvedGasContent` already returns
   O₂ and N₂ separately; add CO₂ when item 9 lands. Both the vent carryover ratio (finding 3)
   and the partial-pressure penalty (finding 4) are **mole**-based, so a single mass cannot
   serve them.
   _Acceptance_: mean molar mass is computed from the composition, not assumed to be 28.97.
9. **CO₂ from bicarbonate — source before coding.** Needs feed total alkalinity as a plant
   input, the carbonate equilibrium (pK₁, pK₂ vs T and S), and decomposition kinetics with a
   residence-time dependence. **Cite the kinetics or stop** — do not fit a temperature curve
   from memory. Until sourced, hold the CO₂ term at its current lumped value and label it an
   assumption.
10. **Audit every other `getSeawaterDensity` call** in `lib/thermal` for the same kg/m³ vs
    kg/L confusion that caused this finding.
11. **Couple carrier steam to the NCG load** (finding 3), using the mixture molar mass from
    item 8, not `M_air`. Retain `CARRIER_STEAM_FRACTION` as a floor or sanity bound rather
    than the primary value. Depends on items 7 and 8.
12. **Check the final-condenser vent** (`VENT_FRACTION = 0.03`, a flat 3% of last-effect
    vapour) against the computed NCG arriving there.
13. **Regenerate** `docs/thermal/fixtures/flash-chamber-cases.json` (seawater cases only) and
    the SSOT stream records already written — both carry old enthalpies.

### Low / larger effort

14. **Model the NCG performance penalty** (finding 4). Largest item; real physics on the core
    solver. Depends on items 7 and 8 — the partial-pressure term is a mole fraction and
    cannot be computed from a lumped mass. Sequence:
    - Source the correlations first — Colburn–Hougen or equivalent, cited with paper and
      equation number. **Do not invent or approximate**; if a source cannot be cited, stop.
    - Add the NCG partial-pressure correction to effect saturation temperature.
    - Add the condensation HTC degradation term.
    - Re-run BARC and report GOR movement honestly. **If it lands short of closing the gap,
      the remainder stays documented as an unexplained bias rather than absorbed into a
      coefficient.**
    - Re-baseline the golden pins again if accepted.

---

## Lessons from the cross-session work

Recorded because both were mistakes in this session's own output, not in the code under
review.

1. **Prose contradicted the data beside it.** The v3 fixture's `gateGuidance` said sw-04's
   amplification factor was "near 30" while the `sensitivity` block in the same file
   computed **49.84**. A hand-written number sat next to a generated one and disagreed with
   it. The guidance text is now **computed from the cases** — minimum, maximum, and which
   case is worst — so it cannot drift again.

2. **A schema bump listed additions but not removals.** v3 added `sensitivity` and silently
   dropped `usableAsNumericalGate` and `crossover`. A consumer read one of them while
   building its parametrised case list at import time, so its test suite died at collection
   rather than failing with a message that explained the transition. Bumping the version and
   adding a `supersedes` note was not enough. The fixture now carries a `schemaChanges` block
   listing added **and** removed keys per version, with v3's removals recorded
   retrospectively.

The generalisation the simulator session drew is worth keeping alongside these: **a model
that takes any part of its state from the thing it is validated against has already agreed
with it.** They had initialised a saturated state from the fixture's brine temperature, and
because the saturation constraint is enforced through its derivative, the run sat 5 mK off
its own saturation line for its entire length while passing every gate.

---

## Open Decisions

1. ~~**NCG design basis — 19 ppm or 50 mg/L?**~~ **DECIDED 2026-07-29 — compute the physics,
   do not tune a constant.**
   The 19 ppm dissolved-air thumb rule is not the design basis, and neither is the lumped
   50 mg/L. Air is computed from Weiss (1970) solubility at intake conditions (item 7); CO₂
   from bicarbonate is real and must be included, computed from alkalinity and sourced
   kinetics rather than assumed (item 9).
   This supersedes two questions that no longer need answering: whether the constant means
   mg/L or ppm-by-mass, and why the cited CADAFE derivation (32 kg/h for a ~104 T/h plant)
   does not reconcile with 50 mg/L — it implies roughly 126 mg/L on a plausible feed basis.
   Computing the source term removes both.

2. **CO₂ kinetics — what temperature and residence-time dependence?** Bicarbonate
   decomposition is **kinetic, not a threshold**. The `> 60 °C` in the current docstring is a
   simplification; decomposition occurs below it, more slowly, and is never complete at MED
   temperatures. Two facts shape the answer:
   - **TBT can reach 70 °C** (confirmed 2026-07-29), so a design at the top of the range
     releases meaningfully more CO₂ than the BARC case at 55.5 °C. Release is front-loaded
     into effect 1 and the preheater train regardless of TBT, since later effects are cooler.
   - **Residence time matters as much as temperature.** MED contact times are short compared
     with an MSF brine heater, arguing for partial rather than complete decomposition even at
     70 °C.

   Literature to check: CO₂ release in MSF/MED distillers — Al-Rawajfeh, Glade & Ulrich
   published in this area in the early 2000s. **Treat that as a lead to verify, not a
   citation to build on.** Until a source is in hand, hold the CO₂ term as a labelled
   assumption (item 9).

3. **Feed alkalinity as an input.** CO₂ release scales with bicarbonate content, which varies
   by seawater source. The plant uses **antiscalant (Belgard EV 2050), not acid dosing**, so
   bicarbonate is not deliberately stripped upstream and there is **no deaerator or
   decarbonator** in the design — all dissolved gas enters with the feed. Alkalinity
   therefore becomes a required plant input, not a constant.

4. ~~**Re-baseline the BARC pins once or twice?**~~ **RESOLVED** — twice in the end, but the
   second was worth it: the first tracked findings 1 and 5, the second (finding 6) corrected
   the operating point itself and improved plant agreement.

5. **The residual +2.2% GOR gap.** Finding 6 reduced it from +6.7%, and finding 4 is closed,
   so this is no longer attributable to NCG. Candidates not yet examined: ambient heat loss
   (not modelled anywhere), steam quality below 1 at the TVC inlet, in-service versus clean
   fouling resistance, and whether the as-built 9.61 was measured at design conditions. At
   2.2% against a plant measurement this may simply be the noise floor — worth deciding
   whether to document it as a known bias rather than chase it.

6. ~~**BPE runs ~1% below the MIT library, cause unidentified.**~~ **RESOLVED — finding 9.**
   The correlation was right; the salinity argument was wrong. Publishing the coefficients is
   what closed it. Original note retained below for the method.

   ~~**BPE runs ~1% below the MIT library, cause unidentified.**~~ Inside the simulator's 0.1 K
   gate and untouched by finding 8, so not blocking. This implementation is Sharqawy Eq. (36),
   `BPE = A·S² + B·S` with S as **mass fraction**, `A = 17.95 + 0.2823·t − 4.584e-4·t²`,
   `B = 6.56 + 0.05267·t + 1.536e-4·t²`. Those coefficients are now published in the fixture's
   `knownLimitations.boilingPointElevation` so the comparison can be a **transcription diff
   rather than an output diff** — which is what would have caught finding 8 far sooner. Resolving
   it needs the paper or their source side by side; comparing outputs cannot say who is right.

7. **The high-salinity grid is still thin in temperature.** Fixture v7 adds sw-08 (90 g/kg at
   90 °C), giving 90 g/kg a 52–90 °C axis. 60 g/kg and 115 g/kg remain single-temperature, so a
   temperature-dependent salinity error at those concentrations still has nowhere to appear.
   Cheap to close if the grid is being regenerated anyway.

8. **Fouling basis for a 70 °C TBT design.** TEMA gives 1.76e-4 above 125 °F (52 °C), double
   the 8.8e-5 default now used. A design running TBT at 70 °C has its first effects above
   that threshold. Whether to apply a per-effect fouling resistance rather than one plant-wide
   value is a modelling decision, not a defect — the input now exists to express it either way.

---

## Notes

**Link to the dynamic simulator.** The [specification r2](../thermal/dynamic-simulator-specification-r2.md)
makes NCG inventory a state at **rung 3**, gated against `vacuumSystemCalculator`'s
evacuation curve — which is independent of the MED engine, so **that gate is unaffected**.

The MED effect gate at **rung 7** uses `medEngine` per-effect results as its reference. All
four findings change those numbers. Rung 7 is far enough out that this is not urgent, but
fixtures handed over for it must post-date this work.

Rung 0/1 fixtures are affected only by finding 1, and only for the seawater cases.

---

**Reviewer**: Claude (AI-assisted)
**Date**: 2026-07-29
**Next Review**: after findings 1 and 2 land
