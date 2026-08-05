# CLAUDE.md — draft for the dynamic simulator repo

> Copy this to `CLAUDE.md` in the root of the new Python repo. It lives here for now so it
> travels with `dynamic-simulator-specification.md`.

---

# MED Dynamic Simulator — Coding Standards

**Read `docs/specification.md` before doing anything else.** It holds the architecture
decisions, the input contract, the validation strategy and the development ladder. This
file holds only the rules. Where the two overlap, the specification wins — do not
duplicate its content here, because the copy will drift.

## How this file works

Every rule below exists because something went wrong, or because it went wrong somewhere
else and we chose not to repeat it. A rule with no reason attached gets ignored, so each
one records its **Why**.

**This file grows by accretion, not by planning.** Do not invent rules for problems that
have not happened. When one does happen, add the rule _and_ log the incident in
[§ Lessons log](#lessons-log). That is the only way the next person — or the next session
— learns what the diff alone cannot show.

Every rule is tagged with where it came from, because the two are not equally binding:

- **[learned here]** — a logged incident in this repo. Non-negotiable.
- **[inherited]** — a logged incident in Vapour Toolbox that would recur here. Treat as
  learned.
- **[judgement]** — standard practice for numerical work, adopted without an incident yet.
  Defensible, but if one of these ever gets in the way, challenge it rather than working
  around it silently — and if it turns out to be wrong, delete it and log why.

---

## Numerical correctness

These matter more here than anything else. A web app that breaks tells you. A numerical
model that breaks returns a plausible number and says nothing.

### 1. Every physical quantity carries its unit in the name `[judgement]`

`flow_kg_s`, not `flow`. `pressure_mbar`, not `pressure`. `shell_length_mm`, `temp_c`,
`salinity_ppm`.

**Why:** unit confusion is the most common silent error in engineering code, and the one
least likely to be caught by a test that was written against the same misunderstanding.

**How to apply:** if a function signature does not tell you the units, the signature is
wrong. Conversions happen at one clearly named place, never inline.

### 2. Never invent a correlation, coefficient or constant `[inherited]`

Every empirical relation cites its source in a docstring: paper, equation number, year.
Every constant states where it came from.

**Why:** a fabricated correlation looks exactly like a real one. This is the single
highest-risk failure mode when generating scientific code with an LLM — the output is
fluent, dimensionally plausible, and wrong.

**How to apply:** if a source cannot be cited, the code does not get written. Say so and
stop. "Approximately" and "typically" are not sources.

### 3. No silent extrapolation outside a correlation's validity range `[inherited]`

The MIT seawater correlations are valid 0–180 °C and 0–120,000 ppm. Outside that, raise or
warn. Never return a number.

**Why:** upset conditions push brine past the validated envelope, and a quietly
extrapolated value is worse than a crash — it propagates into everything downstream
looking like a result.

**How to apply:** validity bounds are declared next to the correlation and checked on
every call. If a check is expensive, it is still cheaper than a wrong answer.

### 4. Tests assert against an independent reference, never against current output `[learned here]`

Compare to published steam tables or the source paper's own tabulated values. Never
"whatever the function currently returns".

A Vapour Toolbox fixture is a **secondary** cross-check only — it is another codebase's
current output, and because both implementations transcribe the same paper their errors
are correlated. Specification §7.1 sets the required order: paper first, MIT reference
output second, TypeScript agreement third.

**Why:** a test written by running the code and pasting the result pins the bug in place
and produces false confidence. See the 2026-07-29 entry in the lessons log — a regression
test in Vapour Toolbox passed with the fix reverted, because the module under test was
mocked and the test could never observe the failure.

**How to apply:** after writing a test for a bug fix, **revert the fix and confirm the
test fails.** A regression test that has never failed is not a regression test.

### 5. Conservation is checked, not assumed `[judgement]`

Every run asserts closure on total mass, salt and energy within integrator tolerance.

**Why:** cheap, and it catches whole classes of sign and unit errors that produce
physically impossible but numerically unremarkable results.

---

## Solver

### 6. No branching inside the derivative function `[judgement]`

Discrete changes — a valve opening, an interlock firing — use `solve_ivp` terminal events:
stop, apply the change, restart from that state. Never `if level > x:` inside the RHS.

**Why:** it makes the derivative discontinuous partway through a step. The integrator
either rejects steps and crawls, or integrates across the jump and returns a wrong
trajectory without complaining. Specification §6.5.

### 7. Actuators are never instantaneous `[judgement]`

Valves stroke over seconds; pumps ramp. Model position as a state or a scheduled ramp and
compute flow from it.

**Why:** step changes are both physically wrong and numerically hostile. Specification
§6.4.

---

## Architecture

### 8. A run is fully described by serialisable inputs `[judgement]`

Plant model + parameter set + scenario — three artifacts, where the parameter set carries
both the physical calibration vector and the numerical settings (`method`, `rtol`, `atol`).
No state hidden in a notebook cell, no run that exists only in someone's kernel.

Solver tolerances are part of the answer, not the machinery: §7.3 asserts conservation
"within integrator tolerance".

**Why:** it is what makes a run reproducible six months later, lets the validation suite
re-run every case, and lets a future interface drive the model without touching its
internals. Specification §2.1.4, §6.1.

### 9. One canonical implementation per concept `[inherited]`

Before adding a module, function or abstraction, search for the concept under adjacent
names. If it exists, extend it.

**Why:** carried over from Vapour Toolbox, which paid days of consolidation for parallel
implementations of the same idea. Two property modules or two integrator wrappers is the
shape it would take here.

### 10. No silent catches `[inherited]`

Every `except` either logs with context and re-raises, or degrades gracefully with a
one-line comment saying why that is safe. Never a bare `except: pass`.

**Why:** in numerical code a swallowed exception does not produce a missing feature — it
produces a plausible wrong number.

### 11. Do not build generality you do not need `[inherited]`

No plugin systems, no configurable solver backends, no abstraction layers for the second
implementation that does not exist yet.

**Why:** carried over from Vapour Toolbox rule 31, where ~110 lines of migration code
shipped for zero records that needed it. Solo project, one plant type, one solver.

---

## Process

### 12. Validation gates before features `[judgement]`

A rung of the ladder is not done until its gate passes. Do not start the next rung on an
unvalidated one.

**Why:** the alternative is discovering at rung 5 that rung 1 was wrong, and not knowing
which of the four layers above it to distrust.

**How to apply:** rungs that add a component Vapour Toolbox can check use the steady-state
gate (specification §7.2). Rungs that add dynamics but no new equilibrium physics are
gated on the invariant instead — **the steady state must be unchanged from the rung
below** — plus conservation. Specification §7.2.1 lists the gate for every rung. No rung
is ungated, and "it looked reasonable" is not a gate.

### 13. Fixture expectations are committed `[judgement]`

Expected values live in version control. If a refactor changes a computed number, it
appears as a diff in review.

**Why:** numerical drift is invisible otherwise. "The tests still pass" is not the same as
"the answers did not change".

### 14. Definition of done for a rung `[judgement]`

- Physics implemented with sources cited (§2)
- Its gate passing (§12) — specification §7.2 where an external reference exists, §7.2.1
  where the gate is an invariant instead
- Conservation asserted (§5)
- One plot demonstrating the new behaviour
- Specification updated if a decision changed

---

## What this project is NOT for

Reproduce this honestly in any report, docstring or summary. Do not soften it.

Until the model is calibrated against commissioning data it **cannot** be used for:

- Contractual startup-time or ramp-rate guarantees
- Root-causing a real plant upset
- Absolute performance prediction

It **is** defensible for: developing startup and shutdown procedures, operator training,
checking control philosophy and interlocks, sizing transient-driven equipment, and
relative comparisons between options.

This is a **dynamic simulator, not a digital twin** — no live plant data feeds it.

**Why this is a rule:** an expert reviewer who catches the model overclaiming will discount
everything else in the document, including the parts that are sound.

---

## Lessons log

Append when something bites. Format:

```
### YYYY-MM-DD — short title
**What happened:** …
**Why it happened:** …
**Rule added or changed:** …
```

Log it if a bug took more than an hour to find, if a fix needed a second attempt, or if a
test gave false confidence. Those are the ones worth a rule.

### 2026-07-29 — Inherited: a property function returned the wrong phase for two years

**What happened:** In Vapour Toolbox, `calculateStreamProperties` returned **liquid**
density and enthalpy for saturated steam — 970 kg/m³ instead of 0.198, with the latent
heat missing. Wrong by three orders of magnitude. A vapour duct sized on it would have
been unusable.

**Why it happened:** At saturation, the pressure–temperature lookup resolves to the
compressed-liquid branch. Nothing detected it because no data had ever flowed through that
path — the registers were empty, so the wrong answer was never looked at.

**Rule added or changed:** Rules 2, 3 and 4. Property functions must select phase
explicitly rather than relying on a P–T lookup to disambiguate, and must be tested against
published table values — not against whatever the implementation returns.

### 2026-07-29 — Inherited: a regression test that could never fail

**What happened:** A test written to guard the fix above passed _with the fix reverted_.
It was accepted as proof and was worthless.

**Why it happened:** The test file mocked the module that produced the faulty values, so
the test could not observe the failure it was written to catch.

**Rule added or changed:** Rule 4. After writing a regression test, revert the fix and
confirm the test fails. A regression test that has never failed is not a regression test.

### 2026-07-29 — Inherited: undefined values reached the database

**What happened:** A bulk write of 42 records failed entirely because optional fields that
did not apply to a given fluid were passed through as `undefined`.

**Why it happened:** The enrichment function returned the full property set for every
fluid regardless of which properties that fluid actually has, and the write path did not
strip them.

**Rule added or changed:** None yet for this repo — Python has no direct equivalent. Noted
because the underlying shape may recur: **a function that returns a fixed record for
inputs that do not all have the same fields will produce holes, and something downstream
has to decide what a hole means.** Watch for it in the plant-model serialiser.
