# Proposals Module — Audit Findings (2026-05-15)

21 loopholes identified during a focused review of the Proposals module on
2026-05-15. Findings are grouped into clusters so one PR can fix several
related bugs at once.

Five of the 21 are already fixed in this commit chain:

- `fe709769` / `123c58ed` — pricing rebuild + over-engineering strip
- `bebb612a` — GST configurable on foreign quotes (the "swallow" lesson)
- `56888c45` — editor preview matches PDF
- `25bd0a37` — PDF Date of Submission stays blank pre-submission (fixes #13)
- `097875ff` — separates "submitted for approval" from "submitted to client"
  (fixes #11 + the new bug that surfaced today)

16 issues remain. The doc lists every finding, then proposes a clean-up
order that touches the lowest-risk items first.

## Cluster A — Legacy pricing fields swept (HIGH leverage)

`proposal.pricing` (stage-2 legacy) and `proposal.pricingConfig` (intermediate
stage-2.5d artefact, now dead) still live in the schema but nothing populates
them on new proposals. Multiple downstream readers fall back to them as the
"source of truth," which silently makes new-proposal data invisible.

| #   | Loophole                                                                                                                                                                                                                       | File / Lines                                                                                           | Severity |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------- |
| 2   | `DeliveryEditor` writes `pricing: { paymentTerms }` — Firestore replaces the nested map, blowing away `pricing.currency`, `subtotal`, `totalAmount`, `lineItems`, `taxItems`. Downstream conversion + revision-compare read 0. | [DeliveryEditor.tsx:143-145](apps/web/src/app/proposals/[id]/components/DeliveryEditor.tsx#L143-L145)  | HIGH     |
| 4   | `convertProposalToProject` reads `pricingConfig?.totalPrice ?? pricing.totalAmount`, both 0 on new proposals. Every accepted proposal converted to a project gets a ₹0 budget.                                                 | [projectConversion.ts:121-125](apps/web/src/lib/proposals/projectConversion.ts#L121-L125)              | HIGH     |
| 12  | Overview pricing card prefers `pricingConfig` then `pricing.totalAmount`. Shows ₹0 for new proposals even when Pricing tab has a real number.                                                                                  | [ProposalDetailClient.tsx:900-944](apps/web/src/app/proposals/[id]/ProposalDetailClient.tsx#L900-L944) | MEDIUM   |
| 14  | `compareRevisions` reads `pricingConfig?.totalPrice` / `pricing.totalAmount` / `terms`. RevisionHistoryCard's "what changed" never sees a real pricing or terms change.                                                        | [revisionManagement.ts:46-67](apps/web/src/lib/proposals/revisionManagement.ts#L46-L67)                | MEDIUM   |

**Fix:** point every read at `computeCommercialSummary(proposal).total` instead
of the legacy field. Remove the writes to `pricing.totalAmount` /
`pricingConfig` from any service that still does it. Once nothing reads them,
the fields themselves can stay in the schema as inert dead weight (cheaper
than a Firestore migration).

**Risk:** medium-high — touches 4 readers across 4 files. Smoke test:

- Edit Pricing → save → Overview card shows the new total.
- Open Convert-to-Project dialog on an accepted proposal → budget matches.
- Add a section → check the diff card on a 2-revision proposal.

## Cluster B — Editors lock past DRAFT (status gating)

State machine declares `canEdit: status === 'DRAFT'` but no code consumes it.
Every tab renders writable controls regardless of status, and `updateProposal`
only checks the permission flag, not the status.

| #   | Loophole                                                                                                                                                                                                                   | File / Lines                                                                                                                                                                                  | Severity |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | All editors save freely against any status. Scope / Costing / Pricing / Terms / Delivery / Description / Qualifications / Compliance / CoverLetter call `updateProposal` with no gating. Direct analog of the GST swallow. | [ProposalDetailClient.tsx:653-694](apps/web/src/app/proposals/[id]/ProposalDetailClient.tsx#L653-L694), [proposalService.ts:587-619](apps/web/src/lib/proposals/proposalService.ts#L587-L619) | HIGH     |
| 10  | ACCEPTED is terminal but conversion-to-project doesn't transition status — only `projectId` is set.                                                                                                                        | [stateMachines.ts:99](apps/web/src/lib/workflow/stateMachines.ts#L99)                                                                                                                         | MEDIUM   |

**Fix:** thread `readOnly = status !== 'DRAFT'` from
`ProposalDetailClient` into every tab editor. Disable Save buttons + form
inputs when `readOnly`. `updateProposal` itself enforces the gate as defence
in depth (throws if the proposal is not in DRAFT and the patch contains
content fields — keep status/workflow fields writable).

**Risk:** low-medium — additive (a new prop, default `false`, set when needed).
Smoke test:

- DRAFT proposal: every tab still saves normally.
- PENDING_APPROVAL / APPROVED proposal: Save buttons disabled, no accidental
  edits land.

## Cluster C — Approval / conversion / audit integrity

Three independent rough edges in the same workflow surface area.

| #   | Loophole                                                                                                                                                                                                                                                                                                                            | File / Lines                                                                            | Severity |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| 5   | `submitProposalForApproval` has no `requirePermission` check. Approve / reject / requestChanges all do; submit is the odd one out. (Firestore rules still gate, but in-app defence is the convention.)                                                                                                                              | [approvalWorkflow.ts:30-78](apps/web/src/lib/proposals/approvalWorkflow.ts#L30-L78)     | HIGH     |
| 6   | `convertProposalToProject` reads `proposal.projectId` outside any transaction; double-click → two projects, the second one overwrites `projectId` on the proposal. Same shape exists on `markProposalAsSubmitted`, `updateProposalStatus`, `approveProposal`, `rejectProposal`, `requestProposalChanges`, `createProposalRevision`. | [projectConversion.ts:21-210](apps/web/src/lib/proposals/projectConversion.ts#L21-L210) | HIGH     |
| 18  | `requestProposalChanges` doesn't `logAuditEvent`. Submit / approve / reject all log; this one doesn't, so disputes about who asked for what change won't appear in `/admin/activity`.                                                                                                                                               | [approvalWorkflow.ts:432-438](apps/web/src/lib/proposals/approvalWorkflow.ts#L432-L438) | MEDIUM   |
| 9   | State machine's `transitionPermissions` map declares `MANAGE_ESTIMATION` for proposal transitions; runtime check uses `MANAGE_PROPOSALS`. Dead config but misleading.                                                                                                                                                               | [stateMachines.ts:102-105](apps/web/src/lib/workflow/stateMachines.ts#L102-L105)        | LOW      |

**Fix:** one PR adds `requirePermission(MANAGE_PROPOSALS, ...)` to submit; wraps
the read-then-write in convert with `db.runTransaction`; adds the missing
audit log. Fix the state-machine permission map to `MANAGE_PROPOSALS` in the
same pass.

**Risk:** low — additive (a permission check, a transaction wrapper, a log
call). Smoke test:

- Submit a proposal → success when you have MANAGE_PROPOSALS.
- Double-click "Convert to Project" → still creates exactly one project.
- Request changes on a pending proposal → entry appears in `/admin/activity`.

## Cluster D — `cloneProposal` is incomplete

`cloneProposal` predates all the Stage-2+ fields and only copies the original
`pricing` / `scopeMatrix` / etc. legacy shape. Every field added since (six
in total) is silently dropped.

| #   | Loophole                                                                                                                                                                                                                                           | File / Lines                                                                          | Severity |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| 3   | Clone payload misses `termsBlocks`, `clientPricing`, `pricingBlocks`, `coverLetter`, `projectBrief`, `qualifications`, `complianceMatrix`, `workComponents`, `nativeCurrency`, `displayCurrency`, `displayFxRate`. Clones arrive blank everywhere. | [proposalService.ts:824-914](apps/web/src/lib/proposals/proposalService.ts#L824-L914) | HIGH     |
| 20  | Clone hardcodes `validityDate = today + 30 days`, ignoring the source's validity period.                                                                                                                                                           | same file                                                                             | LOW      |

**Fix:** spread the source proposal into the clone payload (mirror what
`createProposalRevision` does at line 650 — that one IS complete), then
override only the fields that should reset (`id`, `proposalNumber`,
`status: 'DRAFT'`, `revision: 1`, etc.). Strip undefined values before
write.

**Risk:** very low — single function, one change. Smoke test:

- Clone an existing proposal → every tab on the clone shows the source's
  content. Pricing / Terms / Qualifications / etc.

## Cluster E — Live entity refresh on PDF

The PDF generator already refreshes `clientAddress` / `contactPerson` /
`email` from the live entity via `loadClientProfile`. Two fields aren't in
the refresh and print whatever was denormalised at create time.

| #   | Loophole                                                                                                                                     | File / Lines                                                                                                                                                                  | Severity |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 7   | `clientName` and `enquiryNumber` print stale denorm. If the entity is renamed mid-deal, the cover page and metadata block keep the old name. | [ProposalPDFDocument.tsx:256-258](apps/web/src/components/pdf/ProposalPDFDocument.tsx#L256-L258), [proposalPDF.ts:78-108](apps/web/src/lib/proposals/proposalPDF.ts#L78-L108) | HIGH     |

**Fix:** extend `loadClientProfile` to also return `name`. Pass it into the
PDF via the existing `clientProfile` prop. Same shape that already exists for
the other three fields.

**Risk:** very low — additive to an existing helper. Smoke test:

- Rename an entity → regenerate a proposal PDF for that entity → name on
  the cover matches the new entity name.

## Cluster F — UX polish

Standalone items, not part of any cluster.

| #   | Loophole                                                                                                                                                                    | File / Lines                                                                                                | Severity |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| 8   | `validityDate` set at creation, never editable. Common ask after a round of negotiation.                                                                                    | [CreateProposalDialog.tsx:46](apps/web/src/app/proposals/enquiries/components/CreateProposalDialog.tsx#L46) | MEDIUM   |
| 15  | No tab-switch dirty guard. Pricing / Scope / Terms etc. silently discard unsaved work on tab change.                                                                        | [ProposalDetailClient.tsx:195-202](apps/web/src/app/proposals/[id]/ProposalDetailClient.tsx#L195-L202)      | MEDIUM   |
| 16  | "Save PDF" stamps storage URL with whatever date the click happened. Now that #13 is fixed, the PDF blob contents are stable, but the file's `generatedPdfAt` still drifts. | [proposalPDF.ts:237-243](apps/web/src/lib/proposals/proposalPDF.ts#L237-L243)                               | LOW      |
| 17  | Clone dialog entity selector pre-population won't fire callbacks (CLAUDE.md rule 15).                                                                                       | [CloneProposalDialog.tsx](apps/web/src/app/proposals/[id]/components/CloneProposalDialog.tsx)               | MEDIUM   |
| 19  | Annexures filter silently drops attachments with empty `fileName`.                                                                                                          | [ProposalPDFDocument.tsx:388-397](apps/web/src/components/pdf/ProposalPDFDocument.tsx#L388-L397)            | LOW      |
| 21  | PDF cover hardcodes `"Phone:"` / `"Email:"` labels (CLAUDE.md rule 29 — labels should live in constants).                                                                   | [ProposalPDFDocument.tsx:302-311](apps/web/src/components/pdf/ProposalPDFDocument.tsx#L302-L311)            | LOW      |

**Fix per item:** small and independent. The validityDate edit is a 1-line
field on the Overview tab. The dirty guard is a `useEffect` watching
`hasChanges` + a confirmation dialog on `handleTabChange`.

**Risk:** very low per item, additive everywhere.

## Recommended order

The instinct to defer fixes because "working code might break" is reasonable
but inverted: most of these clusters are additive (new permission check, new
field copied on clone, new entity lookup), not invasive. The genuinely
invasive one — Cluster A — is also the highest-leverage. Start with the
additive ones to build confidence, leave A for last.

1. **D (clone completeness)** — single function. Safe.
2. **E (PDF clientName refresh)** — one field added to an existing helper.
3. **C (approval/conversion/audit integrity)** — additive (permission check,
   audit log, transaction wrapper). Mirrors patterns already in the codebase.
4. **F (UX polish, item by item as time allows)** — each is independent.
5. **B (editors lock past DRAFT)** — slightly bigger surface (one prop
   threaded into every tab) but mechanically simple.
6. **A (legacy pricing fields swept)** — last, because it touches the most
   readers. After this, every future pricing change is a one-file edit.

Per cluster, the pattern that limits regression risk is the same:

- One commit per cluster, smoke-tested before merging.
- Each commit independently revertable via `git revert <sha>`.
- The smoke-test bullet lists above tell you exactly what to click to
  verify in 60 seconds.

The application isn't "too big to handle." The proposal module is tangled
because three pricing-shape rebuilds (`pricing` → `pricingConfig` →
`clientPricing`) shipped without removing the previous layer. Cluster A
finishes that migration. Cluster B prevents the next swallow-style bug.
Everything else is housekeeping.

## What's already fixed (since this audit was run)

| Audit #                                                                | Fixing commit |
| ---------------------------------------------------------------------- | ------------- |
| 11 (`isReadyForSubmission` dead)                                       | `097875ff`    |
| 13 (PDF date stamps today)                                             | `25bd0a37`    |
| (new) `submittedAt` overload between approval-submit and client-submit | `097875ff`    |
| 3 (`cloneProposal` drops Stage 2+ fields)                              | Cluster D     |
| 20 (clone hardcodes +30 days validity)                                 | Cluster D     |
| 1 (editors save freely against any status)                             | edit-lock     |
| (new) submitter has no way back from PENDING_APPROVAL                  | `07ea9752`    |
| 7 (clientName stale on PDF)                                            | Cluster E     |
| 5, 6, 9, 18 (approval/conversion/audit integrity)                      | Cluster C     |

The pricing rebuild commits (`fe709769`, `123c58ed`, `bebb612a`,
`56888c45`) also indirectly closed earlier holes — section amounts now
auto-track cost × markup, foreign-currency handling is consistent end-to-end.
