# Automated Verification & Testing — Assessment & Plan (2026-07-05)

Goal: close the gap between "tests exist" and "deploys and production data are automatically verified".
The unit layer is healthier than the raw ratio suggests; the risk is concentrated in four places:
untested Cloud Functions, untested security rules, missing money-path coverage in the
integration/e2e layers, and the fact that nothing runs automatically before a production deploy.

## Locked decisions

- **No global coverage target.** With ~513k LOC and one developer, a blanket threshold (e.g. 60%)
  would either fail immediately or drive low-value test writing. Coverage is enforced by a ratchet
  (Phase 6), targeted at the financial/workflow spine.
- **No component tests for dialogs.** Rule 22 round-trips are verified at the integration layer,
  not with per-dialog React Testing Library suites.
- **Existing e2e suite is not migrated or rewritten** — only extended with a small money-path
  smoke set and wired into the deploy gate.
- **Reuse over rebuild (rule 32):** the nightly production audit reuses the Data Health /
  accounting-audit logic that already exists; it does not reimplement GL checks.

## Evidence base (audited 2026-07-05)

| Layer                  | Exists today                                                                                                                 | Gap                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (Jest)            | 204 test files / 1,846 source files. Accounting is well covered (transactionService, void/delete/approval, GST/TDS, ledger). | `functions/src/` has **zero** test files. `packages/functions` has exactly one.                                                        |
| Integration (emulator) | `apps/web/src/__integration__/` — 7 workflow suites (BOM, HR, materials, procurement, charter, services, admin). Runs in CI. | No accounting workflow. No proposal→project conversion. Emulator runs `--only firestore,auth` — **triggers never fire** in this layer. |
| Security rules         | 2,210-line `firestore.rules`                                                                                                 | Zero rules tests. Recent regression evidence: `15c4ca88` (tenantId write needed to satisfy rules).                                     |
| E2E (Playwright)       | 8 specs + auth helpers, Firebase-emulator-backed, `e2e.yml` workflow                                                         | `workflow_dispatch` only — never gates anything. No accounting or procurement specs.                                                   |
| Production data        | Data Health page, accounting-audit MCP tools (`check_gl_balance`, `audit_data_integrity`)                                    | All manual — nothing runs on a schedule or alerts on drift.                                                                            |
| Enforcement            | `scripts/audit/*` rule audits in pre-commit; `ui-baselines.json` ratchet                                                     | No mechanism stops new service code shipping without tests.                                                                            |

Priority logic: protect money first (Phases 1–2), then access control (Phase 3), then gate deploys
(Phase 4), then watch production (Phase 5), then stop decay (Phase 6).

---

## Phase 1 — Cloud Functions test harness + `accountBalances` tests (~1 day)

The highest-risk untested code in the repo: `functions/src/accountBalances.ts`
(`onTransactionWrite`) incrementally maintains every GL balance via `FieldValue.increment()`.
Its failure mode is silent aggregate corruption.

1. **Read first, then choose the split.** Read `accountBalances.ts` and
   `packages/functions/src/accounting.ts`. Where the balance-delta logic is (or can be moved to)
   a pure function in `@vapour/functions` — which already has Jest configured
   (`formulaEngineService.test.ts` is the exemplar) — test it there. Pure-logic tests are the
   bulk of the value and run in the normal `pnpm test` CI job with no emulator.
2. **Pure-logic cases (minimum set):**
   - create: increments debit/credit/currentBalance per entry
   - update that changes amounts/accounts: delta = new − old, including account moved between entries
   - delete: full reversal
   - **soft-delete transitions** (rule 3): `isDeleted false→true` treated as delete,
     `true→false` as create, already-deleted writes skipped
   - draft/status filtering: whichever statuses the trigger is supposed to ignore
   - multi-currency: increments use `baseAmount`-derived figures, never `totalAmount` (rule 21)
3. **One emulator smoke test** that exercises the real trigger wiring end-to-end:
   `firebase emulators:exec --only firestore,functions --config firebase.test.json` from
   `functions/` (add a `test` + `test:integration` script to `functions/package.json`; note
   `functions/` uses **npm, not pnpm**). Write a transaction doc, poll the account doc, assert the
   balance. This catches export/region/config mistakes pure tests can't.
4. **CI:** add a `functions-tests` job to `ci.yml` (npm install in `functions/`, build, run).
   Keep it parallel to the existing `test` job.
5. Extend the same pure-logic treatment to `procurementPaymentStatus.ts` and
   `projectFinancials.ts` if their logic extracts cheaply; otherwise log them as Phase 1 stretch
   and move on.

Deliverables: `packages/functions/src/__tests__/accountBalances*.test.ts` (or in-place if logic
already lives there), one emulator smoke suite under `functions/`, `ci.yml` job.

### Phase 1 execution notes ✅ DONE 2026-07-05 (Fable; not yet committed)

Deviations from the plan as written, all surfaced to and approved by the user:

- **`packages/functions` was the wrong target — it is legacy, undeployed code.** The deployed
  functions (`functions/src/index.ts`) never import from `@vapour/functions`, and its
  `createJournalEntry` writes a `glEntries` collection that doesn't match the live schema.
  Everything landed in `functions/` itself instead. **Follow-up (rule 32):** delete or archive
  `packages/functions/src/accounting.ts`'s dead callables in a later cleanup.
- **A real (latent) bug was found and fixed.** The trigger ignored `isDeleted` transitions:
  soft-deleting or restoring a transaction never adjusted balances, while
  `recalculateAccountBalances` skips soft-deleted docs — the incremental and from-scratch paths
  disagreed (rule 3 violation). Production was checked read-only before the fix: **0 soft-deleted
  transactions, 0 drifted accounts** (667 transactions, 102 accounts) — latent, no remediation
  needed.
- **What landed:**
  - `functions/src/accountBalanceLogic.ts` — pure module, no firebase imports:
    `effectiveEntries` (soft-deleted ⇒ contributes nothing), `resolveBalanceUpdate`
    (delta = effective-after − effective-before; handles create/update/hard-delete/soft-delete/
    restore/hard-delete-after-soft-delete uniformly, paisa-rounded per rule 21),
    `aggregateBalanceChanges` (recalculation path), `calculateBalanceChanges`.
  - `accountBalances.ts` trigger + recalculation refactored to thin shells over the pure module.
  - `functions/src/accountBalanceLogic.test.ts` — 23 unit tests incl. an incremental-vs-recalc
    agreement test replaying a write history.
  - `functions/src/onTransactionWrite.integration.test.ts` — 4-test emulator smoke
    (create/soft-delete/restore/hard-delete), run via `npm run test:integration` inside
    `firebase emulators:exec --only firestore,functions`; `firebase.test.json` gained a
    functions source + emulator port (the web CI job's `--only firestore,auth` is unaffected).
  - Jest wired into `functions/` (`jest.config.js`, `jest.integration.config.js`;
    versions mirror apps/web: jest ^30.2.0 / ts-jest ^29.4.5). Build now uses
    `tsconfig.build.json` to keep compiled tests out of the deployed `lib/`.
- **No `ci.yml` change was needed:** `functions` is a pnpm workspace member, so the new
  `test` script is picked up by the existing `pnpm test` (turbo) CI job — verified with
  `pnpm turbo test --filter=functions`. The emulator smoke suite stays manual/on-demand
  (like e2e) — revisit in Phase 2b.
- `functions/package-lock.json` was re-synced (`npm install --package-lock-only`) so the deploy's
  `npm ci` doesn't break; npm refreshed ~300 transitive versions within existing semver ranges.
  Runtime `dependencies` in `package.json` are unchanged. Watch the first post-merge deploy.
- Trigger behavior deliberately NOT changed: DRAFT transactions still count toward balances
  (consistent in both paths today). Flagged as a business question, not a bug.

## Phase 2 — GL invariant + money-path integration tests (~1 day)

New suites in `apps/web/src/__integration__/`, running under the existing CI emulator job
(no infra change needed for 2a).

1. **`accounting-workflow.integration.test.ts` — GL invariant test (2a).** Post a realistic mix
   of all 9 `TransactionType`s through `transactionService` against the emulator, then assert:
   - every transaction's entries sum: debits == credits (per doc)
   - outstanding = roundToPaisa(total − paid) for every invoice/bill after partial + full payments
   - soft-deleted transactions excluded from every aggregate
   - mixed-currency: aggregation uses `baseAmount` only
   - allocation over-payment rejected (rule 23), self-approval rejected (rule 6),
     invalid status transitions rejected (rule 8)
     Because triggers don't run in this layer, recompute expected balances **in the test** from the
     entries — this verifies the client-side write path independently of Phase 1's trigger tests.
2. **`proposal-conversion.integration.test.ts`.** The flow currently being hardened in
   production (PO26XP062901): proposal → accept → convert to project, asserting `tenantId`,
   budget line items (incl. the service-only/empty-budget case from `734f1e1c`), and
   denormalized fields per rule 26.
3. **(2b, stretch)** Add `functions` to the CI emulator job
   (`--only firestore,auth,functions` + functions build step) so one full-loop test can assert
   client write → trigger → balance. Only do this if the Phase 1 smoke suite proved the emulator
   setup is not flaky in CI; otherwise skip — Phases 1 + 2a together already cover both halves
   of the loop.

## Phase 3 — Firestore security rules tests (~1 day)

1. New suite `apps/web/src/__rules__/` (or `firestore-rules-tests/` at repo root if keeping it
   out of the Next.js tree is cleaner) using `@firebase/rules-unit-testing` against the firestore
   emulator, run in the existing CI integration job.
2. Cover in priority order — collections that have already bitten, then money:
   - `proposals` / `projects` (the `15c4ca88` tenantId regression — encode it as a test)
   - `transactions`, `accounts` (read requires VIEW, write requires MANAGE, no cross-user access)
   - `purchaseOrders`, `goodsReceipts`
   - `users` / `taskNotifications` (userId scoping)
   - one **default-deny** test: an unauthenticated and an unlisted-collection access both fail
3. Shared helpers: `authedContext(permissionFlags)` building a token with the real
   `PERMISSION_FLAGS` bitmask from `@vapour/constants` — no hardcoded numbers (rule 7).
4. **Discipline going forward** (add to CLAUDE.md rule 4 once landed): a change to
   `firestore.rules` ships with a rules test for the touched match block.

Not the goal: exhaustive coverage of all 2,210 lines. ~8–10 focused suites on the collections
above captures most of the regression risk.

## Phase 4 — Money-path e2e smoke + deploy gate (~1–1.5 days)

The single change that turns "tests exist" into "deploys are verified".

1. **New specs** (reusing `auth.helpers.ts` / `auth.setup.ts`):
   - `e2e/accounting-smoke.spec.ts` — create a customer invoice, record a payment against it,
     assert outstanding hits zero and the transaction list shows both docs
   - `e2e/procurement-smoke.spec.ts` — create a PR → PO, walk one approval step, assert status
     chip + disabled terminal-state buttons (rule 10)
     Tag both `@smoke`; keep total runtime under ~5 minutes.
2. **Deploy gate:** add a `smoke-e2e` job to `deploy.yml` that runs
   `playwright test --grep @smoke` (chromium only) against the emulator-backed setup already
   scripted in `e2e.yml`, and make the hosting/functions/rules deploy jobs `needs: [smoke-e2e]`.
   Deploy dispatch is already manual, so +5–10 minutes is acceptable.
   - Include an `input: skip-smoke` escape hatch (default false) for emergency deploys.
3. Leave `e2e.yml` (full suite, on-demand) as is.

## Phase 5 — Nightly production data audit (~½–1 day)

Continuous verification of real data — catches whatever the test layers miss, and drift from
console edits / partial failures.

1. **Check for existing implementations first (rule 32 / `/check-duplicates`):** the Data Health
   page logic and the `accounting-audit` MCP server both already compute GL checks. Extract the
   shared checks into `@vapour/functions` and have all three consumers call it — do NOT write a
   fourth GL checker.
2. Scheduled Cloud Function `dataIntegrityAudit` (patterns: `email/` scheduled overdue check,
   `backup/scheduledBackup.ts`), nightly:
   - per-transaction debits == credits; flag drafts/incomplete docs older than N days
   - recompute each account balance from entries; compare to `currentBalance` with paisa tolerance
   - orphaned references (transactions pointing at missing entities/accounts)
   - counter/number-sequence duplicates
3. **Alerting:** on any finding, email via the existing `email/` infrastructure (to
   sekkizhar@vapourdesal.com); write a summary doc to a `dataAuditRuns` collection so the Data
   Health page can display last-run status. Silent success, loud failure.
4. New collection ⇒ security rules + (if queried with where+orderBy) composite index (rules 2, 4).

## Phase 6 — Test ratchet (~½ day)

Stop the test ratio from decaying, using the mechanism already proven by `ui-baselines.json`.

1. `scripts/audit/check-test-presence.js`, wired into the pre-commit hook alongside the existing
   audits: for staged files matching `apps/web/src/lib/**/*Service.ts` (and
   `functions/src/*.ts`, `packages/functions/src/**/*.ts`), require a sibling/`__tests__`
   `.test.ts` to exist **or** the file to be listed in `test-baselines.json`.
2. Seed `test-baselines.json` with the current untested set (generated, not hand-written). The
   baseline can only shrink — same ratchet semantics as the UI script. Editing a baselined file
   does not force a test (too aggressive for mechanical edits); only **new** service files hard-fail.
3. Optional report mode: `node scripts/audit/check-test-presence.js --report` prints the
   baseline count per module, so progress is visible in reviews.

---

## Sequencing & effort

| Phase | What                                      | Effort   | Depends on | Model           |
| ----- | ----------------------------------------- | -------- | ---------- | --------------- |
| 1     | Cloud Functions harness + accountBalances | ~1 day   | —          | **Fable**       |
| 2     | GL invariant + proposal-conversion tests  | ~1 day   | — (2b: 1)  | Sonnet          |
| 3     | Firestore rules tests                     | ~1 day   | —          | Sonnet          |
| 4     | Money-path e2e smoke + deploy gate        | ~1–1.5 d | —          | Sonnet¹         |
| 5     | Nightly production data audit             | ~½–1 day | —          | Fable² / Sonnet |
| 6     | Test-presence ratchet                     | ~½ day   | —          | Sonnet          |

Total ≈ 5–6 days. Phases are independent (except 2b) and parallel-session friendly.
Recommended order if serialized: **1 → 2 → 4 → 3 → 5 → 6** (money, then deploy gate, then access
control, then production watch, then decay prevention).

### Model recommendations (why)

Phases 2, 3, 4, and 6 are pattern-following: they copy existing exemplars in this repo
(`__integration__` suites, Playwright specs + auth helpers, `check-ui-standards.js` +
`ui-baselines.json`), and the pre-commit audits / type-check / CI catch most mistakes a smaller
model makes. Run them on **Sonnet**, one session per phase, using the Appendix B prompts.

- ¹ **Phase 4:** Sonnet for the specs and the `deploy.yml` edit, but whoever runs it must verify
  the gate with a real workflow dispatch before trusting it (execution protocol) — the risk is in
  the pipeline, not the code difficulty.
- ² **Phase 5:** the rule-32 consolidation (extracting one shared GL checker from the Data Health
  page + accounting-audit MCP implementations) is judgment work this codebase has been burned on —
  use **Fable** for that step. The scheduled function scaffold + email wiring afterwards is
  pattern-following and fine on Sonnet.
- **Phase 1 is Fable-only:** step 1 refactors live financial trigger logic into pure functions.
  A subtly wrong extraction changes balance math while the new tests pass (testing the wrong
  logic faithfully). Regardless of model, the session must stop and report the proposed
  pure-function split for user review BEFORE writing tests (the Appendix B prompt encodes this).

## Execution protocol (read before starting any phase)

- Work directly on `main`; **no commits or pushes without explicit user go-ahead** (parallel
  sessions may be active).
- Run `/precommit-fix` before any commit attempt; the hook runs the full rule audit.
- Any new collection/route/service: `/check-duplicates` first (rule 32).
- CI-workflow edits (`ci.yml`, `deploy.yml`): keep existing jobs untouched except for declared
  `needs:` additions; test with a dispatch run before relying on the gate.
- When a phase lands, append an "execution notes" subsection under that phase (deviations,
  decisions) — same convention as the UI standardisation plan — and update this doc's status.
- Update `.claude/MODULE_MAP.md` if new packages/scripts/functions are added.

## Appendix A — Verification greps (run from repo root)

```bash
# Phase 1: functions tests exist and run
ls functions/src/**/*.test.ts packages/functions/src/**/__tests__/ 2>/dev/null
grep -n 'functions-tests' .github/workflows/ci.yml

# Phase 2: new integration suites present
ls apps/web/src/__integration__/ | grep -E 'accounting|proposal'

# Phase 3: rules tests wired
grep -rn 'rules-unit-testing' apps/web package.json --include='*.json' -l

# Phase 4: deploy gated on smoke
grep -n 'smoke' .github/workflows/deploy.yml

# Phase 5: scheduled audit function exported
grep -n 'dataIntegrityAudit' functions/src/index.ts

# Phase 6: ratchet wired into pre-commit
grep -n 'check-test-presence' .husky/pre-commit scripts/audit/*.json 2>/dev/null
```

## Appendix B — Suggested kickoff prompts (one session per line)

- "Implement Phase 1 of docs/reviews/2026-07-05-automated-verification-plan.md (Cloud Functions test harness). Read accountBalances.ts first and report the pure-function split before writing tests."
- "Implement Phase 2a: accounting GL invariant integration test per the plan."
- "Implement Phase 3: Firestore rules tests, starting with the proposals/projects tenantId regression."
- "Implement Phase 4: money-path e2e smoke specs, then the deploy.yml gate."
- "Implement Phase 5: extract shared GL checks and add the nightly dataIntegrityAudit function. Run /check-duplicates on the existing Data Health logic first."
- "Implement Phase 6: check-test-presence ratchet script + baseline."

## Explicitly out of scope

- Global coverage thresholds or `--coverage` gates in CI
- Component/RTL tests for dialogs and forms
- Rewriting or migrating existing e2e specs
- Load/performance testing
- Making the full e2e suite run on every push (stays on-demand; only the @smoke subset gates deploys)
