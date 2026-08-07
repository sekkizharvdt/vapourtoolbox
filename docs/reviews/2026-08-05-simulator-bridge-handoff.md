# Dynamic Simulator Bridge — Work in Progress Handoff

**Date:** 2026-08-05 (updated 2026-08-06)
**Status:** IN PROGRESS — items 1 and 2 complete (`3ac69909`, `16802df0`, + the SSOT dialog below); items 3–6 pending, **all four open decisions now made** (2026-08-06 — see [Decisions](#decisions-made))
**Origin:** Written to survive a change of work environment. This session ran a long collaboration between Vapour Toolbox and the external dynamic simulator project, and most of the context lives in the conversation rather than in the repo. This doc is the cold-start replacement.
**Scope:** `apps/web/src/lib/thermal/` (flash chamber, MED, condenser sizing), `apps/web/src/lib/ssot/`, `packages/constants/src/thermal/`, `docs/thermal/fixtures/`

---

## Read this first — the load-bearing context

These were **untracked** when this document was written, and are committed alongside it. They are the highest-value context in the repo — nothing else here is actionable without the specification, so they were brought into git rather than left to a manual copy:

| Path                                                 | Lines | What it is                                                                                                                                  |
| ---------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/thermal/dynamic-simulator-specification-r2.md` | 1,063 | **The simulator specification, current revision.** Section 7.1/7.2 are the property and flash-chamber gates the fixtures are built against. |
| `docs/thermal/dynamic-simulator-specification.md`    | 1,013 | r1, superseded — keep for the diff                                                                                                          |
| `docs/thermal/dynamic-simulator-CLAUDE-r2.md`        | 284   | Working agreement for the simulator-side agent, current revision                                                                            |
| `docs/thermal/dynamic-simulator-CLAUDE.md`           | 275   | r1, superseded                                                                                                                              |
| `.claude/settings.json`                              | —     | Project permission allowlist (111 rules)                                                                                                    |

**Start with the r2 specification.** The r1 copies are kept only so the revision can be diffed; if the two ever disagree, r2 wins.

`.claude/settings.local.json` is deliberately **not** carried over — it is machine-local and 37% dead rules. See [Environment notes](#environment-notes).

---

## What this work is

An external project (`sekkizharvdt/vapourdynamics`, private, Python) is building a dynamic MED simulator. Vapour Toolbox is the **reference implementation**: it publishes versioned JSON fixtures the simulator gates its physics against. Messages between the two agent sessions are relayed by the user via screenshots — there is no direct repo access in either direction.

The simulator advances through a "rung ladder", each rung gated on the previous:

| Rung      | Subject                               | Toolbox artifact                                        |
| --------- | ------------------------------------- | ------------------------------------------------------- |
| 0         | Fluid properties                      | `flash-chamber-cases.json` (property block)             |
| 1         | Flash chamber, pressure prescribed    | `flash-chamber-cases.json`                              |
| 2         | Vapour balance                        | —                                                       |
| 3         | NCG inventory + pull-down             | `vacuum-system-cases.json`                              |
| 4 / 4b    | Metal thermal mass / ambient loss     | **pending** — see item 3, item 4                        |
| 5         | Condenser + whole-plant assembly      | `condenser-cases.json`, and the SSOT registers (item 2) |
| 6 / 7 / 8 | Level control, one effect, full train | —                                                       |

**Published artifact state as of this doc:**

| Fixture                                          | Version | Cases                   |
| ------------------------------------------------ | ------- | ----------------------- |
| `docs/thermal/fixtures/flash-chamber-cases.json` | **v9**  | 11                      |
| `docs/thermal/fixtures/condenser-cases.json`     | **v5**  | 7                       |
| `docs/thermal/fixtures/vacuum-system-cases.json` | v3      | 5 evacuation cases      |
| `docs/thermal/fixtures/metal-properties.json`    | **v1**  | 10 grades — NEW, unsent |

Flash chamber **v9 has not been sent to the simulator yet**. It is additive only (`nozzles[].dn`); every other value is byte-identical to v8, so it needs no re-run if they gate on temperatures, flows or geometry. Batch it with the next send.

The capability register — what the toolbox can and cannot supply, marked COMPUTED / ASSUMED / PLACEHOLDER / ABSENT — is [`docs/thermal/simulator-data-capability.md`](../thermal/simulator-data-capability.md). **Keep it current; it is what stops the back-and-forth.**

---

## Shipped this session

| Commit     | What                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| `a9946ec7` | Renamed `MEDDesignerInput.steamFlow` → `steamFlowTPerH` (closed a 1000× units trap at the type level) |
| `806961cc` | Condensing exchangers size to a fixed point, not one pass — `Q = U·A·ΔT` was failing by 4–27%         |
| `61a91697` | Dependency override ranges for three advisories                                                       |
| `a2a4eb08` | Condenser duty composition + real tube constants published                                            |
| `3ac69909` | **Item 1** — condenser fixture v5: publish the sizing configuration the HTC was computed at           |
| `16802df0` | **Item 2** — flash chamber → SSOT generator (data path)                                               |

---

## Pending work

### ~~Item 2 (completion) — Flash chamber SSOT UI~~ ✅ DONE 2026-08-06

The generator and sync were done and tested but unreachable; there is now a **Generate SSOT** button on the flash chamber page.

The MED-specific dialog was **made source-agnostic and moved**, not copied (rule 32):

| Path                                                                     | Change                                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/components/ssot/GenerateSSOTDialog.tsx`                    | **new home** — shared by both calculators                                                                          |
| `app/thermal/calculators/med-designer/components/GenerateSSOTDialog.tsx` | deleted                                                                                                            |
| `apps/web/src/lib/ssot/generatorHelpers.ts`                              | `LINE_MATERIAL_OPTIONS` moved here (both generators and the dialog need it); re-exported from `medDesignGenerator` |

**The contract.** The dialog no longer knows about MED. The caller supplies:

- `source` (`'MED_DESIGN'` \| `'FLASH_CHAMBER'`) — stamped on the records, and what scopes the sync's merge
- `generate(options) => SSOTGeneration` — a **pure** mapping, `null` while the calculator has no result
- `materialServices` — which fluid services to offer a pipe material for (MED: all; flash chamber: its liquid + steam)
- `identity` — optional tag/name fields

⚠ **`generate` must be memoised by the caller.** The dialog resets its state when that identity changes — that is how rule 14b is satisfied without a result prop to watch — so an inline arrow would reset the dialog on every render. Both call sites use `useMemo` on their result.

**Why `identity` exists** (not decoration): sync matches on `provenance.generatedKey`, which is built from the equipment tag. Two flash chambers generated into one project under the default `FC-01` would silently _update each other_ instead of co-existing. This is exactly the item 3 case — a brine holdup drum and a distillate holdup drum in one project — so the tag had to become settable before those vessels could be generated at all.

Verified: `tsc --noEmit` clean, 245 SSOT tests pass, scoped lint clean, `check-ui-standards` passes with no ratchet movement.

---

### Item 3 — MED brine + distillate holdup vessels ✅ APPROACH APPROVED, NOT STARTED

The user's framing: _"The holdup volume for brine and distillate is essentially a flash chamber without heat transfer. The last effect brine will fall into the flash chamber and the elevations are maintained based on NPSH of pump plus margins. Similar for the distillate from the condenser."_

And on NPSH: _"NPSHr is the pump requirement and NPSHa is the process availability. NPSHr will come from the pump datasheet. We need to calculate NPSHa, add say 1 m of height to it and ensure NPSHr is less than the height considered."_

**The blocker found by `/check-duplicates` (rule 32):** there are already **two** NPSHa implementations with a byte-identical core formula, `npsha = staticHead + pressureHead − vaporPressureHead − frictionLoss`:

|          | [`flashChamberCalculator.ts:900`](../../apps/web/src/lib/thermal/flashChamberCalculator.ts#L900) | [`suctionSystemCalculator.ts:818`](../../apps/web/src/lib/thermal/suctionSystemCalculator.ts#L818) |
| -------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Sweeps   | 3 levels (LG-L / operating / LG-H)                                                               | 2 strainer conditions (clean / dirty)                                                              |
| Friction | **hardcoded `ESTIMATED_FRICTION_LOSS = 0.5` m**                                                  | Darcy-Weisbach + K-factors over the real pipe run                                                  |
| NPSHr    | not an input; only a recommendation string                                                       | real input, `margin = npsha − NPSHr`, `isAdequate`                                                 |

`suctionSystemCalculator` already does exactly what the user described. Building holdup vessels on the flash chamber's version would create a **third** path and inherit the 0.5 m guess.

**Approved 2026-08-06:** extract one `computeNPSHa()` primitive both callers use; each keeps its own sweep dimension and supplies its own friction; the flash chamber's 0.5 m becomes an explicit optional input instead of a hidden default. This is the first step of item 3 — do it before the vessels, not alongside them.

**Also note:** "holdup" currently names three different quantities — vessel retention volume (m³, flash chamber), standpipe holdup for VFD control (**litres**, suction system), pipe fill volume (litres, siphon). Any consolidation must not merge these.

Reusable private functions in `flashChamberCalculator.ts` if the vessels are built there: `calculateChamberSize` (~L663), `calculateElevations` (~L293), `calculateNPSHa` (~L900).

**Payoff:** moves `liquidHoldupM3` / `elevationM` from ABSENT to COMPUTED for those two vessels, which is what rung 5 whole-plant assembly needs.

---

### ~~Item 4 — Metal properties fixture~~ ✅ DONE 2026-08-07

`docs/thermal/fixtures/metal-properties.json` **v1**, 10 grades, from
[`metalPropertiesFixtures.gen.ts`](../../apps/web/src/lib/thermal/__generators__/metalPropertiesFixtures.gen.ts) — same generator + reproducibility-test pattern as the other three.

**It is explicitly NOT a gate,** and says so in `gateGuidance.thisIsNotAGate`. The other fixtures publish calculator output, where a disagreement is a defect on one side; this one publishes reference data, where a different handbook value means the two sides are quoting different sources. What it publishes is the value **and how firm it is**. The check it can genuinely catch is unit handling — a J vs kJ factor of 1000 — so it carries `volumetricHeatCapacityJPerM3K` and a worked heat capacity for 1 t of the assumed material to check against.

Carried as required:

- `specificHeatBasis: 'mill-datasheet-conventional'` on every grade, `'sourced'` on none — with a test that fails if one is ever promoted without a citation
- **the shell-mass divergence per grade**, as an expected value: `rho(named) / 7800 − 1`, where 7,800 kg/m³ is `DENSITY.duplex_ss` hardcoded in `weightEstimation.ts` for shell, heads and tubesheets regardless of specified material. 316L reproduces the **+2.56%** already relayed. A test pins that figure so a density edit cannot silently move a number the simulator session has been told.
- **no c(T) fit**, with a test asserting none appears

⚠ Two corrections to what this section previously said:

1. The **8 mm is not a competing value.** It is a default function argument in `estimatePlantWeight(result, shellThkMM = 8, ...)`, never a design output — the capability register already had this right. There is nothing to reconcile with the 6 mm assumption; the fixture states both and says so. 6 mm remains an unsourced working assumption and is labelled `status: 'ASSUMED'`, with a test that fails if the label is dropped.
2. The divergence is against the **weight estimator's** duplex figure (7,800, UNS S32304), **not** `METAL_PROPERTIES.duplex_2205` (7,805, UNS S32205). Two different duplex grades; substituting one changes the published ratio.

**Not done:** the root `package.json` needs `"fixtures:metal-properties"` alongside its three siblings. That file was being edited in another session, so the generator's header carries the raw command and the line to add.

---

### Item 5 — Condenser / preheater metal mass from geometry

Today the weight estimate uses areal allowances: condenser `area × 50 kg/m²`, preheaters `× 60`. The user's objection stands: _"Condenser tube geometry and layout is known. Material of construction is known too."_

Replace with a geometric calculation. **This moves BOM and cost numbers — show the deltas before committing.**

Two known traps, both documented in `packages/types/src/ssot.ts` around `metalMassKg`:

1. The total is a **shipping and costing** figure, wrong for a thermal model: water boxes sit on the coolant side, outside the wall the process fluid touches.
2. Water boxes and internals are **percentage allowances** (15% / 10%) on shell weight, not computed parts.

Also pending in the same area: the **preheater sizing/selection split**. The preheater composer in `resultAdapter.ts` has the same defect item 1 fixed for the condenser (heat-transfer numbers from one configuration, tube counts from another). It was deliberately left alone with a code comment because no fixture publishes preheater heat transfer yet — **fix it in the same change that does, not before.**

---

### Item 6 — Record the cross-cutting learnings

Not started. Five methodology rules emerged repeatedly and were proposed for CLAUDE.md; the user asked for them to be recorded and they have not been:

1. **An invariant a defect satisfies automatically is not evidence.** 1,233 thermal tests passed while the seawater enthalpy correlation was wrong, because the IAPWS pins probe only the S = 0 limit where the salinity term vanishes, and a self-consistent home-grown pair satisfies the integral identity by construction.
2. **Publish the relation, not the number; components, not totals.** Publishing two film coefficients let the simulator _see_ a U disagreement; only the resistance-network constants let anyone _attribute_ it.
3. **A guard published as physics is worse than a wrong number.** A clamp or floor that reaches a fixture reads as a physical result.
4. **Two data points identify a rule but do not distinguish it.** Two cases fixed the seawater-rise rule and hid that it was a settable input, not a constant.
5. **A field name is a claim about what a number is.** This session alone: `steamFlow` vs `steamFlowTPerH` (1000×), `tubeVelocity` sized-vs-selected (2×), `liquidHoldupVolume` retention-vs-operating (93%), `nps` inches vs `dn` mm (25×).

Add a sixth from item 1: **a value rounded for display is not the value the model was computed at.** `tubeVelocity` was rounded to 2 dp _in the compute layer_; since h ∝ v^0.8 that put 0.6% into any downstream reproduction — 25× the next largest publication error.

**Where:** these are review/methodology rules, not code rules. Either a new CLAUDE.md section or a standalone `docs/development/` doc — the user has not chosen.

---

### Parked (do not start without new input)

- **Ejector capacity curve** — needs HEI 2647 or manufacturer data. The user was explicit: **do not fabricate one.** The LRVP curve was supplied and is in `equipmentSizing.ts` (`lrvpCapacityFraction`, `LRVP_RATING_*`, `LRVP_OPEN_SUCTION_CAP`).
- **Fixture reproducibility tests are partly tautological.** Each `*.reproducible.test.ts` imports its `*.gen.ts`, whose top-level `it()` **writes the fixture**, and then compares against the file it just wrote. It proves the serialiser is deterministic; it cannot detect a hand-edit to the committed JSON. Pre-existing, low priority, but do not trust it as a tamper check.

---

## Decisions made

All four were put to the user on **2026-08-06** and answered. Do not re-open them.

1. **Item 3 — NPSHa: consolidate. ✅ APPROVED.** Extract one `computeNPSHa()` primitive that both `flashChamberCalculator` and `suctionSystemCalculator` call. Each keeps its own sweep dimension (3 levels vs 2 strainer conditions) and supplies its own friction term; the flash chamber's hardcoded `ESTIMATED_FRICTION_LOSS = 0.5` m becomes an **explicit optional input**, not a hidden default. No third implementation for the holdup vessels.
2. **Item 6 — methodology rules go in a new CLAUDE.md section**, not a standalone `docs/development/` doc.
3. **Order — item 2's UI first, then item 3.** Done; item 3 is next.
4. **Flash chamber v9 — batch it**, do not send on its own. It is additive (`nozzles[].dn`) and needs no re-run; it goes with the next physics change.

**Still open:** nothing. The next unanswered question is whichever one item 3 raises.

---

## Environment notes

Things a new machine will need to rediscover otherwise:

- **Builds validate in CI, not locally.** A full web build OOMs on the codespace (needs 5–6 GB heap). Local checks are scoped jest + `tsc --noEmit` + scoped lint. CI builds on every push.
- **Never run `firebase deploy` locally.** Deploys ship through the "Deploy - Production" GitHub Actions workflow, which auto-selects targets from changed paths (rule 33).
- **Fixture generators run under jest, not `tsx`.** Their import graph reaches `@vapour/firebase`, which never settles outside a browser-like environment — `npx tsx <script>` hangs. Run them with a `testMatch` override:
  ```
  npx jest --config <abs>/apps/web/jest.config.ts --rootDir <abs>/apps/web \
    --testMatch '**/__generators__/condenserFixtures.gen.ts'
  ```
  `--runTestsByPath` does **not** work — the `.gen.ts` files are excluded from `testMatch` by design.
- **Work directly on main**; no feature branches for this repo. Commit only on an explicit go-ahead (the user runs parallel Claude sessions). Never `git push` without a fresh per-push OK.
- **Permission prompts.** `.claude/settings.local.json` had accreted 798 rules of which **292 (37%) can never match again** — 67 one-shot `timeout N npx …` entries across 15 distinct timeout values, 147 bare file-path fragments, 63 shell fragments. Prefer general patterns, avoid `cd X && …` compounds (every segment must be allowed), and use the Bash tool's own timeout parameter rather than the `timeout` binary. Pruning the dead rules was offered and not yet done.

---

## Notes

The recurring theme across every defect this session: **the numbers were individually correct and the label was wrong.** Each fix was cheap; each would have been near-undetectable downstream, because a wrong time constant moves a transient, not an equilibrium, and every steady-state gate passes it. That is the argument for the capability register and for the fixtures publishing components rather than totals — it is the only way the other side can attribute a disagreement instead of merely observing one.

Prior findings from the same collaboration, all resolved, are recorded in [2026-07-29 seawater enthalpy & NCG model](2026-07-29-seawater-enthalpy-and-ncg-model.md).

---

**Author:** Claude (AI-assisted session record)
**Date:** 2026-08-05, updated 2026-08-06
**Next:** item 3 — extract `computeNPSHa()` (approved), then build the brine and distillate holdup vessels on it
