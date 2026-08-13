# Dependency upgrade plan — 11 remaining

Written 2026-08-11 after a sweep that took the repo from **59 outdated packages to 11**. Waves 1 and
2 are closed (7 items landed). Wave 3 was attempted in full and all three items were reverted — see
the attempt log below, which replaces the guesses the Wave 3 sections were originally written on.

Of the 11 still listed as outdated, **2 should never be taken** (deliberate holds, below) and **1 is
hard-blocked upstream** (TypeScript 7), leaving 8 that are real future work.

**Verification standard for every item:** `pnpm turbo type-check` (9/9), `TZ=UTC pnpm turbo test`
(6740), and `NODE_OPTIONS=--max-old-space-size=6144 pnpm turbo build` (4/4). The full build runs
locally in ~4 min — do not skip it. `turbo type-check` and `turbo build` use different tsconfigs and
catch different errors; a green type-check is not a green build. Run `pnpm install --frozen-lockfile`
before the final verify so the lockfile is proven consistent.

`TZ=UTC` is required locally — 9 date/holiday tests are timezone-sensitive and fail under
`Asia/Kolkata`. That is a separate pre-existing bug, not a regression.

---

## Deliberate holds — not to be taken

| Package               | Why not                                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@types/node` 22 → 26 | Must track the runtime. We deploy `nodejs22`; Node 26 types would promise APIs the runtime does not have. Correctly pinned, not stale.                                                        |
| `prettier` 3.8 → 3.9  | Takes the repo's unformatted count 32 → 83 files. `lint-staged` would silently reformat 51 extra files as they are touched. No functional gain; merge-conflict fuel across parallel sessions. |

---

## Wave 3 attempt log (2026-08-11) — all three attempted, all three reverted

Every Wave 3 item was migrated far enough to find its real blocker, then reverted. The tree is
unchanged and green. What follows replaces the guesses the sections below were written on.

### firebase-admin 14 — the API migration is NOT the blocker

The refactor itself succeeded: 40 files across `functions/` and `packages/functions`, plus a full
rewrite of `packages/firebase/src/admin.ts` off the namespaced API. 163 tsc errors → **0**, functions
built clean, and the GL trigger's `FieldValue.increment` semantics were unchanged (`accountBalances.ts`
diffed to exactly two lines: the import and `admin.firestore()` → `getFirestore()`).

**The blocker is Jest.** firebase-admin 14 pulls `jwks-rsa@4` → **`jose@6`, which is ESM-only with no
CommonJS build**. Any Jest suite that transitively imports `firebase-functions/v2` loads
`firebase-admin/auth` → `jwks-rsa` → jose and dies with `SyntaxError: Unexpected token 'export'`
before a single test runs. That includes the deployed `functions/` suites — the safety net for the GL
write paths. `transformIgnorePatterns` does not fix it under the ts-jest CJS preset; it needs a real
Jest ESM migration (`useESM`, `extensionsToTreatAsEsm`, transform rework) across the jest configs.

**Prerequisite: migrate Jest to ESM.** Not "163 errors over financial code" as this plan assumed —
that part is mechanical and done. There is no deadline: firebase-functions 7 peer-accepts admin
`^11 || ^12 || ^13 || ^14`.

Incidental find: `packages/functions/jest.setup.ts` imports `firebase-functions-test` and exports a
`testEnv` **nothing references**. It is the only reason that package's suite loads the chain at all.
Worth deleting independently.

### MUI 9 — the Typography codemod is ~10% of the work

`@mui/codemod@9.3.1` ships exactly one v9 transform, `v9.0.0/system-props`. It ran cleanly over
**602 files, 0 errors**, handling both the removed Typography system props (612 `fontWeight` sites)
and the removed `paragraph` prop. `@mui/icons-material` also renamed `HelpOutline` →
`HelpOutlineOutlined` (3 sites).

With `packages/ui` green, `apps/web` then surfaced **621 further errors** in classes the codemod does
not touch: `TextField` `inputProps`/`inputRef` → `slotProps`, more icon renames, and Chip/Select prop
changes. Combined with zero visual-regression coverage on a daily-use business app, this is a
multi-session migration with a manual QA pass, not a Wave 3 item.

### Next 16 — closer than expected; blocked only on the lint pipeline

**The build succeeds on Turbopack** (`▲ Next.js 16.3.0 (Turbopack)`, 4/4 tasks), tests pass 7/7, and
the static export is intact (85 entries in `out/`). Only **one** type error: Next 16 removed the
`eslint` key from `NextConfig`.

Two real blockers remain:

1. **`next lint` is removed.** `next lint --max-warnings=0` fails with `unknown option
'--max-warnings=0'`. Fixing it means moving `apps/web`'s lint script _and_ the `next lint --file`
   invocation in `.lintstagedrc.js` onto `eslint` directly — which touches the pre-commit hook that
   gates every commit.
2. **Sentry options silently no-op under Turbopack.** The build warns that `disableLogger` and
   `reactComponentAnnotation` are "Not supported with Turbopack" — so component-name breadcrumbs and
   debug-log treeshaking quietly stop working unless migrated to the `webpack.*` equivalents.

Sequencing note: because `next lint` is gone, the Next 16 migration and the ESLint flat-config
migration are naturally the same piece of work.

---

## Blocked upstream — cannot be scheduled

`typescript-eslint@8.67` (latest; no v9 exists) pins:

- `@typescript-eslint/typescript-estree` → `typescript: ">=4.8.4 <6.1.0"`
- `typescript-eslint` → `eslint: "^8.57.0 || ^9.0.0"`

| Item                   | Blocked by                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript` 5.9 → 7.0 | TS capped below 6.1.0                                                                                                                                                                     |
| `eslint` 9 → 10        | ~~eslint capped at ^9~~ **NO LONGER BLOCKED UPSTREAM** — `typescript-eslint@8.67.0` now peers `eslint: "^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0"`. Only the flat-config migration below remains. |
| `@eslint/js` 9 → 10    | moves with eslint                                                                                                                                                                         |

**ESLint 10 has a second, independent blocker.** This repo is still on **legacy eslintrc**, not flat
config: there is no `eslint.config.*`; there is a root `.eslintrc.json` that `apps/web/.eslintrc.json`
extends, and lint is invoked with `ESLINT_USE_FLAT_CONFIG=false`. ESLint 10 removes eslintrc support
entirely. So ESLint 10 needs a full flat-config migration _as well as_ a typescript-eslint release —
clearing the peer ceiling alone will not unblock it.

**Action: none.** Re-check when typescript-eslint publishes a release supporting TS 7 / ESLint 10, and
treat the flat-config migration as its own separate piece of work whenever ESLint 10 is wanted.
Until then these three stay on the outdated list permanently and that is correct.

TypeScript 7 is also the item everything else must precede — it is last regardless.

---

## Wave 1 — standalone, low risk

Each is independent of the others and of every later wave. One commit each.

**Status 2026-08-11:** 1 and 3 done (`172c5534`, `0fb297a0`). 2 turned out not to belong in Wave 1 —
it requires firebase 12 and has moved to Wave 2. **Wave 1 is closed.**

### 1. `@mui/x-date-pickers` 8 → 9 — DONE (`172c5534`)

Newly tractable: its peers accept `@mui/material: "^7.3.0 || ^9.0.0"`, so **it does not require MUI 9**
and is not part of the MUI migration. Bump alone, build, and click through the date pickers in
accounting/procurement forms.

### 2. `@firebase/rules-unit-testing` 4 → 5 — MOVED TO WAVE 2, NOT STANDALONE

**Corrected 2026-08-11.** v5 peers `firebase: "^12.0.0"`; the repo is on firebase 11.10.0, so
installing it produces `✕ unmet peer firebase@^12.0.0: found 11.10.0`. It is **coupled to the
firebase 11 → 12 migration** and cannot be taken alone. Attempted, reverted, tree restored.

The API itself is fine — `initializeTestEnvironment`, `RulesTestEnvironment`, `RulesTestContext`,
`TokenOptions`, `assertFails` and `assertSucceeds` all still exist in v5 (under
`dist/rules-unit-testing/src/public_types/`), so no test rewrite is expected. **Do it as the last
step of the firebase 12 item (Wave 2 #5)**, not on its own.

Two facts worth keeping for whoever does it:

- **`apps/web/tsconfig.json` includes `**/\*.ts`and excludes only`node_modules`, so the rules tests
are type-checked.** `turbo type-check` catches API breakage locally without any emulator.
- **Execution needs a JRE, which this machine lacks** (`/usr/lib/jvm` empty, no sdkman; `apt install
default-jre` needs interactive sudo). CI covers it: the `integration-tests` job installs Temurin 21,
  runs `firebase emulators:exec --only firestore,auth`, and executes `test:integration`, whose
  `testMatch` includes `**/__rules__/**/*.test.ts`. `ci-success` blocks on that job.

### 3. `functions/` lint tooling — DONE (`0fb297a0`), deleted rather than upgraded

`functions/` had `eslint@8` + `@typescript-eslint@6` and a stock Firebase `.eslintrc.js`, with no lint
script and no CI job — `turbo lint` resolves exactly one task, `@vapour/web`. All four removed; three
items off the outdated list and 1733 lines of lockfile gone.

---

## Wave 2 — contained migrations, one session each

**Status 2026-08-11: WAVE 2 COMPLETE.** All four done — `e3ee82bb`, `ab3781dd`, `d0ebe5d5`,
`b25ede7f`. Two plan assumptions were wrong and are corrected in the sections below: archiver needed
no ESM/CJS decision (Node's `require(esm)` loads it from CJS), and pdfjs-dist _was_ locally
verifiable (render to `@napi-rs/canvas`, no browser required).

### 4. `zod` 3 → 4 — DONE (`e3ee82bb`)

Touches `@vapour/validation`, `@vapour/agent-tools`, `@vapour/firebase`, `@vapour/functions`.
`apps/web` no longer declares zod (removed as dead). Schema-definition API changes; the validation
package is the blast radius. `packages/validation` has **no jest config**, so there is no regression
net — add one, or smoke-test the exported schemas by hand as was done for the DOMPurify bump.

### 5. `firebase` 11 → 12 (client SDK) — DONE (`ab3781dd`), with rules-unit-testing 5

`@vapour/firebase`, `@vapour/types`, `@vapour/validation`, `apps/web`. Modular SDK; check
Firestore/Auth imports and any `FirebaseError` handling. Independent of `firebase-admin`.

**Bundle `@firebase/rules-unit-testing` 4 → 5 into this item** — its `firebase: "^12.0.0"` peer is the
only thing blocking it (see Wave 1 #2). Take firebase 12 first, then the test package, then verify:
`turbo type-check` covers the rules tests locally, and CI's `integration-tests` job executes them
against the emulator.

### 6. `archiver` 7 → 8 (+ `@types/archiver` 8) — DONE (`d0ebe5d5`)

**Not a bump — a rewrite.** v8 is ESM-only (`"type": "module"`, no `main`) and replaces the callable
factory with a class API, so `archiver('zip', …)` no longer type-checks. `functions/` compiles to
**CommonJS**. Two call sites: `functions/src/transmittals.ts` and the legacy
`packages/functions/src/transmittals.ts`.

Needs an explicit ESM/CJS decision for the Functions build before any code change. The zip path has
no test coverage — transmittal ZIP generation is user-facing. `@types/archiver` 8 follows archiver 8
and must not be taken alone (v8 types drop the callable factory).

### 7. `pdfjs-dist` 5 → 6 — DONE (`b25ede7f`)

**Remove the type cast first.** `apps/web/src/lib/hr/travelExpenses/pdfMergeUtils.ts` renders via
`page.render(renderContext as Parameters<typeof page.render>[0])` — that cast means a v6 signature
change is swallowed silently and tsc gives no signal at exactly the call that would break. Fix the
typing, _then_ upgrade, then walk the travel-expense receipt-merge flow manually (no test coverage,
needs a browser canvas).

**Follow-up that came out of this — serve pdfjs assets locally instead of from cdnjs.** Two things
now depend on it:

- The **worker** is fetched from `cdnjs.cloudflare.com`; a CDN outage or compromise reaches this code,
  and it cannot work offline.
- **`standardFontDataUrl` is not set, so text does not render at all for standard-font PDFs.**
  Measured on a text-only PDF: 0 non-white pixels without it, 9385 with it — receipt images come out
  with no text for any PDF using Helvetica/Times/Courier. pdfjs-dist ships the 16 files in
  `standard_fonts/`, but **cdnjs does not mirror them** (403/404), so this one _requires_ local
  assets; there is no CDN shortcut.

Both are fixed by the same change: copy `pdf.worker.min.mjs` and `standard_fonts/` into the app's
served assets and point `workerSrc` / `standardFontDataUrl` at them. Pre-existing, version-independent.

---

## Wave 3 — large, own session each

### 8. `firebase-admin` 13 → 14 — highest risk in the list

v14 drops the namespaced API (`admin.firestore()`, `admin.storage()`, `admin.firestore.*` types) for
modular `firebase-admin/firestore` imports. Measured: **163 errors across 33 files** — effectively
the whole Cloud Functions backend.

It touches `onTransactionWrite`, whose `FieldValue.increment` calls maintain account balances. A
mechanical but wide refactor over financial write paths with only 78 unit tests behind it. Do this
alone, with the emulator integration suite (`functions/`'s `test:integration`) and a Data Health
"Recalculate Balances" check afterwards.

`firebase-functions@7` already peer-accepts admin `^11 || ^12 || ^13 || ^14`, so holding at 13 is
supported indefinitely — there is no deadline pressure here.

### 9. MUI 7 → 9 (`material` + `icons-material` + `lab`)

`@mui/lab@9` requires `@mui/material: "^9.3.1"`, so lab pins the trio together.
`@mui/material-pigment-css` is an **optional** peer — MUI 9 does not force adopting Pigment CSS.

`@mui/x-date-pickers` is _not_ part of this (see Wave 1). Keep `packages/ui` and `apps/web` on
identical ranges or the tree re-splits into two physical MUI copies — that duplication was fixed in
`37240503` and is easy to reintroduce.

Largest visual blast radius in the repo; needs a manual pass over the main list/dialog surfaces.

### 10. `next` 15 → 16 (+ `eslint-config-next` 16)

`eslint-config-next@16` peers only `eslint: ">=9.0.0"`, so it does **not** require ESLint 10 and is
not blocked by the typescript-eslint ceiling — it moves with Next, not with the lint toolchain.

The real work is Turbopack becoming the default builder: `apps/web/next.config.ts` wraps everything
in `withSentryConfig` with **webpack**-plugin options that do not apply under Turbopack. Sentry setup
has to be reworked in the same change. `output: 'export'` static export must be re-verified end to
end.

---

## Suggested order

```
Wave 1  x-date-pickers 9 ✅ → functions lint cleanup ✅            [CLOSED]
Wave 2  zod 4 ✅ → firebase 12 (+ rules-unit-testing 5) ✅ → archiver 8 ✅ → pdfjs-dist 6 ✅  [CLOSED]
Wave 3  all three attempted 2026-08-11, all three reverted — each now has a named prerequisite:
          firebase-admin 14  ← needs: migrate Jest to ESM (jose 6 is ESM-only)
          MUI 9              ← needs: a dedicated session + manual visual QA (621 errors past the codemod)
          Next 16            ← needs: move lint off `next lint` (same work as flat-config / ESLint 10)
Blocked typescript 7   (typescript-eslint caps TS <6.1.0 — genuinely unschedulable)
Held    prettier 3.9, @types/node 26   (deliberate, see top of file)
```

The three Wave 3 prerequisites are independent of one another, so they can be picked up in any order.
Two of them are really infrastructure projects rather than dependency work:

1. **Test-runner modernisation** unblocks firebase-admin 14 (and will keep recurring as more packages
   go ESM-only). Planned in detail in
   [2026-08-12-jest-modernisation-plan.md](./2026-08-12-jest-modernisation-plan.md) — which
   recommends **Vitest over Jest-ESM**, on the strength of 530 `jest.mock()` calls that Vitest
   preserves and Jest-ESM would require rewriting.
2. **ESLint flat config** unblocks both Next 16 and ESLint 10 — one migration, two items.
3. **MUI 9** unblocks nothing else; it is pure UI work and can wait indefinitely.

TypeScript 7 comes after everything and is blocked regardless.
