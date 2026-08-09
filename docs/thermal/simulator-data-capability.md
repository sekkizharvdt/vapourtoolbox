# What Vapour Toolbox Can and Cannot Supply

**Revision 2** — 2026-08-03. Changes at the foot of the document.

**Purpose:** answer "can Toolbox give me X?" without a round trip through a human.

This exists because it didn't. Between 2026-07-29 and 2026-08-03 the dynamic-simulator
work asked for roughly a dozen quantities, and each answer required reading the source to
find out which of four things it was. Nobody could have known in advance. `.claude/MODULE_MAP.md`
answers _where the code lives_; this answers _what the code knows_.

**If you are the simulator session:** read this first. If a quantity is `ABSENT` or
`PLACEHOLDER`, don't ask for it — the entry says what would have to be built. If it's
`ASSUMED`, take it, but never let a conclusion rest on its particular magnitude.

---

## Status vocabulary

| Status          | Meaning                                                                                                                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **COMPUTED**    | Derived from geometry or a published correlation rather than invented. **Not a claim of correctness.** Cross-checkable — but against a second implementation, not a reference. Order evidence as published tables, then an independent source, then agreement between the two codebases |
| **ASSUMED**     | A stated working value with no calculation behind it. Usable, but no conclusion may rest on its size.                                                                                                                                                                                   |
| **PLACEHOLDER** | A rule of thumb standing in front of data we already hold. Not usable. The fix is wiring, not sourcing.                                                                                                                                                                                 |
| **ABSENT**      | Does not exist. The entry says what would have to be built.                                                                                                                                                                                                                             |

The distinction between the last two matters: a `PLACEHOLDER` is a derivation nobody has
needed; an `ABSENT` quantity is blocked on a model that doesn't exist.

**COMPUTED does not mean right.** The BPE-at-feed defect was COMPUTED and wrong through
eight fixture revisions; the seawater enthalpy correlation was COMPUTED and its cited paper
was not its source. The status says where a number came from, not whether it is true.

**The `Exported?` column is separate from status on purpose.** A quantity can be COMPUTED
and unreachable — `dissolvedGasContent` exists but is not exported, and the flash chamber
computes elevations that no SSOT generator emits. Reading COMPUTED as "available" is a
planning error, so availability is stated on its own.

---

## Flash chamber (`flashChamberCalculator.ts`)

| Quantity                                     | Exported? | Status   | Notes                                                                    |
| -------------------------------------------- | --------- | -------- | ------------------------------------------------------------------------ |
| Vapour / brine flow, temperature, enthalpy   | yes       | COMPUTED | Fixed point on brine salinity, converged 1e-9                            |
| BPE                                          | yes       | COMPUTED | At the **outlet** salinity, not the feed — this was a defect until v8    |
| Chamber diameter, zone heights               | yes       | COMPUTED | Souders-Brown + retention time                                           |
| Elevations (BTL, LG-L, operating, LG-H, TTL) | yes       | COMPUTED | Full set                                                                 |
| Retention / liquid volume                    | yes       | COMPUTED | From retention time and diameter                                         |
| Nozzle sizes, NPSHa                          | yes       | COMPUTED | Velocity-based                                                           |
| NPSHa margin over pump NPSHr                 | yes       | COMPUTED | **Only when `pumpNPSHr` is supplied.** See _NPSHa adequacy_ below        |
| Inlet pressure                               | yes       | COMPUTED | Chamber + spray-nozzle ΔP; default 3 bar                                 |
| Suction friction loss                        | yes       | ASSUMED  | Flat 0.5 m default, settable. NOT from a pipe run — see below            |
| Wall thickness                               | yes       | ASSUMED  | 6 mm SS 316L. No buckling check exists — see _Vessel metalwork_ below    |
| Metal mass (pressure envelope)               | yes       | ASSUMED  | Shell + 2 heads from geometry at the assumed wall. See below             |
| Wall heat capacity `M·c`                     | yes       | ASSUMED  | Published with the mass; inherits the thickness assumption               |
| SSOT export                                  | yes       | COMPUTED | Generator + UI shipped. Streams, equipment and lines, incl. holdup drums |

### NPSHa adequacy — read before consuming a margin or a verdict

`NPSHaCalculation` reports `margin` and `isAdequate` **only when a `pumpNPSHr`
was supplied**. Absent means "no pump was named", not "no margin" — do not read
a missing value as zero, and do not read a missing `isAdequate` as a pass.

The verdict is taken at **LG-L**, the lowest level, not at the operating level.
A vessel that only satisfies its pump at normal level cavitates every time the
level controller draws it down, so an operating-level verdict would pass
vessels that fail in service.

**The safety margin is case dependent — ruled 2026-08-07.** The three values in
this repo are not three candidates for a house standard, and they are not being
unified:

| Value | Where                                                        | Why it differs                                                                      |
| ----- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 0.5 m | `suctionSystemCalculator`, `SuctionSystemInput.safetyMargin` | Friction there is a real Darcy-Weisbach calculation, so less allowance for unknowns |
| ~1 m  | The stated working rule ("calculate NPSHa, add say 1 m")     | Rule of thumb                                                                       |
| 1.5 m | `flashChamberCalculator`, `recommendedNpshMargin` — fallback | Friction here is a flat estimate, an argument for more allowance                    |

What margin a vessel needs depends on the service, the pump, how well the
suction friction is known, and how far the level swings in operation. **The
calculator therefore does not choose — it presents.** `npshSafetyMargin` is an
explicit input, the value a verdict was taken against is echoed in the result so
it can be attributed, and the flash chamber page renders the verdict at each
reference margin against the vessel in hand together with the elevation change
that would carry a failing one.

For a consumer: never infer a margin. Read `npshSafetyMargin` from the result,
or treat `isAdequate` as meaningless.

### Flash chamber metal mass — a floor, at an assumed thickness

`chamberSizing.metalMass` (fixture **v10**) is the **pressure envelope only**: cylindrical
shell plus two 2:1 SE dished heads, computed from the diameter and tangent-to-tangent height
the calculator already produces. It carries the density and specific heat used, the heat
capacity product, and what it leaves out.

Two things a consumer must not do with it:

- **Do not treat it as a design mass.** The geometry is real; the 6 mm wall is not calculated.
  This repo performs no external-pressure buckling check (ASME VIII Div 1 UG-28), which is
  what actually sets plate on a vacuum vessel. `wallThicknessSource: "assumed"` travels with
  every value and is asserted by test. A mass derived from an assumed thickness is an assumed
  mass.
- **Do not treat it as a total.** It excludes the support skirt (thermally remote from the
  contents), nozzles, flanges, reinforcing pads, stiffening rings — which a vacuum vessel
  usually needs and this repo does not size — internals, insulation and cladding. It is a
  **floor** for wall thermal mass.

`shellKg + dishedHeadsKg == totalKg` exactly, and `heatCapacityJPerK == totalKg ×
specificHeatJPerKgK` exactly, at the published precision. Both are asserted on the artifact:
components published to a different precision than the total they claim to sum to is a
relation a consumer cannot reproduce.

### Suction friction — an estimate, not a hydraulic calculation

The flash chamber's NPSHa carries a flat **0.5 m** friction term by default
(`DEFAULT_SUCTION_FRICTION_LOSS`). It is not derived from a pipe run — the
calculator has no pipe run. NPSHa is **linear** in it, so it moves the margin
metre for metre. `suctionSystemCalculator` computes the real equivalent from
Darcy-Weisbach plus K-factors over the actual geometry; where the pipe run is
known, that number should be passed in as `suctionFrictionLoss` instead.

---

## MED designer (`med/`)

| Quantity                                               | Status          | Notes                                                                                                                                                     |
| ------------------------------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-effect temperature, vapour/brine flow, salinity    | COMPUTED        | Anchored to the BARC as-built plant                                                                                                                       |
| Effect areas, U (correlated **and** design cap)        | COMPUTED        | Both reported, with which one was used                                                                                                                    |
| BPE per effect                                         | COMPUTED        | At `seawaterSalinity x brineConcentrationFactor` — the concentrated brine                                                                                 |
| Tube geometry (OD, wall, length, count, pitch, layout) | COMPUTED        | Effects, condenser and preheaters                                                                                                                         |
| Shell OD / length                                      | COMPUTED        | All three equipment types                                                                                                                                 |
| Condenser duty, LMTD, U, area, passes, velocity        | COMPUTED        |                                                                                                                                                           |
| Effect metal mass                                      | PLACEHOLDER     | See _Metal mass_ below — the total is not what a thermal model wants                                                                                      |
| **Condenser metal mass**                               | **PLACEHOLDER** | `area x 50 kg/m²`, assuming titanium. **Full geometry is available** — this is a derivation nobody has needed                                             |
| **Preheater metal mass**                               | **PLACEHOLDER** | `area x 60 kg/m²`. Same — geometry is available                                                                                                           |
| **Liquid holdup**                                      | **ABSENT**      | No liquid inventory model. The `shellVolume x 0.3` in the weight estimator is a **shipping-weight fill allowance**, not an operating level. Do not use it |
| **Elevation**                                          | **ABSENT**      | Not modelled for MED equipment                                                                                                                            |

**Holdup and elevation for the brine and distillate drums are the exception.**
They are not MED-designer outputs at all — those two vessels are sized in the
flash chamber calculator, which does compute an operating holdup and a full
elevation set, and exported through its own SSOT generator under
`source: 'FLASH_CHAMBER'`. Generate each drum with its own equipment tag: sync
matches on a key built from the tag, so two drums sharing the default tag would
overwrite each other rather than co-exist. The ABSENT rows above still stand for
effects, condenser and preheaters.

| **Wetted / dry wall area** | **ABSENT** | Blocked on the liquid level above — an input that cannot exist, not merely unbuilt |

---

## Metal mass — read before consuming `metalMassKg`

`estimateShellWeight()` runs **once per evaporator effect and nowhere else**. It returns:

| Component    | Basis                   | Belongs in a lumped wall?    |
| ------------ | ----------------------- | ---------------------------- |
| shell        | geometry                | yes                          |
| dished heads | geometry                | yes                          |
| tubesheets   | geometry                | yes                          |
| tubes        | geometry                | **no** — see the note below  |
| water boxes  | **15% of shell weight** | no — steam-side end chambers |
| internals    | **10% of shell weight** | no — an allowance, not parts |

The column asks whether a component belongs in a **lumped wall**, not whether it touches the
brine. Those differ for the tube bundle: the tubes are wetted on the outside, but from rung 5
the model treats tube-side heat transfer explicitly, so a consumer who folds tubes into a
lumped wall **double-counts them**. "In contact with the brine" was the previous heading and
answered a question no thermal model asks.

Two traps:

- **`metalMassKg` is the sum of all six.** It is a shipping and costing figure. A thermal
  model should select components from `metalMassDerivation`, not take the total or discount
  it by an invented factor.
- **"Water box" is inherited shell-and-tube terminology, not a description.** On a MED
  effect the tube side carries condensing _steam_, so those end chambers are steam chests.
  There is no cooling water in a MED effect. Genuine water boxes exist on the **condenser**,
  which has no breakdown at all.

**Shell density is hardcoded to duplex** (`DENSITY.duplex_ss` = 7,800 kg/m³) for shell, heads
and tubesheets, regardless of the material selected. With 316L specified (8,000 kg/m³) an
independent recomputation reads **+2.56% on shell, heads and tubesheets**. This is **not** being reconciled: the simulator
recomputes mass from `thickness x area x rho(named material)`, so the two figures _will_
disagree for any non-duplex vessel. **That divergence is the check working.** Neither side
reconciles toward the other, and the two must never be averaged. The figure is stated as
**+2.56%** rather than as "the two disagree" for a practical reason: a maintainer who meets
"these two masses differ" investigates, and one who meets +2.56% recognises it.

---

## Vessel metalwork

| Quantity             | Status      | Notes                                                                                                                                                                                                                                                                             |
| -------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wall thickness       | **ASSUMED** | **SS 316L, 6 mm** (agreed 2026-08-03, pending data). The 8 mm appearing in `weightEstimation.ts` is a **default function argument** (`estimatePlantWeight(result, shellThkMM = 8, ...)`), never a design output. These are not competing values and there is nothing to reconcile |
| Material             | COMPUTED    | A specification, not an assumption — it is a real project decision                                                                                                                                                                                                                |
| Density              | COMPUTED    | `METAL_PROPERTIES`, ten grades                                                                                                                                                                                                                                                    |
| Specific heat        | ASSUMED     | Datasheet convention, quoted over **0–100 °C**. `specificHeatBasis` marks it `mill-datasheet-conventional`, never `sourced`, until a citation lands                                                                                                                               |
| `c(T)`               | **ABSENT**  | Deliberately not fitted. A curve through band-averaged datasheet values manufactures precision the data does not carry. **The reason it blocks nothing expires at rung 5** — see below                                                                                            |
| Thermal conductivity | COMPUTED    | `METAL_PROPERTIES`; `MED_TUBE_CONDUCTIVITY` derives from it                                                                                                                                                                                                                       |
| Fixture export       | COMPUTED    | `docs/thermal/fixtures/metal-properties.json` v1 — all ten grades, the vessel assumption, and the shell-mass divergence per grade                                                                                                                                                 |

**`metal-properties.json` is reference data, not a gate.** The other three fixtures publish
calculator output, where a disagreement is a defect on one side. If the simulator's handbook
gives a different specific heat for 316L, neither side is wrong — they are quoting different
sources. What the fixture publishes is the value **and how firm it is**, so a consumer can
decide whether to adopt it. The one hard expectation in it is `shellMassDivergence`, which is
the +2.56% relation above, published per grade.

Wall thickness on a vacuum vessel is set by **external-pressure buckling (ASME VIII Div 1
UG-28)**, plus corrosion allowance and minimum practical plate. This repo performs none of
that. For a **built** plant the real answer is the plate variant actually purchased, which
lives in the procurement material master — a genuine source, once a project has one.

---

## Vacuum system (`vacuumSystemCalculator.ts`)

| Quantity                           | Status     | Notes                                                                                                                                                                                                                                                 |
| ---------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LRVP capacity curve `S(P)`         | COMPUTED   | Closed form, published with constants. Reaches **exactly zero** at blank-off                                                                                                                                                                          |
| Evacuation / pull-down curve       | COMPUTED   | 20 log-spaced steps, `V dP/dt = -S(P)P`                                                                                                                                                                                                               |
| Vent-gas temperature               | COMPUTED   | `min(tSat(P_suction), T_coolant + 2)`. Published relation, both branches documented                                                                                                                                                                   |
| NCG load                           | COMPUTED   | Manual / HEI leakage / seawater dissolved gas / combined                                                                                                                                                                                              |
| Dissolved gas in feed              | COMPUTED   | `dissolvedGasContent(tempC, salinityGkg)` — exists, not yet exported                                                                                                                                                                                  |
| Inter-condensers                   | COMPUTED   | Ejector trains only. An `lrvp_only` train has **none**                                                                                                                                                                                                |
| **Ejector capacity curve**         | **ABSENT** | Cannot be produced honestly. `sizeEjectorStage` gives a point, not a curve; inverting it yields a capacity that never reaches zero. Needs HEI 2647 air-equivalent curves or manufacturer data                                                         |
| **Ambient heat loss / insulation** | **ABSENT** | No heat-loss model anywhere, and no insulation material, thickness or conductivity is recorded. Vessels are understood to be insulated; that is an **untagged assumption** and is **not** grounds for setting `ua_to_ambient` to zero in a run report |
| **Pull-down with liquid present**  | **ABSENT** | The integration treats the vessel as a single compressible gas. Fixtures describe an **empty** vessel                                                                                                                                                 |

---

## Seawater and steam properties (`@vapour/constants`)

| Quantity                         | Status   | Source                                                      |
| -------------------------------- | -------- | ----------------------------------------------------------- |
| Enthalpy (salinity term)         | COMPUTED | Sharqawy et al. (2010) **Eq. 43**, 10–120 °C, 0–120 g/kg    |
| Specific heat (salinity term)    | COMPUTED | Sharqawy **Eq. 9** (Jamieson), 0–180 °C                     |
| Boiling point elevation          | COMPUTED | Sharqawy **Eq. 36**                                         |
| Pure-water baseline              | COMPUTED | **IAPWS-IF97 Region 1** — deliberately not Sharqawy's `h_w` |
| Density, viscosity, conductivity | COMPUTED | Sharqawy correlations                                       |

`h` and `cp` are **not an integral pair** — independent fits to different datasets, disagreeing
up to ~2.2% on `dh/dT` vs `cp` at 120 g/kg / 90 °C. Fine here, because cp is used only for
sensible duties and h only for stream enthalpies. **A dynamic energy balance cannot make that
assumption** and should differentiate Eq. 43 instead, accepting a cp that is not Jamieson's.

The IF97 pure-water baseline produces a permanent ~0.02–0.06% difference against an
implementation using Sharqawy's `h_w`. It varies with temperature and not salinity. **Neither
side should change.**

---

## Standing decisions — do not re-litigate

1. **No ejector S(P)** until HEI 2647 or manufacturer data arrives. A curve whose capacity
   never reaches zero would let a pull-down reach any vacuum given time and pass its own gate.
2. **No `c(T)` fit** from band-averaged datasheet values.
3. **No liquid holdup for MED** from the 30% shipping allowance.
4. **Duplex-density divergence is expected, not tolerated.** Never averaged, never reconciled.
5. **Wall thickness is 6 mm SS 316L and is an assumption.** Not a design value.
6. **A binding vent-gas saturation ceiling is an infeasible design point**, not a load. The
   calculator throws rather than clamping.

---

## What would unblock what

| To get                           | Build                                                                                                                              | Blocks                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Condenser / preheater metal mass | Call `estimateShellWeight` with geometry already on the objects; fix the duplex density hardcode. **Moves BOM and cost estimates** | rung 5                                        |
| MED liquid holdup, wetted area   | A liquid inventory model for MED effects — does not exist                                                                          | rung 5+                                       |
| Flash chamber in the SSOT        | A flash-chamber → SSOT generator                                                                                                   | rung 5                                        |
| Ejector pull-down                | HEI 2647 air-equivalent curves or manufacturer performance data                                                                    | rung 5                                        |
| Wall thickness as a design value | ASME VIII Div 1 UG-28 external-pressure calculation, or a project BOM                                                              | firm metal mass                               |
| Sourced metal specific heats     | A named reference document                                                                                                         | nothing today — but see the expiry note below |

---

## Keeping this honest

Update it in the **same change** that moves a status. The failure this document exists to
prevent is a stale claim read as current — which is the same failure as a clamp read as
physics, an assumption read as a citation, and a field name read as self-describing. Those
cost three findings between them.

---

## The cp-accuracy reason expires at rung 5

The "<1% of total heat capacity" figure justifying an unsourced specific heat is a **flash
drum** number: 1.5 t of wall against 4.2 t of brine. On a **MED effect** the ratio inverts —
a tube bundle under a thin falling film — so a 5% error in `c` stops being negligible. The
conclusion "blocks nothing today" is correct; the reason given for it does not carry to
rung 5, and a sourced value will be needed before effect startup transients mean anything.

---

## Revision history

**r2 — 2026-08-03.** Eight corrections from the simulator session's review, after they cloned
this repo read-only:

1. `COMPUTED` no longer says "safe to gate against". It means derived rather than invented,
   and is **not** a claim of correctness — the BPE-at-feed defect was COMPUTED and wrong
   through eight fixture revisions. The old wording inverted the evidence ordering in the
   definition every other entry hangs off.
2. Added an `Exported?` column. COMPUTED-but-unreachable was being read as available.
3. Wall thickness: the 8 mm is a default function argument, not a competing design value.
   Calling it "not reconciled" invited someone to reconcile nothing.
4. Duplex divergence stated as **+2.56%** rather than as a fact of disagreement.
5. Removed "so the term is small" from the insulation row — a conclusion resting on an
   untagged assumption, inside a row marked ABSENT, and the sentence that would have
   justified leaving `ua_to_ambient` at zero.
6. The metal-mass column now asks "belongs in a lumped wall?" rather than "in contact with
   the brine?". Tubes are wetted outside but modelled explicitly from rung 5, so including
   them in a lumped wall double-counts.
7. Flagged that the cp-accuracy justification is flash-drum specific and expires at rung 5.
8. Added this revision stamp. A document opening with "read this first" and carrying no
   revision marker is the stale-claim failure named in its own closing section.

**r1 — 2026-08-03.** First issue.
