# Test-runner modernisation plan — Jest → Vitest

Written 2026-08-12. Follow-on from
[2026-08-11-dependency-upgrade-plan.md](./2026-08-11-dependency-upgrade-plan.md), which identified
this as the prerequisite blocking `firebase-admin` 14 and — more importantly — as a recurring blocker
that will keep appearing as packages ship ESM-only.

**Recommendation: migrate to Vitest, not Jest-with-ESM.** The reason is one number, measured below:
**530 `jest.mock()` calls across 136 files**. That single fact makes Jest-ESM expensive and Vitest
cheap, and it is the opposite of what you would assume from the outside.

---

## Why this is needed at all

JavaScript has two module systems: CommonJS (`require`) and ESM (`import`). Packages are
increasingly shipping **ESM only**. All eight Jest configs here use `ts-jest`, which compiles to
CommonJS, so an ESM-only dependency anywhere in the import graph makes Jest fail to parse before a
single test runs:

```
SyntaxError: Unexpected token 'export'
```

That is exactly what killed the `firebase-admin` 14 attempt: `firebase-admin` → `jwks-rsa` →
`jose@6`, which is ESM-only with no CommonJS build. It took out the `functions` suites — the safety
net for the accounting-balance logic — so the migration was reverted despite the code changes being
complete and compiling (163 errors → 0).

`transformIgnorePatterns` was tried and does **not** fix it under the ts-jest CommonJS preset.

This is not a one-off. `archiver` 8 is already ESM-only (it works in production only because Node
itself can bridge it; Jest is the piece that cannot). Every future upgrade carries a growing chance
of hitting the same wall, and each time it will look like an unrelated surprise.

---

## Current state (measured, not estimated)

|                                   |                                                            |
| --------------------------------- | ---------------------------------------------------------- |
| Jest configs                      | **8** — all `preset: 'ts-jest'`, none with any ESM setting |
| Environments                      | 2 × `jsdom` (`apps/web`, `packages/ui`), 6 × `node`        |
| Test files                        | **267**                                                    |
| Tests                             | **6,740**                                                  |
| `jest.mock(`                      | **530**, across **136 files** ← the dominant cost          |
| `jest.fn(`                        | 1,906                                                      |
| `jest.spyOn(`                     | 22                                                         |
| `jest.requireActual(`             | 3                                                          |
| `jest.doMock(` / `__mocks__` dirs | 0 / 0                                                      |
| `moduleNameMapper`                | `@/*`, `@vapour/*`, plus CSS/asset stubs                   |
| `setupFilesAfterEnv`              | 3 configs                                                  |
| `@testing-library/jest-dom`       | used (8 references)                                        |
| Coverage thresholds               | `apps/web`, `packages/functions`                           |

Most-mocked modules: `firebase/firestore` (104), `@vapour/logger` (84), `@vapour/firebase` (71),
`@/lib/firebase` (38).

**Test distribution is very lopsided** — and that is what makes a staged migration practical:

```
apps/web            243 files   6366 tests
functions             7          78
packages/ui          10          88
packages/constants    3         168
packages/types        2          11
packages/functions    1          29
packages/utils        1           ?
```

---

## Why Vitest rather than Jest-with-ESM

The deciding factor is how each runner handles `jest.mock()`.

**Under Jest ESM, `jest.mock()` stops working.** It relies on hoisting the mock above the imports,
which ESM's static import semantics forbid. Every call must become `jest.unstable_mockModule()`
paired with a dynamic `await import()` of the module under test — which restructures the top of each
test file. At 530 call sites across 136 files, that is a large, hand-rolled, error-prone rewrite of
the mocking layer, in an API Jest itself still labels _unstable_.

**Under Vitest, `vi.mock()` hoists exactly like `jest.mock()`.** The migration for those 530 sites is
overwhelmingly a `jest.` → `vi.` rename, which is mechanical and codemod-able. Vitest also runs ESM
natively, so the original problem disappears rather than being worked around.

Secondary advantages, none of which drive the decision on their own: no `ts-jest` transform step
(Vitest uses esbuild, typically much faster), `moduleNameMapper` becomes ordinary
`resolve.alias`, and `@testing-library/jest-dom` is supported directly.

**Honest costs of choosing Vitest:**

- It is a different runner. Reviewers, docs, and muscle memory all change.
- `@testing-library/jest-dom` needs its Vitest entry point wired into setup files.
- Coverage moves from Jest's provider to Vitest's (`v8`/`istanbul`); the two configured thresholds
  need re-checking, and reported percentages may shift slightly.
- Fake timers and `jest.useFakeTimers()` (9 uses) behave subtly differently.
- The `apps/web` integration/rules configs run against Firebase emulators in CI — that wiring must be
  re-proved, not assumed.

**Do not choose Vitest if** the team would rather not take on a new tool at all. In that case the
fallback is Jest-ESM, and the plan below still applies — but budget for rewriting the mocking layer
in 136 files rather than renaming it, and expect the per-file work to need judgement rather than a
codemod.

---

## Staged plan

Each stage is independently committable and independently revertible. **Both runners can coexist**
during the migration: keep `jest` installed and per-package `test` scripts pointing at whichever
runner that package has been moved to, so `turbo test` stays green throughout.

### Stage 0 — decide, and prove the pattern on the smallest package

Target: `packages/types` (2 files, 11 tests).

Add Vitest, write one `vitest.config.ts`, port that package's `test` script, and get 11 tests green.
Deliberately the smallest possible surface — the goal is to settle config shape, alias handling, and
the TypeScript path, not to make progress on volume.

**Exit criteria:** 11/11 passing under Vitest, `turbo test` still green overall (other packages still
on Jest).

### Stage 1 — the node-environment packages

Targets: `packages/constants` (168), `packages/utils`, `packages/functions` (29).

No DOM, few mocks, so these shake out aliasing and setup-file handling cheaply. `packages/functions`
also has a coverage threshold to re-point.

**Also do here:** delete the unused `firebase-functions-test` import and `testEnv` export from
`packages/functions/jest.setup.ts`. Nothing references `testEnv`, and that import is the sole reason
that package's suite loads the `jose` chain at all. It is worth doing regardless of this migration.

**Exit criteria:** those suites green under Vitest; coverage threshold still enforced.

### Stage 2 — `functions` (the one that unblocks firebase-admin)

Target: `functions` (7 files, 78 tests).

This is the package whose suites the `jose` chain breaks, so it is the real objective. Migrate it,
then **re-apply the firebase-admin 14 migration** — the code side is already proven (163 → 0 errors,
clean build), so this stage should mostly be re-doing a known-good change and confirming the tests
now survive the ESM dependency.

**Exit criteria:** 78 tests green under Vitest _with firebase-admin 14 installed_. That is the
moment the blocker is actually gone.

### Stage 3 — `packages/ui` (first jsdom environment)

Target: `packages/ui` (10 files, 88 tests).

First browser-like environment: proves the `jsdom` setup and the `@testing-library/jest-dom` matcher
wiring on a small surface before betting the big suite on it.

**Exit criteria:** 88 tests green, matchers working.

### Stage 4 — `apps/web` (the bulk)

Target: 243 files, 6,366 tests, and the large majority of the 530 mocks.

Run the rename as a codemod (`jest.` → `vi.`, plus `import { vi } from 'vitest'` where globals are
not enabled), then fix the residue by hand. Expect the residue to cluster in:

- the 3 `jest.requireActual` sites (`vi.importActual`, and it is async)
- the 9 `jest.useFakeTimers` sites
- the single `jest.resetModules`
- anything mocking `next/navigation` or `next/image`

**Exit criteria:** 6,366 tests green, coverage threshold re-established, `TZ=UTC` still required (see
below).

### Stage 5 — integration and rules suites, then remove Jest

Targets: `apps/web/jest.integration.config.ts` — the `__integration__` and `__rules__` suites that
run against Firebase emulators in CI.

These cannot be fully verified locally (no JRE on the dev machine), so **CI is the verification** —
the `integration-tests` job installs Temurin 21 and runs the emulators. Land this stage on its own so
a failure there is unambiguous.

Only once every package is migrated: remove `jest`, `ts-jest`, `jest-environment-jsdom`,
`@types/jest`, and the eight `jest.config.*` / `jest.setup.*` files.

**Exit criteria:** CI `integration-tests` green; no `jest` dependency remains.

---

## Verification standard

Unchanged from the dependency plan, and it applies to every stage:

```
pnpm turbo type-check                                    # 9/9
TZ=UTC pnpm turbo test                                   # all suites
NODE_OPTIONS=--max-old-space-size=6144 pnpm turbo build  # 4/4
pnpm install --frozen-lockfile                           # lockfile consistent
```

- **`TZ=UTC` is mandatory locally.** 9 date/holiday tests are timezone-sensitive and fail under
  `Asia/Kolkata`. Pre-existing bug, unrelated to the runner — but it will look like a migration
  regression if you forget.
- **A green `turbo type-check` is not a green `turbo build`.** They use different tsconfigs, and
  `packages/functions` has no `type-check` task at all. That gap has already broken CI once and
  hidden a real error a second time.
- Test counts are the regression signal. Record the before/after count per package at each stage; a
  suite that silently drops to 0 tests is the characteristic failure mode here (it is how the `jose`
  breakage first presented).

---

## What this unblocks

**Directly:** `firebase-admin` 13 → 14. The code migration is already done and proven; only the test
runner stands in the way.

**Structurally, and this is the real point:** it stops ESM-only dependencies being a blocker at all.
Today that is one package. The trend is one-directional, and without this each future upgrade carries
a growing chance of the same failure appearing as an unrelated surprise.

**Not affected:** nothing here touches production code paths. The application bundle, the deployed
functions, and the runtime behaviour are all unchanged. This is test infrastructure only — which is
also why it can be done incrementally with low risk.

---

## Open questions for the user

1. **Vitest or Jest-ESM?** The plan recommends Vitest on the strength of the 530-mock number. Jest-ESM
   keeps the toolchain familiar at a substantially higher migration cost and an `unstable_` API.
2. **All at once, or stop after Stage 2?** Stage 2 is where `firebase-admin` 14 becomes possible.
   Stages 3–5 are cleanup, and `apps/web` could sit on Jest indefinitely if both runners coexisting
   is acceptable. Coexistence is a real cost though — two runners, two configs, two mental models.
3. **Is any of this urgent?** No. There is no deadline and no security exposure; `firebase-functions`
   7 explicitly supports `firebase-admin` 13. This is debt reduction, best done deliberately rather
   than under pressure.
