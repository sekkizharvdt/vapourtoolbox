# Codebase Reviews & Plans

Review records and implementation plans. **Active docs live here; completed/historical docs move to [../archive/](../archive/)** (add a row to its README when moving one). When a plan's work fully lands, update its `Status:` header with the commit hashes, then archive it.

## Active

| Doc                                                                                               | Type               | Why it's still here                                                                                                |
| ------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| [2026-07-07 application completion plan](2026-07-07-application-completion-plan.md)               | **Master roadmap** | THE plan — all decisions locked 2026-07-07; Phases 0–7 fold in every other active doc below                        |
| [2026-07-07 shape database consolidation](2026-07-07-shape-database-consolidation-plan.md)        | Plan (approved)    | Completion-plan **Phase 0** — first up; do before real BOMs reference shapes                                       |
| [2026-07-06 thermal calculators review](2026-07-06-thermal-calculators-review.md)                 | Findings           | Defect register for completion-plan Track E; no fixes landed                                                       |
| [2026-07-03 PO26XP062901 proposal vs agreement](2026-07-03-po26xp062901-proposal-vs-agreement.md) | Analysis           | Governs the Desolenator proposal→project conversion, still pending (completion plan B5)                            |
| [2026-06-15 procurement catalog unification](2026-06-15-procurement-catalog-unification.md)       | Design             | `CatalogRef` facade (Phases 2–3) = completion-plan **Phase 7**; design of record                                   |
| [2026-05-25 proposal scope↔pricing link + UI](2026-05-25-proposal-scope-pricing-link-and-ui.md)   | Plan               | Adopted as completion-plan **A4 (Phase 6)**; Q1–Q6 shape questions still to confirm                                |
| [2026-05-23 devil's advocate review](2026-05-23-devils-advocate-over-engineering.md)              | Review             | Storage rules → Track G1; agent scaffolding deliberately retained (post-spine agent); permission philosophy parked |
| [2026-03-15 security findings](2026-03-15-security-findings.md)                                   | Security review    | Findings 1/2/4 scheduled as Track G (Phase 4); email/MFA/CSP deliberately parked                                   |

## Past Periodic Reviews (archived)

| Date                                   | Grade  | Key Findings                                                                              |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| [2026-03-15](../archive/2026-03-15.md) | 9.0/10 | 328 commits, MED design platform, fixed assets, Flow redesign, 190-finding audit complete |
| [2026-01-20](../archive/2026-01-20.md) | 8.5/10 | Proposals module complete, entity ledger opening balance, PR approval buttons             |
| [2026-01-05](../archive/2026-01-05.md) | 8.4/10 | Holiday working system, on-duty requests, breadcrumbs, HR test coverage                   |
| [2025-12-26](../archive/2025-12-26.md) | 8.2/10 | First formal review. Zero type/lint errors, fixed useParams bug                           |

## Completed Plans (archived)

All work landed — commit hashes are in each doc's status header.

| Doc                                                                                                | Completed  |
| -------------------------------------------------------------------------------------------------- | ---------- |
| [Automated verification & testing](../archive/2026-07-05-automated-verification-plan.md)           | 2026-07-06 |
| [Procurement feedback round 4](../archive/2026-07-05-procurement-feedback-plan.md)                 | 2026-07-05 |
| [UI/UX standardisation](../archive/2026-07-03-ui-ux-standardisation-plan.md)                       | 2026-07-05 |
| [PO module & PDF enhancements (iZqGG)](../archive/2026-06-15-po-module-and-pdf-enhancements.md)    | 2026-06    |
| [Pending feedback batch](../archive/2026-06-15-pending-feedback-plans.md)                          | 2026-06    |
| [Service terms on POs (SO = PO model)](../archive/2026-06-08-service-order-module-enhancement.md)  | 2026-06    |
| [Procurement RFQ/PO/Amendment round 3](../archive/2026-05-25-procurement-rfq-po-amendment-plan.md) | 2026-05-26 |

## How to Conduct a Review

1. Run full test suite: `pnpm test`
2. Check type errors: `pnpm type-check`
3. Check lint: `pnpm lint`
4. Review recent commits: `git log --oneline --since="LAST_REVIEW_DATE"`
5. Check error monitoring (Sentry)
6. Use [TEMPLATE.md](TEMPLATE.md) for structure
7. Document findings in new file: `YYYY-MM-DD.md`
